/**
 * js/tests/stockfish-node-test.mjs
 * Test de humo en Node.js.
 *
 * Node no tiene el Worker del navegador, así que aquí se validan:
 *  - La API pública del gateway (sin inicializar el motor).
 *  - Los helpers puros de parsing UCI.
 *
 * La integración real con el worker se prueba en test-stockfish.html.
 * Ejecutar con: npm run test:stockfish
 */

import {
  StockfishGateway,
  createStockfishGateway,
  _internals,
} from '../adapters/stockfish-gateway.js';

const { uciToMove, resolveLine, parseScore, parseInfoLine, scoreToCp } = _internals;

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`❌ ${name}\n   ${error.message}`);
    failed += 1;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Posición mínima compatible con PositionPort para probar helpers. */
function mockPosition(fen = 'startpos') {
  const moves = [
    { from: 'e2', to: 'e4', promotion: undefined, san: 'e4' },
    { from: 'g1', to: 'f3', promotion: undefined, san: 'Nf3' },
  ];

  return {
    fen: () => fen,
    turn: () => 'w',
    board: () => [],
    moves: () => moves,
    move: move => move,
    undo: () => null,
    history: () => [],
    get: () => null,
    pgn: () => '',
    reset: () => {},
    inCheck: () => false,
    inCheckmate: () => false,
    isGameOver: () => false,
    fork: () => mockPosition(fen),
  };
}

console.log('🧪 Tests de humo de Stockfish (Node.js)\n');

check('El gateway se instancia y expone su API', () => {
  const gateway = createStockfishGateway();
  assert(gateway instanceof StockfishGateway, 'Debe ser StockfishGateway');
  assert(typeof gateway.ready === 'function', 'Falta ready()');
  assert(typeof gateway.analyse === 'function', 'Falta analyse()');
  assert(typeof gateway.evaluate === 'function', 'Falta evaluate()');
  assert(typeof gateway.isReady === 'function', 'Falta isReady()');
  assert(typeof gateway.terminate === 'function', 'Falta terminate()');
  assert(gateway.isReady() === false, 'No debe estar listo antes de inicializar');
});

check('uciToMove resuelve from/to/promotion', () => {
  const move = uciToMove(mockPosition(), 'e2e4');
  assert(move && move.from === 'e2' && move.to === 'e4', 'No resolvió e2e4');
  assert(uciToMove(mockPosition(), 'a1a8') === null, 'No debe inventar jugadas');
});

check('resolveLine devuelve la jugada y la PV en SAN', () => {
  const line = resolveLine(mockPosition(), ['e2e4', 'g1f3']);
  assert(line.move && line.move.san === 'e4', 'Primera jugada incorrecta');
  assert(line.pv.join(' ') === 'e4 Nf3', `PV inesperada: ${line.pv.join(' ')}`);
});

check('parseScore entiende cp y mate', () => {
  assert(parseScore('info depth 12 score cp -25 pv e2e4')?.cp === -25, 'cp mal');
  assert(parseScore('info depth 12 score mate 3 pv e2e4')?.mate === 3, 'mate mal');
  assert(parseScore('info depth 12 nodes 1234') === null, 'No debe aceptar sin score');
});

check('parseInfoLine extrae índice, score y jugadas UCI', () => {
  const info = parseInfoLine('info depth 14 multipv 2 score cp 34 pv d2d4 g8f6');
  assert(info && info.index === 2, 'multipv mal');
  assert(info.score.cp === 34, 'score mal');
  assert(info.uciMoves.join(' ') === 'd2d4 g8f6', 'pv mal');
});

check('scoreToCp convierte mate a centipeones', () => {
  assert(scoreToCp({ cp: 42 }) === 42, 'cp mal');
  assert(scoreToCp({ mate: 3 }) === 9970, 'mate a favor mal');
  assert(scoreToCp({ mate: -2 }) === -9980, 'mate en contra mal');
  assert(scoreToCp(null) === 0, 'null mal');
});

try {
  const gateway = new StockfishGateway();
  const result = await gateway.ready();
  assert(result.ready === false, 'En Node debe devolver ready:false');
  gateway.terminate();
  console.log('✅ ready() no lanza cuando no hay Worker (fallback)');
  passed += 1;
} catch (error) {
  console.error(`❌ ready() no lanza cuando no hay Worker (fallback)\n   ${error.message}`);
  failed += 1;
}

console.log(`\nResultado: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
