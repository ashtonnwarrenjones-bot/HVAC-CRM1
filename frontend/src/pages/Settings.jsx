import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SalesforceImport from '../components/SalesforceImport';
import {
  Building2, FileText, Users, Database, Info,
  Phone, Check, AlertCircle,
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

const CARRIERS = [
  { value: 'att',        label: 'AT&T' },
  { value: 'verizon',    label: 'Verizon' },
  { value: 'tmobile',    label: 'T-Mobile' },
  { value: 'sprint',     label: 'Sprint' },
  { value: 'boost',      label: 'Boost Mobile' },
  { value: 'cricket',    label: 'Cricket' },
  { value: 'metro',      label: 'Metro by T-Mobile' },
  { value: 'uscellular', label: 'US Cellular' },
];

const NAV = [
  { key: 'company',  label: 'Company Info',     Icon: Building2 },
  { key: 'proposal', label: 'Proposal',          Icon: FileText  },
  { key: 'users',    label: 'Users',             Icon: Users     },
  { key: 'data',     label: 'Data',              Icon: Database  },
  { key: 'about',    label: 'About',             Icon: Info      },
];

export default function Settings() {
  const [tab, setTab] = useState('company');
  const [form, setForm] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState(null);

  // User management
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'technician' });
  const [userMsg, setUserMsg] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingPhone, setEditingPhone] = useState({});

  useEffect(() => {
    axios.get('/api/settings').then(r => {
      setForm(f => ({ ...f, ...r.data }));
    }).catch(() => {}).finally(() => setLoading(false));
    loadUsers();
  }, []);

  const loadUsers = () => {
    axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      setUserMsg({ ok: false, text: 'Username and password are required.' });
      return;
    }
    setCreatingUser(true);
    setUserMsg(null);
    try {
      await axios.post('/api/users', newUser);
      setNewUser({ username: '', password: '', role: 'technician' });
      setUserMsg({ ok: true, text: `User "${newUser.username}" created.` });
      loadUsers();
    } catch (err) {
      setUserMsg({ ok: false, text: err.response?.data?.error || 'Failed to create user.' });
    } finally {
      setCreatingUser(false);
      setTimeout(() => setUserMsg(null), 4000);
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

  const savePhone = async (id, phone, carrier) => {
    try {
      await axios.patch(`/api/users/${id}`, { phone, carrier });
      setEditingPhone(ep => { const next = { ...ep }; delete next[id]; return next; });
      setUsers(us => us.map(u => u.id === id ? { ...u, phone, carrier } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save.');
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
    setSaving(true); setSaveErr('');
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
    if (!window.confirm('This will replace all existing data with sample data. Continue?')) return;
    setSeeding(true); setSeedMsg(null);
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

  if (loading) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

  // ── Shared input styles ────────────────────────────────────────────────────
  const inp = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-page)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' };
  const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 };
  const grp = { marginBottom: 16 };
  const sectionTitle = (title, sub) => (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h2>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* ── Sidebar nav ── */}
      <div style={{
        width: 200, flexShrink: 0, background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)', padding: '20px 12px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', marginBottom: 8 }}>
          Settings
        </div>
        {NAV.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
              background: tab === key ? 'var(--blue-600)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--text-secondary)',
              transition: 'all .15s',
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: 720 }}>

        {/* ── Company Info ── */}
        {tab === 'company' && (
          <>
            {sectionTitle('Company Info', 'This appears on all proposal PDFs.')}

            <div style={grp}>
              <label style={lbl}>Company Name</label>
              <input style={inp} value={form.company_name} onChange={f('company_name')} placeholder="Acme HVAC & Plumbing" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Phone</label>
                <input style={inp} value={form.company_phone} onChange={f('company_phone')} placeholder="(720) 555-0000" />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input style={inp} type="email" value={form.company_email} onChange={f('company_email')} placeholder="service@yourcompany.com" />
              </div>
            </div>
            <div style={grp}>
              <label style={lbl}>Street Address</label>
              <input style={inp} value={form.company_address} onChange={f('company_address')} placeholder="123 Industrial Blvd" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={lbl}>City</label>
                <input style={inp} value={form.company_city} onChange={f('company_city')} placeholder="Denver" />
              </div>
              <div>
                <label style={lbl}>State</label>
                <input style={inp} value={form.company_state} onChange={f('company_state')} placeholder="CO" />
              </div>
              <div>
                <label style={lbl}>ZIP</label>
                <input style={inp} value={form.company_zip} onChange={f('company_zip')} placeholder="80202" />
              </div>
            </div>
            <div style={grp}>
              <label style={lbl}>Contractor License #</label>
              <input style={inp} value={form.company_license} onChange={f('company_license')} placeholder="ME-00123 / PC-00456" />
            </div>

            {/* Logo */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 8, marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Company Logo</h3>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>Appears in the top-right corner of proposal PDFs. PNG or JPG, under 2 MB.</p>
              {form.company_logo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <img src={form.company_logo} alt="Logo" style={{ maxHeight: 72, maxWidth: 180, borderRadius: 6, border: '1px solid var(--border)', padding: 4, objectFit: 'contain', background: 'var(--bg-page)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Logo uploaded ✓</div>
                    <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setForm(p => ({ ...p, company_logo: '' }))}>Remove</button>
                  </div>
                </div>
              ) : (
                <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '24px 16px', textAlign: 'center', marginBottom: 12, background: 'var(--bg-page)' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🏢</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No logo uploaded yet</div>
                </div>
              )}
              <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                <span className="btn btn-secondary" style={{ fontSize: 13 }}>
                  {form.company_logo ? '🔄 Replace Logo' : '⬆ Upload Logo'}
                </span>
              </label>
            </div>

            {/* PDF preview strip */}
            <div style={{ background: '#1E40AF', color: '#fff', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>SERVICE PROPOSAL</div>
                <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>
                  {form.company_name || 'Your Company Name'} · {form.company_phone || '(555) 000-0000'} · {form.company_email || 'info@yourcompany.com'}
                </div>
              </div>
              {form.company_logo && <img src={form.company_logo} alt="Logo" style={{ maxHeight: 48, maxWidth: 90, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.15)', padding: 3 }} />}
            </div>

            <SaveBar saving={saving} saved={saved} saveErr={saveErr} onSave={save} />
          </>
        )}

        {/* ── Proposal ── */}
        {tab === 'proposal' && (
          <>
            {sectionTitle('Proposal Defaults', 'Applied when creating new proposals.')}
            <div style={grp}>
              <label style={lbl}>Default Tax Rate (%)</label>
              <input style={{ ...inp, maxWidth: 160 }} type="number" step="0.1" min="0" max="30" value={form.tax_rate_default} onChange={f('tax_rate_default')} placeholder="0" />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Set 0 if you don't charge tax.</p>
            </div>
            <div style={grp}>
              <label style={lbl}>Default Terms & Conditions</label>
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 120, fontFamily: 'inherit', lineHeight: 1.6 }} value={form.proposal_terms} onChange={f('proposal_terms')} placeholder="Payment terms, warranty info, scope limitations..." />
            </div>
            <div style={grp}>
              <label style={lbl}>Proposal Footer Message</label>
              <input style={inp} value={form.proposal_footer} onChange={f('proposal_footer')} placeholder="Thank you for the opportunity to earn your business." />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Printed at the bottom of every proposal.</p>
            </div>
            <SaveBar saving={saving} saved={saved} saveErr={saveErr} onSave={save} />
          </>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <>
            {sectionTitle('User Management', 'Manage who can log in and their phone numbers for SMS dispatch.')}

            {/* Existing users */}
            {users.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                {users.map(u => {
                  const isEditing = u.id in editingPhone;
                  const editVals  = editingPhone[u.id] || { phone: u.phone || '', carrier: u.carrier || '' };
                  const carrierLabel = CARRIERS.find(c => c.value === u.carrier)?.label || '';
                  return (
                    <div key={u.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--blue-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                            {u.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{u.username}</div>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 600, background: u.role === 'admin' ? '#dbeafe' : u.role === 'demo' ? '#f3f4f6' : '#dcfce7', color: u.role === 'admin' ? '#1d4ed8' : u.role === 'demo' ? '#6b7280' : '#166534' }}>{u.role}</span>
                          </div>
                        </div>
                        {u.role !== 'demo' && (
                          <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px', color: '#b91c1c' }} onClick={() => deleteUser(u.id, u.username)}>Delete</button>
                        )}
                      </div>

                      {/* Phone + Carrier */}
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 44 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              style={{ ...inp, flex: 1, fontSize: 13, padding: '7px 10px' }}
                              type="tel" placeholder="(555) 000-0000"
                              value={editVals.phone}
                              onChange={e => setEditingPhone(ep => ({ ...ep, [u.id]: { ...editVals, phone: e.target.value } }))}
                              autoFocus
                            />
                            <select
                              style={{ ...inp, flex: 1, fontSize: 13, padding: '7px 10px' }}
                              value={editVals.carrier}
                              onChange={e => setEditingPhone(ep => ({ ...ep, [u.id]: { ...editVals, carrier: e.target.value } }))}
                            >
                              <option value="">— Carrier —</option>
                              {CARRIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={() => savePhone(u.id, editVals.phone, editVals.carrier)}>Save</button>
                            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setEditingPhone(ep => { const n = { ...ep }; delete n[u.id]; return n; })}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: u.phone ? 'var(--blue-600)' : 'var(--text-muted)', padding: '2px 0 0 44px', display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => setEditingPhone(ep => ({ ...ep, [u.id]: { phone: u.phone || '', carrier: u.carrier || '' } }))}
                        >
                          <Phone size={13} />
                          {u.phone
                            ? <>{u.phone}{carrierLabel && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {carrierLabel}</span>}</>
                            : <span style={{ fontStyle: 'italic', fontSize: 12 }}>Add phone + carrier for SMS dispatch</span>
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create new user */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>Add New User</h3>
            {userMsg && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: userMsg.ok ? '#dcfce7' : '#fef2f2', color: userMsg.ok ? '#166534' : '#b91c1c' }}>
                {userMsg.ok ? <Check size={14} /> : <AlertCircle size={14} />} {userMsg.text}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Username</label>
                <input style={inp} value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} placeholder="jsmith" />
              </div>
              <div>
                <label style={lbl}>Password</label>
                <input style={inp} type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="Temporary password" />
              </div>
            </div>
            <div style={{ ...grp, marginBottom: 16 }}>
              <label style={lbl}>Role</label>
              <select style={inp} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                <option value="admin">Admin (full access)</option>
                <option value="technician">Technician (field access)</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="demo">Demo (read-only)</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={createUser} disabled={creatingUser} style={{ width: '100%' }}>
              {creatingUser ? '⏳ Creating...' : '+ Create User'}
            </button>
          </>
        )}

        {/* ── Data ── */}
        {tab === 'data' && (
          <>
            {sectionTitle('Data', 'Import, export, and manage your data.')}

            {/* Backup */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>💾 Backup Your Data</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
                Download a full backup of all your companies, contacts, proposals, jobs, and pipeline deals as a JSON file.
              </p>
              <a href="/api/settings/backup" download className="btn btn-secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                ⬇ Download Backup
              </a>
            </div>

            {/* Sample data */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🌱 Sample Data</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
                Load a full set of demo companies, contacts, proposals, jobs, and pipeline deals. <strong>This replaces any existing data.</strong>
              </p>
              {seedMsg && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: seedMsg.ok ? '#dcfce7' : '#fef2f2', color: seedMsg.ok ? '#166534' : '#b91c1c' }}>
                  {seedMsg.ok ? '✓ ' : '✗ '}{seedMsg.text}
                </div>
              )}
              <button className="btn btn-secondary" onClick={loadSampleData} disabled={seeding}>
                {seeding ? '⏳ Loading...' : '🌱 Load Sample Data'}
              </button>
            </div>

            {/* Salesforce import */}
            <SalesforceImport />
          </>
        )}

        {/* ── About ── */}
        {tab === 'about' && (
          <>
            {sectionTitle('About', 'System information.')}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {[
                ['Version',  '2.0'],
                ['Backend',  'Node.js + Express + PostgreSQL'],
                ['Frontend', 'React 18 + Vite'],
                ['Database', 'PostgreSQL (Render)'],
                ['SMS',      'Email-to-SMS via Resend (free)'],
                ['Maps',     'OpenStreetMap + Leaflet (free)'],
              ].map(([label, value], i, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 13, color: '#1d4ed8' }}>
              💾 Back up your data regularly using <strong>Data → Download Backup</strong>. Render's free tier does not persist the database across deploys.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Save bar component ─────────────────────────────────────────────────────────
function SaveBar({ saving, saved, saveErr, onSave }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
      <button
        className="btn btn-primary"
        onClick={onSave}
        disabled={saving}
        style={{ minWidth: 140 }}
      >
        {saving ? '⏳ Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
      </button>
      {saveErr && <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 500 }}>✗ {saveErr}</span>}
    </div>
  );
}
