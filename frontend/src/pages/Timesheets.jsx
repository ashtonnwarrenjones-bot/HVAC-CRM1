import React, { useState, useEffect } from 'react';
import { Plus, Clock, Users, ChevronLeft, ChevronRight, Trash2, Edit2, DollarSign } from 'lucide-react';
import axios from 'axios';

function fmt(n) { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtHrs(h) { const hrs = parseFloat(h) || 0; return hrs.toFixed(1) + ' hrs'; }

function getWeekStart(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff);
  return dt.toISOString().split('T')[0];
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Timesheets() {
  const [week, setWeek] = useState(() => getWeekStart(new Date().toISOString().split('T')[0]));
  const [entries, setEntries] = useState([]);
  const [crew, setCrew] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCrew, setFilterCrew] = useState('');
  const [tab, setTab] = useState('week');

  const [form, setForm] = useState({
    crew_member_id: '', job_id: '', work_date: new Date().toISOString().split('T')[0],
    clock_in: '', clock_out: '', hours: '', notes: ''
  });

  useEffect(() => { loadCrew(); loadJobs(); }, []);
  useEffect(() => { loadEntries(); loadSummary(); }, [week]);

  async function loadCrew() {
    try { const r = await axios.get('/api/crew'); setCrew(Array.isArray(r.data) ? r.data : []); } catch {}
  }
  async function loadJobs() {
    try { const r = await axios.get('/api/jobs'); setJobs(Array.isArray(r.data) ? r.data : []); } catch {}
  }
  async function loadEntries() {
    setLoading(true);
    try { const r = await axios.get(`/api/timesheets?week=${week}`); setEntries(Array.isArray(r.data) ? r.data : []); } catch {}
    setLoading(false);
  }
  async function loadSummary() {
    try {
      const weekEnd = addDays(week, 6);
      const r = await axios.get(`/api/timesheets/summary?from=${week}&to=${weekEnd}`);
      setSummary(Array.isArray(r.data) ? r.data : []);
    } catch {}
  }

  function prevWeek() { setWeek(addDays(week, -7)); }
  function nextWeek() { setWeek(addDays(week, 7)); }
  function thisWeek() { setWeek(getWeekStart(new Date().toISOString().split('T')[0])); }

  function openNew(date) {
    setEditing(null);
    setForm({ crew_member_id: '', job_id: '', work_date: date || new Date().toISOString().split('T')[0], clock_in: '', clock_out: '', hours: '', notes: '' });
    setShowForm(true);
  }
  function openEdit(entry) {
    setEditing(entry.id);
    setForm({
      crew_member_id: entry.crew_member_id || '',
      job_id: entry.job_id || '',
      work_date: entry.work_date || '',
      clock_in: entry.clock_in || '',
      clock_out: entry.clock_out || '',
      hours: entry.hours || '',
      notes: entry.notes || '',
    });
    setShowForm(true);
  }

  async function saveEntry() {
    try {
      if (editing) { await axios.put(`/api/timesheets/${editing}`, form); }
      else { await axios.post('/api/timesheets', form); }
      setShowForm(false);
      loadEntries();
      loadSummary();
    } catch (e) { alert(e.response?.data?.error || 'Save failed'); }
  }

  async function deleteEntry(id) {
    if (!window.confirm('Remove this time entry?')) return;
    try { await axios.delete(`/api/timesheets/${id}`); loadEntries(); loadSummary(); } catch {}
  }

  function calcHours(clockIn, clockOut) {
    if (!clockIn || !clockOut) return '';
    const [ih, im] = clockIn.split(':').map(Number);
    const [oh, om] = clockOut.split(':').map(Number);
    const hrs = ((oh * 60 + om) - (ih * 60 + im)) / 60;
    return hrs > 0 ? hrs.toFixed(2) : '';
  }

  const filtered = entries.filter(e => !filterCrew || String(e.crew_member_id) === filterCrew);
  const totalHours = filtered.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  const totalCost = filtered.reduce((s, e) => s + ((parseFloat(e.hours) || 0) * (parseFloat(e.hourly_rate) || 0)), 0);
  const activeCrew = new Set(filtered.map(e => e.crew_member_id)).size;

  const IS = {
    page: { padding: 24, maxWidth: 1200, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    h1: { margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.02em' },
    sub: { margin: '2px 0 0', fontSize: 13, color: '#64748b' },
    logBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    weekNav: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
    navBtn: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569' },
    weekLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1e293b' },
    thisWeekBtn: { background: '#fff', border: '1px solid #0f766e', color: '#0f766e', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 },
    card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 },
    cardLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
    cardVal: { fontSize: 24, fontWeight: 700, color: '#1e293b' },
    tabRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    tabs: { display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 8, padding: 4 },
    tabActive: { background: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.1)' },
    tabInactive: { background: 'transparent', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 500, color: '#64748b', cursor: 'pointer' },
    filterSel: { padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none' },
    table: { width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
    thR: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
    td: { padding: '10px 14px', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f1f5f9' },
    tdMuted: { padding: '10px 14px', fontSize: 13, color: '#64748b', borderBottom: '1px solid #f1f5f9' },
    tdR: { padding: '10px 14px', fontSize: 13, color: '#1e293b', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f1f5f9' },
    tdGreen: { padding: '10px 14px', fontSize: 13, color: '#0f766e', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f1f5f9' },
    tdActions: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' },
    actionBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#94a3b8', borderRadius: 4 },
    empty: { textAlign: 'center', padding: '48px 0', color: '#94a3b8' },
    // Modal
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' },
    modalTitle: { margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1e293b' },
    label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 },
    input: { width: '100%', padding: '8px 11px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' },
    fieldRow: { marginBottom: 14 },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
    saveBtn: { flex: 1, background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    cancelBtn: { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 20px', fontSize: 13, cursor: 'pointer' },
  };

  return (
    <div style={IS.page}>
      {/* Header */}
      <div style={IS.header}>
        <div>
          <h1 style={IS.h1}>Timesheets</h1>
          <p style={IS.sub}>Track crew hours by job</p>
        </div>
        <button style={IS.logBtn} onClick={() => openNew()}>
          <Plus size={15} /> Log Time
        </button>
      </div>

      {/* Week nav */}
      <div style={IS.weekNav}>
        <button style={IS.navBtn} onClick={prevWeek}><ChevronLeft size={16} /></button>
        <span style={IS.weekLabel}>{fmtDate(week)} – {fmtDate(addDays(week, 6))}</span>
        <button style={IS.navBtn} onClick={nextWeek}><ChevronRight size={16} /></button>
        <button style={IS.thisWeekBtn} onClick={thisWeek}>This Week</button>
      </div>

      {/* Stats */}
      <div style={IS.statsRow}>
        <div style={IS.card}>
          <div style={IS.cardLabel}><Clock size={14} color="#3b82f6" /> Total Hours</div>
          <div style={IS.cardVal}>{totalHours.toFixed(1)}</div>
        </div>
        <div style={IS.card}>
          <div style={IS.cardLabel}><DollarSign size={14} color="#0f766e" /> Labor Cost</div>
          <div style={IS.cardVal}>{fmt(totalCost)}</div>
        </div>
        <div style={IS.card}>
          <div style={IS.cardLabel}><Users size={14} color="#7c3aed" /> Crew Active</div>
          <div style={IS.cardVal}>{activeCrew}</div>
        </div>
      </div>

      {/* Tabs + filter */}
      <div style={IS.tabRow}>
        <div style={IS.tabs}>
          <button style={tab === 'week' ? IS.tabActive : IS.tabInactive} onClick={() => setTab('week')}>Time Log</button>
          <button style={tab === 'summary' ? IS.tabActive : IS.tabInactive} onClick={() => setTab('summary')}>Summary</button>
        </div>
        {tab === 'week' && (
          <select value={filterCrew} onChange={e => setFilterCrew(e.target.value)} style={IS.filterSel}>
            <option value="">All Crew</option>
            {crew.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Content */}
      {tab === 'summary' ? (
        <table style={IS.table}>
          <thead>
            <tr>
              {['Crew Member', 'Entries', 'Hours', 'Rate', 'Cost'].map((h, i) => (
                <th key={h} style={i === 0 ? IS.th : IS.thR}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr><td colSpan={5} style={{ ...IS.td, ...IS.empty }}>No data for this week</td></tr>
            ) : summary.map(s => (
              <tr key={s.id}>
                <td style={{ ...IS.td, fontWeight: 600 }}>{s.name}</td>
                <td style={{ ...IS.tdMuted, textAlign: 'right' }}>{s.entries}</td>
                <td style={IS.tdR}>{fmtHrs(s.total_hours)}</td>
                <td style={{ ...IS.tdMuted, textAlign: 'right' }}>{fmt(s.hourly_rate)}/hr</td>
                <td style={IS.tdGreen}>{fmt(s.total_cost)}</td>
              </tr>
            ))}
            {summary.length > 0 && (
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ ...IS.td, fontWeight: 700 }}>Total</td>
                <td style={{ ...IS.tdMuted, textAlign: 'right' }}>{summary.reduce((s, r) => s + (r.entries || 0), 0)}</td>
                <td style={{ ...IS.tdR }}>{fmtHrs(summary.reduce((s, r) => s + parseFloat(r.total_hours || 0), 0))}</td>
                <td style={IS.tdMuted}></td>
                <td style={IS.tdGreen}>{fmt(summary.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0))}</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : loading ? (
        <div style={IS.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={IS.empty}>
          <Clock size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
          <p style={{ margin: '0 0 14px', color: '#94a3b8' }}>No time logged this week</p>
          <button style={IS.logBtn} onClick={() => openNew()}>
            <Plus size={14} /> Log Time
          </button>
        </div>
      ) : (
        <table style={IS.table}>
          <thead>
            <tr>
              <th style={IS.th}>Crew</th>
              <th style={IS.th}>Date</th>
              <th style={IS.th}>Job</th>
              <th style={IS.th}>Clock In/Out</th>
              <th style={IS.thR}>Hours</th>
              <th style={IS.thR}>Cost</th>
              <th style={IS.thR}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id}>
                <td style={{ ...IS.td, fontWeight: 600 }}>{e.crew_name}</td>
                <td style={IS.tdMuted}>{fmtDate(e.work_date)}</td>
                <td style={IS.tdMuted}>{e.job_title || '—'}</td>
                <td style={{ ...IS.tdMuted, fontFamily: 'monospace', fontSize: 12 }}>
                  {e.clock_in && e.clock_out ? `${e.clock_in} – ${e.clock_out}` : '—'}
                </td>
                <td style={IS.tdR}>{fmtHrs(e.hours)}</td>
                <td style={IS.tdGreen}>{fmt((parseFloat(e.hours) || 0) * (parseFloat(e.hourly_rate) || 0))}</td>
                <td style={IS.tdActions}>
                  <button style={IS.actionBtn} onClick={() => openEdit(e)} title="Edit"><Edit2 size={13} /></button>
                  <button style={{ ...IS.actionBtn, color: '#ef4444' }} onClick={() => deleteEntry(e.id)} title="Delete"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {showForm && (
        <div style={IS.overlay} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={IS.modal}>
            <h2 style={IS.modalTitle}>{editing ? 'Edit Time Entry' : 'Log Time'}</h2>

            <div style={IS.fieldRow}>
              <label style={IS.label}>Crew Member *</label>
              <select value={form.crew_member_id} onChange={e => setForm(f => ({ ...f, crew_member_id: e.target.value }))} style={IS.input}>
                <option value="">Select crew member…</option>
                {crew.map(c => <option key={c.id} value={c.id}>{c.name} – {fmt(c.hourly_rate)}/hr</option>)}
              </select>
            </div>

            <div style={IS.fieldRow}>
              <label style={IS.label}>Job (optional)</label>
              <select value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} style={IS.input}>
                <option value="">No job</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>

            <div style={IS.fieldRow}>
              <label style={IS.label}>Date *</label>
              <input type="date" value={form.work_date} onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} style={IS.input} />
            </div>

            <div style={IS.twoCol}>
              <div>
                <label style={IS.label}>Clock In</label>
                <input type="time" value={form.clock_in} style={IS.input} onChange={e => {
                  const ci = e.target.value;
                  const autoHrs = calcHours(ci, form.clock_out);
                  setForm(f => ({ ...f, clock_in: ci, hours: autoHrs || f.hours }));
                }} />
              </div>
              <div>
                <label style={IS.label}>Clock Out</label>
                <input type="time" value={form.clock_out} style={IS.input} onChange={e => {
                  const co = e.target.value;
                  const autoHrs = calcHours(form.clock_in, co);
                  setForm(f => ({ ...f, clock_out: co, hours: autoHrs || f.hours }));
                }} />
              </div>
            </div>

            <div style={IS.fieldRow}>
              <label style={IS.label}>Hours (auto-calculated from clock times)</label>
              <input type="number" value={form.hours} min="0" max="24" step="0.25" placeholder="e.g. 8.0"
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} style={IS.input} />
            </div>

            <div style={{ ...IS.fieldRow, marginBottom: 20 }}>
              <label style={IS.label}>Notes</label>
              <input value={form.notes} placeholder="Optional notes…"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={IS.input} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={IS.saveBtn} onClick={saveEntry}>{editing ? 'Save Changes' : 'Log Time'}</button>
              <button style={IS.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
