/**
 * application/game-service.js
 * Casos de uso de la partida: iniciar, mover, responder, deshacer,
 * pista, amenazas, navegación, reloj y finalización.
 *
 * Orquesta dominio (motor, clasificación, métricas) y modelos en memoria.
 * No toca el DOM ni el almacenamiento directamente.
 */

import { Engine } from '../domain/engine.js';
import {
  MISTAKE_LABELS,
  PIECE_ARTICLE,
  PIECE_NAME,
  PIECE_VALUE,
  opposite,
  colorName,
} from '../domain/constants.js';
import { accuracyFromLoss, computeMetrics, phaseOf, clamp } from '../domain/metrics.js';

export class GameService {
  constructor({ chess, analysis, openings, book, model, sound, profile }) {
    this.chess = chess;
    this.analysis = analysis;
    this.openings = openings;
    this.book = book;
    this.model = model;
    this.sound = sound;
    this.profile = profile;
  }

  /* ------------------------------------------------------------------ */
  /* Consultas                                                           */
  /* ------------------------------------------------------------------ */

  get state() {
    return this.model.state;
  }

  viewPosition() {
    if (this.state.viewingPly == null) return this.chess.position;
    return this.chess.positionAt(this.state.viewingPly);
  }

  /** Turno de la partida viva (no de la posición que se está viendo). */
  turn() {
    return this.chess.position.turn();
  }

  /** Número total de medias jugadas de la partida viva. */
  total() {
    return this.chess.position.history().length;
  }

  /** Métricas agregadas del bando del jugador (o de ambos en modo 2). */
  metrics() {
    return computeMetrics(this.state.log, { mode: this.state.mode, me: this.state.me });
  }

  isInteractive() {
    const state = this.state;
    if (state.viewingPly != null) return false;
    if (state.busy || state.ended) return false;
    if (this.chess.position.isGameOver()) return false;
    if (state.mode !== '2' && this.chess.position.turn() !== state.me) return false;
    return true;
  }

  legalTargets(square) {
    if (!square) return [];
    return this.chess.position
      .moves({ square, verbose: true })
      .map(move => move.to);
  }

  openingInfo() {
    return this.openings.info(this.viewPosition());
  }

  openingName() {
    return this.openings.name(this.viewPosition());
  }

  /* ------------------------------------------------------------------ */
  /* Ciclo de vida                                                       */
  /* ------------------------------------------------------------------ */

  startGame({ mode, me, minutes, increment, elo }) {
    this.chess.reset();
    this.model.startGame({ mode, me, minutes, increment, elo });
    return this.state;
  }

  setElo(value) {
    this.model.setElo(value);
  }

  flip() {
    this.model.setView(opposite(this.state.view));
  }

  /* ------------------------------------------------------------------ */
  /* Turno del jugador                                                   */
  /* ------------------------------------------------------------------ */

  /** @returns {{move:object}|{selected:string|null}|null} */
  selectSquare(square) {
    if (!this.isInteractive()) return null;

    const position = this.chess.position;
    const selected = this.state.selection;

    if (selected) {
      const move = position
        .moves({ square: selected, verbose: true })
        .find(candidate => candidate.to === square);

      if (move) {
        this.model.setSelection(null);
        return { move };
      }
    }

    const piece = position.get(square);
    const next = piece && piece.color === position.turn() ? square : null;
    this.model.setSelection(next);
    return { selected: next };
  }

  /** Resuelve un arrastre (from → to) sin depender de la selección previa. */
  findMove(from, to) {
    if (!this.isInteractive()) return null;

    const move = this.chess.position
      .moves({ square: from, verbose: true })
      .find(candidate => candidate.to === to);

    if (!move) return null;

    this.model.setSelection(null);
    return { move };
  }

