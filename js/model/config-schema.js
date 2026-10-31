/**
 * model/config-schema.js
 * Esquema de la configuración de la aplicación: valores de fábrica,
 * paletas y secciones del panel de ajustes. Es un dato del modelo; la
 * vista solo lo consume para construir controles.
 */

export const DEFAULT_CONFIG = Object.freeze({
  lc: '#f0d9b5',
  dc: '#b58863',
  hl: '#ffeb3b',
  ac: '#2e7d32',
  co: true,
  mvd: true,
  wc: '#ffffff',
  bc: '#111111',
  wo: '#000000',
  bo: '#000000',
  sh: true,
  ps: 100,
  th: 'auto',
  fz: 16,
  cp: false,
  bar: true,
  cap: true,
  lst: true,
  opn: true,
  snd: false,
  vib: true,
  hold: 200,
  flip: false,
  d_elo: 1200,
  d_col: 'w',
  d_mode: 'p',
  d_tm: 5,
  d_inc: 0,
  bst: 'soft',
  bacc: true,
  bcol: '#2e7d32',
  brad: 10,
  bpad: 100,
  bsh: false,
  bbold: true,
  sp: {},
});

/** Paletas de tablero: [nombre, casilla clara, casilla oscura]. */
export const BOARD_THEMES = Object.freeze([
  ['Clásico', '#f0d9b5', '#b58863'],
  ['Verde', '#eeeed2', '#769656'],
  ['Azul', '#dee3e6', '#8ca2ad'],
  ['Gris', '#e0e0e0', '#8a8a8a'],
  ['Madera', '#e8c99b', '#a0673c'],
  ['Rosa', '#f7dfe6', '#d27a9a'],
  ['Noche', '#6b7a8f', '#2f3b4c'],
  ['Neón', '#2b2b3d', '#0f0f1a'],
]);

/** Paletas de piezas: [nombre, blancas, negras, contorno B, contorno N]. */
export const PIECE_THEMES = Object.freeze([
  ['Clásico', '#ffffff', '#111111', '#000000', '#000000'],
  ['Marfil/Ébano', '#fff3d6', '#2a1a0a', '#5a4020', '#000000'],
  ['Oro/Plata', '#ffd54a', '#c0c7d0', '#5c4300', '#2b2f36'],
  ['Rojo/Azul', '#ff5a5a', '#4a7dff', '#5c0000', '#001a5c'],
  ['Neón', '#00ffd0', '#ff4dd2', '#003d33', '#4d0040'],
]);

/**
 * Secciones del panel de ajustes.
 * Cada control: [tipo, clave, etiqueta, ...args]
 *   tipo 't' checkbox · 'c' color · 'r' rango · 's' select
 */
export const SETTINGS_SECTIONS = Object.freeze([
  ['Tablero', [
    ['t', 'co', 'Mostrar coordenadas'],
    ['t', 'mvd', 'Puntos de jugadas legales'],
    ['c', 'lc', 'Casillas claras'],
    ['c', 'dc', 'Casillas oscuras'],
    ['c', 'hl', 'Resaltado de última jugada'],
    ['c', 'ac', 'Color de acento y selección'],
  ], 'pb'],
  ['Piezas', [
    ['c', 'wc', 'Piezas blancas'],
    ['c', 'bc', 'Piezas negras'],
    ['t', 'sh', 'Contorno de piezas'],
    ['c', 'wo', 'Contorno de blancas'],
    ['c', 'bo', 'Contorno de negras'],
    ['r', 'ps', 'Tamaño de piezas', 50, 130, 5, '%'],
  ], 'pp'],
  ['Interfaz', [
    ['s', 'th', 'Tema', [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']]],
    ['r', 'fz', 'Tamaño de texto', 12, 22, 1, 'px'],
    ['t', 'cp', 'Modo compacto'],
    ['t', 'bar', 'Barra de ventaja'],
    ['t', 'cap', 'Piezas capturadas'],
    ['t', 'lst', 'Lista de jugadas'],
    ['t', 'opn', 'Tarjeta de apertura'],
  ]],
  ['Botones', [
    ['s', 'bst', 'Estilo', [['soft', 'Suave'], ['solid', 'Sólido'], ['outline', 'Contorno'], ['glass', 'Cristal'], ['3d', 'Relieve 3D']]],
    ['t', 'bacc', 'Usar el color de acento'],
    ['c', 'bcol', 'Color de botones'],
    ['r', 'brad', 'Redondeo', 0, 24, 1, 'px'],
    ['r', 'bpad', 'Tamaño', 70, 160, 5, '%'],
    ['t', 'bsh', 'Sombra'],
    ['t', 'bbold', 'Texto en negrita'],
  ]],
  ['Juego', [
    ['t', 'snd', 'Sonidos'],
    ['t', 'vib', 'Vibrar al agarrar una pieza'],
    ['r', 'hold', 'Espera para agarrar (táctil)', 0, 500, 50, 'ms'],
    ['t', 'flip', 'Girar el tablero cada turno (2 jugadores)'],
    ['r', 'd_elo', 'ELO inicial', 200, 3000, 50, ''],
    ['s', 'd_col', 'Color inicial', [['w', 'Blancas'], ['b', 'Negras']]],
    ['s', 'd_mode', 'Modo inicial', [['p', 'Práctica'], ['t', 'Reloj vs motor'], ['2', '2 jugadores']]],
    ['r', 'd_tm', 'Minutos por bando', 1, 60, 1, ' min'],
    ['r', 'd_inc', 'Incremento', 0, 30, 1, ' s'],
  ]],
]);
