/**
 * Mock WebRTC Peer implementation for Stage 3 Frontend development.
 * Adheres strictly to CONTRACTS.md Section 6 interface.
 */

class MockEventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(fn);
    return this;
  }

  off(event, fn) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(fn);
    }
    return this;
  }

  emit(event, ...args) {
    if (!this._listeners.has(event)) return;
    for (const fn of Array.from(this._listeners.get(event))) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`Error in mock peer event ${event}:`, err);
      }
    }
  }
}

export class MockPeer extends MockEventEmitter {
  constructor({ code, deviceName, wsUrl, iceServers }) {
    super();
    this.code = code;
    this.deviceName = deviceName || 'Local Device';
    this.wsUrl = wsUrl;
    this.iceServers = iceServers;
    this.status = 'connecting';
    this.remoteDeviceName = null;
    this._cancelled = false;
    this._activeFileId = null;

    // Simulate connection sequence
    this._timers = [];
    this._initMockConnection();
  }

  _initMockConnection() {
    this._setStatus('connecting');

    const t1 = setTimeout(() => {
      this._setStatus('waiting-peer');
    }, 400);

    const t2 = setTimeout(() => {
      this.remoteDeviceName = 'Mock Peer (Virtual Device)';
      this.emit('peer', { deviceName: this.remoteDeviceName });
      this._setStatus('connected');
    }, 1500);

    this._timers.push(t1, t2);
  }

  _setStatus(s) {
    this.status = s;
    this.emit('status', s);
  }

  async sendFiles(fileList) {
    if (this.status !== 'connected') {
      throw new Error('Peer is not connected');
    }

    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `mock_${Date.now()}_${i}`;
      this._activeFileId = id;
      this._cancelled = false;

      const total = file.size || 1024 * 1024;
      const chunks = 10;
      const chunkSize = Math.ceil(total / chunks);
      const startTime = Date.now();

      for (let step = 1; step <= chunks; step++) {
        if (this._cancelled) {
          this.emit('error', {
            code: 'TRANSFER_CANCELLED',
            message: `Transfer cancelled for file: ${file.name}`,
          });
          throw new Error('Cancelled');
        }

        await new Promise((r) => setTimeout(r, 150));

        const bytes = Math.min(total, step * chunkSize);
        const percent = Math.min(100, Math.round((bytes / total) * 100));
        const elapsedSec = Math.max(0.001, (Date.now() - startTime) / 1000);
        const speedBps = Math.round(bytes / elapsedSec);
        const etaSec = Math.max(0, Math.round((total - bytes) / speedBps));

        this.emit('progress', {
          id,
          name: file.name,
          direction: 'sent',
          bytes,
          total,
          percent,
          speedBps,
          etaSec,
        });
      }

      const durationMs = Date.now() - startTime;
      const avgSpeedBps = Math.round(total / (durationMs / 1000));

      this.emit('file-complete', {
        id,
        name: file.name,
        size: total,
        direction: 'sent',
        durationMs,
        avgSpeedBps,
        sha256: 'mock-sha256-' + Math.random().toString(16).substring(2, 10),
      });

      this._activeFileId = null;
    }
  }

  cancel(id) {
    if (this._activeFileId === id || !id) {
      this._cancelled = true;
      this.emit('error', {
        code: 'TRANSFER_CANCELLED',
        message: 'Transfer cancelled by user',
      });
    }
  }

  close() {
    this._timers.forEach((t) => clearTimeout(t));
    this._setStatus('disconnected');
  }
}

export function createMockPeer(options) {
  return new MockPeer(options);
}

export default createMockPeer;
