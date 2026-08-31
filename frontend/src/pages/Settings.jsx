import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SalesforceImport from '../components/SalesforceImport';

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

export default function Settings() {
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

  useEffect(() => {
    axios.get('/api/settings').then(r => {
      setForm(f => ({ ...f, ...r.data }));
    }).catch(err => {
      console.error('Failed to load settings:', err);
    }).finally(() => setLoading(false));

    axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

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
      const msg = err.response?.data?.error || err.message || 'Save failed';
      setSaveErr(msg);
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

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      setUserMsg({ ok: false, text: 'Username and password are required.' });
      return;
    }
    setCreatingUser(true);
    setUserMsg(null);
    try {
      const { data } = await axios.post('/api/users', newUser);
      setUsers(u => [...u, data]);
      setNewUser({ username: '', password: '', role: 'technician' });
      setUserMsg({ ok: true, text: `User "${data.username}" created.` });
    } catch (err) {
      setUserMsg({ ok: false, text: err.response?.data?.error || 'Failed to create user.' });
    } finally {
      setCreatingUser(false);
    }
  };

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    try {
      await axios.delete(`/api/users/${id}`);
      setUsers(u => u.filter(x => x.id !== id));
    } catch {
      alert('Failed to delete user.');
    }
  };

  if (loading) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

  return (
    <>
      <div className="page-header">
        <h2>Settings</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saveErr && (
            <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 500 }}>✗ {saveErr}</span>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '⏳ Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="two-col" style={{ alignItems: 'start' }}>

          {/* Company Info */}
          <div>
            <div className="card mb-4">
              <div className="card-header"><h3>Your Company Info</h3></div>
              <div className="card-body">
                <p className="text-muted text-sm mb-4">This appears on all proposal PDFs.</p>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-control" value={form.company_name} onChange={f('company_name')} placeholder="Acme HVAC & Plumbing" />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={form.company_phone} onChange={f('company_phone')} placeholder="(720) 555-0000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" type="email" value={form.company_email} onChange={f('company_email')} placeholder="service@yourcompany.com" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Street Address</label>
                  <input className="form-control" value={form.company_address} onChange={f('company_address')} placeholder="123 Industrial Blvd" />
                </div>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-control" value={form.company_city} onChange={f('company_city')} placeholder="Denver" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input className="form-control" value={form.company_state} onChange={f('company_state')} placeholder="CO" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ZIP</label>
                    <input className="form-control" value={form.company_zip} onChange={f('company_zip')} placeholder="80202" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contractor License #</label>
                  <input className="form-control" value={form.company_license} onChange={f('company_license')} placeholder="ME-00123 / PC-00456" />
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="card mb-4">
              <div className="card-header"><h3>Company Logo</h3></div>
              <div className="card-body">
                <p className="text-muted text-sm mb-4">Appears in the top-right corner of all proposal PDFs. PNG or JPG, under 2 MB recommended.</p>
                {form.company_logo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                    <img src={form.company_logo} alt="Company logo" style={{ maxHeight: 80, maxWidth: 200, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', padding: 4, objectFit: 'contain' }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 6 }}>Logo uploaded ✓</div>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setForm(p => ({ ...p, company_logo: '' }))}
                        style={{ fontSize: 12 }}
                      >
                        Remove Logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '2px dashed #d1d5db', borderRadius: 8, padding: '24px 16px', textAlign: 'center', marginBottom: 12, background: '#f9fafb' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>No logo uploaded yet</div>
                  </div>
                )}
                <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  <span className="btn btn-secondary" style={{ fontSize: 13 }}>
                    {form.company_logo ? '🔄 Replace Logo' : '⬆ Upload Logo'}
                  </span>
                </label>
                <p className="text-muted text-sm mt-2">Click "Save Settings" after uploading to apply.</p>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="card mb-4">
              <div className="card-header"><h3>PDF Header Preview</h3></div>
              <div className="card-body">
                <div style={{ background: '#1E40AF', color: 'white', borderRadius: 6, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>SERVICE PROPOSAL</div>
                    <div style={{ fontSize: 11, opacity: .8, marginTop: 4 }}>Commercial HVAC & Plumbing Services</div>
                    <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>
                      {form.company_name || 'Your Company Name'} | {form.company_phone || '(555) 000-0000'} | {form.company_email || 'info@yourcompany.com'}
                    </div>
                  </div>
                  {form.company_logo && (
                    <img src={form.company_logo} alt="Logo" style={{ maxHeight: 56, maxWidth: 100, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.15)', padding: 4 }} />
                  )}
                </div>
                <p className="text-muted text-sm mt-2">This is how your company info appears at the top of every proposal PDF.</p>
              </div>
            </div>

            {/* User Management */}
            <div className="card">
              <div className="card-header"><h3>User Management</h3></div>
              <div className="card-body">
                {users.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {users.map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 12, background: u.role === 'admin' ? '#dbeafe' : '#f3f4f6', color: u.role === 'admin' ? '#1d4ed8' : '#374151' }}>
                            {u.role}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteUser(u.id, u.username)}
                          style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--gray-700)' }}>Add User</div>
                <div className="form-group">
                  <input
                    className="form-control"
                    placeholder="Username"
                    value={newUser.username}
                    onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <input
                    className="form-control"
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <select
                    className="form-control"
                    value={newUser.role}
                    onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                  >
                    <option value="technician">Technician</option>
                    <option value="admin">Admin</option>
                    <option value="demo">Demo (read-only)</option>
                  </select>
                </div>
                {userMsg && (
                  <div style={{ marginBottom: 10, padding: '7px 12px', borderRadius: 6, fontSize: 13, background: userMsg.ok ? 'var(--green-50)' : '#fef2f2', color: userMsg.ok ? 'var(--green-700)' : '#b91c1c' }}>
                    {userMsg.ok ? '✓ ' : '✗ '}{userMsg.text}
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  onClick={createUser}
                  disabled={creatingUser}
                  style={{ width: '100%' }}
                >
                  {creatingUser ? '⏳ Creating…' : '+ Create User'}
                </button>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div>
            <div className="card mb-4">
              <div className="card-header"><h3>Proposal Defaults</h3></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Default Tax Rate (%)</label>
                  <input className="form-control" type="number" step="0.1" min="0" max="30"
                    value={form.tax_rate_default} onChange={f('tax_rate_default')} placeholder="0" />
                  <p className="text-muted text-sm mt-1">Applied automatically when creating new proposals. Set 0 if you don't charge tax.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Terms & Conditions</label>
                  <textarea className="form-control" rows={5}
                    value={form.proposal_terms} onChange={f('proposal_terms')}
                    placeholder="Payment terms, warranty info, scope limitations..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposal Footer Message</label>
                  <input className="form-control"
                    value={form.proposal_footer} onChange={f('proposal_footer')}
                    placeholder="Thank you for the opportunity to earn your business." />
                  <p className="text-muted text-sm mt-1">Printed at the bottom of every proposal.</p>
                </div>
              </div>
            </div>

            {/* Salesforce Import */}
            <SalesforceImport />

            {/* Data Backup */}
            <div className="card mb-4">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>💾</span>
                <h3 style={{ margin: 0 }}>Backup Your Data</h3>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 14, lineHeight: 1.6 }}>
                  Download a full backup of all your companies, contacts, proposals, jobs, and pipeline deals as a JSON file.
                </p>
                <a
                  href="/api/settings/backup"
                  download
                  className="btn btn-secondary"
                  style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}
                >
                  ⬇ Download Backup
                </a>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header"><h3>Sample Data</h3></div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12, lineHeight: 1.6 }}>
                  Load a full set of demo companies, contacts, proposals, jobs, and pipeline deals so you can explore every feature. <strong>This replaces any existing data.</strong>
                </p>
                {seedMsg && (
                  <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500, background: seedMsg.ok ? 'var(--green-50)' : '#fef2f2', color: seedMsg.ok ? 'var(--green-700)' : '#b91c1c' }}>
                    {seedMsg.ok ? '✓ ' : '✗ '}{seedMsg.text}
                  </div>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={loadSampleData}
                  disabled={seeding}
                  style={{ width: '100%' }}
                >
                  {seeding ? '⏳ Loading...' : '🌱 Load Sample Data'}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>About This CRM</h3></div>
              <div className="card-body">
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  <div className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span className="text-muted">Version</span><span>3.0</span>
                  </div>
                  <div className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span className="text-muted">Backend</span><span>Node.js + Express + PostgreSQL</span>
                  </div>
                  <div className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span className="text-muted">Frontend</span><span>React 18 + Vite</span>
                  </div>
                  <div className="flex justify-between" style={{ padding: '4px 0' }}>
                    <span className="text-muted">Database</span><span>PostgreSQL (Render)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
