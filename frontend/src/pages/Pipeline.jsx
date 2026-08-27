import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

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
  const [pendingLost, setPendingLost] = useState(null); // { dealId }
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'

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

  const openAdd = (stage = 'lead') => { setForm({ ...EMPTY, stage, probability: String(STAGES.find(s => s.key === stage)?.prob ?? 10) }); setEditId(null); setShowModal(true); };
  const openEdit = (d) => {
    setForm({ ...d, value: String(d.value || ''), probability: String(d.probability || ''), company_id: d.company_id || '', contact_id: d.contact_id || '', close_date: d.close_date || '' });
    setEditId(d.id); setShowModal(true);
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

  // Drag-and-drop
  const onDragStart = (e, deal) => { setDragging(deal); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e, stageKey) => { e.preventDefault(); setDragOver(stageKey); };
  const onDrop = (e, stageKey) => {
    e.preventDefault();
    setDragOver(null);
    if (dragging && dragging.stage !== stageKey) moveStage(dragging.id, stageKey);
    setDragging(null);
  };

  // Stats
  const activePipeline = deals.filter(d => !['won','lost'].includes(d.stage));
  const totalPipeline = activePipeline.reduce((s, d) => s + (d.value || 0), 0);
  const weightedPipeline = activePipeline.reduce((s, d) => s + (d.value || 0) * (d.probability || 0) / 100, 0);
  const totalWon = deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.value || 0), 0);

  return (
    <>
      <div className="page-header">
        <h2>Pipeline</h2>
        <div className="flex gap-2">
          <button className={`btn ${view === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('kanban')}>📋 Kanban</button>
          <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('list')}>📃 List</button>
          <button className="btn btn-primary" onClick={() => openAdd()}>+ New Deal</button>
        </div>
      </div>

      <div className="page-content">
        {/* Pipeline stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Open Pipeline</div>
            <div className="stat-value" style={{ color: 'var(--blue-700)' }}>{fmt(totalPipeline)}</div>
            <div className="stat-sub">{activePipeline.length} active deals</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Weighted Value</div>
            <div className="stat-value" style={{ color: 'var(--yellow-600)' }}>{fmt(weightedPipeline)}</div>
            <div className="stat-sub">probability-adjusted</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Won This Period</div>
            <div className="stat-value" style={{ color: 'var(--green-600)' }}>{fmt(totalWon)}</div>
            <div className="stat-sub">{deals.filter(d => d.stage === 'won').length} deals</div>
          </div>
        </div>

        {/* KANBAN VIEW */}
        {view === 'kanban' && (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
            {STAGES.map(stage => {
              const colDeals = deals.filter(d => d.stage === stage.key);
              const colTotal = colDeals.reduce((s, d) => s + (d.value || 0), 0);
              const isOver = dragOver === stage.key;
              return (
                <div key={stage.key}
                  style={{ minWidth: 220, width: 220, flexShrink: 0 }}
                  onDragOver={e => onDragOver(e, stage.key)}
                  onDrop={e => onDrop(e, stage.key)}
                  onDragLeave={() => setDragOver(null)}
                >
                  {/* Column header */}
                  <div style={{
                    background: stage.color, color: 'white', borderRadius: '6px 6px 0 0',
                    padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{stage.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, opacity: .8 }}>{colDeals.length} deal{colDeals.length !== 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmt(colTotal)}</div>
                    </div>
                  </div>

                  {/* Cards */}
                  <div style={{
                    background: isOver ? '#dbeafe' : '#f3f4f6', borderRadius: '0 0 6px 6px',
                    minHeight: 80, padding: 8, border: `2px solid ${isOver ? '#2563eb' : 'transparent'}`,
                    transition: 'background .15s, border-color .15s'
                  }}>
                    {colDeals.map(deal => (
                      <div key={deal.id}
                        draggable
                        onDragStart={e => onDragStart(e, deal)}
                        style={{
                          background: 'white', borderRadius: 6, padding: '10px 12px',
                          marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,.1)',
                          cursor: 'grab', borderLeft: `3px solid ${stage.color}`,
                          opacity: dragging?.id === deal.id ? .5 : 1
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}
                          className="link-style" onClick={() => openEdit(deal)}>
                          {deal.title}
                        </div>
                        {deal.company_name && (
                          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>🏢 {deal.company_name}</div>
                        )}
                        {deal.value > 0 && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: stage.color, marginTop: 4 }}>{fmt(deal.value)}</div>
                        )}
                        {deal.close_date && (
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                            Close: {new Date(deal.close_date + 'T12:00:00').toLocaleDateString()}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          {STAGES.filter(s => s.key !== stage.key && s.key !== 'lost').slice(0, 2).map(s => (
                            <button key={s.key} onClick={() => moveStage(deal.id, s.key)}
                              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: s.color + '22', color: s.color, border: `1px solid ${s.color}55`, cursor: 'pointer', fontWeight: 600 }}>
                              → {s.label.replace(' ✓','').replace(' ✗','')}
                            </button>
                          ))}
                          {stage.key !== 'lost' && stage.key !== 'won' && (
                            <button onClick={() => moveStage(deal.id, 'lost')}
                              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 600 }}>
                              Lost
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add deal button */}
                    {!['won','lost'].includes(stage.key) && (
                      <button onClick={() => openAdd(stage.key)}
                        style={{ width: '100%', padding: '6px', border: '1px dashed #d1d5db', borderRadius: 6, background: 'transparent', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 12 }}>
                        + Add deal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
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
                    <th>Prob %</th>
                    <th>Stage</th>
                    <th>Close Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No deals yet</td></tr>
                  ) : deals.map(d => {
                    const stg = STAGES.find(s => s.key === d.stage);
                    return (
                      <tr key={d.id}>
                        <td><span className="link-style font-bold" style={{ cursor: 'pointer' }} onClick={() => openEdit(d)}>{d.title}</span></td>
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

      {/* Add/Edit Deal Modal */}
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

      {/* Lost Reason Modal */}
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
                  placeholder="Price, timing, competitor, no budget..." />
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
