import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = '/api';
const DIVISIONS = ['Landscape', 'Snow', 'Pavement', 'Facilities', 'Irrigation', 'Lighting', 'Hardscape', 'Other'];
const STATUSES = ['draft', 'sent', 'approved', 'won', 'rejected', 'converted', 'in_progress'];
const COST_CODES = ['Landscape', 'Snow', 'Pavement', 'Facilities', 'Irrigation', 'Lighting', 'Hardscape', 'Labor', 'Materials', 'Subcontract', 'Equipment', 'Other'];
const UNITS = ['each', 'hr', 'sqft', 'sqyd', 'lf', 'lb', 'ton', 'gal', 'day', 'mo', 'units'];
const RELATIONS = ['None', 'Renewal', 'Enhancement', 'Change Order', 'Rebid', 'New Client', 'Other'];
const REFERRALS = ['<UNKNOWN>', 'Door Hanger', 'Email', 'Facebook', 'Google', 'Instagram', 'Phone', 'Referral', 'Sign', 'Website', 'Word of Mouth', 'Other'];

function fmt$(n) { return '$' + (parseFloat(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtP(n) { return (parseFloat(n)||0).toFixed(1) + '%'; }
function fmtH(n) { return (parseFloat(n)||0).toFixed(2); }

// ── Catalog data for Add Items drawer ────────────────────────────────────────
const CATALOG = {
  Labor: [
    { name:'+Fertilization', units:'Hours', avgWage:22 },
    { name:'+Herbicide Spray', units:'Hours', avgWage:22 },
    { name:'+Irrigation Start Up/Repairs', units:'Hours', avgWage:36 },
    { name:'+Irrigation Winterization', units:'Hours', avgWage:36 },
    { name:'+Landscape', units:'Hours', avgWage:22 },
    { name:'+Simplified Services', units:'Hours', avgWage:22 },
    { name:'+Snow- ATV/Snowrator', units:'Hours', avgWage:20 },
    { name:'+Snow- Backhoe/Skid', units:'Hours', avgWage:30 },
    { name:'+Snow- Plow Truck', units:'Hours', avgWage:30 },
    { name:'+Snow- Shovel/Sidewalks', units:'Hours', avgWage:20 },
    { name:'Dayporting Labor', units:'Hours', avgWage:25 },
    { name:'Dayporting Labor ($18/HR)', units:'Hours', avgWage:18 },
    { name:'Facilities Crew Labor', units:'Hours', avgWage:25 },
    { name:'Irrigation Labor Rate', units:'Hours', avgWage:35 },
    { name:'Irrigation Repair Labor', units:'Hours', avgWage:36 },
  ],
  Equip: [
    { name:'Skid Steer', units:'hr', avgWage:85 },
    { name:'Mini Excavator', units:'hr', avgWage:95 },
    { name:'Dump Truck', units:'hr', avgWage:75 },
    { name:'Plow Truck', units:'hr', avgWage:65 },
    { name:'Zero Turn Mower', units:'hr', avgWage:45 },
    { name:'Walk-Behind Mower', units:'hr', avgWage:30 },
    { name:'Blower/Trimmer', units:'hr', avgWage:20 },
  ],
  Material: [
    { name:'Mulch (bulk)', units:'yd³', avgWage:38 },
    { name:'Rock/Gravel', units:'ton', avgWage:42 },
    { name:'Topsoil', units:'yd³', avgWage:35 },
    { name:'Seed Mix', units:'lb', avgWage:4 },
    { name:'Fertilizer', units:'lb', avgWage:3 },
    { name:'Herbicide', units:'gal', avgWage:28 },
    { name:'Irrigation Pipe (1")', units:'lf', avgWage:1.5 },
    { name:'Irrigation Head', units:'each', avgWage:12 },
    { name:'Salt/Ice Melt', units:'lb', avgWage:0.4 },
    { name:'Concrete (3000psi)', units:'yd³', avgWage:155 },
  ],
  Subs: [
    { name:'Subcontract - Electrical', units:'each', avgWage:0 },
    { name:'Subcontract - Fencing', units:'lf', avgWage:0 },
    { name:'Subcontract - Paving', units:'sqft', avgWage:0 },
    { name:'Subcontract - Striping', units:'lf', avgWage:0 },
    { name:'Subcontract - Concrete', units:'sqft', avgWage:0 },
  ],
  Other: [
    { name:'Permit Fee', units:'each', avgWage:0 },
    { name:'Disposal Fee', units:'each', avgWage:0 },
    { name:'Equipment Rental', units:'day', avgWage:0 },
    { name:'Mobilization', units:'each', avgWage:0 },
  ],
  Templates: [
    { name:'Backflow cover and concrete', desc:'Backflow cover and concrete per spec.' },
    { name:'Concrete Grinding', desc:'Grind concrete flat in the spots that are raised. This will help prevent trip hazards for customers.' },
    { name:'Concrete Repair', desc:'Along the stone front there are multiple large cracks and holes of concrete. We will clean these out and patch them.' },
    { name:'Docker Canal', desc:'Clean out canal on south side of property. This includes all trash and furniture built up from the winter.' },
    { name:'IRR - Irrigation Repairs', desc:'Site will be visited and monitored roughly 1 time per week to ensure proper irrigation function.' },
    { name:'IRR - Irrigation Startup T&M', desc:'Turn on system run through valves to verify: 1. Adequate water coverage, 2. All Heads and Valves are functioning.' },
    { name:'LAN - Aeration', desc:'Core aeration to all turf areas performed in the spring to promote healthy soil and turf. Does not include disposal of plugs.' },
    { name:'LAN - Fall Cleanup', desc:'A one time service consisting of all beds, trimming of needed perennials, removal of summer annuals, leaf removal and final pick up from turf and beds.' },
    { name:'LAN - First Time Cleanup', desc:'A one time service to remove all weeds, mowing and trimming, cleaning, and removing trash.' },
    { name:'LAN - Hard Surface Weed Control', desc:'Spraying of all unwanted weeds in hardscapes, parking lot and or other hard surfaces.' },
    { name:'LAN - Lawn Fertilization and Weed Control', desc:'Custom fertilizer service consisting of a controlled-slow release pre-emergent application to promote growth, color, and overall health of turf.' },
  ],
};

// ── Add Items + Templates Drawer ──────────────────────────────────────────────
function AddItemsDrawer({ open, onClose, onAddItem, activeArea }) {
  const [drawerTab, setDrawerTab] = useState('Labor');
  const [search, setSearch] = useState('');
  const [templateCat, setTemplateCat] = useState('ANY');

  const tabs = ['Labor','Equip','Material','Subs','Other','Templates'];

  const results = (() => {
    const list = CATALOG[drawerTab] || [];
    const q = search.toLowerCase();
    return list.filter(i => !q || i.name.toLowerCase().includes(q) || (i.desc||'').toLowerCase().includes(q));
  })();

  if (!open) return null;

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:400, background:'#fff', boxShadow:'-4px 0 24px rgba(0,0,0,0.18)', zIndex:200, display:'flex', flexDirection:'column', borderLeft:'2px solid #0f766e' }}>
      {/* Header tabs */}
      <div style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0', padding:'0 12px', display:'flex', alignItems:'center', gap:0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => { setDrawerTab(t); setSearch(''); }} style={{
            background:'none', border:'none',
            borderBottom: drawerTab===t ? '2px solid #0f766e' : '2px solid transparent',
            color: drawerTab===t ? '#0f766e' : '#64748b',
            padding:'11px 10px', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap'
          }}>{t}</button>
        ))}
        <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:20, padding:'0 8px', lineHeight:1 }}>✕</button>
      </div>

      {/* Search + New button */}
      <div style={{ padding:'10px 12px', borderBottom:'1px solid #e2e8f0', display:'flex', gap:6 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type to Search"
          style={{ flex:1, border:'1px solid #cbd5e1', borderRadius:4, padding:'6px 10px', fontSize:13, color:'#1e293b', outline:'none' }} />
        {drawerTab === 'Templates' && (
          <select value={templateCat} onChange={e=>setTemplateCat(e.target.value)}
            style={{ border:'1px solid #cbd5e1', borderRadius:4, padding:'6px 8px', fontSize:12, color:'#64748b', background:'#fff' }}>
            <option value="ANY">[ANY]</option>
            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <button style={{ background:'#16a34a', border:'none', borderRadius:4, color:'#fff', padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:700 }}>+ New</button>
      </div>

      {/* Results count */}
      <div style={{ padding:'6px 12px', fontSize:12, color:'#64748b', borderBottom:'1px solid #f1f5f9' }}>
        Results ({results.length})
      </div>

      {/* Results list */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {results.map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', padding:'9px 12px', borderBottom:'1px solid #f1f5f9', gap:10,
            background: i%2===0?'#fff':'#fafafa' }}
            onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'}
            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafa'}>
            <button onClick={() => {
              onAddItem({
                description: item.name,
                category: activeArea,
                quantity: 1,
                unit: item.units || 'units',
                unit_cost: item.avgWage || 0,
                unit_price: item.avgWage ? parseFloat((item.avgWage / 0.75).toFixed(2)) : 0,
                hours: item.units === 'Hours' || item.units === 'hr' ? 1 : 0,
              });
            }} style={{ background:'#16a34a', border:'none', borderRadius:4, color:'#fff', width:24, height:24, cursor:'pointer', fontSize:16, lineHeight:'24px', padding:0, flexShrink:0, marginTop:1 }}>+</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:'#1e293b', fontWeight:500, lineHeight:1.3 }}>{item.name}</div>
              {drawerTab === 'Templates'
                ? <div style={{ fontSize:11, color:'#64748b', marginTop:2, lineHeight:1.4 }}>{item.desc}</div>
                : <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>[Units: {item.units}] [Avg Wage: ${item.avgWage?.toFixed(2)}]</div>
              }
            </div>
          </div>
        ))}
        {results.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>No results for "{search}"</div>
        )}
      </div>
    </div>
  );
}

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
function WorkAreaRow({ name, items, costCode, isOpen, onToggle, onRename, onChangeCostCode, onAddItem, onOpenDrawer, onChangeItem, onDeleteItem, onDelete, idx }) {
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
                <button onClick={onAddItem} style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, color:'#1e293b', padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:500 }}>+ Add Line</button>
                <button onClick={onOpenDrawer} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'4px 12px', cursor:'pointer', fontSize:12, fontWeight:600, marginLeft:'auto' }}>
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

