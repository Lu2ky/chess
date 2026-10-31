/**
 * view/profile-view.js
 * Vista del perfil: tarjetas de resumen, radar de habilidades, evolución
 * de puntuación, piezas, aperturas, etiquetas y errores frecuentes.
 */

import { PIECE_GLYPH, PIECE_NAME } from '../domain/constants.js';

const escape = text =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class ProfileView {
  constructor() {
    this.root = document.getElementById('tF');
    this.onClear = null;
    this.confirming = false;
    this.bind();
  }

  bind() {
    this.root.addEventListener('click', event => {
      const button = event.target.closest('#clr');
      if (!button) return;

      if (!this.confirming) {
        this.confirming = true;
        button.textContent = '¿Seguro? Pulsa otra vez';
        return;
      }

      this.confirming = false;
      if (this.onClear) this.onClear();
    });
  }

  render(vm) {
    this.confirming = false;

    if (vm.empty) {
      this.root.innerHTML =
        '<div class="card">Aún no hay partidas guardadas. Juega al menos 4 jugadas en ' +
        'Práctica o Reloj vs motor y termina la partida (o ríndete) para ver tu progreso. ' +
        'Se guarda en este navegador.</div>';
      return;
    }

    this.root.innerHTML = [
      this.summaryCard(vm),
      this.skillsCard(vm),
      this.ratingsCard(vm),
      this.piecesCard(vm),
      this.openingsCard(vm),
      this.totalsCard(vm),
      this.errorsCard(vm),
      '<div class="row"><button id="clr">Borrar perfil</button></div>',
    ].join('');
  }

  summaryCard(vm) {
    const { counts } = vm;
    return (
      `<div class="card"><b>${vm.total} partidas</b> · ${counts.W} victorias · ` +
      `${counts.D} tablas · ${counts.L} derrotas` +
      `<div class="wdl">` +
      `<i style="flex:${counts.W} 0 0;background:#4caf50"></i>` +
      `<i style="flex:${counts.D} 0 0;background:#d4b44a"></i>` +
      `<i style="flex:${counts.L} 0 0;background:#e0846a"></i>` +
      `</div></div>`
    );
  }

  skillsCard(vm) {
    return (
      `<div class="card"><b>Habilidades</b> ${this.delta(vm.deltaOverall)}` +
      `${this.radar(vm)}<div>${escape(vm.message)}</div></div>`
    );
  }

  delta(value) {
    if (value == null || Number.isNaN(value)) return '';
    return `<span class="dl ${value < 0 ? 'n' : ''}">${value > 0 ? '+' : ''}${value}</span>`;
  }

  radar(vm) {
    const radius = 62;
    const cx = 150;
    const cy = 120;

    const position = (index, r) => {
      const angle = ((-90 + index * 72) * Math.PI) / 180;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    };

    const scale = value => radius * clamp((value - 200) / 2400, 0.08, 1);

    const points = accessor => vm.skills
      .map((skill, index) => position(index, accessor(skill)).map(value => value.toFixed(1)).join(','))
      .join(' ');

    const rings = [800, 1400, 2000]
      .map(value => `<polygon points="${points(() => scale(value))}" fill="none" stroke="currentColor" opacity=".2"/>`)
      .join('');

    const axes = vm.skills.map((skill, index) => {
      const [x, y] = position(index, radius);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" opacity=".15"/>`;
    }).join('');

    const labels = vm.skills.map((skill, index) => {
      const [x, y] = position(index, radius + 18);
      const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
      const delta = skill.delta;
      const color = delta < 0 ? '#e53935' : '#43a047';
      const deltaText = delta ? `${delta > 0 ? ' +' : ' '}${delta}` : '';

      return (
        `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="10" font-weight="700" ` +
        `text-anchor="${anchor}" fill="currentColor">${escape(skill.name)}</text>` +
        `<text x="${x.toFixed(1)}" y="${(y + 11).toFixed(1)}" font-size="10" ` +
        `text-anchor="${anchor}" fill="currentColor">` +
        `${skill.value == null ? '—' : Math.round(skill.value)}` +
        `<tspan fill="${color}">${deltaText}</tspan></text>`
      );
    }).join('');

    return (
      '<svg viewBox="0 0 300 240" width="100%">' +
      rings +
      axes +
      `<polygon points="${points(skill => scale(skill.value ?? 200))}" fill="#4caf5055" stroke="#2e7d32" stroke-width="2"/>` +
      labels +
      `<text x="${cx}" y="${cy + 5}" font-size="16" font-weight="700" text-anchor="middle" fill="currentColor">${vm.overall}</text>` +
      '</svg>'
    );
  }

  ratingsCard(vm) {
    return `<div class="card"><b>Puntuación por partida</b>${this.sparkline(vm.ratings)}</div>`;
  }

  sparkline(values) {
    if (!values.length) return '';

    const min = Math.min(...values) - 50;
    const max = Math.max(...values) + 50;
    const n = Math.max(values.length - 1, 1);
    const X = index => 10 + (index / n) * 280;
    const Y = value => 90 - ((value - min) / (max - min || 1)) * 80;

    const points = values
      .map((value, index) => `${X(index).toFixed(1)},${Y(value).toFixed(1)}`)
      .join(' ');

    const dots = values
      .map((value, index) => `<circle cx="${X(index).toFixed(1)}" cy="${Y(value).toFixed(1)}" r="3" fill="#4a90e2"/>`)
      .join('');

    return (
      '<svg viewBox="0 0 300 100" width="100%">' +
      `<polyline points="${points}" fill="none" stroke="#4a90e2" stroke-width="2"/>` +
      dots +
      '</svg>'
    );
  }

  piecesCard(vm) {
    return `<div class="card"><b>Rendimiento por pieza</b><br>${this.pieceRows(vm.pieces)}</div>`;
  }

  pieceRows(rows) {
    if (!rows.length) return '<small>Sin datos todavía</small>';

    const big = rows.filter(row => row.count >= 2);
    const pool = big.length >= 2 ? big : rows;
    const best = pool[0];
    const worst = pool[pool.length - 1];

    const summary =
      `<small>Mejor usada: <b>${PIECE_NAME[best.piece]}</b> ${best.accuracy.toFixed(0)}%` +
      `${pool.length > 1 ? ` · Peor usada: <b>${PIECE_NAME[worst.piece]}</b> ${worst.accuracy.toFixed(0)}%` : ''}</small>`;

    return summary + rows.map(row => {
      const color = row.accuracy >= 85 ? '#4caf50' : row.accuracy >= 65 ? '#e0a100' : '#c62828';
      return (
        `<div>${PIECE_GLYPH[row.piece]} ${PIECE_NAME[row.piece]} · ${row.count} jug. · ` +
        `<b>${row.accuracy.toFixed(0)}%</b>` +
        `<div class="pb"><i style="width:${row.accuracy}%;background:${color}"></i></div></div>`
      );
    }).join('');
  }

  openingsCard(vm) {
    const rows = vm.openings.map(opening =>
      `<tr><td>${escape(opening.name)}</td><td>${opening.games}</td>` +
      `<td>${escape(opening.record)}</td>` +
      `<td>${opening.accuracy == null ? '—' : `${opening.accuracy}%`}</td></tr>`,
    ).join('');

    return (
      '<div class="card"><b>Tus aperturas</b><table>' +
      '<tr><th>Apertura</th><th>Part.</th><th>G/T/P</th><th>Prec.</th></tr>' +
      `${rows}</table></div>`
    );
  }

  totalsCard(vm) {
    return (
      '<div class="card"><b>Jugadas totales</b><br>' +
      vm.totals
        .map(item => `<span class="tag ${escape(item.label)}">${escape(item.label)} ${item.count}</span>`)
        .join(' ') +
      '</div>'
    );
  }

  errorsCard(vm) {
    return (
      '<div class="card"><b>Tus errores más comunes</b><br>' +
      (vm.errors.length
        ? vm.errors.map(error => `${escape(error.cause)}: <b>${error.count}</b>`).join('<br>')
        : '<small>Sin datos todavía</small>') +
      '</div>'
    );
  }
}
