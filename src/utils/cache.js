/**
 * Simple in-memory cache with TTL (Time To Live).
 * Suitable for caching blacklist tokens, role lookups, etc.
 * No external dependency needed — uses a plain Map.
 */

class MemoryCache {
  constructor() {
    this._store = new Map();

    // Periodic cleanup of expired entries every 60 seconds
    this._cleanupInterval = setInterval(() => this._cleanup(), 60_000);
    // Allow the process to exit even if the interval is still running
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  /**
   * Get a cached value by key.
   * @param {string} key
   * @returns {*} The cached value, or undefined if missing/expired
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if a key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Set a value in the cache with a TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs - Time to live in milliseconds (default: 5 minutes)
   */
  set(key, value, ttlMs = 5 * 60 * 1000) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Delete a specific key from the cache.
   * @param {string} key
   */
  del(key) {
    this._store.delete(key);
  }

  /**
   * Flush all cached entries.
   */
  flush() {
    this._store.clear();
  }

  /**
   * Get the current number of entries (including possibly expired ones).
   * @returns {number}
   */
  get size() {
    return this._store.size;
  }

  /** Remove expired entries */
  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
      }
    }
  }
}

// Export singleton instances for different use-cases
export const blacklistCache = new MemoryCache();
export const roleCache = new MemoryCache();

export default MemoryCache;
