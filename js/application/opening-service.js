/**
 * application/opening-service.js
 * Caso de uso: reconocer la apertura jugada a partir del historial.
 */

export class OpeningService {
  /**
   * @param {{book: {key:Function, has:Function, meta:Function},
   *          chess: import('./ports.js').ChessPort}} deps
   */
  constructor({ book, chess }) {
    this.book = book;
    this.chess = chess;
  }

  /**
   * Recorre las primeras jugadas y devuelve la última apertura reconocida.
   * @param {object} position  Posición de referencia (viva o histórica).
   * @param {number|null} upTo Ply hasta el que analizar (null = todas).
   */
  info(position, upTo = null) {
    const history = position.history();
    const limit = upTo == null ? history.length : upTo;
    const walker = this.chess.newPosition();

    let current = null;
    let hit = 0;

    for (let i = 0; i < Math.min(limit, 30); i += 1) {
      walker.move(history[i], { sloppy: true });
      const key = this.book.key(walker.fen());

      const meta = this.book.meta(key);
      if (meta) current = meta;
      if (this.book.has(key)) hit = i + 1;
    }

    return { current, hit, n: limit, san: history[hit] };
  }

  name(position, upTo = null) {
    const info = this.info(position, upTo);
    return info.current ? `${info.current.n} (${info.current.e})` : '';
  }
}
