/**
 * js/adapters/stockfish-gateway.js
 * Adaptador que implementa StockfishPort hablando UCI directamente con el
 * worker de Stockfish (stockfish-nnue-16-single.js).
 *
 * El build `single` ya es un worker UCI completo: recibe cadenas por
 * postMessage ("uci", "position fen ...", "go depth N") y responde con las
 * líneas `info ...` y `bestmove ...`. No hace falta envolverlo en otro worker.
 *
 * Responsabilidades:
 *  - Inicializar el motor (uci / isready).
 *  - Serializar búsquedas (una sola a la vez) mediante una cola.
 *  - Cancelar con `stop` y AbortSignal.
 *  - Traducir las jugadas UCI a objetos de jugada completos (vía position.fork()).
 *  - Devolver la PV en SAN.
 */

/** @typedef {import('../application/ports.js').StockfishPort} StockfishPort */
/** @typedef {import('../application/ports.js').PositionPort} PositionPort */
/** @typedef {import('../application/ports.js').StockfishAnalysisResult} StockfishAnalysisResult */

const WORKER_URL = new URL(
  '../workers/stockfish/stockfish-nnue-16-single.js',
  import.meta.url,
).href;

const INIT_TIMEOUT = 10000;
const DEFAULT_SEARCH_TIMEOUT = 30000;
const STOP_GRACE = 1500;

/** Crea un DOMException de aborto (o un Error con name AbortError). */
function abortError(message = 'Análisis cancelado') {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/** Busca la jugada legal que corresponde a una jugada UCI. */
function uciToMove(position, uci) {
  if (!uci || uci.length < 4) return null;

  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4].toLowerCase() : null;

  const moves = position.moves({ verbose: true }) || [];
  return (
    moves.find(
      move =>
        move.from === from &&
        move.to === to &&
        (move.promotion ?? null) === promotion,
    ) || null
  );
}

/**
 * Resuelve una lista de jugadas UCI a partir de una posición, devolviendo la
 * primera jugada completa y la PV en SAN.
 */
function resolveLine(position, uciMoves) {
  const work = position.fork ? position.fork() : position;
  const pv = [];
  let firstMove = null;

  for (const uci of uciMoves || []) {
    const move = uciToMove(work, uci);
    if (!move) break;

    if (!firstMove) firstMove = move;
    pv.push(move.san);
    work.move(move);
  }

  return { move: firstMove, pv };
}

/** Extrae {cp} o {mate} de una línea `info`. */
function parseScore(line) {
  const mate = /\bscore mate (-?\d+)/.exec(line);
  if (mate) return { mate: Number(mate[1]) };

  const cp = /\bscore cp (-?\d+)/.exec(line);
  if (cp) return { cp: Number(cp[1]) };

  return null;
}

/**
 * Parsea una línea `info` de Stockfish.
 * @returns {{index:number, score:object, uciMoves:string[]}|null}
 */
function parseInfoLine(line) {
  if (!line.startsWith('info ')) return null;

  const score = parseScore(line);
  if (!score) return null;

  const pvMatch = /\bpv\s+(.+)$/.exec(line);
  if (!pvMatch) return null;

  const mpvMatch = /\bmultipv\s+(\d+)/.exec(line);
  const index = mpvMatch ? Number(mpvMatch[1]) : 1;

  return {
    index,
    score,
    uciMoves: pvMatch[1].trim().split(/\s+/).filter(Boolean),
  };
}

/** Convierte un score {cp|mate} a centipeones (para la barra de ventaja). */
function scoreToCp(score) {
  if (!score) return 0;
  if (typeof score.cp === 'number') return score.cp;
  if (typeof score.mate === 'number') {
    return score.mate > 0 ? 10000 - score.mate * 10 : -10000 - score.mate * 10;
  }
  return 0;
}

export class StockfishGateway {
  constructor({ workerUrl = WORKER_URL } = {}) {
    this.workerUrl = workerUrl;

    /** @type {Worker|null} */
    this.worker = null;
    /** @type {Promise<void>|null} */
    this._initPromise = null;
    this._initResolve = null;
    this._initReject = null;
    this._initTimer = null;
    this._ready = false;
    this._disposed = false;

    /** Búsqueda en curso. @type {object|null} */
    this._current = null;

    /** Cola de búsquedas: garantiza una sola a la vez. */
    this._queue = Promise.resolve();

    this._onMessageBound = event => this._onMessage(event);
    this._onErrorBound = event => this._onError(event);
    this._onMessageErrorBound = event => this._onMessageError(event);
  }

