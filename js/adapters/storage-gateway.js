/**
 * adapters/storage-gateway.js
 * Adaptador de persistencia (localStorage) que implementa StoragePort.
 */

export class LocalStorageGateway {
  read(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}
