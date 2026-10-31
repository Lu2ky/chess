/**
 * model/game-model.js
 * Modelo de la partida: ÚNICA fuente de verdad en memoria.
 * Muta su estado y notifica a los suscriptores. No conoce el DOM,
 * chess.js ni localStorage.
 */

import { LABEL_WEIGHT } from '../domain/constants.js';
import { emptyStats } from '../domain/metrics.js';

const emptyResult = () => ({
  text: 'Tu turno',
  tag: null,
  best: null,
  cause: null,
  index: null,
  rival: null,
});

const initialState = () => ({
  gameId: 0,
  mode: 'p',
  me: 'w',
  view: 'w',
  elo: 1200,
  minutes: { w: 5, b: 5 },
  increment: 0,
  busy: false,
  ended: false,
  done: false,
  clockOn: false,
  selection: null,
  lastMove: [],
  log: [],
  evalHistory: [0],
  advantage: 0,
  clocks: { w: 300, b: 300 },
  clockInitial: { w: 300, b: 300 },
  result: emptyResult(),
  hint: null,
  ghost: null,
  showThreats: false,
  viewingPly: null,
  stats: { w: emptyStats(), b: emptyStats() },
  showReport: false,
  explanation: '',
});

export class GameModel {
  constructor() {
    this.state = initialState();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of [...this.listeners]) listener(this.state);
  }

  /* --------------------------- ciclo de vida --------------------------- */

  startGame({ mode, me, minutes, increment, elo }) {
    this.state = {
      ...initialState(),
      gameId: this.state.gameId + 1,
      mode,
      me,
      view: me,
      elo,
      increment,
      minutes: { w: minutes.w, b: minutes.b },
      clocks: { w: minutes.w * 60, b: minutes.b * 60 },
      clockInitial: { w: minutes.w * 60, b: minutes.b * 60 },
      clockOn: mode !== 'p',
      result: {
        ...emptyResult(),
        text: mode === '2' ? 'Turno de blancas' : 'Tu turno',
      },
    };
    this.emit();
  }

  /* ------------------------------ setters ------------------------------ */

  setBusy(value) {
    this.state.busy = value;
    this.emit();
  }

  setClockOn(value) {
    this.state.clockOn = value;
    this.emit();
  }

  setSelection(square) {
    this.state.selection = square;
    this.emit();
  }

  setView(color) {
    this.state.view = color;
    this.emit();
  }

  /** Cambia la orientación sin notificar (estado derivado de la config). */
  syncView(color) {
    this.state.view = color;
  }

  setElo(value) {
    this.state.elo = value;
    this.emit();
  }

  setExplanation(text) {
    this.state.explanation = text;
    this.emit();
  }

  setViewingPly(ply) {
    this.state.viewingPly = ply;
    this.emit();
  }

  setShowThreats(value) {
    this.state.showThreats = value;
    this.emit();
  }

  setHint(hint) {
    this.state.hint = hint;
    this.emit();
  }

  setGhost(ghost) {
    this.state.ghost = ghost;
    this.emit();
  }

  setResult(result) {
    this.state.result = result;
    this.emit();
  }

  setRivalMove(san) {
    this.state.result = { ...this.state.result, rival: san };
    this.emit();
  }

  beginAnalysis() {
    this.state.busy = true;
    this.state.clockOn = false;
    this.state.result = { ...emptyResult(), text: 'Analizando…' };
    this.emit();
  }

  /* ------------------------------ jugadas ------------------------------ */

  recordPlayerMove({ entry, advantage, color, increment }) {
    const state = this.state;

    // Ensure entry has analysis object (for cached Stockfish results or legacy fallback)
    const enrichedEntry = {
      ...entry,
      analysis: entry.analysis || null,
    };

    state.log.push(enrichedEntry);
    state.evalHistory.push(advantage);
    state.advantage = advantage;
    state.lastMove = [entry.from, entry.to];

    const stats = state.stats[color];
    stats[entry.label] += 1;
    stats.pts += LABEL_WEIGHT[entry.label];
    stats.acc.push(entry.acc);

    if (state.mode !== 'p') state.clocks[color] += increment;

    this.emit();
  }

  recordEngineMove({ move, advantage, color, increment }) {
    const state = this.state;

    state.evalHistory.push(advantage);
    state.advantage = advantage;
    state.lastMove = [move.from, move.to];

    if (state.mode === 't') state.clocks[color] += increment;

    this.emit();
  }

  popEvaluation() {
    const state = this.state;
    state.evalHistory.pop();
    state.advantage = state.evalHistory[state.evalHistory.length - 1] ?? 0;
  }

  popPlayerMove(color) {
    const state = this.state;
    const entry = state.log.pop();
    if (!entry) return;

    const stats = state.stats[color];
    stats[entry.label] -= 1;
    stats.pts -= LABEL_WEIGHT[entry.label];
    stats.acc.pop();
  }

  afterUndo() {
    const state = this.state;
    state.lastMove = [];
    state.ghost = null;
    state.hint = null;
    state.selection = null;
    state.viewingPly = null;
    state.result = { ...emptyResult(), text: 'Tu turno' };
    this.emit();
  }

  /* ------------------------------- reloj ------------------------------- */

  /** Muta sin emitir: la vista del reloj se refresca aparte. */
  tick(dt, color) {
    const state = this.state;
    if (!state.clockOn || state.ended) return false;

    state.clocks[color] -= dt;

    if (state.clocks[color] <= 0) {
      state.clocks[color] = 0;
      return true;
    }

    return false;
  }

  /* ------------------------------ final -------------------------------- */

  finish({ text }) {
    const state = this.state;
    if (state.done) return false;

    state.done = true;
    state.ended = true;
    state.clockOn = false;
    state.busy = false;
    state.result = { ...emptyResult(), text };
    state.showReport = true;
    this.emit();
    return true;
  }
}
