import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const JOB_TYPES = ['maintenance', 'repair', 'installation', 'inspection', 'plumbing', 'emergency', 'other'];
const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const STATUS_COLORS = {
  scheduled: '#3b82f6',
  in_progress: '#f59e0b',
  completed: '#10b981',
  cancelled: '#6b7280',
};
const STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const TYPE_ICONS = {
  maintenance: '🔧', repair: '🛠️', installation: '⚙️', inspection: '🔍',
  plumbing: '🪠', emergency: '🚨', other: '📌',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function Schedule() {
  const today = new Date();
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/jobs', { params: { year, month: month + 1 } });
      setJobs(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    axios.get('/api/companies').then(r => setCompanies(r.data)).catch(() => {});
    axios.get('/api/contacts').then(r => setContacts(r.data)).catch(() => {});
    axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }
  function goToday() { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); }

  function openCreate(date) {
    setEditJob(null);
    setSelectedDate(date);
    setShowModal(true);
  }

  function openEdit(job, e) {
    e.stopPropagation();
    setEditJob(job);
    setSelectedDate(null);
    setShowModal(true);
    setDetailJob(null);
  }

  function jobsForDate(dateStr) {
    return jobs.filter(j => j.scheduled_date === dateStr);
  }

  function dateStr(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const weekStart = (() => {
    const base = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date(year, month, today.getDate());
    const d = new Date(base);
    d.setDate(d.getDate() - d.getDay());
    return d;
  })();

  return (
    <div className="sched-page">

      {/* ── Header ── */}
      <div data-tour="schedule" className="sched-top">
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Schedule</h2>
          <p style={{ margin: '2px 0 0', color: '#888', fontSize: 13 }}>Manage service jobs and appointments</p>
        </div>
        <div className="sched-top-right">
          {/* View switcher */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {['month', 'week', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  background: view === v ? '#2563eb' : 'transparent',
                  color: view === v ? '#fff' : '#555', transition: 'all .15s' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => openCreate(dateStr(year, month, today.getDate()))}
            style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + New Job
          </button>
        </div>
      </div>

      {/* ── Month navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <button onClick={nextMonth} style={navBtn}>›</button>
        <button onClick={goToday} style={{ ...navBtn, fontSize: 12, padding: '5px 12px' }}>Today</button>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{MONTHS[month]} {year}</h3>
      </div>

      {/* ── Status stats bar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map(s => {
          const count = jobs.filter(j => j.status === s).length;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLORS[s], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>{STATUS_LABELS[s]}: <strong>{count}</strong></span>
            </div>
          );
        })}
      </div>

      {/* ── Month View ── */}
      {view === 'month' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px' }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstDay + 1;
              const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
              const ds = isCurrentMonth ? dateStr(year, month, dayNum) : null;
              const todayDs = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
              const isToday = ds === todayDs;
              const dayJobs = ds ? jobsForDate(ds) : [];
              return (
                <div key={i} onClick={() => isCurrentMonth && openCreate(ds)}
                  className="cal-day-cell"
                  style={{
                    padding: '5px 4px',
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid #e2e8f0' : 'none',
                    borderBottom: i < totalCells - 7 ? '1px solid #e2e8f0' : 'none',
                    background: isToday ? '#eff6ff' : isCurrentMonth ? '#fff' : '#fafafa',
                    cursor: isCurrentMonth ? 'pointer' : 'default',
                    transition: 'background .1s',
                  }}>
                  {isCurrentMonth && (
                    <>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: isToday ? '#2563eb' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: isToday ? 700 : 500,
                        color: isToday ? '#fff' : '#333', marginBottom: 3,
                      }}>
                        {dayNum}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayJobs.slice(0, 2).map(job => (
                          <div key={job.id} onClick={e => { e.stopPropagation(); setDetailJob(job); }}
                            style={{
                              background: STATUS_COLORS[job.status] + '22',
                              border: `1.5px solid ${STATUS_COLORS[job.status]}44`,
                              borderLeft: `3px solid ${STATUS_COLORS[job.status]}`,
                              borderRadius: 4, padding: '2px 4px', fontSize: 10, cursor: 'pointer',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              color: '#333', fontWeight: 500,
                            }}>
                            {TYPE_ICONS[job.job_type]} {job.title}
                          </div>
                        ))}
                        {dayJobs.length > 2 && (
                          <div style={{ fontSize: 10, color: '#888', paddingLeft: 4 }}>+{dayJobs.length - 2} more</div>
                        )}
                      </div>
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
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading…</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#aaa' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
              <p>No jobs scheduled for {MONTHS[month]} {year}</p>
              <button onClick={() => openCreate(dateStr(year, month, today.getDate()))}
                style={{ marginTop: 10, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Schedule First Job
              </button>
            </div>
          ) : (
            jobs.map((job, i) => (
              <div key={job.id}
                style={{ padding: '14px 16px', borderBottom: i < jobs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                {/* Top row: icon + title + status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{TYPE_ICONS[job.job_type]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{job.title}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                      {job.company_name && <span>🏢 {job.company_name} · </span>}
                      {job.technician && <span>👷 {job.technician} · </span>}
                      {job.scheduled_date && <span>📅 {job.scheduled_date}{job.scheduled_time ? ' @ ' + job.scheduled_time.slice(0, 5) : ''}</span>}
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0,
                    background: STATUS_COLORS[job.status] + '22', color: STATUS_COLORS[job.status] }}>
                    {STATUS_LABELS[job.status]}
                  </span>
                </div>
                {/* Actions row */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 32 }}>
                  <button onClick={e => openEdit(job, e)}
                    style={{ padding: '5px 14px', fontSize: 12, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                    Edit
                  </button>
                  <button onClick={async () => { await axios.delete(`/api/jobs/${job.id}`); fetchJobs(); }}
                    style={{ padding: '5px 14px', fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Week View ── */}
      {view === 'week' && (
        <div className="cal-week-scroll" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div className="cal-week-inner">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
                const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
                const todayDs = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <div key={i} style={{ padding: '10px 6px', textAlign: 'center', background: ds === todayDs ? '#eff6ff' : '' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{DAYS[d.getDay()]}</div>
                    <div style={{ fontSize: 18, fontWeight: ds === todayDs ? 700 : 400, color: ds === todayDs ? '#2563eb' : '#333' }}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 260 }}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
                const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
                const dayJobs = jobsForDate(ds);
                return (
                  <div key={i} onClick={() => openCreate(ds)}
                    style={{ padding: 6, borderRight: i < 6 ? '1px solid #e2e8f0' : 'none', minHeight: 200, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dayJobs.map(job => (
                        <div key={job.id} onClick={e => { e.stopPropagation(); setDetailJob(job); }}
                          style={{ background: STATUS_COLORS[job.status] + '22', borderLeft: `3px solid ${STATUS_COLORS[job.status]}`,
                            borderRadius: 4, padding: '4px 5px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                          {job.scheduled_time ? <span style={{ color: '#888', fontSize: 10 }}>{job.scheduled_time.slice(0, 5)} </span> : null}
                          {job.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Job Detail Sheet ── */}
      {detailJob && (
        <div className="sched-overlay" onClick={() => setDetailJob(null)}>
          <div className="sched-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            {/* Drag handle on mobile */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22 }}>{TYPE_ICONS[detailJob.job_type]}</div>
                <h3 style={{ margin: '4px 0 0', fontSize: 17 }}>{detailJob.title}</h3>
              </div>
              <button onClick={() => setDetailJob(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13, color: '#555' }}>
              <div><strong>Status:</strong> <span style={{ color: STATUS_COLORS[detailJob.status], fontWeight: 600 }}>{STATUS_LABELS[detailJob.status]}</span></div>
              {detailJob.company_name && <div><strong>Company:</strong> {detailJob.company_name}</div>}
              {detailJob.contact_name && <div><strong>Contact:</strong> {detailJob.contact_name}</div>}
              {detailJob.technician && <div><strong>Technician:</strong> {detailJob.technician}</div>}
              {detailJob.scheduled_date && <div><strong>Date:</strong> {detailJob.scheduled_date}{detailJob.scheduled_time ? ' at ' + detailJob.scheduled_time : ''}</div>}
              {detailJob.duration_hours && <div><strong>Duration:</strong> {detailJob.duration_hours}h</div>}
              {detailJob.notes && <div><strong>Notes:</strong> {detailJob.notes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={e => openEdit(detailJob, e)}
                style={{ flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Edit Job
              </button>
              <button onClick={async () => { await axios.delete(`/api/jobs/${detailJob.id}`); setDetailJob(null); fetchJobs(); }}
                style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Job Modal ── */}
      {showModal && (
        <JobModal
          job={editJob}
          defaultDate={selectedDate}
          companies={companies}
          contacts={contacts}
          users={users}
          onSave={async (data) => {
            if (editJob) await axios.put(`/api/jobs/${editJob.id}`, data);
            else await axios.post('/api/jobs', data);
            setShowModal(false);
            fetchJobs();
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function JobModal({ job, defaultDate, companies, contacts, users, onSave, onClose }) {
  const [form, setForm] = useState({
    title: job?.title || '',
    job_type: job?.job_type || 'maintenance',
    company_id: job?.company_id || '',
    contact_id: job?.contact_id || '',
    technician: job?.technician || '',
    status: job?.status || 'scheduled',
    scheduled_date: job?.scheduled_date || defaultDate || '',
    scheduled_time: job?.scheduled_time || '',
    duration_hours: job?.duration_hours || 2,
    notes: job?.notes || '',
    is_reminder: job?.is_reminder || 0,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  // Technician users only (exclude demo role)
  const techUsers = users.filter(u => u.role !== 'demo');

  return (
    <div className="sched-overlay" onClick={onClose}>
      <div className="sched-modal" onClick={e => e.stopPropagation()}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{job ? 'Edit Job' : 'New Job'}</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Job Title *</label>
              <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Annual HVAC Maintenance" required />
            </div>
            <div>
              <label style={lbl}>Job Type</label>
              <select style={inp} value={form.job_type} onChange={e => set('job_type', e.target.value)}>
                {JOB_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Company</label>
              <select style={inp} value={form.company_id} onChange={e => set('company_id', e.target.value)}>
                <option value="">— None —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Contact</label>
              <select style={inp} value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
                <option value="">— None —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Technician</label>
              <select style={inp} value={form.technician} onChange={e => set('technician', e.target.value)}>
                <option value="">— Unassigned —</option>
                {techUsers.map(u => (
                  <option key={u.id} value={u.username}>{u.username} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Duration (hours)</label>
              <input type="number" style={inp} value={form.duration_hours} min={0.5} step={0.5} onChange={e => set('duration_hours', parseFloat(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Date</label>
              <input type="date" style={inp} value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Time</label>
              <input type="time" style={inp} value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, minHeight: 68, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Job notes, special instructions…" />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="is_reminder" checked={!!form.is_reminder} onChange={e => set('is_reminder', e.target.checked ? 1 : 0)} />
              <label htmlFor="is_reminder" style={{ fontSize: 13, color: '#555', cursor: 'pointer' }}>Mark as service reminder</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: '11px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              {saving ? 'Saving…' : job ? 'Save Changes' : 'Create Job'}
            </button>
            <button type="button" onClick={onClose}
              style={{ padding: '11px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const closeBtn = {
  background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', padding: 4,
};
const navBtn = {
  padding: '5px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0',
  borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#555',
};
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 };
const inp = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff',
};
