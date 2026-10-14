import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Laptop, Pencil, ShieldCheck, Shield, Trash2, Plus, X } from 'lucide-react';
import { getDevices, registerDevice, updateDevice, deleteDevice } from '../api/devices.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export function DevicesPage() {
  const { isAuthenticated } = useAuth();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Device Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  // Confirmation dialog
  const [deleteTargetDevice, setDeleteTargetDevice] = useState(null);

  useEffect(() => {
    document.title = 'Devices - Pelican';
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDevices();
      setDevices(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load registered devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDevices();
    }
  }, [isAuthenticated]);

  const handleAddDevice = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newKey.trim()) return;

    try {
      setFormSubmitting(true);
      setError(null);
      const device = await registerDevice({
        name: newName.trim(),
        deviceKey: newKey.trim(),
      });
      setDevices((prev) => [device, ...prev]);
      setNewName('');
      setNewKey('');
      setShowAddForm(false);
    } catch (err) {
      setError(err.message || 'Failed to register device');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleTrust = async (device) => {
    try {
      setError(null);
      const updated = await updateDevice(device._id, {
        trusted: !device.trusted,
      });
      setDevices((prev) =>
        prev.map((d) => (d._id === device._id ? updated : d))
      );
    } catch (err) {
      setError(err.message || 'Failed to update trust status');
    }
  };

  const handleSaveRename = async (id) => {
    if (!editName.trim()) return;
    try {
      setError(null);
      const updated = await updateDevice(id, { name: editName.trim() });
      setDevices((prev) => prev.map((d) => (d._id === id ? updated : d)));
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Failed to rename device');
    }
  };

  const confirmDeleteDevice = async () => {
    if (!deleteTargetDevice) return;
    try {
      setError(null);
      await deleteDevice(deleteTargetDevice._id);
      setDevices((prev) => prev.filter((d) => d._id !== deleteTargetDevice._id));
    } catch (err) {
      setError(err.message || 'Failed to delete device');
    } finally {
      setDeleteTargetDevice(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-required-view">
        <h2 className="auth-required-title">Authentication required</h2>
        <p className="auth-required-text">Please log in to manage your registered devices.</p>
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="devices-layout">
      <div className="devices-header">
        <div className="devices-title-group">
          <h1 className="devices-title">Registered devices</h1>
          <p className="devices-subtitle">
            Manage known browsers and machines paired with your account
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary btn-sm"
          aria-expanded={showAddForm}
        >
          {showAddForm ? (
            <>
              <X size={14} strokeWidth={1.5} />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus size={14} strokeWidth={1.5} />
              <span>Register device</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Add Device Form */}
      {showAddForm && (
        <form onSubmit={handleAddDevice} className="device-form-panel">
          <h2 className="device-form-title">Register new device</h2>
          <div className="device-form-row">
            <div className="form-group">
              <label className="input-label" htmlFor="newDeviceName">
                Device name
              </label>
              <input
                id="newDeviceName"
                type="text"
                placeholder="e.g. MacBook Pro, Phone"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-text"
                required
              />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="newDeviceKey">
                Device key / identifier
              </label>
              <input
                id="newDeviceKey"
                type="text"
                placeholder="Unique key or fingerprint"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="input-text"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button
                type="submit"
                disabled={formSubmitting}
                className="btn btn-primary"
              >
                {formSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Devices List */}
      {loading ? (
        <div className="loading-state">Loading registered devices...</div>
      ) : devices.length === 0 ? (
        <div className="empty-state">
          <p>No registered devices yet. Register your current device above.</p>
        </div>
      ) : (
        <div className="devices-grid" role="list">
          {devices.map((device) => {
            const isEditing = editingId === device._id;

            return (
              <article key={device._id} className="device-card" role="listitem">
                <div className="device-card-header">
                  <div className="device-card-icon" aria-hidden="true">
                    <Laptop size={20} strokeWidth={1.5} />
                  </div>
                  <div className="device-card-body">
                    {isEditing ? (
                      <div className="device-rename-form">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input-text device-rename-input"
                          autoFocus
                          aria-label="Edit device name"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(device._id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(device._id)}
                          className="btn btn-primary btn-sm"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="btn btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="device-name-row">
                        <h2 className="device-card-name" title={device.name}>
                          {device.name}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(device._id);
                            setEditName(device.name);
                          }}
                          className="btn btn-ghost btn-sm"
                          title="Rename device"
                          aria-label={`Rename ${device.name}`}
                        >
                          <Pencil size={12} strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                    <span className="device-card-key font-mono" title={device.deviceKey}>
                      Key: {device.deviceKey}
                    </span>
                  </div>
                </div>

                <div className="device-card-footer">
                  <span className="font-mono">
                    Active:{' '}
                    {new Date(device.lastSeenAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>

                  <div className="device-card-actions">
                    <button
                      type="button"
                      onClick={() => handleToggleTrust(device)}
                      className={`btn btn-sm ${
                        device.trusted ? 'btn-secondary' : 'btn-ghost'
                      }`}
                      aria-label={device.trusted ? 'Mark device as untrusted' : 'Mark device as trusted'}
                    >
                      {device.trusted ? (
                        <>
                          <ShieldCheck size={14} strokeWidth={1.5} className="text-ok" />
                          <span>Trusted</span>
                        </>
                      ) : (
                        <>
                          <Shield size={14} strokeWidth={1.5} />
                          <span>Mark trusted</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetDevice(device)}
                      className="btn btn-danger btn-sm"
                      aria-label={`Delete ${device.name}`}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Delete Device Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetDevice)}
        onClose={() => setDeleteTargetDevice(null)}
        onConfirm={confirmDeleteDevice}
        title="Delete registered device"
        message={`Are you sure you want to delete "${deleteTargetDevice?.name}"? You will need to re-register it to connect.`}
        confirmText="Delete"
        danger={true}
      />
    </div>
  );
}

export default DevicesPage;
