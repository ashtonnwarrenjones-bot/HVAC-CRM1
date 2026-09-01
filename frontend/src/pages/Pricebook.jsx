import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BookOpen, Plus, Edit2, Trash2, Search, Tag, ToggleLeft, ToggleRight } from 'lucide-react';

const EMPTY = {
  category: '', name: '', description: '', unit_price: '', unit: 'each', cost: '', is_active: true,
};

function fmt(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function margin(price, cost) {
  if (!price || !cost || cost <= 0) return null;
  return ((price - cost) / price * 100).toFixed(0) + '%';
}

export default function Pricebook() {
  const [items, setItems]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const load = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        axios.get('/api/pricebook', { params: catFilter ? { category: catFilter } : {} }),
        axios.get('/api/pricebook/meta/categories'),
      ]);
      setItems(itemsRes.data);
      setCategories(catsRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [catFilter]);

  const openNew = () => {
    setForm({ ...EMPTY, category: catFilter || '' });
    setEditId(null); setErr(''); setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      category: item.category || '',
      name: item.name || '',
      description: item.description || '',
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
      unit: item.unit || 'each',
      cost: item.cost != null ? String(item.cost) : '',
      is_active: item.is_active !== false,
    });
    setEditId(item.id); setErr(''); setShowModal(true);
  };

  const save = async () => {
    if (!form.name) { setErr('Name is required.'); return; }
    if (!form.unit_price) { setErr('Price is required.'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        unit_price: parseFloat(form.unit_price) || 0,
        cost: parseFloat(form.cost) || 0,
      };
      if (editId) await axios.put(`/api/pricebook/${editId}`, payload);
      else await axios.post('/api/pricebook', payload);
      setShowModal(false); load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await axios.delete(`/api/pricebook/${id}`);
    load();
  };

  const toggleActive = async (item) => {
    await axios.put(`/api/pricebook/${item.id}`, { ...item, is_active: !item.is_active });
    load();
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const visible = items.filter(i => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [i.name, i.category, i.description].some(v => v && v.toLowerCase().includes(q));
  });

  // Group by category
  const grouped = visible.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={20} /> Pricebook
        </h2>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add Service</button>
      </div>

      {/* Stats */}
      <div style={{ padding: '16px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total Services',  value: items.length },
          { label: 'Active',          value: items.filter(i => i.is_active !== false).length },
          { label: 'Categories',      value: categories.length },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input className="search-input" style={{ paddingLeft: 30 }} placeholder="Search services…" value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 'auto' }}>{visible.length} service{visible.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div className="empty-state"><p className="text-muted">Loading…</p></div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><BookOpen size={40} color="var(--gray-300)" /></div>
            <p>No services found.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNew}><Plus size={15} /> Add First Service</button>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Tag size={14} color="var(--blue-600)" />
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{cat}</span>
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>({catItems.length})</span>
              </div>
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Cost</th>
                        <th>Price</th>
                        <th>Margin</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map(item => (
                        <tr key={item.id} style={{ opacity: item.is_active === false ? 0.5 : 1 }}>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{item.description || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.unit}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--gray-500)' }}>{fmt(item.cost)}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--green-700)' }}>{fmt(item.unit_price)}</td>
                          <td style={{ fontSize: 12 }}>
                            {margin(item.unit_price, item.cost)
                              ? <span style={{ color: 'var(--green-600)', fontWeight: 600 }}>{margin(item.unit_price, item.cost)}</span>
                              : '—'}
                          </td>
                          <td>
                            <button onClick={() => toggleActive(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.is_active !== false ? 'var(--green-600)' : 'var(--gray-400)' }}>
                              {item.is_active !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}><Edit2 size={13} /></button>
                              <button className="btn btn-danger btn-sm" onClick={() => remove(item.id, item.name)}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editId ? 'Edit Service' : 'Add Service'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 13 }}>{err}</div>}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-control" value={form.category} onChange={f('category')} placeholder="HVAC, Plumbing, Electrical…" list="cat-list" />
                  <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-control" value={form.unit} onChange={f('unit')}>
                    {['each', 'hour', 'day', 'visit', 'lb', 'ton', 'ft', 'sq ft'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Service Name *</label>
                <input className="form-control" value={form.name} onChange={f('name')} placeholder="AC Tune-Up, Filter Replacement…" />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={f('description')} placeholder="What's included…" />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Your Cost ($)</label>
                  <input className="form-control" type="number" step="0.01" min="0" value={form.cost} onChange={f('cost')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sale Price ($) *</label>
                  <input className="form-control" type="number" step="0.01" min="0" value={form.unit_price} onChange={f('unit_price')} placeholder="0.00" />
                </div>
              </div>

              {form.unit_price && form.cost && (
                <div style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>Gross Margin: </span>
                  <span style={{ color: 'var(--green-600)', fontWeight: 700 }}>
                    {margin(parseFloat(form.unit_price), parseFloat(form.cost)) || '—'}
                  </span>
                  {' · Profit: '}
                  <span style={{ fontWeight: 600 }}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((parseFloat(form.unit_price) || 0) - (parseFloat(form.cost) || 0))}
                  </span>
                </div>
              )}

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                <label htmlFor="is_active" className="form-label" style={{ margin: 0 }}>Active (shows in service catalog)</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Add Service'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
