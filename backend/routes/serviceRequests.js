const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET /api/service-requests — list all (admin / sales_rep)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sr.*,
             j.title AS job_title,
             c.name  AS company_name
      FROM service_requests sr
      LEFT JOIN jobs      j ON sr.job_id     = j.id
      LEFT JOIN companies c ON sr.company_id = c.id
      ORDER BY sr.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/service-requests error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/service-requests — tech submits a quote request
router.post('/', async (req, res) => {
  const { job_id, company_id, manufacturer, model, serial_number, work_needed, notes } = req.body;
  const submitted_by = req.user?.username || 'unknown';

  if (!work_needed) return res.status(400).json({ error: 'work_needed is required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO service_requests
         (job_id, company_id, submitted_by, manufacturer, model, serial_number, work_needed, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [job_id || null, company_id || null, submitted_by, manufacturer || null,
       model || null, serial_number || null, work_needed, notes || null]
    );
    const request = rows[0];

    // Fetch job title if linked
    let jobTitle = null;
    if (job_id) {
      const jr = await pool.query('SELECT title FROM jobs WHERE id=$1', [job_id]);
      if (jr.rows.length) jobTitle = jr.rows[0].title;
    }

    // Fetch company name if linked
    let companyName = null;
    if (company_id) {
      const cr = await pool.query('SELECT name FROM companies WHERE id=$1', [company_id]);
      if (cr.rows.length) companyName = cr.rows[0].name;
    }

    // Email all admin + sales_rep users who have an email on file
    const { rows: recipients } = await pool.query(
      `SELECT email, username FROM users WHERE role IN ('admin','sales_rep') AND email IS NOT NULL AND email != ''`
    );

    if (recipients.length > 0 && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@circuitcrm.com';
        const appUrl = process.env.APP_URL || 'https://circuitcrm.onrender.com';

        const emailHtml = `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1d4ed8; margin-bottom: 4px;">New Quote Request</h2>
            <p style="color: #6b7280; margin-top: 0;">Submitted by <strong>${submitted_by}</strong></p>

            <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
              ${jobTitle ? `<tr><td style="padding:8px 0; color:#6b7280; width:160px;">Job</td><td style="padding:8px 0; font-weight:600;">${jobTitle}</td></tr>` : ''}
              ${companyName ? `<tr><td style="padding:8px 0; color:#6b7280;">Customer</td><td style="padding:8px 0; font-weight:600;">${companyName}</td></tr>` : ''}
              ${manufacturer ? `<tr><td style="padding:8px 0; color:#6b7280;">Manufacturer</td><td style="padding:8px 0;">${manufacturer}</td></tr>` : ''}
              ${model ? `<tr><td style="padding:8px 0; color:#6b7280;">Model</td><td style="padding:8px 0;">${model}</td></tr>` : ''}
              ${serial_number ? `<tr><td style="padding:8px 0; color:#6b7280;">Serial #</td><td style="padding:8px 0;">${serial_number}</td></tr>` : ''}
              <tr><td style="padding:8px 0; color:#6b7280; vertical-align:top;">Work Needed</td><td style="padding:8px 0;">${work_needed.replace(/\n/g,'<br>')}</td></tr>
              ${notes ? `<tr><td style="padding:8px 0; color:#6b7280; vertical-align:top;">Notes</td><td style="padding:8px 0;">${notes.replace(/\n/g,'<br>')}</td></tr>` : ''}
            </table>

            <a href="${appUrl}/service-requests"
               style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
              View in Conduit CRM
            </a>
          </div>
        `;

        await resend.emails.send({
          from: fromEmail,
          to: recipients.map(r => r.email),
          subject: `Quote Request from ${submitted_by}${jobTitle ? ` — ${jobTitle}` : ''}`,
          html: emailHtml,
        });
      } catch (emailErr) {
        console.error('Failed to send quote request email:', emailErr.message);
        // Don't fail the request if email fails
      }
    }

    res.status(201).json(request);
  } catch (err) {
    console.error('POST /api/service-requests error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/service-requests/:id — update status
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE service_requests SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
