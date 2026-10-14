import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, updateSession } from '../api/sessions.js';
import { recordTransfer } from '../api/transfers.js';
import { createPeer } from '../api/peerProvider.js';
import { WS_URL } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import DropZone from '../components/DropZone.jsx';
import TransferQueue from '../components/TransferQueue.jsx';
import QrCodeModal from '../components/QrCodeModal.jsx';

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

  const peerRef = useRef(null);
  const pendingProgressRef = useRef(new Map());
  const progressRafRef = useRef(null);
  const normalizedCode = (code || '').trim().toUpperCase();

  const deviceName =
    localStorage.getItem('droprelay_device_name') || 'Web Client';

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

    peer.on('status', (s) => {
      if (cancelled) return;
      setPeerStatus(s);
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

      if (!progressRafRef.current) {
        progressRafRef.current = requestAnimationFrame(() => {
          progressRafRef.current = null;
          if (cancelled || pendingProgressRef.current.size === 0) return;

          const batch = new Map(pendingProgressRef.current);
          pendingProgressRef.current.clear();

          setQueue((prev) => {
            let changed = false;
            const next = prev.map((item) => {
              const update = batch.get(item.id);
              if (!update || item.status === 'cancelled' || item.status === 'completed') {
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
        });
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
          item.id === result.id ? { ...item, ...result, status: 'completed' } : item
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
      setErrorMessage(err.message || 'Transfer error occurred');
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
      if (progressRafRef.current) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
      pendingProgressRef.current.clear();
      peerRef.current = null;
      peer.close();
    };
  }, [normalizedCode, deviceName, isAuthenticated]);

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
      await updateSession(normalizedCode, { status: 'closed' });
      navigate('/');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to close session');
    }
  };

  if (errorMessage && !sessionInfo) {
    return (
      <div className="session-page error-view">
        <div className="alert alert-error">
          <h3>Session Unavailable</h3>
          <p>{errorMessage}</p>
        </div>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">
          ← Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="session-page">
      <div className="session-header">
        <div className="session-title-group">
          <span className="session-label">Session Code:</span>
          <h2 className="session-code-badge">{normalizedCode}</h2>
          <button
            onClick={() => setShowQrModal(true)}
            className="btn-secondary btn-sm qr-btn"
            title="Show QR Code"
          >
            📱 QR Code
          </button>
        </div>

        <div className="session-status-group">
          <StatusBadge status={peerStatus} />
          {remoteDeviceName && (
            <span className="remote-peer-info">
              Paired with: <strong>{remoteDeviceName}</strong>
            </span>
          )}
        </div>
      </div>

      {sessionInfo && (
        <div className="session-controls-bar">
          <span className="expires-text">
            Expires: {new Date(sessionInfo.expiresAt).toLocaleTimeString()}
          </span>
          {isAuthenticated && (
            <div className="session-action-buttons">
              <button
                onClick={handleExtendSession}
                disabled={isExtending}
                className="btn-secondary btn-sm"
              >
                {isExtending ? 'Extending...' : '+15 Mins'}
              </button>
              <button
                onClick={handleCloseSession}
                className="btn-danger btn-sm"
              >
                Close Session
              </button>
            </div>
          )}
        </div>
      )}

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

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
