import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmailCompose from '../components/EmailCompose';

const CONDITION_BADGE = {
  good:      { cls: 'badge-green',  label: 'Good' },
  fair:      { cls: 'badge-yellow', label: 'Fair' },
  poor:      { cls: 'badge-red',    label: 'Poor' },
  new:       { cls: 'badge-blue',   label: 'New'  },
  replaced:  { cls: 'badge-gray',   label: 'Replaced' },
};
const EQ_EMPTY = {
  unit_type: '', make: '', model: '', serial_number: '',
  install_date: '', last_service_date: '', warranty_expiry: '',
  location_notes: '', condition: 'good', notes: '',
};
function warrantyStatus(expiry) {
  if (!expiry) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const exp = new Date(expiry + 'T00:00:00');
  const diff = Math.round((exp - today) / 86400000);
  if (diff < 0)   return { label: 'Expired',       cls: 'badge-red'    };
  if (diff <= 90) return { label: `${diff}d left`,  cls: 'badge-yellow' };
  return { label: 'Active', cls: 'badge-green' };
}

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

// <img> tags can't send auth headers — fetch the file with Bearer token and
// render it as a blob URL instead. Revokes the URL when the component unmounts.
function AuthImage({ src, style, onClick, title, alt }) {
  const [blobSrc, setBlobSrc] = React.useState(null);
  React.useEffect(() => {
    if (!src) return;
    let revoke;
    const token = localStorage.getItem('crm_token');
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(blob => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobSrc(url);
      })
      .catch(() => {});
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);
  if (!blobSrc) return (
    <div style={{ ...style, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼️</div>
  );
  return <img src={blobSrc} alt={alt || ''} style={style} onClick={onClick} title={title} />;
}

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

  // Service photos state
  const [photoGroups, setPhotoGroups] = useState([]);
  const [lightbox, setLightbox] = useState(null); // { url, name }

  // Service history state
  const [serviceJobs, setServiceJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null); // job opened in slide-over
  const [jobPhotos, setJobPhotos] = useState([]); // photos for selectedJob
  const [loadingJobPhotos, setLoadingJobPhotos] = useState(false);

  // Equipment state
  const [equipment, setEquipment] = useState([]);
  const [showEqModal, setShowEqModal] = useState(false);
  const [eqForm, setEqForm] = useState(EQ_EMPTY);
  const [editEqId, setEditEqId] = useState(null);
  const [savingEq, setSavingEq] = useState(false);
  const [eqErr, setEqErr] = useState('');

  // Sales rep state
  const [editingRep, setEditingRep] = useState(false);
  const [repForm, setRepForm] = useState({ sales_rep_name: '', sales_rep_email: '', sales_rep_phone: '' });

  const load = useCallback(() => axios.get(`/api/companies/${id}`).then(r => setCompany(r.data)), [id]);
  const loadAttachments = useCallback(() => axios.get(`/api/attachments?company_id=${id}`).then(r => setAttachments(r.data)), [id]);
  const loadTasks = useCallback(() => axios.get(`/api/tasks?company_id=${id}`).then(r => setTasks(r.data)), [id]);
  const loadPhotos = useCallback(() => axios.get(`/api/photos/companies/${id}`).then(r => setPhotoGroups(r.data)).catch(() => {}), [id]);
  const loadServiceJobs = useCallback(() =>
    axios.get(`/api/jobs?company_id=${id}`).then(r =>
      setServiceJobs(r.data.sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || '')))
    ).catch(() => {}), [id]);
  const loadEquipment = useCallback(() =>
    axios.get('/api/equipment', { params: { company_id: id } }).then(r => setEquipment(r.data)).catch(() => {}), [id]);

  useEffect(() => { load(); loadAttachments(); loadTasks(); loadPhotos(); loadServiceJobs(); loadEquipment(); }, [load, loadAttachments, loadTasks, loadPhotos, loadServiceJobs, loadEquipment]);

  const openJobPanel = async (job) => {
    setSelectedJob(job);
    setJobPhotos([]);
    setLoadingJobPhotos(true);
    try {
      const r = await axios.get(`/api/photos/jobs/${job.id}`);
      setJobPhotos(r.data);
    } catch { /* non-critical */ }
    finally { setLoadingJobPhotos(false); }
  };

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

  // Equipment handlers
  const openNewEq = () => { setEqForm(EQ_EMPTY); setEditEqId(null); setEqErr(''); setShowEqModal(true); };
  const openEditEq = (item) => {
    setEqForm({
      unit_type: item.unit_type || '', make: item.make || '', model: item.model || '',
      serial_number: item.serial_number || '',
      install_date: item.install_date ? item.install_date.slice(0,10) : '',
      last_service_date: item.last_service_date ? item.last_service_date.slice(0,10) : '',
      warranty_expiry: item.warranty_expiry ? item.warranty_expiry.slice(0,10) : '',
      location_notes: item.location_notes || '', condition: item.condition || 'good', notes: item.notes || '',
    });
    setEditEqId(item.id); setEqErr(''); setShowEqModal(true);
  };
  const saveEq = async () => {
    setSavingEq(true); setEqErr('');
    try {
      const payload = { ...eqForm, company_id: id };
      if (editEqId) await axios.put(`/api/equipment/${editEqId}`, payload);
      else await axios.post('/api/equipment', payload);
      setShowEqModal(false);
      loadEquipment();
    } catch (e) { setEqErr(e.response?.data?.error || 'Save failed.'); }
    finally { setSavingEq(false); }
  };
  const deleteEq = async (eqId, label) => {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    await axios.delete(`/api/equipment/${eqId}`);
    loadEquipment();
  };
  const ef = k => e => setEqForm(p => ({ ...p, [k]: e.target.value }));

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
          {/* ── Equipment ── */}
            <div className="card mt-4">
              <div className="card-header">
                <h3>🔩 Equipment ({equipment.length})</h3>
                <button className="btn btn-secondary btn-sm" onClick={openNewEq}>+ Add</button>
              </div>
              {equipment.length === 0 ? (
                <div style={{ padding: '16px 18px', color: '#9ca3af', fontSize: 13 }}>
                  No equipment on file. Add units to track condition, warranty, and service history.
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Serial #</th>
                        <th>Condition</th>
                        <th>Warranty</th>
                        <th>Location</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipment.map(item => {
                        const cond = CONDITION_BADGE[item.condition] || CONDITION_BADGE.good;
                        const ws = warrantyStatus(item.warranty_expiry);
                        const label = [item.unit_type, item.make, item.model].filter(Boolean).join(' ') || 'Unit';
                        return (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                              {item.notes && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{item.notes}</div>}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.serial_number || '—'}</td>
                            <td><span className={`badge ${cond.cls}`}>{cond.label}</span></td>
                            <td>
                              {ws ? <span className={`badge ${ws.cls}`}>{ws.label}</span> : '—'}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.location_notes || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEditEq(item)}>✏</button>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteEq(item.id, label)}>✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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

            {/* ── Service History ── */}
            <div className="card mb-4">
              <div className="card-header">
                <h3>🔧 Service History ({serviceJobs.length})</h3>
              </div>
              {serviceJobs.length === 0 ? (
                <div style={{ padding: '16px 18px', color: '#9ca3af', fontSize: 13 }}>
                  No service records yet. Jobs scheduled for this company will appear here.
                </div>
              ) : (
                <div>
                  {serviceJobs.map(job => {
                    const statusColors = {
                      completed:    { bg: '#d1fae5', color: '#065f46' },
                      'in progress':{ bg: '#ede9fe', color: '#6d28d9' },
                      scheduled:    { bg: '#dbeafe', color: '#1d4ed8' },
                      'on site':    { bg: '#d1fae5', color: '#065f46' },
                      'on the way': { bg: '#fef3c7', color: '#d97706' },
                    };
                    const sc = statusColors[job.status?.toLowerCase()] || { bg: '#f3f4f6', color: '#6b7280' };
                    return (
                      <div
                        key={job.id}
                        onClick={() => openJobPanel(job)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 16px', borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        {/* Date block */}
                        <div style={{ textAlign: 'center', minWidth: 40 }}>
                          {job.scheduled_date ? (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                                {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', lineHeight: 1 }}>
                                {new Date(job.scheduled_date + 'T00:00:00').getDate()}
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>TBD</div>
                          )}
                        </div>
                        {/* Job info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            {[job.job_type, job.technician].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {/* Status + chevron */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 8px', background: sc.bg, color: sc.color, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                            {job.status || 'scheduled'}
                          </span>
                          <span style={{ color: '#9ca3af', fontSize: 14 }}>›</span>
                        </div>
                      </div>
                    );
                  })}
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

            {/* ── Service Photos ── */}
            <div className="card mb-4">
              <div className="card-header">
                <h3>📸 Service Photos ({photoGroups.reduce((sum, g) => sum + g.photos.length, 0)})</h3>
              </div>
              {photoGroups.length === 0 ? (
                <div style={{ padding: '16px 18px', color: '#9ca3af', fontSize: 13 }}>
                  No service photos yet. Techs can add photos from the mobile app during jobs.
                </div>
              ) : (
                <div>
                  {photoGroups.map(group => (
                    <div key={group.job_id} style={{ borderBottom: '1px solid #f3f4f6', padding: '12px 16px' }}>
                      {/* Job header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>
                          🔧 {group.job_title}
                        </span>
                        {group.scheduled_date && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            {new Date(group.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        {group.job_status && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 7px',
                            background: group.job_status === 'completed' ? '#d1fae5' : '#dbeafe',
                            color: group.job_status === 'completed' ? '#065f46' : '#1d4ed8',
                            textTransform: 'capitalize',
                          }}>
                            {group.job_status}
                          </span>
                        )}
                      </div>
                      {/* Photo grid */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {group.photos.map(photo => {
                          const isVideo = photo.mimetype?.startsWith('video/');
                          const fileUrl = `${API}/api/photos/${photo.id}/file`;
                          return (
                            <div key={photo.id} style={{ position: 'relative' }}>
                              {isVideo ? (
                                <a href={fileUrl} target="_blank" rel="noreferrer"
                                  style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    width: 90, height: 90, borderRadius: 8, background: '#1e3a5f',
                                    color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600, gap: 4,
                                  }}>
                                  <span style={{ fontSize: 24 }}>▶</span>
                                  <span style={{ fontSize: 10 }}>Video</span>
                                </a>
                              ) : (
                                <AuthImage
                                  src={fileUrl}
                                  alt={photo.original_name}
                                  onClick={() => setLightbox({ url: fileUrl, name: photo.original_name })}
                                  style={{
                                    width: 90, height: 90, objectFit: 'cover', borderRadius: 8,
                                    cursor: 'pointer', border: '1.5px solid #e5e7eb',
                                  }}
                                  title={photo.original_name}
                                />
                              )}
                              {photo.storage === 'sharepoint' && (
                                <span style={{
                                  position: 'absolute', bottom: 3, left: 3,
                                  fontSize: 9, background: 'rgba(0,0,0,0.55)', color: '#fff',
                                  borderRadius: 3, padding: '1px 4px',
                                }}>☁ OneDrive</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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

      {/* ── Service Job Slide-over ── */}
      {selectedJob && (
        <>
          {/* Backdrop */}
          <div onClick={() => setSelectedJob(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000 }} />
          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520,
            background: '#fff', zIndex: 1001, display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          }}>
            {/* Panel header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 4 }}>SERVICE RECORD</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>{selectedJob.title}</div>
              </div>
              <button onClick={() => setSelectedJob(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13, marginBottom: 20 }}>
                {[
                  ['Date', selectedJob.scheduled_date
                    ? new Date(selectedJob.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Not scheduled'],
                  ['Time', selectedJob.scheduled_time
                    ? new Date(`2000-01-01T${selectedJob.scheduled_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : '—'],
                  ['Type', selectedJob.job_type || '—'],
                  ['Duration', selectedJob.duration_hours ? `${selectedJob.duration_hours}h estimated` : '—'],
                  ['Technician', selectedJob.technician || 'Unassigned'],
                  ['Status', selectedJob.status || 'scheduled'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 600, color: '#111827', textTransform: label === 'Status' || label === 'Type' ? 'capitalize' : 'none' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Tech notes */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>FIELD NOTES</div>
                {selectedJob.notes ? (
                  <div style={{ fontSize: 14, color: '#374151', background: '#f9fafb', borderRadius: 8, padding: '12px 14px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {selectedJob.notes}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No field notes recorded.</div>
                )}
              </div>

              {/* Photos */}
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  SERVICE PHOTOS {!loadingJobPhotos && `(${jobPhotos.length})`}
                </div>
                {loadingJobPhotos ? (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading photos…</div>
                ) : jobPhotos.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No photos for this service visit.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {jobPhotos.map(photo => {
                      const isVideo = photo.mimetype?.startsWith('video/');
                      const fileUrl = `${API}/api/photos/${photo.id}/file`;
                      return isVideo ? (
                        <a key={photo.id} href={fileUrl} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 100, height: 100, borderRadius: 8, background: '#1e3a5f', color: '#fff', textDecoration: 'none', gap: 4 }}>
                          <span style={{ fontSize: 24 }}>▶</span>
                          <span style={{ fontSize: 10, fontWeight: 600 }}>Video</span>
                        </a>
                      ) : (
                        <AuthImage key={photo.id} src={fileUrl} alt={photo.original_name}
                          onClick={() => setLightbox({ url: fileUrl, name: photo.original_name })}
                          style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1.5px solid #e5e7eb' }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Photo Lightbox ── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: 20,
          }}
        >
          <AuthImage
            src={lightbox.url}
            alt={lightbox.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 10, objectFit: 'contain', cursor: 'default' }}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 16, right: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              fontSize: 22, width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
          <a
            href={lightbox.url}
            download
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '8px 18px',
              borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
            }}
          >⬇ Download</a>
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

      {/* ── Equipment Modal ── */}
      {showEqModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEqModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{editEqId ? 'Edit Equipment' : 'Add Equipment'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowEqModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {eqErr && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 13 }}>{eqErr}</div>}
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Unit Type</label>
                  <input className="form-control" value={eqForm.unit_type} onChange={ef('unit_type')} placeholder="RTU, Split, Boiler…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input className="form-control" value={eqForm.make} onChange={ef('make')} placeholder="Carrier, Trane…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-control" value={eqForm.model} onChange={ef('model')} placeholder="48XC048-5" />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input className="form-control" value={eqForm.serial_number} onChange={ef('serial_number')} placeholder="SN-000000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <select className="form-control" value={eqForm.condition} onChange={ef('condition')}>
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="replaced">Replaced</option>
                  </select>
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Install Date</label>
                  <input className="form-control" type="date" value={eqForm.install_date} onChange={ef('install_date')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Service</label>
                  <input className="form-control" type="date" value={eqForm.last_service_date} onChange={ef('last_service_date')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Warranty Expiry</label>
                  <input className="form-control" type="date" value={eqForm.warranty_expiry} onChange={ef('warranty_expiry')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Location Notes</label>
                <input className="form-control" value={eqForm.location_notes} onChange={ef('location_notes')} placeholder="Rooftop unit 3, northeast corner…" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={eqForm.notes} onChange={ef('notes')} placeholder="Additional details…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEqModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEq} disabled={savingEq}>
                {savingEq ? 'Saving…' : editEqId ? 'Update' : 'Add Equipment'}
              </button>
            </div>
          </div>
        </div>
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
