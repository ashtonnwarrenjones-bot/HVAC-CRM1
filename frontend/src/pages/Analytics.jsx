import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Users, Award, MapPin } from 'lucide-react';

function fmt(n) {
  if (n == null || n === '') return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];

const DAYS_OPTIONS = [
  { label: '30 days',  value: 30  },
  { label: '90 days',  value: 90  },
  { label: '6 months', value: 180 },
  { label: '1 year',   value: 365 },
];

function Medal({ rank }) {
  const medals = ['🥇','🥈','🥉'];
  return <span style={{ fontSize: 16 }}>{medals[rank] || `#${rank + 1}`}</span>;
}

export default function Analytics() {
  const [days, setDays]           = useState(30);
  const [scorecardData, setScorecard] = useState([]);
  const [leadData, setLeadData]   = useState([]);
  const [revenueData, setRevenue] = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = async (d) => {
    setLoading(true);
    try {
      const [scoreRes, leadRes, revRes] = await Promise.all([
        axios.get('/api/analytics/tech-scorecard', { params: { days: d } }),
        axios.get('/api/analytics/lead-sources',   { params: { days: d } }),
        axios.get('/api/analytics/revenue'),
      ]);
      setScorecard(scoreRes.data);
      setLeadData(leadRes.data);
      setRevenue(revRes.data.map(r => ({
        ...r,
        paid_revenue: parseFloat(r.paid_revenue) || 0,
        outstanding:  parseFloat(r.outstanding) || 0,
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]);

  const totalRevenue = scorecardData.reduce((s, t) => s + (parseFloat(t.total_revenue) || 0), 0);
  const topTech = scorecardData[0];

  return (
    <>
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={20} /> Analytics
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {DAYS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`btn btn-sm ${days === opt.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDays(opt.value)}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p className="text-muted">Loading analytics…</p></div>
      ) : (
        <div style={{ padding: '0 24px 24px' }}>

          {/* ── Revenue Trend ── */}
          <div className="card" style={{ marginTop: 20, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
              <TrendingUp size={15} /> Revenue Trend (12 months)
            </h3>
            {revenueData.length === 0 ? (
              <p className="text-muted" style={{ textAlign: 'center', padding: '24px 0' }}>No invoice data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--gray-500)' }} tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)} />
                  <Tooltip formatter={(v) => fmt(v)} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  <Area type="monotone" dataKey="paid_revenue" name="Collected" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                  <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Technician Scorecard ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Award size={15} /> Technician Scorecard
              </h3>
              {scorecardData.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '24px 0' }}>No technician data yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {scorecardData.map((tech, i) => {
                    const rev = parseFloat(tech.total_revenue) || 0;
                    const pct = totalRevenue > 0 ? (rev / totalRevenue * 100) : 0;
                    return (
                      <div key={tech.technician}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Medal rank={i} />
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{tech.technician}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--green-600)' }}>{fmt(rev)}</span>
                            <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 8 }}>{tech.completed_jobs} jobs</span>
                          </div>
                        </div>
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'width .4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>Avg ticket: {fmt(parseFloat(tech.avg_ticket))}</span>
                          <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{pct.toFixed(0)}% of revenue</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mini bar chart */}
              {scorecardData.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={scorecardData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="technician" tick={{ fontSize: 10, fill: 'var(--gray-500)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--gray-500)' }} tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} />
                      <Tooltip formatter={v => fmt(v)} contentStyle={{ fontSize: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                      <Bar dataKey="total_revenue" name="Revenue" radius={[3,3,0,0]}>
                        {scorecardData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ── Lead Sources ── */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                <MapPin size={15} /> Lead Sources
              </h3>
              {leadData.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  No lead data yet. Add a "Lead Source" field to your companies.
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={leadData}
                        dataKey="revenue"
                        nameKey="source"
                        cx="50%" cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={2}
                      >
                        {leadData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} contentStyle={{ fontSize: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {leadData.map((src, i) => (
                      <div key={src.source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{src.source}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, color: 'var(--gray-500)' }}>
                          <span>{src.company_count} co.</span>
                          <span>{src.job_count} jobs</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(src.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Top performer highlight ── */}
          {topTech && (
            <div className="card" style={{ marginTop: 16, padding: 20, background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 40 }}>🏆</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '.05em' }}>Top Performer — Last {days} Days</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 2 }}>{topTech.technician}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                    {fmt(parseFloat(topTech.total_revenue))} revenue · {topTech.completed_jobs} jobs completed · {fmt(parseFloat(topTech.avg_ticket))} avg ticket
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
