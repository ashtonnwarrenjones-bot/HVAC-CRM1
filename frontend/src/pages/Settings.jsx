import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SalesforceImport from '../components/SalesforceImport';
import {
  Building2, FileText, Users, Database, Info,
  Upload, Trash2, Plus, CheckCircle, AlertCircle
} from 'lucide-react';

const DEFAULTS = {
  company_name: '',
  company_phone: '',
  company_email: '',
  company_address: '',
  company_city: '',
  company_state: '',
  company_zip: '',
  company_license: '',
  company_logo: '',
  proposal_terms: 'Payment due net 30 days. Price valid for 30 days from proposal date. All work performed per manufacturer specifications and local code.',
  proposal_footer: 'Thank you for the opportunity to earn your business.',
  tax_rate_default: '0',
};

const TABS = [
  { key: 'company',   label: 'Company',   Icon: Building2 },
  { key: 'proposals', label: 'Proposals', Icon: FileText },
  { key: 'users',     label: 'Users',     Icon: Users },
  { key: 'data',      label: 'Data',      Icon: Database },
  { key: 'about',     label: 'About',     Icon: Info },
];

const ROLE_OPTIONS = [
  { value: 'admin',      label: 'Admin',      desc: 'Full access to everything' },
  { value: 'sales_rep',  label: 'Sales Rep',  desc: 'Pipeline, proposals, contacts' },
  { value: 'dispatcher', label: 'Dispatcher', desc: 'Dispatch, schedule, jobs' },
  { value: 'technician', label: 'Technician', desc: 'My Jobs view only' },
  { value: 'demo',       label: 'Demo',       desc: 'Read-only access' },
];

const ROLE_COLORS = {
  admin:      { bg: '#dbeafe', color: '#1d4ed8' },
  sales_rep:  { bg: '#f5f3ff', color: '#6d28d9' },
  dispatcher: { bg: '#fef3c7', color: '#92400e' },
  technician: { bg: '#dcfce7', color: '#166534' },
  demo:       { bg: '#f3f4f6', color: '#6b7280' },
};

