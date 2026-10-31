/**
 * application/analysis-service.js
 * Caso de uso: analizar posiciones y jugadas. Orquesta el motor de
 * dominio y las reglas de clasificación. No conoce DOM ni storage.
 */

import { Engine } from '../domain/engine.js';
import { classifyMove, detectCause } from '../domain/classification.js';
import { PIECE_VALUE } from '../domain/constants.js';

export class AnalysisService {
  /** @param {{chess: import('./ports.js').ChessPort}} deps */
  constructor({ chess }) {
    this.chess = chess;
  }

  /** Bifurca siempre: el análisis nunca debe corromper la partida viva. */
  fork(position) {
    return position.fork();
  }

  scoredMoves(position, depth = 3) {
    const engine = new Engine(this.fork(position));
    return engine.scoreAll(depth);
  }

  bestMove(position, depth = 3) {
    const engine = new Engine(this.fork(position));
    return engine.bestMove(depth);
  }

  /** Puntuación negamax a cierta profundidad (para la barra de ventaja). */
  evaluateDepth(position, depth = 2) {
    const engine = new Engine(this.fork(position), { quiescenceBudget: 300 });
    return engine.negamax(depth, -1e5, 1e5);
  }

  /**
   * Clasifica una jugada comparándola con la mejor de la búsqueda.
   * @param {{position:object, move:object, isBook:Function}} input
   */
  classify({ position, move, isBook }) {
    const scored = this.scoredMoves(position, 3);

    const isHanging = candidate => {
      const work = this.fork(position);
      work.move(candidate);
      return work.moves({ verbose: true }).some(option => option.to === candidate.to && option.captured);
    };

    return classifyMove({ scored, move, isBook, isHanging });
  }

  /** Causa del error. `position` debe estar ANTES de la jugada. */
  cause({ position, classification, move }) {
    return detectCause({ position, classification, playedMove: move });
  }

  /**
   * Casillas amenazadas para un bando: piezas atacadas sin recaptura o
   * por una pieza de menos valor.
   */
  threats({ position, side, opponent }) {
    const parts = position.fen().split(' ');
    parts[1] = opponent;
    parts[3] = '-';
    const fen = parts.join(' ');

    let probe;
    try {
      probe = this.chess.newPosition(fen);
    } catch {
      return [];
    }

    const squares = [];
    let moves;
    try {
      moves = probe.moves({ verbose: true });
    } catch {
      return [];
    }

    for (const move of moves) {
      if (!move.captured || move.captured === 'k' || squares.includes(move.to)) continue;

      let after;
      try {
        after = this.chess.newPosition(fen);
        after.move(move);
      } catch {
        continue;
      }

      const recapture = after
        .moves({ verbose: true })
        .some(reply => reply.to === move.to && reply.captured);

      if (!recapture || PIECE_VALUE[move.captured] > PIECE_VALUE[move.piece] + 50) {
        squares.push(move.to);
      }
    }

    return squares;
  }
}
