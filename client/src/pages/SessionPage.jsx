import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, QrCode } from 'lucide-react';
import { getSession, updateSession } from '../api/sessions.js';
import { recordTransfer } from '../api/transfers.js';
import { createPeer } from '../api/peerProvider.js';
import { WS_URL } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getDeviceName, setDeviceName } from '../utils/deviceName.js';
import StatusBadge from '../components/StatusBadge.jsx';
import DropZone from '../components/DropZone.jsx';
import TransferQueue from '../components/TransferQueue.jsx';
import QrCodeModal from '../components/QrCodeModal.jsx';

function getFriendlyError(msg) {
  if (!msg) return 'This session has expired or does not exist.';
  const upper = String(msg).toUpperCase();
  if (upper.includes('INVALID_CODE') || upper.includes('NOT FOUND')) {
    return 'This session code is invalid or does not exist.';
  }
  if (upper.includes('SESSION_EXPIRED') || upper.includes('EXPIRED')) {
    return 'This session has expired.';
  }
  if (upper.includes('ROOM_FULL') || upper.includes('FULL')) {
    return 'This session already has two devices connected.';
  }
  return msg;
}

export function SessionPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [sessionInfo, setSessionInfo] = useState(null);
  const [peerStatus, setPeerStatus] = useState('connecting');
  const [remoteDeviceName, setRemoteDeviceName] = useState(null);
  const [queue, setQueue] = useState([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isExtending, setIsExtending] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Device name handling
  const [deviceName, setPeerDeviceName] = useState(() => getDeviceName('Web Client'));
  const [displayName, setDisplayName] = useState(() => getDeviceName('Web Client'));

  const peerRef = useRef(null);
  const pendingProgressRef = useRef(new Map());
  const progressTimerRef = useRef(null);
  const isRafRef = useRef(false);
  const normalizedCode = (code || '').trim().toUpperCase();

  const cancelProgressTimer = () => {
    if (progressTimerRef.current !== null) {
      if (isRafRef.current) {
        cancelAnimationFrame(progressTimerRef.current);
      } else {
        clearTimeout(progressTimerRef.current);
      }
      progressTimerRef.current = null;
    }
  };

  // Route title
  useEffect(() => {
    if (normalizedCode) {
      document.title = `Session ${normalizedCode} - Pelican`;
    } else {
      document.title = 'Session - Pelican';
    }
  }, [normalizedCode]);

  // 1. Validate session on server
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const info = await getSession(normalizedCode);
        if (isMounted) setSessionInfo(info);
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || 'Session not found or expired');
          setPeerStatus('failed');
        }
      }
    }

    checkSession();
    return () => {
      isMounted = false;
    };
  }, [normalizedCode]);

  const remoteDeviceNameRef = useRef(null);

  // 2. Initialize Peer connection (StrictMode-safe)
  useEffect(() => {
    if (errorMessage || !normalizedCode) return;
    let cancelled = false;

    const iceServers = [];
    if (import.meta.env.VITE_STUN_URL) {
      iceServers.push({ urls: import.meta.env.VITE_STUN_URL });
    }
    if (import.meta.env.VITE_TURN_URL) {
      iceServers.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USER || '',
        credential: import.meta.env.VITE_TURN_PASS || '',
      });
    }

    const peer = createPeer({
      code: normalizedCode,
      deviceName,
      wsUrl: WS_URL,
      iceServers: iceServers.length > 0 ? iceServers : undefined,
    });

    peerRef.current = peer;

    const flushProgress = () => {
      progressTimerRef.current = null;
      if (cancelled || pendingProgressRef.current.size === 0) return;

      const batch = new Map(pendingProgressRef.current);
      pendingProgressRef.current.clear();

      setQueue((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          const update = batch.get(item.id);
          if (
            !update ||
            item.status === 'cancelled' ||
            item.status === 'completed' ||
            item.status === 'failed'
          ) {
            return item;
          }
          if (
            item.status === 'in_progress' &&
            item.percent === update.percent &&
            item.bytes === update.bytes &&
            item.speedBps === update.speedBps &&
            item.etaSec === update.etaSec
          ) {
            return item;
          }
          changed = true;
          return { ...item, ...update, status: 'in_progress' };
        });
        return changed ? next : prev;
      });
    };

    peer.on('status', (s) => {
      if (cancelled) return;
      setPeerStatus(s);
      if (s === 'disconnected' || s === 'failed') {
        cancelProgressTimer();
        pendingProgressRef.current.clear();
        setQueue((prev) =>
          prev.map((item) =>
            item.status === 'in_progress' || item.status === 'queued'
              ? {
                  ...item,
                  status: 'failed',
                  error: s === 'disconnected' ? 'Peer disconnected' : 'Connection failed',
                }
              : item
          )
        );
      }
    });

    peer.on('peer', ({ deviceName: rDevice }) => {
      if (cancelled) return;
      remoteDeviceNameRef.current = rDevice;
      setRemoteDeviceName(rDevice);
    });

    peer.on('incoming', ({ id, name, size }) => {
      if (cancelled) return;
      console.log('[SessionPage] incoming file:', id, name);
      setQueue((prev) => [
        {
          id,
          name,
          size,
          direction: 'received',
          status: 'in_progress',
          percent: 0,
          bytes: 0,
          speedBps: 0,
        },
        ...prev,
      ]);
    });

    peer.on('progress', (progress) => {
      if (cancelled) return;
      pendingProgressRef.current.set(progress.id, progress);

      // Final 100% must always be applied immediately
      if (progress.percent === 100) {
        cancelProgressTimer();
        flushProgress();
        return;
      }

      if (!progressTimerRef.current) {
        // Fallback to setTimeout (100ms) when backgrounded (document.hidden) because RAF is paused
        if (typeof document !== 'undefined' && document.hidden) {
          isRafRef.current = false;
          progressTimerRef.current = setTimeout(flushProgress, 100);
        } else {
          isRafRef.current = true;
          progressTimerRef.current = requestAnimationFrame(flushProgress);
        }
      }
    });

    peer.on('cancelled', async (info) => {
      if (cancelled) return;
      pendingProgressRef.current.delete(info.id);
      console.log('[SessionPage] File cancelled event received:', info.id, info.name);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === info.id ? { ...item, status: 'cancelled', error: 'Cancelled' } : item
        )
      );

      if (isAuthenticated) {
        try {
          await recordTransfer({
            sessionCode: normalizedCode,
            deviceName: remoteDeviceNameRef.current || 'Remote Device',
            fileName: info.name || 'Transfer',
            fileSize: info.size || 0,
            direction: info.direction || 'sent',
            status: 'cancelled',
            avgSpeedBps: 0,
            durationMs: 0,
            sha256: '',
          });
        } catch (saveErr) {
          console.warn('Failed to save cancelled transfer history:', saveErr.message);
        }
      }
    });

    peer.on('file-complete', async (result) => {
      if (cancelled) return;
      pendingProgressRef.current.delete(result.id);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === result.id ? { ...item, ...result, percent: 100, status: 'completed' } : item
        )
      );

      // Section 6: UI agent saves history by calling POST /api/transfers
      if (isAuthenticated) {
        try {
          await recordTransfer({
            sessionCode: normalizedCode,
            deviceName: remoteDeviceNameRef.current || 'Remote Device',
            fileName: result.name,
            fileSize: result.size,
            direction: result.direction,
            status: 'completed',
            avgSpeedBps: result.avgSpeedBps || 0,
            durationMs: result.durationMs || 0,
            sha256: result.sha256 || '',
          });
        } catch (err) {
          console.warn('Failed to save transfer history:', err.message);
        }
      }
    });

    peer.on('error', async (err) => {
      if (cancelled) return;
      cancelProgressTimer();
      pendingProgressRef.current.clear();
      setErrorMessage(err.message || 'Transfer error occurred');
      setQueue((prev) =>
        prev.map((item) =>
          item.status === 'in_progress' || item.status === 'queued'
            ? { ...item, status: 'failed', error: err.message || 'Transfer failed' }
            : item
        )
      );

      if (isAuthenticated) {
        try {
          await recordTransfer({
            sessionCode: normalizedCode,
            deviceName: remoteDeviceNameRef.current || 'Remote Device',
            fileName: 'Transfer',
            fileSize: 0,
            direction: 'sent',
            status: 'failed',
            avgSpeedBps: 0,
            durationMs: 0,
            sha256: '',
          });
        } catch (saveErr) {
          // ignore
        }
      }
    });

    return () => {
      cancelled = true;
      cancelProgressTimer();
      pendingProgressRef.current.clear();
      peerRef.current = null;
      peer.close();
    };
  }, [normalizedCode, deviceName, isAuthenticated]);

  const handleDeviceNameChange = (e) => {
    setDisplayName(e.target.value);
  };

  const handleDeviceNameBlur = () => {
    const trimmed = displayName.trim() || 'Web Client';
    setDisplayName(trimmed);
    setDeviceName(trimmed);
    if (trimmed !== deviceName) {
      setPeerDeviceName(trimmed);
    }
  };

  const handleDeviceNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(normalizedCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (err) {
      const el = document.createElement('textarea');
      el.value = normalizedCode;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } catch (e) {
        // Fallback failed
      }
      document.body.removeChild(el);
    }
  };

  const handleFilesSelected = async (files) => {
    if (!peerRef.current || peerStatus !== 'connected') return;

    // Attach stable unique id to each file object and queue item
    const newItems = files.map((file, idx) => {
      const fileId = file.id || `f_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      file.id = fileId;
      return {
        id: fileId,
        name: file.name,
        size: file.size,
        direction: 'sent',
        status: 'queued',
        percent: 0,
        bytes: 0,
        speedBps: 0,
      };
    });

    setQueue((prev) => [...newItems, ...prev]);

    try {
      await peerRef.current.sendFiles(files);
    } catch (err) {
      console.error('Send files error:', err);
    }
  };

  const handleCancel = (fileId) => {
    console.log('[SessionPage] Cancel button clicked for id:', fileId);
    if (peerRef.current) {
      peerRef.current.cancel(fileId);
    } else {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === fileId ? { ...item, status: 'cancelled', error: 'Cancelled' } : item
        )
      );
    }
  };

  const handleExtendSession = async () => {
    try {
      setIsExtending(true);
      const updated = await updateSession(normalizedCode, { extendMinutes: 15 });
      setSessionInfo(updated);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to extend session');
    } finally {
      setIsExtending(false);
    }
  };

  const handleCloseSession = async () => {
    try {
      cancelProgressTimer();
      pendingProgressRef.current.clear();
      await updateSession(normalizedCode, { status: 'closed' });
      navigate('/');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to close session');
    }
  };

  if (errorMessage && !sessionInfo) {
    return (
      <div className="session-ended-layout">
        <h2 className="session-ended-title">Session unavailable</h2>
        <p className="session-ended-subtitle">{getFriendlyError(errorMessage)}</p>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            New session
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Enter a different code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-layout">
      <div className="session-header">
        <div className="session-code-group">
          <span className="session-code-label">Session code:</span>
          <div className="session-code-box">
            <span className="session-code font-mono">{normalizedCode}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="btn btn-secondary btn-sm"
            aria-label={codeCopied ? 'Code copied' : 'Copy code'}
          >
            {codeCopied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
            <span>{codeCopied ? 'Copied' : 'Copy code'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="btn btn-secondary btn-sm"
            aria-label="Show QR code"
          >
            <QrCode size={14} strokeWidth={1.5} />
            <span>QR code</span>
          </button>
          <span className="sr-only" aria-live="polite">
            {codeCopied ? 'Session code copied to clipboard' : ''}
          </span>
        </div>

        <div className="session-status-cluster">
          <StatusBadge status={peerStatus} />
          {remoteDeviceName && (
            <span className="remote-device-label">
              Paired with <strong>{remoteDeviceName}</strong>
            </span>
          )}
        </div>
      </div>

      {sessionInfo && (
        <div className="session-controls-bar">
          <span>
            Expires at{' '}
            {new Date(sessionInfo.expiresAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isAuthenticated && (
            <div className="session-action-buttons">
              <button
                type="button"
                onClick={handleExtendSession}
                disabled={isExtending}
                className="btn btn-secondary btn-sm"
              >
                {isExtending ? 'Extending...' : '+15 mins'}
              </button>
              <button
                type="button"
                onClick={handleCloseSession}
                className="btn btn-danger btn-sm"
              >
                Close session
              </button>
            </div>
          )}
        </div>
      )}

      {(!localStorage.getItem('pelican_device_name') || deviceName === 'Web Client') && peerStatus !== 'connected' && (
        <div className="session-device-banner">
          <label htmlFor="sessionDeviceName">This device:</label>
          <input
            id="sessionDeviceName"
            type="text"
            className="input-text"
            value={displayName}
            onChange={handleDeviceNameChange}
            onBlur={handleDeviceNameBlur}
            onKeyDown={handleDeviceNameKeyDown}
            placeholder="Web Client"
          />
          <span className="text-muted">(visible to peer)</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error" role="alert">
          {getFriendlyError(errorMessage)}
        </div>
      )}

      <div className="session-workspace">
        <DropZone
          onFilesSelected={handleFilesSelected}
          disabled={peerStatus !== 'connected'}
        />

        <TransferQueue items={queue} onCancel={handleCancel} />
      </div>

      <QrCodeModal
        code={normalizedCode}
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />
    </div>
  );
}

export default SessionPage;
