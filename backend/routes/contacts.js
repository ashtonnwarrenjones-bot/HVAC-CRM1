const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all contacts (with optional search/filter)
router.get('/', async (req, res) => {
  const { search, company_id } = req.query;
  let query = `
    SELECT c.*, co.name AS company_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (company_id) {
    query += ` AND c.company_id = ?`;
    params.push(company_id);
  }

  query += ` ORDER BY c.last_name ASC, c.first_name ASC`;
  const contacts = await db.prepare(query).all(...params);
  res.json(contacts);
});

// GET single contact
router.get('/:id', async (req, res) => {
  const contact = await db.prepare(`
    SELECT c.*, co.name AS company_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json(contact);
});

// POST create contact
router.post('/', async (req, res) => {
  const {
    company_id, first_name, last_name, title, email,
    phone, mobile, preferred_contact, is_primary, notes
  } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First and last name are required' });
  }

  const result = await db.prepare(`
    INSERT INTO contacts (company_id, first_name, last_name, title, email,
      phone, mobile, preferred_contact, is_primary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(company_id || null, first_name, last_name, title, email,
    phone, mobile, preferred_contact || 'email', is_primary ? 1 : 0, notes);

  const contact = await db.prepare(`
    SELECT c.*, co.name AS company_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(contact);
});

// PUT update contact
router.put('/:id', async (req, res) => {
  const {
    company_id, first_name, last_name, title, email,
    phone, mobile, preferred_contact, is_primary, notes
  } = req.body;

  await db.prepare(`
    UPDATE contacts SET
      company_id = ?, first_name = ?, last_name = ?, title = ?, email = ?,
      phone = ?, mobile = ?, preferred_contact = ?, is_primary = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(company_id || null, first_name, last_name, title, email,
    phone, mobile, preferred_contact, is_primary ? 1 : 0, notes,
    req.params.id);

  const contact = await db.prepare(`
    SELECT c.*, co.name AS company_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.id = ?
  `).get(req.params.id);

  res.json(contact);
});

// DELETE contact
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
