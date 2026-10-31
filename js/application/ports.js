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

/**
 * @typedef {object} StockfishAnalysisResult
 * @property {object|null} bestMove    Mejor jugada completa {from, to, promotion?, san, piece?, captured?}
 * @property {{cp?: number, mate?: number}} score  Score en centipawns o mate en N
 * @property {string[]} pv             Principal variation (lista de SAN)
 * @property {Array<{move: object, score: {cp?: number, mate?: number}, pv: string[]}>} multipv  Líneas alternativas
 */

/**
 * @typedef {object} StockfishPort
 * @property {() => Promise<{ready: boolean}>} ready  Indica si el motor está listo (nunca lanza)
 * @property {(position: PositionPort, options?: {depth?: number, nodes?: number, time?: number, multipv?: number}, signal?: AbortSignal) => Promise<StockfishAnalysisResult>} analyse  Análisis completo
 * @property {(position: PositionPort, signal?: AbortSignal) => Promise<{cp?: number, mate?: number}>} evaluate  Evaluación rápida
 * @property {() => boolean} isReady              Comprobación síncrona
 * @property {() => void} terminate               Apaga el worker y libera recursos
 */

export {};
