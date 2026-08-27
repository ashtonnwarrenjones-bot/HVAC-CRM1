import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const EMPTY = {
  company_id: '', first_name: '', last_name: '', title: '',
  email: '', phone: '', mobile: '', preferred_contact: 'email', is_primary: false, notes: ''
};

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = () => {
    axios.get('/api/contacts', { params: search ? { search } : {} }).then(r => setContacts(r.data));
  };

  useEffect(() => {
    load();
    axios.get('/api/companies').then(r => setCompanies(r.data));
  }, []);

  useEffect(() => { load(); }, [search]);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (c) => {
    setForm({ ...c, is_primary: !!c.is_primary, company_id: c.company_id || '' });
    setEditId(c.id); setShowModal(true);
  };

  const save = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      alert('First and last name are required');
      return;
    }
    if (editId) await axios.put(`/api/contacts/${editId}`, form);
    else await axios.post('/api/contacts', form);
    setShowModal(false);
    load();
  };

  const del = async (id, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    await axios.delete(`/api/contacts/${id}`);
    load();
  };

  const f = (k) => e => setForm(p => ({ ...p, [k]: k === 'is_primary' ? e.target.checked : e.target.value }));

  return (
    <>
      <div className="page-header">
        <h2>Contacts</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Contact</button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="toolbar">
            <input
              className="search-input"
              placeholder="Search by name, email, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="text-muted text-sm">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="table-wrap">
            {contacts.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👤</div>
                <p>No contacts yet.</p>
                <button className="btn btn-primary mt-2" onClick={openAdd}>Add First Contact</button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Title</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Preferred</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id}>
                      <td>
                        <span className="font-bold">{c.first_name} {c.last_name}</span>
                        {c.is_primary ? <span className="badge badge-blue" style={{ marginLeft: 6 }}>Primary</span> : null}
                      </td>
                      <td>
                        {c.company_id ? (
                          <Link to={`/companies/${c.company_id}`} className="link-style">{c.company_name}</Link>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="text-muted">{c.title || '—'}</td>
                      <td>{c.email ? <a href={`mailto:${c.email}`} className="link-style">{c.email}</a> : '—'}</td>
                      <td className="text-muted">{c.phone || c.mobile || '—'}</td>
                      <td>
                        <span className="badge badge-gray">{c.preferred_contact}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => del(c.id, `${c.first_name} ${c.last_name}`)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editId ? 'Edit Contact' : 'Add Contact'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Company</label>
                <select className="form-control" value={form.company_id} onChange={f('company_id')}>
                  <option value="">— No Company —</option>
                  {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                </select>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-control" value={form.first_name} onChange={f('first_name')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-control" value={form.last_name} onChange={f('last_name')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Title / Role</label>
                <input className="form-control" value={form.title} onChange={f('title')} placeholder="Facility Manager, Property Manager..." />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" value={form.email} onChange={f('email')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={f('phone')} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Mobile</label>
                  <input className="form-control" value={form.mobile} onChange={f('mobile')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Contact</label>
                  <select className="form-control" value={form.preferred_contact} onChange={f('preferred_contact')}>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_primary} onChange={f('is_primary')} />
                  <span className="form-label" style={{ margin: 0 }}>Primary contact for their company</span>
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editId ? 'Save Changes' : 'Add Contact'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
