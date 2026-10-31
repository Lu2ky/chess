/**
 * adapters/sound-gateway.js
 * Adaptador de sonido (WebAudio). Implementa SoundPort.
 */

const TONES = [
  [330, 0.07],
  [180, 0.12],
  [520, 0.25],
];

export class SoundGateway {
  constructor({ isEnabled }) {
    this.isEnabled = isEnabled;
    this.context = null;
  }

  play(kind) {
    if (!this.isEnabled()) return;

    try {
      this.context = this.context || new (window.AudioContext || window.webkitAudioContext)();
      const [frequency, duration] = TONES[kind];

      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();

      oscillator.type = kind === 1 ? 'square' : 'triangle';
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.15, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);

      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    } catch {
      /* audio no disponible */
    }
  }
}
