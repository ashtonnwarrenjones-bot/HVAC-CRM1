import React, { useState, useRef } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle, AlertCircle, FileUp, RefreshCw } from 'lucide-react';

const DATA_TYPES = [
  { id: 'companies', label: 'Customers / Companies', description: 'Import LMN customer accounts as CRM companies', icon: '🏢',
    fields: [
      { key: 'name',    label: 'Company Name', required: true,  hints: ['customer name','company','account name','name'] },
      { key: 'phone',   label: 'Phone',        required: false, hints: ['phone','phone number','business phone'] },
      { key: 'website', label: 'Website',      required: false, hints: ['website','url','web'] },
      { key: 'address', label: 'Address',      required: false, hints: ['address','street','billing street'] },
      { key: 'city',    label: 'City',         required: false, hints: ['city','billing city'] },
      { key: 'state',   label: 'State',        required: false, hints: ['state','province','billing state'] },
      { key: 'zip',     label: 'Zip',          required: false, hints: ['zip','postal','zip code'] },
      { key: 'notes',   label: 'Notes',        required: false, hints: ['notes','description','comment'] },
    ] },
  { id: 'contacts', label: 'Contacts', description: 'Import LMN contacts / people', icon: '👤',
    fields: [
      { key: 'first_name',   label: 'First Name',   required: false, hints: ['first name','firstname','first'] },
      { key: 'last_name',    label: 'Last Name',    required: false, hints: ['last name','lastname','last'] },
      { key: 'email',        label: 'Email',        required: false, hints: ['email','e-mail','email address'] },
      { key: 'phone',        label: 'Phone',        required: false, hints: ['phone','phone number'] },
      { key: 'mobile',       label: 'Mobile',       required: false, hints: ['mobile','cell','mobile phone'] },
      { key: 'title',        label: 'Title / Role', required: false, hints: ['title','role','job title','position'] },
      { key: 'company_name', label: 'Company Name', required: false, hints: ['company','company name','account','customer name'] },
      { key: 'notes',        label: 'Notes',        required: false, hints: ['notes','description'] },
    ] },
  { id: 'deals', label: 'Estimates → Deals', description: 'Import LMN estimates as pipeline deals', icon: '📋',
    fields: [
      { key: 'title',        label: 'Estimate / Deal Title', required: true,  hints: ['name','title','estimate name','estimate title','subject'] },
      { key: 'company_name', label: 'Customer / Company',    required: false, hints: ['customer','customer name','company','account'] },
      { key: 'value',        label: 'Value / Amount',        required: false, hints: ['amount','total','value','estimate total','price'] },
      { key: 'status',       label: 'Status',                required: false, hints: ['status','stage','state'] },
      { key: 'notes',        label: 'Notes',                 required: false, hints: ['notes','description','comment'] },
    ] },
  { id: 'jobs', label: 'Work Orders → Jobs', description: 'Import LMN work orders as CRM jobs', icon: '🔧',
    fields: [
      { key: 'title',        label: 'Job / Work Order Title', required: true,  hints: ['name','title','work order','job name','subject'] },
      { key: 'company_name', label: 'Customer / Company',     required: false, hints: ['customer','customer name','company','account'] },
      { key: 'job_type',     label: 'Job Type',               required: false, hints: ['type','job type','service type','category'] },
      { key: 'status',       label: 'Status',                 required: false, hints: ['status','stage','state'] },
      { key: 'notes',        label: 'Notes',                  required: false, hints: ['notes','description'] },
    ] },
  { id: 'pricebook', label: 'Services → Pricebook', description: 'Import LMN service items into the pricebook', icon: '💰',
    fields: [
      { key: 'name',        label: 'Item Name',   required: true,  hints: ['name','item','service','service name'] },
      { key: 'category',    label: 'Category',    required: false, hints: ['category','type','group'] },
      { key: 'description', label: 'Description', required: false, hints: ['description','details','notes'] },
      { key: 'unit',        label: 'Unit',        required: false, hints: ['unit','uom','unit of measure'] },
      { key: 'unit_price',  label: 'Unit Price',  required: false, hints: ['price','unit price','rate','cost','amount'] },
    ] },
];

