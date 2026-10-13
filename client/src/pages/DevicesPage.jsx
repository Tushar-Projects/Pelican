import React, { useState, useEffect } from 'react';
import { getDevices, registerDevice, updateDevice, deleteDevice } from '../api/devices.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

export function DevicesPage() {
  const { isAuthenticated } = useAuth();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Device Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

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
      const device = await registerDevice({
        name: newName.trim(),
        deviceKey: newKey.trim(),
      });
      setDevices((prev) => [device, ...prev]);
      setNewName('');
      setNewKey('');
      setShowAddForm(false);
    } catch (err) {
      alert(err.message || 'Failed to register device');
    }
  };

  const handleToggleTrust = async (device) => {
    try {
      const updated = await updateDevice(device._id, {
        trusted: !device.trusted,
      });
      setDevices((prev) =>
        prev.map((d) => (d._id === device._id ? updated : d))
      );
    } catch (err) {
      alert(err.message || 'Failed to update trust status');
    }
  };

  const handleSaveRename = async (id) => {
    if (!editName.trim()) return;
    try {
      const updated = await updateDevice(id, { name: editName.trim() });
      setDevices((prev) => prev.map((d) => (d._id === id ? updated : d)));
      setEditingId(null);
    } catch (err) {
      alert(err.message || 'Failed to rename device');
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Delete this registered device?')) return;
    try {
      await deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete device');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-required-view">
        <h2>Authentication Required</h2>
        <p>Please log in to manage your registered devices.</p>
        <Link to="/login" className="btn-primary mt-4">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="devices-page">
      <div className="devices-header">
        <div>
          <h1 className="page-title">Trusted Devices</h1>
          <p className="page-subtitle">Manage known browsers and machines paired with your account</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary btn-sm"
        >
          {showAddForm ? 'Cancel' : '+ Register Device'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Add Device Form */}
      {showAddForm && (
        <form onSubmit={handleAddDevice} className="add-device-card">
          <h3 className="card-subtitle">Register New Device</h3>
          <div className="form-row">
            <input
              type="text"
              placeholder="Device name (e.g. MacBook Pro M2)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-input"
              required
            />
            <input
              type="text"
              placeholder="Device unique key / identifier"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="text-input"
              required
            />
            <button type="submit" className="btn-primary btn-sm">
              Save
            </button>
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
        <div className="devices-grid">
          {devices.map((device) => {
            const isEditing = editingId === device._id;

            return (
              <div key={device._id} className="device-card">
                <div className="device-card-header">
                  <div className="device-icon">💻</div>
                  <div className="device-main-info">
                    {isEditing ? (
                      <div className="rename-group">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-input text-input-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(device._id)}
                          className="btn-primary btn-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="device-name-row">
                        <h3 className="device-name">{device.name}</h3>
                        <button
                          onClick={() => {
                            setEditingId(device._id);
                            setEditName(device.name);
                          }}
                          className="btn-text"
                          title="Rename device"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    <span className="device-key-text">Key: {device.deviceKey}</span>
                  </div>
                </div>

                <div className="device-meta-row">
                  <span className="last-seen">
                    Last active: {new Date(device.lastSeenAt).toLocaleDateString()}
                  </span>

                  <div className="device-card-actions">
                    <button
                      onClick={() => handleToggleTrust(device)}
                      className={`btn-sm ${device.trusted ? 'btn-trust-active' : 'btn-secondary'}`}
                    >
                      {device.trusted ? '🛡️ Trusted' : 'Mark Trusted'}
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device._id)}
                      className="btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DevicesPage;