function Toast({ msg }) {
  if (!msg) return null;
  const ok = msg.ok;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      background: ok ? '#dcfce7' : '#fef2f2',
      border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
      color: ok ? '#166534' : '#dc2626',
      marginBottom: 16
    }}>
      {ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {msg.text}
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company');
  const [form, setForm]           = useState(DEFAULTS);
  const [saved, setSaved]         = useState(false);
  const [saveErr, setSaveErr]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [seeding, setSeeding]     = useState(false);
  const [seedMsg, setSeedMsg]     = useState(null);

  const [users, setUsers]             = useState([]);
  const [newUser, setNewUser]         = useState({ username: '', password: '', role: 'technician', email: '' });
  const [userMsg, setUserMsg]         = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // { id, role }

  useEffect(() => {
    axios.get('/api/settings').then(r => {
      setForm(f => ({ ...f, ...r.data }));
    }).catch(console.error).finally(() => setLoading(false));
    loadUsers();
  }, []);

  const loadUsers = () => axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      setUserMsg({ ok: false, text: 'Username and password are required.' });
      return;
    }
    setCreatingUser(true);
    setUserMsg(null);
    try {
      await axios.post('/api/users', newUser);
      const created = newUser.username;
      setNewUser({ username: '', password: '', role: 'technician', email: '' });
      setUserMsg({ ok: true, text: `User "${created}" created successfully.` });
      loadUsers();
    } catch (err) {
      setUserMsg({ ok: false, text: err.response?.data?.error || 'Failed to create user.' });
    } finally {
      setCreatingUser(false);
      setTimeout(() => setUserMsg(null), 5000);
    }
  };

  const updateRole = async (id, role) => {
    try {
      await axios.put(`/api/users/${id}`, { role });
      loadUsers();
      setEditingRole(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role.');
    }
  };

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/users/${id}`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  const f = (k) => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm(p => ({ ...p, company_logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      await axios.put('/api/settings', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveErr(err.response?.data?.error || err.message || 'Save failed');
      setTimeout(() => setSaveErr(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const loadSampleData = async () => {
    if (!window.confirm('This will replace all existing companies, contacts, proposals, jobs, deals, and activities with sample data. Continue?')) return;
    setSeeding(true);
    setSeedMsg(null);
    try {
      const r = await axios.post('/api/admin/seed');
      setSeedMsg({ ok: true, text: r.data.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setSeedMsg({ ok: false, text: err.response?.data?.error || 'Seed failed.' });
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <div className="page-content"><p className="text-muted">Loading…</p></div>;

  const inp = {
    width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
    background: 'var(--bg-page)', color: 'var(--text-primary)',
    transition: 'border-color .15s'
  };
  const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' };
  const fg = { marginBottom: 16 };
  const sectionTitle = { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' };
  const sectionSub   = { fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 };

  return (
    <>
      <style>{`
        .settings-tab-btn { transition: all .15s; }
        .settings-tab-btn:hover { background: rgba(37,99,235,.07) !important; color: var(--blue-600) !important; }
        .settings-tab-btn.active { background: var(--blue-600) !important; color: #fff !important; }
        .settings-tab-btn.active .tab-icon { opacity: 1; }
        .settings-inp:focus { border-color: var(--blue-600) !important; }
        .role-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
        @media (max-width: 640px) {
          .settings-layout { flex-direction: column !important; }
          .settings-sidebar { flex-direction: row !important; overflow-x: auto; border-right: none !important; border-bottom: 1px solid var(--border); padding: 8px !important; gap: 4px !important; min-width: unset !important; }
          .settings-tab-btn { flex-direction: row !important; padding: 8px 12px !important; white-space: nowrap; }
        }
      `}</style>

      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Settings</h2>
        {(activeTab === 'company' || activeTab === 'proposals') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saveErr && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>✗ {saveErr}</span>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="settings-layout" style={{ display: 'flex', minHeight: 'calc(100vh - 120px)', gap: 0 }}>

          {/* Sidebar */}
          <div className="settings-sidebar" style={{
            width: 200, flexShrink: 0, borderRight: '1px solid var(--border)',
            padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2,
            background: 'var(--bg-card)'
          }}>
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`settings-tab-btn${activeTab === key ? ' active' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, fontWeight: 600,
                  color: activeTab === key ? '#fff' : 'var(--text-secondary)',
                  width: '100%'
                }}
              >
                <Icon size={16} className="tab-icon" style={{ opacity: activeTab === key ? 1 : 0.6, flexShrink: 0 }} />
                {label}
              </button>
            ))}
          </div>

          {/* Content pane */}
          <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', maxWidth: 680 }}>

            {/* ── COMPANY ── */}
            {activeTab === 'company' && (
              <div>
                <h3 style={sectionTitle}>Company Information</h3>
                <p style={sectionSub}>This appears on all proposal PDFs and customer-facing documents.</p>

                <div style={fg}>
                  <label style={lbl}>Company Name</label>
                  <input className="settings-inp" style={inp} value={form.company_name} onChange={f('company_name')} placeholder="Acme HVAC & Plumbing" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, ...fg }}>
                  <div>
                    <label style={lbl}>Phone</label>
                    <input className="settings-inp" style={inp} value={form.company_phone} onChange={f('company_phone')} placeholder="(720) 555-0000" />
                  </div>
                  <div>
                    <label style={lbl}>Email</label>
                    <input className="settings-inp" style={inp} type="email" value={form.company_email} onChange={f('company_email')} placeholder="service@yourcompany.com" />
                  </div>
                </div>

                <div style={fg}>
                  <label style={lbl}>Street Address</label>
                  <input className="settings-inp" style={inp} value={form.company_address} onChange={f('company_address')} placeholder="123 Industrial Blvd" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr .5fr .5fr', gap: 14, ...fg }}>
                  <div>
                    <label style={lbl}>City</label>
                    <input className="settings-inp" style={inp} value={form.company_city} onChange={f('company_city')} placeholder="Denver" />
                  </div>
                  <div>
                    <label style={lbl}>State</label>
                    <input className="settings-inp" style={inp} value={form.company_state} onChange={f('company_state')} placeholder="CO" />
                  </div>
                  <div>
                    <label style={lbl}>ZIP</label>
                    <input className="settings-inp" style={inp} value={form.company_zip} onChange={f('company_zip')} placeholder="80202" />
                  </div>
                </div>

                <div style={fg}>
                  <label style={lbl}>Contractor License #</label>
                  <input className="settings-inp" style={inp} value={form.company_license} onChange={f('company_license')} placeholder="ME-00123 / PC-00456" />
                </div>

                {/* Logo */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Company Logo</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>Appears in the top-right corner of proposal PDFs. PNG or JPG, under 2 MB.</p>

                  {form.company_logo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, padding: '14px 16px', background: 'var(--bg-page)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <img src={form.company_logo} alt="Company logo" style={{ maxHeight: 64, maxWidth: 160, objectFit: 'contain' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Logo uploaded ✓</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label style={{ cursor: 'pointer' }}>
                            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                            <span className="btn btn-secondary" style={{ fontSize: 12 }}>Replace</span>
                          </label>
                          <button className="btn btn-secondary" style={{ fontSize: 12, color: '#dc2626' }} onClick={() => setForm(p => ({ ...p, company_logo: '' }))}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer', display: 'block' }}>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                      <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '28px 16px', textAlign: 'center', background: 'var(--bg-page)' }}>
                        <Upload size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Click to upload logo</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PNG, JPG up to 2 MB</div>
                      </div>
                    </label>
                  )}
                </div>

                {/* PDF preview */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>PDF Header Preview</h4>
                  <div style={{ background: '#1E40AF', color: 'white', borderRadius: 8, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>SERVICE PROPOSAL</div>
                      <div style={{ fontSize: 11, opacity: .75, marginTop: 3 }}>Commercial HVAC & Plumbing Services</div>
                      <div style={{ fontSize: 11, opacity: .65, marginTop: 2 }}>
                        {form.company_name || 'Your Company'} | {form.company_phone || '(555) 000-0000'} | {form.company_email || 'info@yourcompany.com'}
                      </div>
                    </div>
                    {form.company_logo && (
                      <img src={form.company_logo} alt="Logo" style={{ maxHeight: 48, maxWidth: 90, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.15)', padding: 4 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>This is how your info appears at the top of every proposal PDF.</p>
                </div>
              </div>
            )}

            {/* ── PROPOSALS ── */}
            {activeTab === 'proposals' && (
              <div>
                <h3 style={sectionTitle}>Proposal Defaults</h3>
                <p style={sectionSub}>These defaults are applied whenever a new proposal is created.</p>

                <div style={fg}>
                  <label style={lbl}>Default Tax Rate (%)</label>
                  <input className="settings-inp" style={{ ...inp, maxWidth: 160 }} type="number" step="0.1" min="0" max="30"
                    value={form.tax_rate_default} onChange={f('tax_rate_default')} placeholder="0" />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Set to 0 if you don't charge tax.</p>
                </div>

                <div style={fg}>
                  <label style={lbl}>Default Terms & Conditions</label>
                  <textarea className="settings-inp" style={{ ...inp, resize: 'vertical', minHeight: 120, fontFamily: 'inherit', lineHeight: 1.6 }}
                    value={form.proposal_terms} onChange={f('proposal_terms')}
                    placeholder="Payment terms, warranty info, scope limitations…" />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Printed near the bottom of every proposal PDF.</p>
                </div>

                <div style={fg}>
                  <label style={lbl}>Proposal Footer Message</label>
                  <input className="settings-inp" style={inp}
                    value={form.proposal_footer} onChange={f('proposal_footer')}
                    placeholder="Thank you for the opportunity to earn your business." />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>A closing line printed at the very bottom of every proposal.</p>
                </div>
              </div>
            )}

            {/* ── USERS ── */}
            {activeTab === 'users' && (
              <div>
                <h3 style={sectionTitle}>User Management</h3>
                <p style={sectionSub}>Create logins for your team. Each role controls which pages they can access.</p>

                {/* Role legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {ROLE_OPTIONS.map(r => (
                    <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: 12 }}>
                      <span className="role-badge" style={{ background: ROLE_COLORS[r.value]?.bg, color: ROLE_COLORS[r.value]?.color }}>{r.label}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{r.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Existing users list */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Current Users</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {users.length === 0 ? (
                      <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No users yet.</div>
                    ) : users.map((u, i) => (
                      <div key={u.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                        borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none',
                        background: 'var(--bg-card)'
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: ROLE_COLORS[u.role]?.bg || '#f3f4f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700, color: ROLE_COLORS[u.role]?.color || '#6b7280'
                        }}>
                          {(u.username || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{u.username}</div>
                          {u.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{u.email}</div>}
                        </div>

                        {/* Role picker / badge */}
                        {editingRole?.id === u.id ? (
                          <select
                            autoFocus
                            value={editingRole.role}
                            onChange={e => setEditingRole(r => ({ ...r, role: e.target.value }))}
                            onBlur={() => updateRole(u.id, editingRole.role)}
                            style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: 12, maxWidth: 140 }}
                          >
                            {ROLE_OPTIONS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingRole({ id: u.id, role: u.role })}
                            title="Click to change role"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <span className="role-badge" style={{ background: ROLE_COLORS[u.role]?.bg || '#f3f4f6', color: ROLE_COLORS[u.role]?.color || '#6b7280' }}>
                              {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                            </span>
                          </button>
                        )}

                        {u.role !== 'demo' && (
                          <button
                            onClick={() => deleteUser(u.id, u.username)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}
                            title="Delete user"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Click a role badge to change it.</p>
                </div>

                {/* Create new user */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Add New User</div>
                  <Toast msg={userMsg} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={lbl}>Username</label>
                      <input className="settings-inp" style={inp} value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} placeholder="jsmith" />
                    </div>
                    <div>
                      <label style={lbl}>Temporary Password</label>
                      <input className="settings-inp" style={inp} type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="Min 6 characters" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div>
                      <label style={lbl}>Email (optional)</label>
                      <input className="settings-inp" style={inp} type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} placeholder="jsmith@company.com" />
                    </div>
                    <div>
                      <label style={lbl}>Role</label>
                      <select className="settings-inp" style={inp} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                        {ROLE_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={createUser} disabled={creatingUser} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={15} />
                    {creatingUser ? 'Creating…' : 'Create User'}
                  </button>
                </div>
              </div>
            )}

            {/* ── DATA ── */}
            {activeTab === 'data' && (
              <div>
                <h3 style={sectionTitle}>Data & Imports</h3>
                <p style={sectionSub}>Import data from other sources, back up your CRM, or load sample data to explore.</p>

                {/* Salesforce Import */}
                <div style={{ marginBottom: 28 }}>
                  <SalesforceImport />
                </div>

                {/* Backup */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 20px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ fontSize: 28 }}>💾</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>Backup Your Data</div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
                        Download a full backup of all companies, contacts, proposals, jobs, and pipeline deals as a JSON file.
                        Render's free tier does not persist the database across deploys — save this somewhere safe.
                      </p>
                      <a
                        href="/api/settings/backup"
                        download
                        className="btn btn-secondary"
                        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        ⬇ Download Backup
                      </a>
                    </div>
                  </div>
                </div>

                {/* Sample Data */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ fontSize: 28 }}>🌱</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>Sample Data</div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
                        Load demo companies, contacts, proposals, jobs, and pipeline deals to explore every feature.
                        <strong style={{ color: '#dc2626' }}> This replaces all existing data.</strong>
                      </p>
                      <Toast msg={seedMsg} />
                      <button
                        className="btn btn-secondary"
                        onClick={loadSampleData}
                        disabled={seeding}
                      >
                        {seeding ? '⏳ Loading…' : '🌱 Load Sample Data'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ABOUT ── */}
            {activeTab === 'about' && (
              <div>
                <h3 style={sectionTitle}>About Conduit</h3>
                <p style={sectionSub}>Version info and technical stack.</p>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                  {[
                    { label: 'Version', value: 'v5.0' },
                    { label: 'Frontend', value: 'React 18 + Vite' },
                    { label: 'Backend', value: 'Node.js + Express' },
                    { label: 'Database', value: 'PostgreSQL (Render)' },
                    { label: 'Hosting', value: 'Render.com' },
                    { label: 'Email', value: 'Resend' },
                  ].map(({ label, value }, i, arr) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                      fontSize: 13
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#1d4ed8', lineHeight: 1.6 }}>
                  💡 Remember to download a <strong>data backup</strong> from the Data tab before redeploying — Render's free tier does not persist the database between deploys.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
