/**
 * controllers/game-controller.js
 * Controlador de la partida. Traduce eventos de las vistas del tablero y
 * del panel de juego en casos de uso, y proyecta el estado del modelo a
 * través de los presentadores. No contiene reglas de ajedrez ni toca
 * directamente el almacenamiento.
 */

import {
  buildBoardVM,
  buildClockVM,
  buildGameVM,
  buildOpeningVM,
  buildPostGameVM,
  buildProfileVM,
} from '../adapters/presenters.js';

export class GameController {
  constructor({
    service,
    model,
    boardView,
    gameView,
    postgameView,
    profileView,
    configModel,
    profileModel,
    onReport,
    onOpenLord,
  }) {
    this.service = service;
    this.model = model;
    this.boardView = boardView;
    this.gameView = gameView;
    this.postgameView = postgameView;
    this.profileView = profileView;
    this.configModel = configModel;
    this.profileModel = profileModel;
    this.onReport = onReport || (() => {});
    this.onOpenLord = onOpenLord || (() => {});

    this.clockTimer = null;
    this.lastTick = Date.now();

    this.bind();
  }

  /* ------------------------------------------------------------------ */
  /* Ciclo de vida                                                       */
  /* ------------------------------------------------------------------ */

  start() {
    this.model.subscribe(() => this.render());

    this.profileView.onClear = () => {
      this.profileModel.clear();
      this.renderProfile();
    };

    this.gameView.applyDefaults(this.configModel.config);
    this.newGame();
    this.startClock();

    // El análisis funciona también con el motor legacy, así que las
    // acciones están disponibles desde el principio.
    this.gameView.setAnalysisButtonsEnabled(true);
  }

  bind() {
    this.boardView.onSelect = square => this.select(square);
    this.boardView.onMove = (from, to) => this.moveTo(from, to);

    this.gameView.on('newGame', () => this.newGame());
    this.gameView.on('flip', () => this.flip());
    this.gameView.on('undo', () => this.undo());
    this.gameView.on('hint', () => this.hint());
    this.gameView.on('threats', () => this.threats());
    this.gameView.on('resign', () => this.resign());
    this.gameView.on('report', () => this.onReport());
    this.gameView.on('navigate', direction => this.navigate(direction));
    this.gameView.on('moveAction', (action, index) => this.moveAction(action, index));
    this.gameView.on('elo', value => this.service.setElo(value));
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  render() {
    const state = this.model.state;

    if (this.configModel.get('flip') && state.mode === '2' && state.viewingPly == null) {
      this.model.syncView(this.service.turn());
    }

    const position = this.service.viewPosition();
    const orientation = state.view;
    const threats = state.showThreats ? this.service.threats() : [];

    this.boardView.render(
      buildBoardVM({
        state,
        position,
        threats,
        legalTargets: square => this.service.legalTargets(square),
        orientation,
      }),
    );

    this.gameView.render(
      buildGameVM({ state, position, total: this.service.total(), orientation }),
      buildOpeningVM(this.service.openingInfo()),
    );

    this.renderPostGame();
  }

  renderPostGame() {
    const state = this.model.state;

    this.postgameView.render(
      buildPostGameVM({
        state,
        metrics: this.service.metrics(),
        lastText: state.done ? state.result.text : '',
      }),
    );
  }

  renderProfile() {
    this.profileView.render(buildProfileVM(this.profileModel.all()));
  }

  /* ------------------------------------------------------------------ */
  /* Partida                                                             */
  /* ------------------------------------------------------------------ */

  newGame() {
    const options = this.gameView.readNewGameOptions();
    this.service.startGame(options);

    if (options.mode !== '2' && options.me === 'b') {
      this.reply();
    }
  }

  applyDefaults() {
    this.gameView.applyDefaults(this.configModel.config);
    this.newGame();
  }

  flip() {
    this.service.flip();
  }

  select(square) {
    const outcome = this.service.selectSquare(square);
    if (outcome && outcome.move) this.play(outcome.move);
  }

  moveTo(from, to) {
    const outcome = this.service.findMove(from, to);

    if (outcome && outcome.move) this.play(outcome.move);
    else this.render();
  }

  play(move) {
    const gameId = this.model.state.gameId;

    // Deja pintar "Analizando…" antes del cálculo del motor.
    this.model.beginAnalysis();

    // Async play - no more fake setTimeout
    (async () => {
      if (this.model.state.gameId !== gameId) return;

      const outcome = await this.service.playPlayerMove(move);
      if (!outcome || !outcome.needsReply) return;

      if (this.model.state.gameId === gameId) this.reply();
    })();
  }

  reply() {
    const gameId = this.model.state.gameId;
    this.model.setBusy(true);

    setTimeout(() => {
      if (this.model.state.gameId !== gameId) return;

      Promise.resolve(this.service.playEngineMove()).catch(error => {
        console.error('No se pudo jugar la respuesta del motor:', error);
        this.model.setBusy(false);
      });
    }, 30);
  }

  undo() {
    if (!this.service.undo()) return;
    this.model.setExplanation('');
  }

  hint() {
    this.service.hint().catch(error => {
      console.error('No se pudo calcular la pista:', error);
    });
  }

  threats() {
    this.service.toggleThreats();
  }

  resign() {
    this.service.resign();
  }

  navigate(direction) {
    this.model.setExplanation('');
    this.service.navigate(direction);
  }

  moveAction(action, index) {
    const state = this.model.state;
    const entry = state.log[index];
    if (!entry) return;

    switch (action) {
      case 'go':
        this.model.setExplanation('');
        this.service.goToPly(entry.ply + 1);
        break;

      case 'show':
        if (state.ghost && state.ghost.index === index) {
          this.model.setGhost(null);
          this.model.setViewingPly(null);
        } else if (entry.bestMove) {
          this.model.setViewingPly(entry.ply);
          this.model.setGhost({
            from: entry.bestMove.from,
            to: entry.bestMove.to,
            piece: entry.bestMove.piece,
            index,
          });
        }
        break;

      case 'why':
        this.model.setExplanation(this.service.justify(index));
        break;

      case 'lord':
        this.onOpenLord(index);
        break;

      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Reloj                                                               */
  /* ------------------------------------------------------------------ */

  startClock() {
    this.lastTick = Date.now();

    this.clockTimer = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;

      const state = this.model.state;
      if (!state.clockOn || state.ended) return;

      const expired = this.service.tick(dt);
      if (expired) return;

      this.gameView.renderClocks(
        buildClockVM({
          state,
          turn: this.service.turn(),
          orientation: state.view,
        }),
      );
    }, 200);
  }
}
