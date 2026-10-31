/**
 * application/lord-service.js
 * Caso de uso: construir el contexto que se envía al entrenador IA y
 * validar los "futuros" que devuelve (líneas legales sobre el tablero).
 */

import { FUTURE_COLORS, colorName } from '../domain/constants.js';
import { moveNumberLabel } from '../domain/notation.js';

export const AI_INSTRUCTIONS = `Eres Lord, entrenador de ajedrez dentro de una app. Responde siempre en español, claro y breve (máximo unas 150 palabras), con jugadas en notación algebraica. Usa solo jugadas legales en la posición dada y no inventes variantes que no puedas comprobar. El análisis del motor de la app es de poca profundidad (3 jugadas) y puede equivocarse: si dudas de su recomendación, dilo con honestidad.

Después de tu explicación añade SIEMPRE, al final, una sola línea con este formato exacto: <<FUTUROS>>[{"nombre":"corto","tipo":"peligro|mejor|alternativa|oportunidad","desde":"antes|despues|actual","jugadas":["Nf3","e5"]}]<<FIN>> con máximo 3 futuros de máximo 6 jugadas (medias jugadas) cada uno, en notación SAN, empezando por el bando al que le toca en la posición de salida y solo con jugadas legales. peligro = amenaza o error que puede ocurrir, mejor = la línea recomendada, alternativa = otra opción, oportunidad = ventaja que podía aprovecharse. desde: antes = posición antes de la jugada del usuario, despues = posición tras su jugada, actual = posición actual de la partida. Si no hay variantes útiles, usa [].`;

export class LordService {
  constructor({ chess, ai }) {
    this.chess = chess;
    this.ai = ai;
  }

  async sample() {
    return this.ai.sample();
  }

  /** Contexto detallado de una jugada concreta. */
  moveContext(entry, { log, mode, me, elo, openingName }) {
    const before = this.chess.positionAt(entry.ply).fen();
    const after = this.chess.positionAt(entry.ply + 1).fen();
    const moveNumber = moveNumberLabel(entry);

    return [
      `Posición antes de la jugada (FEN): ${before}`,
      `Posición después de la jugada (FEN): ${after}`,
      `Jugada del usuario: ${moveNumber} ${entry.san} (${colorName(entry.color)}), etiqueta: ${entry.label}, pérdida aproximada ${(entry.loss / 100).toFixed(1)} peones.`,
      `Mejor jugada según el motor: ${entry.best || 'ninguna distinta'}. Causa detectada: ${entry.cause || 'ninguna'}. Apertura: ${openingName || 'no reconocida'}.`,
      `Justificación básica de la app: ${entry.why || 'no generada'}`,
      `Partida completa (PGN): ${this.chess.position.pgn()}`,
      `ELO configurado del rival: ${elo}.`,
    ].join('\n');
  }

  /** Contexto de la partida completa. */
  gameContext({ log, mode, me, elo, openingName, metrics }) {
    const position = this.chess.position;
    const counts = log
      .filter(entry => mode === '2' || entry.color === me)
      .reduce((acc, entry) => {
        acc[entry.label] = (acc[entry.label] || 0) + 1;
        return acc;
      }, {});

    return [
      `Apertura reconocida: ${openingName || 'ninguna'}.`,
      `Posición actual (FEN): ${position.fen()}`,
      `Partida (PGN): ${position.pgn() || '(sin jugadas)'}`,
      `Etiquetas del usuario: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ') || 'ninguna'}.`,
      `Precisión aproximada: ${metrics.acc == null ? 'sin datos' : metrics.acc.toFixed(1) + '%'}.`,
      `Modo: ${mode}. ELO configurado del rival: ${elo}.`,
    ].join('\n');
  }

  /**
   * Compone los mensajes para el modelo: el primer mensaje del usuario
   * lleva instrucciones + contexto + pregunta.
   */
  composeMessages(chat, context) {
    return chat.map((message, index) => {
      if (index !== 0) return message;
      return {
        role: 'user',
        content: `${AI_INSTRUCTIONS}\n\n${context}\n\nPregunta: ${message.content}`,
      };
    });
  }

  /**
   * Extrae y valida los futuros del texto del modelo.
   * @returns {{futures:Array, warnings:number}}
   */
  parseFutures(text, { entry, position }) {
    const match = /<<FUTUROS>>([\s\S]*?)<<FIN>>/.exec(text);
    let raw = [];

    try {
      if (match) raw = JSON.parse(match[1]);
    } catch {
      raw = [];
    }

    const futures = [];
    let warnings = 0;

    for (const item of (Array.isArray(raw) ? raw : []).slice(0, 3)) {
      try {
        const base = this.resolveBase(item.desde, entry, position);
        const walker = this.chess.newPosition(base);
        const moves = [];
        const planned = (item.jugadas || []).slice(0, 6);

        for (const san of planned) {
          const applied = walker.move(String(san), { sloppy: true });
          if (!applied) break;
          moves.push({
            san: applied.san,
            from: applied.from,
            to: applied.to,
            fen: walker.fen(),
          });
        }

        if (moves.length < planned.length) warnings += 1;

        if (moves.length) {
          futures.push({
            name: String(item.nombre || 'Futuro').slice(0, 30),
            type: FUTURE_COLORS[item.tipo] ? item.tipo : 'alternativa',
            base,
            moves,
          });
        }
      } catch {
        warnings += 1;
      }
    }

    return { futures, warnings };
  }

  resolveBase(from, entry, position) {
    if (from === 'antes' && entry) return this.chess.positionAt(entry.ply).fen();
    if (from === 'despues' && entry) return this.chess.positionAt(entry.ply + 1).fen();
    return position.fen();
  }
}
