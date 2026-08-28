import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmailCompose from '../components/EmailCompose';

const API = import.meta.env.VITE_API_URL ?? '';

const ACTIVITY_TYPES = [
  'note', 'call', 'email', 'visit', 'quote', 'service', 'meeting_summary'
];

const ACTIVITY_META = {
  note:             { icon: '📝', label: 'Note',             color: '#6b7280' },
  call:             { icon: '📞', label: 'Call',             color: '#2563eb' },
  email:            { icon: '✉️',  label: 'Email',            color: '#7c3aed' },
  visit:            { icon: '🏢', label: 'Site Visit',       color: '#d97706' },
  quote:            { icon: '📄', label: 'Quote',            color: '#0891b2' },
  service:          { icon: '🔧', label: 'Service',          color: '#16a34a' },
  meeting_summary:  { icon: '📋', label: 'Meeting Summary',  color: '#dc2626' },
};

const CONTRACT_COLORS = {
  maintenance_contract: 'badge-green', on_call: 'badge-blue',
  prospect: 'badge-yellow', inactive: 'badge-gray',
};
const PROPOSAL_COLORS = {
  draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green', declined: 'badge-red',
};

const CONTACT_EMPTY = {
  first_name: '', last_name: '', title: '', email: '', phone: '', mobile: '',
  preferred_contact: 'email', is_primary: false, notes: ''
};

