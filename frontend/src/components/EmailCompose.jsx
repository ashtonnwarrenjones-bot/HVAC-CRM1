import React, { useState } from 'react';

// Pre-built email templates for HVAC/Plumbing sales
const TEMPLATES = [
  {
    key: 'intro',
    label: 'Introduction',
    subject: 'Commercial HVAC & Plumbing Services — Introduction',
    body: (ctx) =>
`Hi ${ctx.contactName || 'there'},

My name is [Your Name] with [Your Company], and I specialize in commercial HVAC and plumbing service for businesses like ${ctx.companyName || 'yours'}.

We work with property managers and facility teams throughout the area to keep systems running reliably — whether that's a comprehensive maintenance program, an emergency repair, or planning ahead for equipment replacements.

I'd love to learn more about your building and see if there's a fit. Would you be open to a quick 10-minute call this week?

Best regards,
[Your Name]
[Your Title]
[Your Company] | [Phone] | [Email]`,
  },
  {
    key: 'site_visit',
    label: 'Schedule Site Visit',
    subject: `Site Survey — ${'{companyName}'}`,
    body: (ctx) =>
`Hi ${ctx.contactName || 'there'},

Thanks for your interest in our services! To put together an accurate proposal for ${ctx.companyName || 'your facility'}, I'd like to schedule a brief site walk-through.

During the visit I'll:
• Review your existing HVAC/plumbing equipment
• Note any areas of concern or deferred maintenance
• Understand your service history and priorities

It typically takes 30–45 minutes. Would any of the following times work for you?

• [Option 1 — day, date, time]
• [Option 2 — day, date, time]
• [Option 3 — day, date, time]

Please let me know what works best, or reply with a time that suits you.

Looking forward to meeting you,
[Your Name]
[Your Company] | [Phone] | [Email]`,
  },
  {
    key: 'proposal_followup',
    label: 'Proposal Follow-Up',
    subject: ctx => `Following Up — Proposal ${ctx.proposalNumber || ''}`.trim(),
    body: (ctx) =>
`Hi ${ctx.contactName || 'there'},

I wanted to follow up on the proposal I sent over${ctx.proposalTitle ? ` for "${ctx.proposalTitle}"` : ''}.

Do you have any questions about the scope or pricing? I'm happy to walk through it, adjust anything, or arrange a quick call if that's easier.

A few things worth noting:
• The proposal is valid for 30 days from the date it was sent
• We can typically schedule work within [X] weeks of approval
• [Add any relevant differentiator or incentive]

Just reply here or call me directly — I'm always easy to reach.

Thanks,
[Your Name]
[Your Company] | [Phone] | [Email]`,
  },
  {
    key: 'maintenance_renewal',
    label: 'Maintenance Renewal',
    subject: ctx => `Maintenance Agreement Renewal — ${ctx.companyName || ''}`.trim(),
    body: (ctx) =>
`Hi ${ctx.contactName || 'there'},

Your maintenance agreement with us is coming up for renewal, and I wanted to reach out personally.

Over the past year we've kept your systems running and addressed [X service calls / describe work]. Our goal is always to catch issues early — before they become expensive emergency repairs.

For the upcoming year I'm putting together a proposal that includes:
• [Frequency] seasonal tune-ups (HVAC + plumbing)
• Priority scheduling for service calls
• [Any added value — filter program, reporting, etc.]

I'll send the full proposal shortly, but wanted to flag this on your radar first. If your needs have changed or you'd like to discuss any adjustments to the scope, I'm all ears.

Talk soon,
[Your Name]
[Your Company] | [Phone] | [Email]`,
  },
  {
    key: 'thank_you',
    label: 'Thank You / Won',
    subject: ctx => `Thank You — ${ctx.companyName || 'Welcome Aboard'}`.trim(),
    body: (ctx) =>
`Hi ${ctx.contactName || 'there'},

Thank you for choosing [Your Company]! We're excited to get started and earn your trust.

Here's what happens next:
1. You'll receive a confirmation with your scheduled service date(s)
2. Our technician will call ahead [24 hours / the morning of] the appointment
3. After each visit, you'll get a service report detailing work completed

If anything comes up in the meantime — questions, changes, or an urgent need — don't hesitate to reach out. My direct line is always the fastest way to get me.

Looking forward to a great working relationship,
[Your Name]
[Your Company] | [Phone] | [Email]`,
  },
  {
    key: 'blank',
    label: 'Blank Email',
    subject: () => '',
    body: () => '',
  },
];

export default function EmailCompose({ context = {}, onClose }) {
  // context: { contactEmail, contactName, companyName, proposalNumber, proposalTitle }
  const [selected, setSelected] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  const applyTemplate = (tmpl) => {
    setSelected(tmpl.key);
    const sub = typeof tmpl.subject === 'function' ? tmpl.subject(context) : tmpl.subject.replace('{companyName}', context.companyName || '');
    const bd = tmpl.body(context);
    setSubject(sub);
    setBody(bd);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openMailto = () => {
    const to = context.contactEmail || '';
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 780 }}>
        <div className="modal-header">
          <h3>✉ Compose Email{context.companyName ? ` — ${context.companyName}` : ''}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Template picker */}
          <div className="section-title">Choose a Template</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {TEMPLATES.map(t => (
              <button key={t.key}
                className={`btn btn-sm ${selected === t.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => applyTemplate(t)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Email fields */}
          {selected && (
            <>
              <div className="form-group">
                <label className="form-label">To</label>
                <input className="form-control" value={context.contactEmail || ''} readOnly
                  placeholder="No email on file — add one to the contact" style={{ background: 'var(--gray-50)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-control" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Body</label>
                <textarea className="form-control" rows={16} value={body} onChange={e => setBody(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.6 }} />
              </div>
              <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 6, padding: '10px 14px', fontSize: 12.5, color: 'var(--blue-700)', marginBottom: 4 }}>
                ✏️ Customize the email above — replace <strong>[bracketed placeholders]</strong> with your details before sending.
              </div>
            </>
          )}
        </div>
        {selected && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={copyToClipboard}>
              {copied ? '✓ Copied!' : '📋 Copy Body'}
            </button>
            <button className="btn btn-primary" onClick={openMailto}>
              ✉ Open in Email App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
