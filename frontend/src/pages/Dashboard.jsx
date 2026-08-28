import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const CONTRACT_COLORS = {
  maintenance_contract: 'badge-green',
  on_call: 'badge-blue',
  prospect: 'badge-yellow',
  inactive: 'badge-gray',
};

const PROPOSAL_COLORS = {
  draft: 'badge-gray',
  sent: 'badge-blue',
  accepted: 'badge-green',
  declined: 'badge-red',
};

const PRIORITY_COLORS = { high: '#ef4444', normal: '#3b82f6', low: '#9ca3af' };

function taskDueLabel(due_date) {
  if (!due_date) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(due_date + 'T00:00:00');
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: '#ef4444', bg: '#fee2e2' };
  if (diff === 0) return { label: 'Due today',     color: '#d97706', bg: '#fef3c7' };
  if (diff === 1) return { label: 'Due tomorrow',  color: '#2563eb', bg: '#dbeafe' };
  return { label: `Due in ${diff}d`, color: '#6b7280', bg: '#f3f4f6' };
}

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const loadAll = useCallback(() => {
    return Promise.all([
      axios.get('/api/companies'),
      axios.get('/api/proposals'),
      axios.get('/api/contacts'),
      axios.get('/api/tasks?completed=0'),
    ]).then(([c, p, ct, t]) => {
      setCompanies(c.data);
      setProposals(p.data);
      setContacts(ct.data);
      setTasks(t.data);
    }).finally(() => setLoading(false));
  }, []);

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

  const totalPipelineValue = proposals
    .filter(p => ['draft', 'sent'].includes(p.status))
    .reduce((s, p) => s + (p.total_amount || 0), 0);

  const totalAccepted = proposals
    .filter(p => p.status === 'accepted')
    .reduce((s, p) => s + (p.total_amount || 0), 0);

  const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Sort tasks: overdue first, then due today, then upcoming
  const sortedTasks = [...tasks].sort((a, b) => {
    const da = a.due_date ? new Date(a.due_date + 'T00:00:00') : new Date('9999-12-31');
    const db2 = b.due_date ? new Date(b.due_date + 'T00:00:00') : new Date('9999-12-31');
    return da - db2;
  });

  const overdueTasks = sortedTasks.filter(t => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    return due < today;
  });

  const recentProposals = [...proposals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const recentCompanies = [...companies].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  if (loading) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <span className="text-muted text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Companies</div>
            <div className="stat-value" style={{ color: 'var(--blue-700)' }}>{companies.length}</div>
            <div className="stat-sub">{companies.filter(c => c.contract_type === 'maintenance_contract').length} on contract</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Contacts</div>
            <div className="stat-value" style={{ color: 'var(--gray-700)' }}>{contacts.length}</div>
            <div className="stat-sub">across all accounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pipeline Value</div>
            <div className="stat-value" style={{ color: 'var(--yellow-600)' }}>{fmt(totalPipelineValue)}</div>
            <div className="stat-sub">{proposals.filter(p => ['draft','sent'].includes(p.status)).length} open proposals</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Won Revenue</div>
            <div className="stat-value" style={{ color: 'var(--green-600)' }}>{fmt(totalAccepted)}</div>
            <div className="stat-sub">{proposals.filter(p => p.status === 'accepted').length} accepted proposals</div>
          </div>
        </div>

        {/* Overdue alert */}
        {overdueTasks.length > 0 && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#991b1b' }}>
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} need{overdueTasks.length === 1 ? 's' : ''} attention
            </span>
          </div>
        )}

        <div className="two-col">
          {/* Recent Proposals */}
          <div className="card">
            <div className="card-header">
              <h3>Recent Proposals</h3>
              <Link to="/proposals" className="btn btn-secondary btn-sm">View All</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Title</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProposals.length === 0 ? (
                    <tr><td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No proposals yet</td></tr>
                  ) : recentProposals.map(p => (
                    <tr key={p.id}>
                      <td><Link to={`/companies/${p.company_id}`} className="link-style">{p.company_name || '—'}</Link></td>
                      <td><Link to={`/proposals/${p.id}`} className="link-style">{p.title}</Link></td>
                      <td className="font-bold">{fmt(p.total_amount)}</td>
                      <td><span className={`badge ${PROPOSAL_COLORS[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tasks widget */}
          <div className="card">
            <div className="card-header">
              <h3>📋 Tasks & Follow-ups</h3>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{tasks.length} open</span>
            </div>
            <div className="card-body" style={{ paddingBottom: 0 }}>
              {/* Quick add */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <input
                  type="text"
                  placeholder="Add a task…"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={e => setNewTaskDue(e.target.value)}
                  style={{ width: 130, padding: '7px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
                <button
                  onClick={addTask}
                  disabled={addingTask || !newTask.trim()}
                  style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: '#1e3a5f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >+ Add</button>
              </div>
            </div>

            {/* Task list */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {sortedTasks.length === 0 ? (
                <div style={{ padding: '20px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  No open tasks — you're all caught up! 🎉
                </div>
              ) : sortedTasks.slice(0, 12).map(task => {
                const due = taskDueLabel(task.due_date);
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <button
                      onClick={() => completeTask(task.id)}
                      title="Mark complete"
                      style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #d1d5db', background: '#fff', cursor: 'pointer', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#10b981' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {task.priority === 'high' && <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>HIGH</span>}
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        {task.company_name && (
                          <Link to={`/companies/${task.company_id}`} style={{ fontSize: 11, color: '#6b7280', textDecoration: 'none' }}>
                            🏢 {task.company_name}
                          </Link>
                        )}
                        {due && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: due.color, background: due.bg, borderRadius: 4, padding: '1px 6px' }}>
                            {due.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {sortedTasks.length > 12 && (
                <div style={{ padding: '10px 20px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                  +{sortedTasks.length - 12} more tasks — add them from company pages
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Companies */}
        <div className="card mt-4">
          <div className="card-header">
            <h3>Recent Accounts</h3>
            <Link to="/companies" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Contract</th>
                  <th>Contacts</th>
                </tr>
              </thead>
              <tbody>
                {recentCompanies.length === 0 ? (
                  <tr><td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No companies yet</td></tr>
                ) : recentCompanies.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/companies/${c.id}`} className="link-style">{c.name}</Link></td>
                    <td className="text-muted">{c.property_type}</td>
                    <td><span className={`badge ${CONTRACT_COLORS[c.contract_type] || 'badge-gray'}`}>{(c.contract_type || '').replace('_', ' ')}</span></td>
                    <td className="text-muted">{c.contact_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contract breakdown */}
        <div className="card mt-4">
          <div className="card-header"><h3>Account Status Breakdown</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { key: 'maintenance_contract', label: 'Maintenance Contract', color: 'var(--green-600)' },
                { key: 'on_call', label: 'On-Call / T&M', color: 'var(--blue-700)' },
                { key: 'prospect', label: 'Prospect', color: 'var(--yellow-600)' },
                { key: 'inactive', label: 'Inactive', color: 'var(--gray-500)' },
              ].map(({ key, label, color }) => {
                const count = companies.filter(c => c.contract_type === key).length;
                const pct = companies.length ? Math.round((count / companies.length) * 100) : 0;
                return (
                  <div key={key} style={{ flex: 1, minWidth: 140 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                      <span className="text-sm text-muted">{label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
                    <div style={{ height: 4, background: 'var(--gray-200)', borderRadius: 2, marginTop: 6 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                    <div className="text-sm text-muted mt-1">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
