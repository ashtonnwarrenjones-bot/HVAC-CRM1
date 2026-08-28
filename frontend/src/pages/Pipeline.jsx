import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Columns, LayoutGrid, List, Building2, Calendar, Pencil } from 'lucide-react';

const STAGES = [
  { key: 'lead',       label: 'Lead',       color: '#6b7280', prob: 10 },
  { key: 'contacted',  label: 'Contacted',  color: '#2563eb', prob: 20 },
  { key: 'site_visit', label: 'Site Visit', color: '#7c3aed', prob: 40 },
  { key: 'quoted',     label: 'Quoted',     color: '#d97706', prob: 60 },
  { key: 'won',        label: 'Won ✓',      color: '#16a34a', prob: 100 },
  { key: 'lost',       label: 'Lost ✗',     color: '#dc2626', prob: 0 },
];

const SERVICE_TYPES = [
  'Preventive Maintenance', 'Emergency Repair', 'HVAC Replacement',
  'Plumbing Repair', 'Plumbing Installation', 'Duct Cleaning',
  'Refrigerant Service', 'Boiler Service', 'Chiller Service',
  'Controls / BAS', 'New Installation', 'Other'
];

const EMPTY = {
  title: '', company_id: '', contact_id: '', stage: 'lead',
  value: '', probability: '10', service_type: 'Preventive Maintenance',
  close_date: '', notes: ''
};

