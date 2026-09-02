import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Logo from './components/Logo';
import axios from 'axios';
import {
  LayoutDashboard, Calendar, Target, Building2, Users,
  FileText, BarChart2, Settings as SettingsIcon, Globe,
  Bell, LogOut, Menu, X, CheckCircle, Clock, Trash2,
  Search, Wrench, Receipt, Command, Sun, Moon,
  BookOpen, Shield, Trello, Truck
} from 'lucide-react';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
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
import Equipment from './pages/Equipment';
import Invoices from './pages/Invoices';
import DispatchBoard from './pages/DispatchBoard';
import Pricebook from './pages/Pricebook';
import Memberships from './pages/Memberships';
import MyJobs from './pages/MyJobs';
import ServiceRequests from './pages/ServiceRequests';
import JobReport from './pages/JobReport';
import Vendors from './pages/Vendors';

const ALL_NAV = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard, exact: true, roles: ['admin', 'sales_rep', 'dispatcher', 'demo'] },
  { to: '/my-jobs', label: 'My Jobs', Icon: Wrench, roles: ['technician'] },
  { to: '/dispatch', label: 'Dispatch', Icon: Trello, roles: ['admin', 'dispatcher', 'demo'] },
  { to: '/schedule', label: 'Schedule', Icon: Calendar, roles: ['admin', 'dispatcher', 'demo'] },
  { to: '/pipeline', label: 'Pipeline', Icon: Target, roles: ['admin', 'sales_rep', 'demo'] },
  { to: '/companies', label: 'Companies', Icon: Building2, roles: ['admin', 'sales_rep', 'dispatcher', 'demo'] },
  { to: '/contacts', label: 'Contacts', Icon: Users, roles: ['admin', 'sales_rep', 'dispatcher', 'demo'] },
  { to: '/proposals', label: 'Proposals', Icon: FileText, roles: ['admin', 'sales_rep', 'demo'] },
  { to: '/service-requests', label: 'Quote Requests', Icon: FileText, roles: ['admin', 'sales_rep'] },
  { to: '/invoices', label: 'Invoices', Icon: Receipt, roles: ['admin', 'dispatcher', 'demo'] },
  { to: '/memberships', label: 'Memberships', Icon: Shield, roles: ['admin', 'dispatcher', 'demo'] },
  { to: '/pricebook', label: 'Pricebook', Icon: BookOpen, roles: ['admin', 'demo'] },
  { to: '/vendors', label: 'Vendors', Icon: Truck, roles: ['admin', 'dispatcher'] },
  { to: '/analytics', label: 'Analytics', Icon: BarChart2, roles: ['admin', 'sales_rep', 'demo'] },
];

// ─── Dark mode hook ───────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('crm_theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('crm_theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  return [dark, setDark];
}

