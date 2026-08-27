import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EmailCompose from '../components/EmailCompose';

const ACTIVITY_TYPES = ['note', 'call', 'email', 'visit', 'quote', 'service'];
const CONTRACT_COLORS = {
  maintenance_contract: 'badge-green', on_call: 'badge-blue',
  prospect: 'badge-yellow', inactive: 'badge-gray',
};
const PROPOSAL_COLORS = {
  draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green', declined: 'badge-red',
};

const CONTACT_EMPTY = {
  first_name: '', last_name: '', title: '', email: '', phone: '', mobile: '', preferred_contact: 'email', is_primary: false, notes: ''
};

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [contactForm, setContactForm] = useState(CONTACT_EMPTY);
  const [editContactId, setEditContactId] = useState(null);
  const [note, setNote] = useState({ type: 'note', subject: '', body: '' });

  const load = () => axios.get(`/api/companies/${id}`).then(r => setCompany(r.data));
  useEffect(() => { load(); }, [id]);

  const saveContact = async () => {
    const data = { ...contactForm, company_id: id };
    if (editContactId) await axios.put(`/api/contacts/${editContactId}`, data);
    else await axios.post('/api/contacts', data);
    setShowContactModal(false);
    load();
  };

  const deleteContact = async (cid, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    await axios.delete(`/api/contacts/${cid}`);
    load();
  };

  const addNote = async () => {
    await axios.post(`/api/companies/${id}/activities`, note);
    setNote({ type: 'note', subject: '', body: '' });
    setShowNoteModal(false);
    load();
  };

  const cf = (k) => e => setContactForm(p => ({ ...p, [k]: k === 'is_primary' ? e.target.checked : e.target.value }));

  const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

  if (!company) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost" onClick={() => navigate('/companies')}>← Back</button>
          <div>
            <h2>{company.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${CONTRACT_COLORS[company.contract_type] || 'badge-gray'}`}>{(company.contract_type || '').replace(/_/g, ' ')}</span>
              {company.property_type && <span className="text-muted text-sm">{company.property_type}</span>}
              {company.city && <span className="text-muted text-sm">📍 {[company.city, company.state].filter(Boolean).join(', ')}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowNoteModal(true)}>+ Log Activity</button>
          <button className="btn btn-secondary" onClick={() => setShowEmail(true)}>✉ Email</button>
          <Link to={`/proposals?company=${id}`} className="btn btn-primary">+ New Proposal</Link>
        </div>
      </div>

      <div className="page-content">
        <div className="two-col">
          {/* Left column */}
          <div>
            {/* Company Info */}
            <div className="card mb-4">
              <div className="card-header"><h3>Account Details</h3></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                  {[
                    ['Phone', company.phone],
                    ['Website', company.website],
                    ['Address', [company.address, company.city, company.state, company.zip].filter(Boolean).join(', ')],
                    ['HVAC Units', company.num_hvac_units],
                    ['Plumbing Fixtures', company.num_plumbing_fixtures],
                    ['Est. Annual Revenue', company.annual_revenue ? fmt(company.annual_revenue) : null],
                  ].map(([label, val]) => val ? (
                    <div key={label}>
                      <div className="text-muted text-sm">{label}</div>
                      <div className="font-bold">{val}</div>
                    </div>
                  ) : null)}
                </div>
                {company.notes && (
                  <div className="mt-4" style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '10px 12px', fontSize: 13 }}>
                    <div className="text-muted text-sm mb-1">Notes</div>
                    {company.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Contacts */}
            <div className="card">
              <div className="card-header">
                <h3>Contacts ({company.contacts?.length || 0})</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => { setContactForm(CONTACT_EMPTY); setEditContactId(null); setShowContactModal(true); }}>+ Add</button>
              </div>
              {company.contacts?.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p>No contacts yet.</p>
                </div>
              ) : (
                <div className="card-body" style={{ padding: '8px 0' }}>
                  {company.contacts?.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                      <div>
                        <div className="font-bold">
                          {c.first_name} {c.last_name}
                          {c.is_primary ? <span className="badge badge-blue" style={{ marginLeft: 6 }}>Primary</span> : null}
                        </div>
                        {c.title && <div className="text-muted text-sm">{c.title}</div>}
                        <div className="flex gap-2 mt-1">
                          {c.email && <a href={`mailto:${c.email}`} className="link-style text-sm">✉ {c.email}</a>}
                          {c.phone && <span className="text-sm text-muted">📞 {c.phone}</span>}
                          {c.mobile && <span className="text-sm text-muted">📱 {c.mobile}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setContactForm({ ...c, is_primary: !!c.is_primary });
                          setEditContactId(c.id);
                          setShowContactModal(true);
                        }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }} onClick={() => deleteContact(c.id, `${c.first_name} ${c.last_name}`)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div>
            {/* Proposals */}
            <div className="card mb-4">
              <div className="card-header">
                <h3>Proposals ({company.proposals?.length || 0})</h3>
                <Link to="/proposals" className="btn btn-secondary btn-sm">View All</Link>
              </div>
              {company.proposals?.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}><p>No proposals yet.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Title</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {company.proposals.map(p => (
                        <tr key={p.id}>
                          <td><Link to={`/proposals/${p.id}`} className="link-style">{p.title}</Link></td>
                          <td className="font-bold">{fmt(p.total_amount)}</td>
                          <td><span className={`badge ${PROPOSAL_COLORS[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                          <td className="text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div className="card">
              <div className="card-header">
                <h3>Activity Log</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowNoteModal(true)}>+ Log</button>
              </div>
              {company.activities?.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}><p>No activities yet.</p></div>
              ) : (
                <div style={{ padding: '0 4px', maxHeight: 360, overflowY: 'auto' }}>
                  {company.activities?.map(a => (
                    <div key={a.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)' }}>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-gray">{a.type}</span>
                        {a.first_name && <span className="text-sm text-muted">with {a.first_name} {a.last_name}</span>}
                        <span className="text-sm text-muted" style={{ marginLeft: 'auto' }}>{new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      {a.subject && <div className="font-bold mt-1" style={{ fontSize: 13 }}>{a.subject}</div>}
                      {a.body && <div style={{ fontSize: 13, color: 'var(--gray-700)', marginTop: 2 }}>{a.body}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowContactModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editContactId ? 'Edit Contact' : 'Add Contact'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowContactModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-control" value={contactForm.first_name} onChange={cf('first_name')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-control" value={contactForm.last_name} onChange={cf('last_name')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Title / Role</label>
                <input className="form-control" value={contactForm.title} onChange={cf('title')} placeholder="Facility Manager, Property Manager..." />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" value={contactForm.email} onChange={cf('email')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={contactForm.phone} onChange={cf('phone')} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Mobile</label>
                  <input className="form-control" value={contactForm.mobile} onChange={cf('mobile')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Contact</label>
                  <select className="form-control" value={contactForm.preferred_contact} onChange={cf('preferred_contact')}>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={contactForm.is_primary} onChange={cf('is_primary')} />
                  <span className="form-label" style={{ margin: 0 }}>Primary contact for this account</span>
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={contactForm.notes} onChange={cf('notes')} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveContact}>{editContactId ? 'Save' : 'Add Contact'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Compose */}
      {showEmail && (
        <EmailCompose
          context={{
            companyName: company.name,
            contactName: company.contacts?.[0] ? `${company.contacts[0].first_name} ${company.contacts[0].last_name}` : '',
            contactEmail: company.contacts?.find(c => c.is_primary)?.email || company.contacts?.[0]?.email || '',
          }}
          onClose={() => setShowEmail(false)}
        />
      )}

      {/* Note/Activity Modal */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNoteModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Log Activity</h3>
              <button className="btn btn-ghost" onClick={() => setShowNoteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Activity Type</label>
                  <select className="form-control" value={note.type} onChange={e => setNote(p => ({ ...p, type: e.target.value }))}>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input className="form-control" value={note.subject} onChange={e => setNote(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Initial call, Site visit..." />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Details</label>
                <textarea className="form-control" rows={4} value={note.body} onChange={e => setNote(p => ({ ...p, body: e.target.value }))} placeholder="Notes from the call/visit..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addNote}>Save Activity</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
