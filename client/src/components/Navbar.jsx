import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobilePanelRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle Escape and focus trap in mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && mobilePanelRef.current) {
        const focusables = Array.from(
          mobilePanelRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const isActive = (path) => (location.pathname === path ? 'active' : '');

  return (
    <header className="navbar">
      <div className="nav-container">
        {/* Wordmark (Text only, no illustration) */}
        <Link to="/" className="nav-brand">
          Pelican
        </Link>

        {/* Desktop Navigation (>= 768px) */}
        <div className="nav-desktop-group">
          <nav className="nav-links" aria-label="Main navigation">
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
          </nav>

          <div className="nav-actions">
            <ThemeToggle />

            {isAuthenticated ? (
              <>
                <span className="nav-user" title={user?.name || user?.email}>
                  {user?.name || user?.email}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="btn btn-secondary btn-sm"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Controls (< 768px) */}
        <div className="nav-mobile-controls">
          <ThemeToggle />
          <button
            ref={menuButtonRef}
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel (Instant appearance/disappearance, no slide) */}
      {mobileMenuOpen && (
        <div className="mobile-menu-panel" ref={mobilePanelRef}>
          <Link to="/" className={`mobile-nav-link ${isActive('/')}`}>
            Transfer
          </Link>

          {isAuthenticated ? (
            <>
              <Link to="/history" className={`mobile-nav-link ${isActive('/history')}`}>
                History
              </Link>
              <Link to="/devices" className={`mobile-nav-link ${isActive('/devices')}`}>
                Devices
              </Link>
              <div className="mobile-auth-divider" />
              <div className="mobile-user-row">
                <span>{user?.name || user?.email}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="btn btn-secondary btn-sm"
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mobile-auth-divider" />
              <Link to="/login" className="btn btn-secondary btn-block">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-block">
                Create account
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default Navbar;
