import React, { useState, useEffect } from 'react';
import { Plus, Clock, Users, Briefcase, ChevronLeft, ChevronRight, Trash2, Edit2, DollarSign, Search } from 'lucide-react';
import axios from 'axios';

function fmt(n) { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtHrs(h) { const hrs = parseFloat(h) || 0; return hrs.toFixed(1) + ' hrs'; }

function getWeekStart(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=Sun
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1); // Mon
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
  const [tab, setTab] = useState('week'); // 'week' | 'summary'

  const [form, setForm] = useState({
    crew_member_id: '', job_id: '', work_date: new Date().toISOString().split('T')[0],
    clock_in: '', clock_out: '', hours: '', notes: ''
  });

  useEffect(() => { loadCrew(); loadJobs(); }, []);
  useEffect(() => { loadEntries(); loadSummary(); }, [week]);

  async function loadCrew() {
    try { const r = await axios.get('/api/crew'); setCrew(r.data); } catch {}
  }
  async function loadJobs() {
    try { const r = await axios.get('/api/jobs'); setJobs(r.data); } catch {}
  }
  async function loadEntries() {
    setLoading(true);
    try {
      const r = await axios.get(`/api/timesheets?week=${week}`);
      setEntries(r.data);
    } catch {}
    setLoading(false);
  }
  async function loadSummary() {
    try {
      const weekEnd = addDays(week, 6);
      const r = await axios.get(`/api/timesheets/summary?from=${week}&to=${weekEnd}`);
      setSummary(r.data);
    } catch {}
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));

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
      if (editing) {
        await axios.put(`/api/timesheets/${editing}`, form);
      } else {
        await axios.post('/api/timesheets', form);
      }
      setShowForm(false);
      loadEntries();
      loadSummary();
    } catch (e) { alert(e.response?.data?.error || 'Save failed'); }
  }

  async function deleteEntry(id) {
    if (!window.confirm('Remove this time entry?')) return;
    try { await axios.delete(`/api/timesheets/${id}`); loadEntries(); loadSummary(); } catch {}
  }

  // Auto-calc hours when clock times change
  function calcHours(clockIn, clockOut) {
    if (!clockIn || !clockOut) return '';
    const [ih, im] = clockIn.split(':').map(Number);
    const [oh, om] = clockOut.split(':').map(Number);
    const hrs = ((oh * 60 + om) - (ih * 60 + im)) / 60;
    return hrs > 0 ? hrs.toFixed(2) : '';
  }

  const filtered = entries.filter(e => !filterCrew || String(e.crew_member_id) === filterCrew);

  // Group entries by crew member for week view
  const byCrewMember = {};
  filtered.forEach(e => {
    const key = e.crew_member_id;
    if (!byCrewMember[key]) byCrewMember[key] = { name: e.crew_name, entries: [] };
    byCrewMember[key].entries.push(e);
  });

  const totalHours = filtered.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  const totalCost = filtered.reduce((s, e) => s + ((parseFloat(e.hours) || 0) * (parseFloat(e.hourly_rate) || 0)), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timesheets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track crew hours by job</p>
        </div>
        <button onClick={() => openNew()} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm">
          <Plus size={16} /> Log Time
        </button>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={prevWeek} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1 text-center">
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            {fmtDate(week)} – {fmtDate(addDays(week, 6))}
          </span>
        </div>
        <button onClick={nextWeek} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ChevronRight size={16} className="text-gray-600 dark:text-gray-300" />
        </button>
        <button onClick={thisWeek} className="px-3 py-1.5 text-xs font-medium text-green-600 border border-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
          This Week
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={15} className="text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Hours</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalHours.toFixed(1)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={15} className="text-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Labor Cost</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(totalCost)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={15} className="text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Crew Active</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{Object.keys(byCrewMember).length}</div>
        </div>
      </div>

      {/* Tabs + filter */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {['week', 'summary'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t === 'week' ? 'Time Log' : 'Summary'}
            </button>
          ))}
        </div>
        {tab === 'week' && (
          <select value={filterCrew} onChange={e => setFilterCrew(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Crew</option>
            {crew.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {tab === 'summary' ? (
        /* Summary table */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Crew Member</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Entries</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hours</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rate</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {summary.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No data for this week</td></tr>
              ) : summary.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{s.entries}</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-semibold">{fmtHrs(s.total_hours)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{fmt(s.hourly_rate)}/hr</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{fmt(s.total_cost)}</td>
                </tr>
              ))}
              {summary.length > 0 && (
                <tr className="bg-gray-50 dark:bg-gray-750 font-semibold">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{summary.reduce((s, r) => s + r.entries, 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{fmtHrs(summary.reduce((s, r) => s + parseFloat(r.total_hours || 0), 0))}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{fmt(summary.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Week grid / time log */
        loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Clock size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No time logged this week</p>
            <button onClick={() => openNew()} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Log Time</button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Crew</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Job</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clock In/Out</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hours</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cost</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{e.crew_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{fmtDate(e.work_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{e.job_title || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-mono">
                      {e.clock_in && e.clock_out ? `${e.clock_in} – ${e.clock_out}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{fmtHrs(e.hours)}</td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                      {fmt((parseFloat(e.hours) || 0) * (parseFloat(e.hourly_rate) || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 size={13} /></button>
                        <button onClick={() => deleteEntry(e.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
              {editing ? 'Edit Time Entry' : 'Log Time'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Crew Member *</label>
                <select value={form.crew_member_id} onChange={e => setForm(f => ({ ...f, crew_member_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Select crew member…</option>
                  {crew.map(c => <option key={c.id} value={c.id}>{c.name} – {fmt(c.hourly_rate)}/hr</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Job (optional)</label>
                <select value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">No job</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date *</label>
                <input type="date" value={form.work_date} onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Clock In</label>
                  <input type="time" value={form.clock_in} onChange={e => {
                    const ci = e.target.value;
                    const autoHrs = calcHours(ci, form.clock_out);
                    setForm(f => ({ ...f, clock_in: ci, hours: autoHrs || f.hours }));
                  }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Clock Out</label>
                  <input type="time" value={form.clock_out} onChange={e => {
                    const co = e.target.value;
                    const autoHrs = calcHours(form.clock_in, co);
                    setForm(f => ({ ...f, clock_out: co, hours: autoHrs || f.hours }));
                  }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hours (auto-calculated from clock times)</label>
                <input type="number" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                  min="0" max="24" step="0.25"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. 8.0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Optional notes…" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveEntry} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {editing ? 'Save Changes' : 'Log Time'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
