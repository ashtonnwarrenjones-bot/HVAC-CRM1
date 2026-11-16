import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = '/api';
const DIVISIONS = ['Landscape', 'Snow', 'Pavement', 'Facilities', 'Irrigation', 'Lighting', 'Hardscape', 'Other'];
const STATUSES = ['draft', 'sent', 'approved', 'rejected', 'converted'];
const UNITS = ['each', 'hr', 'sqft', 'sqyd', 'lf', 'lb', 'ton', 'gal', 'day', 'mo'];

function fmt$(n) { return '$' + (parseFloat(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtP(n) { return (parseFloat(n)||0).toFixed(1) + '%'; }
function fmtH(n) { return (parseFloat(n)||0).toFixed(1) + ' h'; }

function SummaryBar({ items }) {
  const totalHours = items.reduce((s,i) => s + (parseFloat(i.hours)||0), 0);
  const totalCost  = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
  const subtotal   = items.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
  const profit     = subtotal - totalCost;
  const profitPct  = subtotal > 0 ? (profit / subtotal) * 100 : 0;
  const breakeven  = subtotal > 0 ? (totalCost / subtotal) * 100 : 0;
  const cells = [
    { label: 'Man Hrs',    value: fmtH(totalHours) },
    { label: 'Total Cost', value: fmt$(totalCost) },
    { label: 'Breakeven',  value: fmtP(breakeven) },
    { label: 'Subtotal',   value: fmt$(subtotal) },
    { label: 'Total Price',value: fmt$(subtotal) },
    { label: 'Net Profit', value: fmt$(profit), color: profit >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Profit %',   value: fmtP(profitPct), color: profitPct >= 30 ? '#22c55e' : profitPct >= 15 ? '#f59e0b' : '#ef4444' },
  ];
  return (
    <div style={{ display:'flex', background:'#1e293b', borderRadius:8, overflow:'hidden', margin:'0 0 16px 0' }}>
      {cells.map((c,i) => (
        <div key={i} style={{ flex:1, padding:'10px 12px', borderRight: i < cells.length-1 ? '1px solid #334155' : 'none', textAlign:'center' }}>
          <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{c.label}</div>
          <div style={{ fontSize:15, fontWeight:700, color: c.color || '#f1f5f9' }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function WorkAreaSummaryRow({ name, items, onClick, isOpen }) {
  const hrs   = items.reduce((s,i) => s + (parseFloat(i.hours)||0), 0);
  const cogs  = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
  const price = items.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
  const pctN  = price > 0 ? ((price-cogs)/price)*100 : 0;
  const pct   = fmtP(pctN);
  const pctCol= pctN >= 30 ? '#22c55e' : pctN >= 15 ? '#f59e0b' : '#ef4444';
  return (
    <div onClick={onClick} style={{
      display:'grid', gridTemplateColumns:'32px 1fr 80px 110px 110px 70px',
      alignItems:'center', gap:8, padding:'10px 12px', cursor:'pointer',
      background: isOpen ? '#1e3a5f' : '#1e293b',
      borderRadius:6, marginBottom:4,
      border: '1px solid ' + (isOpen ? '#3b82f6' : '#334155'),
      userSelect:'none'
    }}>
      <span style={{ color:'#94a3b8', fontSize:16 }}>{isOpen ? '▾' : '▸'}</span>
      <span style={{ color:'#f1f5f9', fontWeight:600 }}>{name || '(unnamed area)'}</span>
      <span style={{ color:'#94a3b8', textAlign:'right', fontSize:13 }}>{fmtH(hrs)}</span>
      <span style={{ color:'#94a3b8', textAlign:'right', fontSize:13 }}>{fmt$(cogs)}</span>
      <span style={{ color:'#f1f5f9', fontWeight:600, textAlign:'right' }}>{fmt$(price)}</span>
      <span style={{ color:pctCol, fontWeight:700, textAlign:'right' }}>{pct}</span>
    </div>
  );
}

function LineItemRow({ item, onChange, onDelete }) {
  const inputStyle = {
    background:'transparent', border:'none', borderBottom:'1px solid #334155',
    color:'#f1f5f9', padding:'4px 6px', width:'100%', fontSize:13, outline:'none',
  };
  const lineTotal = (parseFloat(item.unit_price)||0)*(parseFloat(item.quantity)||1);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr 1fr 1fr 90px 32px', gap:6, alignItems:'center', padding:'6px 8px', borderBottom:'1px solid #1e293b' }}>
      <input value={item.description||''} placeholder="Description" onChange={e=>onChange('description',e.target.value)} style={inputStyle} />
      <input type="number" value={item.quantity||''} placeholder="Qty" onChange={e=>onChange('quantity',e.target.value)} style={inputStyle} />
      <select value={item.unit||'each'} onChange={e=>onChange('unit',e.target.value)} style={{ ...inputStyle, background:'#0f172a' }}>
        {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
      </select>
      <input type="number" value={item.hours||''} placeholder="Hrs" onChange={e=>onChange('hours',e.target.value)} style={inputStyle} />
      <input type="number" value={item.unit_cost||''} placeholder="Cost" onChange={e=>onChange('unit_cost',e.target.value)} style={inputStyle} />
      <input type="number" value={item.unit_price||''} placeholder="Price" onChange={e=>onChange('unit_price',e.target.value)} style={inputStyle} />
      <span style={{ color:'#94a3b8', fontSize:13, textAlign:'right', paddingRight:6 }}>{fmt$(lineTotal)}</span>
      <button onClick={onDelete} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:16, padding:0 }}>×</button>
    </div>
  );
}

function WorkArea({ name, items, onRename, onAddItem, onChangeItem, onDeleteItem, onDelete, profitPct, setProfitPct, isOpen, onToggle }) {
  return (
    <div style={{ marginBottom:8 }}>
      <WorkAreaSummaryRow name={name} items={items} onClick={onToggle} isOpen={isOpen} />
      {isOpen && (
        <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:6, marginBottom:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderBottom:'1px solid #1e293b' }}>
            <input value={name} onChange={e=>onRename(e.target.value)} placeholder="Work Area Name"
              style={{ flex:1, background:'#1e293b', border:'1px solid #334155', borderRadius:4, color:'#f1f5f9', padding:'6px 10px', fontSize:14 }} />
            <label style={{ color:'#94a3b8', fontSize:13 }}>Profit %</label>
            <input type="number" value={profitPct} onChange={e=>setProfitPct(parseFloat(e.target.value)||0)}
              style={{ width:60, background:'#1e293b', border:'1px solid #334155', borderRadius:4, color:'#f1f5f9', padding:'6px 8px', fontSize:13 }} />
            <button onClick={onDelete} style={{ background:'none', border:'1px solid #ef4444', borderRadius:4, color:'#ef4444', padding:'4px 10px', cursor:'pointer', fontSize:12 }}>Remove Area</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr 1fr 1fr 90px 32px', gap:6, padding:'6px 8px', borderBottom:'1px solid #1e293b' }}>
            {['Description','Qty','Unit','Hrs','Unit Cost','Unit Price','Total',''].map((h,i) => (
              <span key={i} style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</span>
            ))}
          </div>
          {items.map((item, idx) => (
            <LineItemRow key={idx} item={item}
              onChange={(k,v) => onChangeItem(idx, k, v)}
              onDelete={() => onDeleteItem(idx)} />
          ))}
          <div style={{ padding:'8px 12px' }}>
            <button onClick={onAddItem} style={{
              background:'none', border:'1px dashed #334155', borderRadius:4,
              color:'#3b82f6', padding:'6px 16px', cursor:'pointer', fontSize:13, width:'100%'
            }}>+ Add Line Item</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Estimates() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [tab, setTab] = useState('customer');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title:'', estimate_number:'', status:'draft', valid_until:'',
    division:'', salesperson:'', confidence:50, notes:'', tax_rate:0,
    company_id:'', property_id:'', contact_id:'',
  });
  const [items, setItems] = useState([]);
  const [openAreas, setOpenAreas] = useState({});
  const [areaProfitPcts, setAreaProfitPcts] = useState({});
  const [companies, setCompanies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [listView, setListView] = useState(isNew);

  useEffect(() => {
    fetch(`${API}/companies`).then(r=>r.json()).then(d=>setCompanies(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(`${API}/contacts`).then(r=>r.json()).then(d=>setContacts(Array.isArray(d)?d:[])).catch(()=>{});
    if (!isNew) {
      setLoading(true);
      fetch(`${API}/estimates/${id}`).then(r=>r.json()).then(data => {
        const { items: its, ...est } = data;
        setForm(f => ({ ...f, ...est }));
        setItems(its || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      fetch(`${API}/estimates`).then(r=>r.json()).then(d=>setEstimates(Array.isArray(d)?d:[])).catch(()=>{});
    }
  }, [id, isNew]);

  useEffect(() => {
    if (form.company_id) {
      fetch(`${API}/properties?company_id=${form.company_id}`).then(r=>r.json()).then(d=>setProperties(Array.isArray(d)?d:[])).catch(()=>{});
    }
  }, [form.company_id]);

  const workAreas = [...new Set(items.map(i => i.category || ''))].filter(Boolean);
  const allAreaNames = workAreas.length ? workAreas : [];

  function getAreaItems(areaName) {
    return items.filter(i => (i.category||'') === areaName);
  }

  function handleAddArea() {
    const name = `Work Area ${allAreaNames.length + 1}`;
    setItems(prev => [...prev, { description:'', category:name, quantity:1, unit:'each', unit_price:0, unit_cost:0, hours:0 }]);
    setOpenAreas(prev => ({ ...prev, [name]: true }));
  }

  function handleRenameArea(oldName, newName) {
    setItems(prev => prev.map(i => i.category === oldName ? { ...i, category: newName } : i));
    setOpenAreas(prev => {
      const next = { ...prev };
      if (prev[oldName] !== undefined) { next[newName] = next[oldName]; delete next[oldName]; }
      return next;
    });
  }

  function handleAddItem(areaName) {
    setItems(prev => [...prev, { description:'', category:areaName, quantity:1, unit:'each', unit_price:0, unit_cost:0, hours:0 }]);
  }

  function handleChangeItem(areaName, localIdx, key, value) {
    const areaItems = items.map((it, i) => ({ it, i })).filter(x => (x.it.category||'') === areaName);
    const globalIdx = areaItems[localIdx].i;
    setItems(prev => prev.map((it, i) => i === globalIdx ? { ...it, [key]: value } : it));
  }

  function handleDeleteItem(areaName, localIdx) {
    const areaItems = items.map((it, i) => ({ it, i })).filter(x => (x.it.category||'') === areaName);
    const globalIdx = areaItems[localIdx].i;
    setItems(prev => prev.filter((_, i) => i !== globalIdx));
  }

  function handleDeleteArea(areaName) {
    setItems(prev => prev.filter(i => i.category !== areaName));
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const payload = { ...form, items };
      const url = isNew ? `${API}/estimates` : `${API}/estimates/${id}`;
      const method = isNew ? 'POST' : 'PUT';
      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Save failed');
      if (isNew) navigate(`/estimates/${data.id}`);
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  if (loading) return <div style={{ color:'#94a3b8', padding:40, textAlign:'center' }}>Loading…</div>;

  if (isNew && listView) {
    return (
      <div style={{ padding:24, maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:'#f1f5f9', margin:0, fontSize:22, fontWeight:700 }}>Estimates</h2>
          <button onClick={() => setListView(false)}
            style={{ background:'#3b82f6', border:'none', borderRadius:6, color:'#fff', padding:'8px 20px', cursor:'pointer', fontSize:14, fontWeight:600 }}>
            + New Estimate
          </button>
        </div>
        <div style={{ background:'#1e293b', borderRadius:8, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'130px 2fr 1fr 1fr 1fr 100px', gap:12, padding:'10px 16px', borderBottom:'1px solid #334155' }}>
            {['Estimate #','Title','Client','Status','Total','Date'].map(h => (
              <span key={h} style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</span>
            ))}
          </div>
          {estimates.length === 0 && (
            <div style={{ padding:40, textAlign:'center', color:'#64748b' }}>No estimates yet. Create your first one!</div>
          )}
          {estimates.map(e => (
            <div key={e.id} onClick={() => navigate(`/estimates/${e.id}`)} style={{
              display:'grid', gridTemplateColumns:'130px 2fr 1fr 1fr 1fr 100px',
              gap:12, padding:'12px 16px', borderBottom:'1px solid #0f172a', cursor:'pointer',
            }}
              onMouseEnter={ev=>ev.currentTarget.style.background='#263548'}
              onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
              <span style={{ color:'#3b82f6', fontWeight:600, fontSize:13 }}>{e.estimate_number}</span>
              <span style={{ color:'#f1f5f9' }}>{e.title}</span>
              <span style={{ color:'#94a3b8' }}>{e.company_name || '—'}</span>
              <span>
                <span style={{
                  background: e.status==='approved'?'#14532d':e.status==='sent'?'#1e3a5f':e.status==='rejected'?'#450a0a':'#1e293b',
                  color: e.status==='approved'?'#4ade80':e.status==='sent'?'#60a5fa':e.status==='rejected'?'#f87171':'#94a3b8',
                  borderRadius:12, padding:'2px 10px', fontSize:12
                }}>{e.status}</span>
              </span>
              <span style={{ color:'#f1f5f9', fontWeight:600 }}>{fmt$(e.total)}</span>
              <span style={{ color:'#64748b', fontSize:12 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const inputStyle = {
    background:'#0f172a', border:'1px solid #334155', borderRadius:6,
    color:'#f1f5f9', padding:'8px 12px', fontSize:14, width:'100%', boxSizing:'border-box',
  };
  const labelStyle = { color:'#94a3b8', fontSize:12, marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'0.04em' };
  const fieldStyle = { marginBottom:16 };

  return (
    <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
        <button onClick={() => navigate('/estimates')} style={{ background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:14, padding:0 }}>← Estimates</button>
        <h2 style={{ color:'#f1f5f9', margin:0, fontSize:20, fontWeight:700, flex:1 }}>
          {isNew ? 'New Estimate' : (form.estimate_number || 'Edit Estimate')}
        </h2>
        {!isNew && (
          <select value={form.status} onChange={f('status')} style={{ ...inputStyle, width:'auto' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button onClick={handleSave} disabled={saving} style={{
          background:'#3b82f6', border:'none', borderRadius:6, color:'#fff',
          padding:'8px 24px', cursor:'pointer', fontSize:14, fontWeight:600,
          opacity: saving ? 0.6 : 1
        }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      {error && <div style={{ background:'#450a0a', border:'1px solid #ef4444', borderRadius:6, color:'#fca5a5', padding:'10px 14px', marginBottom:16 }}>{error}</div>}

      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid #334155' }}>
        {[{ key:'customer', label:'Customer Info' }, { key:'workareas', label:'Workareas & Pricing' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background:'none', border:'none',
            borderBottom: tab===t.key ? '2px solid #3b82f6' : '2px solid transparent',
            color: tab===t.key ? '#3b82f6' : '#94a3b8',
            padding:'10px 20px', cursor:'pointer', fontSize:14, fontWeight:600,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'customer' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
          <div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Project Name / Title</label>
              <input value={form.title} onChange={f('title')} placeholder="e.g. Spring Lawn Maintenance" style={inputStyle} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Estimate #</label>
                <input value={form.estimate_number||''} onChange={f('estimate_number')} placeholder="Auto-assigned" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.valid_until||''} onChange={f('valid_until')} style={inputStyle} />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Division</label>
              <select value={form.division||''} onChange={f('division')} style={inputStyle}>
                <option value="">Select division…</option>
                {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={f('status')} style={inputStyle}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Salesperson</label>
              <input value={form.salesperson||''} onChange={f('salesperson')} placeholder="Salesperson name" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Confidence: {form.confidence}%</label>
              <input type="range" min={0} max={100} value={form.confidence||50}
                onChange={e=>setForm(p=>({...p,confidence:parseInt(e.target.value)}))}
                style={{ width:'100%', accentColor:'#3b82f6' }} />
              <div style={{ display:'flex', justifyContent:'space-between', color:'#64748b', fontSize:11, marginTop:2 }}>
                <span>0% Unlikely</span><span>50% Possible</span><span>100% Sure</span>
              </div>
            </div>
          </div>
          <div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Client (Company)</label>
              <select value={form.company_id||''} onChange={f('company_id')} style={inputStyle}>
                <option value="">Select client…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Property</label>
              <select value={form.property_id||''} onChange={f('property_id')} style={inputStyle}>
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Contact</label>
              <select value={form.contact_id||''} onChange={f('contact_id')} style={inputStyle}>
                <option value="">Select contact…</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes||''} onChange={f('notes')} rows={5} placeholder="Additional notes…"
                style={{ ...inputStyle, resize:'vertical', fontFamily:'inherit' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Tax Rate (%)</label>
              <input type="number" value={form.tax_rate||0} onChange={f('tax_rate')} min={0} max={100} step={0.1} style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {tab === 'workareas' && (
        <div>
          <SummaryBar items={items} />
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <button onClick={handleAddArea} style={{
              background:'#3b82f6', border:'none', borderRadius:6, color:'#fff',
              padding:'8px 18px', cursor:'pointer', fontSize:13, fontWeight:600
            }}>+ Add Work Area</button>
          </div>
          {allAreaNames.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px 110px 110px 70px', gap:8, padding:'0 12px', marginBottom:4 }}>
              {['','Work Area','Hrs','COGS','Price','Profit%'].map((h,i) => (
                <span key={i} style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em', textAlign: i > 1 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>
          )}
          {allAreaNames.map(areaName => (
            <WorkArea key={areaName}
              name={areaName}
              items={getAreaItems(areaName)}
              isOpen={!!openAreas[areaName]}
              onToggle={() => setOpenAreas(p => ({ ...p, [areaName]: !p[areaName] }))}
              profitPct={areaProfitPcts[areaName] || 30}
              setProfitPct={(v) => setAreaProfitPcts(p => ({ ...p, [areaName]: v }))}
              onRename={(newName) => handleRenameArea(areaName, newName)}
              onAddItem={() => handleAddItem(areaName)}
              onChangeItem={(idx, k, v) => handleChangeItem(areaName, idx, k, v)}
              onDeleteItem={(idx) => handleDeleteItem(areaName, idx)}
              onDelete={() => handleDeleteArea(areaName)}
            />
          ))}
          {items.length === 0 && (
            <div style={{ padding:48, textAlign:'center', color:'#64748b', background:'#1e293b', borderRadius:8 }}>
              No work areas yet. Click <strong style={{color:'#3b82f6'}}>+ Add Work Area</strong> to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
