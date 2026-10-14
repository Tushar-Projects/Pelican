import { EventEmitter } from './events.js';
import {
  CHUNK_SIZE,
  BUFFERED_AMOUNT_LOW_THRESHOLD,
  BUFFERED_AMOUNT_HIGH_THRESHOLD,
  DATA_CHANNEL_LABEL,
  DEFAULT_ICE_SERVERS,
  PEER_STATUS,
} from './constants.js';
import { calculateSha256 } from './crypto.js';
import {
  encodeBinaryFrame,
  decodeBinaryFrame,
  ControlMessages,
} from './protocol.js';

export class Peer extends EventEmitter {
  constructor({ code, deviceName, wsUrl, iceServers }) {
    super();

    this.code = (code || '').trim().toUpperCase();
    this.deviceName = (deviceName || 'Web Client').trim();
    this.wsUrl = wsUrl || (typeof window !== 'undefined' && window.location
      ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
      : '');
    this.iceServers = iceServers || DEFAULT_ICE_SERVERS;

    this.status = PEER_STATUS.CONNECTING;
    this.peerId = null;
    this.role = null; // 'initiator' | 'responder'
    this.remoteDeviceName = null;

    this.ws = null;
    this.pc = null;
    this.channel = null;

    this._pendingCandidates = [];
    this._cancelledFiles = new Set();
    this._readyResolvers = new Map(); // fileId -> resolve
    this._doneResolvers = new Map(); // fileId -> resolve
    this._transfers = new Map(); // fileId -> { id, name, size, direction, cancelled, drainResolver, readyTimeout, doneTimeout }

    this._closed = false;
    this._incomingFile = null;
    this._isSending = false;
    this._sendQueue = [];

    this._initWebSocket();
  }