  /**
   * Analiza y ejecuta la jugada del jugador.
   * @returns {{entry:object, ended:boolean, needsReply:boolean}}
   */
  playPlayerMove(move) {
    const position = this.chess.position;

    this.model.beginAnalysis();

    const classification = this.analysis.classify({
      position,
      move,
      isBook: (candidate, loss) => this.isBookMove(candidate, loss),
    });

    const needsTip = MISTAKE_LABELS.includes(classification.label);
    const cause = needsTip
      ? this.analysis.cause({ position, classification, move })
      : '';

    const color = position.turn();
    const ply = position.history().length;
    const phase = phaseOf(ply, position.board());
    const accuracy = accuracyFromLoss(classification.loss);

    position.move(classification.move);
    const advantage = this.computeAdvantage();

    const entry = {
      san: classification.move.san,
      label: classification.label,
      color,
      ply,
      loss: classification.loss,
      best: needsTip ? classification.best : '',
      bestMove: needsTip ? this.pickBest(classification.bestMove) : null,
      acc: accuracy,
      piece: classification.move.piece,
      phase,
      quiet: !classification.move.captured && !/[+#]/.test(classification.move.san),
      cause,
      from: classification.move.from,
      to: classification.move.to,
      captured: classification.move.captured || null,
    };

    this.model.recordPlayerMove({
      entry,
      advantage,
      color,
      increment: this.state.increment,
    });

    this.model.setResult({
      text: `${entry.san}:`,
      tag: entry.label,
      best: entry.best || null,
      cause: entry.cause || null,
      index: this.state.log.length - 1,
      rival: null,
    });

    this.sound.play(classification.move.captured ? 1 : 0);

    const outcome = this.detectOutcome();
    if (outcome) {
      this.finish(outcome.winner, outcome.text);
      return { entry, ended: true, needsReply: false };
    }

    if (this.state.mode === '2') {
      this.model.setBusy(false);
      this.model.setClockOn(true);
      return { entry, ended: false, needsReply: false };
    }

    this.model.setClockOn(this.state.mode === 't');
    return { entry, ended: false, needsReply: true };
  }

  /** Turno del motor. */
  playEngineMove() {
    if (this.state.ended) {
      this.model.setBusy(false);
      return null;
    }

    const position = this.chess.position;
    const engine = new Engine(position.fork());
    const move = engine.chooseMove(this.state.elo);

    if (!move) {
      this.model.setBusy(false);
      return null;
    }

    const color = position.turn();
    position.move(move);
    const advantage = this.computeAdvantage();

    this.model.recordEngineMove({
      move,
      advantage,
      color,
      increment: this.state.increment,
    });
    this.model.setRivalMove(move.san);
    this.sound.play(move.captured ? 1 : 0);

    const outcome = this.detectOutcome();
    if (outcome) {
      this.finish(outcome.winner, outcome.text);
      return { move, ended: true };
    }

    this.model.setBusy(false);
    this.model.setClockOn(this.state.mode === 't');
    return { move, ended: false };
  }

  /* ------------------------------------------------------------------ */
  /* Acciones auxiliares                                                 */
  /* ------------------------------------------------------------------ */

  undo() {
    const state = this.state;
    if (state.mode !== 'p' || state.busy || state.ended || state.done || !state.log.length) {
      return false;
    }

    const position = this.chess.position;
    let undone = false;

    while (position.history().length && !undone) {
      const move = position.undo();
      this.model.popEvaluation();

      if (move.color === state.me) {
        undone = true;
        this.model.popPlayerMove(state.me);
      }
    }

    this.model.afterUndo();
    return true;
  }

  hint() {
    if (!this.isInteractive()) return false;

    if (!this.state.hint) {
      const move = this.analysis.bestMove(this.chess.position, 3);
      if (!move) return false;

      this.model.setSelection(null);
      this.model.setGhost(null);
      this.model.setHint({ move, stage: 1 });
      this.model.setResult({
        text: 'Pista: mueve la pieza marcada. Pulsa otra vez para ver a dónde.',
        tag: null,
        best: null,
        cause: null,
        index: null,
        rival: null,
      });
      return true;
    }

    this.model.setHint({ move: this.state.hint.move, stage: 2 });
    this.model.setGhost({
      from: this.state.hint.move.from,
      to: this.state.hint.move.to,
      piece: this.state.hint.move.piece,
      index: -1,
    });
    this.model.setResult({
      text: 'Pista: mira la casilla de destino.',
      tag: null,
      best: null,
      cause: null,
      index: null,
      rival: null,
    });
    return true;
  }

  toggleThreats() {
    this.model.setShowThreats(!this.state.showThreats);
    return this.state.showThreats;
  }

  /** Justificación básica de una jugada del registro (texto plano). */
  justify(index) {
    const entry = this.state.log[index];
    if (!entry || !entry.bestMove) return '';

    const best = entry.bestMove;
    const lines = [];
    lines.push(
      `${entry.san} fue ${entry.label.toLowerCase()}: pierdes unos ` +
        `${(entry.loss / 100).toFixed(1)} peones frente a ${best.san}.`,
    );

    if (/#/.test(best.san)) lines.push(`${best.san} daba jaque mate.`);
    else if (/\+/.test(best.san)) lines.push(`${best.san} da jaque y te deja la iniciativa.`);

    if (best.captured) {
      lines.push(
        `${best.san} captura ${PIECE_ARTICLE[best.captured]} ${PIECE_NAME[best.captured]}` +
          `${entry.captured ? '' : ' y tu jugada no lo hacía'}.`,
      );
    }
    if (best.promotion) lines.push(`${best.san} corona un peón.`);
    if (best.flags && (best.flags.includes('k') || best.flags.includes('q'))) {
      lines.push(`${best.san} enroca y pone al rey a salvo.`);
    }

    try {
      const after = this.chess.positionAt(entry.ply + 1);
      const engine = new Engine(after.fork());
      const reply = engine.scoreAll(2).sort((a, b) => b.score - a.score)[0];
      if (reply && reply.move.captured && PIECE_VALUE[reply.move.captured] >= 300) {
        lines.push(
          `Tras ${entry.san}, el rival podía capturar tu ` +
            `${PIECE_NAME[reply.move.captured]} con ${reply.move.san}.`,
        );
      }
    } catch {
      /* posición no reconstruible */
    }

    if (lines.length === 1) {
      lines.push('La diferencia es posicional: la jugada recomendada deja tus piezas mejor colocadas.');
    }

    return lines.join('\n');
  }

  threats() {
    const state = this.state;
    const position = this.viewPosition();
    const side = state.mode === '2' ? position.turn() : state.me;

    return this.analysis.threats({
      position,
      side,
      opponent: opposite(side),
    });
  }

  navigate(direction) {
    const total = this.chess.position.history().length;
    const current = this.state.viewingPly == null ? total : this.state.viewingPly;

    const target = direction === 's'
      ? 0
      : direction === 'e'
        ? total
        : clamp(current + (direction === 'b' ? -1 : 1), 0, total);

    this.model.setViewingPly(target === total ? null : target);
    this.model.setGhost(null);
    this.model.setSelection(null);
  }

  goToPly(ply) {
    const total = this.chess.position.history().length;
    this.model.setViewingPly(ply >= total ? null : ply);
    this.model.setGhost(null);
  }

  resign() {
    if (this.state.done) return;

    const state = this.state;
    const loser = state.mode === '2' ? this.chess.position.turn() : state.me;
    const text =
      (state.mode === '2' ? `${colorName(loser)} se rinde` : 'Te rendiste') +
      `. Ganan ${colorName(opposite(loser)).toLowerCase()}`;

    this.model.setBusy(true);
    this.finish(opposite(loser), text);
  }

  /** Avanza los relojes. Devuelve el color que se quedó sin tiempo. */
  tick(dt) {
    const state = this.state;
    if (!state.clockOn || state.ended || this.chess.position.isGameOver()) return null;

    const color = this.chess.position.turn();
    const expired = this.model.tick(dt, color);

    if (expired) {
      this.model.setBusy(true);
      this.finish(
        opposite(color),
        `Tiempo agotado. Ganan ${colorName(opposite(color)).toLowerCase()}`,
      );
      return color;
    }

    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Internos                                                            */
  /* ------------------------------------------------------------------ */

  computeAdvantage() {
    const score = this.analysis.evaluateDepth(this.chess.position, 2);
    const whiteScore = this.chess.position.turn() === 'w' ? score : -score;
    return clamp(whiteScore / 100, -10, 10);
  }

  detectOutcome() {
    const position = this.chess.position;

    if (position.inCheckmate()) {
      const winner = opposite(position.turn());
      return {
        winner,
        text: `Jaque mate. Ganan ${winner === 'w' ? 'blancas' : 'negras'}`,
      };
    }

    if (position.isGameOver()) {
      return { winner: null, text: 'Tablas' };
    }

    return null;
  }

  finish(winner, text) {
    if (this.state.done) return;

    this.model.finish({ text });
    this.sound.play(2);

    const state = this.state;
    const mine = state.log.filter(
      entry => state.mode === '2' || entry.color === state.me,
    );

    if (state.mode !== '2' && mine.length >= 4) {
      this.profile.recordGame({
        result: winner == null ? 'D' : winner === state.me ? 'W' : 'L',
        mode: state.mode,
        elo: state.elo,
        log: state.log,
        me: state.me,
        clocks: state.clocks,
        clockInitial: state.clockInitial,
        openingName: this.openingName(),
      });
    }
  }

  isBookMove(move, loss) {
    const historyLength = this.chess.position.history().length;

    if (!this.book.size) {
      return historyLength < 12 && loss <= 25;
    }

    return loss <= 60 && this.isInBook(move);
  }

  isInBook(move) {
    const position = this.chess.position;
    position.move(move);
    const key = this.book.key(position.fen());
    position.undo();
    return this.book.has(key);
  }

  pickBest(bestMove) {
    if (!bestMove) return null;
    return {
      from: bestMove.from,
      to: bestMove.to,
      piece: bestMove.piece,
      san: bestMove.san,
      captured: bestMove.captured || null,
      promotion: bestMove.promotion || null,
      flags: bestMove.flags ? [...bestMove.flags] : [],
    };
  }
}
