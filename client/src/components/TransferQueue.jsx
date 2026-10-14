import React from 'react';
import { Download, X } from 'lucide-react';

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
    <section className="transfer-queue" aria-label="Transfer activity">
      <div className="queue-header-row">
        <h3 className="queue-header-title">Transfer activity</h3>
        <span className="queue-count font-mono">{items.length}</span>
      </div>

      <div className="queue-row-list" role="list">
        {items.map((item) => {
          const isDone = item.status === 'completed';
          const isFailed = item.status === 'failed';
          const isCancelled = item.status === 'cancelled';
          const isReceiving = item.direction === 'received';
          const isInProgress = !isDone && !isFailed && !isCancelled;

          return (
            <article
              key={item.id}
              className={`queue-row ${isDone ? 'queue-row-done' : ''} ${
                isFailed || isCancelled ? 'queue-row-terminal' : ''
              }`}
              role="listitem"
            >
              <div className="queue-row-main">
                <div className="queue-row-meta">
                  <span
                    className={`badge ${
                      isReceiving ? 'badge-ok' : 'badge-accent'
                    }`}
                  >
                    {isReceiving ? 'Receiving' : 'Sending'}
                  </span>

                  <span className="queue-filename" title={item.name}>
                    {item.name}
                  </span>

                  <span className="queue-filesize font-mono">
                    {formatBytes(item.size || item.total)}
                  </span>
                </div>

                <div className="queue-row-actions">
                  {isDone && isReceiving && item.blob && (
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      className="btn btn-primary btn-sm"
                      aria-label={`Save ${item.name}`}
                    >
                      <Download size={14} strokeWidth={1.5} />
                      <span>Save file</span>
                    </button>
                  )}

                  {isInProgress && onCancel && (
                    <button
                      type="button"
                      onClick={() => onCancel(item.id)}
                      className="btn btn-secondary btn-sm"
                      aria-label={`Cancel transfer for ${item.name}`}
                    >
                      <X size={14} strokeWidth={1.5} />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>

              {isInProgress && (
                <div className="queue-progress-group">
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuenow={item.percent || 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Transfer progress for ${item.name}`}
                  >
                    <div
                      className="progress-fill"
                      style={{ width: `${item.percent || 0}%` }}
                    />
                  </div>

                  <div className="queue-progress-metrics font-mono">
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
                <div className="queue-summary-line font-mono">
                  <span className="text-ok">Completed</span>
                  {item.avgSpeedBps > 0 && <span>Avg: {formatSpeed(item.avgSpeedBps)}</span>}
                  {item.durationMs > 0 && (
                    <span>Time: {(item.durationMs / 1000).toFixed(1)}s</span>
                  )}
                  {item.sha256 && (
                    <span title={`SHA-256: ${item.sha256}`}>
                      SHA: {item.sha256.substring(0, 10)}...
                    </span>
                  )}
                </div>
              )}

              {(isFailed || isCancelled) && (
                <div className="queue-summary-line">
                  <span className={isCancelled ? 'text-muted' : 'text-bad'}>
                    {isCancelled ? 'Cancelled' : (item.error || 'Transfer failed')}
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default TransferQueue;
