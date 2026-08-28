import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL ?? '';

const STAGE_ORDER = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const STAGE_LABELS = {
  prospect:    'Prospect',
  qualified:   'Qualified',
  proposal:    'Proposal Sent',
  negotiation: 'Negotiation',
  won:         'Won',
  lost:        'Lost',
};
const STAGE_COLORS = {
  prospect:    '#6b7280',
  qualified:   '#3b82f6',
  proposal:    '#8b5cf6',
  negotiation: '#f59e0b',
  won:         '#10b981',
  lost:        '#ef4444',
};

function fmt$(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)    return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n, d) {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || '#111827', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af' }}>{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, color, count }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: '#374151', fontWeight: 500 }}>{label}</span>
        <span style={{ color: '#6b7280' }}>
          {fmt$(value)}{count != null ? ` · ${count} deal${count !== 1 ? 's' : ''}` : ''}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, borderRadius: 4, background: color || '#3b82f6', transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const { token } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all'); // all | 30 | 90 | 365

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/deals`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('fetch failed');
      const data = await r.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // ── Filter by period ──────────────────────────────────────────────
  const filtered = deals.filter(d => {
    if (period === 'all') return true;
    const days = parseInt(period, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const updated = new Date(d.updated_at || d.created_at || 0);
    return updated >= cutoff;
  });

  // ── Core metrics ──────────────────────────────────────────────────
  const won   = filtered.filter(d => d.stage === 'won');
  const lost  = filtered.filter(d => d.stage === 'lost');
  const open  = filtered.filter(d => !['won', 'lost'].includes(d.stage));
  const closed = won.length + lost.length;

  const closeRate   = closed ? won.length / closed : 0;
  const totalWon    = won.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const avgDealSize = won.length ? totalWon / won.length : 0;
  const pipelineVal = open.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const weightedPipeline = open.reduce((s, d) => s + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100), 0);

  // ── Pipeline by stage ─────────────────────────────────────────────
  const stageData = STAGE_ORDER.map(key => {
    const group = filtered.filter(d => d.stage === key);
    const val   = group.reduce((s, d) => s + (Number(d.value) || 0), 0);
    return { key, label: STAGE_LABELS[key], count: group.length, value: val };
  });
  const maxStageVal = Math.max(...stageData.map(s => s.value), 1);

  // ── Win rate by service type ──────────────────────────────────────
  const serviceMap = {};
  filtered.forEach(d => {
    const svc = d.service_type || 'Other';
    if (!serviceMap[svc]) serviceMap[svc] = { won: 0, lost: 0, revenue: 0 };
    if (d.stage === 'won')  { serviceMap[svc].won++;  serviceMap[svc].revenue += Number(d.value) || 0; }
    if (d.stage === 'lost') serviceMap[svc].lost++;
  });
  const serviceRows = Object.entries(serviceMap)
    .map(([svc, m]) => ({ svc, ...m, rate: m.won + m.lost ? m.won / (m.won + m.lost) : null }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Top accounts by pipeline value ───────────────────────────────
  const accountMap = {};
  filtered.forEach(d => {
    const co = d.company_name || 'Unknown';
    if (!accountMap[co]) accountMap[co] = { pipeline: 0, won: 0, deals: 0 };
    accountMap[co].deals++;
    if (d.stage === 'won') accountMap[co].won += Number(d.value) || 0;
    else if (!['lost'].includes(d.stage)) accountMap[co].pipeline += Number(d.value) || 0;
  });
  const topAccounts = Object.entries(accountMap)
    .map(([co, m]) => ({ co, ...m, total: m.pipeline + m.won }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const maxAcctVal = Math.max(...topAccounts.map(a => a.total), 1);

  // ── Lost reasons ─────────────────────────────────────────────────
  const reasonMap = {};
  lost.forEach(d => {
    const r = d.lost_reason || 'No reason given';
    reasonMap[r] = (reasonMap[r] || 0) + 1;
  });
  const lostReasons = Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1]);

  // ── Avg days to close ─────────────────────────────────────────────
  const closeTimes = won
    .filter(d => d.created_at && d.updated_at)
    .map(d => (new Date(d.updated_at) - new Date(d.created_at)) / 86_400_000);
  const avgDaysToClose = closeTimes.length
    ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length)
    : null;

  // ────────────────────────────────────────────────────────────────
  const periodOptions = [
    { value: 'all', label: 'All Time' },
    { value: '30',  label: 'Last 30 Days' },
    { value: '90',  label: 'Last 90 Days' },
    { value: '365', label: 'Last Year' },
  ];

  if (loading) return (
    <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>Loading analytics…</div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>📈 Executive Analytics</h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {filtered.length} deal{filtered.length !== 1 ? 's' : ''} in view
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {periodOptions.map(o => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: period === o.value ? 'none' : '1px solid #e5e7eb',
                background: period === o.value ? '#111827' : '#fff',
                color: period === o.value ? '#fff' : '#374151',
              }}
            >{o.label}</button>
          ))}
          <button
            onClick={fetchDeals}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #e5e7eb', background: '#fff', color: '#374151' }}
          >↻ Refresh</button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard
          label="Close Rate"
          value={closed ? `${Math.round(closeRate * 100)}%` : '—'}
          sub={`${won.length} won / ${closed} closed`}
          color={closeRate >= 0.5 ? '#10b981' : closeRate >= 0.3 ? '#f59e0b' : '#ef4444'}
        />
        <StatCard label="Won Revenue" value={fmt$(totalWon)} sub={`${won.length} deal${won.length !== 1 ? 's' : ''}`} color="#10b981" />
        <StatCard label="Avg Deal Size" value={won.length ? fmt$(avgDealSize) : '—'} sub="won deals only" />
        <StatCard label="Open Pipeline" value={fmt$(pipelineVal)} sub={`${open.length} active deals`} color="#3b82f6" />
        <StatCard label="Weighted Pipeline" value={fmt$(weightedPipeline)} sub="by probability" color="#8b5cf6" />
        {avgDaysToClose != null && (
          <StatCard label="Avg Days to Close" value={`${avgDaysToClose}d`} sub="won deals" />
        )}
      </div>

      {/* ── Pipeline funnel + Lost reasons ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>

        {/* Pipeline by stage */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>Pipeline by Stage</h3>
          {stageData.map(s => (
            <HBar key={s.key} label={s.label} value={s.value} max={maxStageVal} color={STAGE_COLORS[s.key]} count={s.count} />
          ))}
        </div>

        {/* Lost reasons */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
            Lost Reason Analysis
            {lost.length > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>{lost.length} lost</span>}
          </h3>
          {lostReasons.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>No lost deals in this period.</div>
          ) : lostReasons.map(([reason, count]) => (
            <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reason}</div>
                <div style={{ height: 6, borderRadius: 3, background: '#fee2e2', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((count / lost.length) * 100)}%`, background: '#ef4444', borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', minWidth: 28, textAlign: 'right' }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Win rate by service type ── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>Win Rate by Service Type</h3>
        {serviceRows.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>No data for this period.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Service Type', 'Won', 'Lost', 'Win Rate', 'Won Revenue'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Service Type' ? 'left' : 'center', color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serviceRows.map(row => (
                  <tr key={row.svc} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>{row.svc}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{row.won}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{row.lost}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {row.rate != null ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                          background: row.rate >= 0.5 ? '#d1fae5' : row.rate >= 0.3 ? '#fef3c7' : '#fee2e2',
                          color:      row.rate >= 0.5 ? '#065f46' : row.rate >= 0.3 ? '#92400e' : '#991b1b',
                        }}>
                          {Math.round(row.rate * 100)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{fmt$(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Top accounts ── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>Top Accounts by Value</h3>
        {topAccounts.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>No account data for this period.</div>
        ) : topAccounts.map((a, i) => (
          <div key={a.co} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 24, fontSize: 12, color: '#9ca3af', textAlign: 'right', fontWeight: 600 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.co}</span>
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8, whiteSpace: 'nowrap' }}>
                  {fmt$(a.total)} · {a.deals} deal{a.deals !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden', display: 'flex' }}>
                {a.won > 0 && (
                  <div style={{ height: '100%', width: `${Math.round((a.won / maxAcctVal) * 100)}%`, background: '#10b981' }} />
                )}
                {a.pipeline > 0 && (
                  <div style={{ height: '100%', width: `${Math.round((a.pipeline / maxAcctVal) * 100)}%`, background: '#3b82f6' }} />
                )}
              </div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {[{ color: '#10b981', label: 'Won Revenue' }, { color: '#3b82f6', label: 'Open Pipeline' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
