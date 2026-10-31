/**
 * domain/classification.js
 * Reglas de negocio para clasificar jugadas y diagnosticar la causa de
 * un error. Funciones puras: reciben datos, no tocan el DOM ni el storage.
 */

import { PIECE_VALUE } from './constants.js';

export const clampScore = value => Math.max(-800, Math.min(800, value));

const sameMove = (a, b) =>
  a.from === b.from && a.to === b.to && a.promotion === b.promotion;

/**
 * @param {object}   input
 * @param {{move:object, score:number}[]} input.scored  Jugadas puntuadas.
 * @param {object}   input.move      Jugada realmente ejecutada.
 * @param {Function} input.isBook    (move, loss) => boolean
 * @param {Function} input.isHanging (move) => boolean
 */
export function classifyMove({ scored, move, isBook, isHanging }) {
  const best = Math.max(...scored.map(entry => entry.score));
  const played = scored.find(entry => sameMove(entry.move, move));

  if (!played) {
    return { label: 'Bueno', loss: 0, move, best: null, bestMove: null };
  }

  const loss = clampScore(best) - clampScore(played.score);
  const candidate = played.move;

  const majorPiece = ['n', 'b', 'r', 'q'].includes(candidate.piece);
  const netGain =
    PIECE_VALUE[candidate.piece] - (candidate.captured ? PIECE_VALUE[candidate.captured] : 0);

  if (loss <= 15 && played.score > -150 && majorPiece && netGain >= 200 && isHanging(candidate)) {
    return { label: 'Genial', loss, move: candidate, best: null, bestMove: null };
  }

  if (isBook(candidate, loss)) {
    return { label: 'Libro', loss, move: candidate, best: null, bestMove: null };
  }

  const label =
    loss <= 10 ? 'Excelente'
      : loss <= 40 ? 'Bueno'
        : loss <= 100 ? 'Inexactitud'
          : loss <= 250 ? 'Error'
            : 'Fallo';

  const bestMove = scored.find(entry => entry.score === best).move;
  return { label, loss, move: candidate, best: bestMove.san, bestMove };
}

/**
 * Diagnóstico de la causa del error.
 * `position` debe ser una bifurcación situada ANTES de la jugada.
 */
export function detectCause({ position, classification, playedMove }) {
  if (!classification.bestMove || classification.loss < 40) return '';

  const work = position.fork();
  const best = classification.bestMove;
  const early = work.history().length < 20;
  let reason = '';

  if (/#/.test(best.san)) {
    reason = 'Mate perdido';
  } else {
    work.move(playedMove);
    const replies = work.moves({ verbose: true });

    if (replies.some(option => /#/.test(option.san))) {
      reason = 'Mate en contra';
    } else {
      for (const option of replies) {
        if (!option.captured || PIECE_VALUE[option.captured] < 300) continue;

        work.move(option);
        const recapture = work
          .moves({ verbose: true })
          .some(reply => reply.to === option.to && reply.captured);
        work.undo();

        if (!recapture || PIECE_VALUE[option.captured] - PIECE_VALUE[option.piece] >= 200) {
          reason = 'Pieza colgada';
          break;
        }
      }
    }

    work.undo();
  }

  if (!reason && best.captured && !playedMove.captured && PIECE_VALUE[best.captured] >= 100) {
    reason = 'Captura perdida';
  }
  if (!reason && /\+/.test(best.san) && !/\+/.test(playedMove.san)) {
    reason = 'Táctica perdida';
  }

  return reason || (early ? 'Apertura floja' : 'Plan posicional');
}
