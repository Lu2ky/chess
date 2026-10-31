/**
 * adapters/chess-gateway.js
 * Adaptador que implementa ChessPort/PositionPort sobre chess.js.
 * Es el ÚNICO punto del sistema que conoce la librería.
 */

export class ChessPosition {
  constructor(chess, ChessCtor) {
    this.chess = chess;
    this.Chess = ChessCtor;
  }

  fen() { return this.chess.fen(); }
  turn() { return this.chess.turn(); }
  board() { return this.chess.board(); }
  get(square) { return this.chess.get(square); }
  pgn() { return this.chess.pgn(); }
  reset() { this.chess.reset(); }
  inCheck() { return this.chess.in_check(); }
  inCheckmate() { return this.chess.in_checkmate(); }
  isGameOver() { return this.chess.game_over(); }

  moves(options) {
    return options ? this.chess.moves(options) : this.chess.moves();
  }

  move(move, options) {
    return options ? this.chess.move(move, options) : this.chess.move(move);
  }

  undo() { return this.chess.undo(); }

  history(options) {
    return options ? this.chess.history(options) : this.chess.history();
  }

  fork() {
    return new ChessPosition(new this.Chess(this.chess.fen()), this.Chess);
  }
}

export class ChessGateway {
  constructor(ChessCtor) {
    if (!ChessCtor) throw new Error('chess.js no está disponible');
    this.Chess = ChessCtor;
    this.position = new ChessPosition(new ChessCtor(), ChessCtor);
  }

  reset() {
    this.position.reset();
  }

  newPosition(fen) {
    return new ChessPosition(fen ? new this.Chess(fen) : new this.Chess(), this.Chess);
  }

  /** Reconstruye la posición tras `ply` medias jugadas. */
  positionAt(ply) {
    const walker = new this.Chess();
    const history = this.position.history();

    for (let i = 0; i < ply; i += 1) {
      walker.move(history[i], { sloppy: true });
    }

    return new ChessPosition(walker, this.Chess);
  }
}
