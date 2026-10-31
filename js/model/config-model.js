/**
 * model/config-model.js
 * Modelo de configuración en memoria. Persiste a través de un StoragePort
 * inyectado (nunca toca localStorage directamente).
 */

import { DEFAULT_CONFIG } from './config-schema.js';

const clone = value => JSON.parse(JSON.stringify(value));

export class ConfigModel {
  constructor({ storage }) {
    this.storage = storage;
    this.listeners = new Set();
    this.config = this.merge();
    this.saved = JSON.stringify(this.config);
    this.dirty = false;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of [...this.listeners]) listener(this.config, this.dirty);
  }

  merge() {
    const userDefaults = this.storage.read('aj_def') || {};
    const saved = this.storage.read('aj_cfg') || {};
    const config = clone({ ...DEFAULT_CONFIG, ...userDefaults, ...saved });
    if (!config.sp || typeof config.sp !== 'object') config.sp = {};
    return config;
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    this.config[key] = value;
    this.dirty = true;
    this.emit();
  }

  setSprite(key, dataUrl) {
    this.config.sp[key] = dataUrl;
    this.dirty = true;
    this.emit();
  }

  removeSprite(key) {
    delete this.config.sp[key];
    this.dirty = true;
    this.emit();
  }

  copySprites(fromColor, toColor, pieces) {
    for (const piece of pieces) {
      if (this.config.sp[fromColor + piece]) {
        this.config.sp[toColor + piece] = this.config.sp[fromColor + piece];
      }
    }
    this.dirty = true;
    this.emit();
  }

  clearSprites() {
    this.config.sp = {};
    this.dirty = true;
    this.emit();
  }

  /* --------------------------- persistencia --------------------------- */

  commit() {
    const ok = this.storage.write('aj_cfg', this.config);
    this.dirty = !ok;
    if (ok) this.saved = JSON.stringify(this.config);
    this.emit();
    return ok;
  }

  discard() {
    try {
      this.config = JSON.parse(this.saved);
    } catch {
      this.config = this.merge();
    }
    this.dirty = false;
    this.emit();
  }

  saveAsDefault() {
    this.storage.write('aj_def', this.config);
    this.commit();
  }

  factoryReset() {
    this.config = clone(DEFAULT_CONFIG);
    this.config.sp = {};
    this.dirty = true;
    this.emit();
  }

  resetToDefaults() {
    const userDefaults = this.storage.read('aj_def') || {};
    this.config = clone({ ...DEFAULT_CONFIG, ...userDefaults });
    if (!this.config.sp || typeof this.config.sp !== 'object') this.config.sp = {};
    this.dirty = true;
    this.emit();
  }

  /* ----------------------------- presets ------------------------------ */

  presets() {
    return this.storage.read('aj_perf') || [];
  }

  savePreset(rawName) {
    const list = this.presets();
    const clean = String(rawName || '').replace(/[<>&"]/g, '').trim();
    const name = clean || `Ajustes ${list.length + 1}`;
    const entry = { n: name, c: clone(this.config) };

    const index = list.findIndex(item => item.n === name);
    if (index >= 0) list[index] = entry;
    else list.push(entry);

    this.storage.write('aj_perf', list);
    return list;
  }

  loadPreset(index) {
    const entry = this.presets()[index];
    if (!entry) return false;

    this.config = clone({ ...DEFAULT_CONFIG, ...entry.c });
    if (!this.config.sp || typeof this.config.sp !== 'object') this.config.sp = {};
    this.dirty = true;
    this.emit();
    return true;
  }

  deletePreset(index) {
    const list = this.presets();
    list.splice(index, 1);
    this.storage.write('aj_perf', list);
    return list;
  }

  /* --------------------------- import/export -------------------------- */

  toJSON() {
    return JSON.stringify(this.config);
  }

  importJSON(text) {
    const parsed = JSON.parse(text);
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      if (key !== 'sp' && key in parsed) this.config[key] = parsed[key];
    }
    if (parsed.sp && typeof parsed.sp === 'object') this.config.sp = parsed.sp;
    this.dirty = true;
    this.emit();
  }
}
