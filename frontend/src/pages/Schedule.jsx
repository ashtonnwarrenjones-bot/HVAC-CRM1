import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Calendar, List, Map, Plus, ChevronLeft, ChevronRight,
  Clock, User, Building2, AlertCircle, CheckCircle,
  MapPin, Truck, Layers, Edit2, Trash2, X, Navigation
} from 'lucide-react';

const SERVICE_TYPES = [
  { value: 'one_time', label: 'One-Time Project', icon: '📌' },
  { value: 'landscape_route', label: 'Landscape Route', icon: '🌿' },
  { value: 'snow_route', label: 'Snow Route', icon: '❄️' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'installation', label: 'Installation', icon: '⚙️' },
  { value: 'inspection', label: 'Inspection', icon: '🔍' },
  { value: 'emergency', label: 'Emergency', icon: '🚨' },
];

const SERVICE_ICON = Object.fromEntries(SERVICE_TYPES.map(s => [s.value, s.icon]));

const STATUS_COLORS = {
  unscheduled: '#f59e0b',
  scheduled: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#6b7280',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmt$(n) { return '$' + (parseFloat(n)||0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
function dateStr(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

// ── Confirm dialog util ───────────────────────────────────────────────────────
function Confirm({ msg, onYes, onNo }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:12, padding:24, maxWidth:340, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <p style={{ margin:'0 0 20px', fontSize:14, color:'var(--text-primary)' }}>{msg}</p>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn btn-secondary" onClick={onNo}>Cancel</button>
          <button className="btn btn-danger" onClick={onYes}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Job Form Modal ────────────────────────────────────────────────────────────
function JobModal({ job, defaultDate, companies, users, onSave, onClose }) {
  const isEdit = !!job;
  const [form, setForm] = useState({
    company_id: job?.company_id || '',
    title: job?.title || '',
    service_type: job?.service_type || 'one_time',
    job_type: job?.job_type || 'maintenance',
    scheduled_date: job?.scheduled_date || defaultDate || '',
    scheduled_time: job?.scheduled_time ? job.scheduled_time.slice(0,5) : '',
    duration_hours: job?.duration_hours || 2,
    assigned_user_id: job?.assigned_user_id || '',
    technician: job?.technician || '',
    notes: job?.notes || '',
    status: job?.status || 'scheduled',
    dispatch_notes: job?.dispatch_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!form.title.trim()) return setErr('Title is required');
    if (!form.company_id) return setErr('Company is required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: parseInt(form.company_id),
        assigned_user_id: form.assigned_user_id ? parseInt(form.assigned_user_id) : null,
        duration_hours: parseFloat(form.duration_hours) || 2,
        unscheduled: !form.scheduled_date ? 1 : 0,
        status: form.scheduled_date ? (form.status || 'scheduled') : 'unscheduled',
      };
      let result;
      if (isEdit) {
        result = await axios.put(`/api/jobs/${job.id}`, payload);
      } else {
        result = await axios.post('/api/jobs', payload);
      }
      onSave(result.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Calendar size={18} /> {isEdit ? 'Edit Job' : 'New Job'}
          </h3>
          <button className="btn btn-ghost" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
          {err && <div style={{ background:'#fef2f2', color:'#b91c1c', borderRadius:6, padding:'8px 12px', marginBottom:12, fontSize:13 }}>{err}</div>}

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Title *</label>
              <input className="form-control" value={form.title} onChange={f('title')} placeholder="Job title…" />
            </div>
            <div className="form-group">
              <label className="form-label">Company *</label>
              <select className="form-control" value={form.company_id} onChange={f('company_id')}>
                <option value="">Select company…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Service Type</label>
              <select className="form-control" value={form.service_type} onChange={f('service_type')}>
                {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Scheduled Date</label>
              <input className="form-control" type="date" value={form.scheduled_date} onChange={f('scheduled_date')} />
            </div>
            <div className="form-group">
              <label className="form-label">Scheduled Time</label>
              <input className="form-control" type="time" value={form.scheduled_time} onChange={f('scheduled_time')} />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (hrs)</label>
              <input className="form-control" type="number" min="0.5" step="0.5" value={form.duration_hours} onChange={f('duration_hours')} />
            </div>
            <div className="form-group">
              <label className="form-label">Assigned To</label>
              <select className="form-control" value={form.assigned_user_id} onChange={f('assigned_user_id')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username} {u.role === 'ops' ? '(Ops)' : ''}</option>)}
              </select>
            </div>
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={f('status')}>
                  <option value="unscheduled">Unscheduled</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Dispatch Notes</label>
              <textarea className="form-control" rows={2} value={form.dispatch_notes} onChange={f('dispatch_notes')} placeholder="Notes for field crew…" />
            </div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Internal Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} placeholder="Internal notes…" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update Job' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quick Schedule Modal (from unscheduled queue) ─────────────────────────────
function ScheduleModal({ job, users, onSave, onClose }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [userId, setUserId] = useState(job?.assigned_user_id || '');
  const [duration, setDuration] = useState(job?.duration_hours || 2);
  const [saving, setSaving] = useState(false);

  async function handleSchedule() {
    if (!date) return;
    setSaving(true);
    try {
      const r = await axios.patch(`/api/jobs/${job.id}/schedule`, {
        scheduled_date: date, scheduled_time: time || null,
        assigned_user_id: userId || null, duration_hours: parseFloat(duration) || 2,
      });
      onSave(r.data);
    } catch (_) {}
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3><Calendar size={16}/> Schedule Job</h3>
          <button className="btn btn-ghost" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:12 }}>{job.title}</p>
          {job.company_name && <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>{job.company_name}</p>}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-control" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Time</label>
              <input className="form-control" type="time" value={time} onChange={e=>setTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select className="form-control" value={userId} onChange={e=>setUserId(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duration (hrs)</label>
              <input className="form-control" type="number" min="0.5" step="0.5" value={duration} onChange={e=>setDuration(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSchedule} disabled={!date || saving}>
            {saving ? 'Scheduling…' : 'Schedule Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Invoice from Job ───────────────────────────────────────────────────
function CreateInvoiceModal({ job, onSave, onClose }) {
  const [form, setForm] = useState({
    title: `Invoice — ${job.title}`,
    amount: '',
    tax_amount: '',
    due_date: '',
    notes: '',
    sync_to_qb: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleCreate() {
    if (!form.amount) return setErr('Amount is required');
    setSaving(true);
    try {
      const r = await axios.post('/api/invoices', {
        company_id: job.company_id,
        contact_id: job.contact_id || null,
        job_id: job.id,
        estimate_id: job.estimate_id || null,
        title: form.title,
        amount: parseFloat(form.amount),
        tax_amount: parseFloat(form.tax_amount) || 0,
        due_date: form.due_date || null,
        notes: form.notes || null,
        sync_to_qb: form.sync_to_qb,
      });
      onSave(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <h3>Create Invoice</h3>
          <button className="btn btn-ghost" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          {err && <div style={{ background:'#fef2f2',color:'#b91c1c',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:13 }}>{err}</div>}
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-control" value={form.title} onChange={f('title')} />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input className="form-control" type="number" step="0.01" value={form.amount} onChange={f('amount')} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Tax</label>
              <input className="form-control" type="number" step="0.01" value={form.tax_amount} onChange={f('tax_amount')} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-control" type="date" value={form.due_date} onChange={f('due_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', color:'var(--text-primary)' }}>
            <input type="checkbox" checked={form.sync_to_qb} onChange={e=>setForm(p=>({...p,sync_to_qb:e.target.checked}))} />
            Sync to QuickBooks immediately
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Job Detail Panel ──────────────────────────────────────────────────────────
function JobDetail({ job: initJob, onClose, onEdit, onRefresh }) {
  const [job, setJob] = useState(initJob);
  const [completing, setCompleting] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  async function completeJob() {
    setCompleting(true);
    const r = await axios.patch(`/api/jobs/${job.id}/status`, { status: 'completed' });
    setJob(r.data);
    onRefresh();
    setCompleting(false);
    setShowInvoice(true);
  }

  const statusColor = STATUS_COLORS[job.status] || '#6b7280';

  return (
    <>
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:380, background:'var(--bg-card)',
        boxShadow:'-4px 0 24px rgba(0,0,0,.12)', zIndex:200, display:'flex', flexDirection:'column',
        borderLeft:'1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:18 }}>{SERVICE_ICON[job.service_type] || '📌'}</span>
              <span style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)' }}>{job.title}</span>
            </div>
            <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600,
              background: statusColor + '22', color: statusColor }}>
              {job.status?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
            </span>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding:4 }}><X size={16}/></button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {job.company_name && (
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <Building2 size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:2 }} />
                <div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Client</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{job.company_name}</div>
                </div>
              </div>
            )}
            {(job.property_name || job.property_address) && (
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <MapPin size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:2 }} />
                <div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Property</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{job.property_name}</div>
                  {job.property_address && <div style={{ fontSize:12, color:'var(--text-muted)' }}>{job.property_address}</div>}
                </div>
              </div>
            )}
            {job.scheduled_date && (
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <Calendar size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:2 }} />
                <div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Scheduled</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                    {job.scheduled_date}{job.scheduled_time ? ' @ ' + job.scheduled_time.slice(0,5) : ''}
                  </div>
                </div>
              </div>
            )}
            {(job.assigned_user_name || job.technician) && (
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <User size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:2 }} />
                <div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Assigned To</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{job.assigned_user_name || job.technician}</div>
                </div>
              </div>
            )}
            {job.duration_hours && (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <Clock size={14} style={{ color:'var(--text-muted)' }} />
                <span style={{ fontSize:13, color:'var(--text-primary)' }}>{job.duration_hours}h estimated</span>
              </div>
            )}
            {job.estimate_number && (
              <div style={{ background:'var(--blue-50)', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--blue-600)', textTransform:'uppercase', letterSpacing:'.05em' }}>From Estimate</div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginTop:2 }}>{job.estimate_number} — {job.estimate_title}</div>
              </div>
            )}
            {job.dispatch_notes && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Dispatch Notes</div>
                <div style={{ fontSize:13, color:'var(--text-primary)', background:'var(--bg-page)', borderRadius:6, padding:'8px 10px' }}>{job.dispatch_notes}</div>
              </div>
            )}
            {job.notes && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Notes</div>
                <div style={{ fontSize:13, color:'var(--text-primary)', background:'var(--bg-page)', borderRadius:6, padding:'8px 10px' }}>{job.notes}</div>
              </div>
            )}
            {job.invoice_created && (
              <div style={{ display:'flex', gap:8, alignItems:'center', background:'#f0fdf4', borderRadius:8, padding:'10px 12px', border:'1px solid #bbf7d0' }}>
                <CheckCircle size={16} color="#16a34a" />
                <span style={{ fontSize:13, color:'#15803d', fontWeight:600 }}>Invoice Created</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8 }}>
          {job.status !== 'completed' && job.status !== 'cancelled' && (
            <button className="btn btn-primary" onClick={completeJob} disabled={completing} style={{ background:'#10b981', borderColor:'#10b981' }}>
              <CheckCircle size={15}/> {completing ? 'Completing…' : 'Mark Complete'}
            </button>
          )}
          {job.status === 'completed' && !job.invoice_created && (
            <button className="btn btn-primary" onClick={() => setShowInvoice(true)}>
              Create Invoice
            </button>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => onEdit(job)}>
              <Edit2 size={13}/> Edit
            </button>
          </div>
        </div>
      </div>

      {showInvoice && (
        <CreateInvoiceModal
          job={job}
          onSave={() => { setShowInvoice(false); onRefresh(); }}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </>
  );
}

// ── Main Schedule Component ───────────────────────────────────────────────────
export default function Schedule() {
  const today = new Date();
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [jobs, setJobs] = useState([]);
  const [unscheduled, setUnscheduled] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'schedule'
  const [modalData, setModalData] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [routeFilter, setRouteFilter] = useState('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, unRes] = await Promise.all([
        axios.get('/api/jobs', { params: { year, month: month + 1 } }),
        axios.get('/api/jobs/unscheduled'),
      ]);
      setJobs(jobsRes.data);
      setUnscheduled(unRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    axios.get('/api/companies').then(r => setCompanies(r.data)).catch(() => {});
    axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }

  function jobsForDate(ds) { return jobs.filter(j => j.scheduled_date === ds); }

  async function deleteJob(id) {
    await axios.delete(`/api/jobs/${id}`);
    setConfirm(null);
    setDetailJob(null);
    fetchAll();
  }

  // Routes view — group scheduled jobs by service_type
  const routeJobs = jobs.filter(j => j.service_type && j.service_type !== 'one_time');
  const routeGroups = {};
  for (const j of routeJobs) {
    const key = j.service_type;
    if (!routeGroups[key]) routeGroups[key] = [];
    routeGroups[key].push(j);
  }

  // ─ Calendar metrics ─
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayDs = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── Unscheduled Sidebar ── */}
      <div style={{
        width:260, flexShrink:0, borderRight:'1px solid var(--border)',
        background:'var(--bg-card)', display:'flex', flexDirection:'column',
        overflow:'hidden'
      }}>
        <div style={{ padding:'16px 14px 10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:6 }}>
              <AlertCircle size={14} color="#f59e0b" />
              Needs Scheduling
              {unscheduled.length > 0 && (
                <span style={{ background:'#f59e0b', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 6px' }}>{unscheduled.length}</span>
              )}
            </div>
            <button
              className="btn btn-primary"
              style={{ padding:'4px 10px', fontSize:11 }}
              onClick={() => { setModal('create'); setModalData(null); setSelectedDate(''); }}
            >
              <Plus size={12}/> New
            </button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {unscheduled.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>
              <CheckCircle size={28} color="var(--green-600)" style={{ marginBottom:8 }} />
              <p style={{ margin:0 }}>All jobs scheduled!</p>
            </div>
          ) : unscheduled.map(job => (
            <div key={job.id}
              style={{
                padding:'10px 14px', borderBottom:'1px solid var(--border)', cursor:'pointer',
                transition:'background .1s'
              }}
              onClick={() => setDetailJob(job)}
            >
              <div style={{ fontWeight:600, fontSize:12, color:'var(--text-primary)', marginBottom:2 }}>
                {SERVICE_ICON[job.service_type] || '📌'} {job.title}
              </div>
              {job.company_name && (
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
                  <Building2 size={10} style={{ marginRight:3 }} />{job.company_name}
                </div>
              )}
              {job.property_name && (
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
                  <MapPin size={10} style={{ marginRight:3 }} />{job.property_name}
                </div>
              )}
              <button
                className="btn btn-secondary"
                style={{ padding:'2px 8px', fontSize:10, width:'100%' }}
                onClick={e => { e.stopPropagation(); setModal('schedule'); setModalData(job); }}
              >
                <Calendar size={9}/> Schedule
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={prevMonth} className="btn btn-ghost" style={{ padding:'4px 8px' }}><ChevronLeft size={16}/></button>
            <button onClick={nextMonth} className="btn btn-ghost" style={{ padding:'4px 8px' }}><ChevronRight size={16}/></button>
            <button onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))} className="btn btn-secondary" style={{ fontSize:12, padding:'5px 10px' }}>Today</button>
            <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'var(--text-primary)' }}>{MONTHS[month]} {year}</h2>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[
              { id:'month', icon:<Calendar size={14}/>, label:'Month' },
              { id:'list',  icon:<List size={14}/>,     label:'List' },
              { id:'routes',icon:<Navigation size={14}/>,label:'Routes' },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`btn ${view === v.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding:'5px 12px', fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary bar */}
        <div style={{ padding:'8px 16px', display:'flex', gap:8, flexWrap:'wrap', flexShrink:0, background:'var(--bg-page)' }}>
          {Object.entries(STATUS_COLORS).map(([s, color]) => {
            const count = jobs.filter(j => j.status === s).length;
            if (!count) return null;
            return (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:5, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 10px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:color }} />
                <span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                  {s.replace(/_/g,' ')} <strong style={{ color:'var(--text-primary)' }}>{count}</strong>
                </span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>

          {/* ── Month Calendar ── */}
          {view === 'month' && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--bg-page)', borderBottom:'1px solid var(--border)' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding:'8px 4px', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.5px' }}>{d}</div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                {Array.from({ length:totalCells }, (_, i) => {
                  const dayNum = i - firstDay + 1;
                  const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                  const ds = inMonth ? dateStr(year, month, dayNum) : null;
                  const isToday = ds === todayDs;
                  const dayJobs = ds ? jobsForDate(ds) : [];
                  return (
                    <div key={i}
                      onClick={() => inMonth && (setModal('create'), setSelectedDate(ds))}
                      style={{
                        padding:'5px 4px', cursor: inMonth ? 'pointer' : 'default',
                        borderRight: (i+1)%7 !== 0 ? '1px solid var(--border)' : 'none',
                        borderBottom: i < totalCells - 7 ? '1px solid var(--border)' : 'none',
                        background: isToday ? 'var(--blue-50)' : inMonth ? 'var(--bg-card)' : 'var(--bg-page)',
                        minHeight: 90,
                      }}>
                      {inMonth && (
                        <>
                          <div style={{
                            width:24, height:24, borderRadius:'50%',
                            background: isToday ? '#2563eb' : 'transparent',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:12, fontWeight: isToday ? 700 : 500,
                            color: isToday ? '#fff' : 'var(--text-primary)', marginBottom:3
                          }}>{dayNum}</div>
                          {dayJobs.slice(0,3).map(job => (
                            <div key={job.id}
                              onClick={e => { e.stopPropagation(); setDetailJob(job); }}
                              style={{
                                background: (STATUS_COLORS[job.status]||'#6b7280') + '22',
                                borderLeft: `3px solid ${STATUS_COLORS[job.status]||'#6b7280'}`,
                                borderRadius:4, padding:'2px 4px', fontSize:10, cursor:'pointer',
                                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                color:'var(--text-primary)', fontWeight:500, marginBottom:1
                              }}>
                              {SERVICE_ICON[job.service_type] || '📌'} {job.title}
                            </div>
                          ))}
                          {dayJobs.length > 3 && <div style={{ fontSize:10, color:'var(--text-muted)', paddingLeft:4 }}>+{dayJobs.length-3} more</div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── List View ── */}
          {view === 'list' && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              {loading ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
              ) : jobs.length === 0 ? (
                <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>
                  <Calendar size={40} style={{ marginBottom:8, opacity:.3 }} />
                  <p>No jobs scheduled for {MONTHS[month]} {year}</p>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr auto', padding:'8px 16px', background:'var(--bg-page)', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                    <span>Job</span><span>Client</span><span>Type</span><span>Date / Time</span><span>Assigned</span><span></span>
                  </div>
                  {jobs.map((job, i) => {
                    const statusColor = STATUS_COLORS[job.status] || '#6b7280';
                    return (
                      <div key={job.id}
                        onClick={() => setDetailJob(job)}
                        style={{
                          display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr auto',
                          padding:'10px 16px', borderBottom: i < jobs.length-1 ? '1px solid var(--border)' : 'none',
                          cursor:'pointer', alignItems:'center', transition:'background .1s'
                        }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>
                            {SERVICE_ICON[job.service_type] || '📌'} {job.title}
                          </div>
                          <span style={{ padding:'1px 8px', borderRadius:20, fontSize:10, fontWeight:600, background:statusColor+'22', color:statusColor }}>
                            {job.status?.replace(/_/g,' ')}
                          </span>
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{job.company_name || '—'}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{SERVICE_TYPES.find(s=>s.value===job.service_type)?.label || '—'}</div>
                        <div style={{ fontSize:12, color:'var(--text-primary)' }}>
                          {job.scheduled_date ? <>
                            {job.scheduled_date}
                            {job.scheduled_time && <div style={{ fontSize:11, color:'var(--text-muted)' }}>@ {job.scheduled_time.slice(0,5)}</div>}
                          </> : <span style={{ color:'#f59e0b', fontWeight:600 }}>Needs date</span>}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{job.assigned_user_name || job.technician || '—'}</div>
                        <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setModal('edit'); setModalData(job); }}>
                            <Edit2 size={12}/>
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ id:job.id, title:job.title })}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Routes View ── */}
          {view === 'routes' && (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                {['all', 'landscape_route', 'snow_route', 'maintenance'].map(f => (
                  <button key={f} onClick={()=>setRouteFilter(f)}
                    className={`btn ${routeFilter===f?'btn-primary':'btn-secondary'}`}
                    style={{ fontSize:12, padding:'5px 12px' }}>
                    {f === 'all' ? 'All Routes' : SERVICE_TYPES.find(s=>s.value===f)?.label || f}
                  </button>
                ))}
              </div>

              {Object.entries(routeGroups).filter(([k]) => routeFilter === 'all' || routeFilter === k).map(([type, typeJobs]) => {
                const svc = SERVICE_TYPES.find(s => s.value === type) || { icon:'📌', label: type };
                // Group by scheduled_date
                const byDate = {};
                for (const j of typeJobs) {
                  const dk = j.scheduled_date || 'Unscheduled';
                  if (!byDate[dk]) byDate[dk] = [];
                  byDate[dk].push(j);
                }
                return (
                  <div key={type} style={{ marginBottom:24 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                      <span style={{ fontSize:20 }}>{svc.icon}</span>
                      <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{svc.label}</h3>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>({typeJobs.length} jobs)</span>
                    </div>
                    {Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([dk, dateJobs]) => {
                      const totalHrs = dateJobs.reduce((s,j)=>s+(parseFloat(j.duration_hours)||0),0);
                      return (
                        <div key={dk} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, marginBottom:12, overflow:'hidden' }}>
                          <div style={{ padding:'10px 16px', background:'var(--bg-page)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>
                              {dk === 'Unscheduled' ? '⚠️ Unscheduled' : `📅 ${dk}`}
                            </span>
                            <div style={{ display:'flex', gap:12 }}>
                              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{dateJobs.length} stops</span>
                              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{totalHrs}h total</span>
                            </div>
                          </div>
                          {dateJobs.map((job, idx) => (
                            <div key={job.id}
                              onClick={() => setDetailJob(job)}
                              style={{
                                padding:'10px 16px', display:'flex', alignItems:'center', gap:12,
                                borderBottom: idx < dateJobs.length-1 ? '1px solid var(--border)' : 'none',
                                cursor:'pointer'
                              }}>
                              <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--blue-50)', border:'2px solid var(--blue-200)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--blue-600)', flexShrink:0 }}>{idx+1}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{job.title}</div>
                                <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                                  {job.company_name}
                                  {job.property_address && ` · ${job.property_address}`}
                                </div>
                              </div>
                              <div style={{ textAlign:'right', flexShrink:0 }}>
                                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{job.duration_hours}h</div>
                                {job.assigned_user_name && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{job.assigned_user_name}</div>}
                              </div>
                              <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600,
                                background:(STATUS_COLORS[job.status]||'#6b7280')+'22',
                                color:STATUS_COLORS[job.status]||'#6b7280', flexShrink:0 }}>
                                {job.status?.replace(/_/g,' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {Object.keys(routeGroups).filter(k => routeFilter === 'all' || routeFilter === k).length === 0 && (
                <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>
                  <Navigation size={40} style={{ marginBottom:8, opacity:.3 }} />
                  <p>No route jobs found for {MONTHS[month]} {year}.</p>
                  <p style={{ fontSize:13 }}>Create jobs with service types like "Landscape Route" or "Snow Route" to see them here.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === 'create' && (
        <JobModal
          defaultDate={selectedDate}
          companies={companies}
          users={users}
          onSave={() => { setModal(null); fetchAll(); }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'edit' && modalData && (
        <JobModal
          job={modalData}
          companies={companies}
          users={users}
          onSave={() => { setModal(null); fetchAll(); if (detailJob?.id === modalData.id) setDetailJob(null); }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'schedule' && modalData && (
        <ScheduleModal
          job={modalData}
          users={users}
          onSave={() => { setModal(null); fetchAll(); }}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Job Detail Panel ── */}
      {detailJob && (
        <JobDetail
          job={detailJob}
          onClose={() => setDetailJob(null)}
          onEdit={j => { setModal('edit'); setModalData(j); setDetailJob(null); }}
          onRefresh={() => { fetchAll(); }}
        />
      )}

      {/* ── Confirm Delete ── */}
      {confirm && (
        <Confirm
          msg={`Delete job "${confirm.title}"? This cannot be undone.`}
          onYes={() => deleteJob(confirm.id)}
          onNo={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
