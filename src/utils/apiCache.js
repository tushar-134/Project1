// src/utils/apiCache.js

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getCache = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

export const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const clearCache = (prefix) => {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};
