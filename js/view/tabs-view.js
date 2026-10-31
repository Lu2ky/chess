/**
 * view/tabs-view.js
 * Vista de pestañas: controla qué sección del árbol DOM está visible.
 * No conoce modelos ni casos de uso; solo notifica al controlador.
 */

export class TabsView {
  constructor({ root, sections, fullscreenButton }) {
    this.root = root;
    this.sections = sections;
    this.fullscreenButton = fullscreenButton;
    this.current = null;
    this.onChange = null;
    this.bind();
  }

  bind() {
    this.root.addEventListener('click', event => {
      const button = event.target.closest('button[data-t]');
      if (button) this.show(button.dataset.t);
    });

    this.root.addEventListener('keydown', event => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;

      const buttons = [...this.root.querySelectorAll('button[data-t]')];
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;

      event.preventDefault();

      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else next = (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;

      buttons[next].focus();
      this.show(buttons[next].dataset.t);
    });
  }

  show(key) {
    this.current = key;

    for (const [name, section] of Object.entries(this.sections)) {
      if (section) section.style.display = name === key ? '' : 'none';
    }

    const active = this.sections[key];
    if (active) {
      active.classList.remove('enter');
      void active.offsetWidth;
      active.classList.add('enter');
    }

    for (const button of this.root.querySelectorAll('button[data-t]')) {
      const on = button.dataset.t === key;
      button.classList.toggle('on', on);
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    }

    if (this.fullscreenButton) {
      this.fullscreenButton.style.display = key === 'J' ? '' : 'none';
    }

    if (this.onChange) this.onChange(key);
  }
}
