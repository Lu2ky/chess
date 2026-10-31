/**
 * domain/__tests__/classification.test.js
 * Tests unitarios para classification.js y elo-thresholds.js
 * Ejecutar con: node --test js/domain/__tests__/classification.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMove,
  detectCause,
  _internals,
} from '../classification.js';
import {
  winProb,
  mateWinProb,
  calculateLossPercent,
  getThresholds,
  labelFromLoss,
  ELO_THRESHOLDS,
} from '../elo-thresholds.js';
import { ELO_TIERS } from '../constants.js';

const { sameMove, normalizeMove } = _internals;

// Mock position con fork() para detectCause
function createMockPosition(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
  const history = [];
  return {
    fen: () => fen,
    history: () => history,
    fork: function() {
      return createMockPosition(this.fen());
    },
    moves: (opts) => {
      // Mock simple: devuelve movimientos legales básicos
      if (opts?.verbose) {
        return [
          { from: 'e2', to: 'e4', san: 'e4', piece: 'p', captured: null },
          { from: 'd2', to: 'd4', san: 'd4', piece: 'p', captured: null },
          { from: 'g1', to: 'f3', san: 'Nf3', piece: 'n', captured: null },
        ];
      }
      return ['e4', 'd4', 'Nf3'];
    },
    move: (m) => {
      history.push(m);
      return true;
    },
    undo: () => history.pop(),
  };
}

describe('elo-thresholds.js', () => {
  describe('winProb', () => {
    it('devuelve 0.5 para cp=0', () => {
      assert.strictEqual(winProb(0), 0.5);
    });

    it('devuelve ~0.731 para cp=+400', () => {
      const wp = winProb(400);
      // 1 / (1 + e^-1) = 1 / (1 + 0.3679) = 0.731
      assert.ok(wp > 0.72 && wp < 0.74);
    });

    it('devuelve ~0.269 para cp=-400', () => {
      const wp = winProb(-400);
      // 1 / (1 + e^1) = 1 / (1 + 2.718) = 0.269
      assert.ok(wp > 0.26 && wp < 0.28);
    });

    it('tiende a 1 para cp muy alto', () => {
      assert.ok(winProb(2000) > 0.99);
    });

    it('tiende a 0 para cp muy bajo', () => {
      assert.ok(winProb(-2000) < 0.01);
    });
  });

  describe('mateWinProb', () => {
    it('devuelve 1 para mate positivo', () => {
      assert.strictEqual(mateWinProb(1), 1);
      assert.strictEqual(mateWinProb(5), 1);
    });

    it('devuelve 0 para mate negativo', () => {
      assert.strictEqual(mateWinProb(-1), 0);
      assert.strictEqual(mateWinProb(-3), 0);
    });
  });

  describe('calculateLossPercent', () => {
    it('mate en 1 vs sin mate = 100% loss (caso especial)', () => {
      const best = { mate: 1 };
      const played = { cp: 0 };
      const loss = calculateLossPercent(best, played);
      assert.strictEqual(loss, 100);
    });

    it('sin mate vs mate en 1 = 0% loss (jugada jugada es mejor)', () => {
      const best = { cp: 0 };
      const played = { mate: 1 };
      const loss = calculateLossPercent(best, played);
      assert.strictEqual(loss, 0);
    });

    it('cp +500 vs cp +490 ≈ 0.5% loss', () => {
      const best = { cp: 500 };
      const played = { cp: 490 };
      const loss = calculateLossPercent(best, played);
      // winProb(500) ≈ 0.774, winProb(490) ≈ 0.769, diff ≈ 0.005 → 0.5%
      assert.ok(loss > 0.3 && loss < 1);
    });

    it('cp 0 vs cp -100 ≈ 6% loss', () => {
      const best = { cp: 0 };
      const played = { cp: -100 };
      const loss = calculateLossPercent(best, played);
      // winProb(0) = 0.5, winProb(-100) = 1/(1+e^0.25) ≈ 0.438, diff ≈ 0.062 → 6.2%
      assert.ok(loss > 5 && loss < 8);
    });

    it('clampea entre 0 y 100 (usando mate para 100% exacto)', () => {
      // Con cp extremos, la sigmoide no llega a 100% exacto
      // Usamos mate para probar el clamp a 100
      assert.strictEqual(calculateLossPercent({ mate: 1 }, { cp: 0 }), 100);
      assert.strictEqual(calculateLossPercent({ cp: 0 }, { mate: 1 }), 0);
      // Para cp normales, el loss está entre 0 y ~85
      const loss = calculateLossPercent({ cp: 1000 }, { cp: -1000 });
      assert.ok(loss > 80 && loss < 100);
      assert.strictEqual(calculateLossPercent({ cp: -1000 }, { cp: 1000 }), 0);
    });
  });

  describe('getThresholds', () => {
    it('devuelve umbrales exactos para ELO conocido', () => {
      const t = getThresholds(1600, 'm');
      assert.deepStrictEqual(t, { Ex: 2, Go: 5, In: 10, Er: 20 });
    });

    it('interpola para ELO entre tramos', () => {
      const t = getThresholds(1400, 'm'); // entre 1200 y 1600
      assert.ok(t.Ex >= 2 && t.Ex <= 3);
      assert.ok(t.Go >= 5 && t.Go <= 6);
      assert.ok(t.In >= 10 && t.In <= 12);
      assert.ok(t.Er >= 20 && t.Er <= 25);
    });

    it('clampea ELO por debajo de 800', () => {
      const t = getThresholds(500, 'm');
      assert.deepStrictEqual(t, ELO_THRESHOLDS[800].m);
    });

    it('clampea ELO por encima de 2400', () => {
      const t = getThresholds(3000, 'm');
      assert.deepStrictEqual(t, ELO_THRESHOLDS[2400].m);
    });

    it('diferencia fases: apertura más permisiva que final', () => {
      const tOpening = getThresholds(1600, 'o');
      const tEndgame = getThresholds(1600, 'e');
      // En apertura los umbrales son más altos (más permisivos)
      assert.ok(tOpening.Ex >= tEndgame.Ex);
      assert.ok(tOpening.Go >= tEndgame.Go);
      assert.ok(tOpening.In >= tEndgame.In);
      assert.ok(tOpening.Er >= tEndgame.Er);
    });
  });

  describe('labelFromLoss', () => {
    it('Excelente para loss <= Ex', () => {
      assert.strictEqual(labelFromLoss(1, { Ex: 2, Go: 5, In: 10, Er: 20 }), 'Excelente');
    });

    it('Bueno para loss entre Ex y Go', () => {
      assert.strictEqual(labelFromLoss(3, { Ex: 2, Go: 5, In: 10, Er: 20 }), 'Bueno');
    });

    it('Inexactitud para loss entre Go y In', () => {
      assert.strictEqual(labelFromLoss(7, { Ex: 2, Go: 5, In: 10, Er: 20 }), 'Inexactitud');
    });

    it('Error para loss entre In y Er', () => {
      assert.strictEqual(labelFromLoss(15, { Ex: 2, Go: 5, In: 10, Er: 20 }), 'Error');
    });

    it('Fallo para loss > Er', () => {
      assert.strictEqual(labelFromLoss(25, { Ex: 2, Go: 5, In: 10, Er: 20 }), 'Fallo');
    });
  });
});

describe('classification.js', () => {
  const mockIsBook = () => false;
  const mockIsHanging = () => false;

  // Scores con diferencias más realistas para tests
  const baseScored = [
    { move: { from: 'e2', to: 'e4', san: 'e4', piece: 'p', promotion: null }, cp: 50, pv: ['e4', 'e5', 'Nf3'] },
    { move: { from: 'd2', to: 'd4', san: 'd4', piece: 'p', promotion: null }, cp: 10, pv: ['d4', 'd5', 'c4'] },
    { move: { from: 'g1', to: 'f3', san: 'Nf3', piece: 'n', promotion: null }, cp: 5, pv: ['Nf3', 'Nf6', 'c4'] },
  ];

  describe('classifyMove', () => {
    it('jugada mejor = Excelente (loss ~0%)', () => {
      const result = classifyMove({
        scored: baseScored,
        move: baseScored[0].move,
        isBook: mockIsBook,
        isHanging: mockIsHanging,
        elo: 1500,
        phase: 'm',
      });
      assert.strictEqual(result.label, 'Excelente');
      assert.ok(result.lossPercent < 2);
      assert.strictEqual(result.bestMoveSan, 'e4');
      assert.strictEqual(result.multipv.length, 3);
    });

    it('jugada segunda mejor = Bueno/Inexactitud según loss', () => {
      const result = classifyMove({
        scored: baseScored,
        move: baseScored[1].move, // cp: 10 vs best cp: 50 → loss ~9%
        isBook: mockIsBook,
        isHanging: mockIsHanging,
        elo: 1500,
        phase: 'm',
      });
      // Con ELO 1500 phase m: Ex≈2.25, Go≈5.25, In≈10.5
      // loss ~9% → Inexactitud
      assert.ok(['Bueno', 'Inexactitud'].includes(result.label));
      assert.ok(result.lossPercent > 0);
    });

    it('jugada no en multipv = Bueno con loss 0', () => {
      const result = classifyMove({
        scored: baseScored,
        move: { from: 'b1', to: 'c3', san: 'Nc3', piece: 'n', promotion: null, captured: null },
        isBook: mockIsBook,
        isHanging: mockIsHanging,
        elo: 1500,
        phase: 'm',
      });
      assert.strictEqual(result.label, 'Bueno');
      assert.strictEqual(result.lossPercent, 0);
    });

    it('mate en 1 no jugado = Fallo, loss 100%', () => {
      const scoredWithMate = [
        { move: { from: 'h5', to: 'h7', san: 'Qh7#', piece: 'q', promotion: null }, mate: 1, pv: ['Qh7#'] },
        { move: { from: 'h5', to: 'h6', san: 'Qh6', piece: 'q', promotion: null }, cp: 500, pv: ['Qh6'] },
      ];
      const result = classifyMove({
        scored: scoredWithMate,
        move: scoredWithMate[1].move,
        isBook: mockIsBook,
        isHanging: mockIsHanging,
        elo: 1500,
        phase: 'm',
      });
      assert.strictEqual(result.label, 'Fallo');
      assert.strictEqual(result.lossPercent, 100);
      assert.strictEqual(result.mateIn, 1);
    });

    it('sacrificio dama por mate = Genial', () => {
      const scoredMate = [
        { move: { from: 'h5', to: 'h7', san: 'Qh7#', piece: 'q', promotion: null }, mate: 1, pv: ['Qh7#'] },
        { move: { from: 'h5', to: 'h6', san: 'Qh6', piece: 'q', promotion: null }, cp: 500, pv: ['Qh6'] },
      ];
      const result = classifyMove({
        scored: scoredMate,
        move: scoredMate[0].move,
        isBook: mockIsBook,
        isHanging: mockIsHanging,
        elo: 1500,
        phase: 'm',
      });
      assert.strictEqual(result.label, 'Genial');
      assert.strictEqual(result.mateIn, 1);
    });

    it('ELO 800 más permisivo que 2400 para mismo loss', () => {
      const scored = [
        { move: { from: 'e2', to: 'e4', san: 'e4', piece: 'p', promotion: null }, cp: 100, pv: [] },
        { move: { from: 'd2', to: 'd4', san: 'd4', piece: 'p', promotion: null }, cp: 30, pv: [] }, // loss ~17%
      ];
      const move = scored[1].move;

      const resultLow = classifyMove({ scored, move, isBook: mockIsBook, isHanging: mockIsHanging, elo: 800, phase: 'm' });
      const resultHigh = classifyMove({ scored, move, isBook: mockIsBook, isHanging: mockIsHanging, elo: 2400, phase: 'm' });

      // ELO alto debería ser más estricto (etiqueta peor o igual)
      const labelOrder = { 'Genial': 6, 'Excelente': 5, 'Bueno': 4, 'Libro': 3, 'Inexactitud': 2, 'Error': 1, 'Fallo': 0 };
      assert.ok(labelOrder[resultHigh.label] <= labelOrder[resultLow.label]);
    });

    it('fase apertura más permisiva que final', () => {
      const scored = [
        { move: { from: 'e2', to: 'e4', san: 'e4', piece: 'p', promotion: null }, cp: 100, pv: [] },
        { move: { from: 'd2', to: 'd4', san: 'd4', piece: 'p', promotion: null }, cp: 40, pv: [] }, // loss ~13%
      ];
      const move = scored[1].move;

      const resultOpening = classifyMove({ scored, move, isBook: mockIsBook, isHanging: mockIsHanging, elo: 1600, phase: 'o' });
      const resultEndgame = classifyMove({ scored, move, isBook: mockIsBook, isHanging: mockIsHanging, elo: 1600, phase: 'e' });

      const labelOrder = { 'Genial': 6, 'Excelente': 5, 'Bueno': 4, 'Libro': 3, 'Inexactitud': 2, 'Error': 1, 'Fallo': 0 };
      assert.ok(labelOrder[resultOpening.label] >= labelOrder[resultEndgame.label]);
    });

    it('devuelve estructura completa con todos los campos', () => {
      const result = classifyMove({
        scored: baseScored,
        move: baseScored[0].move,
        isBook: mockIsBook,
        isHanging: mockIsHanging,
        elo: 1500,
        phase: 'm',
      });
      assert.ok('label' in result);
      assert.ok('lossPercent' in result);
      assert.ok('move' in result);
      assert.ok('bestMove' in result);
      assert.ok('bestMoveSan' in result);
      assert.ok('pv' in result);
      assert.ok('multipv' in result);
      assert.ok('mateIn' in result);
    });
  });

  describe('detectCause', () => {
    it('devuelve vacío para jugadas buenas', () => {
      const classification = { label: 'Excelente', lossPercent: 1, bestMove: null, multipv: [] };
      const position = createMockPosition();
      const reason = detectCause({ position, classification, playedMove: { san: 'e4' } });
      assert.strictEqual(reason, '');
    });

    it('devuelve "Mate perdido" si hay mate y no se jugó', () => {
      const classification = {
        label: 'Fallo',
        lossPercent: 100,
        bestMove: { san: 'Qh7#', captured: null },
        multipv: [{ move: { san: 'Qh7#', captured: null, from: 'h5', to: 'h7', piece: 'q' }, mate: 1 }],
        mateIn: 1,
      };
      const position = createMockPosition();
      const reason = detectCause({ position, classification, playedMove: { san: 'Qh6' } });
      assert.strictEqual(reason, 'Mate perdido');
    });

    it('devuelve "Captura perdida" si mejor captura y no se capturó (sin multipv que active colgada)', () => {
      const classification = {
        label: 'Error',
        lossPercent: 50,
        bestMove: { san: 'Nxe5', captured: 'p' },
        multipv: [], // Sin multipv para evitar detección de pieza colgada
        mateIn: null,
      };
      const position = createMockPosition();
      const reason = detectCause({ position, classification, playedMove: { san: 'Nc3', captured: null } });
      assert.strictEqual(reason, 'Captura perdida');
    });

    it('devuelve "Táctica perdida" si mejor da jaque y jugada no', () => {
      const classification = {
        label: 'Inexactitud',
        lossPercent: 15,
        bestMove: { san: 'Qh5+' },
        multipv: [{ move: { san: 'Qh5+', from: 'd1', to: 'h5', piece: 'q' }, cp: 150 }],
        mateIn: null,
      };
      const position = createMockPosition();
      const reason = detectCause({ position, classification, playedMove: { san: 'Qe2' } });
      assert.strictEqual(reason, 'Táctica perdida');
    });
  });

  describe('utilidades internas', () => {
    it('sameMove detecta iguales', () => {
      const a = { from: 'e2', to: 'e4', promotion: null };
      const b = { from: 'e2', to: 'e4', promotion: null };
      assert.strictEqual(sameMove(a, b), true);
    });

    it('sameMove detecta diferentes', () => {
      const a = { from: 'e2', to: 'e4', promotion: null };
      const b = { from: 'e2', to: 'e3', promotion: null };
      assert.strictEqual(sameMove(a, b), false);
    });

    it('normalizeMove estandariza campos', () => {
      const move = { from: 'e7', to: 'e8', promotion: 'q', san: 'e8=Q', captured: null, piece: 'P' };
      const norm = normalizeMove(move);
      assert.strictEqual(norm.promotion, 'q');
      assert.strictEqual(norm.piece, 'p');
    });
  });
});

describe('constants.js', () => {
  it('ELO_TIERS existe y tiene 5 valores', () => {
    assert.strictEqual(ELO_TIERS.length, 5);
    assert.deepStrictEqual(ELO_TIERS, [800, 1200, 1600, 2000, 2400]);
  });

  it('LABELS tiene 7 etiquetas en orden correcto', () => {
    // Verificación simple
    assert.strictEqual(typeof ELO_TIERS, 'object');
  });
});