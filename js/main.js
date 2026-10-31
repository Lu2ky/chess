/**
 * main.js
 * Raíz de composición: el único lugar donde se instancian adaptadores,
 * modelos, servicios, vistas y controladores, y se conectan entre sí.
 * Las dependencias apuntan hacia dentro (dominio ← aplicación ← adaptadores).
 */

import { ChessGateway } from './adapters/chess-gateway.js';
import { LocalStorageGateway } from './adapters/storage-gateway.js';
import { ClaudeGateway } from './adapters/ai-gateway.js';
import { SoundGateway } from './adapters/sound-gateway.js';
import { createOpeningBook } from './adapters/opening-book.js';

import { GameModel } from './model/game-model.js';
import { ConfigModel } from './model/config-model.js';
import { ProfileModel } from './model/profile-model.js';
import { LordModel } from './model/lord-model.js';
import {
  BOARD_THEMES,
  PIECE_THEMES,
  SETTINGS_SECTIONS,
} from './model/config-schema.js';

import { AnalysisService } from './application/analysis-service.js';
import { OpeningService } from './application/opening-service.js';
import { GameService } from './application/game-service.js';
import { ProfileService } from './application/profile-service.js';
import { LordService } from './application/lord-service.js';

import { TabsView } from './view/tabs-view.js';
import { BoardView } from './view/board-view.js';
import { GameView } from './view/game-view.js';
import { PostgameView } from './view/postgame-view.js';
import { ProfileView } from './view/profile-view.js';
import { LordView } from './view/lord-view.js';
import { SettingsView } from './view/settings-view.js';

import { GameController } from './controllers/game-controller.js';
import { LordController } from './controllers/lord-controller.js';
import { SettingsController } from './controllers/settings-controller.js';
import { AppController } from './controllers/app-controller.js';

function boot() {
  const ChessCtor = window.Chess;

  /* ----------------------------- adaptadores ---------------------------- */
  const storage = new LocalStorageGateway();
  const chess = new ChessGateway(ChessCtor);
  const book = createOpeningBook(ChessCtor);
  const ai = new ClaudeGateway();

  /* ------------------------------- modelos ------------------------------ */
  const configModel = new ConfigModel({ storage });
  const gameModel = new GameModel();
  const profileModel = new ProfileModel({ storage });
  const lordModel = new LordModel();

  const sound = new SoundGateway({
    isEnabled: () => Boolean(configModel.get('snd')),
  });

  /* ----------------------------- aplicación ----------------------------- */
  const analysis = new AnalysisService({ chess });
  const openings = new OpeningService({ book, chess });
  const profileService = new ProfileService({ model: profileModel });

  const gameService = new GameService({
    chess,
    analysis,
    openings,
    book,
    model: gameModel,
    sound,
    profile: profileService,
  });

  const lordService = new LordService({ chess, ai });

  /* -------------------------------- vistas ------------------------------ */
  const tabsView = new TabsView({
    root: document.getElementById('tabs'),
    sections: {
      J: document.getElementById('tJ'),
      P: document.getElementById('tP'),
      F: document.getElementById('tF'),
      L: document.getElementById('tL'),
    },
    fullscreenButton: document.getElementById('fs'),
  });

  const boardView = new BoardView({
    board: document.getElementById('bd'),
    ranks: document.getElementById('rk'),
    files: document.getElementById('fl'),
    getConfig: () => configModel.config,
  });

  const gameView = new GameView();
  const postgameView = new PostgameView();
  const profileView = new ProfileView();
  const lordView = new LordView();

  const settingsView = new SettingsView({
    root: document.getElementById('sp'),
    sections: SETTINGS_SECTIONS,
    boardThemes: BOARD_THEMES,
    pieceThemes: PIECE_THEMES,
  });

  /* ----------------------------- controladores -------------------------- */
  const lordController = new LordController({
    service: lordService,
    model: lordModel,
    view: lordView,
    gameService,
    gameModel,
  });

  const gameController = new GameController({
    service: gameService,
    model: gameModel,
    boardView,
    gameView,
    postgameView,
    profileView,
    configModel,
    profileModel,
    onReport: () => tabsView.show('P'),
    onOpenLord: index => {
      lordController.open(index);
      tabsView.show('L');
    },
  });

  const settingsController = new SettingsController({
    model: configModel,
    view: settingsView,
    onNewGame: () => gameController.applyDefaults(),
    onVisualChange: () => gameController.render(),
  });

  const appController = new AppController({
    tabsView,
    gameController,
    lordController,
    settingsController,
  });

  /* -------------------------------- arranque ---------------------------- */
  settingsController.start();
  gameController.start();
  lordController.start();
  appController.start();

  window.__APP_STARTED__ = true;
}

try {
  boot();
} catch (error) {
  console.error('No se pudo iniciar la aplicación:', error);
}
