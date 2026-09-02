import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? '';

function AuthImage({ src, style, alt }) {
  const [blobSrc, setBlobSrc] = React.useState(null);
  React.useEffect(() => {
    if (!src) return;
    const token = localStorage.getItem('crm_token');
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => setBlobSrc(URL.createObjectURL(blob)))
      .catch(() => {});
  }, [src]);
  if (!blobSrc) return null;
  return <img src={blobSrc} alt={alt || ''} style={style} />;
}

export default function JobReport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    axios.get(`/api/mobile/jobs/${id}/report`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load report'));
    // Load company name from settings for letterhead
    axios.get('/api/settings').then(r => {
      const s = r.data || {};
      setCompanyName(s.company_name || s.companyName || 'Conduit CRM');
    }).catch(() => {});
  }, [id]);

  const fmtDuration = (secs) => {
    if (!secs) return '—';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (error) return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#dc2626' }}>{error}</div>
  );
  if (!data) return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#6b7280' }}>Loading report…</div>
  );

  const { job, parts, timeEntries, notes, photos } = data;
  const totalSeconds = timeEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
  const partsTotal = parts.reduce((sum, p) => sum + ((p.unit_cost || 0) * (p.quantity || 1)), 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .report-page { padding: 24px !important; }
        }
        body { background: #f3f4f6; }
        .report-page { background: white; }
      `}</style>

      {/* Print bar */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1e3a5f', padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'sans-serif' }}>
          📄 Job Completion Report
        </span>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#fff', color: '#1e3a5f', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      <div className="report-page" style={{
        maxWidth: 820, margin: '60px auto 40px', padding: 48,
        fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 14, color: '#111827',
        boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
      }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid #1e3a5f' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>{companyName}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Field Service CRM</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Job Completion Report</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
              {job.scheduled_date ? fmtDate(job.scheduled_date) : new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Job header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>{job.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px', fontSize: 13 }}>
            {[
              ['Customer', job.company_name],
              ['Contact', job.contact_name],
              ['Contact Phone', job.contact_phone],
              ['Address', [job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')],
              ['Job Type', job.job_type ? job.job_type.replace(/_/g, ' ') : null],
              ['Technician', job.technician],
              ['Status', job.status],
              ['Job #', job.id],
            ].map(([label, val]) => val ? (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 500, textTransform: label === 'Status' || label === 'Job Type' ? 'capitalize' : 'none' }}>{val}</div>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Time entries */}
        {timeEntries.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Time on Job
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Technician</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Clock In</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Clock Out</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '7px 10px' }}>{e.user_name || e.username || 'Tech'}</td>
                    <td style={{ padding: '7px 10px' }}>{new Date(e.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                    <td style={{ padding: '7px 10px' }}>{e.stopped_at ? new Date(e.stopped_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtDuration(e.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
              {totalSeconds > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={3} style={{ padding: '7px 10px', fontWeight: 700 }}>Total Time</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtDuration(totalSeconds)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Parts used */}
        {parts.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Parts & Materials
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Unit Cost</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {parts.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '7px 10px' }}>{p.name}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>{p.quantity}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>{p.unit_cost ? `$${parseFloat(p.unit_cost).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                      {p.unit_cost ? `$${(p.unit_cost * (p.quantity || 1)).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {partsTotal > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={3} style={{ padding: '7px 10px', fontWeight: 700 }}>Parts Total</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>${partsTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Field notes */}
        {(job.notes || notes.length > 0) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Field Notes
            </div>
            {job.notes && (
              <div style={{ fontSize: 13, color: '#374151', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', marginBottom: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {job.notes}
              </div>
            )}
            {notes.map(n => (
              <div key={n.id} style={{ fontSize: 13, color: '#374151', background: '#f9fafb', borderRadius: 6, padding: '10px 12px', marginBottom: 6, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                <span style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{n.created_by} · {new Date(n.created_at).toLocaleString()}</span>
                {n.note}
              </div>
            ))}
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Service Photos ({photos.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {photos.map(photo => (
                <AuthImage
                  key={photo.id}
                  src={`${API}/api/photos/${photo.id}/file`}
                  alt={photo.original_name}
                  style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Signature line */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          <div>
            <div style={{ borderBottom: '1px solid #111827', paddingBottom: 4, marginBottom: 6, minHeight: 36 }} />
            <div style={{ fontSize: 12, color: '#6b7280' }}>Customer Signature</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Date: _______________</div>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #111827', paddingBottom: 4, marginBottom: 6, minHeight: 36 }} />
            <div style={{ fontSize: 12, color: '#6b7280' }}>Technician Signature</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Date: _______________</div>
          </div>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
          Generated by {companyName} · Job #{job.id} · {new Date().toLocaleDateString()}
        </div>
      </div>
    </>
  );
}
