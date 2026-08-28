import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import EmailCompose from '../components/EmailCompose';

const API = import.meta.env.VITE_API_URL ?? '';
const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined'];
const STATUS_COLORS = {
  draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green', declined: 'badge-red',
};

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [sigLink, setSigLink] = useState('');
  const [sigCopied, setSigCopied] = useState(false);
  const [requestingSig, setRequestingSig] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = useCallback(() =>
    axios.get(`/api/proposals/${id}`).then(r => setProposal(r.data))
  , [id]);

  const loadAttachments = useCallback(() =>
    axios.get(`/api/attachments?proposal_id=${id}`).then(r => setAttachments(r.data))
  , [id]);

  useEffect(() => { load(); loadAttachments(); }, [load, loadAttachments]);

  const updateStatus = async (status) => {
    await axios.put(`/api/proposals/${id}`, { ...proposal, status });
    load();
  };

  const del = async () => {
    if (!confirm('Delete this proposal?')) return;
    await axios.delete(`/api/proposals/${id}`);
    navigate('/proposals');
  };

  const requestSignature = async () => {
    setRequestingSig(true);
    try {
      const r = await axios.post(`/api/proposals/${id}/request-signature`);
      setSigLink(r.data.signing_url);
      load();
    } catch (e) {
      alert('Failed to generate signing link.');
    } finally { setRequestingSig(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(sigLink).then(() => {
      setSigCopied(true);
      setTimeout(() => setSigCopied(false), 2000);
    });
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('proposal_id', id);
    try {
      await axios.post('/api/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadAttachments();
    } catch { alert('Upload failed.'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const deleteAttachment = async (attId) => {
    if (!confirm('Remove this file?')) return;
    await axios.delete(`/api/attachments/${attId}`);
    setAttachments(a => a.filter(x => x.id !== attId));
  };

  const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSize = (bytes) => bytes > 1048576 ? `${(bytes/1048576).toFixed(1)} MB` : `${Math.round(bytes/1024)} KB`;

  if (!proposal) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

  const isSigned = !!proposal.signed_at;

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost" onClick={() => navigate('/proposals')}>← Back</button>
          <div>
            <h2>{proposal.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted text-sm">{proposal.proposal_number}</span>
              <span className={`badge ${STATUS_COLORS[proposal.status] || 'badge-gray'}`}>{proposal.status}</span>
              {proposal.service_type && <span className="text-muted text-sm">{proposal.service_type}</span>}
              {isSigned && (
                <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  ✅ Signed by {proposal.signed_by}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ width: 160, fontSize: 13 }}
            value={proposal.status}
            onChange={e => updateStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => setShowEmail(true)}>✉ Email</button>
          <a href={`/api/proposals/${id}/pdf`} className="btn btn-primary" target="_blank" rel="noreferrer">⬇ PDF</a>
          <button className="btn btn-danger" onClick={del}>Delete</button>
        </div>
      </div>

      <div className="page-content">

        {/* Signature banner */}
        {isSigned ? (
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, color: '#065f46' }}>Proposal Signed</div>
              <div style={{ fontSize: 13, color: '#047857' }}>
                Signed by <strong>{proposal.signed_by}</strong> on {new Date(proposal.signed_at).toLocaleDateString()} at {new Date(proposal.signed_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#1e40af', fontSize: 14 }}>✍️ E-Signature</div>
                <div style={{ fontSize: 13, color: '#3b82f6' }}>
                  {sigLink ? 'Send this link to your customer to collect their signature.' : 'Generate a signing link to collect an electronic signature.'}
                </div>
              </div>
              {!sigLink ? (
                <button
                  onClick={requestSignature}
                  disabled={requestingSig}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1e40af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {requestingSig ? 'Generating…' : '🔗 Generate Signing Link'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    readOnly value={sigLink}
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #bfdbfe', fontSize: 12, width: 260, background: '#fff', color: '#374151' }}
                    onClick={e => e.target.select()}
                  />
                  <button
                    onClick={copyLink}
                    style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: sigCopied ? '#10b981' : '#1e40af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {sigCopied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="two-col" style={{ marginBottom: 24 }}>
          {/* Left: proposal info */}
          <div className="card">
            <div className="card-header"><h3>Proposal Info</h3></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                <div>
                  <div className="text-muted text-sm">Company</div>
                  {proposal.company_id
                    ? <Link to={`/companies/${proposal.company_id}`} className="link-style font-bold">{proposal.company_name || '—'}</Link>
                    : <span className="font-bold">—</span>}
                </div>
                <div>
                  <div className="text-muted text-sm">Contact</div>
                  <div className="font-bold">
                    {proposal.first_name ? `${proposal.first_name} ${proposal.last_name}` : '—'}
                    {proposal.contact_title && <span className="text-muted" style={{ fontWeight: 400 }}>, {proposal.contact_title}</span>}
                  </div>
                </div>
                {proposal.contact_email && (
                  <div>
                    <div className="text-muted text-sm">Email</div>
                    <a href={`mailto:${proposal.contact_email}`} className="link-style">{proposal.contact_email}</a>
                  </div>
                )}
                {proposal.contact_phone && (
                  <div>
                    <div className="text-muted text-sm">Phone</div>
                    <div>{proposal.contact_phone}</div>
                  </div>
                )}
                <div>
                  <div className="text-muted text-sm">Created</div>
                  <div>{new Date(proposal.created_at).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-muted text-sm">Valid Until</div>
                  <div>
                    {new Date(
                      new Date(proposal.created_at).getTime() + (proposal.valid_days || 30) * 86400000
                    ).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {proposal.notes && (
                <div className="mt-4" style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '10px 12px', fontSize: 13 }}>
                  <div className="text-muted text-sm mb-1">Notes</div>
                  {proposal.notes}
                </div>
              )}
            </div>
          </div>

          {/* Right: totals */}
          <div className="card">
            <div className="card-header"><h3>Summary</h3></div>
            <div className="card-body">
              <div style={{ marginBottom: 20 }}>
                <div className="totals-box">
                  <div className="totals-row"><span>Subtotal</span><span>{fmt(proposal.subtotal)}</span></div>
                  {proposal.tax_rate > 0 && (
                    <div className="totals-row"><span>Tax ({proposal.tax_rate}%)</span><span>{fmt(proposal.tax_amount)}</span></div>
                  )}
                  <div className="totals-row total"><span>Total</span><span className="amount">{fmt(proposal.total_amount)}</span></div>
                </div>
              </div>
              <div style={{ fontSize: 13 }}>
                <div className="flex justify-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <span className="text-muted">Line Items</span>
                  <span className="font-bold">{proposal.line_items?.length || 0}</span>
                </div>
                <div className="flex justify-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <span className="text-muted">Service Type</span>
                  <span>{proposal.service_type || '—'}</span>
                </div>
                <div className="flex justify-between" style={{ padding: '6px 0' }}>
                  <span className="text-muted">Tax Rate</span>
                  <span>{proposal.tax_rate || 0}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card">
          <div className="card-header"><h3>Line Items</h3></div>
          <div className="table-wrap">
            {!proposal.line_items?.length ? (
              <div className="empty-state" style={{ padding: 24 }}><p>No line items.</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.line_items.map((item, i) => (
                    <tr key={item.id || i}>
                      <td>{item.description}</td>
                      <td className="text-muted">{item.quantity}</td>
                      <td className="text-muted">{item.unit}</td>
                      <td>{fmt(item.unit_price)}</td>
                      <td className="font-bold">{fmt(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600, padding: '10px 14px' }}>Total</td>
                    <td style={{ fontWeight: 700, fontSize: 15, padding: '10px 14px' }}>{fmt(proposal.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Attachments */}
        <div className="card mt-4">
          <div className="card-header">
            <h3>📎 Attachments</h3>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {uploading ? 'Uploading…' : '+ Upload File'}
            </button>
            <input ref={fileRef} type="file" hidden onChange={uploadFile} />
          </div>
          {attachments.length === 0 ? (
            <div style={{ padding: '20px 20px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
              No files attached yet — upload contracts, photos, or documents.
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {attachments.map(att => (
                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 20 }}>{att.mimetype?.startsWith('image/') ? '🖼️' : att.mimetype === 'application/pdf' ? '📄' : '📎'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.original_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtSize(att.size)} · {new Date(att.uploaded_at).toLocaleDateString()}</div>
                  </div>
                  <a
                    href={`${API}/api/attachments/${att.id}/download`}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, color: '#374151', textDecoration: 'none', fontWeight: 500 }}
                  >⬇ Download</a>
                  <button
                    onClick={() => deleteAttachment(att.id)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Terms */}
        {proposal.terms && (
          <div className="card mt-4">
            <div className="card-header"><h3>Terms & Conditions</h3></div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--gray-700)' }}>{proposal.terms}</p>
            </div>
          </div>
        )}
      </div>

      {showEmail && proposal && (
        <EmailCompose
          context={{
            companyName: proposal.company_name,
            contactName: proposal.first_name ? `${proposal.first_name} ${proposal.last_name}` : '',
            contactEmail: proposal.contact_email || '',
            proposalNumber: proposal.proposal_number,
            proposalTitle: proposal.title,
          }}
          onClose={() => setShowEmail(false)}
        />
      )}
    </>
  );
}
