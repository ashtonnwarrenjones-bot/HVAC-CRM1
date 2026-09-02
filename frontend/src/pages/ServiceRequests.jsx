import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText, AlertCircle, Loader, CheckCircle,
  Clock, Building2, User, Wrench, ChevronDown, ChevronUp
} from 'lucide-react';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  reviewed:   { label: 'Reviewed',    bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
  quoted:     { label: 'Quoted',      bg: '#f5f3ff', color: '#6d28d9', dot: '#7c3aed' },
  completed:  { label: 'Completed',   bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  declined:   { label: 'Declined',    bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color,
      padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

function RequestCard({ req, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const date = new Date(req.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = new Date(req.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });

  const handleStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await axios.patch(`/api/service-requests/${req.id}`, { status: newStatus });
      onStatusChange(req.id, newStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const rowStyle = { display: 'flex', gap: 8, marginBottom: 8, fontSize: 13 };
  const labelStyle = { color: 'var(--text-muted)', minWidth: 110, flexShrink: 0 };
  const valueStyle = { color: 'var(--text-primary)', fontWeight: 500 };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: '#fef3c7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={18} color="#d97706" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {req.job_title || 'Quote Request'}
            </div>
            <StatusBadge status={req.status} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 5 }}>
            {req.company_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                <Building2 size={11} /> {req.company_name}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <User size={11} /> {req.submitted_by}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <Clock size={11} /> {date} at {time}
            </div>
          </div>
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ height: 14 }} />

          {/* Equipment details */}
          {(req.manufacturer || req.model || req.serial_number) && (
            <div style={{ background: 'var(--bg-page)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Equipment
              </p>
              {req.manufacturer && (
                <div style={rowStyle}><span style={labelStyle}>Manufacturer</span><span style={valueStyle}>{req.manufacturer}</span></div>
              )}
              {req.model && (
                <div style={rowStyle}><span style={labelStyle}>Model</span><span style={valueStyle}>{req.model}</span></div>
              )}
              {req.serial_number && (
                <div style={rowStyle}><span style={labelStyle}>Serial #</span><span style={valueStyle}>{req.serial_number}</span></div>
              )}
            </div>
          )}

          {/* Work needed */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Work Needed
            </p>
            <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {req.work_needed}
            </div>
          </div>

          {req.notes && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notes
              </p>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                {req.notes}
              </div>
            </div>
          )}

          {/* Status actions */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Update Status
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  disabled={updating || req.status === key}
                  onClick={() => handleStatus(key)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, border: `1px solid ${req.status === key ? cfg.dot : 'var(--border)'}`,
                    background: req.status === key ? cfg.bg : 'transparent',
                    color: req.status === key ? cfg.color : 'var(--text-muted)',
                    fontSize: 12, fontWeight: 600, cursor: updating || req.status === key ? 'default' : 'pointer',
                    opacity: updating ? 0.6 : 1,
                    transition: 'all .15s',
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServiceRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    setLoading(true);
    axios.get('/api/service-requests')
      .then(r => setRequests(r.data || []))
      .catch(() => setError('Could not load quote requests.'))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (id, newStatus) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const filtered = filter === 'all'
    ? requests
    : requests.filter(r => r.status === filter);

  const counts = {
    pending:  requests.filter(r => r.status === 'pending').length,
    reviewed: requests.filter(r => r.status === 'reviewed').length,
    quoted:   requests.filter(r => r.status === 'quoted').length,
    all:      requests.length,
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Quote Requests
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Equipment quotes submitted by field technicians
        </p>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Pending',  count: counts.pending,  color: '#d97706', bg: '#fef3c7' },
            { label: 'Reviewed', count: counts.reviewed, color: '#2563eb', bg: '#dbeafe' },
            { label: 'Quoted',   count: counts.quoted,   color: '#7c3aed', bg: '#f5f3ff' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 10, padding: '14px 16px', textAlign: 'center',
              border: `1px solid ${s.color}30`,
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600, opacity: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
        {[
          { key: 'pending',  label: `Pending${counts.pending > 0 ? ` (${counts.pending})` : ''}` },
          { key: 'reviewed', label: 'Reviewed' },
          { key: 'quoted',   label: 'Quoted' },
          { key: 'all',      label: 'All' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              flex: 1, padding: '7px 10px', border: 'none', borderRadius: 6,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === tab.key ? 'var(--blue-600)' : 'transparent',
              color: filter === tab.key ? '#fff' : 'var(--text-muted)',
              transition: 'all .15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader size={24} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14 }}>Loading quote requests…</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', color: '#dc2626', fontSize: 13 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <CheckCircle size={40} color="var(--text-muted)" style={{ opacity: 0.3, margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
            {filter === 'pending' ? 'No pending requests' : 'No requests to show'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {filter === 'pending' ? 'Technicians can submit quote requests from their My Jobs view.' : ''}
          </p>
        </div>
      )}

      {!loading && !error && filtered.map(req => (
        <RequestCard key={req.id} req={req} onStatusChange={handleStatusChange} />
      ))}
    </div>
  );
}
