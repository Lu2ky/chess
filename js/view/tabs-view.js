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
  }

  show(key) {
    this.current = key;

    for (const [name, section] of Object.entries(this.sections)) {
      if (section) section.style.display = name === key ? '' : 'none';
    }

    for (const button of this.root.querySelectorAll('button[data-t]')) {
      button.classList.toggle('on', button.dataset.t === key);
    }

    if (this.fullscreenButton) {
      this.fullscreenButton.style.display = key === 'J' ? '' : 'none';
    }

    if (this.onChange) this.onChange(key);
  }
}
