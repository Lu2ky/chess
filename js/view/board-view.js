/**
 * view/board-view.js
 * Vista del tablero: construye las 64 casillas, las coordenadas y la
 * pieza flotante al arrastrar. Toda la interacción se traduce a eventos
 * (onSelect / onMove); las reglas viven en el dominio.
 */

import { PIECE_GLYPH } from '../domain/constants.js';

export class BoardView {
  constructor({ board, ranks, files, getConfig }) {
    this.board = board;
    this.ranks = ranks;
    this.files = files;
    this.getConfig = getConfig || (() => ({}));

    this.vm = null;
    this.byName = {};
    this.onSelect = null;
    this.onMove = null;

    this.drag = null;
    this.timer = null;
    this.float = null;
    this.hoverEl = null;

    this.bind();
  }

  bind() {
    this.board.addEventListener('pointerdown', event => this.down(event));
    this.board.addEventListener('pointermove', event => this.move(event));
    this.board.addEventListener('pointerup', event => this.up(event));
    this.board.addEventListener('pointercancel', () => this.clean());
    this.board.addEventListener('contextmenu', event => event.preventDefault());
  }

  render(vm) {
    this.vm = vm;
    this.byName = Object.fromEntries(vm.squares.map(square => [square.name, square]));

    this.ranks.innerHTML = vm.ranks.map(rank => `<div class="co">${rank}</div>`).join('');
    this.files.innerHTML = vm.files.map(file => `<div class="co">${file}</div>`).join('');

    this.board.innerHTML = '';

    for (const square of vm.squares) {
      const cell = document.createElement('div');
      const classes = ['sq', square.dark ? 'd' : 'l'];

      if (square.selected) classes.push('sel');
      if (square.last) classes.push('last');
      if (square.ghostFrom) classes.push('gf');
      if (square.legal) classes.push('mv');
      if (square.threat) classes.push('thr');
      if (square.hint) classes.push('hn');

      cell.className = classes.join(' ');
      cell.dataset.square = square.name;

      if (square.piece) cell.appendChild(this.pieceElement(square.piece));

      if (square.ghostTo) {
        const ghost = document.createElement('span');
        ghost.className = 'gh';
        ghost.textContent = PIECE_GLYPH[square.ghostTo.piece];
        cell.appendChild(ghost);
      }

      this.board.appendChild(cell);
    }
  }

  pieceElement(piece) {
    const config = this.getConfig();
    const sprite = config.sp && config.sp[piece.color + piece.type];

    if (sprite) {
      const image = document.createElement('img');
      image.src = sprite;
      image.className = `pi ${piece.color}`;
      image.draggable = false;
      return image;
    }

    const glyph = document.createElement('span');
    glyph.className = piece.color;
    glyph.textContent = PIECE_GLYPH[piece.type];
    return glyph;
  }

  squareAt(x, y) {
    const box = this.board.getBoundingClientRect();
    const column = Math.floor(((x - box.left) / box.width) * 8);
    const row = Math.floor(((y - box.top) / box.height) * 8);

    if (row < 0 || column < 0 || row > 7 || column > 7) return null;

    const r = this.vm.orientation === 'w' ? row : 7 - row;
    const c = this.vm.orientation === 'w' ? column : 7 - column;
    return 'abcdefgh'[c] + (8 - r);
  }

  down(event) {
    this.clean();

    if (!this.vm || !this.vm.interactive) return;
    if (event.button > 0) return;

    const cell = event.target.closest('.sq');
    if (!cell) return;

    const square = this.byName[cell.dataset.square];
    if (!square) return;

    const grabbable = Boolean(square.piece && square.piece.color === this.vm.turn);

    this.drag = {
      from: square.name,
      x: event.clientX,
      y: event.clientY,
      on: false,
      grabbable,
      touch: event.pointerType !== 'mouse',
      legal: this.vm.squares.filter(item => item.legal).map(item => item.name),
    };

    if (!grabbable) return;

    try {
      this.board.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture no disponible */
    }

    const config = this.getConfig();
    if (this.drag.touch) {
      this.timer = setTimeout(() => this.grab(), config.hold ?? 200);
    } else {
      this.grab();
    }
  }

  move(event) {
    if (!this.drag) return;

    if (!this.drag.on) {
      if (Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) <= 8) return;
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
      if (!this.drag.grabbable) return;
      this.grab();
    }

    if (this.float) {
      this.float.style.left = `${event.clientX}px`;
      this.float.style.top = `${event.clientY}px`;
    }

    const target = this.squareAt(event.clientX, event.clientY);
    if (target === this.drag.hover) return;

    if (this.hoverEl) this.hoverEl.style.outline = '';
    this.drag.hover = target;

    if (target && target !== this.drag.from) {
      const cell = this.board.querySelector(`[data-square="${target}"]`);
      if (cell) {
        this.hoverEl = cell;
        cell.style.outline = `3px solid ${this.drag.legal.includes(target) ? '#2e7d32' : '#c62828'}`;
        cell.style.outlineOffset = '-3px';
      }
    }
  }

  grab() {
    if (!this.drag || this.drag.on || !this.drag.grabbable) return;

    clearTimeout(this.timer);
    this.drag.on = true;

    if (this.onSelect) this.onSelect(this.drag.from);

    const cell = this.board.querySelector(`[data-square="${this.drag.from}"]`);
    const source = cell && cell.firstChild;
    if (!source) {
      this.clean();
      return;
    }

    const isImage = source.tagName === 'IMG';

    if (isImage) {
      this.float = source.cloneNode();
      this.float.style.width = `${cell.offsetWidth * 0.86}px`;
      this.float.style.height = `${cell.offsetHeight * 0.86}px`;
    } else {
      this.float = document.createElement('div');
      this.float.className = source.className;
      this.float.textContent = source.textContent;
    }

    this.float.style.cssText +=
      `;position:fixed;z-index:50;pointer-events:none;line-height:1;` +
      `font-size:${getComputedStyle(cell).fontSize};` +
      `transform:translate(-50%,-50%) scale(1.25);` +
      `left:${this.drag.x}px;top:${this.drag.y}px`;

    source.style.opacity = '.25';
    document.body.appendChild(this.float);

    const config = this.getConfig();
    if (config.vib && navigator.vibrate) navigator.vibrate(8);
  }

  up(event) {
    if (!this.drag) return;

    const from = this.drag.from;
    const started = this.drag.on;
    const legal = this.drag.legal;
    const to = this.squareAt(event.clientX, event.clientY);
    this.clean();

    if (started && to && to !== from) {
      if (legal.includes(to) && this.onMove) this.onMove(from, to);
      else if (this.onSelect) this.onSelect(from);
      return;
    }

    if (!started) {
      if (this.onSelect) this.onSelect(to || from);
      return;
    }

    if (this.onSelect) this.onSelect(from);
  }

  clean() {
    clearTimeout(this.timer);
    this.timer = null;

    if (this.float) {
      this.float.remove();
      this.float = null;
    }

    if (this.hoverEl) {
      this.hoverEl.style.outline = '';
      this.hoverEl = null;
    }

    this.drag = null;
  }
}
