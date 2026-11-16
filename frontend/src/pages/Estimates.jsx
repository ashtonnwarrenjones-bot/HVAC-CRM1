import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = '/api';
const DIVISIONS = ['Landscape', 'Snow', 'Pavement', 'Facilities', 'Irrigation', 'Lighting', 'Hardscape', 'Other'];
const STATUSES = ['draft', 'sent', 'approved', 'rejected', 'converted', 'in_progress'];
const COST_CODES = ['Landscape', 'Snow', 'Pavement', 'Facilities', 'Irrigation', 'Lighting', 'Hardscape', 'Labor', 'Materials', 'Subcontract', 'Equipment', 'Other'];
const UNITS = ['each', 'hr', 'sqft', 'sqyd', 'lf', 'lb', 'ton', 'gal', 'day', 'mo', 'units'];
const RELATIONS = ['None', 'Renewal', 'Enhancement', 'Change Order', 'Rebid', 'New Client', 'Other'];
const REFERRALS = ['<UNKNOWN>', 'Door Hanger', 'Email', 'Facebook', 'Google', 'Instagram', 'Phone', 'Referral', 'Sign', 'Website', 'Word of Mouth', 'Other'];

function fmt$(n) { return '$' + (parseFloat(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtP(n) { return (parseFloat(n)||0).toFixed(1) + '%'; }
function fmtH(n) { return (parseFloat(n)||0).toFixed(2); }

// ── Summary Bar ───────────────────────────────────────────────────────────────
function SummaryBar({ items }) {
  const totalHours = items.reduce((s,i) => s + (parseFloat(i.hours)||0), 0);
  const totalCost  = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
  const subtotal   = items.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
  const profit     = subtotal - totalCost;
  const profitPct  = subtotal > 0 ? (profit / subtotal) * 100 : 0;
  const pctCol = profitPct >= 30 ? '#16a34a' : profitPct >= 15 ? '#d97706' : '#dc2626';
  const cell = { flex:1, padding:'10px 16px', borderRight:'1px solid #e2e8f0', textAlign:'center' };
  const lbl  = { fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 };
  const val  = { fontSize:16, fontWeight:700, color:'#1e293b' };
  return (
    <div style={{ display:'flex', alignItems:'stretch', background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:14, overflow:'hidden' }}>
      <div style={cell}><div style={lbl}>Man Hrs</div><div style={val}>{fmtH(totalHours)}</div></div>
      <div style={cell}><div style={lbl}>Total Cost</div><div style={val}>{fmt$(totalCost)}</div></div>
      <div style={cell}><div style={lbl}>Breakeven</div><div style={val}>{fmt$(totalCost)}</div></div>
      <div style={cell}><div style={lbl}>Subtotal</div><div style={val}>{fmt$(subtotal)}</div></div>
      <div style={{ ...cell, borderRight:'1px solid #e2e8f0' }}>
        <div style={lbl}>Total Price</div>
        <div style={val}>{fmt$(subtotal)}</div>
        <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>Includes Taxes: $0.00</div>
      </div>
      <div style={{ flex:1.3, padding:'10px 16px', textAlign:'center', background:'#f8fafc' }}>
        <div style={lbl}>Net Profit</div>
        <div style={{ fontSize:16, fontWeight:700, color: pctCol }}>{fmt$(profit)} <span style={{ fontSize:13 }}>{fmtP(profitPct)}</span></div>
      </div>
    </div>
  );
}

// ── Work area row (flat table, inline-expand like LMN) ────────────────────────
function WorkAreaRow({ name, items, costCode, isOpen, onToggle, onRename, onChangeCostCode, onAddItem, onChangeItem, onDeleteItem, onDelete, idx }) {
  const hrs   = items.reduce((s,i) => s + (parseFloat(i.hours)||0), 0);
  const cogs  = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
  const price = items.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
  const pctN  = price > 0 ? ((price-cogs)/price)*100 : 0;
  const pctCol= pctN >= 30 ? '#16a34a' : pctN >= 15 ? '#d97706' : '#dc2626';
  const rowBg = isOpen ? '#eff6ff' : (idx % 2 === 0 ? '#fff' : '#f8fafc');
  const inp = { background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, padding:'4px 8px', fontSize:13, color:'#1e293b', outline:'none' };

  return (
    <>
      {/* Summary row */}
      <tr style={{ background: rowBg, borderBottom:'1px solid #e2e8f0' }}>
        <td style={{ padding:'7px 8px', whiteSpace:'nowrap' }}>
          <div style={{ display:'flex', gap:3, alignItems:'center' }}>
            <button onClick={onToggle} style={{
              background: isOpen ? '#1d4ed8' : '#0f766e', border:'none', borderRadius:4,
              color:'#fff', padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:600, minWidth:48
            }}>{isOpen ? 'Close' : 'Edit'}</button>
            <select value="" onChange={e => { if(e.target.value==='delete') onDelete(); }} style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, fontSize:11, padding:'3px 2px', cursor:'pointer', color:'#64748b', width:28 }}>
              <option value="">▾</option>
              <option value="delete">Delete</option>
            </select>
          </div>
        </td>
        <td style={{ padding:'7px 8px', color:'#64748b', fontSize:13, textAlign:'center', width:40 }}>{idx+1}</td>
        <td style={{ padding:'7px 10px' }}>
          {isOpen
            ? <input value={name} onChange={e=>onRename(e.target.value)} style={{ ...inp, minWidth:200 }} />
            : <span style={{ color:'#1e293b', fontWeight:500, fontSize:13 }}>{name||'(unnamed)'}</span>}
        </td>
        <td style={{ padding:'7px 8px', color:'#94a3b8', fontSize:12 }}>—</td>
        <td style={{ padding:'7px 8px' }}>
          {isOpen
            ? <select value={costCode||''} onChange={e=>onChangeCostCode(e.target.value)} style={{ ...inp, minWidth:130 }}>
                {COST_CODES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            : <span style={{ color:'#64748b', fontSize:13 }}>{costCode||'—'}</span>}
        </td>
        <td style={{ padding:'7px 8px', color:'#94a3b8', fontSize:12 }}>—</td>
        <td style={{ padding:'7px 8px', color:'#1e293b', fontSize:13, textAlign:'right' }}>{fmtH(hrs)}</td>
        <td style={{ padding:'7px 8px', color:'#1e293b', fontSize:13, textAlign:'right' }}>{fmt$(cogs)}</td>
        <td style={{ padding:'7px 8px', color:'#1e293b', fontWeight:600, fontSize:13, textAlign:'right' }}>{fmt$(price)}</td>
        <td style={{ padding:'7px 8px', color:pctCol, fontWeight:700, fontSize:13, textAlign:'right' }}>{fmtP(pctN)}</td>
      </tr>

      {/* Expanded line items */}
      {isOpen && (
        <tr style={{ background:'#eff6ff' }}>
          <td colSpan={10} style={{ padding:0, borderBottom:'2px solid #3b82f6' }}>
            <div style={{ padding:'0 16px 14px' }}>
              {/* Sub-action buttons row (like LMN) */}
              <div style={{ display:'flex', gap:6, padding:'10px 0 10px', borderBottom:'1px solid #dbeafe', marginBottom:10, flexWrap:'wrap' }}>
                <button style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:500 }}>$ Edit Pricing</button>
                <button style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:500 }}>≡ Edit Notes</button>
                <button style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:500 }}>$ Edit Taxes</button>
                <button onClick={onAddItem} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'4px 12px', cursor:'pointer', fontSize:12, fontWeight:600, marginLeft:'auto' }}>
                  + Add Items + Templates
                </button>
              </div>

              {/* Line items table */}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#dbeafe' }}>
                    <th style={{ width:28, padding:'5px 6px' }}></th>
                    {['Order','Name','Qty','Units','Unit Cost','Unit Price','Profit %','Total Cost','Total Price',''].map((h,i) => (
                      <th key={i} style={{ padding:'5px 8px', fontSize:11, color:'#1d4ed8', textAlign: i>1?'right':'left', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.03em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, lIdx) => {
                    const lCogs  = (parseFloat(item.unit_cost)||0)*(parseFloat(item.quantity)||1);
                    const lPrice = (parseFloat(item.unit_price)||0)*(parseFloat(item.quantity)||1);
                    const lPct   = lPrice > 0 ? ((lPrice-lCogs)/lPrice)*100 : 0;
                    const lCol   = lPct >= 30 ? '#16a34a' : lPct >= 15 ? '#d97706' : '#dc2626';
                    const lineInp = { background:'#fff', border:'1px solid #cbd5e1', borderRadius:3, padding:'3px 6px', fontSize:13, color:'#1e293b', outline:'none', width:'100%' };
                    return (
                      <tr key={lIdx} style={{ background: lIdx%2===0?'#fff':'#f0f9ff', borderBottom:'1px solid #dbeafe' }}>
                        <td style={{ padding:'4px 6px', textAlign:'center' }}>
                          <input type="checkbox" style={{ cursor:'pointer', width:14, height:14 }} />
                        </td>
                        <td style={{ padding:'4px 8px', color:'#64748b', fontSize:12, textAlign:'center', width:36 }}>{lIdx+1}</td>
                        <td style={{ padding:'4px 8px', minWidth:180 }}>
                          <input value={item.description||''} placeholder="Item name" onChange={e=>onChangeItem(lIdx,'description',e.target.value)} style={lineInp} />
                        </td>
                        <td style={{ padding:'4px 8px', width:60 }}>
                          <input type="number" value={item.quantity||''} placeholder="1" onChange={e=>onChangeItem(lIdx,'quantity',e.target.value)} style={{ ...lineInp, textAlign:'right' }} />
                        </td>
                        <td style={{ padding:'4px 8px', width:80 }}>
                          <select value={item.unit||'units'} onChange={e=>onChangeItem(lIdx,'unit',e.target.value)} style={{ ...lineInp }}>
                            {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={{ padding:'4px 8px', width:100 }}>
                          <input type="number" value={item.unit_cost||''} placeholder="0.00" onChange={e=>onChangeItem(lIdx,'unit_cost',e.target.value)} style={{ ...lineInp, textAlign:'right' }} />
                        </td>
                        <td style={{ padding:'4px 8px', width:100 }}>
                          <input type="number" value={item.unit_price||''} placeholder="0.00" onChange={e=>onChangeItem(lIdx,'unit_price',e.target.value)} style={{ ...lineInp, textAlign:'right' }} />
                        </td>
                        <td style={{ padding:'4px 8px', width:90, textAlign:'right' }}>
                          <span style={{ background: lCol+'22', color: lCol, borderRadius:3, padding:'2px 7px', fontSize:12, fontWeight:700 }}>{fmtP(lPct)}</span>
                        </td>
                        <td style={{ padding:'4px 8px', width:110, textAlign:'right', color:'#64748b', fontSize:13 }}>{fmt$(lCogs)}</td>
                        <td style={{ padding:'4px 8px', width:110, textAlign:'right', color:'#1e293b', fontWeight:500, fontSize:13 }}>{fmt$(lPrice)}</td>
                        <td style={{ padding:'4px 8px', width:30 }}>
                          <button onClick={()=>onDeleteItem(lIdx)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:15, padding:0 }}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length > 0 && (
                    <tr style={{ background:'#dbeafe', fontWeight:700 }}>
                      <td colSpan={6} style={{ padding:'5px 8px', fontSize:12, color:'#1d4ed8', paddingLeft:36 }}>Subtotal</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontSize:12, color: pctCol }}>{fmtP(pctN)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontSize:13, color:'#1e293b' }}>{fmt$(cogs)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontSize:13, color:'#1e293b' }}>{fmt$(price)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
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
  const isList = !id;
  const isNew = id === 'new';
  const isExisting = !!id && id !== 'new';

  const [tab, setTab] = useState('customer');
  const [loading, setLoading] = useState(isExisting);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showChangeClient, setShowChangeClient] = useState(false);
  const [form, setForm] = useState({
    title:'', estimate_number:'', status:'draft', valid_until:'', close_date:'',
    division:'', salesperson:'', estimator:'', confidence:50, notes:'', tax_rate:0,
    company_id:'', property_id:'', contact_id:'', exclude_stats: false,
    relations:'None', referral:'<UNKNOWN>', ref_note:'',
  });
  const [items, setItems] = useState([]);
  const [openAreas, setOpenAreas] = useState({});
  const [areaCostCodes, setAreaCostCodes] = useState({});
  const [companies, setCompanies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [estimates, setEstimates] = useState([]);

  useEffect(() => {
    if (isList) {
      fetch(`${API}/estimates`).then(r=>r.json()).then(d=>setEstimates(Array.isArray(d)?d:[])).catch(()=>{});
    } else {
      fetch(`${API}/companies`).then(r=>r.json()).then(d=>setCompanies(Array.isArray(d)?d:[])).catch(()=>{});
      fetch(`${API}/contacts`).then(r=>r.json()).then(d=>setContacts(Array.isArray(d)?d:[])).catch(()=>{});
      if (isExisting) {
        setLoading(true);
        fetch(`${API}/estimates/${id}`).then(r=>r.json()).then(data => {
          const { items: its, ...est } = data;
          setForm(f => ({ ...f, ...est }));
          setItems(its || []);
          setLoading(false);
        }).catch(() => setLoading(false));
      }
    }
  }, [id]);

  useEffect(() => {
    if (form.company_id) {
      fetch(`${API}/properties?company_id=${form.company_id}`).then(r=>r.json()).then(d=>setProperties(Array.isArray(d)?d:[])).catch(()=>{});
    }
  }, [form.company_id]);

  const workAreas = [...new Set(items.map(i => i.category||''))].filter(Boolean);
  const getAreaItems = aName => items.filter(i => (i.category||'') === aName);

  function handleAddArea() {
    const name = `Work Area ${workAreas.length + 1}`;
    setItems(p => [...p, { description:'To Be Determined', category:name, quantity:1, unit:'units', unit_price:0, unit_cost:0, hours:0 }]);
    setOpenAreas(p => ({ ...p, [name]: true }));
    setAreaCostCodes(p => ({ ...p, [name]: form.division || 'Other' }));
  }

  function handleRenameArea(oldName, newName) {
    setItems(p => p.map(i => i.category===oldName ? {...i,category:newName} : i));
    setOpenAreas(p => { const n={...p}; if(p[oldName]!==undefined){n[newName]=n[oldName];delete n[oldName];} return n; });
    setAreaCostCodes(p => { const n={...p}; if(p[oldName]!==undefined){n[newName]=n[oldName];delete n[oldName];} return n; });
  }

  function handleChangeItem(aName, lIdx, key, val) {
    const aItems = items.map((it,i)=>({it,i})).filter(x=>(x.it.category||'')===aName);
    const gIdx = aItems[lIdx].i;
    setItems(p => p.map((it,i) => i===gIdx ? {...it,[key]:val} : it));
  }

  function handleDeleteItem(aName, lIdx) {
    const aItems = items.map((it,i)=>({it,i})).filter(x=>(x.it.category||'')===aName);
    const gIdx = aItems[lIdx].i;
    setItems(p => p.filter((_,i) => i!==gIdx));
  }

  function handleSetProfit() {
    const pct = parseFloat(prompt('Enter target profit % for all items:','30'));
    if (isNaN(pct)) return;
    setItems(p => p.map(it => {
      const cost = parseFloat(it.unit_cost)||0;
      const newPrice = pct < 100 ? cost/(1-pct/100) : cost;
      return {...it, unit_price: parseFloat(newPrice.toFixed(2))};
    }));
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const payload = { ...form, items };
      const url = isExisting ? `${API}/estimates/${id}` : `${API}/estimates`;
      const method = isExisting ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error||'Save failed');
      if (!isExisting) navigate(`/estimates/${data.id}`);
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!isExisting) return;
    if (!window.confirm('Delete this estimate? This cannot be undone.')) return;
    await fetch(`${API}/estimates/${id}`, { method:'DELETE' });
    navigate('/estimates');
  }

  if (loading) return <div style={{ color:'#64748b', padding:40, textAlign:'center' }}>Loading…</div>;

  // ── List view ──────────────────────────────────────────────────────────────
  if (isList) {
    return (
      <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:'#1e293b', margin:0, fontSize:22, fontWeight:700, letterSpacing:'-0.02em' }}>STANDARD ESTIMATES</h2>
          <button onClick={() => navigate('/estimates/new')}
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
                <tr key={e.id} style={{ background:i%2===0?'#fff':'#f8fafc', borderBottom:'1px solid #e2e8f0', cursor:'pointer' }}
                  onMouseEnter={ev=>ev.currentTarget.style.background='#eff6ff'}
                  onMouseLeave={ev=>ev.currentTarget.style.background=i%2===0?'#fff':'#f8fafc'}>
                  <td style={{ padding:'10px 14px', color:'#64748b', fontSize:13 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
                  <td style={{ padding:'10px 14px', color:'#1e293b', fontSize:13 }}>{e.company_name||'—'}</td>
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
                    <button onClick={() => navigate(`/estimates/${e.id}`)} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'4px 14px', cursor:'pointer', fontSize:12, fontWeight:600 }}>Edit</button>
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
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const inp = { background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'7px 10px', fontSize:14, width:'100%', boxSizing:'border-box', outline:'none' };
  const lbl = { color:'#64748b', fontSize:12, marginBottom:3, display:'block', fontWeight:500 };
  const fld = { marginBottom:14 };

  const clientCompany = companies.find(c => c.id == form.company_id);
  const clientProperty = properties.find(p => p.id == form.property_id);
  const clientContact  = contacts.find(c => c.id == form.contact_id);

  return (
    <div style={{ background:'#f8fafc', minHeight:'100vh', paddingBottom:70 }}>
      {/* Title bar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'10px 24px', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:20, color:'#64748b' }}>📋</span>
        <h2 style={{ color:'#1e293b', margin:0, fontSize:16, fontWeight:700, flex:1, textTransform:'uppercase', letterSpacing:'0.03em' }}>
          {form.title || 'New Estimate'}
        </h2>
        <span style={{ background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:4, padding:'2px 10px', fontSize:12, color:'#64748b' }}>UNLOCKED ▾</span>
      </div>

      {/* Tabs */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'0 24px', display:'flex', overflowX:'auto' }}>
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

      <div style={{ padding:'20px 24px' }}>

        {/* ── Customer Info ─────────────────────────────────────────────── */}
        {tab === 'customer' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

              {/* LEFT — Estimate Information */}
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
                  <label style={lbl}>Relations</label>
                  <select value={form.relations||'None'} onChange={f('relations')} style={inp}>
                    {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div style={fld}>
                    <label style={lbl}>Estimate Date</label>
                    <input type="date" value={form.valid_until||''} onChange={f('valid_until')} style={inp} />
                  </div>
                  <div style={fld}>
                    <label style={lbl}>Estimate Close Date</label>
                    <input type="date" value={form.close_date||''} onChange={f('close_date')} style={inp} />
                  </div>
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
                    {STATUSES.map(s => <option key={s} value={s} style={{textTransform:'capitalize'}}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div style={fld}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                    <input type="checkbox" checked={!!form.exclude_stats} onChange={e=>setForm(p=>({...p,exclude_stats:e.target.checked}))} style={{ width:16, height:16, cursor:'pointer' }} />
                    <span style={{ fontSize:13, color:'#64748b' }}>Exclude from Stats? <span style={{ fontSize:11, color:'#94a3b8' }}>Excludes this estimate from dashboard stats + CRM reports</span></span>
                  </label>
                </div>
                <div style={fld}>
                  <label style={lbl}>Notes</label>
                  <textarea value={form.notes||''} onChange={f('notes')} rows={3} placeholder="Notes…"
                    style={{ ...inp, resize:'vertical', fontFamily:'inherit' }} />
                </div>
              </div>

              {/* RIGHT — Client Information */}
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, padding:20 }}>
                <h3 style={{ color:'#1e293b', fontSize:15, fontWeight:700, margin:'0 0 16px 0' }}>Client Information</h3>

                {!showChangeClient && clientCompany ? (
                  /* Read-only display with editable Referral + Ref. Note (like LMN) */
                  <div>
                    {[
                      ['Client Name', clientCompany?.name, true],
                      ['Billing Address', clientCompany?.address || '—', false],
                      ['Contact Name', clientContact ? `${clientContact.first_name} ${clientContact.last_name}` : '—', false],
                      ['Contact Info', clientContact?.contact_email || '—', false],
                      ['Jobsite Name', clientProperty?.name || '—', false],
                      ['Jobsite Address', clientProperty?.address || '—', false],
                    ].map(([label, val, bold]) => (
                      <div key={label} style={{ display:'flex', alignItems:'center', borderBottom:'1px solid #f1f5f9', padding:'7px 0', gap:12 }}>
                        <span style={{ color:'#64748b', fontSize:13, minWidth:130, flexShrink:0, fontWeight:500 }}>{label}</span>
                        <span style={{ color:'#1e293b', fontSize:13, fontWeight: bold?700:400 }}>{val}</span>
                      </div>
                    ))}
                    {/* Referral — editable dropdown even in display mode */}
                    <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid #f1f5f9', padding:'5px 0', gap:12 }}>
                      <span style={{ color:'#64748b', fontSize:13, minWidth:130, flexShrink:0, fontWeight:500 }}>Referral</span>
                      <select value={form.referral||'<UNKNOWN>'} onChange={f('referral')} style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'4px 8px', fontSize:13, flex:1 }}>
                        {REFERRALS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    {/* Ref. Note — editable text */}
                    <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid #f1f5f9', padding:'5px 0', gap:12 }}>
                      <span style={{ color:'#64748b', fontSize:13, minWidth:130, flexShrink:0, fontWeight:500 }}>Ref. Note</span>
                      <input value={form.ref_note||''} onChange={f('ref_note')} placeholder="Referral Notes"
                        style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'4px 8px', fontSize:13, flex:1 }} />
                    </div>
                    <div style={{ marginTop:12, display:'flex', gap:8 }}>
                      <button onClick={() => {}} style={{ background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:4, color:'#64748b', padding:'6px 12px', cursor:'pointer', fontSize:12 }}>📍 Map Site</button>
                      <button onClick={() => setShowChangeClient(true)} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:600 }}>🔗 Change Client/Jobsite</button>
                    </div>
                  </div>
                ) : (
                  /* Dropdowns to select client */
                  <div>
                    <div style={fld}>
                      <label style={lbl}>Client Name</label>
                      <select value={form.company_id||''} onChange={f('company_id')} style={inp}>
                        <option value="">Select client…</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
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
                    <div style={fld}>
                      <label style={lbl}>Tax Rate (%)</label>
                      <input type="number" value={form.tax_rate||0} onChange={f('tax_rate')} min={0} max={100} step={0.1} style={inp} />
                    </div>
                    {clientCompany && (
                      <button onClick={() => setShowChangeClient(false)} style={{ background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:4, color:'#64748b', padding:'6px 14px', cursor:'pointer', fontSize:12 }}>Cancel</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Estimate Assignments */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, padding:20 }}>
              <h3 style={{ color:'#1e293b', fontSize:15, fontWeight:700, margin:'0 0 20px 0' }}>Estimate Assignments</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:24, alignItems:'start' }}>
                {/* Salesperson */}
                <div>
                  <div style={{ textAlign:'center', marginBottom:8 }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" style={{ display:'block', margin:'0 auto' }}>
                      <circle cx="20" cy="14" r="8" fill="#94a3b8"/>
                      <rect x="6" y="26" width="28" height="10" rx="5" fill="#94a3b8"/>
                      <rect x="24" y="22" width="14" height="10" rx="3" fill="#64748b"/>
                      <polyline points="26,26 29,29 34,24" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:4, fontWeight:500 }}>Salesperson</div>
                  </div>
                  <select value={form.salesperson||''} onChange={f('salesperson')} style={{ ...inp, textAlign:'center' }}>
                    <option value="">Select…</option>
                    {contacts.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
                    <option value="ashtonnwarrenjones">ashtonnwarrenjones</option>
                  </select>
                </div>
                {/* Estimator */}
                <div>
                  <div style={{ textAlign:'center', marginBottom:8 }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" style={{ display:'block', margin:'0 auto' }}>
                      <circle cx="18" cy="14" r="8" fill="#94a3b8"/>
                      <rect x="4" y="26" width="24" height="10" rx="5" fill="#94a3b8"/>
                      <line x1="28" y1="20" x2="36" y2="28" stroke="#64748b" strokeWidth="3" strokeLinecap="round"/>
                      <circle cx="28" cy="20" r="2.5" fill="#64748b"/>
                    </svg>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:4, fontWeight:500 }}>Estimator</div>
                  </div>
                  <select value={form.estimator||''} onChange={f('estimator')} style={{ ...inp, textAlign:'center' }}>
                    <option value="">Select…</option>
                    {contacts.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
                    <option value="ashtonnwarrenjones">ashtonnwarrenjones</option>
                  </select>
                </div>
                {/* Confidence Level */}
                <div>
                  <div style={{ textAlign:'center', marginBottom:8 }}>
                    <div style={{ fontSize:32, lineHeight:1 }}>👍</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:4, fontWeight:500 }}>Confidence Level</div>
                  </div>
                  <div style={{ display:'flex', gap:3, justifyContent:'center', marginBottom:6 }}>
                    {Array.from({length:10},(_,i) => {
                      const filled = i < Math.round((form.confidence||50)/10);
                      return (
                        <div key={i} onClick={()=>setForm(p=>({...p,confidence:(i+1)*10}))} style={{
                          width:22, height:22, borderRadius:3, cursor:'pointer',
                          background: filled ? '#0f766e' : '#e2e8f0',
                        }} />
                      );
                    })}
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <span style={{ background:'#0f766e', color:'#fff', borderRadius:4, padding:'2px 12px', fontSize:13, fontWeight:700 }}>{form.confidence||50}%</span>
                  </div>
                </div>
                {/* Updated By */}
                <div>
                  <div style={{ textAlign:'center', marginBottom:8 }}>
                    <div style={{ fontSize:32, lineHeight:1 }}>👥</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:4, fontWeight:500 }}>Updated By</div>
                  </div>
                  <div style={{ textAlign:'center', fontSize:13, color:'#64748b', paddingTop:10 }}>
                    <div style={{ fontWeight:500, color:'#1e293b' }}>ashtonnwarrenjones</div>
                    <div style={{ fontSize:11, marginTop:3 }}>{new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Workareas + Pricing ───────────────────────────────────────── */}
        {tab === 'workareas' && (
          <div>
            <SummaryBar items={items} />

            {/* Action buttons */}
            <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
              <button onClick={handleAddArea} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                + Add Work Area
              </button>
              <button style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'7px 12px', cursor:'pointer', fontSize:13 }}>
                Auto ID
              </button>
              <button style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'7px 12px', cursor:'pointer', fontSize:13 }}>
                Edit Taxes
              </button>
              <button onClick={handleSetProfit} style={{ background:'#1d4ed8', border:'none', borderRadius:4, color:'#fff', padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                $ Set Profit
              </button>
              <button style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'7px 12px', cursor:'pointer', fontSize:13 }}>
                ↻ Refresh Pricing
              </button>
            </div>

            {/* Flat work area table */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                    <th style={{ padding:'8px 10px', width:116 }}></th>
                    {['Order','Name','ID','Cost Code','Notes','Hrs','COGS','Price','Profit'].map((h,i) => (
                      <th key={h} style={{ padding:'8px 10px', fontSize:11, color:'#64748b', textAlign: i>4?'right':'left', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workAreas.length === 0 && (
                    <tr><td colSpan={10} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>
                      No work areas yet. Click <strong style={{color:'#0f766e'}}>+ Add Work Area</strong> to get started.
                    </td></tr>
                  )}
                  {workAreas.map((areaName, idx) => (
                    <WorkAreaRow key={areaName} idx={idx}
                      name={areaName}
                      items={getAreaItems(areaName)}
                      costCode={areaCostCodes[areaName]||form.division||''}
                      isOpen={!!openAreas[areaName]}
                      onToggle={() => setOpenAreas(p=>({...p,[areaName]:!p[areaName]}))}
                      onRename={n => handleRenameArea(areaName, n)}
                      onChangeCostCode={v => setAreaCostCodes(p=>({...p,[areaName]:v}))}
                      onAddItem={() => setItems(p=>[...p,{description:'',category:areaName,quantity:1,unit:'units',unit_price:0,unit_cost:0,hours:0}])}
                      onChangeItem={(lIdx,k,v) => handleChangeItem(areaName,lIdx,k,v)}
                      onDeleteItem={lIdx => handleDeleteItem(areaName,lIdx)}
                      onDelete={() => setItems(p=>p.filter(i=>i.category!==areaName))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom action bar — matches LMN layout */}
      <div style={{ background:'#1e293b', borderTop:'2px solid #0f766e', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'fixed', bottom:0, left:0, right:0, zIndex:50 }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => navigate('/estimates')} style={{ background:'#334155', border:'none', borderRadius:4, color:'#e2e8f0', padding:'7px 13px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
            ◀ Back to Estimates
          </button>
          <button onClick={() => navigate('/')} style={{ background:'#334155', border:'none', borderRadius:4, color:'#e2e8f0', padding:'7px 13px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
            ◀ Back to CRM
          </button>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {error && <span style={{ color:'#fca5a5', fontSize:12 }}>{error}</span>}
          <button style={{ background:'#1d4ed8', border:'none', borderRadius:4, color:'#fff', padding:'7px 13px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            ▷ Create Job
          </button>
          <button style={{ background:'#0369a1', border:'none', borderRadius:4, color:'#fff', padding:'7px 13px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            → Mark for QB Export
          </button>
          <button style={{ background:'#334155', border:'1px solid #475569', borderRadius:4, color:'#e2e8f0', padding:'7px 13px', cursor:'pointer', fontSize:12 }}>
            📄 Save Template
          </button>
          <div style={{ position:'relative' }}>
            <button style={{ background:'#334155', border:'1px solid #475569', borderRadius:4, color:'#e2e8f0', padding:'7px 13px', cursor:'pointer', fontSize:12 }}>
              ⚙ Manage ▾
            </button>
          </div>
          {isExisting && (
            <button onClick={handleDelete} style={{ background:'#dc2626', border:'none', borderRadius:4, color:'#fff', padding:'7px 13px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
              🗑 Delete
            </button>
          )}
          <button onClick={handleSave} disabled={saving} style={{
            background:'#0f766e', border:'none', borderRadius:4, color:'#fff',
            padding:'7px 20px', cursor:'pointer', fontSize:13, fontWeight:700, opacity:saving?0.6:1
          }}>{saving ? 'Saving…' : '💾 Save'}</button>
        </div>
      </div>
    </div>
  );
}
