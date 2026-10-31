/**
 * controllers/app-controller.js
 * Controlador de la aplicación: pestañas, bloqueo de pantalla, pantalla
 * completa y acceso a los ajustes. Coordina controladores de caso de uso
 * sin conocer sus detalles internos.
 */

export class AppController {
  constructor({ tabsView, gameController, lordController, settingsController }) {
    this.tabsView = tabsView;
    this.gameController = gameController;
    this.lordController = lordController;
    this.settingsController = settingsController;

    this.locked = false;
    this.fullscreen = false;
  }

  start() {
    this.tabsView.onChange = key => this.onTab(key);

    this.bindLock();
    this.bindFullscreen();
    this.bindSettings();
  }

  onTab(key) {
    if (key !== 'J' && this.locked) this.setLock(false);

    if (key === 'P') this.gameController.renderPostGame();
    if (key === 'F') this.gameController.renderProfile();
    if (key === 'L') this.lordController.render();
  }

  /* ------------------------------------------------------------------ */
  /* Fijar pantalla                                                      */
  /* ------------------------------------------------------------------ */

  bindLock() {
    this.lockButton = document.getElementById('lk');
    if (this.lockButton) {
      this.lockButton.addEventListener('click', () => this.setLock(!this.locked));
    }

    document.addEventListener(
      'touchmove',
      event => {
        if (!this.locked) return;
        if (event.target.closest && event.target.closest('#lst,#lm')) return;
        event.preventDefault();
      },
      { passive: false },
    );
  }

  setLock(value) {
    this.locked = value;
    document.documentElement.classList.toggle('lk', value);

    if (this.lockButton) this.lockButton.textContent = value ? '🔒' : '🔓';

    if (value) {
      const wrap = document.getElementById('wrap');
      if (wrap) wrap.scrollIntoView({ block: 'center' });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pantalla completa                                                   */
  /* ------------------------------------------------------------------ */

  bindFullscreen() {
    this.fullscreenButton = document.getElementById('fs');

    if (this.fullscreenButton) {
      this.fullscreenButton.addEventListener('click', () => this.setFullscreen(!this.fullscreen));
    }

    ['fullscreenchange', 'webkitfullscreenchange'].forEach(name => {
      document.addEventListener(name, () => {
        if (!this.isFullscreen() && this.fullscreen) this.setFullscreen(false);
      });
    });
  }

  isFullscreen() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  setFullscreen(value) {
    this.fullscreen = value;
    document.documentElement.classList.toggle('fs', value);

    if (this.fullscreenButton) this.fullscreenButton.textContent = value ? '✕' : '⛶';

    try {
      const element = document.documentElement;
      const request = element.requestFullscreen || element.webkitRequestFullscreen;
      const exit = document.exitFullscreen || document.webkitExitFullscreen;

      if (value && request && !this.isFullscreen()) {
        const result = request.call(element);
        if (result && result.catch) result.catch(() => {});
      } else if (!value && this.isFullscreen() && exit) {
        const result = exit.call(document);
        if (result && result.catch) result.catch(() => {});
      }
    } catch {
      /* pantalla completa no disponible */
    }

    this.gameController.render();
  }

  /* ------------------------------------------------------------------ */
  /* Ajustes                                                             */
  /* ------------------------------------------------------------------ */

  bindSettings() {
    const gear = document.getElementById('gear');
    if (gear) gear.addEventListener('click', () => this.settingsController.open());
  }
}
