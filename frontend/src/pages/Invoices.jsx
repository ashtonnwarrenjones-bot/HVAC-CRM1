import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, RefreshCw, CheckCircle, AlertCircle, ExternalLink,
  X, Trash2, Edit2, DollarSign, Building2, FileText, ChevronDown, ChevronUp
} from 'lucide-react';

function fmt$(n) {
  return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ds) {
  if (!ds) return '—';
  try { return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ds; }
}

const STATUS_STYLES = {
  unpaid:   { bg: '#fef9c3', color: '#854d0e' },
  paid:     { bg: '#f0fdf4', color: '#166534' },
  overdue:  { bg: '#fef2f2', color: '#991b1b' },
  draft:    { bg: '#f1f5f9', color: '#475569' },
  voided:   { bg: '#f1f5f9', color: '#94a3b8' },
};

// ── Line Items Editor ─────────────────────────────────────────────────────────
function LineItemsEditor({ items, onChange }) {
  function update(i, field, val) {
    const next = items.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: val };
      updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
      return updated;
    });
    onChange(next);
  }
  function add() {
    onChange([...items, { description: '', quantity: 1, unit: 'each', unit_price: 0, total: 0 }]);
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  const lineTotal = items.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr auto', gap:4, marginBottom:4 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>Description</div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>Qty</div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>Unit Price</div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>Total</div>
        <div />
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr auto', gap:4, marginBottom:4 }}>
          <input className="form-control" style={{ fontSize:12 }} value={it.description} onChange={e => update(i, 'description', e.target.value)} placeholder="Description" />
          <input className="form-control" style={{ fontSize:12 }} type="number" min="0" step="0.01" value={it.quantity} onChange={e => update(i, 'quantity', e.target.value)} />
          <input className="form-control" style={{ fontSize:12 }} type="number" min="0" step="0.01" value={it.unit_price} onChange={e => update(i, 'unit_price', e.target.value)} placeholder="0.00" />
          <div style={{ display:'flex', alignItems:'center', fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{fmt$(it.total)}</div>
          <button className="btn btn-ghost" style={{ padding:'2px 6px' }} onClick={() => remove(i)}><X size={12}/></button>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
        <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px' }} onClick={add}><Plus size={11}/> Add Line</button>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>Subtotal: {fmt$(lineTotal)}</div>
      </div>
    </div>
  );
}

// ── Invoice Modal ─────────────────────────────────────────────────────────────
function InvoiceModal({ invoice, companies, onSave, onClose }) {
  const isEdit = !!invoice;
  const [form, setForm] = useState({
    company_id: invoice?.company_id || '',
    title: invoice?.title || 'Invoice',
    invoice_number: invoice?.invoice_number || '',
    amount: invoice?.amount || '',
    tax_amount: invoice?.tax_amount || '',
    due_date: invoice?.due_date || '',
    notes: invoice?.notes || '',
    status: invoice?.status || 'unpaid',
    sync_to_qb: false,
  });
  const [lineItems, setLineItems] = useState(invoice?.line_items || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // Compute totals from line items if present
  const lineSubtotal = lineItems.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
  const displayAmount = lineItems.length > 0 ? lineSubtotal : (parseFloat(form.amount) || 0);
  const displayTotal = displayAmount + (parseFloat(form.tax_amount) || 0);

  async function handleSave() {
    if (!form.company_id) return setErr('Company is required');
    setSaving(true);
    setErr('');
    try {
      const payload = {
        ...form,
        company_id: parseInt(form.company_id),
        amount: lineItems.length > 0 ? lineSubtotal : parseFloat(form.amount) || 0,
        tax_amount: parseFloat(form.tax_amount) || 0,
        line_items: lineItems.length > 0 ? lineItems : undefined,
        sync_to_qb: form.sync_to_qb,
      };
      let result;
      if (isEdit) {
        result = await axios.put(`/api/invoices/${invoice.id}`, payload);
      } else {
        result = await axios.post('/api/invoices', payload);
      }
      onSave(result.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3><FileText size={16}/> {isEdit ? 'Edit Invoice' : 'New Invoice'}</h3>
          <button className="btn btn-ghost" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ maxHeight:'75vh', overflowY:'auto' }}>
          {err && <div style={{ background:'#fef2f2', color:'#b91c1c', borderRadius:6, padding:'8px 12px', marginBottom:12, fontSize:13 }}>{err}</div>}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Company *</label>
              <select className="form-control" value={form.company_id} onChange={f('company_id')}>
                <option value="">Select company…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Invoice #</label>
              <input className="form-control" value={form.invoice_number} onChange={f('invoice_number')} placeholder="Auto-assigned" />
            </div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Title</label>
              <input className="form-control" value={form.title} onChange={f('title')} />
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Line Items</div>
            <LineItemsEditor items={lineItems} onChange={setLineItems} />
          </div>

          {/* Totals */}
          <div className="form-grid">
            {lineItems.length === 0 && (
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-control" type="number" step="0.01" value={form.amount} onChange={f('amount')} placeholder="0.00" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Tax</label>
              <input className="form-control" type="number" step="0.01" value={form.tax_amount} onChange={f('tax_amount')} placeholder="0.00" />
            </div>
            <div className="form-group" style={{ display:'flex', alignItems:'center', paddingTop:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Total: {fmt$(displayTotal)}</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="form-control" type="date" value={form.due_date} onChange={f('due_date')} />
            </div>
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={f('status')}>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="draft">Draft</option>
                  <option value="voided">Voided</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} />
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', color:'var(--text-primary)', marginTop:8 }}>
            <input type="checkbox" checked={form.sync_to_qb} onChange={e=>setForm(p=>({...p,sync_to_qb:e.target.checked}))} />
            Sync to QuickBooks after saving
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Invoices Component ───────────────────────────────────────────────────
export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editInv, setEditInv] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [confirm, setConfirm] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/invoices');
      setInvoices(r.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { axios.get('/api/companies').then(r => setCompanies(r.data)).catch(() => {}); }, []);

  // Summary stats
  const total = invoices.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const collected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'voided').reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const qbSynced = invoices.filter(i => i.qb_mapping_id).length;

  const filtered = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus);

  async function syncQB() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await axios.get('/api/invoices/qb-sync/status');
      setSyncResult(r.data);
      if (r.data.updates?.length > 0) fetchInvoices();
    } catch (e) {
      setSyncResult({ error: e.response?.data?.error || e.message });
    }
    setSyncing(false);
  }

  async function syncOneToQB(id) {
    try {
      await axios.post(`/api/invoices/${id}/sync-qb`);
      fetchInvoices();
    } catch (e) {
      alert('QB sync failed: ' + (e.response?.data?.error || e.message));
    }
  }

  async function markPaid(id) {
    await axios.patch(`/api/invoices/${id}/paid`);
    fetchInvoices();
  }

  async function deleteInv(id) {
    await axios.delete(`/api/invoices/${id}`);
    setConfirm(null);
    fetchInvoices();
  }

  async function loadLineItems(id) {
    if (expanded === id) return setExpanded(null);
    try {
      const r = await axios.get(`/api/invoices/${id}`);
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, line_items: r.data.line_items } : inv));
      setExpanded(id);
    } catch (_) { setExpanded(id); }
  }

  return (
    <div style={{ padding:'24px', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>Invoices</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text-muted)' }}>Create, track, and sync invoices with QuickBooks</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-secondary" onClick={syncQB} disabled={syncing} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing QB…' : 'Sync QuickBooks'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditInv(null); setModal('invoice'); }} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={15}/> New Invoice
          </button>
        </div>
      </div>

      {/* QB Sync Result */}
      {syncResult && (
        <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:8, background: syncResult.error ? '#fef2f2' : '#f0fdf4', border:`1px solid ${syncResult.error ? '#fca5a5' : '#bbf7d0'}` }}>
          {syncResult.error ? (
            <span style={{ color:'#b91c1c', fontSize:13 }}><AlertCircle size={14} style={{ marginRight:6 }}/>{syncResult.error}</span>
          ) : syncResult.connected === false ? (
            <span style={{ color:'#b45309', fontSize:13 }}>QuickBooks not connected. Set up QB integration in Settings.</span>
          ) : (
            <span style={{ color:'#166534', fontSize:13 }}>
              <CheckCircle size={14} style={{ marginRight:6 }}/>
              QB sync complete — {syncResult.updates?.length || 0} invoice(s) marked paid
            </span>
          )}
          <button className="btn btn-ghost" style={{ marginLeft:12, padding:'0 4px' }} onClick={() => setSyncResult(null)}><X size={14}/></button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Invoiced', value:fmt$(total), color:'var(--text-primary)' },
          { label:'Collected',       value:fmt$(collected), color:'#16a34a' },
          { label:'Outstanding',     value:fmt$(outstanding), color:'#b45309' },
          { label:'Synced to QB',    value:`${qbSynced} / ${invoices.length}`, color:'#2563eb' },
        ].map(card => (
          <div key={card.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{card.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {['all', 'unpaid', 'paid', 'overdue', 'draft'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize:12, padding:'5px 12px', textTransform:'capitalize' }}>
            {s === 'all' ? `All (${invoices.length})` : `${s} (${invoices.filter(i=>i.status===s).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        {/* Table header */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.6fr auto', padding:'8px 16px', background:'var(--bg-page)', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', gap:8 }}>
          <span>Invoice #</span><span>Client</span><span>Title</span><span>Amount</span><span>Tax</span><span>Total</span><span>Status</span><span>QB</span><span></span>
        </div>

        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>
            <FileText size={40} style={{ marginBottom:8, opacity:.3 }} />
            <p>No invoices yet.</p>
          </div>
        ) : filtered.map((inv, i) => {
          const ss = STATUS_STYLES[inv.status] || STATUS_STYLES.draft;
          const isExpanded = expanded === inv.id;
          const isOverdue = inv.status === 'unpaid' && inv.due_date && new Date(inv.due_date) < new Date();
          return (
            <React.Fragment key={inv.id}>
              <div
                style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.6fr auto', padding:'10px 16px', borderBottom: i < filtered.length-1 || isExpanded ? '1px solid var(--border)' : 'none', alignItems:'center', gap:8, cursor:'pointer', transition:'background .1s' }}
                onClick={() => loadLineItems(inv.id)}
              >
                <div style={{ fontSize:12, fontWeight:600, color:'var(--blue-600)' }}>{inv.invoice_number}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}>
                  <Building2 size={11}/> {inv.company_name || '—'}
                </div>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inv.title}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt$(inv.amount)}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt$(inv.tax_amount)}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{fmt$(inv.total)}</div>
                <div>
                  <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background: isOverdue ? '#fef2f2' : ss.bg, color: isOverdue ? '#991b1b' : ss.color }}>
                    {isOverdue ? 'overdue' : (inv.status || 'unpaid')}
                  </span>
                  {inv.due_date && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>Due {fmtDate(inv.due_date)}</div>}
                </div>
                <div>
                  {inv.qb_mapping_id ? (
                    <span title="Synced to QuickBooks" style={{ fontSize:10, background:'#eff6ff', color:'#2563eb', borderRadius:4, padding:'2px 5px', fontWeight:600 }}>QB✓</span>
                  ) : (
                    <button className="btn btn-ghost" style={{ fontSize:10, padding:'2px 6px' }}
                      title="Sync to QuickBooks"
                      onClick={e => { e.stopPropagation(); syncOneToQB(inv.id); }}>
                      QB↑
                    </button>
                  )}
                </div>
                <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
                  {inv.status !== 'paid' && (
                    <button className="btn btn-secondary btn-sm" title="Mark Paid" onClick={() => markPaid(inv.id)} style={{ padding:'3px 6px', fontSize:11 }}>
                      <CheckCircle size={12} color="#16a34a"/>
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => { setEditInv(inv); setModal('invoice'); }}>
                    <Edit2 size={12}/>
                  </button>
                  <button className="btn btn-danger btn-sm" title="Delete" onClick={() => setConfirm({ id:inv.id, number:inv.invoice_number })}>
                    <Trash2 size={12}/>
                  </button>
                  <span style={{ color:'var(--text-muted)', display:'flex', alignItems:'center' }}>
                    {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </span>
                </div>
              </div>

              {/* Line Items Expansion */}
              {isExpanded && (
                <div style={{ padding:'12px 24px 16px', background:'var(--bg-page)', borderBottom:'1px solid var(--border)' }}>
                  {inv.line_items?.length > 0 ? (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:6 }}>
                        <span>Description</span><span>Qty</span><span>Unit Price</span><span>Total</span>
                      </div>
                      {inv.line_items.map((li, j) => (
                        <div key={j} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', fontSize:12, padding:'4px 0', borderTop: j>0 ? '1px solid var(--border)' : 'none' }}>
                          <span>{li.description}</span>
                          <span>{li.quantity} {li.unit}</span>
                          <span>{fmt$(li.unit_price)}</span>
                          <span style={{ fontWeight:600 }}>{fmt$(li.total)}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>No line items — single-amount invoice</div>
                  )}
                  {inv.notes && <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>{inv.notes}</div>}
                  {inv.job_title && <div style={{ marginTop:6, fontSize:12, color:'var(--blue-600)' }}>Job: {inv.job_title}</div>}
                  {inv.estimate_number && <div style={{ fontSize:12, color:'var(--text-muted)' }}>Estimate: {inv.estimate_number}</div>}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Modals */}
      {modal === 'invoice' && (
        <InvoiceModal
          invoice={editInv}
          companies={companies}
          onSave={() => { setModal(null); setEditInv(null); fetchInvoices(); }}
          onClose={() => { setModal(null); setEditInv(null); }}
        />
      )}

      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg-card)', borderRadius:12, padding:24, maxWidth:340, width:'90%' }}>
            <p style={{ margin:'0 0 20px', fontSize:14, color:'var(--text-primary)' }}>Delete invoice {confirm.number}? This cannot be undone.</p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteInv(confirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
