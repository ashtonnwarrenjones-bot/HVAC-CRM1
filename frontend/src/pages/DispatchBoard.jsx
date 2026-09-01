import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, Users, Plus, X } from 'lucide-react';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am–7pm
const STATUS_COLORS = {
  scheduled:  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  in_progress:{ bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  completed:  { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  cancelled:  { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
};

function fmt12(h) {
  if (h === 12) return '12pm';
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}

function jobLeft(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return ((h - 7) * 60 + m) / (13 * 60) * 100;
}

function jobWidth(duration) {
  const hrs = parseFloat(duration) || 1;
  return (hrs * 60) / (13 * 60) * 100;
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

export default function DispatchBoard() {
  const [date, setDate] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragJob, setDragJob] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const boardRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const ds = dateStr(date);
      const [jobsRes, usersRes] = await Promise.all([
        axios.get('/api/jobs', { params: { year: ds.slice(0,4), month: parseInt(ds.slice(5,7)) } }),
        axios.get('/api/users'),
      ]);
      const dayJobs = jobsRes.data.filter(j => j.scheduled_date === ds);
      setJobs(dayJobs);
      // Build tech list from users + any techs mentioned in jobs
      const userTechs = (usersRes.data || []).filter(u => u.role !== 'demo').map(u => u.name || u.username);
      const jobTechs = [...new Set(dayJobs.map(j => j.technician).filter(Boolean))];
      const allTechs = [...new Set([...userTechs, ...jobTechs])].filter(Boolean);
      setTechs(allTechs.length ? allTechs : ['Unassigned']);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const shiftDate = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(d);
  };

  const handleDrop = async (tech, e) => {
    e.preventDefault();
    if (!dragJob) return;
    try {
      await axios.put(`/api/jobs/${dragJob.id}`, { ...dragJob, technician: tech });
      load();
    } catch {}
    setDragJob(null);
  };

  const unassigned = jobs.filter(j => !j.technician || !techs.includes(j.technician));
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const isToday = dateStr(date) === dateStr(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={20} /> Dispatch Board
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(-1)}><ChevronLeft size={15} /></button>
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 220, textAlign: 'center' }}>
            {isToday && <span style={{ color: 'var(--blue-600)', marginRight: 6 }}>Today —</span>}
            {dateLabel}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(1)}><ChevronRight size={15} /></button>
          {!isToday && (
            <button className="btn btn-secondary btn-sm" onClick={() => setDate(new Date())}>Today</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p className="text-muted">Loading…</p></div>
      ) : (
        <div style={{ padding: '0 24px 24px', overflowX: 'auto', flex: 1 }}>
          {/* Hour header */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)' }}>
              <Users size={13} /> TECHNICIAN
            </div>
            <div style={{ position: 'relative', height: 24 }}>
              {HOURS.map(h => (
                <div key={h} style={{
                  position: 'absolute',
                  left: `${(h - 7) / 13 * 100}%`,
                  fontSize: 10,
                  color: 'var(--gray-400)',
                  fontWeight: 600,
                  transform: 'translateX(-50%)',
                }}>{fmt12(h)}</div>
              ))}
            </div>
          </div>

          {/* Tech rows */}
          <div ref={boardRef} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {techs.map((tech, ti) => {
              const techJobs = jobs.filter(j => (j.technician || 'Unassigned') === tech);
              return (
                <div
                  key={tech}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr',
                    background: ti % 2 === 0 ? 'var(--bg-card)' : 'var(--th-bg)',
                    borderBottom: ti < techs.length - 1 ? '1px solid var(--border)' : 'none',
                    minHeight: 56,
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(tech, e)}
                >
                  {/* Tech label */}
                  <div style={{
                    padding: '8px 12px',
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: `hsl(${(tech.charCodeAt(0) * 37) % 360}, 60%, 50%)`,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13,
                    }}>
                      {tech[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{tech}</span>
                  </div>

                  {/* Timeline */}
                  <div style={{ position: 'relative', height: 56 }}>
                    {/* Grid lines */}
                    {HOURS.map(h => (
                      <div key={h} style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${(h - 7) / 13 * 100}%`,
                        borderLeft: '1px dashed var(--border-light)',
                        pointerEvents: 'none',
                      }} />
                    ))}

                    {/* Job blocks */}
                    {techJobs.map(job => {
                      const colors = STATUS_COLORS[job.status] || STATUS_COLORS.scheduled;
                      const left = jobLeft(job.scheduled_time);
                      const width = Math.max(jobWidth(job.duration_hours), 2);
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={() => setDragJob(job)}
                          onDragEnd={() => setDragJob(null)}
                          onMouseEnter={e => setTooltip({ job, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            position: 'absolute',
                            top: 6, bottom: 6,
                            left: `${left}%`,
                            width: `${width}%`,
                            minWidth: 60,
                            background: colors.bg,
                            border: `1.5px solid ${colors.border}`,
                            borderRadius: 5,
                            padding: '2px 6px',
                            cursor: 'grab',
                            overflow: 'hidden',
                            zIndex: 1,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: colors.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.title || job.job_type || 'Job'}
                          </div>
                          <div style={{ fontSize: 10, color: colors.text, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.company_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Unassigned row */}
            {unassigned.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', background: '#fef9c3', minHeight: 56 }}>
                <div style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center' }}>
                  ⚠ Unassigned
                </div>
                <div style={{ position: 'relative', height: 56, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', flexWrap: 'wrap' }}>
                  {unassigned.map(job => (
                    <div key={job.id} draggable onDragStart={() => setDragJob(job)} onDragEnd={() => setDragJob(null)}
                      style={{ background: '#fff', border: '1.5px solid #fbbf24', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600, cursor: 'grab', color: '#92400e' }}>
                      {job.title || job.job_type || 'Job'} — {job.company_name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_COLORS).map(([key, c]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1.5px solid ${c.border}` }} />
                <span style={{ color: 'var(--gray-500)', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
              </div>
            ))}
            <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 8 }}>Drag jobs between rows to reassign</span>
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Jobs', value: jobs.length },
              { label: 'Scheduled', value: jobs.filter(j => j.status === 'scheduled').length },
              { label: 'In Progress', value: jobs.filter(j => j.status === 'in_progress').length },
              { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '10px 18px', minWidth: 100 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', zIndex: 999,
          left: tooltip.x + 12, top: tooltip.y + 12,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          fontSize: 12, maxWidth: 220, pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{tooltip.job.title || tooltip.job.job_type}</div>
          <div style={{ color: 'var(--gray-500)' }}>{tooltip.job.company_name}</div>
          {tooltip.job.scheduled_time && <div style={{ color: 'var(--gray-500)' }}>⏰ {tooltip.job.scheduled_time} · {tooltip.job.duration_hours || 1}h</div>}
          {tooltip.job.contact_name && <div style={{ color: 'var(--gray-500)' }}>👤 {tooltip.job.contact_name}</div>}
          {tooltip.job.notes && <div style={{ color: 'var(--gray-400)', marginTop: 4, fontStyle: 'italic' }}>{tooltip.job.notes.slice(0, 80)}</div>}
        </div>
      )}
    </div>
  );
}
