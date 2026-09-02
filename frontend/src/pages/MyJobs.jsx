import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Wrench, MapPin, Calendar, Clock, Phone, User,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle,
  Loader, Building2, FileText, X, Send
} from 'lucide-react';

const STATUS_CONFIG = {
  scheduled:   { label: 'Scheduled',   bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
  in_progress: { label: 'In Progress', bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  completed:   { label: 'Completed',   bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  cancelled:   { label: 'Cancelled',   bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  pending:     { label: 'Pending',     bg: '#f5f3ff', color: '#5b21b6', dot: '#7c3aed' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color,
      padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

// ─── Quote Request Modal ───────────────────────────────────────────────────────
function QuoteModal({ job, onClose }) {
  const [form, setForm] = useState({
    manufacturer: '',
    model: '',
    serial_number: '',
    work_needed: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.work_needed.trim()) { setError('Please describe what needs to be replaced or repaired.'); return; }
    setSaving(true);
    setError('');
    try {
      await axios.post('/api/service-requests', {
        job_id: job.id,
        company_id: job.company_id || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        work_needed: form.work_needed,
        notes: form.notes || null,
      });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 14, background: 'var(--bg-page)',
    color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
  };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Request a Quote</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{job.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>Request Sent!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 24px' }}>
              Your sales team has been notified and will prepare a quote.
            </p>
            <button
              onClick={onClose}
              style={{ padding: '10px 24px', background: 'var(--blue-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Fill in the equipment details and describe what needs to be done. Your sales team will receive this and start working on a quote.
            </p>

            {/* Equipment info */}
            <div style={{ background: 'var(--bg-page)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipment Info</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Manufacturer</label>
                  <input style={inputStyle} placeholder="e.g. Carrier" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Model</label>
                  <input style={inputStyle} placeholder="e.g. 50XC" value={form.model} onChange={e => set('model', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Serial Number</label>
                <input style={inputStyle} placeholder="e.g. 1234ABC567" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
              </div>
            </div>

            {/* Work needed */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ ...labelStyle, color: 'var(--text-primary)' }}>
                What needs to be replaced / repaired? <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 90, fontFamily: 'inherit', lineHeight: 1.5 }}
                placeholder="Describe the issue, parts needed, scope of work..."
                value={form.work_needed}
                onChange={e => set('work_needed', e.target.value)}
                required
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Additional Notes (optional)</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit', lineHeight: 1.5 }}
                placeholder="Access instructions, urgency, customer preferences..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ flex: 1, padding: '10px', background: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: 'var(--blue-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                {saving ? 'Sending…' : 'Send to Sales'}
              </button>
            </div>
          </form>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const scheduledDate = job.scheduled_date
    ? new Date(job.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        {/* Card header */}
        <div
          onClick={() => setExpanded(e => !e)}
          style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: 'var(--blue-50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Wrench size={18} color="var(--blue-600)" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {job.title}
              </div>
              <StatusBadge status={job.status} />
            </div>

            {job.company_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--text-muted)', fontSize: 13 }}>
                <Building2 size={12} />
                <span>{job.company_name}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
              {scheduledDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Calendar size={12} />
                  <span>{scheduledDate}</span>
                </div>
              )}
              {job.scheduled_time && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{job.scheduled_time}</span>
                </div>
              )}
            </div>
          </div>

          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', marginTop: 0 }}>
            <div style={{ height: 12 }} />

            {job.address && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <MapPin size={14} color="var(--blue-600)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {job.address}
                  {job.city && `, ${job.city}`}
                  {job.state && `, ${job.state}`}
                </div>
              </div>
            )}

            {job.contact_name && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <User size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{job.contact_name}</div>
              </div>
            )}

            {job.contact_phone && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Phone size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                <a href={`tel:${job.contact_phone}`} style={{ fontSize: 13, color: 'var(--blue-600)', textDecoration: 'none', fontWeight: 500 }}>
                  {job.contact_phone}
                </a>
              </div>
            )}

            {job.description && (
              <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 4 }}>
                {job.description}
              </div>
            )}

            {job.notes && (
              <div style={{ marginTop: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                <strong>Notes:</strong> {job.notes}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {job.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([job.address, job.city, job.state].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: 'var(--blue-600)', color: '#fff',
                    borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none'
                  }}
                >
                  <MapPin size={14} /> Directions
                </a>
              )}
              {job.contact_phone && (
                <a
                  href={`tel:${job.contact_phone}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: 'var(--bg-page)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <Phone size={14} /> Call
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setShowQuoteModal(true); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', background: '#f0fdf4', color: '#166534',
                  border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <FileText size={14} /> Request Quote
              </button>
            </div>
          </div>
        )}
      </div>

      {showQuoteModal && <QuoteModal job={job} onClose={() => setShowQuoteModal(false)} />}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyJobs() {
  const { username } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active'); // 'active' | 'completed' | 'all'

  useEffect(() => {
    setLoading(true);
    axios.get('/api/jobs')
      .then(r => {
        const mine = (r.data || []).filter(j =>
          j.technician && j.technician.toLowerCase() === (username || '').toLowerCase()
        );
        setJobs(mine);
      })
      .catch(() => setError('Could not load jobs. Please refresh.'))
      .finally(() => setLoading(false));
  }, [username]);

  const filtered = jobs.filter(j => {
    if (filter === 'active') return j.status !== 'completed' && j.status !== 'cancelled';
    if (filter === 'completed') return j.status === 'completed' || j.status === 'cancelled';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    const da = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
    const db = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
    return da - db;
  });

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>
          My Jobs
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{today}</p>
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Active', count: jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length, color: '#2563eb' },
            { label: 'Today', count: jobs.filter(j => {
              if (!j.scheduled_date) return false;
              const d = new Date(j.scheduled_date);
              const n = new Date();
              return d.toDateString() === n.toDateString();
            }).length, color: '#f59e0b' },
            { label: 'Done', count: jobs.filter(j => j.status === 'completed').length, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
        {[
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
          { key: 'all', label: 'All' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: filter === tab.key ? 'var(--blue-600)' : 'transparent',
              color: filter === tab.key ? '#fff' : 'var(--text-muted)',
              transition: 'all .15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader size={24} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14 }}>Loading your jobs…</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', color: '#dc2626', fontSize: 13 }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <CheckCircle size={40} color="var(--text-muted)" style={{ opacity: 0.4, margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
            {filter === 'active' ? 'No active jobs right now' : 'No jobs to show'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {filter === 'active' ? 'All caught up!' : 'Jobs assigned to you will appear here.'}
          </p>
        </div>
      )}

      {!loading && !error && sorted.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
