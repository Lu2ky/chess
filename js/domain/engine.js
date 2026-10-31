/**
 * domain/engine.js
 * Motor de búsqueda negamax con poda alfa-beta, quiescencia e
 * profundización iterativa con heurística de historial.
 *
 * Depende SOLO de un "PositionPort" (ver application/ports.js):
 * un objeto con moves/move/undo/inCheck/board/turn/history/isGameOver.
 * No conoce chess.js, el DOM ni el almacenamiento.
 */

import { PIECE_VALUE } from './constants.js';
import { evaluate } from './evaluation.js';

export class Engine {
  /**
   * @param {object} position  Posición mutable e independiente (fork).
   * @param {{quiescenceDepth?:number, quiescenceBudget?:number}} options
   */
  constructor(position, { quiescenceDepth = 4, quiescenceBudget = 300 } = {}) {
    this.position = position;
    this.quiescenceDepth = quiescenceDepth;
    this.quiescenceBudget = quiescenceBudget;
    this.history = {};
    this.budget = 0;
  }

  evaluate() {
    return evaluate(this.position.board(), this.position.turn());
  }

  /** Orden de movimientos: capturas, promociones, historial y jaques. */
  order(move) {
    const capture = move.captured
      ? 1e5 + PIECE_VALUE[move.captured] * 10 - PIECE_VALUE[move.piece]
      : 0;
    const promotion = move.promotion ? 9e4 : 0;
    const history = this.history[move.from + move.to] || 0;
    const check = /[+#]/.test(move.san) ? 50 : 0;
    return capture + promotion + history + check;
  }

  /**
   * Quiescencia: sigue capturas (y evasiones de jaque) hasta que la
   * posición queda tranquila.
   */
  quiescence(alpha, beta, depth) {
    const inCheck = this.position.inCheck();

    if (!inCheck) {
      const standPat = this.evaluate();
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    }

    if (depth <= 0 || this.budget <= 0) return inCheck ? this.evaluate() : alpha;

    let moves = this.position.moves({ verbose: true });
    if (!moves.length) return inCheck ? -30000 : 0;

    this.budget -= 1;
    const standPat = inCheck ? 0 : this.evaluate();
    if (!inCheck) moves = moves.filter(m => m.captured || m.promotion);
    moves.sort((a, b) => this.order(b) - this.order(a));

    for (const move of moves) {
      if (!inCheck && (move.captured || move.promotion)) {
        const gain = PIECE_VALUE[move.captured] || 0;
        if (standPat + gain + 200 < alpha) continue;
      }

      this.position.move(move);
      const value = -this.quiescence(-beta, -alpha, depth - 1);
      this.position.undo();

      if (value >= beta) return beta;
      if (value > alpha) alpha = value;
    }

    return alpha;
  }

  /** Negamax con poda alfa-beta. */
  negamax(depth, alpha, beta) {
    if (depth === 0) return this.quiescence(alpha, beta, this.quiescenceDepth);

    const moves = this.position.moves({ verbose: true });
    if (!moves.length) return this.position.inCheck() ? -30000 - depth : 0;

    moves.sort((a, b) => this.order(b) - this.order(a));

    for (const move of moves) {
      this.position.move(move);
      const value = -this.negamax(depth - 1, -beta, -alpha);
      this.position.undo();

      if (value >= beta) {
        if (!move.captured) {
          const key = move.from + move.to;
          this.history[key] = (this.history[key] || 0) + depth * depth;
        }
        return beta;
      }
      if (value > alpha) alpha = value;
    }

    return alpha;
  }

  /**
   * Profundización iterativa: las iteraciones cortas calientan la tabla
   * de historial que ordena las siguientes.
   */
  scoreAll(depth) {
    this.history = {};
    const moves = this.position.moves({ verbose: true });
    let results = [];

    for (let d = 1; d <= depth; d += 1) {
      results = moves.map(move => {
        this.budget = this.quiescenceBudget;
        this.position.move(move);
        const score = -this.negamax(d - 1, -1e5, 1e5);
        this.position.undo();
        return { move, score };
      });
    }

    return results;
  }

  /** Mejor jugada pura (para pistas). */
  bestMove(depth = 3) {
    const results = this.scoreAll(depth);
    if (!results.length) return null;
    return results.reduce((best, cur) => (cur.score > best.score ? cur : best)).move;
  }

  /**
   * Elección con "personalidad" según ELO: profundidad, margen de error
   * y probabilidad de jugada aleatoria.
   */
  chooseMove(elo) {
    const depth = elo < 500 ? 1 : elo < 1400 ? 2 : 3;
    this.quiescenceDepth = elo < 600 ? 0 : elo < 1400 ? 2 : 4;

    const results = this.scoreAll(depth);
    this.quiescenceDepth = 4;
    if (!results.length) return null;

    const best = Math.max(...results.map(r => r.score));
    const margin = elo < 2600 ? ((2600 - elo) / 2600) * 350 : 0;
    const randomChance = elo < 1000 ? ((1000 - elo) / 1000) * 0.5 : 0;

    if (Math.random() < randomChance) {
      return results[Math.floor(Math.random() * results.length)].move;
    }

    const pool = results.filter(r => r.score >= best - margin);
    return pool[Math.floor(Math.random() * pool.length)].move;
  }
}
