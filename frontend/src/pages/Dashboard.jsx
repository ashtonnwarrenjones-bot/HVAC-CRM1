import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ClipboardList, Building2, TrendingUp, Wrench,
  DollarSign, Users, Settings2, GripVertical, X, Plus, Eye,
  Calendar, Target, Award, Clock, BarChart2, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CONTRACT_COLORS = {
  maintenance_contract: 'badge-green',
  on_call:              'badge-blue',
  prospect:             'badge-yellow',
  inactive:             'badge-gray',
};
const PROPOSAL_COLORS = {
  draft:    'badge-gray',
  sent:     'badge-blue',
  accepted: 'badge-green',
  declined: 'badge-red',
};
const JOB_STATUS_COLOR = { scheduled:'#2563eb', in_progress:'#d97706', completed:'#16a34a', cancelled:'#ef4444' };

function taskDueLabel(due_date) {
  if (!due_date) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(due_date + 'T00:00:00');
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: '#ef4444', bg: '#fee2e2' };
  if (diff === 0) return { label: 'Due today',    color: '#d97706', bg: '#fef3c7' };
  if (diff === 1) return { label: 'Due tomorrow', color: '#2563eb', bg: '#dbeafe' };
  return { label: `Due in ${diff}d`, color: '#6b7280', bg: '#f3f4f6' };
}
function buildRevenueData(proposals) {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString('en-US', { month:'short', year:'2-digit' }), year: d.getFullYear(), month: d.getMonth(), revenue: 0, pipeline: 0 });
  }
  proposals.forEach(p => {
    const d = new Date(p.created_at);
    const idx = months.findIndex(m => m.year===d.getFullYear() && m.month===d.getMonth());
    if (idx === -1) return;
    if (p.status === 'accepted') months[idx].revenue += p.total_amount || 0;
    else if (['draft','sent'].includes(p.status)) months[idx].pipeline += p.total_amount || 0;
  });
  return months;
}
const fmt  = (n) => '$' + parseFloat(n||0).toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
const fmtK = (n) => n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n}`;

// ─── Widget registry ──────────────────────────────────────────────────────────
const WIDGET_DEFS = {
  stats_row:          { label: 'Stats Overview',           size: 'full', desc: 'Key numbers — companies, contacts, pipeline, revenue' },
  revenue_chart:      { label: 'Revenue Trend',            size: 'half', desc: '12-month won revenue vs pipeline area chart' },
  jobs_chart:         { label: 'Jobs by Status',           size: 'half', desc: 'Bar chart breakdown of job statuses' },
  recent_proposals:   { label: 'Recent Proposals',         size: 'half', desc: 'Latest 6 proposals with status and value' },
  tasks:              { label: 'Tasks & Follow-ups',       size: 'half', desc: 'Open tasks with due dates; add tasks inline' },
  today_jobs:         { label: "Today's Jobs",             size: 'half', desc: 'Jobs scheduled for today with status indicators' },
  win_rate:           { label: 'Win Rate',                 size: 'half', desc: 'Proposal acceptance rate and closed/lost breakdown' },
  top_customers:      { label: 'Top Customers',            size: 'half', desc: 'Top 5 accounts by total won revenue' },
  upcoming_schedule:  { label: 'Upcoming Schedule',        size: 'half', desc: 'Next 7 days of scheduled jobs' },
  proposal_funnel:    { label: 'Proposal Funnel',          size: 'half', desc: 'Stage-by-stage funnel with counts and values' },
  recent_accounts:    { label: 'Recent Accounts',          size: 'full', desc: 'Latest companies added to the CRM' },
  contract_breakdown: { label: 'Account Status Breakdown', size: 'full', desc: 'Contract type distribution with progress bars' },
};

const DEFAULT_VISIBLE = [
  'stats_row',
  'today_jobs', 'win_rate',
  'revenue_chart', 'jobs_chart',
  'recent_proposals', 'tasks',
  'recent_accounts', 'contract_breakdown',
];

function loadLayout() {
  try {
    const raw = localStorage.getItem('crm_dashboard_layout_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      const allKeys = Object.keys(WIDGET_DEFS);
      const missing = allKeys.filter(k => !parsed.visible.includes(k) && !parsed.hidden.includes(k));
      return { visible: [...parsed.visible, ...missing], hidden: parsed.hidden || [] };
    }
  } catch {}
  return { visible: [...DEFAULT_VISIBLE], hidden: [] };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [companies,  setCompanies]  = useState([]);
  const [proposals,  setProposals]  = useState([]);
  const [contacts,   setContacts]   = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [newTask,    setNewTask]    = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const [customizing, setCustomizing] = useState(false);
  const [layout,      setLayout]      = useState(loadLayout);
  const [dragIdx,     setDragIdx]     = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('crm_dashboard_layout_v2', JSON.stringify(layout)); } catch {}
  }, [layout]);

  const loadAll = useCallback(() =>
    Promise.all([
      axios.get('/api/companies'),
      axios.get('/api/proposals'),
      axios.get('/api/contacts'),
      axios.get('/api/tasks?completed=0'),
      axios.get('/api/jobs').catch(() => ({ data: [] })),
    ]).then(([c, p, ct, t, j]) => {
      setCompanies(c.data); setProposals(p.data);
      setContacts(ct.data); setTasks(t.data); setJobs(j.data);
    }).finally(() => setLoading(false)),
  []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const completeTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    await axios.put(`/api/tasks/${id}`, { ...task, completed: true });
    setTasks(ts => ts.filter(t => t.id !== id));
  };
  const addTask = async () => {
    if (!newTask.trim()) return;
    setAddingTask(true);
    try {
      const r = await axios.post('/api/tasks', { title: newTask.trim(), due_date: newTaskDue || null });
      setTasks(ts => [r.data, ...ts]);
      setNewTask(''); setNewTaskDue('');
    } finally { setAddingTask(false); }
  };

  // ── Layout helpers ──
  const hideWidget  = (key) => setLayout(l => ({ visible: l.visible.filter(k=>k!==key), hidden: [...l.hidden, key] }));
  const showWidget  = (key) => setLayout(l => ({ visible: [...l.visible, key], hidden: l.hidden.filter(k=>k!==key) }));
  const resetLayout = () => setLayout({ visible: [...DEFAULT_VISIBLE], hidden: Object.keys(WIDGET_DEFS).filter(k => !DEFAULT_VISIBLE.includes(k)) });

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver  = (e, idx) => { e.preventDefault(); if (idx !== dragIdx) setDragOverIdx(idx); };
  const handleDrop      = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...layout.visible];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setLayout(l => ({ ...l, visible: next }));
    setDragIdx(null); setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  // ── Derived data ──
  const totalPipelineValue = proposals.filter(p=>['draft','sent'].includes(p.status)).reduce((s,p)=>s+(p.total_amount||0),0);
  const totalAccepted      = proposals.filter(p=>p.status==='accepted').reduce((s,p)=>s+(p.total_amount||0),0);
  const sortedTasks = [...tasks].sort((a,b) => {
    const da = a.due_date ? new Date(a.due_date+'T00:00:00') : new Date('9999-12-31');
    const db = b.due_date ? new Date(b.due_date+'T00:00:00') : new Date('9999-12-31');
    return da - db;
  });
  const overdueTasks = sortedTasks.filter(t => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date+'T00:00:00'), today = new Date(); today.setHours(0,0,0,0);
    return due < today;
  });
  const revenueData   = buildRevenueData(proposals);
  const hasChartData  = revenueData.some(d => d.revenue>0 || d.pipeline>0);
  const jobStatusData = (() => {
    const counts = { Scheduled:0, 'In Progress':0, Completed:0, Cancelled:0 };
    jobs.forEach(j => {
      const s = j.status==='scheduled'?'Scheduled':j.status==='in_progress'?'In Progress':j.status==='completed'?'Completed':j.status==='cancelled'?'Cancelled':null;
      if (s) counts[s]++;
    });
    return Object.entries(counts).map(([name,count])=>({name,count}));
  })();
  const recentProposals = [...proposals].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);
  const recentCompanies = [...companies].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);

  // Today's jobs
  const todayStr = new Date().toISOString().split('T')[0];
  const todayJobs = jobs.filter(j => {
    const d = j.scheduled_date ? j.scheduled_date.split('T')[0] : null;
    return d === todayStr || j.status === 'in_progress';
  }).sort((a,b) => (a.scheduled_time||'').localeCompare(b.scheduled_time||''));

  // Win rate
  const closedProposals  = proposals.filter(p => ['accepted','declined'].includes(p.status));
  const wonProposals     = proposals.filter(p => p.status === 'accepted');
  const winRate          = closedProposals.length ? Math.round((wonProposals.length / closedProposals.length) * 100) : 0;
  const proposalFunnelData = [
    { label:'Draft',    count: proposals.filter(p=>p.status==='draft').length,    color:'#9ca3af', value: proposals.filter(p=>p.status==='draft').reduce((s,p)=>s+(p.total_amount||0),0) },
    { label:'Sent',     count: proposals.filter(p=>p.status==='sent').length,     color:'#2563eb', value: proposals.filter(p=>p.status==='sent').reduce((s,p)=>s+(p.total_amount||0),0) },
    { label:'Accepted', count: proposals.filter(p=>p.status==='accepted').length, color:'#16a34a', value: proposals.filter(p=>p.status==='accepted').reduce((s,p)=>s+(p.total_amount||0),0) },
    { label:'Declined', count: proposals.filter(p=>p.status==='declined').length, color:'#ef4444', value: proposals.filter(p=>p.status==='declined').reduce((s,p)=>s+(p.total_amount||0),0) },
  ];

  // Top customers by won revenue
  const customerRevenue = {};
  proposals.filter(p=>p.status==='accepted' && p.company_id).forEach(p => {
    if (!customerRevenue[p.company_id]) customerRevenue[p.company_id] = { name: p.company_name, id: p.company_id, total: 0, count: 0 };
    customerRevenue[p.company_id].total += p.total_amount || 0;
    customerRevenue[p.company_id].count++;
  });
  const topCustomers = Object.values(customerRevenue).sort((a,b)=>b.total-a.total).slice(0,5);
  const maxCustomerRev = topCustomers[0]?.total || 1;

  // Upcoming 7-day schedule
  const upcomingJobs = (() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const in7   = new Date(today); in7.setDate(in7.getDate() + 7);
    return jobs.filter(j => {
      if (!j.scheduled_date) return false;
      const d = new Date(j.scheduled_date.split('T')[0] + 'T00:00:00');
      return d >= today && d <= in7 && j.status !== 'cancelled';
    }).sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)).slice(0,8);
  })();

  // ─── Individual widget renderers ──────────────────────────────────────────
  function renderWidgetContent(key) {
    switch (key) {

      // ── Stats row ──────────────────────────────────────────────────────────
      case 'stats_row': return (
        <>
          {overdueTasks.length > 0 && (
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <AlertTriangle size={18} color="#991b1b" />
              <span style={{ fontSize:13, fontWeight:600, color:'#991b1b' }}>
                {overdueTasks.length} overdue task{overdueTasks.length>1?'s':''} — check your task list
              </span>
            </div>
          )}
          <div className="stats-grid">
            {[
              { label:'Companies',    value:companies.length, sub:`${companies.filter(c=>c.contract_type==='maintenance_contract').length} on contract`, color:'var(--blue-700)',   bg:'#eff6ff', Icon:Building2,  iconColor:'#1d4ed8' },
              { label:'Contacts',     value:contacts.length,  sub:'across all accounts',                                                                  color:'var(--gray-700)',   bg:'#f0fdf4', Icon:Users,      iconColor:'#16a34a' },
              { label:'Pipeline',     value:fmt(totalPipelineValue), sub:`${proposals.filter(p=>['draft','sent'].includes(p.status)).length} open proposals`, color:'var(--yellow-600)', bg:'#fefce8', Icon:TrendingUp,  iconColor:'#ca8a04' },
              { label:'Won Revenue',  value:fmt(totalAccepted),      sub:`${wonProposals.length} accepted proposals`,                                       color:'var(--green-600)',  bg:'#f0fdf4', Icon:DollarSign, iconColor:'#16a34a' },
            ].map(({ label, value, sub, color, bg, Icon, iconColor }) => (
              <div key={label} className="stat-card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div className="stat-label">{label}</div>
                    <div className="stat-value" style={{ color }}>{value}</div>
                    <div className="stat-sub">{sub}</div>
                  </div>
                  <div style={{ width:36, height:36, borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon size={18} color={iconColor} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      );

      // ── Revenue Trend ──────────────────────────────────────────────────────
      case 'revenue_chart': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><TrendingUp size={15} /> Revenue Trend (12 months)</h3>
          </div>
          <div style={{ padding:'16px 8px 8px' }}>
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={revenueData} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPipe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v,n)=>[fmt(v), n==='revenue'?'Won Revenue':'Pipeline']} contentStyle={{ fontSize:12 }} />
                  <Area type="monotone" dataKey="revenue"  stroke="#16a34a" strokeWidth={2} fill="url(#colorRev)"  name="revenue" />
                  <Area type="monotone" dataKey="pipeline" stroke="#2563eb" strokeWidth={2} fill="url(#colorPipe)" name="pipeline" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#9ca3af', fontSize:13 }}>
                <TrendingUp size={28} color="#d1d5db" /><span>Chart populates as you create proposals</span>
              </div>
            )}
            <div style={{ display:'flex', gap:16, justifyContent:'center', paddingTop:4 }}>
              {[['#16a34a','Won Revenue'],['#2563eb','Pipeline']].map(([c,l])=>(
                <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                  <span style={{ width:10, height:3, background:c, borderRadius:2, display:'inline-block' }}/>{l}
                </span>
              ))}
            </div>
          </div>
        </div>
      );

      // ── Jobs by Status ─────────────────────────────────────────────────────
      case 'jobs_chart': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><Wrench size={15} /> Jobs by Status</h3>
            <Link to="/schedule" style={{ fontSize:12, color:'#2563eb', textDecoration:'none' }}>View Schedule →</Link>
          </div>
          <div style={{ padding:'16px 8px 8px' }}>
            {jobs.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={jobStatusData} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize:12 }} />
                  <Bar dataKey="count" name="Jobs" radius={[4,4,0,0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#9ca3af', fontSize:13 }}>
                <Wrench size={28} color="#d1d5db" /><span>Chart populates as you schedule jobs</span>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, padding:'8px 8px 0' }}>
              {jobStatusData.map(({ name, count }) => (
                <div key={name} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color: name==='Completed'?'#16a34a':name==='In Progress'?'#d97706':name==='Cancelled'?'#ef4444':'#2563eb' }}>{count}</div>
                  <div style={{ fontSize:10, color:'#9ca3af' }}>{name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

      // ── Recent Proposals ───────────────────────────────────────────────────
      case 'recent_proposals': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3>Recent Proposals</h3>
            <Link to="/proposals" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Title</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {recentProposals.length === 0 ? (
                  <tr><td colSpan="4" className="text-muted" style={{ textAlign:'center', padding:20 }}>No proposals yet</td></tr>
                ) : recentProposals.map(p => (
                  <tr key={p.id}>
                    <td><Link to={`/companies/${p.company_id}`} className="link-style">{p.company_name||'—'}</Link></td>
                    <td><Link to={`/proposals/${p.id}`} className="link-style">{p.title}</Link></td>
                    <td className="font-bold">{fmt(p.total_amount)}</td>
                    <td><span className={`badge ${PROPOSAL_COLORS[p.status]||'badge-gray'}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

      // ── Tasks ──────────────────────────────────────────────────────────────
      case 'tasks': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><ClipboardList size={16} /> Tasks & Follow-ups</h3>
            <span style={{ fontSize:12, color:'#6b7280' }}>{tasks.length} open</span>
          </div>
          <div className="card-body" style={{ paddingBottom:0 }}>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              <input
                type="text" placeholder="Add a task…"
                value={newTask} onChange={e=>setNewTask(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addTask()}
                style={{ flex:1, padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, outline:'none', background:'var(--bg-page)', color:'var(--text-primary)' }}
              />
              <input
                type="date" value={newTaskDue} onChange={e=>setNewTaskDue(e.target.value)}
                style={{ width:130, padding:'7px 8px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, outline:'none', background:'var(--bg-page)', color:'var(--text-primary)' }}
              />
              <button onClick={addTask} disabled={addingTask||!newTask.trim()} style={{ padding:'7px 12px', borderRadius:7, border:'none', background:'#1e3a5f', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>+ Add</button>
            </div>
          </div>
          <div style={{ maxHeight:280, overflowY:'auto' }}>
            {sortedTasks.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>No open tasks — all caught up! 🎉</div>
            ) : sortedTasks.slice(0,12).map(task => {
              const due = taskDueLabel(task.due_date);
              return (
                <div key={task.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 20px', borderBottom:'1px solid var(--border)' }}>
                  <button onClick={()=>completeTask(task.id)} title="Mark complete" style={{ width:20, height:20, borderRadius:'50%', border:'2px solid #d1d5db', background:'transparent', cursor:'pointer', flexShrink:0, marginTop:2 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      {task.priority==='high' && <span style={{ fontSize:10, background:'#fee2e2', color:'#dc2626', borderRadius:4, padding:'1px 5px', fontWeight:700 }}>HIGH</span>}
                      {task.title}
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap' }}>
                      {task.company_name && <Link to={`/companies/${task.company_id}`} style={{ fontSize:11, color:'#6b7280', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}><Building2 size={11}/>{task.company_name}</Link>}
                      {due && <span style={{ fontSize:11, fontWeight:600, color:due.color, background:due.bg, borderRadius:4, padding:'1px 6px' }}>{due.label}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

      // ── Today's Jobs ───────────────────────────────────────────────────────
      case 'today_jobs': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><Calendar size={15} /> Today's Jobs</h3>
            <Link to="/dispatch" style={{ fontSize:12, color:'#2563eb', textDecoration:'none' }}>Dispatch →</Link>
          </div>
          {todayJobs.length === 0 ? (
            <div style={{ padding:'28px 20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
              <Calendar size={28} color="#d1d5db" style={{ marginBottom:8 }} /><br/>No jobs scheduled for today
            </div>
          ) : (
            <div>
              {todayJobs.map(j => (
                <div key={j.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: JOB_STATUS_COLOR[j.status]||'#9ca3af', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{j.title}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>{j.company_name}{j.scheduled_time ? ` · ${j.scheduled_time}` : ''}</div>
                  </div>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600, background: j.status==='completed'?'#dcfce7':j.status==='in_progress'?'#fef3c7':j.status==='cancelled'?'#fee2e2':'#dbeafe', color: j.status==='completed'?'#166534':j.status==='in_progress'?'#92400e':j.status==='cancelled'?'#991b1b':'#1d4ed8', whiteSpace:'nowrap' }}>
                    {j.status.replace('_',' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280' }}>
            <span>{todayJobs.filter(j=>j.status==='completed').length} completed</span>
            <span>{todayJobs.filter(j=>j.status==='in_progress').length} in progress</span>
            <span>{todayJobs.filter(j=>j.status==='scheduled').length} scheduled</span>
          </div>
        </div>
      );

      // ── Win Rate ───────────────────────────────────────────────────────────
      case 'win_rate': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><Award size={15} /> Win Rate</h3>
            <Link to="/proposals" style={{ fontSize:12, color:'#2563eb', textDecoration:'none' }}>All Proposals →</Link>
          </div>
          <div className="card-body">
            {/* Big win rate number */}
            <div style={{ display:'flex', alignItems:'center', gap:24, marginBottom:20 }}>
              <div style={{ position:'relative', width:80, height:80 }}>
                <svg viewBox="0 0 80 80" style={{ transform:'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="8"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#16a34a" strokeWidth="8"
                    strokeDasharray={`${2*Math.PI*32}`}
                    strokeDashoffset={`${2*Math.PI*32 * (1 - winRate/100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'#16a34a' }}>{winRate}%</div>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Proposal Win Rate</div>
                <div style={{ fontSize:12, color:'#6b7280' }}>{wonProposals.length} won · {proposals.filter(p=>p.status==='declined').length} lost</div>
                <div style={{ fontSize:12, color:'#6b7280' }}>{closedProposals.length} total closed</div>
              </div>
            </div>
            {/* Funnel mini bars */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {proposalFunnelData.map(({ label, count, color, value }) => {
                const maxCount = Math.max(...proposalFunnelData.map(d=>d.count), 1);
                return (
                  <div key={label}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                      <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>{label}</span>
                      <span style={{ color:'#6b7280' }}>{count} · {fmt(value)}</span>
                    </div>
                    <div style={{ height:6, background:'var(--border)', borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${count/maxCount*100}%`, background:color, borderRadius:3, transition:'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

      // ── Top Customers ──────────────────────────────────────────────────────
      case 'top_customers': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><Target size={15} /> Top Customers</h3>
            <span style={{ fontSize:12, color:'#6b7280' }}>by won revenue</span>
          </div>
          {topCustomers.length === 0 ? (
            <div style={{ padding:'28px 20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
              <Target size={28} color="#d1d5db" style={{ marginBottom:8 }} /><br/>Accept proposals to see top customers
            </div>
          ) : (
            <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:12 }}>
              {topCustomers.map((c, i) => (
                <div key={c.id}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background: i===0?'#fbbf24':i===1?'#9ca3af':i===2?'#d97706':'var(--border)', color: i<3?'#fff':'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                      {i+1}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <Link to={`/companies/${c.id}`} className="link-style" style={{ fontSize:13, fontWeight:600 }}>{c.name}</Link>
                      <span style={{ fontSize:11, color:'#6b7280', marginLeft:6 }}>{c.count} proposal{c.count!==1?'s':''}</span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#16a34a', flexShrink:0 }}>{fmt(c.total)}</div>
                  </div>
                  <div style={{ height:4, background:'var(--border)', borderRadius:2, marginLeft:32 }}>
                    <div style={{ height:'100%', width:`${(c.total/maxCustomerRev)*100}%`, background:'#16a34a', borderRadius:2, opacity: 0.4 + (0.6 * (topCustomers.length-i)/topCustomers.length) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      // ── Upcoming Schedule ──────────────────────────────────────────────────
      case 'upcoming_schedule': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><Clock size={15} /> Next 7 Days</h3>
            <Link to="/schedule" style={{ fontSize:12, color:'#2563eb', textDecoration:'none' }}>Full Schedule →</Link>
          </div>
          {upcomingJobs.length === 0 ? (
            <div style={{ padding:'28px 20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
              <Clock size={28} color="#d1d5db" style={{ marginBottom:8 }} /><br/>No jobs in the next 7 days
            </div>
          ) : (
            <div>
              {upcomingJobs.map(j => {
                const d = new Date(j.scheduled_date.split('T')[0] + 'T00:00:00');
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div key={j.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'9px 16px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ textAlign:'center', minWidth:38, flexShrink:0 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: isToday?'#1d4ed8':'#9ca3af', textTransform:'uppercase' }}>
                        {d.toLocaleDateString('en-US',{weekday:'short'})}
                      </div>
                      <div style={{ fontSize:17, fontWeight:800, color: isToday?'#1d4ed8':'var(--text-primary)', lineHeight:1 }}>
                        {d.getDate()}
                      </div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{j.title}</div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>{j.company_name}{j.technician ? ` · ${j.technician}` : ''}</div>
                    </div>
                    <div style={{ fontSize:11, padding:'2px 7px', borderRadius:8, fontWeight:600, flexShrink:0, background: j.status==='in_progress'?'#fef3c7':'#dbeafe', color: j.status==='in_progress'?'#92400e':'#1d4ed8' }}>
                      {j.status.replace('_',' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

      // ── Proposal Funnel ────────────────────────────────────────────────────
      case 'proposal_funnel': return (
        <div className="card" style={{ height:'100%' }}>
          <div className="card-header">
            <h3 style={{ display:'flex', alignItems:'center', gap:7 }}><BarChart2 size={15} /> Proposal Funnel</h3>
            <span style={{ fontSize:12, color:'#6b7280' }}>{proposals.length} total</span>
          </div>
          <div style={{ padding:'12px 16px' }}>
            {proposals.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>No proposals yet</div>
            ) : (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {proposalFunnelData.map(({ label, count, color, value }) => (
                    <div key={label} style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:color, flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>{label}</span>
                          <span style={{ fontSize:12, color:'#6b7280' }}>{count} · {fmt(value)}</span>
                        </div>
                        <div style={{ height:8, background:'var(--border)', borderRadius:4 }}>
                          <div style={{ height:'100%', width:`${proposals.length ? count/proposals.length*100 : 0}%`, background:color, borderRadius:4, transition:'width 0.4s', opacity:0.85 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div style={{ padding:'10px 14px', background:'#f0fdf4', borderRadius:8, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:'#16a34a' }}>{winRate}%</div>
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Close Rate</div>
                  </div>
                  <div style={{ padding:'10px 14px', background:'#eff6ff', borderRadius:8, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:'#1d4ed8' }}>{fmt(totalPipelineValue)}</div>
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Open Pipeline</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      );

      // ── Recent Accounts ────────────────────────────────────────────────────
      case 'recent_accounts': return (
        <div className="card">
          <div className="card-header">
            <h3>Recent Accounts</h3>
            <Link to="/companies" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Type</th><th>Contract</th><th>Contacts</th></tr></thead>
              <tbody>
                {recentCompanies.length === 0 ? (
                  <tr><td colSpan="4" className="text-muted" style={{ textAlign:'center', padding:20 }}>No companies yet</td></tr>
                ) : recentCompanies.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/companies/${c.id}`} className="link-style">{c.name}</Link></td>
                    <td className="text-muted">{c.property_type}</td>
                    <td><span className={`badge ${CONTRACT_COLORS[c.contract_type]||'badge-gray'}`}>{(c.contract_type||'').replace('_',' ')}</span></td>
                    <td className="text-muted">{c.contact_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

      // ── Contract Breakdown ─────────────────────────────────────────────────
      case 'contract_breakdown': return (
        <div className="card">
          <div className="card-header"><h3>Account Status Breakdown</h3></div>
          <div className="card-body">
            <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
              {[
                { key:'maintenance_contract', label:'Maintenance Contract', color:'var(--green-600)' },
                { key:'on_call',              label:'On-Call / T&M',        color:'var(--blue-700)' },
                { key:'prospect',             label:'Prospect',              color:'var(--yellow-600)' },
                { key:'inactive',             label:'Inactive',              color:'var(--gray-500)' },
              ].map(({ key, label, color }) => {
                const count = companies.filter(c=>c.contract_type===key).length;
                const pct   = companies.length ? Math.round(count/companies.length*100) : 0;
                return (
                  <div key={key} style={{ flex:1, minWidth:140 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:color }} />
                      <span style={{ fontSize:13, color:'var(--text-muted)' }}>{label}</span>
                    </div>
                    <div style={{ fontSize:22, fontWeight:700, color }}>{count}</div>
                    <div style={{ height:4, background:'var(--gray-200)', borderRadius:2, marginTop:6 }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2 }} />
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

      default: return null;
    }
  }

  // ─── Drag wrapper ─────────────────────────────────────────────────────────
  function renderWidget(key, idx) {
    const def = WIDGET_DEFS[key];
    if (!def) return null;
    const isDragging   = dragIdx === idx;
    const isDragTarget = dragOverIdx === idx && dragIdx !== idx;
    return (
      <div
        key={key}
        draggable={customizing}
        onDragStart={() => handleDragStart(idx)}
        onDragOver={(e) => handleDragOver(e, idx)}
        onDrop={(e) => handleDrop(e, idx)}
        onDragEnd={handleDragEnd}
        style={{
          gridColumn: def.size === 'full' ? '1 / -1' : 'span 1',
          opacity: isDragging ? 0.3 : 1,
          transition: 'opacity 0.15s',
          outline: isDragTarget ? '2px dashed #2563eb' : customizing ? '2px dashed var(--border)' : 'none',
          outlineOffset: 3,
          borderRadius: 12,
          cursor: customizing ? 'grab' : 'default',
        }}
      >
        {customizing && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px 6px 10px', background:'var(--blue-50,#eff6ff)', borderRadius:'10px 10px 0 0', border:'1px solid #bfdbfe', borderBottom:'none', userSelect:'none' }}>
            <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#1d4ed8' }}>
              <GripVertical size={14} style={{ opacity:0.6 }} />{def.label}
            </span>
            <button onClick={()=>hideWidget(key)} title="Hide" style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center', padding:2, borderRadius:4 }}>
              <X size={14} />
            </button>
          </div>
        )}
        {renderWidgetContent(key)}
      </div>
    );
  }

  if (loading) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h2 style={{ margin:0 }}>Dashboard</h2>
          <span className="text-muted text-sm">{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
        </div>
        <button
          onClick={()=>setCustomizing(c=>!c)}
          style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 16px', borderRadius:8, border:'1px solid var(--border)', background:customizing?'#1e3a5f':'var(--bg-card)', color:customizing?'#fff':'var(--text-secondary)', fontSize:13, fontWeight:600, cursor:'pointer' }}
        >
          <Settings2 size={14} />
          {customizing ? 'Done Editing' : 'Customize'}
        </button>
      </div>

      <div className="page-content">
        {/* Customize mode panel */}
        {customizing && (
          <div style={{ marginBottom:16, padding:'14px 18px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1e3a5f', marginBottom:3 }}>Drag to reorder · Click × to hide a widget</div>
              <div style={{ fontSize:12, color:'#4b5563' }}>Layout saves automatically to your browser.</div>
            </div>
            {layout.hidden.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:12, color:'#6b7280', fontWeight:600 }}>Hidden:</span>
                {layout.hidden.map(key => (
                  <button key={key} onClick={()=>showWidget(key)} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, border:'1px solid #bfdbfe', background:'#fff', color:'#1d4ed8', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    <Plus size={11}/>{WIDGET_DEFS[key]?.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={resetLayout} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #bfdbfe', background:'#fff', color:'#6b7280', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              Reset to Default
            </button>
          </div>
        )}

        {/* Widget grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>
          {layout.visible.map((key, idx) => renderWidget(key, idx))}
        </div>

        {layout.visible.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
            <Eye size={36} style={{ opacity:0.3, marginBottom:12 }} />
            <div style={{ fontSize:15, fontWeight:600, marginBottom:8 }}>All widgets are hidden</div>
            <div style={{ fontSize:13, marginBottom:16 }}>Click Customize and use the restore buttons to bring them back.</div>
            <button onClick={resetLayout} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-primary)', fontSize:13, fontWeight:600, cursor:'pointer' }}>Reset to Default</button>
          </div>
        )}
      </div>
    </>
  );
}
