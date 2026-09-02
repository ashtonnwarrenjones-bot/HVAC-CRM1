import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
  Calendar, ChevronLeft, ChevronRight, Users, Plus, X,
  MapPin, Phone, User, Clock, Briefcase, ChevronRight as ChevRight,
  AlertCircle, Loader, Building2, Edit3, CheckCircle,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am–7pm

const STATUS_COLORS = {
  scheduled:   { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  in_progress: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  completed:   { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  cancelled:   { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  pending:     { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6' },
};

const STATUS_OPTIONS = [
  { value: 'scheduled',   label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
];

const JOB_TYPES = ['maintenance', 'repair', 'installation', 'inspection', 'emergency', 'other'];

function fmt12(h) {
  if (h === 12) return '12pm';
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}
function jobLeft(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return ((h - 7) * 60 + m) / (13 * 60) * 100;
}
function jobWidth(duration) {
  return (parseFloat(duration) || 1) * 60 / (13 * 60) * 100;
}
function dateStr(d) { return d.toISOString().slice(0, 10); }

// ─── Capacity bar ─────────────────────────────────────────────────────────────
function CapacityBar({ jobs, dayHours = 9 }) {
  const booked = jobs.reduce((sum, j) => sum + (parseFloat(j.duration_hours) || 1), 0);
  const pct = Math.min(booked / dayHours, 1);
  const color = pct > 0.85 ? '#ef4444' : pct > 0.6 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ marginTop: 3 }}>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', width: '100%' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 2, transition: 'width .3s' }} />
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
        {booked.toFixed(1)}h / {dayHours}h
      </div>
    </div>
  );
}

// ─── Job Detail Panel ─────────────────────────────────────────────────────────
function JobDetailPanel({ job, techs, onClose, onUpdate }) {
  const [status, setStatus] = useState(job.status);
  const [saving, setSaving] = useState(false);

  const colors = STATUS_COLORS[status] || STATUS_COLORS.scheduled;

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    setSaving(true);
    try {
      const res = await axios.put(`/api/jobs/${job.id}`, { ...job, status: newStatus });
      onUpdate({ ...job, status: newStatus });
    } catch {}
    setSaving(false);
  };

  const rowStyle = { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 };

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0,
      width: 340, background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
      zIndex: 400, display: 'flex', flexDirection: 'column',
      animation: 'slideInRight .2s ease',
    }}>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 6 }}>
            {job.title || job.job_type || 'Job'}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: colors.bg, color: colors.text,
            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.border, display: 'inline-block' }} />
            {status.replace('_', ' ')}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {/* Customer */}
        {job.company_name && (
          <div style={rowStyle}>
            <Building2 size={15} color="var(--blue-600)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={labelStyle}>Customer</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{job.company_name}</div>
            </div>
          </div>
        )}

        {/* Schedule */}
        <div style={rowStyle}>
          <Clock size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={labelStyle}>Scheduled</div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              {job.scheduled_date
                ? new Date(job.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : 'No date set'}
              {job.scheduled_time && ` · ${job.scheduled_time}`}
              {job.duration_hours && ` · ${job.duration_hours}h`}
            </div>
          </div>
        </div>

        {/* Address */}
        {(job.address || job.city) && (
          <div style={rowStyle}>
            <MapPin size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={labelStyle}>Address</div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent([job.address, job.city, job.state].filter(Boolean).join(', '))}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--blue-600)', textDecoration: 'none' }}
              >
                {[job.address, job.city, job.state].filter(Boolean).join(', ')}
              </a>
            </div>
          </div>
        )}

        {/* Contact */}
        {job.contact_name && (
          <div style={rowStyle}>
            <User size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={labelStyle}>Contact</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{job.contact_name}</div>
              {job.contact_phone && (
                <a href={`tel:${job.contact_phone}`} style={{ fontSize: 13, color: 'var(--blue-600)', textDecoration: 'none' }}>
                  {job.contact_phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Technician */}
        <div style={rowStyle}>
          <Users size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={labelStyle}>Technician</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{job.technician || 'Unassigned'}</div>
          </div>
        </div>

        {/* Job type */}
        {job.job_type && (
          <div style={rowStyle}>
            <Briefcase size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={labelStyle}>Job Type</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{job.job_type}</div>
            </div>
          </div>
        )}

        {/* Notes */}
        {job.description && (
          <div style={{ marginTop: 4 }}>
            <div style={labelStyle}>Description</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-page)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }}>
              {job.description}
            </div>
          </div>
        )}
        {job.notes && (
          <div style={{ marginTop: 10 }}>
            <div style={labelStyle}>Notes</div>
            <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }}>
              {job.notes}
            </div>
          </div>
        )}

        {/* Quick status change */}
        <div style={{ marginTop: 20 }}>
          <div style={labelStyle}>Quick Status Update</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {STATUS_OPTIONS.map(opt => {
              const c = STATUS_COLORS[opt.value];
              const active = status === opt.value;
              return (
                <button
                  key={opt.value}
                  disabled={saving || active}
                  onClick={() => handleStatusChange(opt.value)}
                  style={{
                    padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${active ? c.border : 'var(--border)'}`,
                    background: active ? c.bg : 'transparent',
                    color: active ? c.text : 'var(--text-muted)',
                    cursor: active || saving ? 'default' : 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
        <a
          href={`/companies/${job.company_id}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px', background: 'var(--blue-600)', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Open Customer Record <ChevRight size={14} />
        </a>
      </div>
    </div>
  );
}

// ─── Create Job Modal ─────────────────────────────────────────────────────────
function CreateJobModal({ defaultDate, defaultTech, techs, onClose, onCreate }) {
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({
    title: '', company_id: '', contact_id: '', job_type: 'maintenance',
    technician: defaultTech || '', status: 'scheduled',
    scheduled_date: defaultDate || '', scheduled_time: '08:00',
    duration_hours: '2', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/companies').then(r => setCompanies(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.company_id) { setContacts([]); return; }
    axios.get(`/api/contacts?company_id=${form.company_id}`).then(r => setContacts(r.data || [])).catch(() => {});
  }, [form.company_id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Job title is required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post('/api/jobs', {
        ...form,
        company_id: form.company_id ? parseInt(form.company_id) : null,
        contact_id: form.contact_id ? parseInt(form.contact_id) : null,
        duration_hours: parseFloat(form.duration_hours) || 2,
      });
      onCreate(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create job.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 11px', border: '1px solid var(--border)',
    borderRadius: 7, fontSize: 13, background: 'var(--bg-page)',
    color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
  };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>Create New Job</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Job Title *</label>
            <input style={inputStyle} placeholder="e.g. Annual HVAC Maintenance" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>

          {/* Company + Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Customer</label>
              <select style={inputStyle} value={form.company_id} onChange={e => { set('company_id', e.target.value); set('contact_id', ''); }}>
                <option value="">— Select —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Contact</label>
              <select style={inputStyle} value={form.contact_id} onChange={e => set('contact_id', e.target.value)} disabled={!contacts.length}>
                <option value="">— Select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          </div>

          {/* Job type + Technician */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Job Type</label>
              <select style={inputStyle} value={form.job_type} onChange={e => set('job_type', e.target.value)}>
                {JOB_TYPES.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Technician</label>
              <select style={inputStyle} value={form.technician} onChange={e => set('technician', e.target.value)}>
                <option value="">— Unassigned —</option>
                {techs.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Date + Time + Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" style={inputStyle} value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Start Time</label>
              <input type="time" style={inputStyle} value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Duration (hrs)</label>
              <input type="number" min="0.5" max="12" step="0.5" style={inputStyle} value={form.duration_hours} onChange={e => set('duration_hours', e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72, fontFamily: 'inherit', lineHeight: 1.5 }} placeholder="Job details, access instructions, customer notes…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {error && (
            <div style={{ display: 'flex', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#dc2626', fontSize: 13 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'var(--blue-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              {saving ? 'Creating…' : 'Create Job'}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Main Dispatch Board ──────────────────────────────────────────────────────
export default function DispatchBoard() {
  const [date, setDate]           = useState(new Date());
  const [jobs, setJobs]           = useState([]);
  const [unscheduled, setUnscheduled] = useState([]);
  const [techs, setTechs]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dragJob, setDragJob]     = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});
  const [queueOpen, setQueueOpen] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const ds = dateStr(date);
      const [jobsRes, usersRes] = await Promise.all([
        axios.get('/api/jobs'),
        axios.get('/api/users'),
      ]);
      const all = jobsRes.data || [];
      const dayJobs = all.filter(j => j.scheduled_date === ds);
      const unschJobs = all.filter(j => !j.scheduled_date && j.status !== 'completed' && j.status !== 'cancelled');

      setJobs(dayJobs);
      setUnscheduled(unschJobs);

      const userTechs = (usersRes.data || [])
        .filter(u => u.role === 'technician' || u.role === 'admin' || u.role === 'dispatcher')
        .map(u => u.name || u.username);
      const jobTechs = [...new Set(all.map(j => j.technician).filter(Boolean))];
      const allTechs = [...new Set([...userTechs, ...jobTechs])].filter(Boolean);
      setTechs(allTechs.length ? allTechs : ['Unassigned']);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const shiftDate = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(d);
  };

  const handleDrop = async (tech, e) => {
    e.preventDefault();
    if (!dragJob) return;
    const ds = dateStr(date);
    const updates = { ...dragJob, technician: tech };
    // If dropped from unscheduled queue, also set the date
    if (!dragJob.scheduled_date) updates.scheduled_date = ds;
    try {
      await axios.put(`/api/jobs/${dragJob.id}`, updates);
      await load();
    } catch {}
    setDragJob(null);
  };

  const handleJobUpdate = (updated) => {
    setJobs(prev => prev.map(j => j.id === updated.id ? { ...j, ...updated } : j));
    if (selectedJob?.id === updated.id) setSelectedJob(s => ({ ...s, ...updated }));
  };

  const unassignedToday = jobs.filter(j => !j.technician || !techs.includes(j.technician));
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const isToday   = dateStr(date) === dateStr(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Calendar size={20} /> Dispatch Board
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(-1)}><ChevronLeft size={15} /></button>
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 220, textAlign: 'center' }}>
            {isToday && <span style={{ color: 'var(--blue-600)', marginRight: 6 }}>Today —</span>}
            {dateLabel}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(1)}><ChevronRight size={15} /></button>
          {!isToday && <button className="btn btn-secondary btn-sm" onClick={() => setDate(new Date())}>Today</button>}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setCreateDefaults({ scheduled_date: dateStr(date) }); setShowCreate(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={14} /> New Job
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p className="text-muted">Loading…</p></div>
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ── Unscheduled Queue ── */}
          <div style={{
            width: queueOpen ? 240 : 36,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width .2s ease',
            overflow: 'hidden',
          }}>
            {/* Queue header */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setQueueOpen(o => !o)}
            >
              {queueOpen ? (
                <>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    Unscheduled
                    {unscheduled.length > 0 && (
                      <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                        {unscheduled.length}
                      </span>
                    )}
                  </span>
                  <ChevronsLeft size={14} color="var(--text-muted)" />
                </>
              ) : (
                <ChevronsRight size={14} color="var(--text-muted)" style={{ margin: '0 auto' }} />
              )}
            </div>

            {/* Queue items */}
            {queueOpen && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
                {unscheduled.length === 0 ? (
                  <div style={{ padding: '24px 8px', textAlign: 'center' }}>
                    <CheckCircle size={24} color="var(--text-muted)" style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>All jobs scheduled</p>
                  </div>
                ) : unscheduled.map(job => (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={() => setDragJob(job)}
                    onDragEnd={() => setDragJob(null)}
                    style={{
                      background: 'var(--bg-page)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '9px 10px', marginBottom: 6,
                      cursor: 'grab', transition: 'box-shadow .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 3 }}>
                      {job.title || job.job_type || 'Job'}
                    </div>
                    {job.company_name && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Building2 size={10} /> {job.company_name}
                      </div>
                    )}
                    {job.job_type && (
                      <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 600, background: '#f0f9ff', color: '#0369a1', padding: '1px 6px', borderRadius: 10, textTransform: 'capitalize' }}>
                        {job.job_type}
                      </span>
                    )}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
                  Drag to timeline<br />to schedule
                </p>
              </div>
            )}
          </div>

          {/* ── Timeline area ── */}
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '12px 20px 24px', minWidth: 0 }}>
            {/* Hour header */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', marginBottom: 4, minWidth: 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Users size={12} /> Technician
              </div>
              <div style={{ position: 'relative', height: 24 }}>
                {HOURS.map(h => (
                  <div key={h} style={{ position: 'absolute', left: `${(h - 7) / 13 * 100}%`, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, transform: 'translateX(-50%)' }}>
                    {fmt12(h)}
                  </div>
                ))}
              </div>
            </div>

            {/* Tech rows */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', minWidth: 700 }}>
              {techs.map((tech, ti) => {
                const techJobs = jobs.filter(j => (j.technician || 'Unassigned') === tech);
                return (
                  <div
                    key={tech}
                    style={{
                      display: 'grid', gridTemplateColumns: '160px 1fr',
                      background: ti % 2 === 0 ? 'var(--bg-card)' : 'var(--th-bg)',
                      borderBottom: ti < techs.length - 1 ? '1px solid var(--border)' : 'none',
                      minHeight: 62,
                    }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(tech, e)}
                  >
                    {/* Tech label */}
                    <div style={{
                      padding: '8px 12px', borderRight: '1px solid var(--border)',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      background: `hsl(${(tech.charCodeAt(0) * 37) % 360}, 35%, ${ti % 2 === 0 ? '95%' : '92%'})`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: `hsl(${(tech.charCodeAt(0) * 37) % 360}, 55%, 45%)`,
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13,
                      }}>
                        {tech[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{tech}</div>
                        <CapacityBar jobs={techJobs} />
                      </div>
                    </div>

                    {/* Timeline */}
                    <div style={{ position: 'relative', height: 62 }}>
                      {/* Grid lines */}
                      {HOURS.map(h => (
                        <div key={h} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(h - 7) / 13 * 100}%`, borderLeft: '1px dashed var(--border-light)', pointerEvents: 'none' }} />
                      ))}

                      {/* Job blocks */}
                      {techJobs.map(job => {
                        const colors = STATUS_COLORS[job.status] || STATUS_COLORS.scheduled;
                        const left  = jobLeft(job.scheduled_time);
                        const width = Math.max(jobWidth(job.duration_hours), 2);
                        const isSelected = selectedJob?.id === job.id;
                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); setDragJob(job); }}
                            onDragEnd={() => setDragJob(null)}
                            onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                            style={{
                              position: 'absolute', top: 7, bottom: 7,
                              left: `${left}%`, width: `${width}%`, minWidth: 64,
                              background: colors.bg,
                              border: `2px solid ${isSelected ? colors.text : colors.border}`,
                              borderRadius: 6, padding: '2px 7px',
                              cursor: 'pointer', overflow: 'hidden', zIndex: 1,
                              boxShadow: isSelected ? `0 0 0 2px ${colors.border}` : '0 1px 3px rgba(0,0,0,0.1)',
                              transition: 'box-shadow .15s',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: colors.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {job.title || job.job_type || 'Job'}
                            </div>
                            <div style={{ fontSize: 10, color: colors.text, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {job.company_name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Unassigned row */}
              {unassignedToday.length > 0 && (
                <div
                  style={{ display: 'grid', gridTemplateColumns: '160px 1fr', background: '#fef9c3', minHeight: 52 }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop('', e)}
                >
                  <div style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚠ Unassigned
                  </div>
                  <div style={{ position: 'relative', minHeight: 52, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', flexWrap: 'wrap' }}>
                    {unassignedToday.map(job => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={() => setDragJob(job)}
                        onDragEnd={() => setDragJob(null)}
                        onClick={() => setSelectedJob(job)}
                        style={{ background: '#fff', border: '1.5px solid #fbbf24', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#92400e' }}
                      >
                        {job.title || job.job_type || 'Job'} — {job.company_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Legend + Summary */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {Object.entries(STATUS_COLORS).map(([key, c]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1.5px solid ${c.border}` }} />
                  <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                </div>
              ))}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>· Drag to reassign · Click for details</span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Jobs',  value: jobs.length },
                { label: 'Scheduled',   value: jobs.filter(j => j.status === 'scheduled').length },
                { label: 'In Progress', value: jobs.filter(j => j.status === 'in_progress').length },
                { label: 'Completed',   value: jobs.filter(j => j.status === 'completed').length },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: '10px 18px', minWidth: 90 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Job detail panel ── */}
      {selectedJob && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 399 }}
            onClick={() => setSelectedJob(null)}
          />
          <JobDetailPanel
            job={selectedJob}
            techs={techs}
            onClose={() => setSelectedJob(null)}
            onUpdate={handleJobUpdate}
          />
        </>
      )}

      {/* ── Create job modal ── */}
      {showCreate && (
        <CreateJobModal
          defaultDate={createDefaults.scheduled_date}
          defaultTech={createDefaults.tech}
          techs={techs}
          onClose={() => setShowCreate(false)}
          onCreate={(newJob) => { load(); }}
        />
      )}
    </div>
  );
}
