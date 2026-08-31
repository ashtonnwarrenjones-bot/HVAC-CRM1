const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all jobs — optionally filter by month: ?year=2024&month=8
router.get('/', async (req, res) => {
  try {
    const { year, month, status, company_id } = req.query;
    let sql = `
      SELECT j.*, c.name AS company_name, co.first_name || ' ' || co.last_name AS contact_name
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN contacts co ON j.contact_id = co.id
    `;
    const params = [];
    const where = [];
    if (year && month) {
      const pad = String(month).padStart(2, '0');
      where.push(`j.scheduled_date LIKE $${params.length+1}`);
      params.push(`${year}-${pad}-%`);
    }
    if (status) {
      where.push(`j.status = $${params.length+1}`);
      params.push(status);
    }
    if (company_id) {
      where.push(`j.company_id = $${params.length+1}`);
      params.push(parseInt(company_id, 10));
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY j.scheduled_date, j.scheduled_time';
    const { rows } = await db.pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single job
router.get('/:id', async (req, res) => {
  try {
    const job = await db.prepare(`
      SELECT j.*, c.name AS company_name, c.address, c.city, c.state, c.zip,
        co.first_name || ' ' || co.last_name AS contact_name, co.phone AS contact_phone
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN contacts co ON j.contact_id = co.id
      WHERE j.id = ?
    `).get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create job
router.post('/', async (req, res) => {
  try {
    const {
      company_id, contact_id, title, job_type, technician,
      status, scheduled_date, scheduled_time, duration_hours, notes, is_reminder
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const result = await db.prepare(`
      INSERT INTO jobs (company_id, contact_id, title, job_type, technician, status,
        scheduled_date, scheduled_time, duration_hours, notes, is_reminder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      company_id || null, contact_id || null, title,
      job_type || 'maintenance', technician || null,
      status || 'scheduled', scheduled_date || null,
      scheduled_time || null, duration_hours || 2,
      notes || null, is_reminder ? 1 : 0
    );
    const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);

    // Notify sales rep if company has one (fire and forget)
    if (company_id) {
      try {
        const { createNotification } = require('../database');
        db.prepare('SELECT name, sales_rep_name FROM companies WHERE id = ?').get(company_id)
          .then(company => {
            if (company && company.sales_rep_name) {
              createNotification({
                type: 'job_scheduled',
                title: `📅 Job Scheduled: ${title}`,
                message: `${scheduled_date ? `For ${scheduled_date}` : 'New job'} at ${company.name} — Rep: ${company.sales_rep_name}`,
                entity_type: 'job',
                entity_id: result.lastInsertRowid,
                company_id: company_id,
                sales_rep_name: company.sales_rep_name,
              });
            }
          }).catch(() => {});
      } catch (_) {}
    }

    res.status(201).json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update job
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const {
      company_id, contact_id, title, job_type, technician,
      status, scheduled_date, scheduled_time, duration_hours, notes, is_reminder
    } = req.body;
    await db.prepare(`
      UPDATE jobs SET
        company_id = ?, contact_id = ?, title = ?, job_type = ?, technician = ?,
        status = ?, scheduled_date = ?, scheduled_time = ?, duration_hours = ?,
        notes = ?, is_reminder = ?, updated_at = NOW()
      WHERE id = ?
    `).run(
      company_id || null, contact_id || null, title,
      job_type || 'maintenance', technician || null,
      status || 'scheduled', scheduled_date || null,
      scheduled_time || null, duration_hours || 2,
      notes || null, is_reminder ? 1 : 0,
      req.params.id
    );
    const job = await db.prepare(`
      SELECT j.*, c.name AS company_name, c.address, c.city, c.state, c.zip,
        co.first_name || ' ' || co.last_name AS contact_name, co.phone AS contact_phone
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN contacts co ON j.contact_id = co.id
      WHERE j.id = ?
    `).get(req.params.id);
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH quick status update
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const existing = await db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (notes) {
      const combined = [existing.notes, notes].filter(Boolean).join('\n\n');
      await db.prepare('UPDATE jobs SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?')
        .run(status || existing.status, combined, req.params.id);
    } else {
      await db.prepare('UPDATE jobs SET status = ?, updated_at = NOW() WHERE id = ?')
        .run(status || existing.status, req.params.id);
    }
    const job = await db.prepare(`
      SELECT j.*, c.name AS company_name, c.address, c.city, c.state, c.zip,
        co.first_name || ' ' || co.last_name AS contact_name, co.phone AS contact_phone
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN contacts co ON j.contact_id = co.id
      WHERE j.id = ?
    `).get(req.params.id);
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE job
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
