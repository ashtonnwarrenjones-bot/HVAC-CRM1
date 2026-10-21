import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function Integrations() {
  const [qbStatus, setQbStatus] = useState(null);
  const [qbLoading, setQbLoading] = useState(true);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [divvyStatus, setDivvyStatus] = useState(null);
  const [divvyApiKey, setDivvyApiKey] = useState('');
  const [divvyLoading, setDivvyLoading] = useState(true);
  const [divvyTransactions, setDivvyTransactions] = useState([]);
  const [divvyTxLoading, setDivvyTxLoading] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const [tagModal, setTagModal] = useState(null);
  const [deals, setDeals] = useState([]);
  const [tagDealId, setTagDealId] = useState('');
  const [toast, setToast] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadQbStatus() {
    setQbLoading(true);
    try { const r = await fetch(`${API}/api/quickbooks/status`, { headers }); setQbStatus(await r.json()); }
    catch { setQbStatus(null); } finally { setQbLoading(false); }
  }

  async function connectQB() {
    const r = await fetch(`${API}/api/quickbooks/auth-url`, { headers });
    const d = await r.json();
    window.location.href = d.url;
  }

  async function disconnectQB() {
    await fetch(`${API}/api/quickbooks/disconnect`, { method: 'POST', headers });
    showToast('QuickBooks disconnected'); loadQbStatus();
  }

  async function syncAllCustomers() {
    setQbSyncing(true);
    try { const r = await fetch(`${API}/api/quickbooks/sync/all-customers`, { method: 'POST', headers }); const d = await r.json(); showToast(`Synced ${d.synced} customers to QuickBooks`); }
    catch { showToast('Sync failed', 'error'); } finally { setQbSyncing(false); }
  }

  async function loadDivvyStatus() {
    setDivvyLoading(true);
    try { const r = await fetch(`${API}/api/divvy/status`, { headers }); setDivvyStatus(await r.json()); }
    catch { setDivvyStatus(null); } finally { setDivvyLoading(false); }
  }

  async function saveDivvyKey() {
    if (!divvyApiKey.trim()) return;
    const r = await fetch(`${API}/api/divvy/config`, { method: 'POST', headers, body: JSON.stringify({ api_key: divvyApiKey.trim() }) });
    const d = await r.json();
    if (d.ok) { showToast('Divvy API key saved'); loadDivvyStatus(); loadDivvyTransactions(); }
    else showToast(d.error || 'Failed', 'error');
  }

  async function loadDivvyTransactions() {
    setDivvyTxLoading(true);
    try { const r = await fetch(`${API}/api/divvy/transactions`, { headers }); const d = await r.json(); setDivvyTransactions(d.transactions || []); }
    catch { } finally { setDivvyTxLoading(false); }
  }

  async function loadBudgets() {
    try { const r = await fetch(`${API}/api/divvy/budgets`, { headers }); const d = await r.json(); setBudgets(d.budgets || []); } catch { }
  }

  async function loadDeals() {
    try { const r = await fetch(`${API}/api/deals`, { headers }); setDeals(await r.json() || []); } catch { }
  }

  async function tagTx() {
    if (!tagDealId || !tagModal) return;
    const r = await fetch(`${API}/api/divvy/tag`, { method: 'POST', headers, body: JSON.stringify({ transaction_id: tagModal.transaction.id, deal_id: parseInt(tagDealId) }) });
    const d = await r.json();
    if (d.ok) { showToast(d.budget_warning ? `Tagged! ⚠️ ${d.budget_warning}` : 'Transaction tagged'); setTagModal(null); loadDivvyTransactions(); loadBudgets(); }
    else showToast(d.error || 'Failed', 'error');
  }

  async function untagTx(id) {
    await fetch(`${API}/api/divvy/tag/${id}`, { method: 'DELETE', headers });
    showToast('Tag removed'); loadDivvyTransactions(); loadBudgets();
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (p.get('qb') === 'connected') { showToast('QuickBooks connected!'); window.history.replaceState({}, '', window.location.pathname + '#/integrations'); }
    loadQbStatus(); loadDivvyStatus(); loadDeals();
  }, []);

  useEffect(() => { if (divvyStatus?.connected) { loadDivvyTransactions(); loadBudgets(); } }, [divvyStatus]);

  const fmt = n => n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  const S = {
    card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 24 },
    badge: (ok) => ({ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: ok ? '#dcfce7' : '#f3f4f6', color: ok ? '#16a34a' : '#6b7280' }),
    btn: (color) => ({ background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }),
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#dc2626' : '#16a34a', color: '#fff', padding: '12px 20px', borderRadius: 8, fontWeight: 500 }}>{toast.msg}</div>}

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Integrations</h1>
      <p style={{ color: '#6b7280', marginBottom: 32 }}>Connect external services to sync data with your CRM.</p>

      {/* QuickBooks */}
      <section style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, background: '#2ca01c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>QB</span>
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>QuickBooks Online</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Sync customers, invoices, and payments</p>
          </div>
          {!qbLoading && <span style={S.badge(qbStatus?.connected)}>{qbStatus?.connected ? '● Connected' : '○ Not connected'}</span>}
        </div>
        {qbLoading ? <p style={{ color: '#9ca3af' }}>Checking status…</p> : qbStatus?.connected ? (
          <div>
            <p style={{ color: '#374151', fontSize: 14, marginBottom: 16 }}>Connected to <strong>{qbStatus.company_name || 'your QuickBooks company'}</strong></p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={syncAllCustomers} disabled={qbSyncing} style={S.btn('#2ca01c')}>{qbSyncing ? 'Syncing…' : '↑ Sync All Customers'}</button>
              <button onClick={disconnectQB} style={{ background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>Disconnect</button>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>Invoices sync automatically when you push a deal. Payments from QB mark deals as <em>Paid</em> via webhook.</p>
          </div>
        ) : (
          <div>
            <p style={{ color: '#374151', fontSize: 14, marginBottom: 16 }}>Connect to sync companies as QB customers, push deals as invoices, and auto-update deal status on payment.</p>
            <button onClick={connectQB} style={{ ...S.btn('#2ca01c'), fontSize: 15, padding: '10px 20px' }}>Connect QuickBooks Online →</button>
          </div>
        )}
      </section>

      {/* Divvy */}
      <section style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, background: '#6366f1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>BILL</span>
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Divvy (BILL Spend &amp; Expense)</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Tag card transactions to deals and track budgets</p>
          </div>
          {!divvyLoading && <span style={S.badge(divvyStatus?.connected)}>{divvyStatus?.connected ? '● Connected' : '○ Not connected'}</span>}
        </div>

        {!divvyStatus?.connected && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: '#374151', fontSize: 14, marginBottom: 12 }}>Enter your Divvy API key to pull card transactions and tag them to CRM deals.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="password" placeholder="Divvy API key" value={divvyApiKey} onChange={e => setDivvyApiKey(e.target.value)}
                style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 14 }} />
              <button onClick={saveDivvyKey} style={S.btn('#6366f1')}>Connect</button>
            </div>
          </div>
        )}

        {divvyStatus?.connected && (
          <>
            {budgets.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Deal Budgets</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                  {budgets.map(b => {
                    const pct = b.budget > 0 ? Math.min(100, (b.total_spent / b.budget) * 100) : 0;
                    return (
                      <div key={b.deal_id} style={{ border: `1px solid ${b.over_budget ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 8, padding: 14, background: b.over_budget ? '#fff5f5' : '#fafafa' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{b.deal_title}</div>
                        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, marginBottom: 6 }}>
                          <div style={{ background: b.over_budget ? '#dc2626' : pct > 75 ? '#f59e0b' : '#6366f1', width: `${pct}%`, height: '100%', borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{fmt(b.total_spent)} spent</span><span>{fmt(b.budget)} budget</span>
                        </div>
                        {b.over_budget && <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, marginTop: 4 }}>⚠ Over budget</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Transactions</h3>
              <button onClick={loadDivvyTransactions} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
            </div>
            {divvyTxLoading ? <p style={{ color: '#9ca3af' }}>Loading…</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead><tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Date','Merchant','Amount','Category','Deal','Action'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {divvyTransactions.length === 0
                      ? <tr><td colSpan={6} style={{ padding: 20, color: '#9ca3af', textAlign: 'center' }}>No transactions</td></tr>
                      : divvyTransactions.map(tx => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 10px' }}>{tx.transaction_date || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{tx.merchant || tx.description || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{fmt(tx.amount)}</td>
                          <td style={{ padding: '8px 10px', color: '#6b7280' }}>{tx.category || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {tx.deal_id ? <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 12, fontSize: 13 }}>Deal #{tx.deal_id}</span> : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {tx.deal_id
                              ? <button onClick={() => untagTx(tx.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, padding: 0 }}>Remove</button>
                              : <button onClick={() => setTagModal({ transaction: tx })} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>Tag deal</button>
                            }
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {tagModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 8px' }}>Tag Transaction to Deal</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>{tagModal.transaction.merchant || tagModal.transaction.description} — {fmt(tagModal.transaction.amount)}</p>
            <select value={tagDealId} onChange={e => setTagDealId(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, marginBottom: 16 }}>
              <option value="">Select a deal…</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setTagModal(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={tagTx} disabled={!tagDealId} style={S.btn('#6366f1')}>Tag to deal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
