import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Logo from './components/Logo';
import axios from 'axios';
import {
  LayoutDashboard, Calendar, Target, Building2, Users,
  FileText, BarChart2, Settings as SettingsIcon, Globe,
  Bell, LogOut, Menu, X, CheckCircle, Clock, Trash2,
  Search, Wrench, Receipt, Command, Sun, Moon,
  BookOpen, Shield, Trello, Truck, FileUp, ClipboardList, UserCheck, ChevronDown
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
import GuidedTour, { TourLaunchButton } from './components/GuidedTour';
import Integrations from './pages/Integrations';
import Import from './pages/Import';
import Estimates from './pages/Estimates';
import Timesheets from './pages/Timesheets';

const ALL_NAV = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard, exact: true, roles: ['admin', 'sales_rep', 'dispatcher', 'demo'] },
  { to: '/my-jobs', label: 'My Jobs', Icon: Wrench, roles: ['technician'] },
  {
    group: 'clients', label: 'Clients', Icon: Building2, roles: ['admin', 'sales_rep', 'dispatcher', 'demo'],
    children: [
      { to: '/companies', label: 'Client List' },
      { to: '/contacts', label: 'Contacts' },
    ]
  },
  {
    group: 'estimates', label: 'Estimates', Icon: ClipboardList, roles: ['admin', 'sales_rep', 'demo'],
    children: [
      { to: '/estimates', label: 'Estimate List' },
      { to: '/proposals', label: 'Proposals' },
    ]
  },
  { to: '/schedule', label: 'Schedule', Icon: Calendar, roles: ['admin', 'dispatcher', 'demo'] },
  { to: '/invoices', label: 'Invoices', Icon: Receipt, roles: ['admin', 'dispatcher', 'demo'] },
  { to: '/timesheets', label: 'Timesheets', Icon: UserCheck, roles: ['admin', 'dispatcher'] },
  { to: '/pricebook', label: 'Pricebook', Icon: BookOpen, roles: ['admin', 'demo'] },
  { to: '/import', label: 'Import', Icon: FileUp, roles: ['admin'] },
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
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState(['clients', 'estimates']);
  function toggleGroup(g) { setExpandedGroups(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]); }
  const [menuOpen, setMenuOpen]   = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dark, setDark] = useDarkMode();
  const [showTour, setShowTour] = useState(false);

  // Auto-start tour for demo users on first visit
  useEffect(() => {
    if (isDemo || role === 'demo') {
      try {
        if (!localStorage.getItem('crm_tour_seen')) {
          setShowTour(true);
        }
      } catch {}
    }
  }, [isDemo, role]);
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
          <div className="logo-icon"><Logo size={26} variant="white" subtitle={null} showWordmark={false} /></div>
          <span className="logo-text nav-label">Mahalo Pro</span>
        </div>

        <div className="sidebar-nav">
          {NAV.map((item) => {
            if (item.children) {
              const isOpen = expandedGroups.includes(item.group);
              const isGroupActive = item.children.some(c => location.pathname.startsWith(c.to));
              return (
                <div key={item.group} className="nav-group">
                  <button
                    className={`nav-group-trigger${isGroupActive ? ' active' : ''}`}
                    onClick={() => toggleGroup(item.group)}
                  >
                    <span className="nav-icon"><item.Icon size={17} /></span>
                    <span className="nav-label">{item.label}</span>
                    <ChevronDown size={13} className={`nav-chevron${isOpen ? ' open' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="nav-sub">
                      {item.children.map(child => (
                        <NavLink key={child.to} to={child.to}
                          className={({ isActive }) => isActive ? 'active' : ''}
                          onClick={closeMenu}
                        >
                          <span className="nav-sub-dot" />
                          <span className="nav-label">{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                title={item.label}
                className={({ isActive }) => isActive ? 'active' : ''}
                onClick={closeMenu}
              >
                <span className="nav-icon"><item.Icon size={17} /></span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Tour launch button — demo mode only */}
        {(isDemo || role === 'demo') && (
          <div style={{ padding: '8px 8px 0' }}>
            <TourLaunchButton onClick={() => setShowTour(true)} />
          </div>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <a href="/portal" target="_blank" rel="noopener noreferrer" title="Customer Portal" onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,.42)', textDecoration: 'none', transition: 'color .15s', borderRadius: 7, margin: '2px 6px', overflow: 'hidden' }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.8)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.42)'}
          >
            <span className="nav-icon"><Globe size={17} /></span>
            <span className="nav-label">Customer Portal</span>
          </a>
          <NavLink to="/settings" title="Settings" onClick={closeMenu}
            className={({ isActive }) => isActive ? 'active' : ''}
            style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,.42)', textDecoration: 'none', borderRadius: 7, margin: '2px 6px', overflow: 'hidden' }}
          >
            <span className="nav-icon"><SettingsIcon size={17} /></span>
            <span className="nav-label">Settings</span>
          </NavLink>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingBottom: 6, position: 'relative' }} ref={notifsRef}>
          <button onClick={() => setDark(d => !d)} title={dark ? 'Light mode' : 'Dark mode'}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', background: 'none', border: 'none', color: 'rgba(255,255,255,.42)', cursor: 'pointer' }}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setShowNotifs(o => !o); setUnreadCount(0); }} title="Notifications"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', background: 'none', border: 'none', color: showNotifs ? '#fff' : 'rgba(255,255,255,.42)', cursor: 'pointer', position: 'relative' }}>
              <Bell size={17} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 5, right: 8, background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 4px', lineHeight: 1.4 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
          </div>
          <button onClick={() => { logout(); closeMenu(); }} title={`Sign out (${username})`}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', background: 'none', border: 'none', color: 'rgba(255,255,255,.42)', cursor: 'pointer' }}>
            <LogOut size={17} />
          </button>
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
      <main className="main" data-tour="main">
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
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/import" element={<Import />} />
          <Route path="/estimates" element={<Estimates />} />
          <Route path="/estimates/:id" element={<Estimates />} />
          <Route path="/timesheets" element={<Timesheets />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/job-report/:id" element={<JobReport />} />
          <Route path="*" element={<Navigate to={role === 'technician' ? '/my-jobs' : '/'} replace />} />
        </Routes>
      </main>

      {/* ── Global Search overlay ── */}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}

      {/* ── Guided Tour overlay ── */}
      {showTour && (
        <GuidedTour onClose={() => {
          setShowTour(false);
          try { localStorage.setItem('crm_tour_seen', '1'); } catch {}
        }} />
      )}
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
