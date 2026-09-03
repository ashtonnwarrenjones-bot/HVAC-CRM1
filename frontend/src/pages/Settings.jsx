import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SalesforceImport from '../components/SalesforceImport';
import {
  Building2, FileText, Users, Database, Info,
  Phone, Check, AlertCircle, Link2, Smartphone, Copy, ExternalLink,
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
  { key: 'company',     label: 'Company Info',     Icon: Building2  },
  { key: 'proposal',    label: 'Proposal',          Icon: FileText   },
  { key: 'users',       label: 'Users',             Icon: Users      },
  { key: 'mobile',      label: 'Mobile App',        Icon: Smartphone },
  { key: 'integrations',label: 'Integrations',      Icon: Link2      },
  { key: 'data',        label: 'Data',              Icon: Database   },
  { key: 'about',       label: 'About',             Icon: Info       },
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

  // Mobile app QR
  const [mobileCopied, setMobileCopied] = useState(false);
  const mobileUrl = `${window.location.origin}/mobile`;
  const copyMobileUrl = () => {
    navigator.clipboard.writeText(mobileUrl).then(() => {
      setMobileCopied(true);
      setTimeout(() => setMobileCopied(false), 2000);
    });
  };

  // ComputerEase integration
  const [ceForm, setCeForm] = useState({ server:'', port:'1433', database:'', username:'', password:'', laborCostCode:'001', materialCostCode:'002', defaultLaborRate:'', enabled: false });
  const [ceSaving,    setCeSaving]    = useState(false);
  const [ceTesting,   setCeTesting]   = useState(false);
  const [ceTestResult,setCeTestResult]= useState(null); // { ok, version, tables, error }
  const [ceLog,       setCeLog]       = useState([]);
  const [ceLogLoading,setCeLogLoading]= useState(false);
  const [ceShowPw,    setCeShowPw]    = useState(false);

  useEffect(() => {
    axios.get('/api/settings').then(r => {
      setForm(f => ({ ...f, ...r.data }));
    }).catch(() => {}).finally(() => setLoading(false));
    loadUsers();
  }, []);

  const loadUsers = () => {
    axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  };

  // Load CE config when switching to integrations tab
  useEffect(() => {
    if (tab !== 'integrations') return;
    axios.get('/api/integrations/settings').then(r => {
      const cfg = r.data?.computerease || {};
      setCeForm(f => ({
        ...f,
        server:           cfg.server           || '',
        port:             cfg.port             || '1433',
        database:         cfg.database         || '',
        username:         cfg.username         || '',
        password:         cfg.password         || '',
        laborCostCode:    cfg.laborCostCode    || '001',
        materialCostCode: cfg.materialCostCode || '002',
        defaultLaborRate: cfg.defaultLaborRate || '',
        enabled:          !!cfg.enabled,
      }));
    }).catch(() => {});
    loadCeLog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadCeLog = () => {
    setCeLogLoading(true);
    axios.get('/api/integrations/log?key=computerease&limit=30')
      .then(r => setCeLog(r.data || []))
      .catch(() => {})
      .finally(() => setCeLogLoading(false));
  };

  const saveCeConfig = async () => {
    setCeSaving(true);
    setCeTestResult(null);
    try {
      await axios.post('/api/integrations/computerease/config', ceForm);
      loadCeLog();
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.error || e.message));
    } finally { setCeSaving(false); }
  };

  const testCeConnection = async () => {
    setCeTesting(true);
    setCeTestResult(null);
    try {
      // Save first so backend tests with latest values
      await axios.post('/api/integrations/computerease/config', ceForm);
      const r = await axios.post('/api/integrations/computerease/test');
      setCeTestResult(r.data);
      loadCeLog();
    } catch (e) {
      setCeTestResult({ ok: false, error: e.response?.data?.error || e.message });
    } finally { setCeTesting(false); }
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
        <div data-tour="settings" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', marginBottom: 8 }}>
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

        {/* ── Mobile App ── */}
        {tab === 'mobile' && (
          <>
            {sectionTitle('Mobile App', 'Give technicians access to jobs, check-in, and dispatch from their phone.')}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '22px 24px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'inline-block' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(mobileUrl)}`}
                      alt="Mobile app QR code"
                      width={180} height={180}
                      style={{ display: 'block', borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>Scan to open on phone</div>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Technician Mobile App</h3>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Share this QR code or link with your techs. When they scan it, the mobile app opens in their browser — no app store download required. They log in with their CRM username and password.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <div style={{ flex: 1, background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 13px', fontSize: 13, fontFamily: 'monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mobileUrl}</div>
                    <button onClick={copyMobileUrl} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: mobileCopied ? '#dcfce7' : 'var(--bg-card)', color: mobileCopied ? '#166534' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
                      {mobileCopied ? <Check size={14} /> : <Copy size={14} />}
                      {mobileCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <a href={mobileUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                      <ExternalLink size={14} /> Open
                    </a>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {[['📋','View assigned jobs'],['✅','Check in / check out GPS'],['📝','Add job notes & photos'],['🔩','Log parts used'],['⏱️','Track time on job'],['🔧','View service history']].map(([icon, text]) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><span>{icon}</span> {text}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px 24px', background: '#eff6ff', borderTop: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1e40af' }}>
                <Smartphone size={15} />
                <span>Works on any smartphone browser — iPhone Safari or Android Chrome. No installation needed. Add to Home Screen for an app-like experience.</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>How to share with your team</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['1','Screenshot this QR code and text it to your techs, or print it and post it in the shop.'],['2','Techs open their phone camera, scan the QR code, and the app opens instantly.'],['3','They log in with the username and password you set up in the Users tab.'],['4','On iPhone: tap Share → Add to Home Screen. On Android: tap the menu → Add to Home Screen.']].map(([num, text]) => (
                  <div key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1e40af', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{num}</div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Integrations ── */}
        {tab === 'integrations' && (
          <>
            {sectionTitle('Integrations', 'Connect external systems to automate data flow between your CRM and accounting software.')}

            {/* ── ComputerEase ── */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, marginBottom:20, overflow:'hidden' }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 22px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:46, height:46, borderRadius:10, background:'#1e3a5f', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ color:'#fff', fontWeight:900, fontSize:15, letterSpacing:'-0.5px' }}>CE</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)' }}>ComputerEase</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>Job cost sync · P.O. auto-detect · Completed job push</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {/* Enable toggle */}
                  <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', userSelect:'none' }}>
                    <div
                      onClick={() => setCeForm(f => ({ ...f, enabled: !f.enabled }))}
                      style={{ width:38, height:22, borderRadius:11, background: ceForm.enabled ? '#16a34a' : '#d1d5db', position:'relative', cursor:'pointer', transition:'background 0.2s' }}
                    >
                      <div style={{ position:'absolute', top:3, left: ceForm.enabled ? 18 : 3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, color: ceForm.enabled ? '#16a34a' : '#6b7280' }}>
                      {ceForm.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                  {/* Status badge */}
                  {ceTestResult && (
                    <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:700, background: ceTestResult.ok ? '#dcfce7' : '#fee2e2', color: ceTestResult.ok ? '#166534' : '#991b1b' }}>
                      {ceTestResult.ok ? '● Connected' : '● Error'}
                    </span>
                  )}
                </div>
              </div>

              {/* What syncs */}
              <div style={{ padding:'14px 22px', background:'#f8fafc', borderBottom:'1px solid var(--border)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px 16px' }}>
                {[
                  ['🔢', 'CE Job #', 'Auto-detected when created in CE'],
                  ['📋', 'P.O. Numbers', 'Pulled from CE → auto-emailed to suppliers'],
                  ['⏱️', 'Labor Costs', 'Time entries pushed to CE job ledger'],
                  ['🔩', 'Material Costs', 'Parts used pushed to CE job ledger'],
                  ['✅', 'Job Completion', 'Marks job in CE when CRM job closes'],
                  ['📊', 'Sync Log', 'Every operation logged for audit trail'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                    <span style={{ fontSize:16 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{title}</div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Connection form */}
              <div style={{ padding:'20px 22px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:14 }}>SQL Server Connection</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Server / IP Address</label>
                    <input
                      value={ceForm.server}
                      onChange={e => setCeForm(f => ({ ...f, server: e.target.value }))}
                      placeholder="192.168.1.50 or OFFICE-SERVER"
                      style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Port</label>
                    <input
                      value={ceForm.port}
                      onChange={e => setCeForm(f => ({ ...f, port: e.target.value }))}
                      placeholder="1433"
                      style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Database Name</label>
                    <input
                      value={ceForm.database}
                      onChange={e => setCeForm(f => ({ ...f, database: e.target.value }))}
                      placeholder="CEASDB"
                      style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>SQL Username</label>
                    <input
                      value={ceForm.username}
                      onChange={e => setCeForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="sa"
                      style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Password</label>
                    <div style={{ position:'relative' }}>
                      <input
                        type={ceShowPw ? 'text' : 'password'}
                        value={ceForm.password}
                        onChange={e => setCeForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="SQL password"
                        style={{ width:'100%', padding:'8px 36px 8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }}
                      />
                      <button onClick={() => setCeShowPw(p=>!p)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#6b7280' }}>
                        {ceShowPw ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cost codes */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:10, paddingTop:6, borderTop:'1px solid var(--border)' }}>Cost Code Mapping</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Labor Cost Code</label>
                      <input value={ceForm.laborCostCode} onChange={e => setCeForm(f => ({ ...f, laborCostCode: e.target.value }))} placeholder="001"
                        style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Material Cost Code</label>
                      <input value={ceForm.materialCostCode} onChange={e => setCeForm(f => ({ ...f, materialCostCode: e.target.value }))} placeholder="002"
                        style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Default Labor Rate ($/hr)</label>
                      <input type="number" value={ceForm.defaultLaborRate} onChange={e => setCeForm(f => ({ ...f, defaultLaborRate: e.target.value }))} placeholder="85"
                        style={{ width:'100%', padding:'8px 11px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--bg-page)', color:'var(--text-primary)', boxSizing:'border-box' }} />
                    </div>
                  </div>
                </div>

                {/* Test result */}
                {ceTestResult && (
                  <div style={{ padding:'12px 14px', borderRadius:8, background: ceTestResult.ok ? '#f0fdf4' : '#fef2f2', border:`1px solid ${ceTestResult.ok ? '#86efac' : '#fca5a5'}`, marginBottom:12 }}>
                    {ceTestResult.ok ? (
                      <>
                        <div style={{ fontSize:13, fontWeight:700, color:'#166534', marginBottom:4 }}>✓ Connected successfully</div>
                        <div style={{ fontSize:12, color:'#15803d' }}>{ceTestResult.version}</div>
                        {ceTestResult.tables && (
                          <div style={{ fontSize:11, color:'#166534', marginTop:6 }}>
                            {ceTestResult.tables.length} tables found — schema ready to map.
                            <span style={{ marginLeft:8, opacity:0.7 }}>{ceTestResult.tables.slice(0,8).join(', ')}{ceTestResult.tables.length > 8 ? '…' : ''}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize:13, fontWeight:700, color:'#991b1b', marginBottom:4 }}>Connection failed</div>
                        <div style={{ fontSize:12, color:'#dc2626', fontFamily:'monospace' }}>{ceTestResult.error}</div>
                      </>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display:'flex', gap:10 }}>
                  <button
                    onClick={testCeConnection}
                    disabled={ceTesting || !ceForm.server}
                    style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1d4ed8', fontSize:13, fontWeight:700, cursor: ceTesting||!ceForm.server ? 'not-allowed' : 'pointer', opacity: ceTesting||!ceForm.server ? 0.6 : 1 }}
                  >
                    {ceTesting ? 'Testing…' : '⚡ Test Connection'}
                  </button>
                  <button
                    onClick={saveCeConfig}
                    disabled={ceSaving}
                    style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'#1e3a5f', color:'#fff', fontSize:13, fontWeight:700, cursor: ceSaving ? 'not-allowed' : 'pointer', opacity: ceSaving ? 0.7 : 1 }}
                  >
                    {ceSaving ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>

              {/* Sync Log */}
              <div style={{ borderTop:'1px solid var(--border)', padding:'16px 22px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)' }}>Sync Log</div>
                  <button onClick={loadCeLog} style={{ fontSize:11, color:'#2563eb', background:'none', border:'none', cursor:'pointer' }}>Refresh</button>
                </div>
                {ceLogLoading ? (
                  <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Loading…</div>
                ) : ceLog.length === 0 ? (
                  <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>No activity yet — save your settings and test the connection to get started.</div>
                ) : (
                  <div style={{ maxHeight:200, overflowY:'auto', fontFamily:'monospace', fontSize:11 }}>
                    {ceLog.map(entry => (
                      <div key={entry.id} style={{ display:'flex', gap:10, padding:'5px 0', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}>
                        <span style={{ color: entry.status==='success'?'#16a34a':entry.status==='error'?'#dc2626':'#6b7280', fontWeight:700, flexShrink:0 }}>
                          {entry.status==='success'?'✓':entry.status==='error'?'✗':'·'}
                        </span>
                        <span style={{ color:'#9ca3af', flexShrink:0 }}>{new Date(entry.created_at).toLocaleTimeString()}</span>
                        <span style={{ color:'var(--text-muted)', flexShrink:0 }}>[{entry.operation}]</span>
                        <span style={{ color:'var(--text-primary)' }}>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* QuickBooks */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#2CA01C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, fontFamily: 'serif' }}>QB</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>QuickBooks Online</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Sync invoices, customers, and payments</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>Coming Soon</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
                Sync invoices, customers, and payments with QuickBooks Online. On the roadmap — connection setup will appear here when available.
              </p>
              <button disabled style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#e5e7eb', color:'#9ca3af', fontWeight:700, fontSize:13, cursor:'not-allowed' }}>
                Coming Soon
              </button>
            </div>

            {/* Placeholder */}
            <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 12, padding: '16px 22px', opacity: 0.6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>More integrations coming</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stripe payments, Google Calendar, and more.</div>
            </div>
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
