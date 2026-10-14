import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    try {
      const activeTheme = document.documentElement.getAttribute('data-theme') ||
        localStorage.getItem('pelican_theme') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(activeTheme);
    } catch (e) {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);

    // Update meta theme-color content
    try {
      localStorage.setItem('pelican_theme', nextTheme);
      const metaDark = document.getElementById('meta-theme-dark');
      const metaLight = document.getElementById('meta-theme-light');
      if (nextTheme === 'dark') {
        if (metaDark) metaDark.content = '#1C1917';
        if (metaLight) metaLight.content = '#1C1917';
      } else {
        if (metaDark) metaDark.content = '#FAFAF9';
        if (metaLight) metaLight.content = '#FAFAF9';
      }
    } catch (e) {
      // Storage unavailable in private browsing mode
    }
  };

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn btn-ghost btn-icon"
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
    </button>
  );
}

export default ThemeToggle;
