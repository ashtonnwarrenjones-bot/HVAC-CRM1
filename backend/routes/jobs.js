const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all jobs — filters: year/month, status, company_id, unscheduled, service_type, assigned_user_id
router.get('/', async (req, res) => {
  try {
    const { year, month, status, company_id, unscheduled, service_type, assigned_user_id } = req.query;
    let sql = `
      SELECT j.*,
        c.name AS company_name,
        co.first_name || ' ' || co.last_name AS contact_name,
        p.name AS property_name, p.address AS property_address,
        u.name AS assigned_user_name, u.username AS assigned_username,
        e.estimate_number, e.title AS estimate_title
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN contacts co ON j.contact_id = co.id
      LEFT JOIN properties p ON j.property_id = p.id
      LEFT JOIN users u ON j.assigned_user_id = u.id
      LEFT JOIN estimates e ON j.estimate_id = e.id
    `;
    const params = [];
    const where = [];
    if (year && month) {
      const pad = String(month).padStart(2, '0');
      where.push(`j.scheduled_date LIKE ?`);
      params.push(`${year}-${pad}-%`);
    }
    if (status) { where.push(`j.status = ?`); params.push(status); }
    if (company_id) { where.push(`j.company_id = ?`); params.push(parseInt(company_id, 10)); }
    if (service_type) { where.push(`j.service_type = ?`); params.push(service_type); }
    if (assigned_user_id) { where.push(`j.assigned_user_id = ?`); params.push(parseInt(assigned_user_id, 10)); }
    if (unscheduled === 'true' || unscheduled === '1') {
      where.push(`(j.unscheduled = 1 OR j.scheduled_date IS NULL)`);
      where.push(`j.status NOT IN ('completed', 'cancelled')`);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY j.scheduled_date NULLS LAST, j.scheduled_time NULLS LAST, j.created_at DESC';
    res.json(await db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET unscheduled queue
router.get('/unscheduled', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT j.*,
        c.name AS company_name,
        p.name AS property_name, p.address AS property_address,
        u.name AS assigned_user_name,
        e.estimate_number
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN properties p ON j.property_id = p.id
      LEFT JOIN users u ON j.assigned_user_id = u.id
      LEFT JOIN estimates e ON j.estimate_id = e.id
      WHERE (j.unscheduled = 1 OR j.scheduled_date IS NULL)
        AND j.status NOT IN ('completed', 'cancelled')
      ORDER BY j.created_at DESC
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single job
router.get('/:id', async (req, res) => {
  try {
    const job = await db.prepare(`
      SELECT j.*,
        c.name AS company_name, c.address, c.city, c.state, c.zip,
        co.first_name || ' ' || co.last_name AS contact_name, co.phone AS contact_phone,
        p.name AS property_name, p.address AS property_address,
        u.name AS assigned_user_name, u.username AS assigned_username,
        e.estimate_number, e.title AS estimate_title, e.total AS estimate_total
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN contacts co ON j.contact_id = co.id
      LEFT JOIN properties p ON j.property_id = p.id
      LEFT JOIN users u ON j.assigned_user_id = u.id
      LEFT JOIN estimates e ON j.estimate_id = e.id
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
      company_id, contact_id, property_id, estimate_id, title, job_type, technician,
      status, scheduled_date, scheduled_time, duration_hours, notes, is_reminder,
      service_type, assigned_user_id, unscheduled, route_id, dispatch_notes,
      equipment_serial, equipment_model
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await db.prepare(`
      INSERT INTO jobs (
        company_id, contact_id, property_id, estimate_id, title, job_type, technician,
        status, scheduled_date, scheduled_time, duration_hours, notes, is_reminder,
        service_type, assigned_user_id, unscheduled, route_id, dispatch_notes,
        equipment_serial, equipment_model
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      company_id || null, contact_id || null, property_id || null, estimate_id || null,
      title, job_type || 'maintenance', technician || null,
      status || (scheduled_date ? 'scheduled' : 'unscheduled'),
      scheduled_date || null, scheduled_time || null, duration_hours || 2,
      notes || null, is_reminder ? 1 : 0,
      service_type || 'one_time', assigned_user_id || null,
      (unscheduled !== undefined ? (unscheduled ? 1 : 0) : (scheduled_date ? 0 : 1)),
      route_id || null, dispatch_notes || null,
      equipment_serial || null, equipment_model || null
    );

    const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);

    // Notify ops users when a new job needs scheduling
    try {
      const { createNotification, pool } = require('../database');
      const opsUsers = await pool.query("SELECT name FROM users WHERE role IN ('ops', 'dispatcher', 'admin') LIMIT 1");
      if (opsUsers.rows.length > 0) {
        const company = company_id ? await db.prepare('SELECT name FROM companies WHERE id = ?').get(company_id) : null;
        await createNotification({
          type: 'job_created',
          title: `🔧 New Job: ${title}`,
          message: `${company ? `Client: ${company.name}` : ''} — ${scheduled_date ? `Scheduled ${scheduled_date}` : 'Needs scheduling'}`,
          entity_type: 'job',
          entity_id: result.lastInsertRowid,
          company_id: company_id || null,
        });
      }
    } catch (_) {}

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
      company_id, contact_id, property_id, estimate_id, title, job_type, technician,
      status, scheduled_date, scheduled_time, duration_hours, notes, is_reminder,
      service_type, assigned_user_id, unscheduled, route_id, dispatch_notes,
      equipment_serial, equipment_model
    } = req.body;

    await db.prepare(`
      UPDATE jobs SET
        company_id = ?, contact_id = ?, property_id = ?, estimate_id = ?,
        title = ?, job_type = ?, technician = ?,
        status = ?, scheduled_date = ?, scheduled_time = ?, duration_hours = ?,
        notes = ?, is_reminder = ?,
        service_type = ?, assigned_user_id = ?, unscheduled = ?, route_id = ?,
        dispatch_notes = ?, equipment_serial = ?, equipment_model = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      company_id || null, contact_id || null, property_id || null, estimate_id || null,
      title, job_type || 'maintenance', technician || null,
      status || 'scheduled', scheduled_date || null, scheduled_time || null, duration_hours || 2,
      notes || null, is_reminder ? 1 : 0,
      service_type || 'one_time', assigned_user_id || null,
      scheduled_date ? 0 : (unscheduled ? 1 : 0),
      route_id || null, dispatch_notes || null,
      equipment_serial || null, equipment_model || null,
      req.params.id
    );

    const job = await db.prepare(`
      SELECT j.*,
        c.name AS company_name, c.address, c.city, c.state, c.zip,
        co.first_name || ' ' || co.last_name AS contact_name,
        p.name AS property_name, p.address AS property_address,
        u.name AS assigned_user_name
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN contacts co ON j.contact_id = co.id
      LEFT JOIN properties p ON j.property_id = p.id
      LEFT JOIN users u ON j.assigned_user_id = u.id
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
    const combined = notes ? [existing.notes, notes].filter(Boolean).join('\n\n') : existing.notes;
    const completedAt = status === 'completed' ? 'CURRENT_TIMESTAMP' : null;

    if (completedAt) {
      await db.prepare(`UPDATE jobs SET status = ?, notes = ?, completed_at = CURRENT_TIMESTAMP, unscheduled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(status, combined, req.params.id);
    } else {
      await db.prepare(`UPDATE jobs SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(status || existing.status, combined, req.params.id);
    }

    // Notify when completed
    if (status === 'completed') {
      try {
        const { createNotification } = require('../database');
        await createNotification({
          type: 'job_completed',
          title: `✅ Job Completed: ${existing.title}`,
          message: `Ready to invoice${existing.company_id ? ' — ' + existing.company_id : ''}`,
          entity_type: 'job',
          entity_id: parseInt(req.params.id),
          company_id: existing.company_id,
        });
      } catch (_) {}
    }

    const job = await db.prepare(`
      SELECT j.*, c.name AS company_name
      FROM jobs j LEFT JOIN companies c ON j.company_id = c.id WHERE j.id = ?
    `).get(req.params.id);
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH schedule an unscheduled job
router.patch('/:id/schedule', async (req, res) => {
  try {
    const { scheduled_date, scheduled_time, assigned_user_id, duration_hours, notes } = req.body;
    if (!scheduled_date) return res.status(400).json({ error: 'scheduled_date required' });
    const existing = await db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`
      UPDATE jobs SET
        scheduled_date = ?, scheduled_time = ?, assigned_user_id = ?,
        duration_hours = ?, notes = ?,
        status = 'scheduled', unscheduled = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      scheduled_date, scheduled_time || null, assigned_user_id || null,
      duration_hours || 2, notes || null, req.params.id
    );
    const job = await db.prepare(`
      SELECT j.*, c.name AS company_name, p.name AS property_name, u.name AS assigned_user_name
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN properties p ON j.property_id = p.id
      LEFT JOIN users u ON j.assigned_user_id = u.id
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
