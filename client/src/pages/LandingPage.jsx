import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../api/sessions.js';
import { getDeviceName, setDeviceName as persistDeviceName } from '../utils/deviceName.js';

export function LandingPage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [deviceName, setDeviceName] = useState(() => getDeviceName('Web Client'));
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Pelican';
  }, []);

  const handleCreateSession = async () => {
    try {
      setIsCreating(true);
      setError(null);
      persistDeviceName(deviceName);
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
    persistDeviceName(deviceName);
    navigate(`/session/${code}`);
  };

  return (
    <div className="landing-layout">
      <div className="landing-header">
        <h1 className="landing-title">Send files directly between devices.</h1>
        <p className="landing-subtitle">Nothing is stored on our server.</p>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-group">
        <label className="input-label" htmlFor="deviceNameInput">
          This device
        </label>
        <input
          id="deviceNameInput"
          type="text"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="e.g. Chrome on Windows"
          className="input-text"
          autoComplete="off"
        />
      </div>

      <div className="landing-actions">
        <button
          type="button"
          onClick={handleCreateSession}
          disabled={isCreating}
          className="btn btn-primary btn-block btn-lg"
        >
          {isCreating ? 'Creating session...' : 'New session'}
        </button>

        <div className="divider-row">
          <span className="divider-line" />
          <span className="divider-text">or join an existing session</span>
          <span className="divider-line" />
        </div>

        <form onSubmit={handleJoinSession} className="join-form">
          <div className="form-group">
            <label className="input-label sr-only" htmlFor="joinCodeInput">
              Session code
            </label>
            <input
              id="joinCodeInput"
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC234"
              className="input-text input-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
          <button
            type="submit"
            disabled={joinCode.trim().length !== 6}
            className="btn btn-secondary btn-block btn-lg"
          >
            Join session
          </button>
        </form>
      </div>
    </div>
  );
}

export default LandingPage;
