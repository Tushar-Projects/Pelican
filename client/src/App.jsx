import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import SessionPage from './pages/SessionPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import DevicesPage from './pages/DevicesPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

export function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/session/:code" element={<SessionPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>Files go directly between devices. Nothing is stored on our server.</p>
      </footer>
    </div>
  );
}

export default App;
