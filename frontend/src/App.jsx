import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sign from './pages/Sign';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Contacts from './pages/Contacts';
import Proposals from './pages/Proposals';
import ProposalDetail from './pages/ProposalDetail';
import Pipeline from './pages/Pipeline';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/schedule', label: 'Schedule', icon: '📅' },
  { to: '/pipeline', label: 'Pipeline', icon: '🎯' },
  { to: '/companies', label: 'Companies', icon: '🏢' },
  { to: '/contacts', label: 'Contacts', icon: '👤' },
  { to: '/proposals', label: 'Proposals', icon: '📋' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
];

function AppLayout() {
  const { token, username, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!token) return <Login />;

  function closeMenu() { setMenuOpen(false); }

  return (
    <div className="layout">

      {/* ── Mobile top bar ── */}
      <div className="mobile-header">
        <span className="mobile-logo">🔧 HVAC CRM</span>
        <button
          className="mobile-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Open menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* ── Sidebar backdrop (mobile only) ── */}
      <div
        className={`sidebar-backdrop${menuOpen ? ' open' : ''}`}
        onClick={closeMenu}
      />

      {/* ── Sidebar ── */}
      <nav className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <h1>🔧 HVAC CRM</h1>
          <span>Commercial Services</span>
        </div>
        <div className="sidebar-nav">
          {NAV.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={closeMenu}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <NavLink
            to="/settings"
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 6, color: 'rgba(255,255,255,.7)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 500 }}
          >
            <span className="nav-icon">⚙️</span>
            Settings
          </NavLink>
        </div>
        <div style={{ padding: '8px 12px 4px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6, paddingLeft: 4 }}>
            Signed in as <strong style={{ color: 'rgba(255,255,255,.7)' }}>{username}</strong>
          </div>
          <button
            onClick={() => { logout(); closeMenu(); }}
            style={{
              width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: 'rgba(255,255,255,.6)',
              fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            🚪 Sign Out
          </button>
        </div>
        <div style={{ padding: '8px 16px 12px', fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
          v3.2 • HVAC & Plumbing CRM
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/proposals/:id" element={<ProposalDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public signing page — no auth required */}
          <Route path="/sign/:token" element={<Sign />} />
          {/* All other routes go through the authenticated layout */}
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
