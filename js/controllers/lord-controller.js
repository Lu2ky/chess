/**
 * controllers/lord-controller.js
 * Controlador del entrenador Lord: gestiona la conversación con el
 * modelo IA, valida los futuros y reproduce el holograma. Orquesta el
 * servicio de aplicación y el modelo de chat; no toca el DOM.
 */

import { buildLordVM } from '../adapters/presenters.js';

export class LordController {
  constructor({ service, model, view, gameService, gameModel }) {
    this.service = service;
    this.model = model;
    this.view = view;
    this.gameService = gameService;
    this.gameModel = gameModel;

    this.playbackTimer = null;

    this.bind();
  }

  start() {
    this.model.subscribe(() => this.render());
  }

  bind() {
    this.view.on('send', text => this.send(text));
    this.view.on('selectMove', index => this.open(index));
    this.view.on('future', index => this.model.selectFuture(index));
    this.view.on('futureNav', direction => this.futureNav(direction));
  }

  /* ------------------------------------------------------------------ */
  /* Sesión                                                              */
  /* ------------------------------------------------------------------ */

  open(index) {
    this.stopPlayback();
    this.model.startSession(index);
  }

  render() {
    const gameState = this.gameModel.state;
    const lordState = this.model.state;
    const entry = lordState.selectedMove == null
      ? null
      : gameState.log[lordState.selectedMove];

    const position = entry
      ? this.gameService.chess.positionAt(entry.ply)
      : this.gameService.viewPosition();

    this.view.render(
      buildLordVM({
        state: lordState,
        log: gameState.log,
        mode: gameState.mode,
        me: gameState.me,
        chess: this.gameService.chess,
        orientation: gameState.view,
        position,
      }),
    );
  }

  /* ------------------------------------------------------------------ */
  /* Conversación                                                        */
  /* ------------------------------------------------------------------ */

  async send(rawQuestion) {
    const question = String(rawQuestion || '').trim();
    if (!question || this.model.state.busy) return;

    const sample = await this.service.sample();
    if (!sample) {
      this.model.addMessage('assistant', 'Lord no está disponible en esta vista.');
      return;
    }

    const gameState = this.gameModel.state;
    const lordState = this.model.state;
    const entry = lordState.selectedMove == null
      ? null
      : gameState.log[lordState.selectedMove];

    const context = entry
      ? this.service.moveContext(
        { ...entry, why: this.gameService.justify(lordState.selectedMove) },
        {
          log: gameState.log,
          mode: gameState.mode,
          me: gameState.me,
          elo: gameState.elo,
          openingName: this.gameService.openingName(),
        },
      )
      : this.service.gameContext({
        log: gameState.log,
        mode: gameState.mode,
        me: gameState.me,
        elo: gameState.elo,
        openingName: this.gameService.openingName(),
        metrics: this.gameService.metrics(),
      });

    this.model.setError(null);
    this.model.addMessage('user', question);

    const messages = this.service.composeMessages(this.model.state.chat, context);

    this.model.setBusy(true);
    this.model.addMessage('assistant', 'Lord está pensando…');

    try {
      const result = await sample(messages, {
        cache: false,
        onText: update => {
          if (update && update.text) {
            this.model.replaceLastMessage(update.text.split('<<FUTUROS>>')[0].trim());
          }
        },
      });

      this.model.replaceLastMessage(result.text);

      const { futures, warnings } = this.service.parseFutures(result.text, {
        entry,
        position: this.gameService.chess.position,
      });

      this.model.setFutures(futures, warnings);
    } catch (error) {
      // Quita el "pensando" y la pregunta fallida para no contaminar
      // el historial de la siguiente consulta.
      this.model.popMessage();
      this.model.popMessage();
      this.model.setError(this.errorMessage(error));
    } finally {
      this.model.setBusy(false);
    }
  }

  errorMessage(error) {
    if (error && error.code === 'rate_limited') {
      return 'Demasiadas preguntas seguidas. Espera un momento.';
    }
    if (error && error.code === 'not_granted') {
      return 'No diste permiso para usar Lord.';
    }
    return 'No pude responder. Inténtalo otra vez.';
  }

  /* ------------------------------------------------------------------ */
  /* Holograma                                                           */
  /* ------------------------------------------------------------------ */

  futureNav(direction) {
    const state = this.model.state;
    const future = state.futures[state.futureIndex];
    if (!future) return;

    if (direction === 'p') {
      if (this.playbackTimer) {
        this.stopPlayback();
        return;
      }

      if (state.plyIndex >= future.moves.length) this.model.setPlyIndex(0);
      this.model.setPlaying(true);

      this.playbackTimer = setInterval(() => {
        const current = this.model.state;
        const active = current.futures[current.futureIndex];

        if (!active || current.plyIndex >= active.moves.length) {
          this.stopPlayback();
          return;
        }

        this.model.setPlyIndex(current.plyIndex + 1);
      }, 900);

      return;
    }

    this.stopPlayback();

    const target = direction === 's'
      ? 0
      : direction === 'b'
        ? Math.max(0, state.plyIndex - 1)
        : Math.min(future.moves.length, state.plyIndex + 1);

    this.model.setPlyIndex(target);
  }

  stopPlayback() {
    clearInterval(this.playbackTimer);
    this.playbackTimer = null;

    if (this.model.state.playing) this.model.setPlaying(false);
  }
}
