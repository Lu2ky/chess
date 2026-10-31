/**
 * controllers/settings-controller.js
 * Controlador del panel de ajustes: traduce eventos de la vista en
 * mutaciones del modelo de configuración y coordina la persistencia.
 */

import { PIECE_ORDER } from '../domain/constants.js';

export class SettingsController {
  constructor({ model, view, onNewGame, onVisualChange }) {
    this.model = model;
    this.view = view;
    this.onNewGame = onNewGame;
    this.onVisualChange = onVisualChange;

    this.bind();
  }

  bind() {
    this.view.on('change', (key, value) => {
      this.model.set(key, value);
      this.view.apply(this.model.config);
      if (key === 'flip') this.notifyVisual();
    });

    this.view.on('sprite', (key, dataUrl) => {
      this.model.setSprite(key, dataUrl);
      this.view.render(this.model.config, this.model.presets(), this.status());
      this.notifyVisual();
    });

    this.view.on('removeSprite', key => {
      this.model.removeSprite(key);
      this.view.render(this.model.config, this.model.presets(), this.status());
      this.notifyVisual();
    });

    this.view.on('copySprites', (from, to) => {
      this.model.copySprites(from, to, PIECE_ORDER.split(''));
      this.view.render(this.model.config, this.model.presets(), this.status());
      this.notifyVisual();
    });

    this.view.on('palette', (type, index) => {
      if (type === 'pb') {
        const theme = this.view.boardThemes[index];
        if (!theme) return;
        this.model.set('lc', theme[1]);
        this.model.set('dc', theme[2]);
      } else {
        const theme = this.view.pieceThemes[index];
        if (!theme) return;
        this.model.set('wc', theme[1]);
        this.model.set('bc', theme[2]);
        this.model.set('wo', theme[3]);
        this.model.set('bo', theme[4]);
      }

      this.view.updateValues(this.model.config);
      this.view.apply(this.model.config);
    });

    this.view.on('loadPreset', index => {
      if (!this.model.loadPreset(index)) return;
      this.view.render(this.model.config, this.model.presets(), this.status());
      this.view.apply(this.model.config);
      this.notifyVisual();
    });

    this.view.on('deletePreset', index => {
      this.model.deletePreset(index);
      this.view.refreshPresets(this.model.presets());
    });

    this.view.on('action', action => this.action(action));
  }

  start() {
    this.model.subscribe((config, dirty) => {
      this.view.apply(config);
      this.view.setStatus(dirty ? '● Sin guardar' : '✓ Guardado');
    });

    this.view.apply(this.model.config);
  }

  open() {
    this.view.open(this.model.config, this.model.presets(), this.status());
    this.view.apply(this.model.config);
  }

  status() {
    return this.model.dirty ? '● Sin guardar' : '✓ Guardado';
  }

  notifyVisual() {
    if (this.onVisualChange) this.onVisualChange();
  }

  action(action) {
    switch (action) {
      case 'close':
        if (this.model.dirty) this.view.confirmClose();
        else this.view.close();
        break;

      case 'save':
        this.model.commit();
        this.view.setStatus('✓ Guardado');
        break;

      case 'sv2':
        this.model.commit();
        this.view.close();
        break;

      case 'dis':
        this.model.discard();
        this.view.apply(this.model.config);
        this.view.close();
        this.notifyVisual();
        break;

      case 'keep':
        this.view.hideBar();
        break;

      case 'setdef':
        this.model.saveAsDefault();
        this.view.setMessage('Ajustes actuales fijados como predeterminados');
        break;

      case 'fact':
        this.model.factoryReset();
        this.view.render(this.model.config, this.model.presets(), this.status());
        this.view.apply(this.model.config);
        this.notifyVisual();
        break;

      case 'pnew':
        this.model.savePreset(this.view.readPresetName());
        this.view.render(this.model.config, this.model.presets(), this.status());
        break;

      case 'reset':
        this.model.resetToDefaults();
        this.view.render(this.model.config, this.model.presets(), this.status());
        this.view.apply(this.model.config);
        this.notifyVisual();
        break;

      case 'newg':
        this.view.close();
        if (this.onNewGame) this.onNewGame();
        break;

      case 'exp':
        this.view.setJSON(this.model.toJSON());
        break;

      case 'imp':
        try {
          this.model.importJSON(this.view.readJSON());
          this.view.render(this.model.config, this.model.presets(), this.status());
          this.view.apply(this.model.config);
          this.notifyVisual();
        } catch {
          this.view.setMessage('JSON no válido');
        }
        break;

      case 'clall':
        this.model.clearSprites();
        this.view.render(this.model.config, this.model.presets(), this.status());
        this.notifyVisual();
        break;

      default:
        break;
    }
  }
}
