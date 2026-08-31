import React, { useState, useRef } from 'react';
import axios from 'axios';

const STEP = { IDLE: 'idle', PREVIEW: 'preview', IMPORTING: 'importing', DONE: 'done' };

export default function SalesforceImport() {
  const [step, setStep] = useState(STEP.IDLE);
  const [accountsFile, setAccountsFile] = useState(null);
  const [contactsFile, setContactsFile] = useState(null);
  const [preview, setPreview] = useState(null);   // { accounts: [], contacts: [] }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const accountsRef = useRef();
  const contactsRef = useRef();

  const reset = () => {
    setStep(STEP.IDLE);
    setAccountsFile(null);
    setContactsFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    if (accountsRef.current) accountsRef.current.value = '';
    if (contactsRef.current) contactsRef.current.value = '';
  };

  const buildFormData = () => {
    const fd = new FormData();
    if (accountsFile) fd.append('accounts', accountsFile);
    if (contactsFile) fd.append('contacts', contactsFile);
    return fd;
  };

  const handlePreview = async () => {
    if (!accountsFile && !contactsFile) {
      setError('Please select at least one CSV file.');
      return;
    }
    setError('');
    setStep(STEP.PREVIEW);
    try {
      const r = await axios.post('/api/import/salesforce/preview', buildFormData(), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Preview failed.');
      setStep(STEP.IDLE);
    }
  };

  const handleImport = async () => {
    setStep(STEP.IMPORTING);
    try {
      const fd = buildFormData();
      fd.append('skip_duplicates', 'true');
      const r = await axios.post('/api/import/salesforce/execute', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
      setStep(STEP.DONE);
    } catch (e) {
      setError(e.response?.data?.error || 'Import failed.');
      setStep(STEP.PREVIEW);
    }
  };

  const newCount  = (arr) => arr?.filter(r => !r._exists).length ?? 0;
  const dupeCount = (arr) => arr?.filter(r =>  r._exists).length ?? 0;

  // ── Pill badge ────────────────────────────────────────────────────────────
  const Badge = ({ text, color }) => (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 10, fontSize: 10,
      fontWeight: 700, background: color + '22', color,
    }}>{text}</span>
  );

  // ── File drop zone ────────────────────────────────────────────────────────
  const FileZone = ({ label, icon, file, inputRef, onChange }) => (
    <div
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${file ? '#2563eb' : '#d1d5db'}`,
        borderRadius: 8, padding: '16px 12px', textAlign: 'center',
        cursor: 'pointer', background: file ? '#eff6ff' : '#f9fafb',
        transition: 'all .15s',
      }}
    >
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
        onChange={e => { onChange(e.target.files[0] || null); setStep(STEP.IDLE); setPreview(null); setResult(null); }} />
      <div style={{ fontSize: 22, marginBottom: 4 }}>{file ? '📄' : icon}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: file ? '#2563eb' : '#374151', marginBottom: 2 }}>
        {file ? file.name : label}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        {file ? 'Click to replace' : 'Click to select .csv'}
      </div>
    </div>
  );

  return (
    <div className="card mb-4">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>☁️</span>
        <h3 style={{ margin: 0 }}>Import from Salesforce</h3>
      </div>
      <div className="card-body">

        {/* Instructions */}
        <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 14, lineHeight: 1.6 }}>
          Export your <strong>Accounts</strong> and/or <strong>Contacts</strong> from Salesforce as CSV files, then upload them here.
          Existing companies (matched by name) and contacts (matched by email) will be skipped.
        </p>

        {/* How to export callout */}
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#0369a1', lineHeight: 1.7 }}>
          <strong>How to export from Salesforce:</strong>
          <br />Accounts: Reports → New Report → Accounts → Export → CSV
          <br />Contacts: Reports → New Report → Contacts &amp; Accounts → Export → CSV
        </div>

        {/* File pickers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <FileZone label="Accounts CSV" icon="🏢" file={accountsFile}
            inputRef={accountsRef} onChange={setAccountsFile} />
          <FileZone label="Contacts CSV" icon="👥" file={contactsFile}
            inputRef={contactsRef} onChange={setContactsFile} />
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13,
            background: '#fef2f2', color: '#b91c1c', fontWeight: 500 }}>
            ✗ {error}
          </div>
        )}

        {/* ── Preview ── */}
        {step === STEP.PREVIEW && preview && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#111' }}>
              Preview — {(newCount(preview.accounts) + newCount(preview.contacts))} new record{newCount(preview.accounts) + newCount(preview.contacts) !== 1 ? 's' : ''} will be imported
            </div>

            {/* Accounts summary */}
            {preview.accounts.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Companies ({preview.accounts.length} rows)
                  <Badge text={`${newCount(preview.accounts)} new`} color="#16a34a" />
                  {dupeCount(preview.accounts) > 0 && <Badge text={`${dupeCount(preview.accounts)} skip`} color="#6b7280" />}
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Name</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>City</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Phone</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.accounts.map((a, i) => (
                        <tr key={i} style={{ background: a._exists ? '#f9fafb' : 'white' }}>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 500, color: a._exists ? '#9ca3af' : '#111' }}>{a.name}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{a.city}{a.state ? `, ${a.state}` : ''}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{a.phone}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                            {a._exists ? <Badge text="exists" color="#6b7280" /> : <Badge text="new" color="#16a34a" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Contacts summary */}
            {preview.contacts.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Contacts ({preview.contacts.length} rows)
                  <Badge text={`${newCount(preview.contacts)} new`} color="#16a34a" />
                  {dupeCount(preview.contacts) > 0 && <Badge text={`${dupeCount(preview.contacts)} skip`} color="#6b7280" />}
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Name</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Company</th>
                        <th style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Email</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.contacts.map((c, i) => (
                        <tr key={i} style={{ background: c._exists ? '#f9fafb' : 'white' }}>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 500, color: c._exists ? '#9ca3af' : '#111' }}>{c.first_name} {c.last_name}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{c.company_name}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{c.email}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                            {c._exists ? <Badge text="skip" color="#6b7280" /> : <Badge text="new" color="#16a34a" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Done ── */}
        {step === STEP.DONE && result && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8,
            background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d', marginBottom: 8 }}>✓ Import complete</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Companies added', val: result.companies_created, color: '#16a34a' },
                { label: 'Companies skipped', val: result.companies_skipped, color: '#6b7280' },
                { label: 'Contacts added', val: result.contacts_created, color: '#16a34a' },
                { label: 'Contacts skipped', val: result.contacts_skipped, color: '#6b7280' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                  <span style={{ color: '#374151' }}>{label}</span>
                  <span style={{ fontWeight: 700, color }}>{val}</span>
                </div>
              ))}
            </div>
            {result.errors?.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#b91c1c' }}>
                <strong>Errors ({result.errors.length}):</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step === STEP.IDLE && (
            <button className="btn btn-primary" onClick={handlePreview}
              disabled={!accountsFile && !contactsFile} style={{ fontSize: 13 }}>
              Preview Import
            </button>
          )}
          {step === STEP.PREVIEW && preview && (
            <>
              <button className="btn btn-primary" onClick={handleImport}
                disabled={(newCount(preview.accounts) + newCount(preview.contacts)) === 0}
                style={{ fontSize: 13 }}>
                {newCount(preview.accounts) + newCount(preview.contacts) === 0
                  ? 'Nothing new to import'
                  : `Import ${newCount(preview.accounts) + newCount(preview.contacts)} Records`}
              </button>
              <button className="btn btn-secondary" onClick={reset} style={{ fontSize: 13 }}>Cancel</button>
            </>
          )}
          {step === STEP.IMPORTING && (
            <button className="btn btn-primary" disabled style={{ fontSize: 13 }}>⏳ Importing…</button>
          )}
          {step === STEP.DONE && (
            <button className="btn btn-secondary" onClick={reset} style={{ fontSize: 13 }}>Import More</button>
          )}
        </div>
      </div>
    </div>
  );
}