  _setStatus(newStatus) {
    if (this._closed && newStatus !== PEER_STATUS.DISCONNECTED) return;
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit('status', newStatus);
    }
  }

  _initWebSocket() {
    this._setStatus(PEER_STATUS.CONNECTING);

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (err) {
      if (!this._closed) {
        this.emit('error', { code: 'WS_CONNECTION_ERROR', message: err.message });
        this._setStatus(PEER_STATUS.FAILED);
      }
      return;
    }

    this.ws.onopen = () => {
      if (this._closed) {
        try {
          this.ws.close();
        } catch (e) {}
        return;
      }
      this._sendSignaling({
        type: 'join',
        code: this.code,
        deviceName: this.deviceName,
      });
    };

    this.ws.onmessage = async (event) => {
      if (this._closed) return;
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      await this._handleSignalingMessage(msg);
    };

    this.ws.onclose = () => {
      if (this._closed) return;
      if (this.status !== PEER_STATUS.DISCONNECTED && this.status !== PEER_STATUS.FAILED) {
        this._setStatus(PEER_STATUS.DISCONNECTED);
      }
    };

    this.ws.onerror = (err) => {
      if (this._closed) return;
      this.emit('error', {
        code: 'WS_ERROR',
        message: err.message || 'WebSocket connection error',
      });
      this._setStatus(PEER_STATUS.FAILED);
    };
  }

  _sendSignaling(data) {
    if (this._closed) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  async _handleSignalingMessage(msg) {
    switch (msg.type) {
      case 'joined': {
        this.peerId = msg.peerId;
        this.role = msg.role; // 'initiator' | 'responder'

        if (this.role === 'responder') {
          // Rule 1: First peer to join waits and gets role responder
          this._setStatus(PEER_STATUS.WAITING_PEER);
        } else if (this.role === 'initiator') {
          // Rule 1: Second peer to join gets role initiator and sends offer after joined
          this._setStatus(PEER_STATUS.CONNECTING);

          // Find the existing peer in the room
          const existingPeer = (msg.peers || []).find((p) => p.peerId !== this.peerId);
          if (existingPeer) {
            this.remoteDeviceName = existingPeer.deviceName;
            this.emit('peer', { deviceName: existingPeer.deviceName });
          }

          // Start WebRTC handshake as initiator
          await this._startInitiatorHandshake();
        }
        break;
      }

      case 'peer-joined': {
        // First peer (responder) receives peer-joined when second peer (initiator) joins
        this.remoteDeviceName = msg.deviceName;
        this.emit('peer', { deviceName: msg.deviceName });
        this._setStatus(PEER_STATUS.CONNECTING);
        break;
      }

      case 'offer': {
        // Responder receives offer from initiator
        await this._handleRemoteOffer(msg.sdp);
        break;
      }

      case 'answer': {
        // Initiator receives answer from responder
        await this._handleRemoteAnswer(msg.sdp);
        break;
      }

      case 'ice': {
        await this._handleRemoteIce(msg.candidate);
        break;
      }

      case 'peer-left': {
        this.remoteDeviceName = null;
        this._setStatus(PEER_STATUS.DISCONNECTED);
        this._cleanupPeerConnection();
        // Return to waiting-peer state if we were in the room
        if (this.role === 'responder' || this.role === 'initiator') {
          this._setStatus(PEER_STATUS.WAITING_PEER);
        }
        break;
      }

      case 'error': {
        this.emit('error', { code: msg.code, message: msg.message });
        this._setStatus(PEER_STATUS.FAILED);
        break;
      }

      default:
        break;
    }
  }

  _createPeerConnection() {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendSignaling({
          type: 'ice',
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this._setStatus(PEER_STATUS.FAILED);
      } else if (pc.connectionState === 'disconnected') {
        this._setStatus(PEER_STATUS.DISCONNECTED);
      }
    };

    this.pc = pc;
    return pc;
  }

  async _startInitiatorHandshake() {
    const pc = this._createPeerConnection();

    // Initiator creates data channel named 'file' per Section 5
    const channel = pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    this._setupDataChannel(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this._sendSignaling({
      type: 'offer',
      sdp: pc.localDescription,
    });
  }

  async _handleRemoteOffer(sdp) {
    const pc = this._createPeerConnection();

    pc.ondatachannel = (event) => {
      if (event.channel.label === DATA_CHANNEL_LABEL) {
        this._setupDataChannel(event.channel);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this._flushPendingCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this._sendSignaling({
      type: 'answer',
      sdp: pc.localDescription,
    });
  }

  async _handleRemoteAnswer(sdp) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this._flushPendingCandidates();
  }

  async _handleRemoteIce(candidate) {
    if (!candidate) return;
    const rtcCandidate = new RTCIceCandidate(candidate);

    if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
      await this.pc.addIceCandidate(rtcCandidate);
    } else {
      this._pendingCandidates.push(rtcCandidate);
    }
  }

  async _flushPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this._pendingCandidates.length > 0) {
      const candidate = this._pendingCandidates.shift();
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (err) {
        // Non-fatal candidate error
      }
    }
  }

  _setupDataChannel(channel) {
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;

    channel.onopen = () => {
      this._setStatus(PEER_STATUS.CONNECTED);
    };

    channel.onclose = () => {
      this._setStatus(PEER_STATUS.DISCONNECTED);
    };

    channel.onerror = (err) => {
      this.emit('error', {
        code: 'DATA_CHANNEL_ERROR',
        message: err.message || 'Data channel error',
      });
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        await this._handleControlMessage(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        await this._handleBinaryFrame(event.data);
      }
    };
  }

  async _handleControlMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      return;
    }

    switch (msg.t) {
      case 'meta': {
        // Incoming file descriptor
        const { id, name, size, mime, totalChunks } = msg;
        let transfer = this._transfers.get(id);
        if (!transfer) {
          transfer = {
            id,
            name,
            size,
            direction: 'received',
            cancelled: false,
          };
          this._transfers.set(id, transfer);
        } else {
          transfer.name = name;
          transfer.size = size;
          transfer.direction = 'received';
        }

        if (transfer.cancelled) {
          console.log(`[Peer] Received meta for already cancelled file ${id}`);
          this._sendDataMessage(ControlMessages.cancel(id));
          return;
        }

        this._incomingFile = {
          id,
          name,
          size,
          mime: mime || 'application/octet-stream',
          totalChunks,
          chunks: new Map(),
          receivedBytes: 0,
          startTime: Date.now(),
          cancelled: false,
        };

        this.emit('incoming', { id, name, size });

        // Acknowledge with ready message per Section 5
        this._sendDataMessage(ControlMessages.ready(id, []));
        break;
      }

      case 'ready': {
        // Receiver replied with ready message
        const resolver = this._readyResolvers.get(msg.id);
        if (resolver) {
          resolver(msg);
          this._readyResolvers.delete(msg.id);
        }
        break;
      }

      case 'end': {
        // File chunks finished; assemble and verify
        if (this._incomingFile && this._incomingFile.id === msg.id) {
          const transfer = this._transfers.get(msg.id);
          if (transfer && transfer.cancelled) {
            console.log(`[Peer] Received end for cancelled file ${msg.id}, ignoring`);
            return;
          }
          if (this._incomingFile.cancelled) {
            return;
          }
          await this._finalizeIncomingFile();
        }
        break;
      }

      case 'done': {
        // Receiver reports computed SHA-256
        const resolver = this._doneResolvers.get(msg.id);
        if (resolver) {
          resolver(msg);
          this._doneResolvers.delete(msg.id);
        }
        break;
      }

      case 'cancel': {
        const fileId = msg.id;
        console.log('[Peer] Received cancel control message for id:', fileId);
        let transfer = this._transfers.get(fileId);
        if (!transfer) {
          transfer = {
            id: fileId,
            cancelled: true,
          };
          this._transfers.set(fileId, transfer);
        } else {
          transfer.cancelled = true;
        }

        // Free timers
        if (transfer.readyTimeout) {
          clearTimeout(transfer.readyTimeout);
          transfer.readyTimeout = null;
        }
        if (transfer.doneTimeout) {
          clearTimeout(transfer.doneTimeout);
          transfer.doneTimeout = null;
        }

        // Resolve any pending backpressure drain promise
        if (transfer.drainResolver) {
          transfer.drainResolver();
          transfer.drainResolver = null;
        }

        // Resolve ready/done resolvers if pending
        if (this._readyResolvers.has(fileId)) {
          const resolve = this._readyResolvers.get(fileId);
          this._readyResolvers.delete(fileId);
          resolve({ id: fileId, have: [] });
        }
        if (this._doneResolvers.has(fileId)) {
          const resolve = this._doneResolvers.get(fileId);
          this._doneResolvers.delete(fileId);
          resolve({ id: fileId, sha256: null });
        }

        // If receiving this file, drop received chunks and clear incomingFile
        if (this._incomingFile && this._incomingFile.id === fileId) {
          transfer.name = transfer.name || this._incomingFile.name;
          transfer.size = transfer.size || this._incomingFile.size;
          transfer.direction = 'received';
          this._incomingFile.cancelled = true;
          if (this._incomingFile.chunks) {
            this._incomingFile.chunks.clear();
          }
          this._incomingFile = null;
        }

        this.emit('cancelled', {
          id: fileId,
          name: transfer.name || 'File',
          size: transfer.size || 0,
          direction: transfer.direction || 'sent',
          status: 'cancelled',
        });
        break;
      }

      default:
        break;
    }
  }

  async _handleBinaryFrame(buffer) {
    if (!this._incomingFile || this._incomingFile.cancelled) return;
    const transfer = this._transfers.get(this._incomingFile.id);
    if (transfer && transfer.cancelled) return;

    const { chunkIndex, chunkData } = decodeBinaryFrame(buffer);
    this._incomingFile.chunks.set(chunkIndex, chunkData);
    this._incomingFile.receivedBytes += chunkData.byteLength;

    const now = Date.now();
    const elapsedSec = Math.max(0.001, (now - this._incomingFile.startTime) / 1000);
    const speedBps = Math.round(this._incomingFile.receivedBytes / elapsedSec);
    const remainingBytes = Math.max(0, this._incomingFile.size - this._incomingFile.receivedBytes);
    const etaSec = speedBps > 0 ? Math.round(remainingBytes / speedBps) : 0;
    const percent = Math.min(
      100,
      Math.round((this._incomingFile.receivedBytes / this._incomingFile.size) * 100)
    );

    this.emit('progress', {
      id: this._incomingFile.id,
      name: this._incomingFile.name,
      direction: 'received',
      bytes: this._incomingFile.receivedBytes,
      total: this._incomingFile.size,
      percent,
      speedBps,
      etaSec,
    });
  }

  async _finalizeIncomingFile() {
    const fileInfo = this._incomingFile;
    if (!fileInfo) return;

    const orderedChunks = [];
    for (let i = 0; i < fileInfo.totalChunks; i++) {
      const chunk = fileInfo.chunks.get(i);
      if (chunk) {
        orderedChunks.push(chunk);
      }
    }

    const blob = new Blob(orderedChunks, { type: fileInfo.mime });
    let sha256 = null;
    try {
      sha256 = await calculateSha256(blob);
    } catch (err) {
      console.warn('Failed to calculate SHA-256 for received file:', err);
      sha256 = null;
    }

    // Report hash back to sender per Section 5
    this._sendDataMessage(ControlMessages.done(fileInfo.id, sha256));

    const durationMs = Math.max(1, Date.now() - fileInfo.startTime);
    const avgSpeedBps = Math.round(fileInfo.size / (durationMs / 1000));

    this.emit('file-complete', {
      id: fileInfo.id,
      name: fileInfo.name,
      size: fileInfo.size,
      direction: 'received',
      durationMs,
      avgSpeedBps,
      sha256: sha256 || null,
      blob,
    });

    this._incomingFile = null;
  }

  _sendDataMessage(str) {
    if (this.channel && this.channel.readyState === 'open') {
      this.channel.send(str);
    }
  }

  /**
   * Backpressure helper: waits until bufferedAmount drops below threshold.
   */
  _waitForBufferDrain(state) {
    if (state && state.cancelled) {
      return Promise.resolve();
    }

    if (!this.channel || this.channel.bufferedAmount <= BUFFERED_AMOUNT_LOW_THRESHOLD) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const onLow = () => {
        if (resolved) return;
        resolved = true;
        if (this.channel) {
          try {
            this.channel.removeEventListener('bufferedamountlow', onLow);
          } catch (e) {}
        }
        if (state && state.drainResolver === resolver) {
          state.drainResolver = null;
        }
        resolve();
      };

      const resolver = () => {
        if (resolved) return;
        resolved = true;
        if (this.channel) {
          try {
            this.channel.removeEventListener('bufferedamountlow', onLow);
          } catch (e) {}
        }
        resolve();
      };

      if (state) {
        state.drainResolver = resolver;
      }

      this.channel.addEventListener('bufferedamountlow', onLow);
    });
  }

  /**
   * Queues and sends files sequentially per Section 6.
   * @param {FileList|File[]|Blob[]} fileList
   * @returns {Promise<void>}
   */
  async sendFiles(fileList) {
    if (!this.channel || this.channel.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }

    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await this._sendFile(files[i], i);
    }
  }

  async _sendFile(file, index) {
    const fileId = file.id || `f_${Date.now()}_${index}`;
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const mime = file.type || 'application/octet-stream';
    const fileName = file.name || `file_${index}`;

    let state = this._transfers.get(fileId);
    if (!state) {
      state = {
        id: fileId,
        name: fileName,
        size: file.size,
        direction: 'sent',
        cancelled: false,
        drainResolver: null,
      };
      this._transfers.set(fileId, state);
    } else {
      state.name = fileName;
      state.size = file.size;
      state.direction = 'sent';
    }

    if (state.cancelled) {
      console.log(`[Peer] Transfer for ${fileId} was already cancelled before send`);
      return;
    }

    // 1. Send meta control message
    this._sendDataMessage(
      ControlMessages.meta(fileId, fileName, file.size, mime, totalChunks)
    );

    // 2. Wait for receiver's ready message
    const readyPromise = new Promise((resolve, reject) => {
      this._readyResolvers.set(fileId, resolve);
      state.readyTimeout = setTimeout(() => {
        if (this._readyResolvers.has(fileId)) {
          this._readyResolvers.delete(fileId);
          reject(new Error(`Timeout waiting for ready from receiver for ${fileName}`));
        }
      }, 30000);
    });

    const readyMsg = await readyPromise;
    if (state.cancelled) {
      console.log(`[Peer] Transfer for ${fileId} cancelled during ready wait`);
      return;
    }

    const haveSet = new Set(readyMsg?.have || []);

    const startTime = Date.now();
    let bytesSent = 0;

    // 3. Send binary chunks with backpressure
    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      if (state.cancelled) {
        break;
      }

      if (haveSet.has(chunkIdx)) {
        // Chunk skipped per resume protocol
        const start = chunkIdx * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        bytesSent += end - start;
        continue;
      }

      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const slice = file.slice(start, end);
      const chunkBuffer = await slice.arrayBuffer();

      if (state.cancelled) {
        break;
      }

      const frame = encodeBinaryFrame(chunkIdx, chunkBuffer);

      // Backpressure check: pause when bufferedAmount > 1048576 (1 MB)
      if (this.channel && this.channel.bufferedAmount > BUFFERED_AMOUNT_HIGH_THRESHOLD) {
        await this._waitForBufferDrain(state);
        if (state.cancelled) {
          break;
        }
      }

      if (!this.channel || this.channel.readyState !== 'open') {
        throw new Error('Data channel closed during transfer');
      }

      this.channel.send(frame);
      bytesSent += chunkBuffer.byteLength;

      const now = Date.now();
      const elapsedSec = Math.max(0.001, (now - startTime) / 1000);
      const speedBps = Math.round(bytesSent / elapsedSec);
      const remainingBytes = Math.max(0, file.size - bytesSent);
      const etaSec = speedBps > 0 ? Math.round(remainingBytes / speedBps) : 0;
      const percent = Math.min(100, Math.round((bytesSent / file.size) * 100));

      this.emit('progress', {
        id: fileId,
        name: fileName,
        direction: 'sent',
        bytes: bytesSent,
        total: file.size,
        percent,
        speedBps,
        etaSec,
      });
    }

    if (state.cancelled) {
      console.log(`[Peer] Transfer for ${fileId} was cancelled during chunk sending. Skipping end message.`);
      return;
    }

    // 4. Send end control message
    this._sendDataMessage(ControlMessages.end(fileId));

    // 5. Wait for receiver's done message containing verified SHA-256
    const donePromise = new Promise((resolve, reject) => {
      this._doneResolvers.set(fileId, resolve);
      state.doneTimeout = setTimeout(() => {
        if (this._doneResolvers.has(fileId)) {
          this._doneResolvers.delete(fileId);
          reject(new Error(`Timeout waiting for done verification for ${fileName}`));
        }
      }, 30000);
    });

    const doneMsg = await donePromise;
    if (state.cancelled) {
      console.log(`[Peer] Transfer for ${fileId} cancelled during done wait`);
      return;
    }

    const durationMs = Math.max(1, Date.now() - startTime);
    const avgSpeedBps = Math.round(file.size / (durationMs / 1000));

    this.emit('file-complete', {
      id: fileId,
      name: fileName,
      size: file.size,
      direction: 'sent',
      durationMs,
      avgSpeedBps,
      sha256: doneMsg?.sha256 || null,
    });
  }

  cancel(id) {
    console.log('[Peer] cancel called for id:', id);
    let state = this._transfers.get(id);
    if (!state) {
      state = {
        id,
        cancelled: true,
      };
      this._transfers.set(id, state);
    } else {
      state.cancelled = true;
    }

    // Free timers
    if (state.readyTimeout) {
      clearTimeout(state.readyTimeout);
      state.readyTimeout = null;
    }
    if (state.doneTimeout) {
      clearTimeout(state.doneTimeout);
      state.doneTimeout = null;
    }

    // Resolve any pending backpressure drain promise
    if (state.drainResolver) {
      state.drainResolver();
      state.drainResolver = null;
    }

    // Resolve ready/done resolvers if pending
    if (this._readyResolvers.has(id)) {
      const resolve = this._readyResolvers.get(id);
      this._readyResolvers.delete(id);
      resolve({ id, have: [] });
    }
    if (this._doneResolvers.has(id)) {
      const resolve = this._doneResolvers.get(id);
      this._doneResolvers.delete(id);
      resolve({ id, sha256: null });
    }

    // If receiving this file, drop received chunks and clear incomingFile
    if (this._incomingFile && this._incomingFile.id === id) {
      state.name = state.name || this._incomingFile.name;
      state.size = state.size || this._incomingFile.size;
      state.direction = 'received';
      this._incomingFile.cancelled = true;
      if (this._incomingFile.chunks) {
        this._incomingFile.chunks.clear();
      }
      this._incomingFile = null;
    }

    // Send cancel control message over data channel if open
    this._sendDataMessage(ControlMessages.cancel(id));

    // Emit terminal cancelled event
    this.emit('cancelled', {
      id,
      name: state.name || 'File',
      size: state.size || 0,
      direction: state.direction || 'sent',
      status: 'cancelled',
    });
  }

  close() {
    this._closed = true;

    // Free any active drain resolvers
    for (const transfer of this._transfers.values()) {
      if (transfer.drainResolver) {
        transfer.drainResolver();
        transfer.drainResolver = null;
      }
    }

    if (this._incomingFile && this._incomingFile.chunks) {
      this._incomingFile.chunks.clear();
      this._incomingFile = null;
    }

    this._sendSignaling({ type: 'leave' });

    if (this.channel) {
      try {
        this.channel.close();
      } catch (err) {
        // ignore
      }
      this.channel = null;
    }

    this._cleanupPeerConnection();

    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      if (typeof WebSocket !== 'undefined' && socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => {
          try {
            socket.close();
          } catch (err) {
            // ignore
          }
        };
      } else {
        try {
          socket.close();
        } catch (err) {
          // ignore
        }
      }
    }

    this._setStatus(PEER_STATUS.DISCONNECTED);
  }

  _cleanupPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch (err) {
        // ignore
      }
      this.pc = null;
    }
  }
}

export default Peer;
