/**
 * application/analysis-service.js
 * Caso de uso: analizar posiciones y jugadas con Stockfish.
 *
 * Clasificación en dos búsquedas:
 *   1. Posición ANTES de la jugada (multipv 3) -> mejor jugada y alternativas.
 *   2. Posición DESPUÉS de la jugada (multipv 1) -> evaluación de lo jugado.
 * Así funciona aunque la jugada jugada no aparezca en el multipv.
 *
 * Si Stockfish no está disponible, cae de forma transparente al motor
 * interno (`domain/engine.js`) para que la app siga siendo jugable.
 */

import { createAnalysisCache } from './analysis-cache.js';
import { Engine } from '../domain/engine.js';
import { classifyMove, detectCause, _internals } from '../domain/classification.js';

const { sameMove, normalizeMove } = _internals;

/** Convierte un score {cp|mate} a centipeones (mate = ±10000). */
function lineToCp(line) {
  if (!line) return 0;
  if (typeof line.mate === 'number') return line.mate > 0 ? 10000 : -10000;
  return typeof line.cp === 'number' ? line.cp : 0;
}

export class AnalysisService {
  /**
   * @param {object} deps
   * @param {import('./ports.js').ChessPort} deps.chess - Adaptador de chess.js
   * @param {object} [deps.stockfish] - Implementa StockfishPort (null = legacy)
   * @param {object} [deps.cache] - Caché LRU (opcional)
   */
  constructor({ chess, stockfish = null, cache }) {
    this.chess = chess;
    this.stockfish = stockfish;
    this.cache = cache || createAnalysisCache();
  }

  /** Bifurca la posición: el análisis nunca corrompe la partida viva. */
  fork(position) {
    return position.fork();
  }

  /** Clave de caché: FEN antes de la jugada + UCI + depth + ELO/fase. */
  _cacheKey(position, move, depth, elo = 1500, phase = 'm') {
    const moveUci =
      move.uci || `${move.from}${move.to}${move.promotion || ''}`;
    return this.cache.makeKey(
      position.fen(),
      `${moveUci}|${elo}|${phase}`,
      depth,
    );
  }

  /** Lanza si Stockfish no está disponible. */
  async _ensureReady() {
    if (!this.stockfish) return;
    const { ready } = await this.stockfish.ready();
    if (!ready) throw new Error('STOCKFISH_NOT_READY');
  }

  /**
   * Análisis a una profundidad concreta.
   * @returns {Promise<object>} Resultado crudo {multipv:[{move, score, pv}]}
   */
  async _analyse(position, depth, multipv = 1, signal) {
    if (!this.stockfish) {
      return this._legacyAnalyse(position, depth, multipv);
    }
    await this._ensureReady();
    return this.stockfish.analyse(position, { depth, multipv }, signal);
  }

  /** Análisis legacy con el motor interno (profundidad acotada). */
  _legacyAnalyse(position, depth, multipv = 1) {
    const work = position.fork();
    const engine = new Engine(work);
    const safeDepth = Math.max(1, Math.min(3, Math.round(depth) || 1));

    const scored = engine
      .scoreAll(safeDepth)
      .sort((a, b) => b.score - a.score);

    return {
      bestMove: scored[0]?.move ?? null,
      score: { cp: scored[0]?.score ?? 0 },
      pv: scored[0] ? [scored[0].move.san] : [],
      multipv: scored.slice(0, multipv).map(entry => ({
        move: entry.move,
        score: { cp: entry.score },
        pv: [entry.move.san],
      })),
    };
  }

  /** Normaliza el multipv crudo al formato que consume el dominio. */
  _normalizeMultipv(result) {
    return (result?.multipv || [])
      .filter(entry => entry && entry.move)
      .map(entry => ({
        move: entry.move,
        cp: entry.score?.cp ?? null,
        mate: entry.score?.mate ?? null,
        pv: entry.pv ?? [],
      }));
  }

