/**
 * Lightweight browser-compatible EventEmitter.
 */
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (typeof handler !== 'function') return this;
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return this;
  }

  off(event, handler) {
    if (!this._listeners.has(event)) return this;
    if (handler) {
      this._listeners.get(event).delete(handler);
    } else {
      this._listeners.delete(event);
    }
    return this;
  }

  emit(event, ...args) {
    if (!this._listeners.has(event)) return false;
    for (const handler of Array.from(this._listeners.get(event))) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    }
    return true;
  }

  removeAllListeners() {
    this._listeners.clear();
    return this;
  }
}

export default EventEmitter;
