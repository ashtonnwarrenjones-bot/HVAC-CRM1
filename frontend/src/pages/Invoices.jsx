import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Receipt, Plus, Edit2, Trash2, CheckCircle, Search, DollarSign } from 'lucide-react';

const STATUS_BADGE = {
  unpaid:    { cls: 'badge-yellow', label: 'Unpaid'    },
  paid:      { cls: 'badge-green',  label: 'Paid'      },
  overdue:   { cls: 'badge-red',    label: 'Overdue'   },
  cancelled: { cls: 'badge-gray',   label: 'Cancelled' },
};

const EMPTY = {
  company_id: '', job_id: '', proposal_id: '', title: '',
  invoice_number: '', amount: '', tax_amount: '', notes: '', due_date: '',
};

function fmt(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function isOverdue(inv) {
  if (inv.status !== 'unpaid' || !inv.due_date) return false;
  return new Date(inv.due_date + 'T00:00:00') < new Date();
}

export default function Invoices() {
  const [invoices, setInvoices]     = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [filter, setFilter]         = useState('');
  const [coFilter, setCoFilter]     = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  const load = () => {
    const params = {};
    if (coFilter) params.company_id = coFilter;
    if (statusFilter) params.status = statusFilter;
    axios.get('/api/invoices', { params })
      .then(r => setInvoices(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    axios.get('/api/companies').then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [coFilter, statusFilter]);

  const openNew = () => {
    setForm({ ...EMPTY, company_id: coFilter || '' });
    setEditId(null);
    setErr('');
    setShowModal(true);
  };

  const openEdit = (inv) => {
    setForm({
      company_id:     inv.company_id || '',
      job_id:         inv.job_id || '',
      proposal_id:    inv.proposal_id || '',
      title:          inv.title || '',
      invoice_number: inv.invoice_number || '',
      amount:         inv.amount != null ? String(inv.amount) : '',
      tax_amount:     inv.tax_amount != null ? String(inv.tax_amount) : '',
      notes:          inv.notes || '',
      due_date:       inv.due_date ? inv.due_date.slice(0, 10) : '',
    });
    setEditId(inv.id);
    setErr('');
    setShowModal(true);
  };

  const save = async () => {
    if (!form.company_id) { setErr('Please select a company.'); return; }
    if (!form.amount)     { setErr('Amount is required.'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        tax_amount: parseFloat(form.tax_amount) || 0,
      };
      if (editId) {
        await axios.put(`/api/invoices/${editId}`, payload);
      } else {
        await axios.post('/api/invoices', payload);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (inv) => {
    if (!window.confirm(`Mark ${inv.invoice_number} as paid?`)) return;
    await axios.patch(`/api/invoices/${inv.id}/pay`);
    load();
  };

  const remove = async (id, num) => {
    if (!window.confirm(`Delete invoice ${num}? This cannot be undone.`)) return;
    await axios.delete(`/api/invoices/${id}`);
    load();
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const visible = invoices.filter(inv => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [inv.invoice_number, inv.title, inv.company_name, inv.notes]
      .some(v => v && v.toLowerCase().includes(q));
  }).map(inv => ({ ...inv, _overdue: isOverdue(inv) }));

  // Totals
  const totals = visible.reduce((acc, inv) => {
    acc.all  += inv.total || 0;
    if (inv.status === 'paid') acc.paid += inv.total || 0;
    else acc.outstanding += inv.total || 0;
    return acc;
  }, { all: 0, paid: 0, outstanding: 0 });

  return (
    <>
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={20} /> Invoices
        </h2>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={15} /> New Invoice
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ padding: '16px 24px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total Invoiced',   value: fmt(totals.all),         color: 'var(--gray-900)' },
          { label: 'Collected',        value: fmt(totals.paid),        color: 'var(--green-600)' },
          { label: 'Outstanding',      value: fmt(totals.outstanding), color: '#d97706' },
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
          <input
            className="search-input"
            style={{ paddingLeft: 30 }}
            placeholder="Search invoices…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select className="form-control" style={{ width: 200 }} value={coFilter} onChange={e => setCoFilter(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-control" style={{ width: 140 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 'auto' }}>
          {visible.length} invoice{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div className="empty-state"><p className="text-muted">Loading…</p></div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Receipt size={40} color="var(--gray-300)" /></div>
            <p>No invoices found.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNew}>
              <Plus size={15} /> Create First Invoice
            </button>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Company</th>
                    <th>Title</th>
                    <th>Amount</th>
                    <th>Tax</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(inv => {
                    const statusKey = inv._overdue ? 'overdue' : (inv.status || 'unpaid');
                    const badge = STATUS_BADGE[statusKey] || STATUS_BADGE.unpaid;
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{inv.invoice_number}</td>
                        <td>{inv.company_name || '—'}</td>
                        <td>{inv.title || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(inv.amount)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--gray-500)', fontSize: 12 }}>{fmt(inv.tax_amount)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(inv.total)}</td>
                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                        <td style={{ fontSize: 12 }}>
                          {inv.due_date ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {inv.status !== 'paid' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => markPaid(inv)}
                                title="Mark paid"
                                style={{ color: 'var(--green-600)' }}
                              >
                                <CheckCircle size={13} />
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(inv)}>
                              <Edit2 size={13} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => remove(inv.id, inv.invoice_number)}>
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
          <div className="modal">
            <div className="modal-header">
              <h3>{editId ? 'Edit Invoice' : 'New Invoice'}</h3>
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

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Invoice # (auto if blank)</label>
                  <input className="form-control" value={form.invoice_number} onChange={f('invoice_number')} placeholder="INV-0001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={form.title} onChange={f('title')} placeholder="HVAC Service — Q4" />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Amount ($) *</label>
                  <input className="form-control" type="number" step="0.01" min="0" value={form.amount} onChange={f('amount')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tax ($)</label>
                  <input className="form-control" type="number" step="0.01" min="0" value={form.tax_amount} onChange={f('tax_amount')} placeholder="0.00" />
                </div>
              </div>

              {(form.amount || form.tax_amount) && (
                <div style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>Total: </span>
                  {fmt((parseFloat(form.amount) || 0) + (parseFloat(form.tax_amount) || 0))}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-control" type="date" value={form.due_date} onChange={f('due_date')} />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={f('notes')} placeholder="Payment instructions, reference numbers…" />
              </div>

              {editId && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status || 'unpaid'} onChange={f('status')}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Invoice' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
