/**
 * model/lord-model.js
 * Modelo del chat de Lord: conversación, jugada seleccionada y estado
 * del holograma de futuros. Solo memoria.
 */

export class LordModel {
  constructor() {
    this.listeners = new Set();
    this.reset();
  }

  reset() {
    this.state = {
      chat: [],
      selectedMove: null,
      futures: [],
      futureIndex: 0,
      plyIndex: 0,
      warnings: 0,
      playing: false,
      busy: false,
      error: null,
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of [...this.listeners]) listener(this.state);
  }

  startSession(selectedMove) {
    this.reset();
    this.state.selectedMove = selectedMove;
    this.emit();
  }

  setBusy(value) {
    this.state.busy = value;
    this.emit();
  }

  addMessage(role, content) {
    this.state.chat.push({ role, content });
    this.emit();
  }

  popMessage() {
    this.state.chat.pop();
    this.emit();
  }

  replaceLastMessage(content) {
    const last = this.state.chat[this.state.chat.length - 1];
    if (last) last.content = content;
    this.emit();
  }

  setError(text) {
    this.state.error = text;
    this.emit();
  }

  setFutures(futures, warnings) {
    this.state.futures = futures;
    this.state.warnings = warnings;
    this.state.futureIndex = 0;
    this.state.plyIndex = 0;
    this.state.playing = false;
    this.emit();
  }

  selectFuture(index) {
    this.state.futureIndex = index;
    this.state.plyIndex = 0;
    this.state.playing = false;
    this.emit();
  }

  setPlyIndex(index) {
    this.state.plyIndex = index;
    this.emit();
  }

  setPlaying(value) {
    this.state.playing = value;
    this.emit();
  }

  selectMove(index) {
    this.state.selectedMove = index;
    this.emit();
  }
}
