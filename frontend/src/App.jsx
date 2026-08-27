import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Contacts from './pages/Contacts';
import Proposals from './pages/Proposals';
import ProposalDetail from './pages/ProposalDetail';
import Pipeline from './pages/Pipeline';
import Settings from './pages/Settings';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/pipeline', label: 'Pipeline', icon: '🎯' },
  { to: '/companies', label: 'Companies', icon: '🏢' },
  { to: '/contacts', label: 'Contacts', icon: '👤' },
  { to: '/proposals', label: 'Proposals', icon: '📋' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <nav className="sidebar">
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
              >
                <span className="nav-icon">{icon}</span>
                {label}
              </NavLink>
            ))}
          </div>
          <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 6, color: 'rgba(255,255,255,.7)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 500 }}>
              <span className="nav-icon">⚙️</span>
              Settings
            </NavLink>
          </div>
          <div style={{ padding: '8px 16px 12px', fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
            v2.0 • HVAC & Plumbing CRM
          </div>
        </nav>

        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/proposals" element={<Proposals />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