// ─── Global Search ────────────────────────────────────────────────────────────
function GlobalSearch({ onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();
  const navigate = useNavigate();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (q.length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      setLoading(true);
      axios.get('/api/search', { params: { q } })
        .then(r => setResults(r.data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (path) => { navigate(path); onClose(); };

  const total = results
    ? (results.companies?.length + results.contacts?.length + results.proposals?.length + results.jobs?.length)
    : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 560,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search companies, contacts, proposals, jobs…"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15,
              background: 'transparent', color: 'var(--text-primary)'
            }}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</span>}
          <kbd style={{ fontSize: 11, background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-muted)' }}>Esc</kbd>
        </div>
        {results && (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {total === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No results for "{q}"</div>
            )}
            {results.companies?.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Companies</div>
                {results.companies.map(c => (
                  <div key={c.id} onClick={() => go(`/companies/${c.id}`)}
                    style={{ padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    className="search-result-row"
                  >
                    <Building2 size={15} style={{ color: 'var(--blue-600)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
                      {(c.city || c.state) && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[c.city, c.state].filter(Boolean).join(', ')}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {results.contacts?.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Contacts</div>
                {results.contacts.map(c => (
                  <div key={c.id} onClick={() => go(`/companies/${c.company_id}`)}
                    style={{ padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    className="search-result-row"
                  >
                    <Users size={15} style={{ color: '#7c3aed', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.title}{c.company_name ? ` · ${c.company_name}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {results.proposals?.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Proposals</div>
                {results.proposals.map(p => (
                  <div key={p.id} onClick={() => go(`/proposals/${p.id}`)}
                    style={{ padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    className="search-result-row"
                  >
                    <FileText size={15} style={{ color: '#0891b2', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.proposal_number} · {p.company_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {results.jobs?.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Jobs</div>
                {results.jobs.map(j => (
                  <div key={j.id} onClick={() => go('/schedule')}
                    style={{ padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    className="search-result-row"
                  >
                    <Calendar size={15} style={{ color: 'var(--green-600)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{j.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.company_name}{j.technician ? ` · ${j.technician}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!results && q.length < 2 && (
          <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            Type at least 2 characters to search across your CRM data.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────
function NotificationsPanel({ onClose }) {
  const [data, setData] = useState({ notifications: [], unread: 0 });

  const load = () => axios.get('/api/notifications').then(r => setData(r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  const markAllRead = async () => { await axios.put('/api/notifications/read-all'); load(); };
  const markRead   = async (id) => { await axios.put(`/api/notifications/${id}/read`); load(); };
  const dismiss    = async (id, e) => { e.stopPropagation(); await axios.delete(`/api/notifications/${id}`); load(); };

  const typeIcon = (type) => type === 'proposal_signed'
    ? <CheckCircle size={15} color="#16a34a" />
    : type === 'job_scheduled'
    ? <Calendar size={15} color="#2563eb" />
    : <Bell size={15} color="#6b7280" />;

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
      background: 'var(--bg-card)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      border: '1px solid var(--border)', zIndex: 1000, maxHeight: 380, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Notifications</span>
        {data.unread > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--blue-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Mark all read
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {data.notifications.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notifications yet</div>
        ) : data.notifications.map(n => (
          <div key={n.id}
            onClick={() => markRead(n.id)}
            style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
              background: n.read_at ? 'transparent' : 'var(--blue-50)',
              display: 'flex', gap: 8, alignItems: 'flex-start'
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>{typeIcon(n.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: n.read_at ? 500 : 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.title}</div>
              {n.message && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{n.message}</div>}
              {n.sales_rep_name && <div style={{ fontSize: 11, color: 'var(--blue-600)', marginTop: 2 }}>Rep: {n.sales_rep_name}</div>}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{new Date(n.created_at).toLocaleString()}</div>
            </div>
            <button onClick={(e) => dismiss(n.id, e)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App Layout ───────────────────────────────────────────────────────────────
function AppLayout() {
  const { token, username, logout, isDemo, role } = useAuth();
  const NAV = ALL_NAV.filter(item => item.roles.includes(role || 'admin'));
  const [menuOpen, setMenuOpen]   = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dark, setDark] = useDarkMode();
  const notifsRef = useRef(null);

  // ⌘K / Ctrl+K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="mobile-hamburger"
            onClick={() => setShowSearch(true)}
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <button
            className="mobile-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Open menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Sidebar backdrop (mobile only) ── */}
      <div className={`sidebar-backdrop${menuOpen ? ' open' : ''}`} onClick={closeMenu} />

      {/* ── Sidebar ── */}
      <nav className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <Logo size={36} variant="white" subtitle="Field Service CRM" />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, paddingLeft: 2, fontStyle: 'italic', lineHeight: 1.4 }}>
            Linking you to your customers
          </div>
        </div>

        {/* Search button in sidebar */}
        <div style={{ padding: '8px 8px 0' }}>
          <button
            onClick={() => { setShowSearch(true); closeMenu(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)',
              background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.6)',
              fontSize: 13, cursor: 'pointer', textAlign: 'left'
            }}
          >
            <Search size={14} />
            <span style={{ flex: 1 }}>Quick search…</span>
            <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,.1)', borderRadius: 3, padding: '1px 5px', color: 'rgba(255,255,255,.5)' }}>⌘K</kbd>
          </button>
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
            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                flex: '0 0 auto', padding: '7px 10px', background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: 'rgba(255,255,255,.7)',
                cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
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
          v5.0 • Conduit
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
          <Route path="/" element={role === 'technician' ? <Navigate to="/my-jobs" replace /> : <Dashboard />} />
          <Route path="/my-jobs" element={<MyJobs />} />
          <Route path="/service-requests" element={<ServiceRequests />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/proposals/:id" element={<ProposalDetail />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/dispatch" element={<DispatchBoard />} />
          <Route path="/pricebook" element={<Pricebook />} />
          <Route path="/memberships" element={<Memberships />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/job-report/:id" element={<JobReport />} />
          <Route path="*" element={<Navigate to={role === 'technician' ? '/my-jobs' : '/'} replace />} />
        </Routes>
      </main>

      {/* ── Global Search overlay ── */}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
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
          {/* Password reset flow — public */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Job report — renders inside app layout (auth required) */}
          {/* All other routes go through the authenticated layout */}
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
