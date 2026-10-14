import React, { useState, useEffect } from 'react';
import { getTransfers, deleteTransfer, clearAllTransfers } from '../api/transfers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

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
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

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

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this transfer log?')) return;
    try {
      await deleteTransfer(id);
      setItems((prev) => prev.filter((item) => item._id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear your entire transfer history? This cannot be undone.')) return;
    try {
      await clearAllTransfers();
      setItems([]);
      setTotal(0);
    } catch (err) {
      alert(err.message || 'Failed to clear transfer history');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-required-view">
        <h2>Authentication Required</h2>
        <p>Please log in to view your transfer logs and history.</p>
        <Link to="/login" className="btn-primary mt-4">
          Log In
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1 className="page-title">Transfer History</h1>
          <p className="page-subtitle">Track and audit your sent and received files ({total} records)</p>
        </div>
        {items.length > 0 && (
          <button onClick={handleClearAll} className="btn-danger btn-sm">
            Clear All History
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter Bar */}
      <form onSubmit={handleSearchSubmit} className="filter-bar">
        <input
          type="text"
          placeholder="Search by file, session, or device..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-input filter-search"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="select-input"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="date-input"
          title="From date"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="date-input"
          title="To date"
        />

        <button type="submit" className="btn-primary btn-sm">
          Filter
        </button>
      </form>

      {/* Results Table */}
      {loading ? (
        <div className="loading-state">Loading transfer history...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>No transfer records found.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Direction</th>
                <th>File Name</th>
                <th>Size</th>
                <th>Session</th>
                <th>Device</th>
                <th>Status</th>
                <th>Speed</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>
                    <span
                      className={`direction-badge ${
                        item.direction === 'received' ? 'badge-received' : 'badge-sent'
                      }`}
                    >
                      {item.direction === 'received' ? '📥 Recv' : '📤 Sent'}
                    </span>
                  </td>
                  <td className="font-medium" title={item.fileName}>
                    {item.fileName}
                  </td>
                  <td>{formatBytes(item.fileSize)}</td>
                  <td>
                    <code className="session-code-tag">{item.sessionCode}</code>
                  </td>
                  <td>{item.deviceName || '—'}</td>
                  <td>
                    <span className={`status-pill status-${item.status}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{formatSpeed(item.avgSpeedBps)}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => handleDeleteItem(item._id)}
                      className="btn-text-danger"
                      title="Delete record"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary btn-sm"
          >
            ← Previous
          </button>
          <span className="pagination-text">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary btn-sm"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
