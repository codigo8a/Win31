/** JSON preferences that remain usable when browser storage is unavailable. */
export class SafeStorage {
  constructor(options = {}) {
    if (typeof options === "string") options = { prefix: options };
    this.prefix = options.prefix ?? "win31:";
    this.lastError = null;
    this.backend = "memory";
    this._memory = new Map();
    this._dirty = new Set();
    this._listeners = new Set();
    this._onError = options.onError;
    if (Object.prototype.hasOwnProperty.call(options, "storage")) {
      this._storage = options.storage;
    } else {
      try {
        this._storage = globalThis.localStorage;
      } catch (error) {
        this._report(error, "access");
      }
    }
    if (this._storage) this.backend = "localStorage";
  }

  get(key, fallback = null) {
    const name = this.prefix + String(key);
    let raw = this._memory.get(name);
    if (this._storage && !this._dirty.has(name)) {
      try {
        raw = this._storage.getItem(name);
        if (raw !== null) this._memory.set(name, raw);
        else this._memory.delete(name);
      } catch (error) {
        this._report(error, "read", key);
      }
    }
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      this._report(error, "parse", key);
      return fallback;
    }
  }

  /** Returns true only when the preference was written to durable storage. */
  set(key, value) {
    const name = this.prefix + String(key);
    let raw;
    try {
      raw = JSON.stringify(value);
      if (raw === undefined)
        throw new TypeError("Preferences must be JSON values.");
    } catch (error) {
      this._report(error, "serialize", key);
      return false;
    }
    this._memory.set(name, raw);
    this._dirty.add(name);
    if (!this._storage) return false;
    try {
      this._storage.setItem(name, raw);
      this._dirty.delete(name);
      this.backend = "localStorage";
      this.lastError = null;
      return true;
    } catch (error) {
      this._report(error, "write", key);
      return false;
    }
  }

  remove(key) {
    const name = this.prefix + String(key);
    this._memory.delete(name);
    this._dirty.add(name);
    if (!this._storage) return false;
    try {
      this._storage.removeItem(name);
      this._dirty.delete(name);
      this.lastError = null;
      return true;
    } catch (error) {
      this._report(error, "remove", key);
      return false;
    }
  }

  subscribe(listener) {
    if (typeof listener !== "function")
      throw new TypeError("A listener is required.");
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _report(error, operation, key) {
    this.lastError = error;
    this.backend = "memory";
    const event = {
      type: "error",
      error,
      operation,
      key,
      backend: this.backend,
    };
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch {
        /* A subscriber cannot break preferences. */
      }
    }
    try {
      this._onError?.(error, event);
    } catch {
      /* Application callback. */
    }
  }
}

export function createSafeStorage(options) {
  return new SafeStorage(options);
}

export default SafeStorage;
