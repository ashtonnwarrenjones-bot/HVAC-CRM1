const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'hvac-crm-secret-2024';
const MAGIC_TOKEN_DAYS = 90;
const PORTAL_JWT_DAYS = 30;

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL;
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return `${proto}://${req.get('host')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — POST /invite/:contactId
// Mounted at /api/portal/admin  →  handles /api/portal/admin/invite/:contactId
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invite/:contactId', async (req, res) => {
  try {
    const contact = await db.prepare(`
      SELECT c.*, co.name AS company_name
      FROM contacts c
      LEFT JOIN companies co ON co.id = c.company_id
      WHERE c.id = ?
    `).get(req.params.contactId);

    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!contact.company_id) return res.status(400).json({ error: 'Contact has no associated company' });

    // Revoke any existing token for this contact so only one link is active
    await db.prepare('DELETE FROM portal_tokens WHERE contact_id = ?').run(contact.id);

    const token = genToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + MAGIC_TOKEN_DAYS);

    await db.prepare(`
      INSERT INTO portal_tokens (contact_id, company_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(contact.id, contact.company_id, token, expiresAt.toISOString());

    res.json({
      portal_url: `${baseUrl(req)}/portal?token=${token}`,
      contact_name: `${contact.first_name} ${contact.last_name}`,
      company_name: contact.company_name,
      expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — magic link verification
// ─────────────────────────────────────────────────────────────────────────────
async function handleMagicLink(req, res) {
  try {
    const token = req.params.token;

    const row = await db.prepare(`
      SELECT pt.*, c.first_name, c.last_name, c.email,
             co.name AS company_name
      FROM portal_tokens pt
      JOIN contacts c ON c.id = pt.contact_id
      JOIN companies co ON co.id = pt.company_id
      WHERE pt.token = ?
    `).get(token);

    if (!row) return res.status(404).json({ error: 'Invalid or expired link' });
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired. Please contact us for a new one.' });
    }

    // Update last_used timestamp
    await db.prepare('UPDATE portal_tokens SET last_used = CURRENT_TIMESTAMP WHERE token = ?').run(token);

    const portalJwt = jwt.sign(
      {
        role: 'portal',
        contact_id: row.contact_id,
        company_id: row.company_id,
        contact_name: `${row.first_name} ${row.last_name}`,
        company_name: row.company_name,
        email: row.email || null,
      },
      JWT_SECRET,
      { expiresIn: `${PORTAL_JWT_DAYS}d` }
    );

    res.json({
      jwt: portalJwt,
      contact: {
        id: row.contact_id,
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        company_id: row.company_id,
        company_name: row.company_name,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Register both paths — full URL for direct call, relative for app.use mount
router.get('/api/portal/auth/:token', handleMagicLink);
router.get('/auth/:token', handleMagicLink);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — all routes below require req.portal (set by portalAuth middleware)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/portal/me
router.get('/me', async (req, res) => {
  if (!req.portal) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const company = await db.prepare(
      'SELECT id, name, phone, address, city, state, zip FROM companies WHERE id = ?'
    ).get(req.portal.company_id);

    res.json({
      contact_id: req.portal.contact_id,
      contact_name: req.portal.contact_name,
      email: req.portal.email,
      company_id: req.portal.company_id,
      company_name: req.portal.company_name,
      company: company || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/portal/proposals
router.get('/proposals', async (req, res) => {
  if (!req.portal) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const proposals = await db.prepare(`
      SELECT id, title, proposal_number, status, service_type,
             subtotal, tax_amount, total_amount, valid_days,
             created_at, signed_at, signed_by, notes
      FROM proposals
      WHERE company_id = ?
      ORDER BY created_at DESC
    `).all(req.portal.company_id);

    res.json(proposals);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/portal/jobs
router.get('/jobs', async (req, res) => {
  if (!req.portal) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const jobs = await db.prepare(`
      SELECT id, title, job_type, technician, status,
             scheduled_date, scheduled_time, duration_hours, notes
      FROM jobs
      WHERE company_id = ?
      ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
    `).all(req.portal.company_id);

    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/portal/messages
router.get('/messages', async (req, res) => {
  if (!req.portal) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const messages = await db.prepare(`
      SELECT * FROM portal_messages
      WHERE company_id = ? AND contact_id = ?
      ORDER BY created_at DESC
    `).all(req.portal.company_id, req.portal.contact_id);

    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/portal/messages
router.post('/messages', async (req, res) => {
  if (!req.portal) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { subject, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message body is required' });

    const result = await db.prepare(`
      INSERT INTO portal_messages (company_id, contact_id, contact_name, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.portal.company_id,
      req.portal.contact_id,
      req.portal.contact_name,
      subject?.trim() || 'Message from Customer',
      message.trim()
    );

    const msg = await db.prepare('SELECT * FROM portal_messages WHERE id = ?').get(result.lastInsertRowid);

    // Create a notification for the admin
    try {
      const { createNotification } = require('../database');
      if (createNotification) {
        await createNotification({
          type: 'portal_message',
          title: `💬 Portal Message: ${msg.subject}`,
          message: `From ${req.portal.contact_name} (${req.portal.company_name}): ${message.trim().slice(0, 80)}${message.trim().length > 80 ? '…' : ''}`,
          entity_type: 'portal_message',
          entity_id: result.lastInsertRowid,
          company_id: req.portal.company_id,
        });
      }
    } catch (_) { /* non-critical */ }

    res.status(201).json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
