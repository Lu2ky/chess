/**
 * view/game-view.js
 * Vista del panel de juego: relojes, capturas, ventaja, apertura,
 * navegación, resultado, lista de jugadas y explicación.
 * Solo escribe en el DOM y emite eventos al controlador.
 */

import { PIECE_GLYPH } from '../domain/constants.js';

const escape = text =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export class GameView {
  constructor() {
    this.elements = {
      eloRow: document.getElementById('rE'),
      clockRow: document.getElementById('rT'),
      eloValue: document.getElementById('ev'),
      elo: document.getElementById('elo'),
      color: document.getElementById('col'),
      mode: document.getElementById('mode'),
      whiteMinutes: document.getElementById('tw'),
      blackMinutes: document.getElementById('tb'),
      increment: document.getElementById('inc'),

      topClock: document.getElementById('tk'),
      bottomClock: document.getElementById('bk'),
      topCapture: document.getElementById('tc'),
      bottomCapture: document.getElementById('bc'),
      bar: document.getElementById('bar'),
      points: document.getElementById('pts'),
      opening: document.getElementById('op'),

      nav: document.getElementById('nv'),
      navLabel: document.getElementById('pl'),
      explanation: document.getElementById('ex'),
      result: document.getElementById('res'),
      report: document.getElementById('rb'),
      resign: document.getElementById('rs'),
      hint: document.getElementById('hi'),
      undo: document.getElementById('ud'),
      threats: document.getElementById('th'),
      list: document.getElementById('lst'),

      newGame: document.getElementById('nw'),
      flip: document.getElementById('fp'),
    };

    this.callbacks = {};
    this.analysisEnabled = false;
    this.bind();
  }

  on(name, callback) {
    this.callbacks[name] = callback;
  }

  emit(name, ...args) {
    if (this.callbacks[name]) this.callbacks[name](...args);
  }

  bind() {
    const { elements } = this;

    elements.newGame.addEventListener('click', () => this.emit('newGame'));
    elements.mode.addEventListener('change', () => this.emit('newGame'));
    elements.color.addEventListener('change', () => this.emit('newGame'));
    elements.flip.addEventListener('click', () => this.emit('flip'));
    elements.undo.addEventListener('click', () => this.emit('undo'));
    elements.hint.addEventListener('click', () => this.emit('hint'));
    elements.threats.addEventListener('click', () => this.emit('threats'));
    elements.resign.addEventListener('click', () => this.emit('resign'));
    elements.report.addEventListener('click', () => this.emit('report'));

    elements.elo.addEventListener('input', () => {
      elements.eloValue.textContent = elements.elo.value;
      this.emit('elo', Number(elements.elo.value));
    });

    elements.nav.addEventListener('click', event => {
      const button = event.target.closest('[data-n]');
      if (button) this.emit('navigate', button.dataset.n);
    });

    elements.list.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (button) this.emit('moveAction', button.dataset.action, Number(button.dataset.index));
    });

    elements.result.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (button) this.emit('moveAction', button.dataset.action, Number(button.dataset.index));
    });
  }

  applyDefaults(config) {
    const { elements } = this;

    elements.elo.value = config.d_elo;
    elements.eloValue.textContent = config.d_elo;
    elements.color.value = config.d_col;
    elements.mode.value = config.d_mode;
    elements.whiteMinutes.value = config.d_tm;
    elements.blackMinutes.value = config.d_tm;
    elements.increment.value = config.d_inc;
  }

  readNewGameOptions() {
    const { elements } = this;
    const mode = elements.mode.value;

    return {
      mode,
      me: mode === '2' ? 'w' : elements.color.value,
      minutes: {
        w: Number(elements.whiteMinutes.value) || 5,
        b: Number(elements.blackMinutes.value) || 5,
      },
      increment: Number(elements.increment.value) || 0,
      elo: Number(elements.elo.value) || 1200,
    };
  }

  render(vm, opening) {
    const { elements } = this;

    elements.eloRow.style.display = vm.visibility.elo ? 'flex' : 'none';
    elements.clockRow.style.display = vm.visibility.clock ? 'flex' : 'none';
    elements.flip.style.display = vm.visibility.flip ? '' : 'none';
    elements.undo.style.display = vm.visibility.undo ? '' : 'none';

    this.renderClocks(vm.clocks);
    this.renderCapture(elements.topCapture, vm.captured.top);
    this.renderCapture(elements.bottomCapture, vm.captured.bottom);

    elements.bar.firstChild.style.width = `${vm.advantage.percent}%`;
    elements.points.innerHTML = escape(vm.advantage.text);

    if (opening && opening.visible) {
      elements.opening.style.display = '';
      elements.opening.innerHTML =
        `📖 <b>${escape(opening.name)}</b> · ${escape(opening.eco)}` +
        `<br><small>${escape(opening.detail)}</small>`;
    } else {
      elements.opening.style.display = 'none';
      elements.opening.innerHTML = '';
    }

    elements.navLabel.textContent = vm.nav.label;
    elements.report.style.display = vm.reportVisible ? '' : 'none';
    elements.threats.classList.toggle('on', vm.showThreats);

    this.renderResult(vm.result);
    this.renderExplanation(vm.explanation);
    this.renderList(vm.moves);
  }

  renderClocks(clocks) {
    const { elements } = this;
    elements.topClock.textContent = clocks.top;
    elements.bottomClock.textContent = clocks.bottom;
    elements.topClock.style.opacity = clocks.topActive ? '1' : '.5';
    elements.bottomClock.style.opacity = clocks.bottomActive ? '1' : '.5';
  }

  renderCapture(element, capture) {
    const glyphs = capture.pieces.map(piece => PIECE_GLYPH[piece]).join('');
    const chip = capture.pieces.length
      ? `<span class="chip ${capture.pieceColor}">${glyphs}</span>`
      : '—';
    const diff = capture.diff > 0 ? `+${capture.diff}` : '';

    element.innerHTML = `<small>${escape(capture.label)}</small> ${chip} <b>${diff}</b>`;
  }

  renderResult(result) {
    const element = this.elements.result;

    if (!result) {
      element.textContent = '';
      return;
    }

    const tag = result.tag
      ? ` <span class="tag ${escape(result.tag)}">${escape(result.tag)}</span>`
      : '';

    const best = result.best
      ? ` · mejor: ${escape(result.best)}${result.cause ? ` · ${escape(result.cause)}` : ''}`
      : '';

    const rival = result.rival ? ` · Rival: ${escape(result.rival)}` : '';
    const buttons = result.best && result.index != null ? this.buttons(result.index) : '';

    element.innerHTML = `${escape(result.text)}${tag}${best}${rival}${buttons}`;
  }

  renderExplanation(text) {
    const element = this.elements.explanation;

    if (!text) {
      element.style.display = 'none';
      element.innerHTML = '';
      return;
    }

    element.style.display = '';
    element.innerHTML =
      '<b>Justificación</b> <small>(básica, se mejorará)</small><br>' +
      escape(text).replace(/\n/g, '<br>');
  }

  renderList(moves) {
    const element = this.elements.list;

    if (!moves.length) {
      element.innerHTML = 'Aún no hay jugadas';
      return;
    }

    element.innerHTML = moves.map(move => {
      const tag = ` <span class="tag ${escape(move.label)}">${escape(move.label)}</span>`;
      const best = move.best
        ? ` <small>mejor: ${escape(move.best)}${move.cause ? ` · ${escape(move.cause)}` : ''}</small>`
        : '';
      const buttons = move.hasBest ? this.buttons(move.index, move.ghostVisible) : '';

      return `<div>${escape(move.number)} ${escape(move.san)}${tag}${best}${buttons}</div>`;
    }).join('');

    element.scrollTop = 1e5;
  }

  buttons(index, ghostVisible = false) {
    const disabled = !this.analysisEnabled ? 'disabled' : '';
    return (
      `<button class="mini" data-action="show" data-index="${index}">` +
      `${ghostVisible ? 'Ocultar' : 'Mostrar'}</button>` +
      `<button class="mini" data-action="why" data-index="${index}">Justificar</button>` +
      `<button class="mini" data-action="lord" data-index="${index}" ${disabled}>Lord</button>` +
      `<button class="mini" data-action="go" data-index="${index}">Ir</button>`
    );
  }

  setAnalysisButtonsEnabled(enabled) {
    this.analysisEnabled = enabled;
    const { elements } = this;
    elements.hint.disabled = !enabled;
    elements.threats.disabled = !enabled;
    const lordButtons = elements.list.querySelectorAll('[data-action="lord"]');
    lordButtons.forEach(btn => { btn.disabled = !enabled; });
  }
}
