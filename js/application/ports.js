/**
 * application/ports.js
 * Contratos (puertos) que la capa de aplicación exige al exterior.
 * En JavaScript no hay interfaces, así que se documentan aquí y los
 * adaptadores de `js/adapters/` las implementan.
 *
 * @typedef {object} PositionPort
 * @property {() => string} fen
 * @property {() => 'w'|'b'} turn
 * @property {() => Array<Array<object|null>>} board
 * @property {(opts?:object) => object[]} moves
 * @property {(move:object) => object|null} move
 * @property {() => object|null} undo
 * @property {(opts?:object) => Array} history
 * @property {(square:string) => object|null} get
 * @property {() => string} pgn
 * @property {() => void} reset
 * @property {() => boolean} inCheck
 * @property {() => boolean} inCheckmate
 * @property {() => boolean} isGameOver
 * @property {() => PositionPort} fork
 *
 * @typedef {object} ChessPort
 * @property {PositionPort} position   Partida viva.
 * @property {() => void} reset
 * @property {(fen?:string) => PositionPort} newPosition
 * @property {(ply:number) => PositionPort} positionAt
 *
 * @typedef {object} StoragePort
 * @property {(key:string) => any} read
 * @property {(key:string, value:any) => boolean} write
 *
 * @typedef {object} AIPort
 * @property {() => Promise<Function|null>} sample
 *
 * @typedef {object} SoundPort
 * @property {(kind:number) => void} play
 */

export {};
