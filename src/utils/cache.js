// Implémente un micro-cache en mémoire pour éviter les appels externes coûteux.
const store = new Map();

export async function cacheGetSet(key, ttlMs, compute) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.timestamp < ttlMs) {
    return hit.value;
  }
  const value = await compute();
  store.set(key, { timestamp: now, value });
  return value;
}
