import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Phone, Mail, Globe, Building2, Tag, Wrench,
  Edit2, Trash2, X, ChevronDown, ChevronUp, Upload, FileText,
  SendHorizonal, PhoneCall, Star, Package, AlertCircle, CheckCircle
} from 'lucide-react';

const API = '/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPhone(p) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return p;
}

function buildMailto(vendor, equipment) {
  const subject = encodeURIComponent(
    `Quote Request – ${equipment.manufacturer || ''} ${equipment.model || ''}`.trim()
  );
  const body = encodeURIComponent(
    `Hello${vendor.contact_name ? ' ' + vendor.contact_name : ''},\n\n` +
    `We need a quote for the following:\n\n` +
    `Manufacturer: ${equipment.manufacturer || 'N/A'}\n` +
    `Model: ${equipment.model || 'N/A'}\n` +
    `Serial Number: ${equipment.serial || 'N/A'}\n` +
    `Description: ${equipment.description || 'N/A'}\n\n` +
    `Please provide pricing and availability at your earliest convenience.\n\n` +
    `Thank you`
  );
  return `mailto:${vendor.email || ''}?subject=${subject}&body=${body}`;
}

// ─── CSV Parser (no dep) ──────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

// ─── BrandTag ─────────────────────────────────────────────────────────────────
function BrandTag({ brand }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--accent-muted)', color: 'var(--accent)',
      borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600,
    }}>{brand}</span>
  );
}