const NOTE_EMPTY = { type: 'note', subject: '', body: '' };

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

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [contactForm, setContactForm] = useState(CONTACT_EMPTY);
  const [editContactId, setEditContactId] = useState(null);
  const [note, setNote] = useState(NOTE_EMPTY);
  const [activityFilter, setActivityFilter] = useState('all');
  const [expandedActivity, setExpandedActivity] = useState(null);

  // Attachments state
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('normal');
  const [addingTask, setAddingTask] = useState(false);

  // Portal invite state
  const [portalInvite, setPortalInvite] = useState(null); // { portal_url, contact_name }
  const [inviting, setInviting] = useState(null); // contact_id being invited
  const [inviteCopied, setInviteCopied] = useState(false);

  // Sales rep state
  const [editingRep, setEditingRep] = useState(false);
  const [repForm, setRepForm] = useState({ sales_rep_name: '', sales_rep_email: '', sales_rep_phone: '' });

  const load = useCallback(() => axios.get(`/api/companies/${id}`).then(r => setCompany(r.data)), [id]);
  const loadAttachments = useCallback(() => axios.get(`/api/attachments?company_id=${id}`).then(r => setAttachments(r.data)), [id]);
  const loadTasks = useCallback(() => axios.get(`/api/tasks?company_id=${id}`).then(r => setTasks(r.data)), [id]);

  useEffect(() => { load(); loadAttachments(); loadTasks(); }, [load, loadAttachments, loadTasks]);

  const saveContact = async () => {
    const data = { ...contactForm, company_id: id };
    if (editContactId) await axios.put(`/api/contacts/${editContactId}`, data);
    else await axios.post('/api/contacts', data);
    setShowContactModal(false);
    load();
  };

  const deleteContact = async (cid, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    await axios.delete(`/api/contacts/${cid}`);
    load();
  };

  const sendPortalInvite = async (contactId) => {
    setInviting(contactId);
    try {
      const r = await axios.post(`/api/portal/admin/invite/${contactId}`);
      setPortalInvite(r.data);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to generate portal link.');
    } finally {
      setInviting(null);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(portalInvite?.portal_url || '').then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const addNote = async () => {
    await axios.post(`/api/companies/${id}/activities`, note);
    setNote(NOTE_EMPTY);
    setShowNoteModal(false);
    load();
  };

  const openNoteModal = (type = 'note') => {
    const template = type === 'meeting_summary'
      ? 'Attendees:\n\nKey Discussion Points:\n\nDecisions Made:\n\nNext Steps / Action Items:'
      : '';
    setNote({ type, subject: '', body: template });
    setShowNoteModal(true);
  };

  // Attachment handlers
  const uploadFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('company_id', id);
    try {
      await axios.post('/api/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadAttachments();
    } catch { alert('Upload failed.'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const deleteAttachment = async (attId) => {
    if (!confirm('Remove this file?')) return;
    await axios.delete(`/api/attachments/${attId}`);
    setAttachments(a => a.filter(x => x.id !== attId));
  };

  // Task handlers
  const addTask = async () => {
    if (!newTask.trim()) return;
    setAddingTask(true);
    try {
      const r = await axios.post('/api/tasks', { company_id: id, title: newTask.trim(), due_date: newTaskDue || null, priority: newTaskPriority });
      setTasks(ts => [r.data, ...ts]);
      setNewTask(''); setNewTaskDue(''); setNewTaskPriority('normal');
    } finally { setAddingTask(false); }
  };

  const completeTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    await axios.put(`/api/tasks/${taskId}`, { ...task, completed: !task.completed });
    loadTasks();
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await axios.delete(`/api/tasks/${taskId}`);
    setTasks(ts => ts.filter(t => t.id !== taskId));
  };

  const openEditRep = () => {
    setRepForm({ sales_rep_name: company.sales_rep_name || '', sales_rep_email: company.sales_rep_email || '', sales_rep_phone: company.sales_rep_phone || '' });
    setEditingRep(true);
  };

  const saveRep = async () => {
    await axios.put(`/api/companies/${id}`, { ...company, ...repForm });
    setEditingRep(false);
    load();
  };

  const cf = (k) => e => setContactForm(p => ({ ...p, [k]: k === 'is_primary' ? e.target.checked : e.target.value }));
  const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
  const fmtSize = (bytes) => bytes > 1048576 ? `${(bytes/1048576).toFixed(1)} MB` : `${Math.round(bytes/1024)} KB`;

  const openTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  if (!company) return <div className="page-content"><p className="text-muted">Loading…</p></div>;

  const filteredActivities = (company.activities || []).filter(a =>
    activityFilter === 'all' || a.type === activityFilter
  );

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost" onClick={() => navigate('/companies')}>← Back</button>
          <div>
            <h2>{company.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${CONTRACT_COLORS[company.contract_type] || 'badge-gray'}`}>
                {(company.contract_type || '').replace(/_/g, ' ')}
              </span>
              {company.property_type && <span className="text-muted text-sm">{company.property_type}</span>}
              {company.city && <span className="text-muted text-sm">📍 {[company.city, company.state].filter(Boolean).join(', ')}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => openNoteModal('meeting_summary')}>📋 Log Meeting</button>
          <button className="btn btn-secondary" onClick={() => openNoteModal('email')}>✉️ Log Email</button>
          <button className="btn btn-secondary" onClick={() => openNoteModal('note')}>+ Activity</button>
          <button className="btn btn-secondary" onClick={() => setShowEmail(true)}>✉ Email</button>
          <Link to={`/proposals?company=${id}`} className="btn btn-primary">+ Proposal</Link>
        </div>
      </div>

      <div className="page-content">
        <div className="two-col">

          {/* ── Left column ── */}
          <div>
            {/* Account info */}
            <div className="card mb-4">
              <div className="card-header"><h3>Account Details</h3></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                  {[
                    ['Phone', company.phone],
                    ['Website', company.website],
                    ['Address', [company.address, company.city, company.state, company.zip].filter(Boolean).join(', ')],
                    ['HVAC Units', company.num_hvac_units],
                    ['Plumbing Fixtures', company.num_plumbing_fixtures],
                    ['Est. Annual Revenue', company.annual_revenue ? fmt(company.annual_revenue) : null],
                  ].map(([label, val]) => val ? (
                    <div key={label}>
                      <div className="text-muted text-sm">{label}</div>
                      <div className="font-bold">{val}</div>
                    </div>
                  ) : null)}
                </div>
                {company.notes && (
                  <div className="mt-4" style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '10px 12px', fontSize: 13 }}>
                    <div className="text-muted text-sm mb-1">Account Notes</div>
                    {company.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Sales Rep */}
            <div className="card mb-4">
              <div className="card-header">
                <h3>Sales Rep</h3>
                {!editingRep && (
                  <button className="btn btn-secondary btn-sm" onClick={openEditRep}>
                    {company.sales_rep_name ? 'Edit' : '+ Assign'}
                  </button>
                )}
              </div>
              <div className="card-body">
                {editingRep ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Name</label>
                      <input className="form-control" value={repForm.sales_rep_name} onChange={e => setRepForm(p => ({ ...p, sales_rep_name: e.target.value }))} placeholder="Rep full name" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" value={repForm.sales_rep_email} onChange={e => setRepForm(p => ({ ...p, sales_rep_email: e.target.value }))} placeholder="rep@yourcompany.com" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Phone</label>
                      <input className="form-control" value={repForm.sales_rep_phone} onChange={e => setRepForm(p => ({ ...p, sales_rep_phone: e.target.value }))} placeholder="(720) 555-0000" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="btn btn-primary btn-sm" onClick={saveRep}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingRep(false)}>Cancel</button>
                      {company.sales_rep_name && (
                        <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }}
                          onClick={async () => { await axios.put(`/api/companies/${id}`, { ...company, sales_rep_name: '', sales_rep_email: '', sales_rep_phone: '' }); setEditingRep(false); load(); }}>
                          Remove Rep
                        </button>
                      )}
                    </div>
                  </div>
                ) : company.sales_rep_name ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                    <div>
                      <div className="font-bold">{company.sales_rep_name}</div>
                      {company.sales_rep_email && <div className="text-muted">{company.sales_rep_email}</div>}
                      {company.sales_rep_phone && <div className="text-muted">{company.sales_rep_phone}</div>}
                      <div style={{ marginTop: 4, fontSize: 11, color: '#2563eb' }}>🔔 Gets notified on signatures & new jobs</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted text-sm">No sales rep assigned. Assign one to enable notifications when proposals are signed or jobs are scheduled.</p>
                )}
              </div>
            </div>

            {/* Contacts */}
            <div className="card">
              <div className="card-header">
                <h3>Contacts ({company.contacts?.length || 0})</h3>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setContactForm(CONTACT_EMPTY); setEditContactId(null); setShowContactModal(true); }}>
                  + Add
                </button>
              </div>
              {(company.contacts?.length || 0) === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}><p>No contacts yet.</p></div>
              ) : (
                <div className="card-body" style={{ padding: '8px 0' }}>
                  {company.contacts?.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                      <div>
                        <div className="font-bold">
                          {c.first_name} {c.last_name}
                          {c.is_primary ? <span className="badge badge-blue" style={{ marginLeft: 6 }}>Primary</span> : null}
                        </div>
                        {c.title && <div className="text-muted text-sm">{c.title}</div>}
                        <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                          {c.email && <a href={`mailto:${c.email}`} className="link-style text-sm">✉ {c.email}</a>}
                          {c.phone && <span className="text-sm text-muted">📞 {c.phone}</span>}
                          {c.mobile && <span className="text-sm text-muted">📱 {c.mobile}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, color: '#2563eb' }}
                          disabled={inviting === c.id}
                          onClick={() => sendPortalInvite(c.id)}
                          title="Generate customer portal link"
                        >
                          {inviting === c.id ? '…' : '🔗 Portal'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setContactForm({ ...c, is_primary: !!c.is_primary });
                          setEditContactId(c.id);
                          setShowContactModal(true);
                        }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                          onClick={() => deleteContact(c.id, `${c.first_name} ${c.last_name}`)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          {/* Attachments */}
            <div className="card mt-4">
              <div className="card-header">
                <h3>📎 Files ({attachments.length})</h3>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {uploading ? 'Uploading…' : '+ Upload'}
                </button>
                <input ref={fileRef} type="file" hidden onChange={uploadFile} />
              </div>
              {attachments.length === 0 ? (
                <div style={{ padding: '16px 18px', color: '#9ca3af', fontSize: 13 }}>
                  No files yet — upload contracts, photos, or documents.
                </div>
              ) : (
                <div>
                  {attachments.map(att => (
                    <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>
                        {att.mimetype?.startsWith('image/') ? '🖼️' : att.mimetype === 'application/pdf' ? '📄' : '📎'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.original_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtSize(att.size)} · {new Date(att.uploaded_at).toLocaleDateString()}</div>
                      </div>
                      <a href={`${API}/api/attachments/${att.id}/download`}
                        style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, color: '#374151', textDecoration: 'none' }}>
                        ⬇
                      </a>
                      <button onClick={() => deleteAttachment(att.id)}
                        style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div>
            {/* Proposals */}
            <div className="card mb-4">
              <div className="card-header">
                <h3>Proposals ({company.proposals?.length || 0})</h3>
                <Link to="/proposals" className="btn btn-secondary btn-sm">View All</Link>
              </div>
              {(company.proposals?.length || 0) === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}><p>No proposals yet.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Title</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {company.proposals.map(p => (
                        <tr key={p.id}>
                          <td><Link to={`/proposals/${p.id}`} className="link-style">{p.title}</Link></td>
                          <td className="font-bold">{fmt(p.total_amount)}</td>
                          <td><span className={`badge ${PROPOSAL_COLORS[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                          <td className="text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Tasks ── */}
            <div className="card mb-4">
              <div className="card-header">
                <h3>✅ Tasks ({openTasks.length} open)</h3>
              </div>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    type="text" placeholder="New task…" value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    style={{ flex: 1, minWidth: 120, padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                  />
                  <input
                    type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                    style={{ width: 120, padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}
                  />
                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                  <button onClick={addTask} disabled={addingTask || !newTask.trim()}
                    style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#1e3a5f', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + Add
                  </button>
                </div>
              </div>
              {tasks.length === 0 ? (
                <div style={{ padding: '16px 18px', color: '#9ca3af', fontSize: 13 }}>No tasks yet.</div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {[...openTasks, ...completedTasks].map(task => {
                    const due = taskDueLabel(task.due_date);
                    return (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 16px',
                        borderBottom: '1px solid #f3f4f6',
                        opacity: task.completed ? 0.55 : 1,
                        background: task.completed ? '#fafafa' : 'white',
                      }}>
                        <button onClick={() => completeTask(task.id)} title={task.completed ? 'Reopen' : 'Complete'}
                          style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${task.completed ? '#10b981' : '#d1d5db'}`, background: task.completed ? '#10b981' : '#fff', cursor: 'pointer', flexShrink: 0, marginTop: 2, color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {task.completed ? '✓' : ''}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', textDecoration: task.completed ? 'line-through' : 'none', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            {task.priority === 'high' && !task.completed && (
                              <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>HIGH</span>
                            )}
                            {task.title}
                          </div>
                          {due && !task.completed && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: due.color, background: due.bg, borderRadius: 4, padding: '1px 6px', marginTop: 3, display: 'inline-block' }}>
                              {due.label}
                            </span>
                          )}
                          {task.completed && task.completed_at && (
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>Completed {new Date(task.completed_at).toLocaleDateString()}</div>
                          )}
                        </div>
                        <button onClick={() => deleteTask(task.id)}
                          style={{ padding: '2px 7px', borderRadius: 5, border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Activity / Notes Log ── */}
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                <h3>Activity Log ({company.activities?.length || 0})</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openNoteModal('meeting_summary')}>📋 Meeting</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openNoteModal('note')}>+ Log</button>
                </div>
              </div>

              {/* Filter bar */}
              {(company.activities?.length || 0) > 0 && (
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--gray-200)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--gray-50)' }}>
                  {['all', ...ACTIVITY_TYPES].map(t => (
                    <button key={t} onClick={() => setActivityFilter(t)}
                      style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: 'none',
                        background: activityFilter === t ? '#1d4ed8' : '#e5e7eb',
                        color: activityFilter === t ? '#fff' : '#6b7280',
                      }}>
                      {t === 'all' ? 'All' : (ACTIVITY_META[t]?.icon + ' ' + ACTIVITY_META[t]?.label)}
                    </button>
                  ))}
                </div>
              )}

              {filteredActivities.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p>{activityFilter === 'all' ? 'No activities yet.' : `No ${activityFilter} entries.`}</p>
                </div>
              ) : (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {filteredActivities.map(a => {
                    const meta = ACTIVITY_META[a.type] || { icon: '📝', label: a.type, color: '#6b7280' };
                    const isExpanded = expandedActivity === a.id;
                    const isMeeting = a.type === 'meeting_summary';
                    const isLong = a.body && a.body.length > 120;
                    return (
                      <div key={a.id}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--gray-100)',
                          borderLeft: `3px solid ${meta.color}`,
                          background: isMeeting ? '#fffbf5' : 'white',
                        }}>
                        {/* Top row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16 }}>{meta.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                            {meta.label}
                          </span>
                          {a.first_name && (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>· {a.first_name} {a.last_name}</span>
                          )}
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                            {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        {/* Subject */}
                        {a.subject && (
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#111827' }}>{a.subject}</div>
                        )}
                        {/* Body */}
                        {a.body && (
                          <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {isLong && !isExpanded
                              ? <>{a.body.slice(0, 120)}<span style={{ color: '#9ca3af' }}>…</span></>
                              : a.body
                            }
                          </div>
                        )}
                        {isLong && (
                          <button onClick={() => setExpandedActivity(isExpanded ? null : a.id)}
                            style={{ marginTop: 6, fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Modal ── */}
      {showContactModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowContactModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editContactId ? 'Edit Contact' : 'Add Contact'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowContactModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-control" value={contactForm.first_name} onChange={cf('first_name')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-control" value={contactForm.last_name} onChange={cf('last_name')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Title / Role</label>
                <input className="form-control" value={contactForm.title} onChange={cf('title')} placeholder="Facility Manager, Property Manager..." />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" value={contactForm.email} onChange={cf('email')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={contactForm.phone} onChange={cf('phone')} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Mobile</label>
                  <input className="form-control" value={contactForm.mobile} onChange={cf('mobile')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Contact</label>
                  <select className="form-control" value={contactForm.preferred_contact} onChange={cf('preferred_contact')}>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={contactForm.is_primary} onChange={cf('is_primary')} />
                  <span className="form-label" style={{ margin: 0 }}>Primary contact for this account</span>
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={contactForm.notes} onChange={cf('notes')} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveContact}>{editContactId ? 'Save' : 'Add Contact'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email Compose ── */}
      {/* ── Portal Invite Modal ── */}
      {portalInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPortalInvite(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>🔗 Customer Portal Link</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setPortalInvite(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#d1fae5', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#065f46' }}>
                ✅ Portal link generated for <strong>{portalInvite.contact_name}</strong>
              </div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                Copy this link and send it to your customer. They'll land directly in their portal — no password needed.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  readOnly value={portalInvite.portal_url}
                  style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 12, color: '#374151', background: '#f9fafb' }}
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={copyInviteLink}
                  style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: inviteCopied ? '#059669' : '#1e3a5f', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {inviteCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Link expires in 90 days. Generate a new one anytime to refresh access.
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmail && (
        <EmailCompose
          context={{
            companyName: company.name,
            contactName: company.contacts?.[0] ? `${company.contacts[0].first_name} ${company.contacts[0].last_name}` : '',
            contactEmail: company.contacts?.find(c => c.is_primary)?.email || company.contacts?.[0]?.email || '',
          }}
          onClose={() => setShowEmail(false)}
        />
      )}

      {/* ── Log Activity / Meeting Summary Modal ── */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNoteModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>
                {ACTIVITY_META[note.type]?.icon} {' '}
                {note.type === 'meeting_summary' ? 'Log Meeting Summary' : 'Log Activity'}
              </h3>
              <button className="btn btn-ghost" onClick={() => setShowNoteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Activity Type</label>
                  <select className="form-control" value={note.type} onChange={e => {
                    const t = e.target.value;
                    const template = t === 'meeting_summary'
                      ? 'Attendees:\n\nKey Discussion Points:\n\nDecisions Made:\n\nNext Steps / Action Items:'
                      : note.body.startsWith('Attendees:') ? '' : note.body;
                    setNote(p => ({ ...p, type: t, body: template }));
                  }}>
                    {ACTIVITY_TYPES.map(t => (
                      <option key={t} value={t}>{ACTIVITY_META[t]?.icon} {ACTIVITY_META[t]?.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {note.type === 'meeting_summary' ? 'Meeting Title' : 'Subject'}
                  </label>
                  <input className="form-control" value={note.subject}
                    onChange={e => setNote(p => ({ ...p, subject: e.target.value }))}
                    placeholder={note.type === 'meeting_summary'
                      ? 'e.g. Q4 Proposal Review with John Smith'
                      : 'e.g. Initial call, Site visit…'}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {note.type === 'meeting_summary' ? 'Meeting Notes' : 'Details'}
                </label>
                <textarea className="form-control"
                  rows={note.type === 'meeting_summary' ? 8 : 4}
                  value={note.body}
                  onChange={e => setNote(p => ({ ...p, body: e.target.value }))}
                  placeholder={note.type === 'meeting_summary' ? '' : 'Notes from the call/visit…'}
                  style={{ fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addNote}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
