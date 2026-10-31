/**
 * domain/evaluation.js
 * Función de evaluación estática: material + centralidad + avance de peones.
 * Pura: recibe el tablero (8x8) y el turno, devuelve una puntuación en
 * centipeones desde el punto de vista del bando que mueve.
 */

import { PIECE_VALUE } from './constants.js';

const centralityBonus = type => {
  if (type === 'n') return 10;
  if (type === 'b') return 5;
  if (type === 'p') return 3;
  return 0;
};

export function evaluate(board, turn) {
  let score = 0;

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r][c];
      if (!piece) continue;

      let value = PIECE_VALUE[piece.type];
      const centrality = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
      value += centrality * centralityBonus(piece.type);

      if (piece.type === 'p') {
        value += (piece.color === 'w' ? 6 - r : r - 1) * 4;
      }

      score += piece.color === 'w' ? value : -value;
    }
  }

  return turn === 'w' ? score : -score;
}
