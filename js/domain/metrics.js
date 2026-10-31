/**
 * domain/metrics.js
 * Fórmulas de precisión, puntuación estimada, fases y agregación de
 * estadísticas. Puras y testeables.
 */

import { PIECE_VALUE, LABELS, LABEL_WEIGHT, SKILL_KEYS } from './constants.js';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const accuracyFromLoss = loss => 100 * Math.exp(-0.004 * loss);

export const ratingFromAccuracy = accuracy =>
  accuracy == null ? null : Math.round(200 + Math.pow(accuracy / 100, 3) * 2800);

export const average = values =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function emptyStats() {
  const stats = { pts: 0, acc: [] };
  for (const label of LABELS) stats[label] = 0;
  return stats;
}

/** Fase de la partida: apertura (<20 ply), final (poco material) o medio. */
export function phaseOf(ply, board) {
  if (ply < 20) return 'a';

  let material = 0;
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.type !== 'p' && piece.type !== 'k') {
        material += PIECE_VALUE[piece.type];
      }
    }
  }

  return material <= 2600 ? 'f' : 'm';
}

/**
 * Métricas agregadas de una partida para el bando indicado.
 * @param {Array}  log   Registro de jugadas analizadas.
 * @param {{mode:string, me:string}} context
 */
export function computeMetrics(log, { mode, me }) {
  const mine = log.filter(entry => mode === '2' || entry.color === me);
  const avg = values => average(values);
  const phaseAvg = phase => avg(mine.filter(entry => entry.phase === phase).map(entry => entry.acc));
  const count = label => mine.filter(entry => entry.label === label).length;
  const n = mine.length;

  const quietMid = avg(
    mine.filter(entry => entry.phase === 'm' && entry.quiet).map(entry => entry.acc),
  );

  const tactics = n
    ? clamp(
      100 * (1 - (count('Inexactitud') * 0.3 + count('Error') * 0.7 + count('Fallo')) / n) +
        10 * count('Genial'),
      0,
      100,
    )
    : null;

  return {
    n,
    mine,
    count,
    acc: avg(mine.map(entry => entry.acc)),
    ap: phaseAvg('a'),
    mi: phaseAvg('m'),
    fi: phaseAvg('f'),
    ta: tactics,
    es: quietMid != null ? quietMid : phaseAvg('m'),
  };
}

/** Suma de pesos por etiqueta para una partida. */
export function labelCounts(log, { mode, me }) {
  const mine = log.filter(entry => mode === '2' || entry.color === me);
  const counts = {};
  for (const label of LABELS) {
    counts[label] = mine.filter(entry => entry.label === label).length;
  }
  return counts;
}

/** Precisión media por tipo de pieza. */
export function pieceAccuracy(log, { mode, me }) {
  const mine = log.filter(entry => mode === '2' || entry.color === me);
  const result = {};

  for (const entry of mine) {
    if (!entry.piece) continue;
    const bucket = result[entry.piece] || (result[entry.piece] = [0, 0]);
    bucket[0] += entry.acc;
    bucket[1] += 1;
  }

  return result;
}

/** Media móvil exponencial de las habilidades entre partidas. */
export function emaSkillRatings(games) {
  const output = {};

  for (const game of games) {
    if (!game.sk) continue;
    for (const key of SKILL_KEYS) {
      const value = game.sk[key];
      if (value == null) continue;
      output[key] = output[key] == null ? value : output[key] * 0.7 + value * 0.3;
    }
  }

  return output;
}

export const totalWeight = counts =>
  LABELS.reduce((sum, label) => sum + (counts[label] || 0) * LABEL_WEIGHT[label], 0);
