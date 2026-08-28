import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { PortalProvider, usePortal } from '../context/PortalContext';
import Logo from '../components/Logo';

// ── Shared helpers ────────────────────────────────────────────────────────────
const fmt = n => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLES = {
  draft:     { background: '#f3f4f6', color: '#6b7280' },
  sent:      { background: '#dbeafe', color: '#1d4ed8' },
  accepted:  { background: '#d1fae5', color: '#065f46' },
  declined:  { background: '#fee2e2', color: '#991b1b' },
  scheduled:   { background: '#dbeafe', color: '#1d4ed8' },
  'in-progress': { background: '#fef3c7', color: '#92400e' },
  completed:   { background: '#d1fae5', color: '#065f46' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { background: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', display: 'inline-block' }}>
      {status}
    </span>
  );
}

// ── Portal Auth (magic link landing) ─────────────────────────────────────────
function PortalAuth() {
  const { token } = useParams();
  const { portalLogin, isAuthenticated } = usePortal();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isAuthenticated) { navigate('/portal', { replace: true }); return; }
    fetch(`/api/portal/auth/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setErrorMsg(data.error); setStatus('error'); return; }
        portalLogin(data.portal_token, data.contact, data.company);
        setStatus('success');
        setTimeout(() => navigate('/portal', { replace: true }), 1200);
      })
      .catch(() => { setErrorMsg('Unable to connect. Please try again.'); setStatus('error'); });
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 420, width: '100%', margin: '0 16px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ marginBottom: 24 }}>
          <Logo size={40} variant="color" showWordmark={true} />
        </div>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Verifying your link…</div>
            <div style={{ color: '#6b7280', fontSize: 14 }}>Please wait a moment.</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#065f46', marginBottom: 8 }}>You're in!</div>
            <div style={{ color: '#047857', fontSize: 14 }}>Redirecting to your portal…</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#991b1b', marginBottom: 8 }}>Link Invalid</div>
            <div style={{ color: '#b91c1c', fontSize: 14 }}>{errorMsg}</div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>Contact us to request a new access link.</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Portal Layout ─────────────────────────────────────────────────────────────
function PortalLayout() {
  const { isAuthenticated, portalCompany, portalContact, portalLogout } = usePortal();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  if (!isAuthenticated) return <Navigate to="/portal/login" replace />;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top nav */}
      <nav style={{ background: '#1e3a5f', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
        <Logo size={30} variant="white" showWordmark={true} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <PortalNavLink to="/portal">Overview</PortalNavLink>
          <PortalNavLink to="/portal/proposals">Proposals</PortalNavLink>
          <PortalNavLink to="/portal/jobs">Work Orders</PortalNavLink>
          <PortalNavLink to="/portal/messages">Messages</PortalNavLink>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{portalContact?.name}</div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11 }}>{portalCompany?.name}</div>
          </div>
          <button
            onClick={() => { portalLogout(); navigate('/portal/login'); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: 'rgba(255,255,255,.7)', fontSize: 12, cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px 64px' }}>
        <Routes>
          <Route index element={<PortalDashboard />} />
          <Route path="proposals" element={<PortalProposals />} />
          <Route path="proposals/:id" element={<PortalProposalDetail />} />
          <Route path="jobs" element={<PortalJobs />} />
          <Route path="messages" element={<PortalMessages />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function PortalNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/portal'}
      style={({ isActive }) => ({
        color: isActive ? '#fff' : 'rgba(255,255,255,.65)',
        fontWeight: isActive ? 700 : 500,
        fontSize: 14,
        textDecoration: 'none',
        padding: '4px 0',
        borderBottom: isActive ? '2px solid #60a5fa' : '2px solid transparent',
      })}
    >
      {children}
    </NavLink>
  );
}

// ── Portal Dashboard ──────────────────────────────────────────────────────────
function PortalDashboard() {
  const { portalFetch, portalCompany, portalContact } = usePortal();
  const [proposals, setProposals] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      portalFetch('/proposals').then(r => r.json()),
      portalFetch('/jobs').then(r => r.json()),
    ]).then(([p, j]) => {
      setProposals(Array.isArray(p) ? p : []);
      setJobs(Array.isArray(j) ? j : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const accepted = proposals.filter(p => p.status === 'accepted');
  const pending  = proposals.filter(p => p.status === 'sent');
  const activeJobs = jobs.filter(j => j.status !== 'completed');
  const totalValue = accepted.reduce((s, p) => s + (p.total_amount || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Welcome back, {portalContact?.name?.split(' ')[0]}!</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>{portalCompany?.name} · Customer Portal</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Accepted Proposals', value: accepted.length, icon: '✅', color: '#065f46', bg: '#d1fae5' },
          { label: 'Pending Proposals', value: pending.length, icon: '📋', color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'Upcoming Work Orders', value: activeJobs.length, icon: '🔧', color: '#92400e', bg: '#fef3c7' },
          { label: 'Total Contract Value', value: fmt(totalValue), icon: '💰', color: '#1e3a5f', bg: '#eff6ff' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ background: card.bg, width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{card.icon}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{card.label}</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: card.color }}>{loading ? '—' : card.value}</div>
          </div>
        ))}
      </div>

      {/* Recent proposals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <SectionCard title="Recent Proposals" linkTo="/portal/proposals">
          {loading ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p> :
            proposals.slice(0, 4).map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{p.proposal_number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status={p.status} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginTop: 4 }}>{fmt(p.total_amount)}</div>
                </div>
              </div>
            ))
          }
          {!loading && proposals.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No proposals yet.</p>}
        </SectionCard>

        <SectionCard title="Upcoming Work Orders" linkTo="/portal/jobs">
          {loading ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p> :
            activeJobs.slice(0, 4).map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{j.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {j.scheduled_date ? new Date(j.scheduled_date + 'T12:00:00').toLocaleDateString() : 'TBD'} · {j.technician || 'Unassigned'}
                  </div>
                </div>
                <StatusBadge status={j.status} />
              </div>
            ))
          }
          {!loading && activeJobs.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No upcoming work orders.</p>}
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ title, linkTo, children }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
        <button onClick={() => navigate(linkTo)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
      </div>
      <div style={{ padding: '4px 20px 16px' }}>{children}</div>
    </div>
  );
}

// ── Portal Proposals ──────────────────────────────────────────────────────────
function PortalProposals() {
  const { portalFetch } = usePortal();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    portalFetch('/proposals').then(r => r.json()).then(data => {
      setProposals(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  if (selected) return <PortalProposalDetailInline proposal={selected} onBack={() => setSelected(null)} />;

  return (
    <div>
      <PageHeader title="Proposals" subtitle={`${proposals.length} total`} />
      {loading ? <LoadingCard /> : proposals.length === 0 ? (
        <EmptyState icon="📋" text="No proposals yet. We'll send them here once they're ready." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {proposals.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.proposal_number} · {p.service_type} · {new Date(p.created_at).toLocaleDateString()}</div>
                {p.signed_at && (
                  <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>✅ Signed by {p.signed_by} on {new Date(p.signed_at).toLocaleDateString()}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e3a5f', marginBottom: 6 }}>{fmt(p.total_amount)}</div>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortalProposalDetailInline({ proposal: p, onBack }) {
  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back to Proposals</button>

      <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{p.proposal_number}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{p.title}</div>
            <div style={{ marginTop: 8 }}><StatusBadge status={p.status} /></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Total</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f' }}>{fmt(p.total_amount)}</div>
          </div>
        </div>
        {p.signed_at && (
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#065f46' }}>
            ✅ Signed by <strong>{p.signed_by}</strong> on {new Date(p.signed_at).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Line items */}
      {p.line_items?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>Scope of Work</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                <th style={{ padding: '6px 0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Description</th>
                <th style={{ padding: '6px 0', textAlign: 'center', color: '#64748b', fontWeight: 600, width: 60 }}>Qty</th>
                <th style={{ padding: '6px 0', textAlign: 'right', color: '#64748b', fontWeight: 600, width: 100 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {p.line_items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '9px 0', color: '#374151' }}>{item.description}</td>
                  <td style={{ padding: '9px 0', textAlign: 'center', color: '#94a3b8' }}>{item.quantity} {item.unit}</td>
                  <td style={{ padding: '9px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop: '2px solid #f1f5f9', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Subtotal: {fmt(p.subtotal)}</div>
            {p.tax_rate > 0 && <div style={{ fontSize: 13, color: '#94a3b8' }}>Tax ({p.tax_rate}%): {fmt(p.tax_amount)}</div>}
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Total: {fmt(p.total_amount)}</div>
          </div>
        </div>
      )}

      {p.terms && (
        <div style={{ background: '#fffbf0', borderRadius: 12, padding: '16px 20px', border: '1px solid #fde68a', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#92400e' }}>Terms & Conditions</div>
          {p.terms}
        </div>
      )}
    </div>
  );
}

// Keep route-based detail for direct navigation
function PortalProposalDetail() {
  const { id } = useParams();
  const { portalFetch } = usePortal();
  const [proposal, setProposal] = useState(null);
  useEffect(() => {
    portalFetch('/proposals').then(r => r.json()).then(data => {
      const p = (Array.isArray(data) ? data : []).find(x => String(x.id) === String(id));
      setProposal(p || null);
    });
  }, [id]);
  if (!proposal) return <LoadingCard />;
  return <PortalProposalDetailInline proposal={proposal} onBack={() => history.back()} />;
}

// ── Portal Jobs ───────────────────────────────────────────────────────────────
function PortalJobs() {
  const { portalFetch } = usePortal();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch('/jobs').then(r => r.json()).then(data => {
      setJobs(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const upcoming = jobs.filter(j => j.status !== 'completed');
  const completed = jobs.filter(j => j.status === 'completed');

  return (
    <div>
      <PageHeader title="Work Orders" subtitle={`${jobs.length} total`} />
      {loading ? <LoadingCard /> : jobs.length === 0 ? (
        <EmptyState icon="🔧" text="No work orders yet." />
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 12px' }}>Upcoming & In Progress</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {upcoming.map(j => <JobCard key={j.id} job={j} />)}
              </div>
            </>
          )}
          {completed.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 12px' }}>Completed</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {completed.map(j => <JobCard key={j.id} job={j} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function JobCard({ job: j }) {
  const JOB_ICONS = { maintenance: '🔧', repair: '🛠️', cleaning: '🧹', inspection: '🔍', installation: '⚙️' };
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 22, marginTop: 2 }}>{JOB_ICONS[j.job_type] || '🔧'}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{j.title}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: j.notes ? 6 : 0 }}>
            {j.scheduled_date ? new Date(j.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'}
            {j.scheduled_time && ` · ${j.scheduled_time}`}
            {j.technician && ` · ${j.technician}`}
          </div>
          {j.notes && <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{j.notes}</div>}
        </div>
      </div>
      <StatusBadge status={j.status} />
    </div>
  );
}

// ── Portal Messages ───────────────────────────────────────────────────────────
function PortalMessages() {
  const { portalFetch, portalContact } = usePortal();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = useCallback(() => {
    portalFetch('/messages').then(r => r.json()).then(data => {
      setMessages(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadMessages(); }, []);

  const sendMessage = async () => {
    if (!body.trim()) { setError('Please write a message.'); return; }
    setSending(true); setError('');
    try {
      const r = await portalFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ subject: subject.trim() || 'General Inquiry', message: body.trim() }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Send failed.'); return; }
      setBody(''); setSubject(''); setSent(true);
      setTimeout(() => setSent(false), 4000);
      loadMessages();
    } catch { setError('Network error. Please try again.'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Send message */}
      <div>
        <PageHeader title="Send a Message" subtitle="We typically respond within 1 business day." />
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Question about my proposal"
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }}
          />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Message *</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message here…"
            rows={5}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
          />
          {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          {sent && <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>✅ Message sent! We'll be in touch soon.</div>}
          <button
            onClick={sendMessage}
            disabled={sending}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: sending ? '#9ca3af' : '#1e3a5f', color: '#fff', fontSize: 14, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}
          >
            {sending ? 'Sending…' : '✉️ Send Message'}
          </button>
        </div>
      </div>

      {/* Message history */}
      <div>
        <PageHeader title="Message History" subtitle={`${messages.length} messages`} />
        {loading ? <LoadingCard /> : messages.length === 0 ? (
          <EmptyState icon="✉️" text="No messages yet. Send us a message using the form." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map(m => (
              <div key={m.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{m.subject}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(m.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{m.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portal Login (no-token landing) ──────────────────────────────────────────
function PortalLogin() {
  const { isAuthenticated } = usePortal();
  if (isAuthenticated) return <Navigate to="/portal" replace />;
  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 400, width: '100%', margin: '0 16px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ marginBottom: 24 }}>
          <Logo size={40} variant="color" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Customer Portal</div>
        <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
          To access your portal, use the invitation link sent to your email. Contact us if you need a new link.
        </div>
      </div>
    </div>
  );
}

// ── Shared UI components ──────────────────────────────────────────────────────
function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>{subtitle}</p>}
    </div>
  );
}

function LoadingCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Loading…
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '40px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>{text}</div>
    </div>
  );
}

// ── Root portal component ─────────────────────────────────────────────────────
export default function Portal() {
  return (
    <PortalProvider>
      <Routes>
        <Route path="auth/:token" element={<PortalAuth />} />
        <Route path="login" element={<PortalLogin />} />
        <Route path="*" element={<PortalLayout />} />
      </Routes>
    </PortalProvider>
  );
}