// ─── VendorModal ──────────────────────────────────────────────────────────────
function VendorModal({ vendor, onClose, onSaved }) {
  const isEdit = !!vendor?.id;
  const [form, setForm] = useState({
    name: '', contact_name: '', email: '', phone: '',
    parts_counter_phone: '', website: '', address: '',
    city: '', state: '', zip: '', notes: '', account_number: '',
    brands: [],
    ...vendor,
    brands: vendor?.brands || [],
  });
  const [brandInput, setBrandInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const addBrand = () => {
    const b = brandInput.trim();
    if (!b || form.brands.includes(b)) return;
    setForm(f => ({ ...f, brands: [...f.brands, b] }));
    setBrandInput('');
  };

  const removeBrand = brand => setForm(f => ({ ...f, brands: f.brands.filter(b => b !== brand) }));

  const save = async () => {
    if (!form.name.trim()) { setErr('Vendor name is required'); return; }
    setSaving(true); setErr('');
    try {
      const url = isEdit ? `${API}/vendors/${vendor.id}` : `${API}/vendors`;
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Save failed');
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = { background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: 'var(--text)', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding: 16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:16, width:'100%', maxWidth:640, maxHeight:'90vh', overflow:'auto', padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:18 }}>{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={20}/></button>
        </div>

        {err && <div style={{ background:'#fee2e2', color:'#dc2626', padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:13 }}>{err}</div>}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Vendor / Supplier Name *</label>
            <input style={inp} value={form.name} onChange={set('name')} placeholder="e.g. Ferguson HVAC, Johnstone Supply" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Contact Name</label>
            <input style={inp} value={form.contact_name} onChange={set('contact_name')} placeholder="Rep name" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Account Number</label>
            <input style={inp} value={form.account_number} onChange={set('account_number')} placeholder="Your account #" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Email</label>
            <input style={inp} value={form.email} onChange={set('email')} placeholder="quotes@supplier.com" type="email"/>
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Main Phone</label>
            <input style={inp} value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Parts Counter Phone</label>
            <input style={inp} value={form.parts_counter_phone} onChange={set('parts_counter_phone')} placeholder="Direct line for quick parts calls" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Website</label>
            <input style={inp} value={form.website} onChange={set('website')} placeholder="www.ferguson.com" />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Address</label>
            <input style={inp} value={form.address} onChange={set('address')} placeholder="Street address" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>City</label>
            <input style={inp} value={form.city} onChange={set('city')} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>State</label>
              <input style={inp} value={form.state} onChange={set('state')} placeholder="TX" />
            </div>
            <div>
              <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Zip</label>
              <input style={inp} value={form.zip} onChange={set('zip')} />
            </div>
          </div>

          {/* Brands */}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Brands / Manufacturers Carried</label>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input style={{ ...inp, flex:1 }} value={brandInput} onChange={e => setBrandInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBrand())}
                placeholder="Type brand and press Enter (e.g. Carrier, Trane, Daikin)" />
              <button onClick={addBrand} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:13 }}>Add</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {form.brands.map(b => (
                <span key={b} style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--accent-muted)', color:'var(--accent)', borderRadius:12, padding:'2px 10px', fontSize:12, fontWeight:600 }}>
                  {b}
                  <button onClick={() => removeBrand(b)} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', padding:0, lineHeight:1, display:'flex' }}><X size={10}/></button>
                </span>
              ))}
            </div>
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Notes</label>
            <textarea style={{ ...inp, height:72, resize:'vertical' }} value={form.notes} onChange={set('notes')} placeholder="Min order amounts, lead times, discount terms, etc." />
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'8px 18px', cursor:'pointer', color:'var(--text)', fontSize:14 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, padding:'8px 22px', cursor:'pointer', fontSize:14, fontWeight:600 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QuoteRequestModal ────────────────────────────────────────────────────────
function QuoteRequestModal({ vendor, onClose, onSent }) {
  const [form, setForm] = useState({ manufacturer: '', model: '', serial: '', description: '' });
  const [sending, setSending] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const inp = { background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: 'var(--text)', width: '100%', boxSizing: 'border-box' };

  const openEmail = async () => {
    setSending(true);
    const mailto = buildMailto(vendor, form);
    window.location.href = mailto;

    // Log the quote request
    try {
      await fetch(`${API}/vendors/quote-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendor.id,
          manufacturer: form.manufacturer,
          model: form.model,
          serial_number: form.serial,
          description: form.description,
        }),
      });
    } catch (_) {}
    setSending(false);
    onSent && onSent();
    onClose();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:16, width:'100%', maxWidth:500, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, fontSize:17 }}>Request Quote</h2>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>→ {vendor.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={20}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Manufacturer</label>
            <input style={inp} value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Carrier, Trane, Daikin" autoFocus />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Model Number</label>
            <input style={inp} value={form.model} onChange={set('model')} placeholder="e.g. 50XC060" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Serial Number</label>
            <input style={inp} value={form.serial} onChange={set('serial')} placeholder="From the unit nameplate" />
          </div>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>What's needed</label>
            <textarea style={{ ...inp, height:80, resize:'vertical' }} value={form.description} onChange={set('description')} placeholder="Describe the part or equipment needed, repair situation, urgency…" />
          </div>
        </div>

        <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px', marginTop:16, fontSize:12, color:'var(--text-muted)', display:'flex', gap:8, alignItems:'flex-start' }}>
          <Mail size={14} style={{ flexShrink:0, marginTop:1 }}/>
          <span>This will open your email client with a pre-filled quote request. The request will also be logged in the CRM.</span>
        </div>

        {vendor.parts_counter_phone && (
          <a href={`tel:${vendor.parts_counter_phone.replace(/\D/g,'')}`}
            style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, background:'#dcfce7', color:'#15803d', borderRadius:10, padding:'10px 14px', textDecoration:'none', fontWeight:600, fontSize:14 }}>
            <PhoneCall size={16}/>
            Call Parts Counter: {fmtPhone(vendor.parts_counter_phone)}
          </a>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'8px 18px', cursor:'pointer', color:'var(--text)', fontSize:14 }}>Cancel</button>
          <button onClick={openEmail} disabled={sending || !vendor.email}
            style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, padding:'8px 22px', cursor:'pointer', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            <SendHorizonal size={14}/>
            Open Email Draft
          </button>
        </div>
        {!vendor.email && <div style={{ color:'#dc2626', fontSize:12, textAlign:'right', marginTop:6 }}>No email address saved for this vendor.</div>}
      </div>
    </div>
  );
}

// ─── CSVImportModal ───────────────────────────────────────────────────────────
function CSVImportModal({ vendor, onClose, onImported }) {
  const fileRef = useRef();
  const [parsed, setParsed] = useState(null);
  const [columnMap, setColumnMap] = useState({ descriptionCol:'', costCol:'', vendorPartNoCol:'', mfrPartNoCol:'', unitCol:'' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers, rows } = parseCSV(ev.target.result);
      setParsed({ headers, rows });
      // Auto-map common column names
      const find = (...names) => headers.find(h => names.some(n => h.toLowerCase().includes(n))) || '';
      setColumnMap({
        descriptionCol: find('desc', 'name', 'item'),
        costCol:        find('cost', 'price', 'unit cost'),
        vendorPartNoCol:find('vendor part', 'vendor_part', 'part no', 'part number', 'sku'),
        mfrPartNoCol:   find('mfr', 'manufacturer part', 'oem'),
        unitCol:        find('unit', 'uom'),
      });
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/vendors/${vendor.id}/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed.rows, columnMap }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data);
      onImported && onImported();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const sel = { background:'var(--input-bg)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', fontSize:13, color:'var(--text)', width:'100%' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:16, width:'100%', maxWidth:560, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ margin:0, fontSize:17 }}>Import Price List — {vendor.name}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={20}/></button>
        </div>

        {!parsed ? (
          <div>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 16px' }}>
              Upload a CSV price list from your supplier. Column mapping will be auto-detected.
              Common formats (Ferguson, Johnstone, etc.) are recognized automatically.
            </p>
            <button onClick={() => fileRef.current.click()}
              style={{ width:'100%', border:'2px dashed var(--border)', borderRadius:12, padding:32, background:'var(--bg)', cursor:'pointer', color:'var(--text-muted)', fontSize:14, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <Upload size={24}/>
              Click to select CSV file
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} />
          </div>
        ) : result ? (
          <div style={{ textAlign:'center', padding:20 }}>
            {result.error ? (
              <><AlertCircle size={32} color="#dc2626" style={{ marginBottom:8 }}/><div style={{ color:'#dc2626' }}>{result.error}</div></>
            ) : (
              <><CheckCircle size={32} color="#16a34a" style={{ marginBottom:8 }}/><div style={{ fontSize:15, fontWeight:600 }}>Import Complete</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:8 }}>{result.inserted} new items added · {result.updated} updated</div></>
            )}
            <button onClick={onClose} style={{ marginTop:20, background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, padding:'8px 22px', cursor:'pointer', fontSize:14 }}>Done</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
              Detected <strong>{parsed.rows.length}</strong> rows, <strong>{parsed.headers.length}</strong> columns. Map each column:
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                ['Description', 'descriptionCol'],
                ['Cost / Unit Price', 'costCol'],
                ['Vendor Part #', 'vendorPartNoCol'],
                ['Mfr Part #', 'mfrPartNoCol'],
                ['Unit (ea/box…)', 'unitCol'],
              ].map(([label, key]) => (
                <div key={key}>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>{label}</label>
                  <select style={sel} value={columnMap[key]} onChange={e => setColumnMap(m => ({ ...m, [key]: e.target.value }))}>
                    <option value="">— skip —</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview first 3 rows */}
            <div style={{ marginTop:14, overflowX:'auto' }}>
              <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
                <thead>
                  <tr>{parsed.headers.map(h => <th key={h} style={{ padding:'4px 8px', textAlign:'left', borderBottom:'1px solid var(--border)', color:'var(--text-muted)' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0,3).map((row, i) => (
                    <tr key={i}>{parsed.headers.map(h => <td key={h} style={{ padding:'3px 8px', borderBottom:'1px solid var(--border)', color:'var(--text)', whiteSpace:'nowrap', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis' }}>{row[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
              <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'8px 18px', cursor:'pointer', color:'var(--text)', fontSize:14 }}>Cancel</button>
              <button onClick={doImport} disabled={loading || !columnMap.descriptionCol}
                style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, padding:'8px 22px', cursor:'pointer', fontSize:14, fontWeight:600 }}>
                {loading ? 'Importing…' : `Import ${parsed.rows.length} rows`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── VendorCard ───────────────────────────────────────────────────────────────
function VendorCard({ vendor, onEdit, onDelete, onQuote, onImport }) {
  const [expanded, setExpanded] = useState(false);
  const [parts, setParts] = useState([]);
  const [partsLoaded, setPartsLoaded] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !partsLoaded) {
      try {
        const r = await fetch(`${API}/vendors/${vendor.id}/parts`);
        const data = await r.json();
        setParts(Array.isArray(data) ? data : []);
        setPartsLoaded(true);
      } catch (_) {}
    }
    setExpanded(e => !e);
  };

  const brands = Array.isArray(vendor.brands)
    ? vendor.brands
    : JSON.parse(vendor.brands || '[]');

  return (
    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'16px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--text)' }}>{vendor.name}</h3>
              {vendor.account_number && (
                <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--bg)', borderRadius:6, padding:'2px 8px' }}>Acct #{vendor.account_number}</span>
              )}
            </div>
            {vendor.contact_name && <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>{vendor.contact_name}</div>}

            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
              {brands.map(b => <BrandTag key={b} brand={b}/>)}
            </div>
          </div>

          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={() => onQuote(vendor)}
              title="Request Quote"
              style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
              <SendHorizonal size={13}/> Quote
            </button>
            {vendor.parts_counter_phone && (
              <a href={`tel:${vendor.parts_counter_phone.replace(/\D/g,'')}`}
                title="Call Parts Counter"
                style={{ background:'#dcfce7', color:'#15803d', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, textDecoration:'none' }}>
                <PhoneCall size={13}/> Parts
              </a>
            )}
            <button onClick={() => onEdit(vendor)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'var(--text-muted)' }}><Edit2 size={13}/></button>
            <button onClick={() => onDelete(vendor)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'#ef4444' }}><Trash2 size={13}/></button>
          </div>
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:16, marginTop:12 }}>
          {vendor.phone && (
            <a href={`tel:${vendor.phone.replace(/\D/g,'')}`} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, color:'var(--text-muted)', textDecoration:'none' }}>
              <Phone size={13}/> {fmtPhone(vendor.phone)}
            </a>
          )}
          {vendor.email && (
            <a href={`mailto:${vendor.email}`} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, color:'var(--text-muted)', textDecoration:'none' }}>
              <Mail size={13}/> {vendor.email}
            </a>
          )}
          {vendor.website && (
            <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, color:'var(--text-muted)', textDecoration:'none' }}>
              <Globe size={13}/> {vendor.website}
            </a>
          )}
        </div>

        {vendor.notes && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:8, fontStyle:'italic' }}>{vendor.notes}</div>}
      </div>

      {/* Expand for parts catalog */}
      <div style={{ borderTop:'1px solid var(--border)', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={toggleExpand} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, display:'flex', alignItems:'center', gap:5 }}>
          <Package size={13}/> Price List / Parts Catalog
          {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
        </button>
        <button onClick={() => onImport(vendor)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
          <Upload size={12}/> Import CSV
        </button>
      </div>

      {expanded && (
        <div style={{ padding:'0 20px 16px' }}>
          {parts.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:'16px 0' }}>
              No parts imported yet. Use "Import CSV" to load a price list.
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    <th style={{ padding:'6px 8px', textAlign:'left', color:'var(--text-muted)', fontWeight:600 }}>Description</th>
                    <th style={{ padding:'6px 8px', textAlign:'left', color:'var(--text-muted)', fontWeight:600 }}>Vendor Part #</th>
                    <th style={{ padding:'6px 8px', textAlign:'left', color:'var(--text-muted)', fontWeight:600 }}>Mfr Part #</th>
                    <th style={{ padding:'6px 8px', textAlign:'right', color:'var(--text-muted)', fontWeight:600 }}>Unit Cost</th>
                    <th style={{ padding:'6px 8px', textAlign:'center', color:'var(--text-muted)', fontWeight:600 }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map(p => (
                    <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'5px 8px', color:'var(--text)' }}>{p.description}</td>
                      <td style={{ padding:'5px 8px', color:'var(--text-muted)', fontFamily:'monospace', fontSize:12 }}>{p.vendor_part_no || '—'}</td>
                      <td style={{ padding:'5px 8px', color:'var(--text-muted)', fontFamily:'monospace', fontSize:12 }}>{p.manufacturer_part_no || '—'}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>${parseFloat(p.unit_cost || 0).toFixed(2)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'center', color:'var(--text-muted)', fontSize:11 }}>{p.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [quoteVendor, setQuoteVendor] = useState(null);
  const [importVendor, setImportVendor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/vendors`);
      const data = await r.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch (_) {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = vendors.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    const brands = Array.isArray(v.brands) ? v.brands : JSON.parse(v.brands || '[]');
    return (
      v.name?.toLowerCase().includes(q) ||
      v.contact_name?.toLowerCase().includes(q) ||
      brands.some(b => b.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (vendor) => {
    if (!confirm(`Remove ${vendor.name} from vendors?`)) return;
    await fetch(`${API}/vendors/${vendor.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Vendors & Suppliers</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text-muted)' }}>
            Manage suppliers, brands carried, and price lists. Request quotes in one click.
          </p>
        </div>
        <button onClick={() => { setEditVendor(null); setShowModal(true); }}
          style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', cursor:'pointer', fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
          <Plus size={16}/> Add Vendor
        </button>
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:20 }}>
        <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors, brands, contacts…"
          style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px 10px 36px', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10, fontSize:14, color:'var(--text)' }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)', fontSize:14 }}>Loading vendors…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60 }}>
          <Building2 size={40} style={{ color:'var(--text-muted)', marginBottom:12 }}/>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>
            {search ? 'No vendors match your search' : 'No vendors yet'}
          </div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>
            {!search && 'Add your first supplier to start managing quotes and price lists.'}
          </div>
          {!search && (
            <button onClick={() => { setEditVendor(null); setShowModal(true); }}
              style={{ marginTop:16, background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontWeight:600 }}>
              Add First Vendor
            </button>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filtered.map(v => (
            <VendorCard key={v.id} vendor={v}
              onEdit={v => { setEditVendor(v); setShowModal(true); }}
              onDelete={handleDelete}
              onQuote={v => setQuoteVendor(v)}
              onImport={v => setImportVendor(v)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <VendorModal
          vendor={editVendor}
          onClose={() => { setShowModal(false); setEditVendor(null); }}
          onSaved={() => { setShowModal(false); setEditVendor(null); load(); }}
        />
      )}
      {quoteVendor && (
        <QuoteRequestModal
          vendor={quoteVendor}
          onClose={() => setQuoteVendor(null)}
          onSent={() => setQuoteVendor(null)}
        />
      )}
      {importVendor && (
        <CSVImportModal
          vendor={importVendor}
          onClose={() => setImportVendor(null)}
          onImported={() => { setImportVendor(null); }}
        />
      )}
    </div>
  );
}