function autoMap(headers, fields) {
  const m = {};
  for (const f of fields) {
    const hit = headers.find(h => f.hints.some(hint => h.toLowerCase().includes(hint)));
    if (hit) m[f.key] = hit;
  }
  return m;
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const split = (line) => {
    const vals = []; let cur = ''; let inQ = false;
    for (const c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    vals.push(cur.trim());
    return vals;
  };
  const hdrs = split(lines[0]).map(h => h.replace(/^\uFEFF|^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = split(line); const row = {};
    hdrs.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

const btn = (label, onClick, opts = {}) => (
  <button onClick={onClick} disabled={opts.disabled} style={{
    background: opts.primary ? (opts.disabled ? '#93c5fd' : '#2563eb') : 'none',
    color: opts.primary ? '#fff' : 'inherit',
    border: opts.primary ? 'none' : '1px solid #d1d5db',
    borderRadius: 8, padding: '8px 18px', cursor: opts.disabled ? 'not-allowed' : 'pointer',
    fontWeight: opts.primary ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
  }}>
    {label}
  </button>
);

export default function Import() {
  const [step, setStep] = useState(1);
  const [dataType, setDataType] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const cfg = DATA_TYPES.find(t => t.id === dataType);

  function handleTypeSelect(id) { setDataType(id); setStep(2); }

  function handleFile(file) {
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target.result);
        if (!parsed.length) { setError('CSV appears empty or has no data rows.'); return; }
        const hdrs = Object.keys(parsed[0]);
        setRows(parsed); setHeaders(hdrs); setMapping(autoMap(hdrs, cfg.fields)); setStep(3);
      } catch (err) { setError('Failed to parse CSV: ' + err.message); }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true); setError('');
    try {
      const res = await fetch('/api/import/lmn/' + dataType, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, mapping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResults(data); setStep(5);
    } catch (err) { setError(err.message); }
    finally { setImporting(false); }
  }

  function reset() { setStep(1); setDataType(null); setRows([]); setHeaders([]); setMapping({}); setResults(null); setError(''); }

  const STEPS = ['Data Type', 'Upload CSV', 'Map Columns', 'Preview', 'Results'];

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Import from LMN</h1>
        <p style={{ color: '#6b7280', margin: 0 }}>Import your LMN data into CircuitCRM using CSV exports.</p>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', marginBottom: 32, background: '#f9fafb', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        {STEPS.map((label, i) => {
          const s = i + 1; const active = step === s; const done = step > s;
          return (
            <div key={s} style={{ flex: 1, padding: '11px 6px', textAlign: 'center', fontSize: 12, fontWeight: active ? 700 : 500,
              background: active ? '#2563eb' : done ? '#dbeafe' : 'transparent',
              color: active ? '#fff' : done ? '#2563eb' : '#9ca3af',
              borderRight: s < 5 ? '1px solid #e5e7eb' : 'none' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{done ? '✓' : s}</div>{label}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>What would you like to import?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
            {DATA_TYPES.map(type => (
              <button key={type.id} onClick={() => handleTypeSelect(type.id)}
                style={{ padding: '20px', border: '2px solid #e5e7eb', borderRadius: 12, background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{type.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{type.label}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{type.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Upload your {cfg?.label} CSV</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>Export a CSV from LMN and upload it here. Columns will be auto-detected.</p>
          <div style={{ border: '2px dashed #d1d5db', borderRadius: 12, padding: '48px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#d1d5db'; handleFile(e.dataTransfer.files[0]); }}>
            <FileUp size={40} style={{ color: '#9ca3af', marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Drop your CSV here, or click to browse</p>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Supports .csv files exported from LMN</p>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && cfg && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Map your columns</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>Found <strong>{rows.length}</strong> rows. Columns were auto-detected — adjust any below.</p>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, width: '40%' }}>CRM Field</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>CSV Column</th>
                </tr>
              </thead>
              <tbody>
                {cfg.fields.map((field, i) => (
                  <tr key={field.key} style={{ borderTop: i > 0 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500, fontSize: 14 }}>
                      {field.label}{field.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <select value={mapping[field.key] || ''} onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value || undefined }))}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: 13 }}>
                        <option value="">— skip —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={() => setStep(4)} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              Preview <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && cfg && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Preview import</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>Showing first 5 of <strong>{rows.length}</strong> rows.</p>
          <div style={{ overflowX: 'auto', marginBottom: 24, border: '1px solid #e5e7eb', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {cfg.fields.filter(f => mapping[f.key]).map(f => (
                    <th key={f.key} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                    {cfg.fields.filter(f => mapping[f.key]).map(f => (
                      <td key={f.key} style={{ padding: '9px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[mapping[f.key]] || <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(3)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={handleImport} disabled={importing} style={{ background: importing ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 24px', cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {importing ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</> : <>Import {rows.length} rows <ArrowRight size={14} /></>}
            </button>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step 5 */}
      {step === 5 && results && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <CheckCircle size={52} style={{ color: '#16a34a', marginBottom: 12 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Import complete!</h2>
            <p style={{ color: '#6b7280' }}>Your LMN data has been imported into CircuitCRM.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Created', value: results.created, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Skipped (duplicates)', value: results.skipped, color: '#d97706', bg: '#fffbeb' },
              { label: 'Errors', value: results.errors?.length || 0, color: '#dc2626', bg: '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ padding: '20px', borderRadius: 10, background: s.bg, textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {results.errors?.length > 0 && (
            <div style={{ marginBottom: 24, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Errors ({results.errors.length})</h3>
              <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13, color: '#7f1d1d' }}>
                {results.errors.map((e, i) => <li key={i} style={{ marginBottom: 4 }}>{e}</li>)}
              </ul>
            </div>
          )}
          <button onClick={reset} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            Import More Data
          </button>
        </div>
      )}
    </div>
  );
}
