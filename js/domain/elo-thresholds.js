/**
 * domain/elo-thresholds.js
 * Umbrales de pérdida porcentual (loss%) para clasificar jugadas según ELO y fase.
 * Interpola linealmente entre tramos de ELO conocidos.
 */

import { ELO_TIERS } from './constants.js';

/**
 * Umbrales máximos de loss% para cada etiqueta.
 * Estructura: ELO_TIER -> phase -> label -> maxLoss%
 * Labels: Ex = Excelente, Go = Bueno, In = Inexactitud, Er = Error
 * (Fallo no tiene umbral: es lo que queda por encima de Error)
 */
export const ELO_THRESHOLDS = {
  800: {
    o: { Ex: 5, Go: 10, In: 20, Er: 35 },
    m: { Ex: 4, Go: 8, In: 18, Er: 30 },
    e: { Ex: 3, Go: 6, In: 15, Er: 25 },
  },
  1200: {
    o: { Ex: 4, Go: 8, In: 15, Er: 30 },
    m: { Ex: 3, Go: 6, In: 12, Er: 25 },
    e: { Ex: 2, Go: 5, In: 10, Er: 20 },
  },
  1600: {
    o: { Ex: 3, Go: 6, In: 12, Er: 25 },
    m: { Ex: 2, Go: 5, In: 10, Er: 20 },
    e: { Ex: 2, Go: 4, In: 8, Er: 15 },
  },
  2000: {
    o: { Ex: 2, Go: 5, In: 10, Er: 20 },
    m: { Ex: 2, Go: 4, In: 8, Er: 15 },
    e: { Ex: 1, Go: 3, In: 6, Er: 12 },
  },
  2400: {
    o: { Ex: 1, Go: 3, In: 8, Er: 15 },
    m: { Ex: 1, Go: 3, In: 6, Er: 12 },
    e: { Ex: 1, Go: 2, In: 5, Er: 10 },
  },
};

/**
 * Interpola los umbrales para un ELO y fase dados.
 * @param {number} elo - ELO del jugador (p.ej. 1500)
 * @param {string} phase - Fase: 'o' (apertura), 'm' (medio juego), 'e' (final)
 * @returns {Object} Umbrales { Ex, Go, In, Er } con loss% máximos
 */
export function getThresholds(elo, phase = 'm') {
  // Acepta tanto a/m/f (fases de métricas) como o/m/e (fases de umbrales).
  const alias = phase === 'a' ? 'o' : phase === 'f' ? 'e' : phase;
  const safePhase = alias === 'o' || alias === 'm' || alias === 'e' ? alias : 'm';

  // Clampear ELO al rango conocido
  const clampedElo = Math.max(ELO_TIERS[0], Math.min(ELO_TIERS[ELO_TIERS.length - 1], elo));

  // Si está exactamente en un tramo conocido, devolver directamente
  if (ELO_TIERS.includes(clampedElo)) {
    return { ...ELO_THRESHOLDS[clampedElo][safePhase] };
  }

  // Encontrar los dos tramos que rodean al ELO clampeado
  let lowerTier = ELO_TIERS[0];
  let upperTier = ELO_TIERS[ELO_TIERS.length - 1];

  for (let i = 0; i < ELO_TIERS.length - 1; i++) {
    if (clampedElo >= ELO_TIERS[i] && clampedElo <= ELO_TIERS[i + 1]) {
      lowerTier = ELO_TIERS[i];
      upperTier = ELO_TIERS[i + 1];
      break;
    }
  }

  // Interpolar linealmente
  const t = (clampedElo - lowerTier) / (upperTier - lowerTier);
  const lower = ELO_THRESHOLDS[lowerTier][safePhase];
  const upper = ELO_THRESHOLDS[upperTier][safePhase];

  return {
    Ex: lerp(lower.Ex, upper.Ex, t),
    Go: lerp(lower.Go, upper.Go, t),
    In: lerp(lower.In, upper.In, t),
    Er: lerp(lower.Er, upper.Er, t),
  };
}

/**
 * Interpolación lineal.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Determina la etiqueta a partir del loss% y los umbrales.
 * @param {number} lossPercent - Pérdida de win-prob en porcentaje (0-100)
 * @param {Object} thresholds - Umbrales { Ex, Go, In, Er }
 * @returns {string} Etiqueta: 'Excelente' | 'Bueno' | 'Inexactitud' | 'Error' | 'Fallo'
 */
export function labelFromLoss(lossPercent, thresholds) {
  if (lossPercent <= thresholds.Ex) return 'Excelente';
  if (lossPercent <= thresholds.Go) return 'Bueno';
  if (lossPercent <= thresholds.In) return 'Inexactitud';
  if (lossPercent <= thresholds.Er) return 'Error';
  return 'Fallo';
}

/**
 * Convierte centipawns a win-probability (0-1) usando sigmoide estándar.
 * @param {number} cp - Evaluación en centipawns (perspectiva del jugador que mueve)
 * @returns {number} Win probability 0-1
 */
export function winProb(cp) {
  return 1 / (1 + Math.exp(-cp / 400));
}

/**
 * Win-probability para mate.
 * @param {number} mateIn - Mate en N (positivo = mate para el que mueve, negativo = mate en contra)
 * @returns {number} 1 si mate a favor, 0 si mate en contra
 */
export function mateWinProb(mateIn) {
  return mateIn > 0 ? 1 : 0;
}

/**
 * Calcula loss% entre la mejor jugada y la jugada jugada.
 * @param {Object} best - Mejor jugada del multipv (con cp o mate)
 * @param {Object} played - Jugada realmente jugada (con cp o mate)
 * @returns {number} Loss percentage 0-100
 */
export function calculateLossPercent(best, played) {
  // Caso especial: hay mate forzado y no se juega → loss 100%
  if (best.mate != null && best.mate > 0 && (played.mate == null || played.mate <= 0)) {
    return 100;
  }

  let bestWp, playedWp;

  if (best.mate != null) {
    bestWp = mateWinProb(best.mate);
  } else {
    bestWp = winProb(best.cp ?? 0);
  }

  if (played.mate != null) {
    playedWp = mateWinProb(played.mate);
  } else {
    playedWp = winProb(played.cp ?? 0);
  }

  const loss = (bestWp - playedWp) * 100;
  return Math.max(0, Math.min(100, loss)); // Clampear 0-100
}