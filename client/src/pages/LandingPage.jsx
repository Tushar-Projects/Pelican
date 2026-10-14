import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../api/sessions.js';

export function LandingPage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [deviceName, setDeviceName] = useState(() => {
    return localStorage.getItem('droprelay_device_name') || 'Web Client';
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateSession = async () => {
    try {
      setIsCreating(true);
      setError(null);
      localStorage.setItem('droprelay_device_name', deviceName.trim());
      const session = await createSession();
      navigate(`/session/${session.code}`);
    } catch (err) {
      setError(err.message || 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSession = (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-character session code');
      return;
    }
    localStorage.setItem('droprelay_device_name', deviceName.trim());
    navigate(`/session/${code}`);
  };

  return (
    <div className="landing-page">
      <div className="hero-section">
        <h1 className="hero-title">
          Fast, Direct P2P File Sharing in Your Browser
        </h1>
        <p className="hero-subtitle">
          Transfer any file directly between two devices using WebRTC Data Channels.
          No cloud storage, no size caps, and end-to-end verified with SHA-256.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="device-name-config">
        <label className="input-label" htmlFor="deviceNameInput">
          Your Device Name:
        </label>
        <input
          id="deviceNameInput"
          type="text"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="e.g. Chrome on Windows"
          className="text-input"
        />
      </div>

      <div className="cards-grid">
        {/* Create Session Card */}
        <div className="action-card">
          <div className="card-icon">🚀</div>
          <h2 className="card-title">Send Files (Create Session)</h2>
          <p className="card-description">
            Generate a unique 6-character session code or QR code and share it with the recipient.
          </p>
          <button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="btn-primary btn-block btn-lg"
          >
            {isCreating ? 'Creating Session...' : 'Create New Session'}
          </button>
        </div>

        {/* Join Session Card */}
        <div className="action-card">
          <div className="card-icon">🔗</div>
          <h2 className="card-title">Receive Files (Join Session)</h2>
          <p className="card-description">
            Have a code from a sender? Enter the 6-character code to connect immediately.
          </p>
          <form onSubmit={handleJoinSession} className="join-form">
            <input
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC234"
              className="text-input text-center text-code"
            />
            <button
              type="submit"
              disabled={joinCode.trim().length !== 6}
              className="btn-secondary btn-block btn-lg"
            >
              Join Session
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
