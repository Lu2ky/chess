/**
 * application/analysis-cache.js
 * LRU cache con TTL para resultados de análisis de Stockfish.
 * Clave: `${fenBeforeMove}|${move.uci}|${depth}`
 */

export function createAnalysisCache(maxEntries = 200, ttlMs = 5 * 60 * 1000) {
  const cache = new Map();
  const timestamps = new Map();

  function now() {
    return Date.now();
  }

  function isExpired(timestamp) {
    return now() - timestamp > ttlMs;
  }

  function evictExpired() {
    const current = now();
    for (const [key, ts] of timestamps) {
      if (current - ts > ttlMs) {
        cache.delete(key);
        timestamps.delete(key);
      }
    }
  }

  function makeKey(fen, moveUci, depth) {
    return `${fen}|${moveUci}|${depth}`;
  }

  function get(key) {
    evictExpired();
    const entry = cache.get(key);
    if (!entry) return null;

    // Mover al final (MRU)
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }

  function set(key, value) {
    evictExpired();

    // Si está lleno, borrar el más antiguo (LRU)
    if (cache.size >= maxEntries) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
        timestamps.delete(firstKey);
      }
    }

    cache.set(key, value);
    timestamps.set(key, now());
  }

  function clear() {
    cache.clear();
    timestamps.clear();
  }

  function size() {
    evictExpired();
    return cache.size;
  }

  return {
    get,
    set,
    clear,
    size,
    makeKey,
  };
}