import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, Plus, Edit2, Trash2, Search, DollarSign } from 'lucide-react';

const STATUS_BADGE = {
  active:    { cls: 'badge-green',  label: 'Active'    },
  paused:    { cls: 'badge-yellow', label: 'Paused'    },
  cancelled: { cls: 'badge-red',    label: 'Cancelled' },
  expired:   { cls: 'badge-gray',   label: 'Expired'   },
};
const PLAN_TYPES = ['monthly', 'quarterly', 'semi-annual', 'annual'];

const EMPTY = {
  company_id: '', contact_id: '', plan_name: '', plan_type: 'annual',
  price: '', status: 'active', start_date: '', next_service_date: '', notes: '',
};

function fmt(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function Memberships() {
  const [memberships, setMemberships] = useState([]);
  const [companies, setCompanies]     = useState([]);
  const [contacts, setContacts]       = useState([]);
  const [stats, setStats]             = useState({});
  const [filter, setFilter]           = useState('');
  const [coFilter, setCoFilter]       = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(EMPTY);
  const [editId, setEditId]           = useState(null);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');

  const load = async () => {
    const params = {};
    if (coFilter) params.company_id = coFilter;
    if (statusFilter) params.status = statusFilter;
    try {
      const [mRes, statsRes] = await Promise.all([
        axios.get('/api/memberships', { params }),
        axios.get('/api/memberships/meta/stats'),
      ]);
      setMemberships(mRes.data);
      setStats(statsRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    Promise.all([
      axios.get('/api/companies').then(r => setCompanies(r.data)).catch(() => {}),
      axios.get('/api/contacts').then(r => setContacts(r.data)).catch(() => {}),
    ]);
  }, []);

  useEffect(() => { load(); }, [coFilter, statusFilter]);

  const openNew = () => {
    setForm({ ...EMPTY, company_id: coFilter || '', start_date: new Date().toISOString().slice(0,10) });
    setEditId(null); setErr(''); setShowModal(true);
  };

  const openEdit = (m) => {
    setForm({
      company_id:       m.company_id || '',
      contact_id:       m.contact_id || '',
      plan_name:        m.plan_name || '',
      plan_type:        m.plan_type || 'annual',
      price:            m.price != null ? String(m.price) : '',
      status:           m.status || 'active',
      start_date:       m.start_date ? m.start_date.slice(0, 10) : '',
      next_service_date: m.next_service_date ? m.next_service_date.slice(0, 10) : '',
      notes:            m.notes || '',
    });
    setEditId(m.id); setErr(''); setShowModal(true);
  };

  const save = async () => {
    if (!form.company_id) { setErr('Company is required.'); return; }
    if (!form.plan_name)  { setErr('Plan name is required.'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { ...form, price: parseFloat(form.price) || 0 };
      if (editId) await axios.put(`/api/memberships/${editId}`, payload);
      else await axios.post('/api/memberships', payload);
      setShowModal(false); load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Cancel membership "${name}"? This cannot be undone.`)) return;
    await axios.delete(`/api/memberships/${id}`);
    load();
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const filteredContacts = form.company_id
    ? contacts.filter(c => String(c.company_id) === String(form.company_id))
    : contacts;

  const visible = memberships.filter(m => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [m.plan_name, m.company_name, m.contact_name, m.notes]
      .some(v => v && v.toLowerCase().includes(q));
  });

  return (
    <>
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} /> Memberships
        </h2>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Membership</button>
      </div>

      {/* Stats */}
      <div style={{ padding: '16px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Active Members',  value: stats.active || 0,             color: 'var(--green-600)' },
          { label: 'Cancelled',       value: stats.cancelled || 0,          color: 'var(--gray-500)'  },
          { label: 'Monthly Revenue', value: fmt(stats.mrr || 0),           color: 'var(--blue-600)'  },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="search-input" style={{ paddingLeft: 30 }} placeholder="Search memberships…" value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 200 }} value={coFilter} onChange={e => setCoFilter(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-control" style={{ width: 140 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 'auto' }}>{visible.length} membership{visible.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div className="empty-state"><p className="text-muted">Loading…</p></div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Shield size={40} color="var(--gray-300)" /></div>
            <p>No memberships found.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNew}><Plus size={15} /> Create First Membership</button>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>Next Service</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(m => {
                    const badge = STATUS_BADGE[m.status] || STATUS_BADGE.active;
                    const nextDue = m.next_service_date && new Date(m.next_service_date + 'T00:00:00') < new Date();
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.plan_name}</td>
                        <td>{m.company_name || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{m.contact_name || '—'}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue-600)', background: 'var(--blue-50)', padding: '2px 7px', borderRadius: 10, textTransform: 'capitalize' }}>
                            {m.plan_type}
                          </span>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(m.price)}</td>
                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                        <td style={{ fontSize: 12 }}>
                          {m.start_date ? new Date(m.start_date + 'T00:00:00').toLocaleDateString() : '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {m.next_service_date ? (
                            <span style={{ color: nextDue ? '#dc2626' : 'inherit', fontWeight: nextDue ? 700 : 400 }}>
                              {nextDue ? '⚠ ' : ''}{new Date(m.next_service_date + 'T00:00:00').toLocaleDateString()}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}><Edit2 size={13} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => remove(m.id, m.plan_name)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editId ? 'Edit Membership' : 'New Membership'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 13 }}>{err}</div>}

              <div className="form-group">
                <label className="form-label">Company *</label>
                <select className="form-control" value={form.company_id} onChange={e => { f('company_id')(e); setForm(p => ({ ...p, contact_id: '', company_id: e.target.value })); }}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {form.company_id && (
                <div className="form-group">
                  <label className="form-label">Primary Contact</label>
                  <select className="form-control" value={form.contact_id} onChange={f('contact_id')}>
                    <option value="">Select contact…</option>
                    {filteredContacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Plan Name *</label>
                  <input className="form-control" value={form.plan_name} onChange={f('plan_name')} placeholder="Comfort Club, Maintenance Plan…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Type</label>
                  <select className="form-control" value={form.plan_type} onChange={f('plan_type')}>
                    {PLAN_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Price ($)</label>
                  <input className="form-control" type="number" step="0.01" min="0" value={form.price} onChange={f('price')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={f('status')}>
                    {Object.entries(STATUS_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-control" type="date" value={form.start_date} onChange={f('start_date')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Service Date</label>
                  <input className="form-control" type="date" value={form.next_service_date} onChange={f('next_service_date')} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} placeholder="Plan details, inclusions…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Create Membership'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
