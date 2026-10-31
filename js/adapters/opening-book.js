/**
 * adapters/opening-book.js
 * Índice del libro de aperturas. Usa chess.js (a través del constructor
 * inyectado) para validar cada línea y calcular claves de posición.
 */

import { OPENING_BOOK_SOURCE } from '../domain/openings.js';

export class OpeningBook {
  constructor(source, ChessCtor) {
    this.keys = new Set();
    this.entries = new Map();
    this.discarded = [];
    this.build(source, ChessCtor);
  }

  get size() {
    return this.keys.size;
  }

  /** Clave de posición: FEN sin contadores (piezas, turno, enroques). */
  key(fen) {
    return fen.split(' ').slice(0, 3).join(' ');
  }

  has(key) {
    return this.keys.has(key);
  }

  meta(key) {
    return this.entries.get(key) || null;
  }

  build(source, ChessCtor) {
    for (const line of source.split('\n')) {
      const [eco, name, moves] = line.split('|');
      if (!moves) continue;

      const board = new ChessCtor();
      const keys = [];
      let valid = true;

      for (const san of moves.trim().split(/\s+/)) {
        if (!board.move(san, { sloppy: true })) {
          valid = false;
          break;
        }
        keys.push(this.key(board.fen()));
      }

      if (!valid) {
        this.discarded.push(name);
        continue;
      }

      for (const key of keys) {
        this.keys.add(key);
      }

      const last = keys[keys.length - 1];
      if (!this.entries.has(last)) {
        this.entries.set(last, { e: eco, n: name });
      }
    }
  }
}

export const createOpeningBook = ChessCtor => new OpeningBook(OPENING_BOOK_SOURCE, ChessCtor);
