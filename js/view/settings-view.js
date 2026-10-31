/**
 * view/settings-view.js
 * Vista del panel de ajustes. Construye el formulario a partir del
 * esquema, aplica la configuración al árbol DOM (variables CSS y clases)
 * y comunica cada cambio al controlador. No persiste nada.
 */

import { PIECE_GLYPH, PIECE_ORDER, PIECE_TITLE } from '../domain/constants.js';

const escape = text =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));

const shade = (hex, factor) =>
  '#' + rgb(hex)
    .map(value => Math.max(0, Math.round(value * factor)).toString(16).padStart(2, '0'))
    .join('');

const luminance = hex => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

export class SettingsView {
  constructor({ root, sections, boardThemes, pieceThemes }) {
    this.root = root;
    this.sections = sections;
    this.boardThemes = boardThemes;
    this.pieceThemes = pieceThemes;
    this.config = null;
    this.presets = [];
    this.callbacks = {};
    this.bind();
  }

  on(name, callback) {
    this.callbacks[name] = callback;
  }

  emit(name, ...args) {
    if (this.callbacks[name]) this.callbacks[name](...args);
  }

  bind() {
    this.root.addEventListener('input', event => this.handleInput(event));
    this.root.addEventListener('change', event => this.handleInput(event));
    this.root.addEventListener('click', event => this.handleClick(event));

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.root.classList.contains('open')) {
        this.emit('action', 'close');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Construcción del formulario                                        */
  /* ------------------------------------------------------------------ */

  control([type, key, label, a, b, c, unit]) {
    const config = this.config;

    if (type === 'c') {
      return `<label>${escape(label)}<input type="color" data-k="${key}" value="${config[key]}"></label>`;
    }

    if (type === 't') {
      return `<label>${escape(label)}<input type="checkbox" data-k="${key}" ${config[key] ? 'checked' : ''}></label>`;
    }

    if (type === 'r') {
      return (
        `<label>${escape(label)}<span><input type="range" data-k="${key}" ` +
        `min="${a}" max="${b}" step="${c}" value="${config[key]}"> ` +
        `<b data-u="${unit}">${config[key]}${unit}</b></span></label>`
      );
    }

    return (
      `<label>${escape(label)}<select data-k="${key}">` +
      a.map(([value, name]) =>
        `<option value="${value}" ${config[key] === value ? 'selected' : ''}>${escape(name)}</option>`,
      ).join('') +
      '</select></label>'
    );
  }

  palette(type, themes) {
    return '<div class="pr">' + themes.map((theme, index) => {
      const background = type === 'pb'
        ? `linear-gradient(90deg,${theme[1]} 50%,${theme[2]} 50%)`
        : `linear-gradient(90deg,${theme[1]} 50%,${theme[2]} 50%)`;
      return (
        `<button class="mini" data-${type}="${index}" style="background:${background}">` +
        `${escape(theme[0])}</button>`
      );
    }).join('') + '</div>';
  }

  spritesHtml() {
    const config = this.config;

    return ['w', 'b'].map(color => {
      const title = color === 'w' ? 'Blancas' : 'Negras';

      return `<b>${title}</b><div class="g">` + PIECE_ORDER.split('').map(type => {
        const key = color + type;
        const sprite = config.sp[key];

        return (
          '<div><div class="pv">' +
          (sprite
            ? `<img src="${sprite}">`
            : `<span class="${color}">${PIECE_GLYPH[type]}</span>`) +
          '</div><div class="pb2">' +
          `<label style="margin:0;cursor:pointer">⬆<input type="file" accept="image/*" data-sp="${key}" hidden></label>` +
          (sprite ? `<span data-cl="${key}">✕</span>` : '') +
          `</div><small>${PIECE_TITLE[type]}</small></div>`
        );
      }).join('') + '</div>';
    }).join('') +
      '<div class="row">' +
      '<button class="mini" data-cp="wb">Copiar blancas → negras</button>' +
      '<button class="mini" data-cp="bw">Negras → blancas</button>' +
      '<button class="mini" data-x="clall">Quitar todos</button>' +
      '</div>';
  }

  presetsHtml() {
    if (!this.presets.length) return '<small>Aún no hay ajustes guardados</small>';

    return this.presets.map((preset, index) =>
      '<div class="row" style="justify-content:space-between">' +
      `<span>${escape(preset.n)}</span>` +
      `<span><button class="mini" data-ld="${index}">Cargar</button>` +
      `<button class="mini" data-dl="${index}">🗑</button></span></div>`,
    ).join('');
  }

  render(config, presets, status) {
    this.config = config;
    this.presets = presets || [];

    const sections = this.sections.map(([name, items, extra], index) => {
      const palette =
        extra === 'pb' ? this.palette('pb', this.boardThemes)
          : extra === 'pp' ? this.palette('pp', this.pieceThemes)
            : '';

      return (
        `<details ${index === 0 ? 'open' : ''}><summary>${escape(name)}</summary>` +
        palette +
        items.map(item => this.control(item)).join('') +
        '</details>'
      );
    }).join('');

    this.root.innerHTML =
      '<div class="hd">' +
      '<b style="font-size:18px">⚙ Ajustes</b>' +
      '<span id="sdi" style="font-size:12px;opacity:.8"></span>' +
      '<span><button data-x="save">💾 Guardar</button> <button data-x="close">✕</button></span>' +
      '<div id="sbar" style="flex-basis:100%"></div>' +
      '</div>' +
      sections +
      '<details><summary>Sprites de piezas</summary>' +
      '<small>Sube una imagen por pieza (PNG con fondo transparente queda mejor). Se guardan en este navegador.</small>' +
      `<div id="spg">${this.spritesHtml()}</div></details>` +
      '<details><summary>Mis ajustes guardados</summary>' +
      '<small>Guarda varias configuraciones con nombre y cárgalas cuando quieras.</small>' +
      '<div class="row" style="margin-top:6px">' +
      '<input id="spn" placeholder="Nombre" style="flex:1;min-width:0;padding:6px">' +
      '<button data-x="pnew">Guardar como…</button></div>' +
      `<div id="spl">${this.presetsHtml()}</div></details>` +
      '<details><summary>Datos</summary>' +
      '<div class="row"><button data-x="setdef">Fijar estos ajustes como predeterminados</button></div>' +
      '<div class="row"><button data-x="reset">Restablecer a mis predeterminados</button>' +
      '<button data-x="fact">De fábrica</button></div>' +
      '<div class="row"><button data-x="newg">Aplicar valores iniciales y nueva partida</button></div>' +
      '<div class="row"><button data-x="exp">Exportar</button><button data-x="imp">Importar</button></div>' +
      '<textarea id="spj" rows="4" style="width:100%" placeholder="Aquí aparece el JSON; pega uno y pulsa Importar"></textarea>' +
      '<small id="spm"></small></details>';

    this.root.style.display = 'block';
    this.root.classList.add('open');
    this.setStatus(status);
  }

  open(config, presets, status) {
    this.render(config, presets, status);
  }

  close() {
    this.root.classList.remove('open');
    this.root.style.display = 'none';
  }

  /* ------------------------------------------------------------------ */
  /* Aplicación visual (equivalente al antiguo ap())                    */
  /* ------------------------------------------------------------------ */

  apply(config) {
    const root = document.documentElement;
    const style = root.style;
    const set = (key, value) => style.setProperty(key, value);

    set('--l', config.lc);
    set('--d', config.dc);
    set('--wc', config.wc);
    set('--bc', config.bc);
    set('--wo', config.sh ? config.wo : 'transparent');
    set('--bo', config.sh ? config.bo : 'transparent');
    set('--ac', config.ac);
    set('--ad', `${config.ac}99`);
    set('--hl', `${config.hl}66`);
    set('--ps', String(config.ps / 100));
    set('--fz', `${config.fz}px`);

    if (config.th === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', config.th);

    const base = config.bacc ? config.ac : config.bcol;
    const kind = config.bst;
    let background;
    let foreground = 'var(--fg)';
    let border;

    if (kind === 'solid' || kind === '3d') {
      background = base;
      foreground = luminance(base) > 0.6 ? '#111' : '#fff';
      border = 'transparent';
    } else if (kind === 'outline') {
      background = 'transparent';
      foreground = base;
      border = base;
    } else {
      background = `${base}${kind === 'glass' ? '22' : '2e'}`;
      border = `${base}66`;
    }

    const shadows = [];
    if (kind === '3d') shadows.push(`0 4px 0 ${shade(base, 0.6)}`);
    if (config.bsh) shadows.push('0 3px 8px #0004');

    set('--bbg', background);
    set('--bfg', foreground);
    set('--bbd', border);
    set('--br', `${config.brad}px`);
    set('--bpy', `${(7 * config.bpad) / 100}px`);
    set('--bpx', `${(12 * config.bpad) / 100}px`);
    set('--bfs', String(config.bpad / 100));
    set('--bsh', shadows.join(',') || 'none');
    set('--bfw', config.bbold ? '700' : '500');

    root.classList.toggle('bgl', kind === 'glass');

    [
      ['nb', !config.bar],
      ['nc', !config.cap],
      ['nl', !config.lst],
      ['no', !config.opn],
      ['nco', !config.co],
      ['nm', !config.mvd],
      ['npm', !config.mov],
      ['cp', config.cp],
    ].forEach(([name, value]) => root.classList.toggle(name, Boolean(value)));
  }

  updateValues(config) {
    this.config = config;

    for (const input of this.root.querySelectorAll('[data-k]')) {
      const key = input.dataset.k;

      if (input.type === 'checkbox') input.checked = Boolean(config[key]);
      else input.value = config[key];

      if (input.type === 'range') {
        const output = input.parentNode.querySelector('b');
        if (output) output.textContent = `${config[key]}${output.dataset.u || ''}`;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                            */
  /* ------------------------------------------------------------------ */

  handleInput(event) {
    const target = event.target;

    if (target.dataset && target.dataset.sp) {
      if (event.type !== 'change') return;
      const file = target.files && target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const size = 160;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;

          const width = image.width || size;
          const height = image.height || size;
          const scale = Math.min(size / width, size / height);

          canvas.getContext('2d').drawImage(
            image,
            (size - width * scale) / 2,
            (size - height * scale) / 2,
            width * scale,
            height * scale,
          );

          this.emit('sprite', target.dataset.sp, canvas.toDataURL('image/png'));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
      target.value = '';
      return;
    }

    if (!target.dataset || !target.dataset.k) return;

    if (event.type === 'change' && target.type !== 'select-one') return;
    if (event.type === 'input' && target.type === 'select-one') return;

    const key = target.dataset.k;
    const value = target.type === 'checkbox'
      ? target.checked
      : target.type === 'range'
        ? Number(target.value)
        : target.value;

    if (target.type === 'range') {
      const output = target.parentNode.querySelector('b');
      if (output) output.textContent = `${value}${output.dataset.u || ''}`;
    }

    this.emit('change', key, value);
  }

  handleClick(event) {
    const target = event.target.closest('button,[data-cl]');
    if (!target) return;

    const data = target.dataset;

    if (data.cl) {
      this.emit('removeSprite', data.cl);
      return;
    }
    if (data.pb != null) {
      this.emit('palette', 'pb', Number(data.pb));
      return;
    }
    if (data.pp != null) {
      this.emit('palette', 'pp', Number(data.pp));
      return;
    }
    if (data.cp) {
      this.emit('copySprites', data.cp[0], data.cp[1]);
      return;
    }
    if (data.ld != null) {
      this.emit('loadPreset', Number(data.ld));
      return;
    }
    if (data.dl != null) {
      this.emit('deletePreset', Number(data.dl));
      return;
    }
    if (data.x) {
      this.emit('action', data.x);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Utilidades del modal                                               */
  /* ------------------------------------------------------------------ */

  setStatus(text) {
    const element = document.getElementById('sdi');
    if (element) element.textContent = text || '';
  }

  setMessage(text) {
    const element = document.getElementById('spm');
    if (element) element.textContent = text || '';
  }

  setJSON(text) {
    const element = document.getElementById('spj');
    if (element) element.value = text || '';
  }

  readJSON() {
    const element = document.getElementById('spj');
    return element ? element.value : '';
  }

  readPresetName() {
    const element = document.getElementById('spn');
    return element ? element.value : '';
  }

  confirmClose() {
    const bar = document.getElementById('sbar');
    if (!bar) return;

    bar.innerHTML =
      '<div class="card">Hay cambios sin guardar. ' +
      '<button data-x="sv2">Guardar y cerrar</button> ' +
      '<button data-x="dis">Descartar</button> ' +
      '<button data-x="keep">Seguir editando</button></div>';
  }

  hideBar() {
    const bar = document.getElementById('sbar');
    if (bar) bar.innerHTML = '';
  }

  refreshPresets(presets) {
    this.presets = presets;
    const list = document.getElementById('spl');
    if (list) list.innerHTML = this.presetsHtml();
  }
}
