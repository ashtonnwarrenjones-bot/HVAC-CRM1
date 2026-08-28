import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../components/Logo';

const API = import.meta.env.VITE_API_URL ?? '';

export default function Sign() {
  const { token } = useParams();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/proposals/sign/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setProposal(data);
        if (data.signed_at) setAlreadySigned(true);
      })
      .catch(() => setError('Unable to load proposal. Please check your link and try again.'));
  }, [token]);

  const submit = async () => {
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!agreed) { setError('Please check the agreement box to continue.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/proposals/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_by: name.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Signing failed.'); return; }
      setSigned(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = n => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Layout shell (no sidebar — public page)
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header bar */}
      <div style={{ background: '#1e3a5f', padding: '14px 24px' }}>
        <Logo size={34} variant="white" subtitle="Proposal Signing" />
      </div>

      <div style={{ maxWidth: 680, margin: '32px auto', padding: '0 16px' }}>

        {/* Already signed */}
        {alreadySigned && (
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 12, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>Already Signed</div>
            <div style={{ color: '#047857' }}>
              This proposal was signed by <strong>{proposal?.signed_by}</strong> on {new Date(proposal?.signed_at).toLocaleDateString()}.
            </div>
          </div>
        )}

        {/* Success state */}
        {signed && (
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>Proposal Signed!</div>
            <div style={{ color: '#047857', fontSize: 15 }}>
              Thank you, <strong>{name}</strong>. Your signature has been recorded and the proposal has been accepted.
            </div>
            <div style={{ marginTop: 16, color: '#6b7280', fontSize: 13 }}>
              You may close this window. A copy will be sent to you if an email was provided.
            </div>
          </div>
        )}

        {/* Error (no proposal found) */}
        {error && !proposal && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
            <div style={{ color: '#991b1b', fontWeight: 600 }}>{error}</div>
          </div>
        )}

        {/* Proposal view + signing form */}
        {proposal && !signed && !alreadySigned && (
          <>
            {/* Proposal header card */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.1)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{proposal.proposal_number}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{proposal.title}</div>
                  <div style={{ fontSize: 14, color: '#374151', marginTop: 4 }}>{proposal.company_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Total Amount</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a5f' }}>{fmt(proposal.total_amount)}</div>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.1)', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px' }}>Scope of Work</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                    <th style={{ padding: '6px 0', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '6px 0', textAlign: 'center', color: '#6b7280', fontWeight: 600, width: 50 }}>Qty</th>
                    <th style={{ padding: '6px 0', textAlign: 'right', color: '#6b7280', fontWeight: 600, width: 90 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(proposal.line_items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '8px 0', color: '#374151' }}>{item.description}</td>
                      <td style={{ padding: '8px 0', textAlign: 'center', color: '#6b7280' }}>{item.quantity} {item.unit}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>{fmt(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop: '2px solid #f3f4f6', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Subtotal: {fmt(proposal.subtotal)}</div>
                {proposal.tax_rate > 0 && <div style={{ fontSize: 13, color: '#6b7280' }}>Tax ({proposal.tax_rate}%): {fmt(proposal.tax_amount)}</div>}
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Total: {fmt(proposal.total_amount)}</div>
              </div>
            </div>

            {/* Terms */}
            {proposal.terms && (
              <div style={{ background: '#fffbf0', borderRadius: 12, padding: '16px 20px', border: '1px solid #fde68a', marginBottom: 16, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: '#92400e' }}>Terms & Conditions</div>
                {proposal.terms}
              </div>
            )}

            {/* Signature form */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: '#111827' }}>✍️ Sign Proposal</h3>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Type your full legal name"
                style={{
                  width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8,
                  fontSize: 15, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box', marginBottom: 16,
                }}
              />

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                  I, <strong>{name || '[your name]'}</strong>, agree to the terms of this proposal and authorize the services described above for a total of <strong>{fmt(proposal.total_amount)}</strong>. I understand this constitutes a legal acceptance of the proposal.
                </span>
              </label>

              {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  width: '100%', padding: '13px', borderRadius: 8, border: 'none',
                  background: submitting ? '#9ca3af' : '#1e3a5f', color: '#fff',
                  fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting…' : '✅ Sign & Accept Proposal'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
                Your name and the date/time will be recorded as your electronic signature.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
