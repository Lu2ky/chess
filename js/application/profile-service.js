/**
 * application/profile-service.js
 * Caso de uso: registrar una partida terminada en el perfil.
 */

import { clamp, computeMetrics, labelCounts, pieceAccuracy, ratingFromAccuracy } from '../domain/metrics.js';

export class ProfileService {
  constructor({ model }) {
    this.model = model;
  }

  recordGame({ result, mode, elo, log, me, clocks, clockInitial, openingName }) {
    // Compute metrics using analysis cache when available (backwards compatible)
    const metrics = computeMetrics(log, { mode, me });

    const timeScore = mode === 'p'
      ? null
      : clamp((clocks[me] / clockInitial[me]) * 150, 0, 100);

    const counts = labelCounts(log, { mode, me });
    const pieces = pieceAccuracy(log, { mode, me });

    const causes = {};
    for (const entry of metrics.mine) {
      if (!entry.cause) continue;
      causes[entry.cause] = (causes[entry.cause] || 0) + 1;
    }

    const entry = {
      cc: causes,
      d: Date.now(),
      res: result,
      mode,
      elo,
      acc: metrics.acc,
      rating: ratingFromAccuracy(metrics.acc),
      sk: {
        ap: ratingFromAccuracy(metrics.ap),
        ta: ratingFromAccuracy(metrics.ta),
        es: ratingFromAccuracy(metrics.es),
        fi: ratingFromAccuracy(metrics.fi),
        ti: ratingFromAccuracy(timeScore),
      },
      lb: counts,
      pc: pieces,
      on: openingName,
      op: metrics.mine.slice(0, 3).map(item => item.san).join(' '),
      opAcc: metrics.ap,
    };

    this.model.add(entry);
    return entry;
  }
}
