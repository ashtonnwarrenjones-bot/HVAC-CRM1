import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Logo from './components/Logo';
import axios from 'axios';
import {
  LayoutDashboard, Calendar, Target, Building2, Users,
  FileText, BarChart2, Settings as SettingsIcon, Globe,
  Bell, LogOut, Menu, X, CheckCircle, Clock, Trash2
} from 'lucide-react';
import Login from './pages/Login';
import Portal from './pages/Portal';
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
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { to: '/schedule', label: 'Schedule', Icon: Calendar },
  { to: '/pipeline', label: 'Pipeline', Icon: Target },
  { to: '/companies', label: 'Companies', Icon: Building2 },
  { to: '/contacts', label: 'Contacts', Icon: Users },
  { to: '/proposals', label: 'Proposals', Icon: FileText },
  { to: '/analytics', label: 'Analytics', Icon: BarChart2 },
];

function NotificationsPanel({ onClose }) {
  const [data, setData] = useState({ notifications: [], unread: 0 });

  const load = () => axios.get('/api/notifications').then(r => setData(r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await axios.put('/api/notifications/read-all');
    load();
  };

  const markRead = async (id) => {
    await axios.put(`/api/notifications/${id}/read`);
    load();
  };

  const dismiss = async (id, e) => {
    e.stopPropagation();
    await axios.delete(`/api/notifications/${id}`);
    load();
  };

  const typeIcon = (type) => type === 'proposal_signed'
    ? <CheckCircle size={15} color="#16a34a" />
    : type === 'job_scheduled'
    ? <Calendar size={15} color="#2563eb" />
    : <Bell size={15} color="#6b7280" />;

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
      background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      border: '1px solid #e5e7eb', zIndex: 1000, maxHeight: 380, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>Notifications</span>
        {data.unread > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Mark all read
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {data.notifications.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: 13 }}>No notifications yet</div>
        ) : data.notifications.map(n => (
          <div key={n.id}
            onClick={() => markRead(n.id)}
            style={{
              padding: '10px 14px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
              background: n.read_at ? 'transparent' : '#eff6ff',
              display: 'flex', gap: 8, alignItems: 'flex-start'
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>{typeIcon(n.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: n.read_at ? 500 : 700, color: '#111', lineHeight: 1.4 }}>{n.title}</div>
              {n.message && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{n.message}</div>}
              {n.sales_rep_name && <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>Rep: {n.sales_rep_name}</div>}
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{new Date(n.created_at).toLocaleString()}</div>
            </div>
            <button onClick={(e) => dismiss(n.id, e)} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', padding: '0 2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppLayout() {
  const { token, username, logout, isDemo } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifsRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const poll = () => axios.get('/api/notifications').then(r => setUnreadCount(r.data.unread)).catch(() => {});
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!token) return <Login />;

  function closeMenu() { setMenuOpen(false); }

  return (
    <div className="layout">

      {/* ── Mobile top bar ── */}
      <div className="mobile-header">
        <div className="mobile-logo"><Logo size={30} variant="white" subtitle={null} /></div>
        <button
          className="mobile-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Open menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
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
          <Logo size={36} variant="white" subtitle="Field Service CRM" />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, paddingLeft: 2, fontStyle: 'italic', lineHeight: 1.4 }}>
            Linking you to your customers
          </div>
        </div>
        <div className="sidebar-nav">
          {NAV.map(({ to, label, Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={closeMenu}
            >
              <span className="nav-icon"><Icon size={17} /></span>
              {label}
            </NavLink>
          ))}
        </div>
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <a
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 6, color: 'rgba(255,255,255,.7)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 500 }}
          >
            <span className="nav-icon"><Globe size={17} /></span>
            Customer Portal
          </a>
          <NavLink
            to="/settings"
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 6, color: 'rgba(255,255,255,.7)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 500 }}
          >
            <span className="nav-icon"><SettingsIcon size={17} /></span>
            Settings
          </NavLink>
        </div>
        <div style={{ padding: '8px 12px 4px', borderTop: '1px solid rgba(255,255,255,.08)', position: 'relative' }} ref={notifsRef}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6, paddingLeft: 4 }}>
            Signed in as <strong style={{ color: 'rgba(255,255,255,.7)' }}>{username}</strong>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setShowNotifs(o => !o); setUnreadCount(0); }}
              style={{
                flex: '0 0 auto', padding: '7px 10px', background: showNotifs ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: 'rgba(255,255,255,.8)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, position: 'relative'
              }}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { logout(); closeMenu(); }}
              style={{
                flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: 'rgba(255,255,255,.6)',
                fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
          {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
        </div>
        <div style={{ padding: '8px 16px 12px', fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
          v4.0 • Conduit
        </div>
      </nav>

      {/* ── Demo mode banner ── */}
      {isDemo && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: '#1d4ed8', color: '#fff', textAlign: 'center', padding: '10px 16px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span>👁️ Demo Mode — Read Only</span>
          <span style={{ opacity: .7, fontWeight: 400 }}>Login: <strong>demo</strong> · Password: <strong>demo123</strong></span>
        </div>
      )}

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
          {/* Customer portal — has its own auth */}
          <Route path="/portal/*" element={<Portal />} />
          {/* All other routes go through the authenticated layout */}
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
