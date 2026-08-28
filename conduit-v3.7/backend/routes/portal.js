const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database');
const requireAuth = require('../middleware/auth');
const requirePortalAuth = require('../middleware/portalAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'hvac-crm-secret-2024';

// Helper: generate portal JWT for a contact
function makePortalJwt(company_id, contact_id, contact_name) {
  return jwt.sign(
    { type: 'portal', company_id, contact_id, contact_name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ── ADMIN: Generate magic link for a contact ─────────────────────────────────
// POST /api/portal/admin/invite/:contact_id
router.post('/admin/invite/:contact_id', requireAuth, (req, res) => {
  try {
    const { contact_id } = req.params;
    const contact = db.prepare(
      `SELECT c.*, co.name AS company_name
       FROM contacts c
       LEFT JOIN companies co ON co.id = c.company_id
       WHERE c.id = ?`
    ).get(contact_id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!contact.company_id) return res.status(400).json({ error: 'Contact has no company' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    // Remove old tokens for this contact
    db.prepare('DELETE FROM portal_tokens WHERE contact_id = ?').run(contact_id);

    db.prepare(
      `INSERT INTO portal_tokens (contact_id, company_id, token, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(contact_id, contact.company_id, token, expiresAt);

    const baseUrl = req.headers.origin || process.env.APP_URL || 'https://your-app.onrender.com';
    const portalUrl = `${baseUrl}/portal/auth/${token}`;

    res.json({
      portal_url: portalUrl,
      token,
      contact_name: `${contact.first_name} ${contact.last_name}`,
      company_name: contact.company_name,
      expires_at: expiresAt,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: Get all unread portal messages ─────────────────────────────────────
// GET /api/portal/admin/messages
router.get('/admin/messages', requireAuth, (req, res) => {
  try {
    const messages = db.prepare(
      `SELECT pm.*, c.name AS company_name
       FROM portal_messages pm
       LEFT JOIN companies c ON c.id = pm.company_id
       ORDER BY pm.created_at DESC
       LIMIT 50`
    ).all();
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: Count unread messages ──────────────────────────────────────────────
// GET /api/portal/admin/messages/unread-count
router.get('/admin/messages/unread-count', requireAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) AS count FROM portal_messages WHERE read_at IS NULL').get();
    res.json({ count: row.count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: Mark message as read ───────────────────────────────────────────────
// PUT /api/portal/admin/messages/:id/read
router.put('/admin/messages/:id/read', requireAuth, (req, res) => {
  try {
    db.prepare(`UPDATE portal_messages SET read_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUBLIC: Magic link authentication ─────────────────────────────────────────
// GET /api/portal/auth/:token
router.get('/auth/:token', (req, res) => {
  try {
    const row = db.prepare(
      `SELECT pt.*, c.first_name, c.last_name, c.email, co.name AS company_name
       FROM portal_tokens pt
       JOIN contacts c ON c.id = pt.contact_id
       JOIN companies co ON co.id = pt.company_id
       WHERE pt.token = ?`
    ).get(req.params.token);

    if (!row) return res.status(404).json({ error: 'This link is invalid or has expired.' });

    const now = new Date();
    if (new Date(row.expires_at) < now) {
      return res.status(410).json({ error: 'This invitation link has expired. Please request a new one.' });
    }

    // Update last_used
    db.prepare(`UPDATE portal_tokens SET last_used = datetime('now') WHERE token = ?`).run(req.params.token);

    const portalToken = makePortalJwt(row.company_id, row.contact_id, `${row.first_name} ${row.last_name}`);

    res.json({
      portal_token: portalToken,
      contact: {
        id: row.contact_id,
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
      },
      company: {
        id: row.company_id,
        name: row.company_name,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CUSTOMER: Get my info ─────────────────────────────────────────────────────
// GET /api/portal/me
router.get('/me', requirePortalAuth, (req, res) => {
  try {
    const { company_id, contact_id, contact_name } = req.portal;
    const company = db.prepare('SELECT id, name, address, city, state, zip, phone FROM companies WHERE id = ?').get(company_id);
    const contact = db.prepare('SELECT id, first_name, last_name, email, phone, title FROM contacts WHERE id = ?').get(contact_id);
    res.json({ company, contact, contact_name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CUSTOMER: Get proposals for my company ────────────────────────────────────
// GET /api/portal/proposals
router.get('/proposals', requirePortalAuth, (req, res) => {
  try {
    const { company_id } = req.portal;
    const proposals = db.prepare(
      `SELECT id, title, proposal_number, status, service_type,
              subtotal, tax_rate, tax_amount, total_amount,
              created_at, signed_at, signed_by, valid_days
       FROM proposals
       WHERE company_id = ? AND status != 'draft'
       ORDER BY created_at DESC`
    ).all(company_id);

    // Attach line items to each proposal
    for (const p of proposals) {
      p.line_items = db.prepare(
        'SELECT * FROM proposal_line_items WHERE proposal_id = ? ORDER BY sort_order'
      ).all(p.id);
    }

    res.json(proposals);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CUSTOMER: Get jobs (work orders) for my company ───────────────────────────
// GET /api/portal/jobs
router.get('/jobs', requirePortalAuth, (req, res) => {
  try {
    const { company_id } = req.portal;
    const jobs = db.prepare(
      `SELECT id, title, job_type, technician, status,
              scheduled_date, scheduled_time, duration_hours, notes
       FROM jobs
       WHERE company_id = ?
       ORDER BY scheduled_date DESC`
    ).all(company_id);
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CUSTOMER: Get portal messages for my company ──────────────────────────────
// GET /api/portal/messages
router.get('/messages', requirePortalAuth, (req, res) => {
  try {
    const { company_id } = req.portal;
    const messages = db.prepare(
      `SELECT * FROM portal_messages WHERE company_id = ? ORDER BY created_at DESC`
    ).all(company_id);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CUSTOMER: Send a message ──────────────────────────────────────────────────
// POST /api/portal/messages
router.post('/messages', requirePortalAuth, (req, res) => {
  try {
    const { company_id, contact_id, contact_name } = req.portal;
    const { subject, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });

    const result = db.prepare(
      `INSERT INTO portal_messages (company_id, contact_id, contact_name, subject, message)
       VALUES (?, ?, ?, ?, ?)`
    ).run(company_id, contact_id, contact_name, subject?.trim() || 'Message from Customer', message.trim());

    const row = db.prepare('SELECT * FROM portal_messages WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