const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function Pipeline() {
  const [deals, setDeals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [lostReason, setLostReason] = useState('');
  const [pendingLost, setPendingLost] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [view, setView] = useState(() => window.innerWidth < 700 ? 'cards' : 'kanban'); // 'kanban' | 'cards' | 'list'

  const load = () => axios.get('/api/deals').then(r => setDeals(r.data));

  useEffect(() => {
    load();
    axios.get('/api/companies').then(r => setCompanies(r.data));
  }, []);

  useEffect(() => {
    if (form.company_id) {
      axios.get('/api/contacts', { params: { company_id: form.company_id } }).then(r => setContacts(r.data));
    } else setContacts([]);
  }, [form.company_id]);

  const f = (k) => e => {
    const val = e.target.value;
    setForm(p => {
      const next = { ...p, [k]: val };
      if (k === 'stage') next.probability = String(STAGES.find(s => s.key === val)?.prob ?? 20);
      return next;
    });
  };

  const openAdd = (stage = 'lead') => {
    setForm({ ...EMPTY, stage, probability: String(STAGES.find(s => s.key === stage)?.prob ?? 10) });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (d) => {
    setForm({ ...d, value: String(d.value || ''), probability: String(d.probability || ''), company_id: d.company_id || '', contact_id: d.contact_id || '', close_date: d.close_date || '' });
    setEditId(d.id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) { alert('Deal title required'); return; }
    if (editId) await axios.put(`/api/deals/${editId}`, form);
    else await axios.post('/api/deals', form);
    setShowModal(false);
    load();
  };

  const del = async (id) => {
    if (!confirm('Delete this deal?')) return;
    await axios.delete(`/api/deals/${id}`);
    load();
  };

  const moveStage = async (dealId, newStage) => {
    if (newStage === 'lost') {
      setPendingLost({ dealId });
      setLostReason('');
      setShowLostModal(true);
      return;
    }
    await axios.patch(`/api/deals/${dealId}/stage`, { stage: newStage });
    load();
  };

  const confirmLost = async () => {
    await axios.patch(`/api/deals/${pendingLost.dealId}/stage`, { stage: 'lost', lost_reason: lostReason });
    setShowLostModal(false);
    load();
  };

  const onDragStart = (e, deal) => { setDragging(deal); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e, stageKey) => { e.preventDefault(); setDragOver(stageKey); };
  const onDrop = (e, stageKey) => {
    e.preventDefault();
    setDragOver(null);
    if (dragging && dragging.stage !== stageKey) moveStage(dragging.id, stageKey);
    setDragging(null);
  };

  const activePipeline = deals.filter(d => !['won', 'lost'].includes(d.stage));
  const totalPipeline = activePipeline.reduce((s, d) => s + (d.value || 0), 0);
  const weightedPipeline = activePipeline.reduce((s, d) => s + (d.value || 0) * (d.probability || 0) / 100, 0);
  const totalWon = deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.value || 0), 0);

  // Deal card used in both kanban and cards view
  function DealCard({ deal, stage, compact }) {
    return (
      <div
        draggable={!compact}
        onDragStart={compact ? undefined : e => onDragStart(e, deal)}
        style={{
          background: 'white', borderRadius: 8, padding: compact ? '12px 14px' : '10px 12px',
          marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,.09)',
          cursor: compact ? 'default' : 'grab',
          borderLeft: `3px solid ${stage.color}`,
          opacity: dragging?.id === deal.id ? .5 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1d4ed8', cursor: 'pointer', marginBottom: 2 }}
              onClick={() => openEdit(deal)}>
              {deal.title}
            </div>
            {deal.company_name && (
              <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={11} /> {deal.company_name}</div>
            )}
          </div>
          {deal.value > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: stage.color, flexShrink: 0 }}>{fmt(deal.value)}</div>
          )}
        </div>
        {deal.close_date && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} /> Close: {new Date(deal.close_date + 'T12:00:00').toLocaleDateString()}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => openEdit(deal)}
            style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Pencil size={10} /> Edit
          </button>
          {/* Show next logical stage only (keeps it tidy on mobile) */}
          {(() => {
            const idx = STAGES.findIndex(s => s.key === stage.key);
            const nextStages = STAGES.slice(idx + 1).filter(s => s.key !== 'lost');
            return nextStages.slice(0, 1).map(s => (
              <button key={s.key} onClick={() => moveStage(deal.id, s.key)}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, background: s.color + '18', color: s.color, border: `1px solid ${s.color}44`, cursor: 'pointer', fontWeight: 600 }}>
                → {s.label.replace(' ✓', '').replace(' ✗', '')}
              </button>
            ));
          })()}
          {stage.key !== 'lost' && stage.key !== 'won' && (
            <button onClick={() => moveStage(deal.id, 'lost')}
              style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 600 }}>
              ✗ Lost
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media (max-width: 600px) {
          .pipeline-stats { grid-template-columns: 1fr !important; gap: 8px !important; }
          .pipeline-stats .stat-card { padding: 10px 14px !important; }
          .pipeline-stats .stat-value { font-size: 20px !important; }
        }
      `}</style>
      {/* ── Page header ── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2>Pipeline</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {[
              { key: 'kanban', Icon: Columns, label: 'Kanban' },
              { key: 'cards', Icon: LayoutGrid, label: 'Cards' },
              { key: 'list', Icon: List, label: 'List' },
            ].map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: view === v.key ? '#2563eb' : 'transparent',
                  color: view === v.key ? '#fff' : '#555', transition: 'all .15s', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5 }}>
                <v.Icon size={14} /> <span className="hide-xs">{v.label}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => openAdd()} style={{ fontSize: 13 }}>+ New Deal</button>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid pipeline-stats" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Open Pipeline</div>
            <div className="stat-value" style={{ color: 'var(--blue-700)' }}>{fmt(totalPipeline)}</div>
            <div className="stat-sub">{activePipeline.length} active deal{activePipeline.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Weighted Value</div>
            <div className="stat-value" style={{ color: 'var(--yellow-600)' }}>{fmt(weightedPipeline)}</div>
            <div className="stat-sub">probability-adjusted</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Won This Period</div>
            <div className="stat-value" style={{ color: 'var(--green-600)' }}>{fmt(totalWon)}</div>
            <div className="stat-sub">{deals.filter(d => d.stage === 'won').length} deals closed</div>
          </div>
        </div>

        {/* ── KANBAN VIEW ── */}
        {view === 'kanban' && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 'max-content' }}>
              {STAGES.map(stage => {
                const colDeals = deals.filter(d => d.stage === stage.key);
                const colTotal = colDeals.reduce((s, d) => s + (d.value || 0), 0);
                const isOver = dragOver === stage.key;
                return (
                  <div key={stage.key}
                    style={{ width: 220, flexShrink: 0 }}
                    onDragOver={e => onDragOver(e, stage.key)}
                    onDrop={e => onDrop(e, stage.key)}
                    onDragLeave={() => setDragOver(null)}
                  >
                    <div style={{
                      background: stage.color, color: 'white', borderRadius: '8px 8px 0 0',
                      padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{stage.label}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, opacity: .8 }}>{colDeals.length} deal{colDeals.length !== 1 ? 's' : ''}</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{fmt(colTotal)}</div>
                      </div>
                    </div>
                    <div style={{
                      background: isOver ? '#dbeafe' : '#f3f4f6', borderRadius: '0 0 8px 8px',
                      minHeight: 80, padding: 8,
                      border: `2px solid ${isOver ? '#2563eb' : 'transparent'}`,
                      transition: 'background .15s, border-color .15s'
                    }}>
                      {colDeals.map(deal => (
                        <DealCard key={deal.id} deal={deal} stage={stage} compact={false} />
                      ))}
                      {!['won', 'lost'].includes(stage.key) && (
                        <button onClick={() => openAdd(stage.key)}
                          style={{ width: '100%', padding: '6px', border: '1px dashed #d1d5db', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                          + Add deal
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CARDS VIEW (mobile-friendly grouped list) ── */}
        {view === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {STAGES.map(stage => {
              const colDeals = deals.filter(d => d.stage === stage.key);
              if (colDeals.length === 0 && ['won', 'lost'].includes(stage.key)) return null;
              const colTotal = colDeals.reduce((s, d) => s + (d.value || 0), 0);
              return (
                <div key={stage.key}>
                  {/* Stage header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: stage.color }}>{stage.label}</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      {colDeals.length} deal{colDeals.length !== 1 ? 's' : ''}
                      {colTotal > 0 ? ` · ${fmt(colTotal)}` : ''}
                    </span>
                    {!['won', 'lost'].includes(stage.key) && (
                      <button onClick={() => openAdd(stage.key)}
                        style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', background: stage.color + '18', color: stage.color, border: `1px solid ${stage.color}44`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                        + Add
                      </button>
                    )}
                  </div>
                  {colDeals.length === 0 ? (
                    <div style={{ padding: '12px 16px', background: '#f9fafb', border: '1px dashed #e5e7eb', borderRadius: 8, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                      No deals in this stage
                    </div>
                  ) : (
                    <div>
                      {colDeals.map(deal => (
                        <DealCard key={deal.id} deal={deal} stage={stage} compact={true} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Company</th>
                    <th>Service</th>
                    <th>Value</th>
                    <th>Prob</th>
                    <th>Stage</th>
                    <th>Close Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>No deals yet</td></tr>
                  ) : deals.map(d => {
                    const stg = STAGES.find(s => s.key === d.stage);
                    return (
                      <tr key={d.id}>
                        <td>
                          <span className="link-style font-bold" style={{ cursor: 'pointer' }} onClick={() => openEdit(d)}>{d.title}</span>
                          {d.notes && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{d.notes.slice(0, 60)}{d.notes.length > 60 ? '…' : ''}</div>}
                        </td>
                        <td>{d.company_id ? <Link to={`/companies/${d.company_id}`} className="link-style">{d.company_name}</Link> : '—'}</td>
                        <td className="text-muted">{d.service_type || '—'}</td>
                        <td className="font-bold">{fmt(d.value)}</td>
                        <td className="text-muted">{d.probability}%</td>
                        <td>
                          <span style={{ background: stg?.color + '22', color: stg?.color, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                            {stg?.label || d.stage}
                          </span>
                        </td>
                        <td className="text-muted">{d.close_date ? new Date(d.close_date + 'T12:00:00').toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(d)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => del(d.id)}>Del</button>
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

      {/* ── Add/Edit Deal Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{editId ? 'Edit Deal' : 'New Deal'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Deal Title *</label>
                <input className="form-control" value={form.title} onChange={f('title')} placeholder="e.g. Acme Building — Annual PM Contract" />
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
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Stage</label>
                  <select className="form-control" value={form.stage} onChange={f('stage')}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Service Type</label>
                  <select className="form-control" value={form.service_type} onChange={f('service_type')}>
                    {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Deal Value ($)</label>
                  <input className="form-control" type="number" value={form.value} onChange={f('value')} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Probability (%)</label>
                  <input className="form-control" type="number" min="0" max="100" value={form.probability} onChange={f('probability')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Close Date</label>
                  <input className="form-control" type="date" value={form.close_date} onChange={f('close_date')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={f('notes')} placeholder="Key details, decision makers, competition, next steps..." />
              </div>
            </div>
            <div className="modal-footer">
              {editId && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => { del(editId); setShowModal(false); }}>Delete</button>}
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editId ? 'Save Changes' : 'Create Deal'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lost Reason Modal ── */}
      {showLostModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Mark as Lost</h3>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Reason lost (optional)</label>
                <input className="form-control" value={lostReason} onChange={e => setLostReason(e.target.value)}
                  placeholder="Price, timing, competitor, no budget..." autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLostModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmLost}>Mark Lost</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
