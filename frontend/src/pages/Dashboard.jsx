import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const CONTRACT_COLORS = {
  maintenance_contract: 'badge-green',
  on_call: 'badge-blue',
  prospect: 'badge-yellow',
  inactive: 'badge-gray',
};

const PROPOSAL_COLORS = {
  draft: 'badge-gray',
  sent: 'badge-blue',
  accepted: 'badge-green',
  declined: 'badge-red',
};

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/companies'),
      axios.get('/api/proposals'),
      axios.get('/api/contacts'),
    ]).then(([c, p, ct]) => {
      setCompanies(c.data);
      setProposals(p.data);
      setContacts(ct.data);
    }).finally(() => setLoading(false));
  }, []);

  const totalPipelineValue = proposals
    .filter(p => ['draft', 'sent'].includes(p.status))
    .reduce((s, p) => s + (p.total_amount || 0), 0);

  const totalAccepted = proposals
    .filter(p => p.status === 'accepted')
    .reduce((s, p) => s + (p.total_amount || 0), 0);

  const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const recentProposals = [...proposals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const recentCompanies = [...companies].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  if (loading) return <div className="page-content"><p className="text-muted">Loading...</p></div>;

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <span className="text-muted text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Companies</div>
            <div className="stat-value" style={{ color: 'var(--blue-700)' }}>{companies.length}</div>
            <div className="stat-sub">{companies.filter(c => c.contract_type === 'maintenance_contract').length} on contract</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Contacts</div>
            <div className="stat-value" style={{ color: 'var(--gray-700)' }}>{contacts.length}</div>
            <div className="stat-sub">across all accounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pipeline Value</div>
            <div className="stat-value" style={{ color: 'var(--yellow-600)' }}>{fmt(totalPipelineValue)}</div>
            <div className="stat-sub">{proposals.filter(p => ['draft','sent'].includes(p.status)).length} open proposals</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Won Revenue</div>
            <div className="stat-value" style={{ color: 'var(--green-600)' }}>{fmt(totalAccepted)}</div>
            <div className="stat-sub">{proposals.filter(p => p.status === 'accepted').length} accepted proposals</div>
          </div>
        </div>

        <div className="two-col">
          {/* Recent Proposals */}
          <div className="card">
            <div className="card-header">
              <h3>Recent Proposals</h3>
              <Link to="/proposals" className="btn btn-secondary btn-sm">View All</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Title</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProposals.length === 0 ? (
                    <tr><td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No proposals yet</td></tr>
                  ) : recentProposals.map(p => (
                    <tr key={p.id}>
                      <td><Link to={`/companies/${p.company_id}`} className="link-style">{p.company_name || '—'}</Link></td>
                      <td><Link to={`/proposals/${p.id}`} className="link-style">{p.title}</Link></td>
                      <td className="font-bold">{fmt(p.total_amount)}</td>
                      <td><span className={`badge ${PROPOSAL_COLORS[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Companies */}
          <div className="card">
            <div className="card-header">
              <h3>Recent Accounts</h3>
              <Link to="/companies" className="btn btn-secondary btn-sm">View All</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Type</th>
                    <th>Contract</th>
                    <th>Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCompanies.length === 0 ? (
                    <tr><td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No companies yet</td></tr>
                  ) : recentCompanies.map(c => (
                    <tr key={c.id}>
                      <td><Link to={`/companies/${c.id}`} className="link-style">{c.name}</Link></td>
                      <td className="text-muted">{c.property_type}</td>
                      <td><span className={`badge ${CONTRACT_COLORS[c.contract_type] || 'badge-gray'}`}>{(c.contract_type || '').replace('_', ' ')}</span></td>
                      <td className="text-muted">{c.contact_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Contract breakdown */}
        <div className="card mt-4">
          <div className="card-header"><h3>Account Status Breakdown</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { key: 'maintenance_contract', label: 'Maintenance Contract', color: 'var(--green-600)' },
                { key: 'on_call', label: 'On-Call / T&M', color: 'var(--blue-700)' },
                { key: 'prospect', label: 'Prospect', color: 'var(--yellow-600)' },
                { key: 'inactive', label: 'Inactive', color: 'var(--gray-500)' },
              ].map(({ key, label, color }) => {
                const count = companies.filter(c => c.contract_type === key).length;
                const pct = companies.length ? Math.round((count / companies.length) * 100) : 0;
                return (
                  <div key={key} style={{ flex: 1, minWidth: 140 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                      <span className="text-sm text-muted">{label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
                    <div style={{ height: 4, background: 'var(--gray-200)', borderRadius: 2, marginTop: 6 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                    <div className="text-sm text-muted mt-1">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