  /* ------------------------------------------------------------------ */
  /* Ciclo de vida                                                       */
  /* ------------------------------------------------------------------ */

  _spawn() {
    if (this.worker || this._disposed) return;

    // Worker clásico (no module): el build single ya incluye su runtime.
    this.worker = new Worker(this.workerUrl);
    this.worker.addEventListener('message', this._onMessageBound);
    this.worker.addEventListener('error', this._onErrorBound);
    this.worker.addEventListener('messageerror', this._onMessageErrorBound);
  }

  /** Inicializa el motor. Resuelve cuando `readyok` llega. */
  init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      this._initResolve = resolve;
      this._initReject = reject;

      try {
        this._spawn();
      } catch (error) {
        this._ready = false;
        reject(error);
        return;
      }

      this._initTimer = setTimeout(() => {
        if (this._ready) return;
        this._ready = false;
        reject(new Error('Timeout inicializando Stockfish'));
      }, INIT_TIMEOUT);

      this._send('uci');
    });

    return this._initPromise;
  }

  /** @returns {Promise<{ready:boolean}>} */
  async ready() {
    if (this._ready) return { ready: true };
    if (this._disposed) return { ready: false };

    try {
      await this.init();
    } catch {
      /* el motor no está disponible */
    }

    return { ready: this._ready };
  }

  /** Comprobación síncrona (no lanza). */
  isReady() {
    return this._ready && Boolean(this.worker) && !this._disposed;
  }

  /** @implements {StockfishPort['terminate']} */
  terminate() {
    this._disposed = true;

    if (this._current) {
      this._settle(this._current, new Error('Gateway terminado'));
    }

    if (this.worker) {
      try {
        this.worker.postMessage('stop');
        this.worker.postMessage('quit');
      } catch {
        /* el worker ya podría estar muerto */
      }
      this.worker.removeEventListener('message', this._onMessageBound);
      this.worker.removeEventListener('error', this._onErrorBound);
      this.worker.removeEventListener('messageerror', this._onMessageErrorBound);
      this.worker.terminate();
      this.worker = null;
    }

    this._ready = false;
    this._initPromise = null;
    this._initResolve = null;
    this._initReject = null;
    clearTimeout(this._initTimer);
  }

  /* ------------------------------------------------------------------ */
  /* Protocolo UCI                                                       */
  /* ------------------------------------------------------------------ */

  _send(command) {
    if (!this.worker || this._disposed) return;
    this.worker.postMessage(command);
  }

  _onMessage(event) {
    const raw = event?.data;
    const text =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw.data === 'string'
          ? raw.data
          : '';

    if (!text) return;

    for (const part of text.split('\n')) {
      const line = part.trim();
      if (!line) continue;

      if (line === 'uciok') {
        this._send('setoption name Threads value 1');
        this._send('setoption name Hash value 16');
        this._send('isready');
        continue;
      }

      if (line === 'readyok') {
        this._ready = true;
        clearTimeout(this._initTimer);
        const resolve = this._initResolve;
        this._initResolve = null;
        this._initReject = null;
        resolve?.();
        continue;
      }

      if (line.startsWith('info ')) {
        if (this._current) this._onInfo(line);
        continue;
      }

      if (line.startsWith('bestmove')) {
        if (this._current) this._onBestMove(line);
        continue;
      }
    }
  }

  _onInfo(line) {
    const current = this._current;
    if (!current || current.settled) return;

    const info = parseInfoLine(line);
    if (!info) return;

    current.lines.set(info.index, info);
  }

  _onBestMove(line) {
    const current = this._current;
    if (!current || current.settled) return;

    // Si se pidió cancelar, esperábamos este `bestmove` para dejar el motor
    // libre y recién ahora rechazamos.
    if (current.abortError) {
      this._settle(current, current.abortError);
      return;
    }

    const uci = line.split(/\s+/)[1];
    this._settle(current, null, this._buildResult(current, uci));
  }

  _buildResult(current, bestUci) {
    const position = current.position;
    const ordered = [...current.lines.entries()].sort((a, b) => a[0] - b[0]);

    const multipv = [];
    for (const [, info] of ordered) {
      const resolved = resolveLine(position, info.uciMoves);
      if (!resolved.move) continue;
      multipv.push({
        move: resolved.move,
        score: info.score,
        pv: resolved.pv,
      });
    }

    if (!multipv.length && bestUci && bestUci !== '(none)') {
      const resolved = resolveLine(position, [bestUci]);
      if (resolved.move) {
        multipv.push({
          move: resolved.move,
          score: { cp: 0 },
          pv: resolved.pv,
        });
      }
    }

    return {
      bestMove: multipv[0]?.move ?? null,
      score: multipv[0]?.score ?? { cp: 0 },
      pv: multipv[0]?.pv ?? [],
      multipv,
    };
  }

  _settle(current, error, value) {
    if (!current || current.settled) return;

    current.settled = true;
    clearTimeout(current.timer);
    clearTimeout(current.stopTimer);

    if (current.signal && current.onAbort) {
      current.signal.removeEventListener('abort', current.onAbort);
    }

    if (this._current === current) this._current = null;

    if (error) current.reject(error);
    else current.resolve(value);
  }

  _cancelCurrent(error) {
    const current = this._current;
    if (!current || current.settled || current.abortError) return;

    current.abortError = error;
    this._send('stop');

    // Red de seguridad: si el motor no responde a `stop`, liberamos la cola.
    current.stopTimer = setTimeout(() => this._settle(current, error), STOP_GRACE);
  }

  _onError(event) {
    const error = new Error(event?.message || 'Error del worker Stockfish');
    this._fail(error);
  }

  _onMessageError(event) {
    const error = new Error(event?.message || 'Mensaje inválido del worker Stockfish');
    this._fail(error);
  }

  _fail(error) {
    this._ready = false;

    const rejectInit = this._initReject;
    this._initResolve = null;
    this._initReject = null;
    clearTimeout(this._initTimer);
    rejectInit?.(error);

    if (this._current) this._settle(this._current, error);
  }

  /* ------------------------------------------------------------------ */
  /* API pública                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * @implements {StockfishPort['analyse']}
   * @param {PositionPort} position
   * @param {{depth?:number, nodes?:number, time?:number, multipv?:number}} [options]
   * @param {AbortSignal} [signal]
   * @returns {Promise<StockfishAnalysisResult>}
   */
  async analyse(position, options = {}, signal) {
    const { ready } = await this.ready();
    if (!ready) throw new Error('STOCKFISH_NOT_READY');

    const { depth = 15, nodes, time, multipv = 1 } = options;

    const run = () => this._search(position, { depth, nodes, time, multipv }, signal);

    // Encadena respetando el orden; un fallo no rompe la cola.
    const result = this._queue.then(run, run);
    this._queue = result.catch(() => {});
    return result;
  }

  async _search(position, options, signal) {
    if (this._disposed) throw new Error('Gateway terminado');
    if (signal?.aborted) throw abortError();

    return new Promise((resolve, reject) => {
      const current = {
        position,
        lines: new Map(),
        resolve,
        reject,
        signal,
        settled: false,
        abortError: null,
        timer: null,
        stopTimer: null,
        onAbort: null,
      };

      const timeout = options.time
        ? options.time + 5000
        : DEFAULT_SEARCH_TIMEOUT;

      current.timer = setTimeout(() => {
        this._cancelCurrent(new Error('Timeout de análisis Stockfish'));
      }, timeout);

      if (signal) {
        current.onAbort = () => this._cancelCurrent(abortError());
        signal.addEventListener('abort', current.onAbort, { once: true });
      }

      this._current = current;

      const lines = Math.max(1, Math.min(500, options.multipv || 1));
      this._send(`setoption name MultiPV value ${lines}`);
      this._send(`position fen ${position.fen()}`);

      const go = ['go'];
      if (options.depth) go.push('depth', String(options.depth));
      else if (options.nodes) go.push('nodes', String(options.nodes));
      else if (options.time) go.push('movetime', String(options.time));
      else go.push('depth', '15');

      this._send(go.join(' '));
    });
  }

  /**
   * @implements {StockfishPort['evaluate']}
   * @param {PositionPort} position
   * @param {AbortSignal} [signal]
   * @returns {Promise<{cp?:number, mate?:number}>}
   */
  async evaluate(position, signal) {
    const result = await this.analyse(position, { depth: 8, multipv: 1 }, signal);
    return result.score ?? { cp: 0 };
  }
}

/** Factory para inyección de dependencias. */
export function createStockfishGateway(options) {
  return new StockfishGateway(options);
}

/** Utilidades puras expuestas para tests. */
export const _internals = {
  abortError,
  uciToMove,
  resolveLine,
  parseScore,
  parseInfoLine,
  scoreToCp,
  WORKER_URL,
};

export default StockfishGateway;
