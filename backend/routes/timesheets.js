const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/timesheets?week=2024-01-01&crew_member_id=X&job_id=X
router.get('/', async (req, res) => {
  try {
    const { week, crew_member_id, job_id } = req.query;
    let sql = `
      SELECT t.*, cm.name as crew_name, cm.hourly_rate,
             j.title as job_title, j.company_id,
             c.name as company_name
      FROM timesheets t
      LEFT JOIN crew_members cm ON cm.id = t.crew_member_id
      LEFT JOIN jobs j ON j.id = t.job_id
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE 1=1
    `;
    const params = [];
    if (week) { sql += ' AND t.work_date >= ? AND t.work_date < date(?, \'+7 days\')'; params.push(week, week); }
    if (crew_member_id) { sql += ' AND t.crew_member_id = ?'; params.push(crew_member_id); }
    if (job_id) { sql += ' AND t.job_id = ?'; params.push(job_id); }
    sql += ' ORDER BY t.work_date DESC, cm.name';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/timesheets
router.post('/', async (req, res) => {
  try {
    const { crew_member_id, job_id, work_date, clock_in, clock_out, hours, notes } = req.body;
    if (!crew_member_id || !work_date) return res.status(400).json({ error: 'crew_member_id and work_date required' });

    // Auto-calculate hours from clock times if not provided
    let computedHours = hours;
    if (!computedHours && clock_in && clock_out) {
      const [ih, im] = clock_in.split(':').map(Number);
      const [oh, om] = clock_out.split(':').map(Number);
      computedHours = ((oh * 60 + om) - (ih * 60 + im)) / 60;
    }

    const r = await db.prepare(
      'INSERT INTO timesheets (crew_member_id, job_id, work_date, clock_in, clock_out, hours, notes) VALUES (?,?,?,?,?,?,?)'
    ).run(crew_member_id, job_id || null, work_date, clock_in, clock_out, computedHours, notes);
    const id = r.lastInsertRowid || r.rows?.[0]?.id;
    const row = await db.prepare(`
      SELECT t.*, cm.name as crew_name, cm.hourly_rate, j.title as job_title
      FROM timesheets t
      LEFT JOIN crew_members cm ON cm.id = t.crew_member_id
      LEFT JOIN jobs j ON j.id = t.job_id
      WHERE t.id = ?
    `).get(id);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/timesheets/:id
router.put('/:id', async (req, res) => {
  try {
    const { crew_member_id, job_id, work_date, clock_in, clock_out, hours, notes } = req.body;
    let computedHours = hours;
    if (!computedHours && clock_in && clock_out) {
      const [ih, im] = clock_in.split(':').map(Number);
      const [oh, om] = clock_out.split(':').map(Number);
      computedHours = ((oh * 60 + om) - (ih * 60 + im)) / 60;
    }
    await db.prepare(
      'UPDATE timesheets SET crew_member_id=?, job_id=?, work_date=?, clock_in=?, clock_out=?, hours=?, notes=? WHERE id=?'
    ).run(crew_member_id, job_id || null, work_date, clock_in, clock_out, computedHours, notes, req.params.id);
    const row = await db.prepare(`
      SELECT t.*, cm.name as crew_name, j.title as job_title
      FROM timesheets t LEFT JOIN crew_members cm ON cm.id = t.crew_member_id LEFT JOIN jobs j ON j.id = t.job_id
      WHERE t.id = ?
    `).get(req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/timesheets/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM timesheets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/timesheets/summary  (hours + cost by crew member for a date range)
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT cm.id, cm.name, cm.hourly_rate,
             COUNT(t.id) as entries,
             COALESCE(SUM(t.hours), 0) as total_hours,
             COALESCE(SUM(t.hours * cm.hourly_rate), 0) as total_cost
      FROM crew_members cm
      LEFT JOIN timesheets t ON t.crew_member_id = cm.id
    `;
    const params = [];
    if (from && to) { sql += ' AND t.work_date BETWEEN ? AND ?'; params.push(from, to); }
    sql += ' WHERE cm.active = 1 GROUP BY cm.id ORDER BY cm.name';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
