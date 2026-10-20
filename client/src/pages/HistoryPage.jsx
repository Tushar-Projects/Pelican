import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { getTransfers, deleteTransfer, clearAllTransfers, toLocalStartOfDayIso, toLocalEndOfDayIso } from '../api/transfers.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

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

function getStatusBadgeClass(status) {
  switch (status) {
    case 'completed':
      return 'badge-ok';
    case 'failed':
      return 'badge-bad';
    case 'cancelled':
      return 'badge-muted';
    default:
      return 'badge-muted';
  }
}

export function HistoryPage() {
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Confirmation dialogs
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  useEffect(() => {
    document.title = 'History - Pelican';
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit,
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.from = toLocalStartOfDayIso(fromDate);
      if (toDate) params.to = toLocalEndOfDayIso(toDate);

      const data = await getTransfers(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load transfer history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [page, statusFilter, isAuthenticated]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const confirmDeleteItem = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteTransfer(deleteTargetId);
      setItems((prev) => prev.filter((item) => item._id !== deleteTargetId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || 'Failed to delete record');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const confirmClearAll = async () => {
    try {
      await clearAllTransfers();
      setItems([]);
      setTotal(0);
    } catch (err) {
      setError(err.message || 'Failed to clear transfer history');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-required-view">
        <h2 className="auth-required-title">Authentication required</h2>
        <p className="auth-required-text">Please log in to view your transfer logs and history.</p>
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="history-layout">
      <div className="history-header">
        <div className="history-title-group">
          <h1 className="history-title">Transfer history</h1>
          <p className="history-subtitle">
            Track and audit your sent and received files ({total} {total === 1 ? 'record' : 'records'})
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="btn btn-danger btn-sm"
          >
            Clear all history
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <form onSubmit={handleSearchSubmit} className="history-filter-bar">
        <input
          type="text"
          placeholder="Search by file, session, or device..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-text filter-search-input"
          aria-label="Search transfers"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="select-input filter-status-select"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="date-input filter-date-input"
          title="From date"
          aria-label="From date"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="date-input filter-date-input"
          title="To date"
          aria-label="To date"
        />

        <button type="submit" className="btn btn-primary btn-sm filter-btn">
          Filter
        </button>
      </form>

      {/* Results Content */}
      {loading ? (
        <div className="loading-state">Loading transfer history...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>No transfer records found.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table (>= 768px) */}
          <div className="history-desktop-table">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Direction</th>
                  <th scope="col">File name</th>
                  <th scope="col">Size</th>
                  <th scope="col">Session</th>
                  <th scope="col">Device</th>
                  <th scope="col">Status</th>
                  <th scope="col">Speed</th>
                  <th scope="col">Date</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <span
                        className={`badge ${
                          item.direction === 'received' ? 'badge-ok' : 'badge-accent'
                        }`}
                      >
                        {item.direction === 'received' ? (
                          <>
                            <ArrowDownLeft size={12} strokeWidth={1.5} aria-hidden="true" />
                            <span>Received</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight size={12} strokeWidth={1.5} aria-hidden="true" />
                            <span>Sent</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="history-filename" title={item.fileName}>
                      {item.fileName}
                    </td>
                    <td className="font-mono">{formatBytes(item.fileSize)}</td>
                    <td>
                      <span className="history-session-tag">{item.sessionCode}</span>
                    </td>
                    <td>{item.deviceName || '—'}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="font-mono">{formatSpeed(item.avgSpeedBps)}</td>
                    <td className="font-mono">
                      {new Date(item.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(item._id)}
                        className="btn btn-ghost btn-sm"
                        title="Delete record"
                        aria-label={`Delete transfer record for ${item.fileName}`}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked List (< 768px) */}
          <div className="history-mobile-list" role="list">
            {items.map((item) => (
              <article key={item._id} className="history-mobile-card" role="listitem">
                <div className="history-mobile-top">
                  <span
                    className={`badge ${
                      item.direction === 'received' ? 'badge-ok' : 'badge-accent'
                    }`}
                  >
                    {item.direction === 'received' ? (
                      <>
                        <ArrowDownLeft size={12} strokeWidth={1.5} aria-hidden="true" />
                        <span>Received</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight size={12} strokeWidth={1.5} aria-hidden="true" />
                        <span>Sent</span>
                      </>
                    )}
                  </span>
                  <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="history-mobile-file">{item.fileName}</div>

                <div className="history-mobile-meta font-mono">
                  <span>{formatBytes(item.fileSize)}</span>
                  <span>•</span>
                  <span>Code: {item.sessionCode}</span>
                  {item.deviceName && (
                    <>
                      <span>•</span>
                      <span>{item.deviceName}</span>
                    </>
                  )}
                  {item.avgSpeedBps > 0 && (
                    <>
                      <span>•</span>
                      <span>{formatSpeed(item.avgSpeedBps)}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="history-mobile-actions">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(item._id)}
                    className="btn btn-secondary btn-sm"
                    aria-label={`Delete transfer record for ${item.fileName}`}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span className="pagination-info font-mono">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearAll}
        title="Clear all history"
        message="Are you sure you want to delete all transfer logs? This action cannot be undone."
        confirmText="Clear all"
        danger={true}
      />

      {/* Single Item Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteItem}
        title="Delete transfer record"
        message="Are you sure you want to delete this transfer log?"
        confirmText="Delete"
        danger={true}
      />
    </div>
  );
}

export default HistoryPage;
