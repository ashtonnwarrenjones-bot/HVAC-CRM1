import React, { useState, useRef } from 'react';
import axios from 'axios';

export default function SalesforceImport() {
  const [accountsFile, setAccountsFile] = useState(null);
  const [contactsFile, setContactsFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [skipDupes, setSkipDupes] = useState(true);
  const accRef = useRef();
  const conRef = useRef();

  const buildForm = () => {
    const fd = new FormData();
    if (accountsFile) fd.append('accounts', accountsFile);
    if (contactsFile) fd.append('contacts', contactsFile);
    return fd;
  };

  const handlePreview = async () => {
    if (!accountsFile && !contactsFile) { setError('Select at least one CSV file.'); return; }
    setError(''); setResult(null);
    setPreviewing(true);
    try {
      const { data } = await axios.post('/api/import/salesforce/preview', buildForm(), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!accountsFile && !contactsFile) { setError('Select at least one CSV file.'); return; }
    setError(''); setPreview(null);
    setImporting(true);
    try {
      const fd = buildForm();
      fd.append('skip_duplicates', skipDupes ? 'true' : 'false');
      const { data } = await axios.post('/api/import/salesforce/execute', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      setAccountsFile(null);
      setContactsFile(null);
      if (accRef.current) accRef.current.value = '';
      if (conRef.current) conRef.current.value = '';
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setImporting(false);
    }
  };

  const newCount  = (arr) => arr.filter(r => !r._exists).length;
  const dupeCount = (arr) => arr.filter(r => r._exists).length;

  return (
    <div className="card mb-4">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>☁</span>
        <h3 style={{ margin: 0 }}>Import from Salesforce</h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 14, lineHeight: 1.6 }}>
          Export your <strong>Accounts</strong> and/or <strong>Contacts</strong> from Salesforce as CSV files,
          then upload them here. Existing companies (matched by name) and contacts (matched by email) will be skipped.
        </p>

        <div style={{ background: 'var(--blue-50)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--blue-700)', marginBottom: 16 }}>
          <strong>How to export from Salesforce:</strong><br />
          Accounts: Reports → New Report → Accounts → Export → CSV<br />
          Contacts: Reports → New Report → Contacts &amp; Accounts → Export → CSV
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {/* Accounts */}
          <label style={{ cursor: 'pointer' }}>
            <div style={{
              border: '2px dashed', borderColor: accountsFile ? 'var(--blue-400)' : 'var(--gray-300)',
              borderRadius: 8, padding: '16px 12px', textAlign: 'center',
              background: accountsFile ? 'var(--blue-50)' : 'var(--gray-50)',
              transition: 'all .15s',
            }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🏢</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>
                {accountsFile ? accountsFile.name : 'Accounts CSV'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                {accountsFile ? `${(accountsFile.size / 1024).toFixed(1)} KB` : 'Click to select .csv'}
              </div>
            </div>
            <input ref={accRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { setAccountsFile(e.target.files[0] || null); setPreview(null); setResult(null); }} />
          </label>

          {/* Contacts */}
          <label style={{ cursor: 'pointer' }}>
            <div style={{
              border: '2px dashed', borderColor: contactsFile ? 'var(--blue-400)' : 'var(--gray-300)',
              borderRadius: 8, padding: '16px 12px', textAlign: 'center',
              background: contactsFile ? 'var(--blue-50)' : 'var(--gray-50)',
              transition: 'all .15s',
            }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>👥</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>
                {contactsFile ? contactsFile.name : 'Contacts CSV'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                {contactsFile ? `${(contactsFile.size / 1024).toFixed(1)} KB` : 'Click to select .csv'}
              </div>
            </div>
            <input ref={conRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { setContactsFile(e.target.files[0] || null); setPreview(null); setResult(null); }} />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={skipDupes} onChange={e => setSkipDupes(e.target.checked)} />
          Skip duplicate contacts (matched by email)
        </label>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: '#fef2f2', color: '#b91c1c' }}>
            ✗ {error}
          </div>
        )}

        {/* Preview results */}
        {preview && (
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Preview</div>
            {preview.accounts?.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                🏢 <strong>{preview.accounts.length}</strong> companies —{' '}
                <span style={{ color: 'var(--green-600)' }}>{newCount(preview.accounts)} new</span>,{' '}
                <span style={{ color: 'var(--gray-500)' }}>{dupeCount(preview.accounts)} already exist</span>
              </div>
            )}
            {preview.contacts?.length > 0 && (
              <div>
                👤 <strong>{preview.contacts.length}</strong> contacts —{' '}
                <span style={{ color: 'var(--green-600)' }}>{newCount(preview.contacts)} new</span>,{' '}
                <span style={{ color: 'var(--gray-500)' }}>{dupeCount(preview.contacts)} already exist</span>
              </div>
            )}
          </div>
        )}

        {/* Import results */}
        {result && (
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 8, background: 'var(--green-50)', border: '1px solid var(--green-200)', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: 'var(--green-700)', marginBottom: 8 }}>✓ Import complete</div>
            <div>🏢 {result.companies_created} companies created, {result.companies_skipped} skipped</div>
            <div>👤 {result.contacts_created} contacts created, {result.contacts_skipped} skipped</div>
            {result.errors?.length > 0 && (
              <div style={{ marginTop: 8, color: '#b91c1c' }}>
                {result.errors.length} error(s):<br />
                {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={previewing || importing || (!accountsFile && !contactsFile)}
            style={{ flex: 1 }}
          >
            {previewing ? '⏳ Previewing…' : '🔍 Preview Import'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={importing || previewing || (!accountsFile && !contactsFile)}
            style={{ flex: 1 }}
          >
            {importing ? '⏳ Importing…' : '⬆ Run Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
