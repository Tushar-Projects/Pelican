import React from 'react';

const STATUS_CONFIG = {
  connecting: { label: 'Connecting...', className: 'badge-warn' },
  'waiting-peer': { label: 'Waiting for the other device', className: 'badge-accent' },
  connected: { label: 'Connected', className: 'badge-ok' },
  disconnected: { label: 'Peer disconnected', className: 'badge-muted' },
  failed: { label: 'Connection failed', className: 'badge-bad' },
};

export function StatusBadge({ status = 'connecting' }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: 'badge-muted',
  };

  return (
    <div className={`badge ${config.className}`} data-status={status}>
      <span className="status-dot" aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  );
}

export default StatusBadge;