  /**
   * Clasifica la jugada del jugador.
   *
   * @param {object} params
   * @param {object} params.position - Posición ANTES de la jugada
   * @param {object} params.move - Jugada ejecutada (legal, con from/to/san/piece)
   * @param {(move:object, loss:number)=>boolean} [params.isBook]
   * @param {number} [params.elo=1500]
   * @param {string} [params.phase='m']
   * @param {number} [targetDepth=15]
   * @param {AbortSignal} [signal]
   * @returns {Promise<object>}
   */
  async classify(
    { position, move, isBook, elo = 1500, phase = 'm' },
    targetDepth = 15,
    signal,
  ) {
    const depth = Math.max(1, Math.round(targetDepth) || 15);
    const bookCheck = typeof isBook === 'function' ? isBook : () => false;

    // Atajo: si la jugada entra en el libro, no hace falta buscar.
    if (bookCheck(move, 0)) {
      const played = normalizeMove(move);
      return {
        label: 'Libro',
        lossPercent: 0,
        lossCp: 0,
        move: played,
        bestMove: played,
        bestMoveSan: played.san,
        pv: [played.san],
        multipv: [],
        mateIn: null,
        engine: 'book',
        depth: 0,
        score: 0,
        playedScore: 0,
        provisional: false,
        fromCache: false,
      };
    }

    const cacheKey = this._cacheKey(position, move, depth, elo, phase);
    const cached = this.cache.get(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    try {
      // 1) Mejor jugada y alternativas desde la posición actual.
      const beforeRaw = await this._analyse(position, depth, 3, signal);
      const before = this._normalizeMultipv(beforeRaw);

      // 2) Evaluación de la jugada jugada desde la posición resultante.
      let playedLine = before.find(line => sameMove(line.move, move)) || null;

      if (!playedLine) {
        const after = position.fork();
        const applied = after.move(move);

        if (applied) {
          const afterRaw = await this._analyse(after, depth, 1, signal);
          const afterBest = this._normalizeMultipv(afterRaw)[0] ?? null;

          playedLine = {
            move,
            cp: afterBest && afterBest.mate == null ? -(afterBest.cp ?? 0) : null,
            mate: afterBest && afterBest.mate != null ? -afterBest.mate : null,
            pv: [move.san, ...(afterBest?.pv ?? [])],
          };
        }
      }

      if (!before.length && !playedLine) {
        return {
          label: 'Bueno',
          lossPercent: 0,
          lossCp: 0,
          move: normalizeMove(move),
          bestMove: null,
          bestMoveSan: null,
          pv: [],
          multipv: [],
          mateIn: null,
          engine: this.stockfish ? 'stockfish' : 'legacy',
          depth: this.stockfish ? depth : 3,
          score: 0,
          playedScore: 0,
          provisional: false,
          fromCache: false,
        };
      }

      const scored = [...before];
      if (playedLine && !scored.some(line => sameMove(line.move, move))) {
        scored.push(playedLine);
      }

      const classification = classifyMove({
        scored,
        move,
        isBook: bookCheck,
        isHanging: () => false,
        elo,
        phase,
      });

      const bestLine = before[0] ?? playedLine;
      const bestCp = lineToCp(bestLine);
      const playedCp = lineToCp(playedLine);
      // Pérdida en centipeones (recortada): sirve para frases en "peones".
      // lossPercent es pérdida de probabilidad de victoria (0-100).
      const lossCp = Math.max(0, Math.min(1000, bestCp - playedCp));

      const result = {
        ...classification,
        engine: this.stockfish ? 'stockfish' : 'legacy',
        depth: this.stockfish ? depth : 3,
        score: bestCp,
        playedScore: playedCp,
        lossCp,
        playedMate: playedLine?.mate ?? null,
        provisional: false,
        timestamp: Date.now(),
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;

      console.warn(
        '[AnalysisService] Stockfish no disponible, usando motor legacy:',
        error?.message || error,
      );
      return this._legacyClassify(position, move, bookCheck, elo, phase);
    }
  }

  /** Clasificación legacy síncrona (fallback). */
  _legacyClassify(position, move, isBook, elo = 1500, phase = 'm') {
    const work = position.fork();
    const engine = new Engine(work);

    const scored = engine
      .scoreAll(3)
      .sort((a, b) => b.score - a.score)
      .map(entry => ({
        move: entry.move,
        cp: entry.score,
        mate: null,
        pv: [entry.move.san],
      }));

    const classification = classifyMove({
      scored,
      move,
      isBook,
      isHanging: () => false,
      elo,
      phase,
    });

    const played = scored.find(line => sameMove(line.move, move));
    const bestCp = scored[0]?.cp ?? 0;
    const playedCp = played?.cp ?? 0;

    return {
      ...classification,
      engine: 'legacy',
      depth: 3,
      score: bestCp,
      playedScore: playedCp,
      lossCp: Math.max(0, Math.min(1000, bestCp - playedCp)),
      playedMate: null,
      provisional: false,
      timestamp: Date.now(),
    };
  }

  /**
   * Mejor jugada a una profundidad dada (para pistas).
   * @returns {Promise<{move:object, score:number, cp?:number, mate?:number, pv:string[]}|null>}
   */
  async bestMove(position, depth = 12, signal) {
    try {
      const result = await this._analyse(position, depth, 1, signal);
      const best = this._normalizeMultipv(result)[0] ?? null;

      if (!best) return null;

      return {
        move: normalizeMove(best.move),
        score: lineToCp(best),
        cp: best.cp,
        mate: best.mate,
        pv: best.pv,
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;

      const work = position.fork();
      const engine = new Engine(work);
      const move = engine.bestMove(3);
      if (!move) return null;

      return {
        move: normalizeMove(move),
        score: 0,
        cp: 0,
        mate: null,
        pv: [move.san],
      };
    }
  }

  /**
   * Evaluación a cierta profundidad (barra de ventaja).
   * @returns {Promise<number>} centipeones desde el punto de vista del que mueve
   */
  async evaluateDepth(position, depth = 10, signal) {
    try {
      const result = await this._analyse(position, depth, 1, signal);
      const best = this._normalizeMultipv(result)[0] ?? null;
      return lineToCp(best);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;

      const work = position.fork();
      const engine = new Engine(work);
      return engine.negamax(2, -1e5, 1e5);
    }
  }

  /**
   * Amenazas: casillas de destino de las mejores jugadas del rival.
   * @param {{position:object, side:string, opponent:string}} params
   * @param {AbortSignal} [signal]
   * @returns {Promise<string[]>}
   */
  async threats({ position, side, opponent }, signal) {
    try {
      const parts = position.fen().split(' ');
      parts[1] = opponent;
      parts[3] = '-'; // sin en passant

      const probe = this.chess.newPosition(parts.join(' '));
      if (!probe.moves().length) return [];

      const result = await this._analyse(probe, 10, 5, signal);
      const lines = this._normalizeMultipv(result);

      const squares = new Set();
      for (const line of lines.slice(0, 5)) {
        if (line.move?.to) squares.add(line.move.to);
      }

      return [...squares];
    } catch (error) {
      if (error?.name === 'AbortError') return [];
      return [];
    }
  }

  /** Causa del error (delega al dominio, posición ANTES de la jugada). */
  cause({ position, classification, move }) {
    return detectCause({ position, classification, playedMove: move });
  }

  /** Clasificación síncrona: caché o estimación legacy. */
  classifySync({ position, move, isBook, elo = 1500, phase = 'm' }) {
    const cacheKey = this._cacheKey(position, move, 15, elo, phase);
    const cached = this.cache.get(cacheKey);
    if (cached) return { ...cached, fromCache: true, sync: true };

    const bookCheck = typeof isBook === 'function' ? isBook : () => false;
    return {
      ...this._legacyClassify(position, move, bookCheck, elo, phase),
      sync: true,
      estimated: true,
    };
  }
}
