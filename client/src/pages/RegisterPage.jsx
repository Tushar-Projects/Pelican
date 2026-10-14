import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Create account - Pelican';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await register({ name, email, password });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Save transfer history and trusted devices</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="input-label" htmlFor="nameInput">
              Full name
            </label>
            <input
              id="nameInput"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-text"
              placeholder="Alice Johnson"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="emailInput">
              Email address
            </label>
            <input
              id="emailInput"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-text"
              placeholder="alice@example.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="passwordInput">
              Password (min. 6 characters)
            </label>
            <input
              id="passwordInput"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-text"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary btn-block btn-lg"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