// ── Print Reports Tab ─────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { value:'', label:'-- Select a report --' },
  { value:'CustomerProposal', label:'Customer Proposal' },
  { value:'EstimateReview', label:'Estimate Review' },
  { value:'EstimatedJobCost', label:'Estimated Job Cost' },
  { value:'PurchaseOrder', label:'Purchase Order' },
  { value:'JobPlannerWorkAreas', label:'Job Planner (Work Areas)' },
  { value:'JobPlannerShowTotals', label:'Job Planner (Show Totals)' },
];

function PrintReportsTab({ form, items, contacts, companies, properties }) {
  const [selectedReport, setSelectedReport] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [accordions, setAccordions] = useState({ header:false, pricing:false, report:false, footer:false });
  const [opts, setOpts] = useState({
    letterheadMode:false, hideSalesperson:false, hideClientEmailPhone:true, hideCustomerName:false,
    hideWorkAreaPrices:false, hideItemDetails:true, hideTaxes:false, hideGrandTotal:false, hidePaymentSchedule:true,
    groupAreaOnSamePage:false, hideClientNotes:false, startTermsOnNewPage:false, hideSignatures:false, hideEmail:false,
    includeEstimateId:false, hidePageFooter:false,
  });
  const [saveOpts, setSaveOpts] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleOpt = k => setOpts(p => ({ ...p, [k]:!p[k] }));
  const toggleAcc = k => setAccordions(p => ({ ...p, [k]:!p[k] }));

  function fmt$(n) { return '$' + (parseFloat(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function fmtH(n)  { return (parseFloat(n)||0).toFixed(2); }

  const workAreas = [...new Set(items.map(i => i.category||''))].filter(Boolean);
  const getAreaItems = aName => items.filter(i => (i.category||'') === aName);
  const clientCompany  = companies.find(c => c.id == form.company_id);
  const clientProperty = properties.find(p => p.id == form.property_id);
  const clientContact  = contacts.find(c => c.id == form.contact_id);

  function generatePreview() {
    setLoading(true);
    setTimeout(() => {
      const title = reportTitle || form.title || 'Proposal';
      const estId  = form.estimate_number || '—';
      const date   = form.valid_until
        ? new Date(form.valid_until).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
        : new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const salesperson    = form.salesperson || '—';
      const companyName    = clientCompany?.name || '—';
      const companyAddress = clientCompany?.address || '';
      const propName       = clientProperty?.name || form.title || '';
      const propAddress    = clientProperty?.address || '';
      const totalPrice     = items.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);

      let areaRows = '';
      workAreas.forEach(aName => {
        const aItems = getAreaItems(aName);
        const total  = aItems.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
        if (!opts.hideWorkAreaPrices) {
          areaRows += `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 20px;font-size:14px;color:#1e293b;font-weight:500">${aName}</td><td style="padding:10px 20px;font-size:14px;color:#1e293b;text-align:right;font-weight:600">${fmt$(total)}</td></tr>`;
        }
        if (!opts.hideItemDetails && !opts.hideWorkAreaPrices) {
          aItems.forEach(item => {
            const lp = (parseFloat(item.unit_price)||0)*(parseFloat(item.quantity)||1);
            areaRows += `<tr style="border-bottom:1px dashed #f1f5f9"><td style="padding:4px 20px 4px 36px;font-size:13px;color:#64748b">${item.description||'Item'}</td><td style="padding:4px 20px;font-size:13px;color:#64748b;text-align:right">${fmt$(lp)}</td></tr>`;
          });
        }
      });
      if (!areaRows) areaRows = `<tr><td colspan="2" style="padding:24px;text-align:center;color:#94a3b8;font-size:13px">No work areas defined yet.</td></tr>`;

      let reportSpecific = '';
      if (selectedReport === 'EstimateReview') {
        const totalCost = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
        const profit = totalPrice - totalCost;
        const pct = totalPrice > 0 ? ((profit/totalPrice)*100).toFixed(1) : '0.0';
        reportSpecific = `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin-top:16px;display:flex;gap:32px">
          <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Total Cost</div><div style="font-size:18px;font-weight:700;color:#1e293b">${fmt$(totalCost)}</div></div>
          <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Total Price</div><div style="font-size:18px;font-weight:700;color:#1e293b">${fmt$(totalPrice)}</div></div>
          <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Net Profit</div><div style="font-size:18px;font-weight:700;color:${parseFloat(pct)>=30?'#16a34a':parseFloat(pct)>=15?'#d97706':'#dc2626'}">${fmt$(profit)} (${pct}%)</div></div>
        </div>`;
      }
      if (selectedReport === 'EstimatedJobCost') {
        const totalCost = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||1), 0);
        const totalHrs  = items.reduce((s,i) => s + (parseFloat(i.hours)||0), 0);
        reportSpecific = `<div style="margin-top:16px"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0"><th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Item</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Qty</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Unit Cost</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase">Total Cost</th></tr></thead><tbody>
          ${items.map(it => `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:7px 12px;font-size:13px;color:#1e293b">${it.description||'Item'}</td><td style="padding:7px 12px;font-size:13px;text-align:right;color:#64748b">${it.quantity||1}</td><td style="padding:7px 12px;font-size:13px;text-align:right;color:#64748b">${fmt$(it.unit_cost||0)}</td><td style="padding:7px 12px;font-size:13px;text-align:right;color:#1e293b;font-weight:500">${fmt$((parseFloat(it.unit_cost)||0)*(parseFloat(it.quantity)||1))}</td></tr>`).join('')}
          <tr style="background:#f8fafc;font-weight:700"><td style="padding:9px 12px;font-size:13px" colspan="3">Total Job Cost</td><td style="padding:9px 12px;font-size:14px;text-align:right">${fmt$(totalCost)}</td></tr>
        </tbody></table></div>`;
      }
      if (selectedReport === 'PurchaseOrder') {
        reportSpecific = `<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-top:16px"><div style="background:#0f766e;color:#fff;padding:10px 16px;font-size:14px;font-weight:700">PURCHASE ORDER</div><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0"><th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b">Description</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b">Qty</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b">Unit</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b">Unit Cost</th><th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b">Total</th></tr></thead><tbody>
          ${items.map((it,i) => `<tr style="background:${i%2?'#f8fafc':'#fff'};border-bottom:1px solid #f1f5f9"><td style="padding:7px 12px;font-size:13px;color:#1e293b">${it.description||'Item'}</td><td style="padding:7px 12px;font-size:13px;text-align:right;color:#64748b">${it.quantity||1}</td><td style="padding:7px 12px;font-size:13px;text-align:right;color:#64748b">${it.unit||'units'}</td><td style="padding:7px 12px;font-size:13px;text-align:right;color:#64748b">${fmt$(it.unit_cost||0)}</td><td style="padding:7px 12px;font-size:13px;text-align:right;color:#1e293b;font-weight:500">${fmt$((parseFloat(it.unit_cost)||0)*(parseFloat(it.quantity)||1))}</td></tr>`).join('')}
        </tbody></table></div>`;
      }
      if (selectedReport === 'JobPlannerWorkAreas' || selectedReport === 'JobPlannerShowTotals') {
        reportSpecific = `<div style="margin-top:16px">${workAreas.map(aName => {
          const aItems = getAreaItems(aName);
          const rows = selectedReport === 'JobPlannerShowTotals' ? '' : aItems.map((it,i) => `<tr style="background:${i%2?'#f0fdf4':'#fff'};border-bottom:1px dashed #e2e8f0"><td style="padding:6px 12px 6px 24px;font-size:13px;color:#1e293b">${it.description||'Item'}</td><td style="padding:6px 12px;font-size:13px;text-align:right;color:#64748b">${it.quantity||1} ${it.unit||'units'}</td><td style="padding:6px 12px;font-size:13px;text-align:right;color:#64748b">${fmtH(it.hours||0)} hrs</td></tr>`).join('');
          const aTotal = aItems.reduce((s,i) => s + (parseFloat(i.unit_price)||0)*(parseFloat(i.quantity)||1), 0);
          return `<div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden"><div style="background:#0f766e;color:#fff;padding:8px 14px;font-size:13px;font-weight:700;display:flex;justify-content:space-between"><span>${aName}</span><span>${fmt$(aTotal)}</span></div><table style="width:100%;border-collapse:collapse"><tbody>${rows||'<tr><td colspan="3" style="padding:10px 12px;color:#94a3b8;font-size:13px">No items</td></tr>'}</tbody></table></div>`;
        }).join('')}</div>`;
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;background:#fff;color:#1e293b}
        .page{max-width:760px;margin:0 auto;padding:48px}
        .logo{color:#e55b2d;font-size:36px;font-weight:900;letter-spacing:-1px;margin-bottom:40px;font-family:Georgia,serif}
        .hrow{display:flex;justify-content:space-between;margin-bottom:28px;gap:24px}
        .addr{font-size:13px;line-height:1.7;color:#334155}
        .addr strong{font-size:14px;color:#1e293b;display:block}
        .meta{margin-bottom:24px}
        .meta div{font-size:13px;color:#334155;margin-bottom:3px}
        .meta dt{font-weight:700;display:inline}
        .meta dd{display:inline;margin-left:8px}
        table{width:100%;border-collapse:collapse;margin-bottom:24px}
        .total-row td{background:#f8fafc;border-top:2px solid #0f766e;padding:12px 20px;font-size:15px;font-weight:700}
        .sig{margin-top:60px;display:flex;gap:48px}
        .sig-block{flex:1}
        .sig-line{border-top:1px solid #334155;padding-top:6px;font-size:12px;color:#64748b;margin-top:40px}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body><div class="page">
        ${!opts.letterheadMode ? '<div class="logo">mahalo pro</div>' : ''}
        <div class="hrow">
          <div class="addr">
            ${!opts.hideCustomerName ? `<strong>${companyName}</strong>` : ''}
            ${companyAddress ? `${companyAddress}<br>` : ''}
            ${propAddress && propAddress !== companyAddress ? propAddress : ''}
          </div>
          ${!opts.hideSalesperson ? `<div class="addr" style="text-align:right">
            <div style="font-size:13px;color:#64748b">Sales: <strong style="color:#1e293b">${salesperson}</strong></div>
            ${propName ? `<div>${propName}</div>` : ''}
            ${propAddress ? `<div>${propAddress}</div>` : ''}
          </div>` : ''}
        </div>
        <dl class="meta">
          ${opts.includeEstimateId ? `<div><dt>Est ID:</dt><dd>${estId}</dd></div>` : ''}
          <div><dt>Date:</dt><dd>${date}</dd></div>
        </dl>
        <table><tbody>${areaRows}</tbody>${!opts.hideGrandTotal?`<tfoot><tr class="total-row"><td>Total</td><td style="text-align:right">${fmt$(totalPrice)}</td></tr></tfoot>`:''}</table>
        ${reportSpecific}
        ${!opts.hideSignatures ? `<div class="sig">
          <div class="sig-block"><div class="sig-line">Client Signature</div><div class="sig-line" style="margin-top:16px">Date</div></div>
          <div class="sig-block"><div class="sig-line">Authorized Signature</div><div class="sig-line" style="margin-top:16px">Date</div></div>
        </div>` : ''}
        ${!opts.hidePageFooter ? `<div style="margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">Mahalo Pro &nbsp;|&nbsp; Professional Facility Services</div>` : ''}
      </div></body></html>`;
      setPreviewHtml(html);
      setLoading(false);
    }, 600);
  }

  const AccordionSection = ({ label, aKey, children }) => (
    <div style={{ border:'1px solid #cbd5e1', borderRadius:4, marginBottom:8, overflow:'hidden' }}>
      <button onClick={() => toggleAcc(aKey)} style={{ width:'100%', background:'#f8fafc', border:'none', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', fontSize:13, fontWeight:700, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.04em', textAlign:'left' }}>
        {label}
        <span style={{ fontSize:14, color:'#94a3b8', display:'inline-block', transform: accordions[aKey]?'rotate(180deg)':'none', transition:'transform 0.2s' }}>▾</span>
      </button>
      {accordions[aKey] && <div style={{ padding:'10px 14px 6px', background:'#fff' }}>{children}</div>}
    </div>
  );

  const Cb = ({ optKey, label }) => (
    <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9, cursor:'pointer', fontSize:13, color:'#334155' }}>
      <input type="checkbox" checked={!!opts[optKey]} onChange={() => toggleOpt(optKey)} style={{ width:14, height:14, cursor:'pointer' }} />
      {label}
    </label>
  );

  const sel = { background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, padding:'7px 10px', fontSize:13, color:'#1e293b', width:'100%', outline:'none' };

  return (
    <div style={{ display:'flex', gap:20, minHeight:500 }}>
      {/* ── Left options panel ── */}
      <div style={{ width:360, flexShrink:0 }}>
        <div style={{ marginBottom:14 }}>
          <label style={{ color:'#64748b', fontSize:12, marginBottom:4, display:'block', fontWeight:500 }}>Select report</label>
          <select value={selectedReport} onChange={e => { setSelectedReport(e.target.value); setPreviewHtml(''); }} style={sel}>
            {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {selectedReport && (<>
          <div style={{ marginBottom:14 }}>
            <label style={{ color:'#64748b', fontSize:12, marginBottom:4, display:'block', fontWeight:500 }}>Report Title</label>
            <input value={reportTitle} onChange={e => setReportTitle(e.target.value)}
              style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:4, padding:'7px 10px', fontSize:13, color:'#1e293b', width:'100%', boxSizing:'border-box', outline:'none' }} />
          </div>

          {selectedReport === 'CustomerProposal' && (<>
            <AccordionSection label="Header Options" aKey="header">
              <Cb optKey="letterheadMode" label="Letterhead mode" />
              <Cb optKey="hideSalesperson" label="Hide salesperson" />
              <Cb optKey="hideClientEmailPhone" label="Hide client email and phone" />
              <Cb optKey="hideCustomerName" label="Hide customer name" />
            </AccordionSection>
            <AccordionSection label="Pricing Options" aKey="pricing">
              <Cb optKey="hideWorkAreaPrices" label="Hide work area prices" />
              <Cb optKey="hideItemDetails" label="Hide item details" />
              <Cb optKey="hideTaxes" label="Hide Taxes" />
              <Cb optKey="hideGrandTotal" label="Hide grand total" />
              <Cb optKey="hidePaymentSchedule" label="Hide Payment Schedule" />
            </AccordionSection>
            <AccordionSection label="Report Options" aKey="report">
              <Cb optKey="groupAreaOnSamePage" label="Group area on same page" />
              <Cb optKey="hideClientNotes" label="Hide client notes" />
              <Cb optKey="startTermsOnNewPage" label="Start terms on new page" />
              <Cb optKey="hideSignatures" label="Hide signatures" />
              <Cb optKey="hideEmail" label="Hide email" />
            </AccordionSection>
            <AccordionSection label="Footer Options" aKey="footer">
              <Cb optKey="includeEstimateId" label="Include Estimate ID" />
              <Cb optKey="hidePageFooter" label="Hide page footer" />
            </AccordionSection>
          </>)}

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, marginBottom:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, color:'#64748b' }}>
              <input type="checkbox" checked={saveOpts} onChange={e=>setSaveOpts(e.target.checked)} style={{ width:13, height:13, cursor:'pointer' }} />
              Save report options
            </label>
            <button onClick={generatePreview} disabled={loading} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'7px 20px', cursor:loading?'default':'pointer', fontSize:13, fontWeight:700, opacity:loading?0.6:1 }}>
              {loading ? 'Loading…' : 'Preview'}
            </button>
          </div>

          {selectedReport === 'CustomerProposal' && (
            <button style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'9px 16px', cursor:'pointer', fontSize:13, fontWeight:600, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              ↑ Email/Publish Proposal
            </button>
          )}
        </>)}
      </div>

      {/* ── Right preview panel ── */}
      <div style={{ flex:1, background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6, minHeight:460, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {previewHtml ? (<>
          {/* Viewer toolbar */}
          <div style={{ background:'#334155', padding:'6px 12px', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            {['⟨⟨','⟨','⟩','⟩⟩'].map((s,i) => (
              <button key={i} style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:3, color:'#cbd5e1', padding:'2px 7px', cursor:'pointer', fontSize:12 }}>{s}</button>
            ))}
            <span style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:3, padding:'2px 10px', fontSize:12, color:'#cbd5e1' }}>1 of 1</span>
            <select style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:3, color:'#cbd5e1', padding:'2px 7px', fontSize:12, marginLeft:4 }}>
              <option>Whole Page</option><option>75%</option><option>100%</option><option>150%</option>
            </select>
            <div style={{ flex:1 }} />
            <button onClick={() => { const w=window.open('','_blank'); w.document.write(previewHtml); w.document.close(); w.print(); }}
              style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:3, color:'#cbd5e1', padding:'3px 10px', cursor:'pointer', fontSize:12 }}>🖨</button>
            <button onClick={() => { const w=window.open('','_blank'); w.document.write(previewHtml); w.document.close(); }}
              style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:3, color:'#cbd5e1', padding:'3px 10px', cursor:'pointer', fontSize:12 }}>⤢</button>
          </div>
          <iframe srcDoc={previewHtml} style={{ flex:1, border:'none', background:'#fff' }} title="Report Preview" />
        </>) : (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>
            {loading
              ? <div style={{ fontSize:40, animation:'pulse 1s ease infinite' }}>⏳</div>
              : (<>
                  <div style={{ fontSize:64, marginBottom:12, opacity:0.3 }}>📄</div>
                  <div style={{ fontSize:14 }}>Tap on the Preview button to see your report.</div>
                </>)
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default 
function CreateJobForm({ users, loading, onClose, onSubmit }) {
  const SERVICE_TYPES = ['one_time','landscape_route','snow_route','maintenance','installation','inspection','emergency'];
  const [form, setForm] = React.useState({ service_type:'one_time', assigned_user_id:'', scheduled_date:'', scheduled_time:'', notes:'' });
  const fld = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const labelStyle = { fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 };
  const inputStyle = { width:'100%', padding:'7px 10px', background:'#334155', border:'1px solid #475569', borderRadius:4, color:'#e2e8f0', fontSize:13, boxSizing:'border-box' };
  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <label style={labelStyle}>Service Type</label>
          <select value={form.service_type} onChange={fld('service_type')} style={inputStyle}>
            {SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Assign To (optional)</label>
          <select value={form.assigned_user_id} onChange={fld('assigned_user_id')} style={inputStyle}>
            <option value=''>— Unassigned —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Scheduled Date (optional — leave blank to add to unscheduled queue)</label>
          <input type='date' value={form.scheduled_date} onChange={fld('scheduled_date')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Scheduled Time (optional)</label>
          <input type='time' value={form.scheduled_time} onChange={fld('scheduled_time')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Dispatch Notes (optional)</label>
          <textarea value={form.notes} onChange={fld('notes')} rows={3} style={{...inputStyle, resize:'vertical'}} />
        </div>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
        <button onClick={onClose} disabled={loading} style={{ background:'#334155', border:'none', borderRadius:4, color:'#e2e8f0', padding:'8px 16px', cursor:'pointer', fontSize:13 }}>Cancel</button>
        <button onClick={() => onSubmit(form)} disabled={loading} style={{ background:'#0f766e', border:'none', borderRadius:4, color:'#fff', padding:'8px 16px', cursor:loading?'not-allowed':'pointer', fontSize:13, fontWeight:600, opacity:loading?0.7:1 }}>
          {loading ? 'Creating…' : '✓ Create Job'}
        </button>
      </div>
    </div>
  );
}

function Estimates() {
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerArea, setDrawerArea] = useState('');
  const [companies, setCompanies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [createJobLoading, setCreateJobLoading] = useState(false);
  const [createJobError, setCreateJobError] = useState('');

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

  useEffect(() => {
    if (!isList) {
      fetch(`${API}/users`).then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[])).catch(()=>{});
    }
  }, [isList]);

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

  async function handleCreateJob(formData) {
    setCreateJobLoading(true); setCreateJobError('');
    try {
      const r = await fetch(`${API}/estimates/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to create job');
      setShowCreateJob(false);
      navigate(`/schedule?job=${data.job?.id || ''}`);
    } catch(e) { setCreateJobError(e.message); }
    setCreateJobLoading(false);
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
                      background: e.status==='approved'?'#dcfce7':e.status==='won'?'#fef9c3':e.status==='sent'?'#dbeafe':e.status==='rejected'?'#fee2e2':'#f1f5f9',
                      color: e.status==='approved'?'#166534':e.status==='won'?'#854d0e':e.status==='sent'?'#1d4ed8':e.status==='rejected'?'#991b1b':'#64748b',
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
        {[{ key:'customer', label:'Customer Info' }, { key:'workareas', label:'Workareas + Pricing' }, { key:'print', label:'Print Reports' }].map(t => (
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
                      onOpenDrawer={() => { setDrawerArea(areaName); setDrawerOpen(true); }}
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

        {/* ── Print Reports ──────────────────────────────────────────────── */}
        {tab === 'print' && (
          <PrintReportsTab
            form={form}
            items={items}
            contacts={contacts}
            companies={companies}
            properties={properties}
          />
        )}
      </div>

      {/* Add Items + Templates drawer */}
      <AddItemsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeArea={drawerArea}
        onAddItem={newItem => setItems(p => [...p, newItem])}
      />
      {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:199 }} />}

      {/* Create Job Modal */}
      {showCreateJob && isExisting && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1e293b', borderRadius:8, padding:28, width:440, maxWidth:'90vw', color:'#e2e8f0' }}>
            <h3 style={{ margin:'0 0 18px', fontSize:16, color:'#f8fafc' }}>Create Job from Estimate</h3>
            {createJobError && <div style={{ background:'#fee2e2', color:'#991b1b', padding:'8px 12px', borderRadius:4, marginBottom:12, fontSize:13 }}>{createJobError}</div>}
            <CreateJobForm
              users={users}
              loading={createJobLoading}
              onClose={() => { setShowCreateJob(false); setCreateJobError(''); }}
              onSubmit={handleCreateJob}
            />
          </div>
        </div>
      )}

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
          <button onClick={() => { setShowCreateJob(true); setCreateJobError(''); }} style={{ background:'#1d4ed8', border:'none', borderRadius:4, color:'#fff', padding:'7px 13px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
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
