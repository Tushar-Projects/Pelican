import React from 'react';

const STATUS_CONFIG = {
  connecting: { label: 'Connecting...', color: 'bg-amber-500', text: 'text-amber-400' },
  'waiting-peer': { label: 'Waiting for Peer', color: 'bg-sky-500', text: 'text-sky-400' },
  connected: { label: 'Peer Connected', color: 'bg-emerald-500', text: 'text-emerald-400' },
  disconnected: { label: 'Disconnected', color: 'bg-zinc-500', text: 'text-zinc-400' },
  failed: { label: 'Connection Failed', color: 'bg-rose-500', text: 'text-rose-400' },
};

export function StatusBadge({ status = 'connecting' }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'bg-zinc-500',
    text: 'text-zinc-400',
  };

  return (
    <div className="status-badge" data-status={status}>
      <span className="status-dot"></span>
      <span className="status-text">{config.label}</span>
    </div>
  );
}

export default StatusBadge;
