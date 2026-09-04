import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const CONTRACT_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'maintenance_contract', label: 'Maintenance Contract' },
  { value: 'on_call', label: 'On-Call / T&M' },
  { value: 'inactive', label: 'Inactive' },
];
const PROPERTY_OPTIONS = [
  'commercial office', 'warehouse', 'retail', 'restaurant', 'hotel',
  'hospital / medical', 'industrial', 'multi-family', 'government', 'school / university', 'other'
];
const CONTRACT_COLORS = {
  maintenance_contract: 'badge-green',
  on_call: 'badge-blue',
  prospect: 'badge-yellow',
  inactive: 'badge-gray',
};

const EMPTY = {
  name: '', address: '', city: '', state: 'CO', zip: '',
  phone: '', website: '', property_type: 'commercial office',
  contract_type: 'prospect', num_hvac_units: '', num_plumbing_fixtures: '',
  annual_revenue: '', notes: ''
};

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (filter) params.contract_type = filter;
    axios.get('/api/companies', { params }).then(r => setCompanies(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, filter]);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (c) => {
    setForm({ ...c, num_hvac_units: c.num_hvac_units || '', num_plumbing_fixtures: c.num_plumbing_fixtures || '', annual_revenue: c.annual_revenue || '' });
    setEditId(c.id); setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { alert('Company name is required'); return; }
    if (editId) await axios.put(`/api/companies/${editId}`, form);
    else await axios.post('/api/companies', form);
    setShowModal(false);
    load();
  };

  const del = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await axios.delete(`/api/companies/${id}`);
    load();
  };

  const f = (k) => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const filtered = companies.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h2>Companies</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Company</button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="toolbar">
            <input
              className="search-input"
              placeholder="Search companies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="form-control" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All Contract Types</option>
              {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="text-muted text-sm">{filtered.length} account{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🏢</div>
              <p>No companies yet.</p>
              <button className="btn btn-primary mt-2" onClick={openAdd}>Add Your First Company</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="table-wrap hide-on-mobile">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Location</th>
                      <th>Property Type</th>
                      <th>Contract</th>
                      <th>Contacts</th>
                      <th>Proposals</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/companies/${c.id}`} className="link-style font-bold">{c.name}</Link>
                          {c.phone && <div className="text-sm text-muted">{c.phone}</div>}
                        </td>
                        <td className="text-muted">{[c.city, c.state].filter(Boolean).join(', ')}</td>
                        <td className="text-muted" style={{ textTransform: 'capitalize' }}>{c.property_type}</td>
                        <td><span className={`badge ${CONTRACT_COLORS[c.contract_type] || 'badge-gray'}`}>{(c.contract_type || '').replace(/_/g, ' ')}</span></td>
                        <td className="text-muted">{c.contact_count}</td>
                        <td className="text-muted">{c.proposal_count}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => del(c.id, c.name)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="mobile-card-list show-on-mobile">
                {filtered.map(c => (
                  <div key={c.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link to={`/companies/${c.id}`} style={{ fontWeight: 700, fontSize: 16, color: 'var(--blue-600)', textDecoration: 'none' }}>
                          {c.name}
                        </Link>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                          <span className={`badge ${CONTRACT_COLORS[c.contract_type] || 'badge-gray'}`}>
                            {(c.contract_type || '').replace(/_/g, ' ')}
                          </span>
                          {c.property_type && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.property_type}</span>
                          )}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {(c.city || c.state) && <span>📍 {[c.city, c.state].filter(Boolean).join(', ')}</span>}
                          {c.phone && <span>📞 {c.phone}</span>}
                          {c.contact_count > 0 && <span>👤 {c.contact_count} contact{c.contact_count !== 1 ? 's' : ''}</span>}
                          {c.proposal_count > 0 && <span>📄 {c.proposal_count} proposal{c.proposal_count !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <Link to={`/companies/${c.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>View</Link>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(c.id, c.name)} style={{ justifyContent: 'center' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{editId ? 'Edit Company' : 'Add Company'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className="form-control" value={form.name} onChange={f('name')} placeholder="Acme Building Services" />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={f('phone')} placeholder="(720) 555-0000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Website</label>
                  <input className="form-control" value={form.website} onChange={f('website')} placeholder="www.example.com" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Street Address</label>
                <input className="form-control" value={form.address} onChange={f('address')} placeholder="123 Main St" />
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-control" value={form.city} onChange={f('city')} placeholder="Denver" />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input className="form-control" value={form.state} onChange={f('state')} />
                </div>
                <div className="form-group">
                  <label className="form-label">ZIP</label>
                  <input className="form-control" value={form.zip} onChange={f('zip')} placeholder="80202" />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Property Type</label>
                  <select className="form-control" value={form.property_type} onChange={f('property_type')}>
                    {PROPERTY_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Contract Type</label>
                  <select className="form-control" value={form.contract_type} onChange={f('contract_type')}>
                    {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">HVAC Units</label>
                  <input className="form-control" type="number" value={form.num_hvac_units} onChange={f('num_hvac_units')} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Plumbing Fixtures</label>
                  <input className="form-control" type="number" value={form.num_plumbing_fixtures} onChange={f('num_plumbing_fixtures')} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Est. Annual Revenue</label>
                  <input className="form-control" type="number" value={form.annual_revenue} onChange={f('annual_revenue')} placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={f('notes')} placeholder="Equipment details, service history, access info..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editId ? 'Save Changes' : 'Add Company'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
