import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Wrench, Plus, Edit2, Trash2, Search, AlertTriangle } from 'lucide-react';

const CONDITION_BADGE = {
  good:      { cls: 'badge-green',  label: 'Good' },
  fair:      { cls: 'badge-yellow', label: 'Fair' },
  poor:      { cls: 'badge-red',    label: 'Poor' },
  new:       { cls: 'badge-blue',   label: 'New'  },
  replaced:  { cls: 'badge-gray',   label: 'Replaced' },
};

const EMPTY = {
  company_id: '', unit_type: '', make: '', model: '', serial_number: '',
  install_date: '', last_service_date: '', warranty_expiry: '',
  location_notes: '', condition: 'good', notes: '',
};

function warrantyStatus(expiry) {
  if (!expiry) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const exp = new Date(expiry + 'T00:00:00');
  const diff = Math.round((exp - today) / 86400000);
  if (diff < 0)   return { label: 'Expired',    cls: 'badge-red'    };
  if (diff <= 90) return { label: `${diff}d left`, cls: 'badge-yellow' };
  return { label: 'Active', cls: 'badge-green' };
}

export default function Equipment() {
  const [items, setItems]           = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [filter, setFilter]         = useState('');
  const [coFilter, setCoFilter]     = useState('');
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  const load = () => {
    const params = coFilter ? { company_id: coFilter } : {};
    axios.get('/api/equipment', { params })
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    axios.get('/api/companies').then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [coFilter]);

  const openNew = () => {
    setForm({ ...EMPTY, company_id: coFilter || '' });
    setEditId(null);
    setErr('');
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      company_id:       item.company_id || '',
      unit_type:        item.unit_type || '',
      make:             item.make || '',
      model:            item.model || '',
      serial_number:    item.serial_number || '',
      install_date:     item.install_date ? item.install_date.slice(0, 10) : '',
      last_service_date: item.last_service_date ? item.last_service_date.slice(0, 10) : '',
      warranty_expiry:  item.warranty_expiry ? item.warranty_expiry.slice(0, 10) : '',
      location_notes:   item.location_notes || '',
      condition:        item.condition || 'good',
      notes:            item.notes || '',
    });
    setEditId(item.id);
    setErr('');
    setShowModal(true);
  };

  const save = async () => {
    if (!form.company_id) { setErr('Please select a company.'); return; }
    setSaving(true); setErr('');
    try {
      if (editId) {
        await axios.put(`/api/equipment/${editId}`, form);
      } else {
        await axios.post('/api/equipment', form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, label) => {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    await axios.delete(`/api/equipment/${id}`);
    load();
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const visible = items.filter(i => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [i.unit_type, i.make, i.model, i.serial_number, i.company_name, i.location_notes]
      .some(v => v && v.toLowerCase().includes(q));
  });

  return (
    <>
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wrench size={20} /> Equipment & Assets
        </h2>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={15} /> Add Equipment
        </button>
      </div>

      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 30 }}
            placeholder="Search equipment…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select
          className="form-control"
          style={{ width: 200 }}
          value={coFilter}
          onChange={e => setCoFilter(e.target.value)}
        >
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 'auto' }}>
          {visible.length} item{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div className="empty-state"><p className="text-muted">Loading…</p></div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Wrench size={40} color="var(--gray-300)" /></div>
            <p>No equipment found.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNew}>
              <Plus size={15} /> Add First Unit
            </button>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Unit / Make / Model</th>
                    <th>Company</th>
                    <th>Serial #</th>
                    <th>Condition</th>
                    <th>Last Service</th>
                    <th>Warranty</th>
                    <th>Location</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(item => {
                    const wStatus = warrantyStatus(item.warranty_expiry);
                    const cond = CONDITION_BADGE[item.condition] || CONDITION_BADGE.good;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {[item.unit_type, item.make, item.model].filter(Boolean).join(' ') || '—'}
                          </div>
                          {item.notes && (
                            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{item.notes}</div>
                          )}
                        </td>
                        <td>{item.company_name || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.serial_number || '—'}</td>
                        <td><span className={`badge ${cond.cls}`}>{cond.label}</span></td>
                        <td style={{ fontSize: 12 }}>
                          {item.last_service_date ? new Date(item.last_service_date).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {wStatus ? (
                            <span className={`badge ${wStatus.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {wStatus.cls === 'badge-red' && <AlertTriangle size={10} />}
                              {wStatus.label}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.location_notes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => remove(item.id, [item.unit_type, item.make, item.model].filter(Boolean).join(' ') || 'this unit')}
                            >
                              <Trash2 size={13} />
                            </button>
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{editId ? 'Edit Equipment' : 'Add Equipment'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 13 }}>{err}</div>}

              <div className="form-group">
                <label className="form-label">Company *</label>
                <select className="form-control" value={form.company_id} onChange={f('company_id')}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Unit Type</label>
                  <input className="form-control" value={form.unit_type} onChange={f('unit_type')} placeholder="RTU, Split, Boiler…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input className="form-control" value={form.make} onChange={f('make')} placeholder="Carrier, Trane…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-control" value={form.model} onChange={f('model')} placeholder="48XC048-5" />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input className="form-control" value={form.serial_number} onChange={f('serial_number')} placeholder="SN-000000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <select className="form-control" value={form.condition} onChange={f('condition')}>
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
                  <input className="form-control" type="date" value={form.install_date} onChange={f('install_date')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Service</label>
                  <input className="form-control" type="date" value={form.last_service_date} onChange={f('last_service_date')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Warranty Expiry</label>
                  <input className="form-control" type="date" value={form.warranty_expiry} onChange={f('warranty_expiry')} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Location Notes</label>
                <input className="form-control" value={form.location_notes} onChange={f('location_notes')} placeholder="Rooftop unit 3, northeast corner…" />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={f('notes')} placeholder="Additional details, service history…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Add Equipment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
