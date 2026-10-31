/**
 * view/postgame-view.js
 * Vista del informe post-partida: cabecera, fases, gráfica de evolución,
 * rendimiento por pieza, tabla de etiquetas y momentos clave.
 */

import { LABEL_COLOR, PIECE_GLYPH, PIECE_NAME } from '../domain/constants.js';

const escape = text =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const percent = value => (value == null ? '—' : `${value.toFixed(0)}%`);
const decimal = value => (value == null ? '—' : `${value.toFixed(1)}%`);

export class PostgameView {
  constructor() {
    this.header = document.getElementById('hd');
    this.chart = document.getElementById('gr');
    this.tooltip = document.getElementById('gtip');
    this.chartCard = document.getElementById('gc');
    this.phases = document.getElementById('phs');
    this.pieces = document.getElementById('pcs');
    this.table = document.getElementById('stt');
    this.moments = document.getElementById('km');

    this.vm = null;
    this.onGoto = null;
    this.timer = null;
    this.held = false;
    this.tap = { index: -1, count: 0, time: 0 };
    this.hideTimer = null;

    this.bind();
  }

  bind() {
    this.chart.addEventListener('pointerdown', event => {
      this.held = false;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.held = true;
        this.showTooltip(event, this.detail(event));
      }, 400);
    });

    this.chart.addEventListener('pointermove', event => {
      if (this.held) this.showTooltip(event, this.detail(event));
    });

    const end = () => {
      clearTimeout(this.timer);
      if (this.held) {
        this.tooltip.style.display = 'none';
        this.held = false;
      }
    };

    this.chart.addEventListener('pointercancel', end);
    this.chart.addEventListener('pointerleave', end);
    this.chart.addEventListener('contextmenu', event => event.preventDefault());

    this.chart.addEventListener('pointerup', event => {
      clearTimeout(this.timer);

      if (this.held) {
        end();
        return;
      }

      const circle = this.circleAt(event);
      if (!circle) {
        this.tap.count = 0;
        return;
      }

      const index = Number(circle.dataset.li);
      const now = Date.now();
      this.tap = this.tap.index === index && now - this.tap.time < 700
        ? { index, count: this.tap.count + 1, time: now }
        : { index, count: 1, time: now };

      if (this.tap.count >= 4) {
        this.tap.count = 0;
        this.tooltip.style.display = 'none';
        if (this.onGoto) this.onGoto(index);
        return;
      }

      const missing = 4 - this.tap.count;
      this.showTooltip(
        event,
        `Toca ${missing} ${missing === 1 ? 'vez más' : 'veces más'} para ir a la jugada`,
      );

      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        if (!this.held) this.tooltip.style.display = 'none';
      }, 800);
    });
  }

  render(vm) {
    this.vm = vm;

    this.header.innerHTML =
      `<b>${vm.lastText ? `${escape(vm.lastText)}. ` : ''}${escape(vm.verdict)}.</b><br>` +
      `Precisión: <b>${vm.accuracy == null ? '—' : `${vm.accuracy.toFixed(1)}%`}</b> · ` +
      `Puntuación est.: <b>${vm.rating ?? '—'}</b>`;

    this.phases.innerHTML = vm.phases
      .map(phase =>
        `${escape(phase.name)}: <b>${percent(phase.value)}</b>` +
        `<div class="pb"><i style="width:${phase.value || 0}%"></i></div>`,
      )
      .join('');

    this.renderChart(vm);
    this.renderPieces(vm);
    this.renderTable(vm);
    this.renderMoments(vm);
  }

  renderChart(vm) {
    const series = vm.series && vm.series.length ? vm.series : [0];
    const n = Math.max(series.length - 1, 12);
    const X = index => 10 + (index / n) * 280;
    const Y = value => 50 - (Math.max(-8, Math.min(8, value)) / 8) * 44;

    const points = series
      .map((value, index) => `${X(index).toFixed(1)},${Y(value).toFixed(1)}`)
      .join(' ');

    const dots = vm.log.map((entry, index) => {
      const cx = X(entry.ply + 1).toFixed(1);
      const cy = Y(series[entry.ply + 1] ?? 0).toFixed(1);
      return (
        `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${LABEL_COLOR[entry.label]}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="9" fill="transparent" data-li="${index}" style="cursor:pointer"/>`
      );
    }).join('');

    this.chart.innerHTML =
      '<svg viewBox="0 0 300 100" width="100%">' +
      '<rect x="10" y="3" width="280" height="47" fill="#fff" opacity=".15"/>' +
      '<rect x="10" y="50" width="280" height="47" fill="#000" opacity=".3"/>' +
      '<line x1="10" x2="290" y1="50" y2="50" stroke="currentColor" opacity=".4"/>' +
      `<polyline points="${points}" fill="none" stroke="#4a90e2" stroke-width="2"/>` +
      dots +
      '<text x="12" y="13" font-size="8" fill="currentColor" opacity=".7">Blancas</text>' +
      '<text x="12" y="95" font-size="8" fill="currentColor" opacity=".7">Negras</text>' +
      '</svg>';
  }

  renderPieces(vm) {
    const block = section => {
      const title = section.name ? `<b>${escape(section.name)}</b><br>` : '';
      return title + this.pieceRows(section.rows);
    };

    this.pieces.innerHTML =
      '<b>Rendimiento por pieza</b> <small>(precisión al mover cada pieza)</small><br>' +
      vm.piecePerformance.map(block).join('<br>');
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

  renderTable(vm) {
    const { table } = vm;
    let html = `<tr><th></th>${table.colors.map(color => `<th>${escape(color.name)}</th>`).join('')}</tr>`;

    html += table.rows.map(row => {
      const values = row.values.map(value => `<td>${value}</td>`).join('');
      return `<tr><td><span class="tag ${escape(row.label)}">${escape(row.label)}</span></td>${values}</tr>`;
    }).join('');

    html += `<tr><td>Precisión</td>${table.accuracy.map(value => `<td>${decimal(value)}</td>`).join('')}</tr>`;
    html += `<tr><td>Puntuación est.</td>${table.rating.map(value => `<td>${value ?? '—'}</td>`).join('')}</tr>`;
    html += `<tr><td>Puntos</td>${table.points.map(value => `<td>${value}</td>`).join('')}</tr>`;

    this.table.innerHTML = html;
  }

  renderMoments(vm) {
    this.moments.innerHTML = '<b>Momentos clave</b><br>' + (
      vm.keyMoments.length
        ? vm.keyMoments.map(entry =>
          `${escape(entry.number)} ${escape(entry.san)} ` +
          `<span class="tag ${escape(entry.label)}">${escape(entry.label)}</span> ` +
          `−${(entry.loss / 100).toFixed(1)}${entry.cause ? ` · ${escape(entry.cause)}` : ''}`,
        ).join('<br>')
        : 'Ninguno todavía'
    );
  }

  circleAt(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    return element && element.closest ? element.closest('[data-li]') : null;
  }

  detail(event) {
    const circle = this.circleAt(event);
    if (circle && this.vm) {
      const entry = this.vm.log[Number(circle.dataset.li)];
      if (entry) {
        return (
          `<b>${escape(entry.number)} ${escape(entry.san)}</b> · ${escape(entry.label)}<br>` +
          `Puntuación perdida: −${(entry.loss / 100).toFixed(1)}` +
          `${entry.best ? ` · mejor: ${escape(entry.best)}` : ''}`
        );
      }
    }

    if (!this.vm) return '';

    const svg = this.chart.querySelector('svg');
    if (!svg) return '';

    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 300;
    const n = Math.max(this.vm.series.length - 1, 12);
    const index = Math.max(0, Math.min(this.vm.series.length - 1, Math.round(((x - 10) / 280) * n)));
    const entry = this.vm.log.find(item => item.ply + 1 === index);

    return (
      `<b>${index ? `Jugada ${index}` : 'Inicio'}</b><br>` +
      `Ventaja: ${this.vm.series[index] > 0 ? '+' : ''}${this.vm.series[index].toFixed(1)}` +
      `${entry ? `<br>${escape(entry.label)} · −${(entry.loss / 100).toFixed(1)}` : ''}`
    );
  }

  showTooltip(event, html) {
    if (!html) return;

    this.tooltip.innerHTML = html;
    this.tooltip.style.display = 'block';

    const rect = this.chartCard.getBoundingClientRect();
    const width = this.tooltip.offsetWidth;

    this.tooltip.style.left =
      `${Math.max(4, Math.min(rect.width - width - 4, event.clientX - rect.left - width / 2))}px`;
    this.tooltip.style.top =
      `${Math.max(0, event.clientY - rect.top - this.tooltip.offsetHeight - 24)}px`;
  }
}
