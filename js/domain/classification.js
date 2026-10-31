/**
 * domain/classification.js
 * Clasificación de jugadas basada en win-probability, con umbrales por ELO y fase.
 * Funciones puras: reciben datos, no tocan el DOM ni el storage.
 */

import { PIECE_VALUE, ELO_TIERS, LABELS } from './constants.js';
import {
  winProb,
  mateWinProb,
  calculateLossPercent,
  getThresholds,
  labelFromLoss,
} from './elo-thresholds.js';

/**
 * Compara dos jugadas por from, to y promotion.
 */
const sameMove = (a, b) =>
  a.from === b.from && a.to === b.to && a.promotion === b.promotion;

/**
 * Normaliza una jugada para salida consistente.
 */
function normalizeMove(move) {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
    san: move.san,
    captured: move.captured ?? null,
    piece: move.piece?.toLowerCase() ?? 'p',
  };
}

/**
 * Clasifica una jugada usando win-probability y umbrales por ELO/fase.
 *
 * @param {Object} input
 * @param {Array} input.scored - Array de multipv ordenado por score [{ move, cp?, mate?, pv[] }, ...]
 * @param {Object} input.move - Jugada realmente ejecutada (con from, to, promotion, san, captured, piece)
 * @param {Function} input.isBook - (move, lossPercent) => boolean
 * @param {Function} input.isHanging - (move) => boolean
 * @param {number} [input.elo=1500] - ELO del jugador
 * @param {string} [input.phase='m'] - Fase: 'o'|'m'|'e'
 * @returns {Object} Clasificación completa
 */
export function classifyMove({
  scored,
  move,
  isBook,
  isHanging,
  elo = 1500,
  phase = 'm',
}) {
  const playedMove = normalizeMove(move);

  if (!scored || scored.length === 0) {
    return {
      label: 'Bueno',
      lossPercent: 0,
      move: playedMove,
      bestMove: null,
      bestMoveSan: null,
      pv: [],
      multipv: [],
      mateIn: null,
    };
  }

  const best = scored[0];
  const bestMove = normalizeMove(best.move);

  // Buscar la jugada jugada en el multipv
  const played = scored.find(entry => sameMove(entry.move, move));

  // Si no está en multipv (p.ej. jugada ilegal no analizada), asumir loss 0
  if (!played) {
    return {
      label: 'Bueno',
      lossPercent: 0,
      move: playedMove,
      bestMove,
      bestMoveSan: bestMove.san,
      pv: best.pv ?? [],
      multipv: scored.slice(0, 3).map(normalizeMpvEntry),
      mateIn: best.mate ?? null,
    };
  }

  const playedNormalized = normalizeMove(played.move);

  // Calcular loss% usando win-probability
  const lossPercent = calculateLossPercent(best, played);

  // Obtener umbrales para este ELO y fase
  const thresholds = getThresholds(elo, phase);

  // Determinar etiqueta base por loss%
  let label = labelFromLoss(lossPercent, thresholds);

  // Sobrescrituras especiales (orden de prioridad)
  const mateIn = best.mate ?? played.mate ?? null;

  // 1. Genial: sacrificio brillante que gana (mate o gran ventaja)
  // Solo si la jugada jugada NO es la mejor pero es "Genial" por criterio táctico
  if (isBrilliantSacrifice(played, best, lossPercent)) {
    label = 'Genial';
  }
  // 2. Libro: jugada de apertura conocida
  else if (isBook(playedMove, lossPercent)) {
    label = 'Libro';
  }
  // 3. Mate entregado: jugada que da mate (mate > 0)
  else if (played.mate != null && played.mate > 0) {
    label = 'Genial';
  }
  // 4. Mate perdido: había mate y no se jugó
  else if (best.mate != null && best.mate > 0 && (played.mate == null || played.mate <= 0)) {
    label = 'Fallo';
  }

  // Preparar multipv top 3 para explicaciones
  const multipv = scored.slice(0, 3).map(normalizeMpvEntry);

  return {
    label,
    lossPercent: Math.round(lossPercent * 10) / 10, // 1 decimal
    move: playedNormalized,
    bestMove,
    bestMoveSan: bestMove.san,
    pv: best.pv ?? [],
    multipv,
    mateIn,
  };
}

/**
 * Normaliza una entrada de multipv para salida.
 */
function normalizeMpvEntry(entry) {
  return {
    move: normalizeMove(entry.move),
    cp: entry.cp ?? null,
    mate: entry.mate ?? null,
    pv: entry.pv ?? [],
  };
}

/**
 * Detecta si es un sacrificio brillante:
 * - La jugada jugada no es la mejor (loss > 0)
 * - Pero la jugada lleva a mate forzado O gana material decisivo
 * - Y no es simplemente "mejor jugada"
 */
