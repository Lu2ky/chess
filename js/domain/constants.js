/**
 * domain/constants.js
 * Constantes del dominio ajedrecístico. Sin dependencias de framework,
 * DOM ni almacenamiento: reglas del negocio puras.
 */

export const PIECE_VALUE = Object.freeze({ p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 });
export const PIECE_POINTS = Object.freeze({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 });

/** Glifos con selector de presentación de texto (evita emoji). */
export const PIECE_GLYPH = Object.freeze({
  p: '♟\uFE0E',
  n: '♞\uFE0E',
  b: '♝\uFE0E',
  r: '♜\uFE0E',
  q: '♛\uFE0E',
  k: '♚\uFE0E',
});

export const PIECE_ORDER = 'kqrbnp';
export const CAPTURE_ORDER = 'qrbnp';

export const PIECE_NAME = Object.freeze({
  p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'reina', k: 'rey',
});

export const PIECE_ARTICLE = Object.freeze({
  p: 'un', n: 'un', b: 'un', r: 'una', q: 'una', k: 'un',
});

export const PIECE_TITLE = Object.freeze({
  k: 'Rey', q: 'Dama', r: 'Torre', b: 'Alfil', n: 'Caballo', p: 'Peón',
});

/** Etiquetas de calidad de jugada, de mejor a peor. */
export const LABELS = Object.freeze([
  'Genial', 'Excelente', 'Bueno', 'Libro', 'Inexactitud', 'Error', 'Fallo',
]);

export const LABEL_WEIGHT = Object.freeze({
  Genial: 10,
  Excelente: 5,
  Bueno: 3,
  Libro: 2,
  Inexactitud: -3,
  Error: -8,
  Fallo: -15,
});

export const LABEL_COLOR = Object.freeze({
  Genial: '#1bada6',
  Excelente: '#5c9a2e',
  Bueno: '#7ba05b',
  Libro: '#a88865',
  Inexactitud: '#e0a100',
  Error: '#e8710a',
  Fallo: '#c62828',
});

/** Etiquetas que disparan explicación y "mejor jugada". */
export const MISTAKE_LABELS = Object.freeze(['Inexactitud', 'Error', 'Fallo']);

/** Tramos de ELO para interpolar umbrales (de menor a mayor). */
export const ELO_TIERS = Object.freeze([800, 1200, 1600, 2000, 2400]);

/** Habilidades evaluadas en el perfil. */
export const SKILL_KEYS = Object.freeze(['ap', 'ta', 'es', 'fi', 'ti']);

export const SKILL_NAME = Object.freeze({
  ap: 'Aperturas',
  ta: 'Táctica',
  es: 'Estrategia',
  fi: 'Finales',
  ti: 'Tiempo',
});

export const SKILL_TIP = Object.freeze({
  ap: 'juega las primeras 10 jugadas con calma y desarrolla tus piezas',
  ta: 'busca capturas, jaques y amenazas antes de mover y revisa que no dejes piezas colgando',
  es: 'mejora tu plan en el medio juego: centro, piezas activas y estructura de peones',
  fi: 'practica finales de peones y torres y activa tu rey',
  ti: 'usa Reloj vs motor para gestionar mejor tu tiempo',
});

export const PHASE_NAME = Object.freeze({ a: 'Apertura', m: 'Medio juego', f: 'Final' });

/** Colores de los futuros del holograma. */
export const FUTURE_COLORS = Object.freeze({
  peligro: '#ff5252',
  mejor: '#00e5ff',
  alternativa: '#b388ff',
  oportunidad: '#69f0ae',
});

export const FILES = Object.freeze('abcdefgh'.split(''));
export const RANKS = Object.freeze([8, 7, 6, 5, 4, 3, 2, 1]);

export const opposite = color => (color === 'w' ? 'b' : 'w');
export const colorName = color => (color === 'w' ? 'Blancas' : 'Negras');
