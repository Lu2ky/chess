/**
 * adapters/ai-gateway.js
 * Adaptador del entrenador IA. Encapsula el acceso a `window.claude`
 * para que la aplicación no dependa de la API global del host.
 */

export class ClaudeGateway {
  constructor() {
    this.cached = undefined;
  }

  async sample() {
    if (this.cached !== undefined) return this.cached;

    try {
      this.cached = window.claude && window.claude.use
        ? await window.claude.use('sample')
        : null;
    } catch {
      this.cached = null;
    }

    return this.cached;
  }
}