function isBrilliantSacrifice(played, best, lossPercent) {
  // Si hay mate en la jugada jugada, ya se maneja aparte
  if (played.mate != null && played.mate > 0) return false;

  // Si loss es muy alto, no es brillante (es error)
  if (lossPercent > 15) return false;

  // Si la jugada jugada captura pieza mayor y no es recapturable inmediatamente
  // O si la jugada cambia drásticamente la evaluación a favor
  // Heurística simple: score de la jugada jugada es muy alto (gana partida)
  if (played.cp != null && played.cp > 300) return true;

  return false;
}

/**
 * Diagnóstico de la causa del error.
 * Usa el multipv del análisis para detectar patrones tácticos.
 *
 * @param {Object} input
 * @param {Object} input.position - Posición ANTES de la jugada (chess.js instance o compatible)
 * @param {Object} input.classification - Resultado de classifyMove()
 * @param {Object} input.playedMove - Jugada jugada (normalizada)
 * @returns {string} Causa detectada o '' si no aplica
 */
export function detectCause({ position, classification, playedMove }) {
  // Solo diagnosticar errores significativos
  if (!classification.bestMove || classification.lossPercent < 10) return '';

  const work = position.fork ? position.fork() : clonePosition(position);
  const bestMove = classification.bestMove;
  const multipv = classification.multipv || [];
  const early = (work.history?.()?.length ?? 0) < 20;

  let reason = '';

  // 1. Mate perdido / entregado
  if (classification.mateIn != null) {
    if (classification.mateIn > 0 && classification.label === 'Fallo') {
      reason = 'Mate perdido';
    } else if (classification.mateIn > 0 && classification.label === 'Genial') {
      reason = 'Mate entregado';
    }
  }

  // 2. Buscar en multipv: pieza colgada, captura perdida, táctica perdida
  if (!reason && multipv.length > 0) {
    const bestMpv = multipv[0];
    const playedMpv = multipv.find(m => sameMove(m.move, playedMove)) || multipv[0];

    // 2a. Pieza colgada: la mejor jugada captura algo que no es recapturable
    reason = detectHangingPiece(work, bestMpv, playedMpv, multipv);
  }

  // 3. Captura perdida: mejor jugada captura y la jugada no
  if (!reason && bestMove.captured && !playedMove.captured && PIECE_VALUE[bestMove.captured] >= 100) {
    reason = 'Captura perdida';
  }

  // 4. Táctica perdida: mejor jugada da jaque/gana material y la jugada no
  if (!reason && bestMove.san?.includes('+') && !playedMove.san?.includes('+')) {
    reason = 'Táctica perdida';
  }

  // 5. Debilidad posicional (fallback)
  if (!reason) {
    reason = early ? 'Apertura floja' : 'Debilidad posicional';
  }

  return reason;
}

/**
 * Detecta pieza colgada analizando el multipv.
 * La mejor jugada captura una pieza; si el oponente no puede recapturar
 * o la recaptura pierde material neto, es "Pieza colgada".
 */
function detectHangingPiece(work, bestMpv, playedMpv, multipv) {
  if (!bestMpv.move.captured || PIECE_VALUE[bestMpv.move.captured] < 100) return '';

  const capturedPiece = bestMpv.move.captured;
  const capturedValue = PIECE_VALUE[capturedPiece];
  const attackerPiece = bestMpv.move.piece;
  const attackerValue = PIECE_VALUE[attackerPiece];

  // Simular la mejor captura
  try {
    work.move(bestMpv.move);
  } catch {
    return '';
  }

  const replies = work.moves?.({ verbose: true }) ?? [];
  let canRecapture = false;
  let netGain = capturedValue - attackerValue;

  for (const reply of replies) {
    if (reply.to === bestMpv.move.to && reply.captured) {
      canRecapture = true;
      const recapturedValue = PIECE_VALUE[reply.captured];
      netGain = capturedValue - recapturedValue;
      break;
    }
  }

  work.undo?.();

  // Si no hay recaptura o la recaptura pierde material neto >= 200 (peón)
  if (!canRecapture || netGain >= 200) {
    return 'Pieza colgada';
  }

  return '';
}

/**
 * Clona una posición simple (fallback si no hay .fork()).
 * Asume interfaz compatible con chess.js: fen(), load(), moves(), move(), undo().
 */
function clonePosition(position) {
  const fen = position.fen?.() ?? position;
  const clone = {
    fen: () => fen,
    load: (f) => f,
    moves: (opts) => position.moves?.(opts) ?? [],
    move: (m) => position.move?.(m),
    undo: () => position.undo?.(),
    history: () => position.history?.() ?? [],
  };
  return clone;
}

/**
 * Exporta utilidades para tests.
 */
export const _internals = {
  sameMove,
  normalizeMove,
  calculateLossPercent,
  winProb,
  mateWinProb,
  getThresholds,
  labelFromLoss,
  isBrilliantSacrifice,
  detectHangingPiece,
};