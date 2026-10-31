/**
 * adapters/presenters.js
 * Presentadores: convierten estado del modelo + dominio en "view models"
 * listos para que las vistas construyan el DOM. Sin efectos secundarios.
 */

import {
  CAPTURE_ORDER,
  LABELS,
  PIECE_POINTS,
  SKILL_KEYS,
  SKILL_NAME,
  SKILL_TIP,
  FUTURE_COLORS,
  opposite,
  colorName,
} from '../domain/constants.js';
import { average, emaSkillRatings, ratingFromAccuracy, accuracyFromLoss } from '../domain/metrics.js';
import { moveNumberLabel } from '../domain/notation.js';

export const formatClock = seconds => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ====================================================================== */
/* Tablero                                                                */
/* ====================================================================== */

export function buildBoardVM({ state, position, threats = [], legalTargets, orientation }) {
  const view = orientation || state.view;
  const board = position.board();
  const history = position.history({ verbose: true });
  const turn = position.turn();

  const lastMoves = state.viewingPly == null
    ? state.lastMove
    : state.viewingPly > 0
      ? [history[state.viewingPly - 1].from, history[state.viewingPly - 1].to]
      : [];

  const legal = state.selection ? legalTargets(state.selection) : [];
  const hintSquare = state.hint && state.hint.stage === 1 ? state.hint.move.from : null;
  const ghost = state.ghost;

  const squares = [];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      const r = view === 'w' ? i : 7 - i;
      const c = view === 'w' ? j : 7 - j;
      const name = 'abcdefgh'[c] + (8 - r);
      const piece = board[r][c];

      squares.push({
        name,
        dark: (r + c) % 2 === 1,
        piece,
        selected: state.selection === name,
        last: lastMoves.includes(name),
        legal: legal.includes(name),
        threat: threats.includes(name),
        hint: hintSquare === name && state.viewingPly == null,
        ghostFrom: Boolean(ghost && ghost.from === name),
        ghostTo: ghost && ghost.to === name ? ghost : null,
      });
    }
  }

  const ranks = view === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = view === 'w' ? 'abcdefgh'.split('') : 'hgfedcba'.split('');

  return {
    squares,
    ranks,
    files,
    orientation: view,
    turn,
    interactive:
      state.viewingPly == null &&
      !state.busy &&
      !state.ended &&
      !position.isGameOver() &&
      (state.mode === '2' || turn === state.me),
  };
}

/* ====================================================================== */
/* Panel de juego                                                         */
/* ====================================================================== */

const sideName = (color, { mode, me }) =>
  mode === '2' ? colorName(color) : color === me ? 'Tú' : 'Rival';

function capturedFor(color, history) {
  const pieces = [];
  let score = 0;

  for (const move of history) {
    if (!move.captured || move.color !== color) continue;
    pieces.push(move.captured);
    score += PIECE_POINTS[move.captured];
  }

  pieces.sort((a, b) => CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b));
  return { pieces, score };
}

export function buildGameVM({ state, position, total, orientation }) {
  const view = orientation || state.view;
  const topColor = opposite(view);
  const bottomColor = view;
  const context = { mode: state.mode, me: state.me };

  const history = position.history({ verbose: true });
  const limit = state.viewingPly == null ? history.length : state.viewingPly;
  const visibleHistory = history.slice(0, limit);

  const captured = {
    w: capturedFor('w', visibleHistory),
    b: capturedFor('b', visibleHistory),
  };

  const turn = position.turn();
  const pv = state.mode === '2' || state.me === 'w' ? 1 : -1;
  const advantage = state.advantage * pv;

  const moves = state.log.map((entry, index) => ({
    index,
    number: moveNumberLabel(entry),
    san: entry.san,
    label: entry.label,
    best: entry.best,
    cause: entry.cause,
    hasBest: Boolean(entry.bestMove),
    ghostVisible: Boolean(state.ghost && state.ghost.index === index),
  }));

  return {
    visibility: {
      elo: state.mode !== '2',
      clock: state.mode !== 'p',
      flip: state.mode === '2',
      undo: state.mode === 'p',
    },
    clocks: {
      top: formatClock(state.clocks[topColor]),
      bottom: formatClock(state.clocks[bottomColor]),
      topActive: turn === topColor,
      bottomActive: turn === bottomColor,
    },
    captured: {
      top: {
        ...captured[topColor],
        label: `${sideName(topColor, context)} comió:`,
        pieceColor: opposite(topColor),
        diff: captured[topColor].score - captured[bottomColor].score,
      },
      bottom: {
        ...captured[bottomColor],
        label: `${sideName(bottomColor, context)} comió:`,
        pieceColor: opposite(bottomColor),
        diff: captured[bottomColor].score - captured[topColor].score,
      },
    },
    advantage: {
      percent: clamp(50 + advantage * 5, 0, 100),
      text:
        `Ventaja${state.mode === '2' ? ' blancas' : ''}: ` +
        `${advantage > 0 ? '+' : ''}${advantage.toFixed(1)}`,
    },
    nav: {
      label:
        `${state.viewingPly == null ? total : state.viewingPly} / ${total}` +
        `${state.viewingPly != null ? ' · viendo' : ''}`,
      viewing: state.viewingPly != null,
    },
    result: state.result,
    reportVisible: state.showReport,
    explanation: state.explanation,
    showThreats: state.showThreats,
    moves,
    total,
  };
}

