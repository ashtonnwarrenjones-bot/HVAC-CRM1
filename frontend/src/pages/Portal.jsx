import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const PORTAL_KEY = 'conduit_portal_jwt';

// Fetch helper — always includes the portal JWT
async function portalFetch(path, options = {}) {
  const token = sessionStorage.getItem(PORTAL_KEY);
  const res = await fetch(`/api/portal${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const STATUS_COLORS = {
  // Proposals
  draft:    { bg: '#f3f4f6', color: '#6b7280' },
  sent:     { bg: '#dbeafe', color: '#1d4ed8' },
  accepted: { bg: '#d1fae5', color: '#065f46' },
  signed:   { bg: '#d1fae5', color: '#065f46' },
  declined: { bg: '#fee2e2', color: '#dc2626' },
  // Jobs
  scheduled:    { bg: '#dbeafe', color: '#1d4ed8' },
  'in progress':{ bg: '#ede9fe', color: '#6d28d9' },
  'on site':    { bg: '#d1fae5', color: '#065f46' },
  'on the way': { bg: '#fef3c7', color: '#d97706' },
  completed:    { bg: '#d1fae5', color: '#065f46' },
  cancelled:    { bg: '#f3f4f6', color: '#9ca3af' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status?.toLowerCase()] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '3px 9px',
      background: s.bg, color: s.color, textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {status || 'unknown'}
    </span>
  );
}

function fmt(n) {
  return '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton({ height = 60, style = {} }) {
  return (
    <div style={{
      height, borderRadius: 8, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px', border: 'none', borderRadius: '8px 8px 0 0',
        background: active ? '#fff' : 'transparent',
        color: active ? '#1e3a5f' : '#6b7280',
        fontWeight: active ? 700 : 500, fontSize: 14, cursor: 'pointer',
        borderBottom: active ? '2px solid #1e3a5f' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      {label}
      {count != null && (
        <span style={{
          marginLeft: 6, fontSize: 11, fontWeight: 700,
          background: active ? '#1e3a5f' : '#e5e7eb',
          color: active ? '#fff' : '#6b7280',
          borderRadius: 10, padding: '1px 6px',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Error / access denied page ────────────────────────────────────────────────
function AccessDenied({ message }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <h2 style={{ color: '#1e3a5f', margin: '0 0 8px', fontSize: 22 }}>Access Required</h2>
      <p style={{ color: '#6b7280', textAlign: 'center', maxWidth: 380, lineHeight: 1.6, margin: 0 }}>
        {message || 'This link is invalid or has expired. Please contact us to receive a new portal link.'}
      </p>
    </div>
  );
}

// ── Main Portal component ─────────────────────────────────────────────────────
export default function Portal() {
  const [searchParams] = useSearchParams();
  const magicToken = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [contact, setContact] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [msgForm, setMsgForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Exchange magic token → portal JWT, or reuse existing session
  useEffect(() => {
    async function init() {
      try {
        if (magicToken) {
          // Exchange the magic link token for a portal JWT
          const data = await fetch(`/api/portal/auth/${magicToken}`).then(async r => {
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Invalid link');
            return r.json();
          });
          sessionStorage.setItem(PORTAL_KEY, data.jwt);
          setContact(data.contact);
          setStatus('ready');
        } else if (sessionStorage.getItem(PORTAL_KEY)) {
          // Resume existing session
          const me = await portalFetch('/me');
          setContact({
            id: me.contact_id,
            name: me.contact_name,
            email: me.email,
            company_id: me.company_id,
            company_name: me.company_name,
          });
          setStatus('ready');
        } else {
          setStatus('error');
          setErrorMsg('No portal link provided. Please use the link sent to you.');
        }
      } catch (e) {
        setStatus('error');
        setErrorMsg(e.message);
      }
    }
    init();
  }, [magicToken]);

  // Load portal data once authenticated
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [p, j, m] = await Promise.all([
        portalFetch('/proposals'),
        portalFetch('/jobs'),
        portalFetch('/messages'),
      ]);
      setProposals(p);
      setJobs(j);
      setMessages(m);
    } catch (_) {}
    finally { setDataLoading(false); }
  }, []);

  useEffect(() => {
    if (status === 'ready') loadData();
  }, [status, loadData]);

  const sendMessage = async () => {
    if (!msgForm.message.trim()) return;
    setSending(true);
    try {
      await portalFetch('/messages', {
        method: 'POST',
        body: JSON.stringify(msgForm),
      });
      setMsgForm({ subject: '', message: '' });
      setMsgSent(true);
      setTimeout(() => setMsgSent(false), 4000);
      loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <div style={{ color: '#6b7280', fontSize: 14 }}>Loading your portal…</div>
        </div>
      </div>
    );
  }

  if (status === 'error') return <AccessDenied message={errorMsg} />;

  const upcomingJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled');
  const pastJobs = jobs.filter(j => j.status === 'completed' || j.status === 'cancelled');

  // ── Portal UI ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .portal-card { background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 16px; }
        .portal-card-header { padding: 14px 18px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
        .portal-card-header h3 { margin: 0; font-size: 15px; color: #1e3a5f; font-weight: 700; }
        .portal-row { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-bottom: 1px solid #f9fafb; }
        .portal-row:last-child { border-bottom: none; }
        .empty-msg { padding: 24px 18px; color: #9ca3af; font-size: 13px; font-style: italic; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>

        {/* ── Header ── */}
        <div style={{ background: '#1e3a5f', color: '#fff', padding: '0 0 0 0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚡</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: 1, textTransform: 'uppercase' }}>Customer Portal</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{contact?.company_name}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12 }}>
                <div style={{ color: 'rgba(255,255,255,0.55)' }}>Signed in as</div>
                <div style={{ fontWeight: 600, color: '#fff' }}>{contact?.name}</div>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'proposals', label: 'Proposals', count: proposals.length },
                { key: 'jobs', label: 'Service', count: jobs.length },
                { key: 'messages', label: 'Messages', count: messages.length },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '9px 16px', border: 'none', borderRadius: '8px 8px 0 0',
                    background: activeTab === t.key ? '#f0f4f8' : 'transparent',
                    color: activeTab === t.key ? '#1e3a5f' : 'rgba(255,255,255,0.65)',
                    fontWeight: activeTab === t.key ? 700 : 500,
                    fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {t.label}
                  {t.count != null && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 5px',
                      background: activeTab === t.key ? '#1e3a5f' : 'rgba(255,255,255,0.2)',
                      color: activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.8)',
                    }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 60px' }}>

          {/* ── OVERVIEW tab ── */}
          {activeTab === 'overview' && (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Proposals', value: proposals.length, icon: '📄', sub: proposals.filter(p => p.status === 'sent').length + ' awaiting review' },
                  { label: 'Service Jobs', value: jobs.length, icon: '🔧', sub: upcomingJobs.length + ' upcoming' },
                  { label: 'Messages', value: messages.length, icon: '💬', sub: 'Send us a message' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 18px' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{card.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f' }}>{card.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 2 }}>{card.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* Recent proposal */}
              {proposals.length > 0 && (
                <div className="portal-card">
                  <div className="portal-card-header">
                    <h3>📄 Recent Proposal</h3>
                    <button onClick={() => setActiveTab('proposals')} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
                  </div>
                  <div className="portal-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 3 }}>{proposals[0].title}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(proposals[0].created_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a5f', marginBottom: 4 }}>{fmt(proposals[0].total_amount)}</div>
                      <StatusBadge status={proposals[0].signed_at ? 'signed' : proposals[0].status} />
                    </div>
                  </div>
                </div>
              )}

              {/* Next scheduled job */}
              {upcomingJobs.length > 0 && (
                <div className="portal-card">
                  <div className="portal-card-header">
                    <h3>🔧 Next Service Visit</h3>
                    <button onClick={() => setActiveTab('jobs')} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
                  </div>
                  {(() => {
                    const next = upcomingJobs.find(j => j.scheduled_date) || upcomingJobs[0];
                    return (
                      <div className="portal-row">
                        {next.scheduled_date && (
                          <div style={{ textAlign: 'center', minWidth: 48, background: '#f0f4f8', borderRadius: 10, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                              {new Date(next.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', lineHeight: 1 }}>
                              {new Date(next.scheduled_date + 'T00:00:00').getDate()}
                            </div>
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>{next.title}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {[next.job_type, next.technician ? `Tech: ${next.technician}` : null, next.scheduled_time].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <StatusBadge status={next.status} />
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Quick message */}
              <div className="portal-card">
                <div className="portal-card-header"><h3>💬 Send Us a Message</h3></div>
                <div style={{ padding: 18 }}>
                  <MessageForm
                    form={msgForm}
                    onChange={setMsgForm}
                    onSend={sendMessage}
                    sending={sending}
                    sent={msgSent}
                    compact
                  />
                </div>
              </div>
            </>
          )}

          {/* ── PROPOSALS tab ── */}
          {activeTab === 'proposals' && (
            <div className="portal-card">
              <div className="portal-card-header"><h3>📄 Proposals</h3></div>
              {dataLoading ? (
                <div style={{ padding: 18 }}><Skeleton /><Skeleton style={{ marginTop: 8 }} /></div>
              ) : proposals.length === 0 ? (
                <div className="empty-msg">No proposals on file yet.</div>
              ) : proposals.map(p => (
                <div key={p.id} className="portal-row" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 3 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {p.proposal_number && <span>#{p.proposal_number}</span>}
                      <span>{fmtDate(p.created_at)}</span>
                      {p.service_type && <span>· {p.service_type}</span>}
                    </div>
                    {p.signed_at && (
                      <div style={{ fontSize: 11, color: '#059669', marginTop: 3, fontWeight: 600 }}>
                        ✓ Signed {fmtDate(p.signed_at)}{p.signed_by ? ` by ${p.signed_by}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#1e3a5f' }}>{fmt(p.total_amount)}</div>
                    <StatusBadge status={p.signed_at ? 'signed' : p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── JOBS tab ── */}
          {activeTab === 'jobs' && (
            <>
              {upcomingJobs.length > 0 && (
                <div className="portal-card">
                  <div className="portal-card-header"><h3>🔧 Upcoming &amp; Active</h3></div>
                  {upcomingJobs.map(job => <JobRow key={job.id} job={job} />)}
                </div>
              )}
              {pastJobs.length > 0 && (
                <div className="portal-card">
                  <div className="portal-card-header"><h3>✅ Completed Service</h3></div>
                  {pastJobs.map(job => <JobRow key={job.id} job={job} />)}
                </div>
              )}
              {jobs.length === 0 && !dataLoading && (
                <div className="portal-card">
                  <div className="empty-msg">No service jobs on file yet.</div>
                </div>
              )}
            </>
          )}

          {/* ── MESSAGES tab ── */}
          {activeTab === 'messages' && (
            <>
              <div className="portal-card">
                <div className="portal-card-header"><h3>💬 Send a Message</h3></div>
                <div style={{ padding: 18 }}>
                  <MessageForm
                    form={msgForm}
                    onChange={setMsgForm}
                    onSend={sendMessage}
                    sending={sending}
                    sent={msgSent}
                  />
                </div>
              </div>

              {messages.length > 0 && (
                <div className="portal-card">
                  <div className="portal-card-header"><h3>Your Messages</h3></div>
                  {messages.map(msg => (
                    <div key={msg.id} className="portal-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{msg.subject}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(msg.created_at)}</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{msg.message}</div>
                      {!msg.read_at && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', background: '#dbeafe', borderRadius: 4, padding: '2px 7px' }}>Sent · Awaiting reply</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0 40px', fontSize: 12, color: '#9ca3af' }}>
          Powered by Conduit Field Service CRM
        </div>
      </div>
    </>
  );
}

// ── Job row sub-component ─────────────────────────────────────────────────────
function JobRow({ job }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #f9fafb' }}>
      <div
        className="portal-row"
        onClick={() => job.notes && setExpanded(e => !e)}
        style={{ cursor: job.notes ? 'pointer' : 'default' }}
      >
        {job.scheduled_date ? (
          <div style={{ textAlign: 'center', minWidth: 44, background: '#f0f4f8', borderRadius: 8, padding: '6px 8px', flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
              {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', lineHeight: 1 }}>
              {new Date(job.scheduled_date + 'T00:00:00').getDate()}
            </div>
          </div>
        ) : (
          <div style={{ minWidth: 44, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>TBD</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>{job.title}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {[
              job.job_type,
              job.technician ? `Tech: ${job.technician}` : null,
              job.scheduled_time ? new Date(`2000-01-01T${job.scheduled_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
              job.duration_hours ? `${job.duration_hours}h` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={job.status} />
          {job.notes && <span style={{ color: '#9ca3af', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>}
        </div>
      </div>
      {expanded && job.notes && (
        <div style={{ padding: '0 18px 14px 18px', background: '#f9fafb' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Field Notes</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{job.notes}</div>
        </div>
      )}
    </div>
  );
}

// ── Message form sub-component ────────────────────────────────────────────────
function MessageForm({ form, onChange, onSend, sending, sent, compact }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sent && (
        <div style={{ background: '#d1fae5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#065f46', fontWeight: 600 }}>
          ✅ Message sent! We'll be in touch soon.
        </div>
      )}
      {!compact && (
        <input
          placeholder="Subject (optional)"
          value={form.subject}
          onChange={e => onChange(f => ({ ...f, subject: e.target.value }))}
          style={{ padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
        />
      )}
      <textarea
        placeholder={compact ? 'Send a question or comment to our team…' : 'Type your message here…'}
        value={form.message}
        onChange={e => onChange(f => ({ ...f, message: e.target.value }))}
        rows={compact ? 3 : 5}
        style={{ padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
      />
      <button
        onClick={onSend}
        disabled={sending || !form.message.trim()}
        style={{
          padding: '11px 20px', borderRadius: 8, border: 'none',
          background: sending || !form.message.trim() ? '#d1d5db' : '#1e3a5f',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: sending ? 'wait' : 'pointer',
          alignSelf: 'flex-start', transition: 'background 0.15s',
        }}
      >
        {sending ? 'Sending…' : '✉ Send Message'}
      </button>
    </div>
  );
}
