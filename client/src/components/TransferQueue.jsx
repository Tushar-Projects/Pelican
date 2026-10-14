import React from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatSpeed(bps) {
  if (!bps || bps === 0) return '0 B/s';
  return `${formatBytes(bps)}/s`;
}

export function TransferQueue({ items = [], onCancel }) {
  if (!items || items.length === 0) {
    return null;
  }

  const handleDownload = (item) => {
    if (!item.blob) return;
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="transfer-queue">
      <h3 className="queue-header">Transfer Activity ({items.length})</h3>
      <div className="queue-list">
        {items.map((item) => {
          const isDone = item.status === 'completed';
          const isFailed = item.status === 'failed' || item.status === 'cancelled';
          const isReceiving = item.direction === 'received';

          return (
            <div key={item.id} className={`queue-card ${isDone ? 'queue-done' : ''} ${isFailed ? 'queue-failed' : ''}`}>
              <div className="queue-info">
                <div className="queue-meta">
                  <span className={`direction-badge ${isReceiving ? 'badge-received' : 'badge-sent'}`}>
                    {isReceiving ? '📥 Received' : '📤 Sent'}
                  </span>
                  <span className="queue-filename" title={item.name}>
                    {item.name}
                  </span>
                  <span className="queue-filesize">{formatBytes(item.size || item.total)}</span>
                </div>

                <div className="queue-actions">
                  {isDone && isReceiving && item.blob && (
                    <button
                      onClick={() => handleDownload(item)}
                      className="btn-primary btn-sm download-btn"
                    >
                      💾 Save File
                    </button>
                  )}
                  {!isDone && !isFailed && onCancel && (
                    <button
                      onClick={() => onCancel(item.id)}
                      className="btn-danger btn-sm cancel-btn"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {!isDone && !isFailed && (
                <div className="queue-progress-container">
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${item.percent || 0}%` }}
                    ></div>
                  </div>
                  <div className="progress-details">
                    <span>{item.percent || 0}%</span>
                    <span>
                      {formatBytes(item.bytes || 0)} / {formatBytes(item.total || item.size)}
                    </span>
                    <span>{formatSpeed(item.speedBps)}</span>
                    {item.etaSec !== undefined && item.etaSec > 0 && (
                      <span>ETA: {item.etaSec}s</span>
                    )}
                  </div>
                </div>
              )}

              {isDone && (
                <div className="queue-complete-summary">
                  <span className="text-emerald-400">✓ Completed</span>
                  {item.avgSpeedBps > 0 && <span>Avg: {formatSpeed(item.avgSpeedBps)}</span>}
                  {item.durationMs > 0 && <span>Time: {(item.durationMs / 1000).toFixed(1)}s</span>}
                  {item.sha256 && (
                    <span className="sha-text" title={`SHA-256: ${item.sha256}`}>
                      Hash: {item.sha256.substring(0, 10)}...
                    </span>
                  )}
                </div>
              )}

              {isFailed && (
                <div className="queue-failed-summary">
                  <span className="text-rose-400">✗ {item.error || 'Transfer failed or cancelled'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TransferQueue;
