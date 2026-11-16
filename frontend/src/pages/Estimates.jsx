import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = '/api';
const DIVISIONS = ['Landscape', 'Snow', 'Pavement', 'Facilities', 'Irrigation', 'Lighting', 'Hardscape', 'Other'];
const STATUSES = ['draft', 'sent', 'approved', 'rejected', 'converted'];
const COST_CODES = ['Landscape', 'Snow', 'Pavement', 'Facilities', 'Irrigation', 'Lighting', 'Hardscape', 'Labor', 'Materials', 'Subcontract', 'Equipment', 'Other'];
const UNITS = ['each', 'hr', 'sqft', 'sqyd', 'lf', 'lb', 'ton', 'gal', 'day', 'mo', 'units'];

function fmt$(n) { return '$' + (parseFloat(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtP(n) { return (parseFloat(n)||0).toFixed(1) + '%'; }
function fmtH(n) { return (parseFloat(n)||0).toFixed(2); }

// ── Summary Bar (matches LMN layout) ──────────────────────────────────────────
function SummaryBar({ items }) {
  const totalHours = items.reduce((s,i) => s + (parseFloat(i.hours)||0), 0);
  const totalCost  = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
  const subtotal   = items.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
  const profit     = subtotal - totalCost;
  const profitPct  = subtotal > 0 ? (profit / subtotal) * 100 : 0;
  const pctCol = profitPct >= 30 ? '#16a34a' : profitPct >= 15 ? '#d97706' : '#dc2626';

  return (
    <div style={{ display:'flex', alignItems:'stretch', background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:16, overflow:'hidden' }}>
      {[
        { label: 'Man Hrs',    value: fmtH(totalHours), sub: null },
        { label: 'Total Cost', value: fmt$(totalCost),  sub: null },
        { label: 'Breakeven',  value: fmt$(totalCost),  sub: null },
        { label: 'Subtotal',   value: fmt$(subtotal),   sub: null },
        { label: 'Total Price', value: fmt$(subtotal),  sub: 'Includes Taxes: $0.00' },
      ].map((c,i) => (
        <div key={i} style={{ flex:1, padding:'10px 14px', borderRight:'1px solid #e2e8f0', textAlign:'center' }}>
          <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>{c.label}</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#1e293b' }}>{c.value}</div>
          {c.sub && <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{c.sub}</div>}
        </div>
      ))}
      <div style={{ flex:1.2, padding:'10px 14px', textAlign:'center', background:'#f8fafc' }}>
        <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>Net Profit</div>
        <div style={{ fontSize:15, fontWeight:700, color: pctCol }}>
          {fmt$(profit)} <span style={{ fontSize:13 }}>{fmtP(profitPct)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Work area inline-expanded row (LMN style) ──────────────────────────────────
function WorkAreaRow({ name, items, costCode, isOpen, onToggle, onRename, onChangeCostCode, onAddItem, onChangeItem, onDeleteItem, onDelete, idx }) {
  const hrs   = items.reduce((s,i) => s + (parseFloat(i.hours)||0), 0);
  const cogs  = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
  const price = items.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
  const pctN  = price > 0 ? ((price-cogs)/price)*100 : 0;
  const pctCol= pctN >= 30 ? '#16a34a' : pctN >= 15 ? '#d97706' : '#dc2626';

  const rowBg = isOpen ? '#eff6ff' : (idx % 2 === 0 ? '#fff' : '#f8fafc');
  const inputSm = { background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, padding:'4px 8px', fontSize:13, color:'#1e293b', outline:'none' };

  return (
    <>
      {/* Work area summary row */}
      <tr style={{ background: rowBg, borderBottom: '1px solid #e2e8f0' }}>
        <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button onClick={onToggle} style={{
              background: isOpen ? '#1d4ed8' : '#0f766e', border:'none', borderRadius:4,
              color:'#fff', padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:600, minWidth:52
            }}>{isOpen ? 'Close' : 'Edit'}</button>
            <select value="" onChange={e => {
              if (e.target.value === 'delete') onDelete();
            }} style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, fontSize:12, padding:'3px 2px', cursor:'pointer', color:'#64748b' }}>
              <option value="">▾</option>
              <option value="delete">Delete Area</option>
            </select>
          </div>
        </td>
        <td style={{ padding:'8px 10px', color:'#64748b', fontSize:13, textAlign:'center' }}>{idx + 1}</td>
        <td style={{ padding:'8px 10px' }}>
          {isOpen
            ? <input value={name} onChange={e=>onRename(e.target.value)} style={{ ...inputSm, minWidth:180 }} />
            : <span style={{ color:'#1e293b', fontWeight:500 }}>{name || '(unnamed)'}</span>}
        </td>
        <td style={{ padding:'8px 10px', color:'#64748b', fontSize:13 }}>—</td>
        <td style={{ padding:'8px 10px' }}>
          {isOpen
            ? <select value={costCode||''} onChange={e=>onChangeCostCode(e.target.value)} style={{ ...inputSm, minWidth:130 }}>
                {COST_CODES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            : <span style={{ color:'#64748b', fontSize:13 }}>{costCode || '—'}</span>}
        </td>
        <td style={{ padding:'8px 10px', color:'#64748b', fontSize:13 }}>—</td>
        <td style={{ padding:'8px 10px', color:'#1e293b', fontSize:13, textAlign:'right' }}>{fmtH(hrs)}</td>
        <td style={{ padding:'8px 10px', color:'#1e293b', fontSize:13, textAlign:'right' }}>{fmt$(cogs)}</td>
        <td style={{ padding:'8px 10px', color:'#1e293b', fontWeight:600, textAlign:'right' }}>{fmt$(price)}</td>
        <td style={{ padding:'8px 10px', color:pctCol, fontWeight:700, textAlign:'right' }}>{fmtP(pctN)}</td>
      </tr>

      {/* Expanded line items */}
      {isOpen && (
        <tr>
          <td colSpan={10} style={{ padding:0, background:'#eff6ff', borderBottom:'2px solid #3b82f6' }}>
            <div style={{ padding:'10px 16px 14px' }}>
              {/* Line items table */}
              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:10 }}>
                <thead>
                  <tr style={{ background:'#dbeafe' }}>
                    {['Order','Name','Qty','Units','Unit Cost','Unit Price','Profit %','Total Cost','Total Price',''].map((h,i) => (
                      <th key={i} style={{ padding:'6px 8px', fontSize:11, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'0.04em', textAlign: i > 1 ? 'right' : 'left', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, lIdx) => {
                    const lCogs  = (parseFloat(item.unit_cost)||0)*(parseFloat(item.quantity)||1);
                    const lPrice = (parseFloat(item.unit_price)||0)*(parseFloat(item.quantity)||1);
                    const lPct   = lPrice > 0 ? ((lPrice-lCogs)/lPrice)*100 : 0;
                    const lPctCol= lPct >= 30 ? '#16a34a' : lPct >= 15 ? '#d97706' : '#dc2626';
                    const lineInput = { background:'#fff', border:'1px solid #cbd5e1', borderRadius:3, padding:'3px 6px', fontSize:13, color:'#1e293b', outline:'none', width:'100%' };
                    return (
                      <tr key={lIdx} style={{ background: lIdx%2===0?'#fff':'#f0f9ff', borderBottom:'1px solid #dbeafe' }}>
                        <td style={{ padding:'5px 8px', color:'#64748b', fontSize:12, textAlign:'center', width:40 }}>{lIdx+1}</td>
                        <td style={{ padding:'5px 8px', minWidth:200 }}>
                          <input value={item.description||''} placeholder="Item name" onChange={e=>onChangeItem(lIdx,'description',e.target.value)} style={lineInput} />
                        </td>
                        <td style={{ padding:'5px 8px', width:60 }}>
                          <input type="number" value={item.quantity||''} placeholder="1" onChange={e=>onChangeItem(lIdx,'quantity',e.target.value)} style={{ ...lineInput, textAlign:'right' }} />
                        </td>
                        <td style={{ padding:'5px 8px', width:80 }}>
                          <select value={item.unit||'each'} onChange={e=>onChangeItem(lIdx,'unit',e.target.value)} style={{ ...lineInput, background:'#fff' }}>
                            {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={{ padding:'5px 8px', width:100 }}>
                          <input type="number" value={item.unit_cost||''} placeholder="0.00" onChange={e=>onChangeItem(lIdx,'unit_cost',e.target.value)} style={{ ...lineInput, textAlign:'right' }} />
                        </td>
                        <td style={{ padding:'5px 8px', width:100 }}>
                          <input type="number" value={item.unit_price||''} placeholder="0.00" onChange={e=>onChangeItem(lIdx,'unit_price',e.target.value)} style={{ ...lineInput, textAlign:'right' }} />
                        </td>
                        <td style={{ padding:'5px 8px', width:80, textAlign:'right', color:lPctCol, fontWeight:600, fontSize:13 }}>{fmtP(lPct)}</td>
                        <td style={{ padding:'5px 8px', width:110, textAlign:'right', color:'#64748b', fontSize:13 }}>{fmt$(lCogs)}</td>
                        <td style={{ padding:'5px 8px', width:110, textAlign:'right', color:'#1e293b', fontWeight:500, fontSize:13 }}>{fmt$(lPrice)}</td>
                        <td style={{ padding:'5px 8px', width:32 }}>
                          <button onClick={()=>onDeleteItem(lIdx)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:16, padding:0, lineHeight:1 }}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length > 0 && (
                    <tr style={{ background:'#dbeafe', fontWeight:700 }}>
                      <td colSpan={6} style={{ padding:'6px 8px', fontSize:12, color:'#1d4ed8' }}>Subtotal</td>
                      <td style={{ padding:'6px 8px', textAlign:'right', fontSize:13, color: pctN >= 30 ? '#16a34a' : pctN >= 15 ? '#d97706' : '#dc2626' }}>{fmtP(pctN)}</td>
                      <td style={{ padding:'6px 8px', textAlign:'right', fontSize:13, color:'#1e293b' }}>{fmt$(cogs)}</td>
                      <td style={{ padding:'6px 8px', textAlign:'right', fontSize:13, color:'#1e293b' }}>{fmt$(price)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onAddItem} style={{
                  background:'#0f766e', border:'none', borderRadius:4, color:'#fff',
                  padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:600
                }}>+ Add Items + Templates</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
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
  const [areaCostCodes, setAreaCostCodes] = useState({});
  const [companies, setCompanies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [estimates, setEstimates] = useState([]);

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

  function getAreaItems(areaName) {
    return items.filter(i => (i.category||'') === areaName);
  }

  function handleAddArea() {
    const name = `Work Area ${workAreas.length + 1}`;
    setItems(prev => [...prev, { description:'To Be Determined', category:name, quantity:1, unit:'units', unit_price:0, unit_cost:0, hours:0 }]);
    setOpenAreas(prev => ({ ...prev, [name]: true }));
    setAreaCostCodes(prev => ({ ...prev, [name]: form.division || 'Other' }));
  }

  function handleRenameArea(oldName, newName) {
    setItems(prev => prev.map(i => i.category === oldName ? { ...i, category: newName } : i));
    setOpenAreas(prev => { const n={...prev}; if(prev[oldName]!==undefined){n[newName]=n[oldName];delete n[oldName];} return n; });
    setAreaCostCodes(prev => { const n={...prev}; if(prev[oldName]!==undefined){n[newName]=n[oldName];delete n[oldName];} return n; });
  }

  function handleAddItem(areaName) {
    setItems(prev => [...prev, { description:'', category:areaName, quantity:1, unit:'units', unit_price:0, unit_cost:0, hours:0 }]);
  }

  function handleChangeItem(areaName, localIdx, key, value) {
    const areaItems = items.map((it,i)=>({it,i})).filter(x=>(x.it.category||'')===areaName);
    const globalIdx = areaItems[localIdx].i;
    setItems(prev => prev.map((it,i) => i===globalIdx ? {...it,[key]:value} : it));
  }

  function handleDeleteItem(areaName, localIdx) {
    const areaItems = items.map((it,i)=>({it,i})).filter(x=>(x.it.category||'')===areaName);
    const globalIdx = areaItems[localIdx].i;
    setItems(prev => prev.filter((_,i) => i!==globalIdx));
  }

  function handleDeleteArea(areaName) {
    setItems(prev => prev.filter(i => i.category !== areaName));
  }

  function handleSetProfit() {
    const pct = parseFloat(prompt('Enter target profit % for all work areas:', '30'));
    if (isNaN(pct)) return;
    setItems(prev => prev.map(it => {
      const cost = parseFloat(it.unit_cost) || 0;
      const newPrice = pct < 100 ? cost / (1 - pct/100) : cost;
      return { ...it, unit_price: parseFloat(newPrice.toFixed(2)) };
    }));
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

  if (loading) return <div style={{ color:'#64748b', padding:40, textAlign:'center' }}>Loading…</div>;

  // ── List view ──────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:'#1e293b', margin:0, fontSize:22, fontWeight:700, letterSpacing:'-0.02em' }}>STANDARD ESTIMATES</h2>
          <button onClick={() => navigate('/estimates/new/edit')}
            style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'8px 20px', cursor:'pointer', fontSize:14, fontWeight:600 }}>
            → New
          </button>
        </div>
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                {['Date','Customer','Project','Identifier #','Status','Price','Action'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', fontSize:12, color:'#64748b', textAlign:'left', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estimates.length === 0 && (
                <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>No estimates yet. Click <strong>→ New</strong> to create one.</td></tr>
              )}
              {estimates.map((e,i) => (
                <tr key={e.id} style={{ background: i%2===0?'#fff':'#f8fafc', borderBottom:'1px solid #e2e8f0', cursor:'pointer' }}
                  onMouseEnter={ev=>ev.currentTarget.style.background='#eff6ff'}
                  onMouseLeave={ev=>ev.currentTarget.style.background=i%2===0?'#fff':'#f8fafc'}>
                  <td style={{ padding:'10px 14px', color:'#64748b', fontSize:13 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
                  <td style={{ padding:'10px 14px', color:'#1e293b', fontSize:13 }}>{e.company_name || '—'}</td>
                  <td style={{ padding:'10px 14px', color:'#1e293b', fontSize:13 }}>{e.title}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ color:'#0f766e', fontWeight:600, fontSize:13 }}>{e.estimate_number}</span></td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{
                      background: e.status==='approved'?'#dcfce7':e.status==='sent'?'#dbeafe':e.status==='rejected'?'#fee2e2':'#f1f5f9',
                      color: e.status==='approved'?'#166534':e.status==='sent'?'#1d4ed8':e.status==='rejected'?'#991b1b':'#64748b',
                      borderRadius:4, padding:'2px 10px', fontSize:12, fontWeight:600, textTransform:'capitalize'
                    }}>{e.status}</span>
                  </td>
                  <td style={{ padding:'10px 14px', color:'#1e293b', fontWeight:600, fontSize:13 }}>{fmt$(e.total)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={() => navigate(`/estimates/${e.id}`)} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'4px 14px', cursor:'pointer', fontSize:12, fontWeight:600, marginRight:6 }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Editor ─────────────────────────────────────────────────────────────────
  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const inp = {
    background:'#fff', border:'1px solid #cbd5e1', borderRadius:4,
    color:'#1e293b', padding:'7px 10px', fontSize:14, width:'100%', boxSizing:'border-box', outline:'none',
  };
  const lbl = { color:'#64748b', fontSize:12, marginBottom:3, display:'block', fontWeight:500 };
  const fld = { marginBottom:14 };

  const clientName = companies.find(c=>c.id==form.company_id)?.name || '';
  const propertyName = properties.find(p=>p.id==form.property_id)?.name || '';
  const contact = contacts.find(c=>c.id==form.contact_id);

  return (
    <div style={{ background:'#f8fafc', minHeight:'100vh' }}>
      {/* Title bar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'12px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:18, color:'#64748b' }}>📋</span>
        <h2 style={{ color:'#1e293b', margin:0, fontSize:16, fontWeight:700, flex:1, textTransform:'uppercase', letterSpacing:'0.03em' }}>
          {form.title || 'New Estimate'}
        </h2>
        <span style={{ background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:4, padding:'2px 10px', fontSize:12, color:'#64748b' }}>UNLOCKED ▾</span>
      </div>

      {/* Tabs */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'0 24px', display:'flex', gap:0 }}>
        {[{ key:'customer', label:'Customer Info' }, { key:'workareas', label:'Workareas + Pricing' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background:'none', border:'none',
            borderBottom: tab===t.key ? '2px solid #0f766e' : '2px solid transparent',
            color: tab===t.key ? '#0f766e' : '#64748b',
            padding:'11px 18px', cursor:'pointer', fontSize:13, fontWeight:600, whiteSpace:'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {error && <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:4, color:'#991b1b', padding:'10px 16px', margin:'12px 24px' }}>{error}</div>}

      <div style={{ padding:24 }}>

        {/* ── Customer Info tab ──────────────────────────────────────────── */}
        {tab === 'customer' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24 }}>
              {/* Left — Estimate Information */}
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, padding:20 }}>
                <h3 style={{ color:'#1e293b', fontSize:15, fontWeight:700, margin:'0 0 16px 0' }}>Estimate Information</h3>
                <div style={fld}>
                  <label style={lbl}>Project Name</label>
                  <input value={form.title} onChange={f('title')} placeholder="Project name" style={inp} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div style={fld}>
                    <label style={lbl}>Estimate ID</label>
                    <input value={form.estimate_number||''} onChange={f('estimate_number')} placeholder="Auto-assigned" style={inp} />
                  </div>
                  <div style={fld}>
                    <label style={lbl}>Version #</label>
                    <input placeholder="Version" style={{ ...inp, color:'#94a3b8' }} disabled />
                  </div>
                </div>
                <div style={fld}>
                  <label style={lbl}>Estimate Date</label>
                  <input type="date" value={form.valid_until||''} onChange={f('valid_until')} style={inp} />
                </div>
                <div style={fld}>
                  <label style={lbl}>Estimate Close Date</label>
                  <input type="date" style={{ ...inp, color:'#94a3b8' }} />
                </div>
                <div style={fld}>
                  <label style={lbl}>Division</label>
                  <select value={form.division||''} onChange={f('division')} style={inp}>
                    <option value="">Select division…</option>
                    {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={fld}>
                  <label style={lbl}>Estimate Status</label>
                  <select value={form.status} onChange={f('status')} style={inp}>
                    {STATUSES.map(s => <option key={s} value={s} style={{ textTransform:'capitalize' }}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
                <div style={fld}>
                  <label style={lbl}>Notes</label>
                  <textarea value={form.notes||''} onChange={f('notes')} rows={3} placeholder="Notes…"
                    style={{ ...inp, resize:'vertical', fontFamily:'inherit' }} />
                </div>
              </div>

              {/* Right — Client Information */}
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, padding:20 }}>
                <h3 style={{ color:'#1e293b', fontSize:15, fontWeight:700, margin:'0 0 16px 0' }}>Client Information</h3>
                <div style={fld}>
                  <label style={lbl}>Client Name</label>
                  <select value={form.company_id||''} onChange={f('company_id')} style={inp}>
                    <option value="">Select client…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {clientName && (
                  <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:4, padding:'10px 12px', marginBottom:14, fontSize:13, color:'#1e293b' }}>
                    <strong>{clientName}</strong>
                  </div>
                )}
                <div style={fld}>
                  <label style={lbl}>Jobsite / Property</label>
                  <select value={form.property_id||''} onChange={f('property_id')} style={inp}>
                    <option value="">Select property…</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={fld}>
                  <label style={lbl}>Contact Name</label>
                  <select value={form.contact_id||''} onChange={f('contact_id')} style={inp}>
                    <option value="">Select contact…</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                {contact && (
                  <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:4, padding:'10px 12px', marginBottom:14, fontSize:13, color:'#64748b' }}>
                    <div>{contact.first_name} {contact.last_name}</div>
                    {contact.contact_email && <div style={{ color:'#3b82f6' }}>{contact.contact_email}</div>}
                  </div>
                )}
                <div style={fld}>
                  <label style={lbl}>Tax Rate (%)</label>
                  <input type="number" value={form.tax_rate||0} onChange={f('tax_rate')} min={0} max={100} step={0.1} style={inp} />
                </div>
              </div>
            </div>

            {/* Estimate Assignments (matches LMN bottom section) */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, padding:20 }}>
              <h3 style={{ color:'#1e293b', fontSize:15, fontWeight:700, margin:'0 0 20px 0' }}>Estimate Assignments</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24, alignItems:'start' }}>
                <div>
                  <div style={{ textAlign:'center', marginBottom:8 }}>
                    <span style={{ fontSize:32 }}>👤</span>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Salesperson</div>
                  </div>
                  <input value={form.salesperson||''} onChange={f('salesperson')} placeholder="Salesperson"
                    style={{ ...inp, textAlign:'center' }} />
                </div>
                <div>
                  <div style={{ textAlign:'center', marginBottom:8 }}>
                    <span style={{ fontSize:32 }}>✏️</span>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Estimator</div>
                  </div>
                  <input placeholder="Estimator" style={{ ...inp, textAlign:'center', color:'#94a3b8' }} />
                </div>
                <div>
                  <div style={{ textAlign:'center', marginBottom:8 }}>
                    <span style={{ fontSize:32 }}>👍</span>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Confidence Level</div>
                  </div>
                  {/* Block-style confidence (10 blocks like LMN) */}
                  <div style={{ display:'flex', gap:3, justifyContent:'center', marginBottom:6 }}>
                    {Array.from({length:10},(_,i) => {
                      const filled = i < Math.round((form.confidence||50)/10);
                      return (
                        <div key={i} onClick={()=>setForm(p=>({...p,confidence:(i+1)*10}))} style={{
                          width:24, height:24, borderRadius:3, cursor:'pointer',
                          background: filled ? '#0f766e' : '#e2e8f0',
                          transition:'background 0.15s',
                        }} />
                      );
                    })}
                  </div>
                  <div style={{ textAlign:'center', fontSize:14, fontWeight:700, color:'#0f766e' }}>{form.confidence||50}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Workareas + Pricing tab ────────────────────────────────────── */}
        {tab === 'workareas' && (
          <div>
            <SummaryBar items={items} />

            {/* Action buttons */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              <button onClick={handleAddArea} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                + Add Work Area
              </button>
              <button onClick={handleSetProfit} style={{ background:'#1d4ed8', border:'none', borderRadius:4, color:'#fff', padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                $ Set Profit
              </button>
            </div>

            {/* Work areas flat table */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                    <th style={{ padding:'9px 10px', width:120 }}></th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'center', fontWeight:600, letterSpacing:'0.04em', width:50 }}>ORDER</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'left', fontWeight:600, letterSpacing:'0.04em' }}>NAME</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'left', fontWeight:600, letterSpacing:'0.04em', width:80 }}>ID</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'left', fontWeight:600, letterSpacing:'0.04em', width:140 }}>COST CODE</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'left', fontWeight:600, letterSpacing:'0.04em', width:120 }}>NOTES</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'right', fontWeight:600, letterSpacing:'0.04em', width:70 }}>HRS</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'right', fontWeight:600, letterSpacing:'0.04em', width:110 }}>COGS</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'right', fontWeight:600, letterSpacing:'0.04em', width:110 }}>PRICE</th>
                    <th style={{ padding:'9px 10px', fontSize:11, color:'#64748b', textAlign:'right', fontWeight:600, letterSpacing:'0.04em', width:80 }}>PROFIT</th>
                  </tr>
                </thead>
                <tbody>
                  {workAreas.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>
                        No work areas yet. Click <strong style={{color:'#0f766e'}}>+ Add Work Area</strong> to get started.
                      </td>
                    </tr>
                  )}
                  {workAreas.map((areaName, idx) => (
                    <WorkAreaRow key={areaName}
                      idx={idx}
                      name={areaName}
                      items={getAreaItems(areaName)}
                      costCode={areaCostCodes[areaName] || form.division || ''}
                      isOpen={!!openAreas[areaName]}
                      onToggle={() => setOpenAreas(p => ({ ...p, [areaName]: !p[areaName] }))}
                      onRename={(newName) => handleRenameArea(areaName, newName)}
                      onChangeCostCode={(v) => setAreaCostCodes(p => ({ ...p, [areaName]: v }))}
                      onAddItem={() => handleAddItem(areaName)}
                      onChangeItem={(lIdx, k, v) => handleChangeItem(areaName, lIdx, k, v)}
                      onDeleteItem={(lIdx) => handleDeleteItem(areaName, lIdx)}
                      onDelete={() => handleDeleteArea(areaName)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar (matches LMN) */}
      <div style={{ background:'#fff', borderTop:'1px solid #e2e8f0', padding:'10px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', bottom:0 }}>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => navigate('/estimates')} style={{ background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:4, color:'#64748b', padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            ← Back to Estimates
          </button>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {error && <span style={{ color:'#dc2626', fontSize:13 }}>{error}</span>}
          <button style={{ background:'#1d4ed8', border:'none', borderRadius:4, color:'#fff', padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            Create Job
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            background:'#0f766e', border:'none', borderRadius:4, color:'#fff',
            padding:'7px 20px', cursor:'pointer', fontSize:13, fontWeight:700,
            opacity: saving ? 0.6 : 1
          }}>{saving ? 'Saving…' : '💾 Save'}</button>
        </div>
      </div>
    </div>
  );
}
