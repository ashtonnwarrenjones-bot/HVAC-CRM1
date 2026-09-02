const express = require('express');
const router  = express.Router();
const { pool } = require('../database');

// Carrier → email gateway map
const CARRIER_GATEWAYS = {
  att:        'txt.att.net',
  verizon:    'vtext.com',
  tmobile:    'tmomail.net',
  sprint:     'messaging.sprintpcs.com',
  boost:      'sms.myboostmobile.com',
  cricket:    'mms.cricketwireless.net',
  metro:      'mymetropcs.com',
  uscellular: 'email.uscc.net',
};

function buildGatewayEmail(phone, carrier) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  const gateway = CARRIER_GATEWAYS[carrier];
  if (!gateway) return null;
  return `${digits}@${gateway}`;
}

// POST /api/sms/dispatch — send a job dispatch SMS to a technician via email-to-SMS
// Body: { job_id, to_username, message (optional) }
router.post('/dispatch', async (req, res) => {
  const { job_id, to_username, message } = req.body;
  if (!to_username) return res.status(400).json({ error: 'to_username is required' });

  try {
    // Look up tech's phone + carrier
    const techRow = await pool.query(
      'SELECT username, name, phone, carrier FROM users WHERE username = $1',
      [to_username]
    );
    if (!techRow.rows.length) return res.status(404).json({ error: 'User not found' });
    const tech = techRow.rows[0];

    if (!tech.phone) {
      return res.status(422).json({
        error: `${tech.name || tech.username} has no phone number on file. Add it in Settings → Users.`,
      });
    }
    if (!tech.carrier) {
      return res.status(422).json({
        error: `${tech.name || tech.username} has no carrier set. Add it in Settings → Users.`,
      });
    }

    const toEmail = buildGatewayEmail(tech.phone, tech.carrier);
    if (!toEmail) {
      return res.status(422).json({ error: `Unknown carrier "${tech.carrier}".` });
    }

    // Build message body
    let body = message;
    if (!body && job_id) {
      const jobRow = await pool.query(
        `SELECT j.title, j.scheduled_date, j.scheduled_time, j.address,
                c.name AS company_name, c.address AS company_address, c.city, c.state
         FROM jobs j
         LEFT JOIN companies c ON c.id = j.company_id
         WHERE j.id = $1`,
        [job_id]
      );
      if (jobRow.rows.length) {
        const job = jobRow.rows[0];
        const dateStr = job.scheduled_date
          ? new Date(job.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : null;
        const addr = [job.address || job.company_address, job.city, job.state].filter(Boolean).join(', ');
        body = [
          `Job: ${job.title}`,
          job.company_name && `Customer: ${job.company_name}`,
          dateStr && `Date: ${dateStr}${job.scheduled_time ? ' at ' + job.scheduled_time : ''}`,
          addr && `Address: ${addr}`,
          `Log in to Conduit CRM to view details.`,
        ].filter(Boolean).join('\n');
      }
    }
    if (!body) body = `You have been assigned a new job. Log in to Conduit CRM for details.`;

    // Check for Resend credentials
    const apiKey  = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || 'dispatch@conduitcrm.com';

    if (!apiKey) {
      console.log(`[SMS-email] Would send to ${toEmail}: ${body}`);
      return res.status(503).json({
        error: 'Email not configured. Add RESEND_API_KEY to your Render environment variables.',
        preview: { to: toEmail, body },
      });
    }

    const { Resend } = require('resend');
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: fromEmail,
      to:   toEmail,
      subject: '', // carriers ignore subject; keep blank so it reads like a plain text
      text: body,
    });

    // Log activity on the job
    if (job_id) {
      try {
        await pool.query(
          `INSERT INTO job_activity (job_id, action, note, created_by, created_at)
           VALUES ($1, 'sms_dispatched', $2, $3, CURRENT_TIMESTAMP)`,
          [job_id, `Dispatch SMS sent to ${tech.name || tech.username} (${toEmail})`, req.user.username]
        );
      } catch (_) {}
    }

    res.json({ ok: true, to: toEmail });
  } catch (err) {
    console.error('SMS dispatch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sms/tech-phones — list techs with phone/carrier status
router.get('/tech-phones', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, name, phone, carrier, role FROM users WHERE role IN ('technician','admin','dispatcher') ORDER BY username"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sms/carriers — return the supported carrier list for the frontend
router.get('/carriers', (req, res) => {
  res.json(Object.keys(CARRIER_GATEWAYS).map(key => ({
    value: key,
    label: {
      att: 'AT&T', verizon: 'Verizon', tmobile: 'T-Mobile',
      sprint: 'Sprint', boost: 'Boost Mobile', cricket: 'Cricket',
      metro: 'Metro by T-Mobile', uscellular: 'US Cellular',
    }[key] || key,
    gateway: CARRIER_GATEWAYS[key],
  })));
});

module.exports = router;