export function buildClockVM({ state, turn, orientation }) {
  const view = orientation || state.view;
  const topColor = opposite(view);
  const bottomColor = view;

  return {
    top: state.mode === 'p' ? '' : `⏱ ${formatClock(state.clocks[topColor])}`,
    bottom: state.mode === 'p' ? '' : `⏱ ${formatClock(state.clocks[bottomColor])}`,
    topActive: turn === topColor,
    bottomActive: turn === bottomColor,
  };
}

export function buildOpeningVM(info) {
  if (!info || !info.current) return { visible: false };

  const outside = info.n > info.hit;
  return {
    visible: true,
    name: info.current.n,
    eco: info.current.e,
    outside,
    detail: outside
      ? `Fuera del libro desde ${Math.floor(info.hit / 2) + 1}${info.hit % 2 ? '...' : '.'} ${info.san}`
      : 'Dentro del libro',
  };
}

/* ====================================================================== */
/* Post-partida                                                           */
/* ====================================================================== */

function pieceRows(entries) {
  const map = {};

  for (const entry of entries) {
    if (!entry.piece) continue;
    const bucket = map[entry.piece] || (map[entry.piece] = { count: 0, sum: 0 });
    bucket.count += 1;
    bucket.sum += entry.analysis?.lossPercent != null
      ? accuracyFromLoss(entry.analysis.lossPercent)
      : typeof entry.acc === 'number'
        ? entry.acc
        : accuracyFromLoss(entry.loss ?? 0);
  }

  return Object.entries(map)
    .map(([piece, bucket]) => ({
      piece,
      count: bucket.count,
      accuracy: bucket.sum / bucket.count,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);
}

export function buildPostGameVM({ state, metrics, lastText }) {
  const bad = metrics.count('Error') + metrics.count('Fallo');

  const verdict = !metrics.n
    ? 'Aún no hay jugadas analizadas'
    : bad >= 3
      ? 'Hubo errores graves varias veces'
      : bad === 0 && metrics.n >= 4
        ? 'Partida muy limpia, sin errores graves'
        : 'Partida con algunos errores';

  const phases = [
    { key: 'ap', name: 'Apertura', value: metrics.ap },
    { key: 'mi', name: 'Medio juego', value: metrics.mi },
    { key: 'fi', name: 'Final', value: metrics.fi },
  ];

  const keyMoments = state.log
    .filter(entry => {
      const label = entry.analysis?.label ?? entry.label;
      return label === 'Error' || label === 'Fallo';
    })
    .sort((a, b) => {
      const lossA = a.analysis?.lossPercent ?? a.loss ?? 0;
      const lossB = b.analysis?.lossPercent ?? b.loss ?? 0;
      return lossB - lossA;
    })
    .slice(0, 3)
    .map(entry => ({ ...entry, number: moveNumberLabel(entry) }));

  const piecePerformance = state.mode === '2'
    ? ['w', 'b'].map(color => ({
      color,
      name: colorName(color),
      rows: pieceRows(state.log.filter(entry => entry.color === color)),
    }))
    : [{ color: state.me, name: null, rows: pieceRows(metrics.mine) }];

  const colors = state.mode === '2' ? ['w', 'b'] : [state.me];
  const table = {
    colors: colors.map(color => ({ color, name: colorName(color) })),
    rows: LABELS.map(label => ({
      label,
      values: colors.map(color => state.stats[color][label] || 0),
    })),
    accuracy: colors.map(color => average(state.stats[color].acc)),
    rating: colors.map(color => ratingFromAccuracy(average(state.stats[color].acc))),
    points: colors.map(color => state.stats[color].pts),
  };

  return {
    verdict,
    accuracy: metrics.acc,
    rating: ratingFromAccuracy(metrics.acc),
    phases,
    keyMoments,
    table,
    lastText,
    piecePerformance,
    series: state.evalHistory,
    log: state.log.map(entry => ({ ...entry, number: moveNumberLabel(entry) })),
  };
}

/* ====================================================================== */
/* Perfil                                                                 */
/* ====================================================================== */

export function buildProfileVM(games) {
  if (!games.length) return { empty: true };

  const now = emaSkillRatings(games);
  const prev = emaSkillRatings(games.slice(0, -1));

  const overall = Math.round(average(Object.values(now)) || 0);
  const prevOverall = games.length > 1 ? Math.round(average(Object.values(prev)) || 0) : null;
  const deltaOverall = prevOverall == null ? null : overall - prevOverall;

  const counts = { W: 0, D: 0, L: 0 };
  for (const game of games) counts[game.res] += 1;

  const skills = SKILL_KEYS.map(key => ({
    key,
    name: SKILL_NAME[key],
    value: now[key] ?? null,
    delta: prev[key] != null && now[key] != null ? Math.round(now[key] - prev[key]) : null,
  }));

  const ratings = games.map(game => game.rating || 200);

  const openingsMap = {};
  for (const game of games) {
    const name = game.on || game.op;
    if (!name) continue;

    const bucket = openingsMap[name] ||
      (openingsMap[name] = { name, n: 0, W: 0, D: 0, L: 0, acc: [] });
    bucket.n += 1;
    bucket[game.res] += 1;
    if (game.opAcc != null) bucket.acc.push(game.opAcc);
  }

  const openings = Object.values(openingsMap)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map(bucket => ({
      name: bucket.name,
      games: bucket.n,
      record: `${bucket.W}/${bucket.D}/${bucket.L}`,
      accuracy: bucket.acc.length ? Math.round(average(bucket.acc)) : null,
    }));

  const pieceMap = {};
  for (const game of games) {
    for (const [piece, value] of Object.entries(game.pc || {})) {
      const bucket = pieceMap[piece] || (pieceMap[piece] = { count: 0, sum: 0 });
      bucket.count += value[1];
      bucket.sum += value[0];
    }
  }

  const pieces = Object.entries(pieceMap)
    .map(([piece, bucket]) => ({
      piece,
      count: bucket.count,
      accuracy: bucket.sum / bucket.count,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  const totals = LABELS.map(label => ({
    label,
    count: games.reduce((sum, game) => sum + ((game.lb && game.lb[label]) || 0), 0),
  }));

  const errorMap = {};
  for (const game of games) {
    for (const [cause, count] of Object.entries(game.cc || {})) {
      errorMap[cause] = (errorMap[cause] || 0) + count;
    }
  }

  const errors = Object.entries(errorMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({ cause, count }));

  const rated = SKILL_KEYS.filter(key => now[key] != null);
  const improved = [...rated]
    .filter(key => prev[key] != null)
    .sort((a, b) => (now[b] - prev[b]) - (now[a] - prev[a]))[0];
  const weakest = [...rated].sort((a, b) => now[a] - now[b])[0];

  const messages = [];
  if (improved && now[improved] - prev[improved] > 0) {
    messages.push(`¡Mejoraste en ${SKILL_NAME[improved]}!`);
  }
  if (weakest && games.length > 1) {
    messages.push(`Ahora enfócate en ${SKILL_NAME[weakest]}: ${SKILL_TIP[weakest]}.`);
  }

  return {
    empty: false,
    total: games.length,
    counts,
    overall,
    deltaOverall,
    skills,
    ratings,
    openings,
    pieces,
    totals,
    errors,
    message: messages.join(' ') || 'Juega más partidas para ver tu evolución.',
  };
}

/* ====================================================================== */
/* Lord                                                                   */
/* ====================================================================== */

export function buildLordVM({ state, log, mode, me, chess, orientation, position }) {
  const options = log
    .map((entry, index) => ({ index, entry }))
    .filter(({ entry }) => mode === '2' || entry.color === me)
    .map(({ index, entry }) => ({
      index,
      label: `${moveNumberLabel(entry)} ${entry.san} · ${entry.label}`,
    }));

  const selected = state.selectedMove == null ? null : log[state.selectedMove];

  const questions = selected
    ? [
      `¿Por qué es mejor ${selected.best || 'la otra jugada'}?`,
      '¿Qué amenaza tenía el rival?',
      '¿Qué plan debí seguir?',
      'Explícamelo más simple',
    ]
    : ['¿Cuál fue mi peor error?', '¿Qué debo mejorar?', 'Resume la partida'];

  const future = state.futures[state.futureIndex] || null;
  let hologram = null;

  if (future) {
    const currentFen = state.plyIndex > 0
      ? future.moves[state.plyIndex - 1].fen
      : future.base;

    hologram = {
      baseBoard: chess.newPosition(future.base).board(),
      currentBoard: chess.newPosition(currentFen).board(),
      lastMove: state.plyIndex > 0
        ? [future.moves[state.plyIndex - 1].from, future.moves[state.plyIndex - 1].to]
        : [],
      color: FUTURE_COLORS[future.type],
      name: future.name,
      type: future.type,
      moves: future.moves,
      plyIndex: state.plyIndex,
      warnings: state.warnings,
      orientation: orientation || 'w',
    };
  }

  return {
    options,
    questions,
    selectedIndex: state.selectedMove,
    selected,
    futures: state.futures,
    futureIndex: state.futureIndex,
    hologram,
    warnings: state.warnings,
    chat: state.chat,
    error: state.error,
    busy: state.busy,
    playing: state.playing,
    baseBoard: position ? position.board() : chess.newPosition().board(),
    orientation: orientation || 'w',
  };
}
