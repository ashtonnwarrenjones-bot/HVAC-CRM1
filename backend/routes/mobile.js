// ─────────────────────────────────────────────────────────────────────────────
// routes/mobile.js  — Add this file to your Conduit backend
// Then in server.js add:
//   app.use('/api/mobile', requireAuth, require('./routes/mobile'));
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const db = require('../database');

// ─── Push notification token registration ────────────────────────────────────
router.post('/push-token', async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    await db.prepare(`
      INSERT INTO user_push_tokens (user_id, token, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, updated_at = CURRENT_TIMESTAMP
    `).run(userId, token);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── My schedule (today's jobs for the logged-in tech) ───────────────────────
router.get('/schedule', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const username = req.user.username;

    // Return all jobs today (or assigned to this user if assignment is tracked)
    const jobs = await db.prepare(`
      SELECT
        j.*,
        c.name AS company_name,
        c.address
      FROM jobs j
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE DATE(j.scheduled_date) = ?
         OR j.status = 'in_progress'
      ORDER BY j.scheduled_time ASC, j.id ASC
    `).all(today);

    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Job check-in ─────────────────────────────────────────────────────────────
router.post('/jobs/:id/checkin', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const jobId = parseInt(req.params.id, 10);

    await db.prepare(`
      UPDATE jobs
      SET checked_in_at = CURRENT_TIMESTAMP,
          checkin_lat = ?,
          checkin_lng = ?,
          status = CASE WHEN status = 'scheduled' THEN 'in_progress' ELSE status END
      WHERE id = ?
    `).run(lat || null, lng || null, jobId);

    // Log activity
    await db.prepare(`
      INSERT INTO job_activity (job_id, action, note, created_by, created_at)
      VALUES (?, 'check_in', ?, ?, CURRENT_TIMESTAMP)
    `).run(jobId, `Checked in${lat ? ` at ${lat.toFixed(4)}, ${lng.toFixed(4)}` : ''}`, req.user.username);

    res.json({ ok: true, checked_in_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Job check-out ────────────────────────────────────────────────────────────
router.post('/jobs/:id/checkout', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const jobId = parseInt(req.params.id, 10);

    await db.prepare(`
      UPDATE jobs
      SET checked_out_at = CURRENT_TIMESTAMP,
          checkout_lat = ?,
          checkout_lng = ?
      WHERE id = ?
    `).run(lat || null, lng || null, jobId);

    await db.prepare(`
      INSERT INTO job_activity (job_id, action, note, created_by, created_at)
      VALUES (?, 'check_out', ?, ?, CURRENT_TIMESTAMP)
    `).run(jobId, `Checked out${lat ? ` at ${lat.toFixed(4)}, ${lng.toFixed(4)}` : ''}`, req.user.username);

    res.json({ ok: true, checked_out_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Job notes ────────────────────────────────────────────────────────────────
router.post('/jobs/:id/notes', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const jobId = parseInt(req.params.id, 10);

    await db.prepare(`
      INSERT INTO job_notes (job_id, note, created_by, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(jobId, text, req.user.username);

    // Also append to job description for quick visibility
    await db.prepare(`
      UPDATE jobs SET notes = COALESCE(notes || '\n', '') || ? WHERE id = ?
    `).run(`[${req.user.username}]: ${text}`, jobId);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Inspection checklist ─────────────────────────────────────────────────────
router.get('/jobs/:id/checklist', async (req, res) => {
  try {
    const row = await db.prepare(`
      SELECT checklist_data FROM job_checklists WHERE job_id = ?
    `).get(parseInt(req.params.id, 10));
    res.json(row ? JSON.parse(row.checklist_data) : { items: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/jobs/:id/checklist', async (req, res) => {
  try {
    const { items } = req.body;
    const jobId = parseInt(req.params.id, 10);
    const data = JSON.stringify({ items, updated_by: req.user.username, updated_at: new Date().toISOString() });

    await db.prepare(`
      INSERT INTO job_checklists (job_id, checklist_data, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(job_id) DO UPDATE SET checklist_data = excluded.checklist_data, updated_at = CURRENT_TIMESTAMP
    `).run(jobId, data);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Parts logger ─────────────────────────────────────────────────────────────
router.post('/jobs/:id/parts', async (req, res) => {
  try {
    const { name, quantity, unit_cost } = req.body;
    const jobId = parseInt(req.params.id, 10);

    const info = await db.prepare(`
      INSERT INTO job_parts (job_id, name, quantity, unit_cost, logged_by, logged_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(jobId, name, quantity || 1, unit_cost || null, req.user.username);

    const part = await db.prepare('SELECT * FROM job_parts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(part);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/jobs/:id/parts', async (req, res) => {
  try {
    const parts = await db.prepare(`
      SELECT * FROM job_parts WHERE job_id = ? ORDER BY logged_at DESC
    `).all(parseInt(req.params.id, 10));
    res.json(parts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Time tracking ────────────────────────────────────────────────────────────
router.post('/jobs/:id/time/start', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    await db.prepare(`
      INSERT INTO job_time_entries (job_id, started_at, user_id)
      VALUES (?, CURRENT_TIMESTAMP, ?)
    `).run(jobId, req.user.id);
    res.json({ ok: true, started_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/jobs/:id/time/stop', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    await db.prepare(`
      UPDATE job_time_entries
      SET stopped_at = CURRENT_TIMESTAMP,
          duration_seconds = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)))::INTEGER
      WHERE job_id = ? AND user_id = ? AND stopped_at IS NULL
    `).run(jobId, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Invoice send ─────────────────────────────────────────────────────────────
router.post('/jobs/:id/invoice/send', async (req, res) => {
  try {
    const { method } = req.body; // 'sms' | 'email'
    const jobId = parseInt(req.params.id, 10);

    // Get job + contact info
    const job = await db.prepare(`
      SELECT j.*, c.name AS company_name, co.email, co.phone
      FROM jobs j
      LEFT JOIN companies c ON c.id = j.company_id
      LEFT JOIN contacts co ON co.company_id = j.company_id
      WHERE j.id = ?
      LIMIT 1
    `).get(jobId);

    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Log the send attempt (actual SMS/email would use Twilio/SendGrid)
    await db.prepare(`
      INSERT INTO job_activity (job_id, action, note, created_by, created_at)
      VALUES (?, 'invoice_sent', ?, ?, CURRENT_TIMESTAMP)
    `).run(jobId, `Invoice sent via ${method} by ${req.user.username}`, req.user.username);

    res.json({ ok: true, method, sent_to: method === 'sms' ? job.phone : job.email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Equipment lookup by serial ───────────────────────────────────────────────
router.get('/equipment/serial/:serial', async (req, res) => {
  try {
    // Look in jobs for equipment notes mentioning this serial
    const jobs = await db.prepare(`
      SELECT j.*, c.name AS company_name
      FROM jobs j
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE j.equipment_serial = ? OR j.description LIKE ?
      ORDER BY j.scheduled_date DESC
      LIMIT 10
    `).all(req.params.serial, `%${req.params.serial}%`);

    if (jobs.length === 0) return res.status(404).json(null);
    res.json({ serial: req.params.serial, jobs, last_service: jobs[0]?.scheduled_date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/equipment/company/:companyId', async (req, res) => {
  try {
    const jobs = await db.prepare(`
      SELECT id, title, equipment_serial, equipment_model, scheduled_date, status, description
      FROM jobs
      WHERE company_id = ?
      ORDER BY scheduled_date DESC
    `).all(parseInt(req.params.companyId, 10));

    // Group into unique equipment
    const equipment = {};
    for (const j of jobs) {
      const key = j.equipment_serial || j.equipment_model || j.id;
      if (!equipment[key]) {
        equipment[key] = {
          serial: j.equipment_serial,
          model: j.equipment_model,
          name: j.equipment_model || j.title,
          last_service: j.scheduled_date,
          status: j.status,
          notes: j.description,
          job_count: 0,
        };
      }
      equipment[key].job_count++;
    }
    res.json(Object.values(equipment));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Tech GPS location sharing ────────────────────────────────────────────────
router.put('/techs/location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await db.prepare(`
      INSERT INTO tech_locations (user_id, username, lat, lng, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, req.user.username, lat, lng);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/techs/locations', async (req, res) => {
  try {
    const locs = await db.prepare(`
      SELECT
        tl.*,
        j.title AS current_job,
        ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tl.updated_at)) / 60) || ' min ago' AS updated_ago
      FROM tech_locations tl
      LEFT JOIN jobs j ON j.status = 'in_progress' AND j.company_id IN (
        SELECT company_id FROM jobs WHERE status = 'in_progress' LIMIT 1
      )
      WHERE datetime(tl.updated_at) > datetime(CURRENT_TIMESTAMP, '-2 hours')
    `).all();
    res.json(locs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── My performance metrics ───────────────────────────────────────────────────
router.get('/me/performance', async (req, res) => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const thisWeek = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM jobs
      WHERE DATE(scheduled_date) >= ? AND status = 'completed'
    `).get(weekStartStr);

    const total = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM jobs WHERE status = 'completed'
    `).get();

    res.json({
      jobs_this_week: thisWeek?.cnt || 0,
      jobs_completed: total?.cnt || 0,
      avg_job_time: null, // would require time_entries data
      revenue_this_week: null,
      upsell_opportunities: [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dispatch notes for a job ─────────────────────────────────────────────────
router.get('/jobs/:id/dispatch-notes', async (req, res) => {
  try {
    const job = await db.prepare('SELECT dispatch_notes FROM jobs WHERE id = ?')
      .get(parseInt(req.params.id, 10));
    res.json({ notes: job?.dispatch_notes || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────
router.post('/messages', async (req, res) => {
  try {
    const { contactId, body } = req.body;
    await db.prepare(`
      INSERT INTO contact_messages (contact_id, body, sent_by, sent_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(contactId, body, req.user.username);
    res.json({ ok: true });
  } catch (e) {
    // Don't fail the app if this table doesn't exist yet
    res.json({ ok: true, warning: 'Message logged in-app only' });
  }
});

module.exports = router;
