import React, { useState, useEffect } from 'react';
import CameraView   from './components/CameraView';
import ChatView     from './components/ChatView';
import AdminPanel   from './components/AdminPanel';
import './App.css';

const App = () => {
  const [isStudentPresent, setIsStudentPresent] = useState(false);
  const [serverStatus,     setServerStatus]     = useState('checking');
  const [currentTime,      setCurrentTime]      = useState(new Date());
  const [currentStudent,   setCurrentStudent]   = useState(null);  // Faol o'quvchi
  const [showAdmin,        setShowAdmin]         = useState(false); // Admin panel holati

  // ── Server holati tekshiruvi ────────────────────────────────────────────────
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        setServerStatus(res.ok ? 'online' : 'offline');
      } catch {
        setServerStatus('offline');
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Soat ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) =>
    date.toLocaleDateString('uz-UZ', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  const formatTime = (date) =>
    date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="app">
      {/* ─── Animatsion fon nurlari ───────────────────────────────────── */}
      <div className="bg-orbs">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="bg-orb orb-3" />
      </div>

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">🎓</div>
            <div className="logo-text">
              <span className="logo-title text-gradient">Ziyo AI Maktab</span>
              <span className="logo-sub">7-sinf Algebra • Virtual Ta'lim</span>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="datetime-display">
            <div className="time-text">{formatTime(currentTime)}</div>
            <div className="date-text">{formatDate(currentTime)}</div>
          </div>
        </div>

        <div className="header-right">
          {/* Faol o'quvchi */}
          {currentStudent && (
            <div className="active-student-chip">
              {currentStudent.photo ? (
                <img src={currentStudent.photo} alt={currentStudent.firstName} className="chip-photo" />
              ) : (
                <span className="chip-avatar">👤</span>
              )}
              <span className="chip-name">{currentStudent.firstName} {currentStudent.lastName}</span>
            </div>
          )}

          {/* O'quvchi holati */}
          <div className={`student-status-badge ${isStudentPresent ? 'present' : 'absent'}`}>
            <span className="pulse-dot" style={{
              background: isStudentPresent ? '#10b981' : '#f59e0b',
              boxShadow:  isStudentPresent
                ? '0 0 0 0 rgba(16,185,129,0.7)'
                : '0 0 0 0 rgba(245,158,11,0.7)',
            }} />
            <span>{isStudentPresent ? "O'quvchi darsdа" : 'Kutilmoqda'}</span>
          </div>

          {/* Server holati */}
          <div className={`server-status ${serverStatus}`}>
            <span className="pulse-dot" style={{
              background: serverStatus === 'online'  ? '#10b981'
                        : serverStatus === 'offline' ? '#f43f5e' : '#f59e0b',
            }} />
            <span>
              {serverStatus === 'online'   ? 'Server'
               : serverStatus === 'offline' ? 'Offline' : 'Tekshirilmoqda'}
            </span>
          </div>

          {/* ─── Admin Panel tugmasi ─────────────────────────────────── */}
          <button
            className="admin-btn"
            onClick={() => setShowAdmin(true)}
            title="Admin Panel"
          >
            ⚙️ Admin
          </button>
        </div>
      </header>

      {/* ─── Offline banner ──────────────────────────────────────────── */}
      {serverStatus === 'offline' && (
        <div className="offline-banner">
          <span>⚠️</span>
          <span>
            Server ulangmagan! Backend'ni ishga tushiring:{' '}
            <code>cd backend && npm run dev</code>
          </span>
        </div>
      )}

      {/* ─── Asosiy kontent ──────────────────────────────────────────── */}
      <main className="app-main">
        {/* Chat paneli — asosiy bo'lim */}
        <section className="panel chat-panel glass-card">
          <ChatView
            isStudentPresent={isStudentPresent}
            currentStudent={currentStudent}
          />
        </section>
      </main>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <span>🎓 Ziyo AI Maktab &copy; {new Date().getFullYear()}</span>
        <span className="separator">•</span>
        <span>Gemini 2.5 Flash &times; face-api.js &times; React</span>
        <span className="separator">•</span>
        <span>7-sinf Algebra &bull; O'zbek tili</span>
      </footer>

      {/* ─── Admin Panel (modal) ──────────────────────────────────────── */}
      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          onStudentSelect={setCurrentStudent}
          currentStudent={currentStudent}
          onStudentPresenceChange={setIsStudentPresent}
        />
      )}
    </div>
  );
};

export default App;
