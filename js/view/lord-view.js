/**
 * view/lord-view.js
 * Vista del entrenador Lord: selector de jugada, chat, preguntas rápidas
 * y tablero holográfico de futuros alternativos.
 */

import { FUTURE_COLORS, PIECE_GLYPH } from '../domain/constants.js';

const escape = text =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export class LordView {
  constructor() {
    this.select = document.getElementById('lsel');
    this.messages = document.getElementById('lm');
    this.questions = document.getElementById('lch');
    this.input = document.getElementById('li');
    this.send = document.getElementById('ls');
    this.futureButtons = document.getElementById('hfc');
    this.board = document.getElementById('hb');
    this.nav = document.getElementById('hct');
    this.legend = document.getElementById('hl');

    this.callbacks = {};
    this.bind();
  }

  on(name, callback) {
    this.callbacks[name] = callback;
  }

  emit(name, ...args) {
    if (this.callbacks[name]) this.callbacks[name](...args);
  }

  bind() {
    this.send.addEventListener('click', () => this.emit('send', this.input.value));

    this.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.emit('send', this.input.value);
      }
    });

    this.select.addEventListener('change', () => {
      const value = this.select.value;
      this.emit('selectMove', value === '' ? null : Number(value));
    });

    this.questions.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button) this.emit('send', button.textContent);
    });

    this.futureButtons.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button) this.emit('future', Number(button.dataset.index));
    });

    this.nav.addEventListener('click', event => {
      const button = event.target.closest('[data-h]');
      if (button) this.emit('futureNav', button.dataset.h);
    });
  }

  render(vm) {
    this.renderSelect(vm);
    this.renderChat(vm);
    this.renderQuestions(vm);
    this.renderFutures(vm);
    this.renderHologram(vm);
  }

  renderSelect(vm) {
    this.select.innerHTML =
      '<option value="">Partida completa</option>' +
      vm.options
        .map(option => `<option value="${option.index}">${escape(option.label)}</option>`)
        .join('');

    this.select.value = vm.selectedIndex == null ? '' : String(vm.selectedIndex);
  }

  renderChat(vm) {
    this.messages.innerHTML = '';

    for (const message of vm.chat) {
      const bubble = document.createElement('div');
      bubble.className = `bu ${message.role === 'user' ? 'u' : 'a'}`;
      bubble.textContent = message.role === 'assistant'
        ? message.content.split('<<FUTUROS>>')[0].trim()
        : message.content;
      this.messages.appendChild(bubble);
    }

    if (vm.error) {
      const bubble = document.createElement('div');
      bubble.className = 'bu a';
      bubble.textContent = vm.error;
      this.messages.appendChild(bubble);
    }

    this.messages.scrollTop = 1e5;
  }

  renderQuestions(vm) {
    this.questions.innerHTML = '';

    for (const question of vm.questions) {
      const button = document.createElement('button');
      button.className = 'mini';
      button.textContent = question;
      this.questions.appendChild(button);
    }
  }

  renderFutures(vm) {
    this.futureButtons.innerHTML = '';

    vm.futures.forEach((future, index) => {
      const button = document.createElement('button');
      button.className = 'mini';
      button.dataset.index = index;
      button.textContent = future.name;
      button.style.cssText =
        `border:2px solid ${FUTURE_COLORS[future.type]};opacity:${index === vm.futureIndex ? 1 : 0.55}`;
      this.futureButtons.appendChild(button);
    });

    this.nav.style.display = vm.futures.length ? '' : 'none';

    const play = document.getElementById('hp');
    if (play) play.textContent = vm.playing ? '⏸' : '⏵';
  }

  renderHologram(vm) {
    const hologram = vm.hologram;
    const base = hologram ? hologram.baseBoard : vm.baseBoard;
    const current = hologram ? hologram.currentBoard : vm.baseBoard;
    const color = hologram ? hologram.color : FUTURE_COLORS.mejor;
    const lastMove = hologram ? hologram.lastMove : [];
    const orientation = vm.orientation;

    this.board.innerHTML = '';

    for (let i = 0; i < 8; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const r = orientation === 'w' ? i : 7 - i;
        const c = orientation === 'w' ? j : 7 - j;
        const name = 'abcdefgh'[c] + (8 - r);
        const basePiece = base[r][c];
        const currentPiece = current[r][c];

        const cell = document.createElement('div');
        cell.className = `sq ${(r + c) % 2 ? 'd' : 'l'}`;

        if (lastMove.includes(name)) {
          cell.style.outline = `2px dashed ${color}`;
          cell.style.outlineOffset = '-2px';
        }

        const glyph = document.createElement('span');

        if (currentPiece && basePiece &&
            currentPiece.type === basePiece.type &&
            currentPiece.color === basePiece.color) {
          glyph.className = currentPiece.color;
          glyph.textContent = PIECE_GLYPH[currentPiece.type];
        } else if (currentPiece) {
          glyph.textContent = PIECE_GLYPH[currentPiece.type];
          glyph.style.cssText =
            `color:${color};opacity:.7;text-shadow:0 0 8px ${color},` +
            `0 0 2px ${currentPiece.color === 'w' ? '#fff' : '#000'}`;
        } else if (basePiece) {
          glyph.className = basePiece.color;
          glyph.textContent = PIECE_GLYPH[basePiece.type];
          glyph.style.opacity = '.22';
        }

        if (glyph.textContent) cell.appendChild(glyph);
        this.board.appendChild(cell);
      }
    }

    if (hologram) {
      const moves = hologram.moves.map((move, index) =>
        `<span style="${index === hologram.plyIndex - 1 ? 'font-weight:700;text-decoration:underline' : 'opacity:.7'}">${escape(move.san)}</span>`,
      ).join(' ');

      this.legend.innerHTML =
        `<b style="color:${color}">${escape(hologram.name)}</b> (${escape(hologram.type)})<br>${moves}` +
        (hologram.warnings
          ? '<br><small>Algunas jugadas propuestas eran ilegales y se descartaron.</small>'
          : '');
    } else {
      this.legend.innerHTML =
        'Sin futuros todavía. Pregunta a Lord por amenazas o alternativas.' +
        (vm.warnings ? ' (Lord propuso líneas ilegales y se descartaron.)' : '');
    }
  }
}
