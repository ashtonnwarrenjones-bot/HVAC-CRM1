import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import EmailCompose from '../components/EmailCompose';

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

  const load = () => axios.get(`/api/proposals/${id}`).then(r => setProposal(r.data));
  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status) => {
    await axios.put(`/api/proposals/${id}`, { ...proposal, status });
    load();
  };

  const del = async () => {
    if (!confirm('Delete this proposal?')) return;
    await axios.delete(`/api/proposals/${id}`);
    navigate('/proposals');
  };

  const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!proposal) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

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
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            className="form-control"
            style={{ width: 160, fontSize: 13 }}
            value={proposal.status}
            onChange={e => updateStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => setShowEmail(true)}>✉ Email</button>
          <a
            href={`/api/proposals/${id}/pdf`}
            className="btn btn-primary"
            target="_blank"
            rel="noreferrer"
          >
            ⬇ Download PDF
          </a>
          <button className="btn btn-danger" onClick={del}>Delete</button>
        </div>
      </div>

      <div className="page-content">
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
