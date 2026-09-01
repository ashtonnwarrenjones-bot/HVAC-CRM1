import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Search, Plus, X, Tag } from 'lucide-react';

const STATUS_COLORS = {
  draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green', declined: 'badge-red',
};
const SERVICE_TYPES = [
  'Preventive Maintenance', 'Emergency Repair', 'HVAC Replacement', 'Plumbing Repair',
  'Plumbing Installation', 'Duct Cleaning', 'Refrigerant Service', 'Boiler Service',
  'Chiller Service', 'Controls / BAS', 'New Installation', 'Other'
];

const EMPTY_FORM = {
  company_id: '', contact_id: '', title: '', service_type: 'Preventive Maintenance',
  tax_rate: '0', valid_days: '30', notes: '', terms: 'Payment due net 30 days. Price valid for 30 days from proposal date.'
};

const EMPTY_ITEM = { description: '', quantity: '1', unit: 'ea', unit_price: '0' };

// ─── Pricebook Picker ─────────────────────────────────────────────────────────
function PricebookPicker({ onAdd, onClose }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState({});          // track which item ids were just added

  useEffect(() => {
    axios.get('/api/pricebook', { params: { is_active: true } })
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [i.name, i.category, i.description].some(v => v && v.toLowerCase().includes(q));
  });

  // group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleAdd = (item) => {
    onAdd({
      description: item.name + (item.description ? ` — ${item.description}` : ''),
      quantity: '1',
      unit: item.unit || 'ea',
      unit_price: String(item.unit_price || 0),
    });
    setAdded(prev => ({ ...prev, [item.id]: true }));
    // reset checkmark after 1.5s
    setTimeout(() => setAdded(prev => { const n = { ...prev }; delete n[item.id]; return n; }), 1500);
  };

  const fmtPrice = (n) => n != null ? '$' + parseFloat(n).toFixed(2) : '—';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, width: '92vw', maxWidth: 700,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <BookOpen size={18} color="var(--blue-600)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
            Browse Pricebook
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              autoFocus
              className="form-control"
              style={{ paddingLeft: 32 }}
              placeholder="Search services…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
            Click any service to add it as a line item. You can add multiple.
          </div>
        </div>

        {/* Items */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px 20px' }}>
          {loading ? (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 24 }}>Loading pricebook…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 24 }}>
              {search ? 'No services match your search.' : 'No active services in pricebook.'}
            </p>
          ) : (
            Object.entries(grouped).map(([cat, catItems]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <Tag size={12} color="var(--blue-600)" />
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{cat}</span>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>({catItems.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {catItems.map(item => {
                    const wasAdded = added[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleAdd(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${wasAdded ? 'var(--green-500)' : 'var(--border)'}`,
                          background: wasAdded ? 'var(--green-50, #f0fdf4)' : 'var(--bg-page)',
                          transition: 'all .15s',
                        }}
                        onMouseEnter={e => { if (!wasAdded) e.currentTarget.style.background = 'var(--gray-50)'; e.currentTarget.style.borderColor = 'var(--blue-300)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = wasAdded ? 'var(--green-50, #f0fdf4)' : 'var(--bg-page)'; e.currentTarget.style.borderColor = wasAdded ? 'var(--green-500)' : 'var(--border)'; }}
                      >
                        {/* Add / check icon */}
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: wasAdded ? 'var(--green-500)' : 'var(--blue-100)',
                          color: wasAdded ? 'white' : 'var(--blue-600)',
                          fontSize: 14, fontWeight: 700, transition: 'all .2s',
                        }}>
                          {wasAdded ? '✓' : <Plus size={14} />}
                        </div>

                        {/* Name + description */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{item.name}</div>
                          {item.description && (
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                          )}
                        </div>

                        {/* Price + unit */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--green-700)' }}>{fmtPrice(item.unit_price)}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>per {item.unit || 'ea'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Proposals Page ──────────────────────────────────────────────────────
export default function Proposals() {
  const [proposals, setProposals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPricebook, setShowPricebook] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lineItems, setLineItems] = useState([{ ...EMPTY_ITEM }]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();

  const load = () => axios.get('/api/proposals').then(r => setProposals(r.data));
  useEffect(() => {
    load();
    axios.get('/api/companies').then(r => setCompanies(r.data));
  }, []);

  // Auto-open edit modal if navigated from ProposalDetail with editId
  useEffect(() => {
    if (location.state?.editId) {
      axios.get(`/api/proposals/${location.state.editId}`).then(async ({ data }) => {
        setForm({
          company_id: String(data.company_id || ''),
          contact_id: String(data.contact_id || ''),
          title: data.title || '',
          service_type: data.service_type || 'Preventive Maintenance',
          tax_rate: String(data.tax_rate || '0'),
          valid_days: String(data.valid_days || '30'),
          notes: data.notes || '',
          terms: data.terms || EMPTY_FORM.terms,
        });
        if (data.company_id) {
          const cr = await axios.get('/api/contacts', { params: { company_id: data.company_id } });
          setContacts(cr.data);
        }
        const items2 = data.line_items?.length > 0 ? data.line_items : [{ ...EMPTY_ITEM }];
        setLineItems(items2.map(i => ({
          description: i.description || '',
          quantity: String(i.quantity || 1),
          unit: i.unit || 'ea',
          unit_price: String(i.unit_price || 0),
        })));
        setEditId(location.state.editId);
        setShowModal(true);
        navigate('/proposals', { replace: true, state: {} });
      });
    }
  }, [location.state]);

  // Load contacts when company changes
  useEffect(() => {
    if (form.company_id) {
      axios.get('/api/contacts', { params: { company_id: form.company_id } })
        .then(r => setContacts(r.data));
    } else {
      setContacts([]);
    }
  }, [form.company_id]);

  const f = (k) => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const updateItem = (idx, key, val) => {
    setLineItems(items => {
      const updated = [...items];
      updated[idx] = { ...updated[idx], [key]: val };
      const q = parseFloat(updated[idx].quantity) || 0;
      const p = parseFloat(updated[idx].unit_price) || 0;
      updated[idx].total = q * p;
      return updated;
    });
  };
  const addItem = () => setLineItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setLineItems(p => p.filter((_, i) => i !== idx));

  // Add a pricebook item as a line item
  const addPricebookItem = (item) => {
    // If last line is empty, replace it; otherwise append
    setLineItems(prev => {
      const last = prev[prev.length - 1];
      const lastEmpty = !last.description && !parseFloat(last.unit_price);
      if (lastEmpty) {
        const updated = [...prev];
        updated[updated.length - 1] = item;
        return updated;
      }
      return [...prev, item];
    });
  };

  const subtotal = lineItems.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0);
  const taxAmt = subtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const total = subtotal + taxAmt;
  const fmt = (n) => '$' + parseFloat(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await axios.post('/api/proposals/parse-excel', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.line_items?.length > 0) {
        setLineItems(data.line_items.map(i => ({
          description: i.description,
          quantity: String(i.quantity),
          unit: i.unit || 'ea',
          unit_price: String(i.unit_price),
          total: i.total_price
        })));
        alert(`✅ Imported ${data.line_items.length} line items from "${data.sheet_name}"`);
      } else {
        alert('No line items found. Make sure your Excel has a "Description" column.');
      }
    } catch (err) {
      alert('Error reading file: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const openEdit = async (p) => {
    const { data } = await axios.get(`/api/proposals/${p.id}`);
    setForm({
      company_id: String(data.company_id || ''),
      contact_id: String(data.contact_id || ''),
      title: data.title || '',
      service_type: data.service_type || 'Preventive Maintenance',
      tax_rate: String(data.tax_rate || '0'),
      valid_days: String(data.valid_days || '30'),
      notes: data.notes || '',
      terms: data.terms || EMPTY_FORM.terms,
    });
    if (data.company_id) {
      const cr = await axios.get('/api/contacts', { params: { company_id: data.company_id } });
      setContacts(cr.data);
    }
    const items = data.line_items?.length > 0 ? data.line_items : [{ ...EMPTY_ITEM }];
    setLineItems(items.map(i => ({
      description: i.description || '',
      quantity: String(i.quantity || 1),
      unit: i.unit || 'ea',
      unit_price: String(i.unit_price || 0),
    })));
    setEditId(p.id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) { alert('Proposal title is required'); return; }
    const payload = {
      ...form,
      line_items: lineItems.map(i => ({
        description: i.description || '(no description)',
        quantity: parseFloat(i.quantity) || 1,
        unit: i.unit || 'ea',
        unit_price: parseFloat(i.unit_price) || 0
      })).filter(i => i.description !== '(no description)' || i.unit_price > 0)
    };
    if (editId) {
      await axios.put(`/api/proposals/${editId}`, payload);
      setShowModal(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      setLineItems([{ ...EMPTY_ITEM }]);
      load();
    } else {
      const { data } = await axios.post('/api/proposals', payload);
      setShowModal(false);
      setForm(EMPTY_FORM);
      setLineItems([{ ...EMPTY_ITEM }]);
      navigate(`/proposals/${data.id}`);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this proposal?')) return;
    await axios.delete(`/api/proposals/${id}`);
    load();
  };

  return (
    <>
      <div className="page-header">
        <h2>Proposals</h2>
        <button className="btn btn-primary" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setLineItems([{ ...EMPTY_ITEM }]); setShowModal(true); }}>
          + New Proposal
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="toolbar">
            <span className="text-muted text-sm">{proposals.length} proposal{proposals.length !== 1 ? 's' : ''}</span>
            <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>
              Pipeline: {fmt(proposals.filter(p => ['draft','sent'].includes(p.status)).reduce((s, p) => s + (p.total_amount || 0), 0))}
            </span>
          </div>
          <div className="table-wrap">
            {proposals.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📋</div>
                <p>No proposals yet.</p>
                <button className="btn btn-primary mt-2" onClick={() => setShowModal(true)}>Create First Proposal</button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Proposal #</th>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Service Type</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map(p => (
                    <tr key={p.id}>
                      <td className="text-muted text-sm">{p.proposal_number}</td>
                      <td><Link to={`/proposals/${p.id}`} className="link-style font-bold">{p.title}</Link></td>
                      <td>{p.company_name ? <Link to={`/companies/${p.company_id}`} className="link-style">{p.company_name}</Link> : '—'}</td>
                      <td className="text-muted">{p.first_name ? `${p.first_name} ${p.last_name}` : '—'}</td>
                      <td className="text-muted">{p.service_type || '—'}</td>
                      <td className="font-bold">{fmt(p.total_amount)}</td>
                      <td><span className={`badge ${STATUS_COLORS[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                      <td className="text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link to={`/proposals/${p.id}`} className="btn btn-secondary btn-sm">View</Link>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                          <a href={`/api/proposals/${p.id}/pdf`} className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer">PDF</a>
                          <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Pricebook picker (rendered on top of proposal modal) */}
      {showPricebook && (
        <PricebookPicker
          onAdd={addPricebookItem}
          onClose={() => setShowPricebook(false)}
        />
      )}

      {/* New / Edit Proposal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <h3>{editId ? 'Edit Proposal' : 'New Proposal'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Proposal Info */}
              <div className="section-title">Proposal Details</div>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-control" value={form.title} onChange={f('title')} placeholder="e.g. Annual PM Contract — Rooftop Units" />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <select className="form-control" value={form.company_id} onChange={f('company_id')}>
                    <option value="">— Select Company —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact</label>
                  <select className="form-control" value={form.contact_id} onChange={f('contact_id')} disabled={!form.company_id}>
                    <option value="">— Select Contact —</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Service Type</label>
                  <select className="form-control" value={form.service_type} onChange={f('service_type')}>
                    {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tax Rate (%)</label>
                  <input className="form-control" type="number" step="0.1" value={form.tax_rate} onChange={f('tax_rate')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valid (days)</label>
                  <input className="form-control" type="number" value={form.valid_days} onChange={f('valid_days')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Proposal Notes (printed on proposal)</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} placeholder="Scope summary, exclusions, special conditions..." />
              </div>

              {/* Excel Upload */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
                <div className="section-title" style={{ margin: 0 }}>Line Items</div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--blue-600)', borderColor: 'var(--blue-300)' }}
                  onClick={() => setShowPricebook(true)}
                  type="button"
                >
                  <BookOpen size={14} />
                  Browse Pricebook
                </button>
              </div>

              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                style={{ marginBottom: 12 }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize: 28 }}>📊</div>
                <p><strong>Upload Excel to auto-fill line items</strong></p>
                <p>Drop an .xlsx / .xls / .csv file here, or click to browse</p>
                <p>Columns: Description, Quantity, Unit, Unit Price</p>
                {uploading && <p style={{ color: 'var(--blue-700)', marginTop: 8 }}>⏳ Parsing file...</p>}
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={e => handleFileUpload(e.target.files[0])} />
              </div>

              {/* Line items table */}
              <div className="table-wrap" style={{ border: '1px solid var(--gray-200)', borderRadius: 6 }}>
                <table className="line-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Description</th>
                      <th style={{ width: '10%' }}>Qty</th>
                      <th style={{ width: '10%' }}>Unit</th>
                      <th style={{ width: '15%' }}>Unit Price</th>
                      <th style={{ width: '15%' }}>Total</th>
                      <th style={{ width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const rowTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                      return (
                        <tr key={idx}>
                          <td><input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Service / material description" /></td>
                          <td><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                          <td><input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="ea" /></td>
                          <td><input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} /></td>
                          <td style={{ fontWeight: 600 }}>{fmt(rowTotal)}</td>
                          <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }} onClick={() => removeItem(idx)}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Line</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--blue-600)' }}
                    onClick={() => setShowPricebook(true)}
                    type="button"
                  >
                    <BookOpen size={13} /> Pricebook
                  </button>
                </div>
                <div className="totals-box" style={{ minWidth: 240 }}>
                  <div className="totals-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {parseFloat(form.tax_rate) > 0 && <div className="totals-row"><span>Tax ({form.tax_rate}%)</span><span>{fmt(taxAmt)}</span></div>}
                  <div className="totals-row total"><span>Total</span><span className="amount">{fmt(total)}</span></div>
                </div>
              </div>

              <div className="form-group mt-4">
                <label className="form-label">Terms & Conditions</label>
                <textarea className="form-control" rows={2} value={form.terms} onChange={f('terms')} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditId(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editId ? 'Save Changes' : 'Create Proposal'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
