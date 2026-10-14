import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found - Pelican';
  }, []);

  return (
    <div className="not-found-layout">
      <h1 className="not-found-title">Page not found</h1>
      <p className="not-found-text">
        The page you are looking for does not exist or has moved.
      </p>
      <Link to="/" className="btn btn-primary btn-lg">
        Return home
      </Link>
    </div>
  );
}

export default NotFoundPage;
