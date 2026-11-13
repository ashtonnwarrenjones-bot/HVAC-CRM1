import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, FileText, CheckCircle, XCircle, Clock, Send, Hammer, Search, Trash2, Edit2, ArrowRight } from 'lucide-react';
import axios from 'axios';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  sent:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  converted: { label: 'Job Created', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

function fmt(n) { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function Estimates() {
  const [estimates, setEstimates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [pricebook, setPricebook] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('list'); // 'list' | 'builder'
  const [editing, setEditing] = useState(null); // null = new, id = editing

  // Builder form state
  const [form, setForm] = useState({
    company_id: '', property_id: '', title: '', notes: '', tax_rate: 0, valid_until: '', items: []
  });
  const [properties, setProperties] = useState([]);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (form.company_id) {
      axios.get(`/api/properties?company_id=${form.company_id}`).then(r => setProperties(r.data)).catch(() => setProperties([]));
    } else { setProperties([]); }
  }, [form.company_id]);

  async function load() {
    setLoading(true);
    try {
      const [eRes, cRes, pbRes] = await Promise.all([
        axios.get('/api/estimates'),
        axios.get('/api/companies'),
        axios.get('/api/pricebook'),
      ]);
      setEstimates(eRes.data);
      setCompanies(cRes.data);
      setPricebook(pbRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ company_id: '', property_id: '', title: '', notes: '', tax_rate: 0, valid_until: '', items: [] });
    setView('builder');
  }

  async function openEdit(id) {
    try {
      const r = await axios.get(`/api/estimates/${id}`);
      const e = r.data;
      setEditing(id);
      setForm({
        company_id: e.company_id || '',
        property_id: e.property_id || '',
        title: e.title,
        notes: e.notes || '',
        tax_rate: e.tax_rate || 0,
        valid_until: e.valid_until || '',
        status: e.status,
        items: (e.items || []).map(it => ({ ...it })),
      });
      setView('builder');
    } catch (e) { alert('Failed to load estimate'); }
  }

  async function saveEstimate() {
    try {
      const payload = { ...form };
      if (editing) {
        await axios.put(`/api/estimates/${editing}`, payload);
      } else {
        await axios.post('/api/estimates', payload);
      }
      setView('list');
      load();
    } catch (e) { alert(e.response?.data?.error || 'Save failed'); }
  }

  async function convertToJob(id) {
    if (!window.confirm('Convert this estimate to a job?')) return;
    try {
      await axios.post(`/api/estimates/${id}/convert`);
      load();
    } catch (e) { alert('Conversion failed'); }
  }

  async function updateStatus(id, status) {
    try {
      await axios.put(`/api/estimates/${id}`, { status });
      setEstimates(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    } catch (e) { alert('Update failed'); }
  }

  async function deleteEstimate(id) {
    if (!window.confirm('Delete this estimate?')) return;
    try { await axios.delete(`/api/estimates/${id}`); load(); } catch (e) { alert('Delete failed'); }
  }

  // ── Line item helpers ──
  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { description: '', category: '', quantity: 1, unit: 'each', unit_price: 0, total: 0 }] }));
  }

  function addFromPricebook(pb) {
    setForm(f => ({
      ...f,
      items: [...f.items, {
        pricebook_item_id: pb.id,
        description: pb.name,
        category: pb.category || '',
        quantity: 1,
        unit: pb.unit || 'each',
        unit_price: pb.unit_price || 0,
        total: pb.unit_price || 0,
      }]
    }));
  }

  function updateItem(idx, field, value) {
    setForm(f => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
        }
        return updated;
      });
      return { ...f, items };
    });
  }

  function removeItem(idx) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  const subtotal = form.items.reduce((s, it) => s + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)), 0);
  const taxAmt = subtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const total = subtotal + taxAmt;

  const filtered = estimates.filter(e => {
    const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase()) || e.company_name?.toLowerCase().includes(search.toLowerCase()) || e.estimate_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totals = { all: 0, draft: 0, sent: 0, approved: 0 };
  estimates.forEach(e => { totals.all += e.total || 0; if (totals[e.status] !== undefined) totals[e.status] += e.total || 0; });

  if (view === 'builder') return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView('list')} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          ← Estimates
        </button>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {editing ? 'Edit Estimate' : 'New Estimate'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header fields */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="e.g. Spring Lawn Maintenance" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Client</label>
                <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value, property_id: '' }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">Select client…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Property</label>
                <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  disabled={!form.company_id}>
                  <option value="">Select property…</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Valid Until</label>
                <input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tax Rate (%)</label>
                <input type="number" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  min="0" max="30" step="0.1" />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Line Items</h2>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 dark:text-green-400 font-medium">
                <Plus size={14} /> Add Line
              </button>
            </div>

            {form.items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No items yet — add from pricebook or manually</p>
            )}

            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <div className="col-span-4">
                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Description" />
                </div>
                <div className="col-span-2">
                  <input value={item.quantity} type="number" min="0" onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Qty" />
                </div>
                <div className="col-span-2">
                  <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Unit" />
                </div>
                <div className="col-span-2">
                  <input value={item.unit_price} type="number" min="0" onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Price" />
                </div>
                <div className="col-span-1 text-right text-xs text-gray-500 dark:text-gray-400">
                  {fmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                </div>
                <div className="col-span-1 text-right">
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}

            {form.items.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-3 space-y-1 text-sm text-right">
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {parseFloat(form.tax_rate) > 0 && <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Tax ({form.tax_rate}%)</span><span>{fmt(taxAmt)}</span></div>}
                <div className="flex justify-between font-semibold text-gray-900 dark:text-white text-base pt-1 border-t border-gray-200 dark:border-gray-700"><span>Total</span><span>{fmt(total)}</span></div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes / Scope of Work</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
              placeholder="Describe the scope of work, exclusions, terms…" />
          </div>

          <div className="flex gap-3">
            <button onClick={saveEstimate} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              {editing ? 'Save Changes' : 'Create Estimate'}
            </button>
            <button onClick={() => setView('list')} className="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>

        {/* Right: Pricebook quick-add */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add from Pricebook</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {pricebook.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No pricebook items</p>}
              {pricebook.map(pb => (
                <button key={pb.id} onClick={() => addFromPricebook(pb)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200 group-hover:text-green-600">{pb.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{fmt(pb.unit_price)}</span>
                  </div>
                  {pb.category && <span className="text-xs text-gray-400">{pb.category}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estimates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{estimates.length} estimates · {fmt(totals.all)} total value</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm">
          <Plus size={16} /> New Estimate
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Draft', key: 'draft', icon: FileText, color: 'text-gray-500' },
          { label: 'Sent', key: 'sent', icon: Send, color: 'text-blue-500' },
          { label: 'Approved', key: 'approved', icon: CheckCircle, color: 'text-green-500' },
          { label: 'Rejected', key: 'rejected', icon: XCircle, color: 'text-red-500' },
        ].map(s => {
          const count = estimates.filter(e => e.status === s.key).length;
          return (
            <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
              className={`bg-white dark:bg-gray-800 rounded-xl border p-4 text-left transition-all ${statusFilter === s.key ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={16} className={s.color} />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{s.label}</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Search estimates…" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No estimates yet</p>
          <button onClick={openNew} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Create Your First Estimate</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estimate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(e => {
                const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.draft;
                return (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{e.title}</div>
                      <div className="text-xs text-gray-400">{e.estimate_number} · {new Date(e.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{e.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{fmt(e.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(e.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Edit"><Edit2 size={14} /></button>
                        {e.status === 'draft' && (
                          <button onClick={() => updateStatus(e.id, 'sent')} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Mark Sent"><Send size={14} /></button>
                        )}
                        {e.status === 'sent' && (
                          <button onClick={() => updateStatus(e.id, 'approved')} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Mark Approved"><CheckCircle size={14} /></button>
                        )}
                        {(e.status === 'approved') && (
                          <button onClick={() => convertToJob(e.id)} className="p-1.5 text-gray-400 hover:text-purple-600 rounded" title="Convert to Job"><Hammer size={14} /></button>
                        )}
                        <button onClick={() => deleteEstimate(e.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
