import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Wrench, MapPin, Calendar, Clock, Phone, User,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle,
  Loader, Building2
} from 'lucide-react';

const STATUS_CONFIG = {
  scheduled:   { label: 'Scheduled',   bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
  in_progress: { label: 'In Progress', bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  completed:   { label: 'Completed',   bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  cancelled:   { label: 'Cancelled',   bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  pending:     { label: 'Pending',     bg: '#f5f3ff', color: '#5b21b6', dot: '#7c3aed' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color,
      padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false);

  const scheduledDate = job.scheduled_date
    ? new Date(job.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: 'var(--blue-50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Wrench size={18} color="var(--blue-600)" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {job.title}
            </div>
            <StatusBadge status={job.status} />
          </div>

          {job.company_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--text-muted)', fontSize: 13 }}>
              <Building2 size={12} />
              <span>{job.company_name}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
            {scheduledDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                <Calendar size={12} />
                <span>{scheduledDate}</span>
              </div>
            )}
            {job.scheduled_time && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                <Clock size={12} />
                <span>{job.scheduled_time}</span>
              </div>
            )}
          </div>
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', marginTop: 0 }}>
          <div style={{ height: 12 }} />

          {job.address && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <MapPin size={14} color="var(--blue-600)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {job.address}
                {job.city && `, ${job.city}`}
                {job.state && `, ${job.state}`}
              </div>
            </div>
          )}

          {job.contact_name && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <User size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{job.contact_name}</div>
            </div>
          )}

          {job.contact_phone && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Phone size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
              <a href={`tel:${job.contact_phone}`} style={{ fontSize: 13, color: 'var(--blue-600)', textDecoration: 'none', fontWeight: 500 }}>
                {job.contact_phone}
              </a>
            </div>
          )}

          {job.description && (
            <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 4 }}>
              {job.description}
            </div>
          )}

          {job.notes && (
            <div style={{ marginTop: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
              <strong>Notes:</strong> {job.notes}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {job.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent([job.address, job.city, job.state].filter(Boolean).join(', '))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', background: 'var(--blue-600)', color: '#fff',
                  borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none'
                }}
              >
                <MapPin size={14} /> Directions
              </a>
            )}
            {job.contact_phone && (
              <a
                href={`tel:${job.contact_phone}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', background: 'var(--bg-page)', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <Phone size={14} /> Call
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyJobs() {
  const { username } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active'); // 'active' | 'completed' | 'all'

  useEffect(() => {
    setLoading(true);
    axios.get('/api/jobs')
      .then(r => {
        // Filter to only this technician's jobs
        const mine = (r.data || []).filter(j =>
          j.technician && j.technician.toLowerCase() === (username || '').toLowerCase()
        );
        setJobs(mine);
      })
      .catch(() => setError('Could not load jobs. Please refresh.'))
      .finally(() => setLoading(false));
  }, [username]);

  const filtered = jobs.filter(j => {
    if (filter === 'active') return j.status !== 'completed' && j.status !== 'cancelled';
    if (filter === 'completed') return j.status === 'completed' || j.status === 'cancelled';
    return true;
  });

  // Sort: in_progress first, then by date
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    const da = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
    const db = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
    return da - db;
  });

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>
          My Jobs
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{today}</p>
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Active', count: jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length, color: '#2563eb' },
            { label: 'Today', count: jobs.filter(j => {
              if (!j.scheduled_date) return false;
              const d = new Date(j.scheduled_date);
              const n = new Date();
              return d.toDateString() === n.toDateString();
            }).length, color: '#f59e0b' },
            { label: 'Done', count: jobs.filter(j => j.status === 'completed').length, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
        {[
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
          { key: 'all', label: 'All' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: filter === tab.key ? 'var(--blue-600)' : 'transparent',
              color: filter === tab.key ? '#fff' : 'var(--text-muted)',
              transition: 'all .15s'
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
          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14 }}>Loading your jobs…</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', color: '#dc2626', fontSize: 13 }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <CheckCircle size={40} color="var(--text-muted)" style={{ opacity: 0.4, margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
            {filter === 'active' ? 'No active jobs right now' : 'No jobs to show'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {filter === 'active' ? 'All caught up!' : 'Jobs assigned to you will appear here.'}
          </p>
        </div>
      )}

      {!loading && !error && sorted.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
