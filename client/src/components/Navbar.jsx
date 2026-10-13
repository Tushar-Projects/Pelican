import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => (location.pathname === path ? 'active-link' : '');

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="brand-logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="brand-title">DropRelay</span>
        </Link>

        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            Transfer
          </Link>

          {isAuthenticated && (
            <>
              <Link to="/history" className={`nav-link ${isActive('/history')}`}>
                History
              </Link>
              <Link to="/devices" className={`nav-link ${isActive('/devices')}`}>
                Devices
              </Link>
            </>
          )}
        </div>

        <div className="nav-auth">
          {isAuthenticated ? (
            <div className="auth-profile">
              <span className="user-greeting">
                👤 <strong>{user?.name || user?.email}</strong>
              </span>
              <button onClick={logout} className="btn-secondary btn-sm">
                Log Out
              </button>
            </div>
          ) : (
            <div className="auth-actions">
              <Link to="/login" className="btn-secondary btn-sm">
                Log In
              </Link>
              <Link to="/register" className="btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
