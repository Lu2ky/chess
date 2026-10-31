/**
 * domain/notation.js
 * Formato de notación ajedrecística (número de jugada).
 */

export const moveNumberLabel = entry =>
  `${Math.floor(entry.ply / 2) + 1}${entry.color === 'w' ? '.' : '...'}`;
