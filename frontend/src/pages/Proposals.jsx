import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

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

export default function Proposals() {
  const [proposals, setProposals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lineItems, setLineItems] = useState([{ ...EMPTY_ITEM }]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  const load = () => axios.get('/api/proposals').then(r => setProposals(r.data));
  useEffect(() => {
    load();
    axios.get('/api/companies').then(r => setCompanies(r.data));
  }, []);

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

  const save = async () => {
    if (!form.title.trim()) { alert('Proposal title is required'); return; }
    const payload = {
      ...form,
      line_items: lineItems.map(i => ({
        description: i.description,
        quantity: parseFloat(i.quantity) || 1,
        unit: i.unit || 'ea',
        unit_price: parseFloat(i.unit_price) || 0
      })).filter(i => i.description.trim())
    };
    const { data } = await axios.post('/api/proposals', payload);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setLineItems([{ ...EMPTY_ITEM }]);
    navigate(`/proposals/${data.id}`);
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
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setLineItems([{ ...EMPTY_ITEM }]); setShowModal(true); }}>
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

      {/* New Proposal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <h3>New Proposal</h3>
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
              <div className="section-title mt-4">Line Items</div>
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
                <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Line</button>
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
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Create Proposal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
