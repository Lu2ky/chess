/**
 * model/profile-model.js
 * Modelo del perfil: cache en memoria de las partidas guardadas.
 * La persistencia se delega en un StoragePort inyectado.
 */

const STORAGE_KEY = 'aj_perfil';

export class ProfileModel {
  constructor({ storage }) {
    this.storage = storage;
    this.games = null;
  }

  load() {
    if (this.games) return this.games;
    this.games = this.storage.read(STORAGE_KEY) || [];
    return this.games;
  }

  all() {
    return this.load();
  }

  add(entry) {
    const games = [...this.load(), entry];
    this.games = games;
    this.storage.write(STORAGE_KEY, games);
    return games;
  }

  clear() {
    this.games = [];
    this.storage.write(STORAGE_KEY, []);
    return this.games;
  }
}
