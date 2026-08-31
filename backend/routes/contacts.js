const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all contacts (with optional search/filter)
router.get('/', async (req, res) => {
  try {
    const { search, company_id } = req.query;
    let query = `
      SELECT c.*, co.name AS company_name
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (c.first_name ILIKE $${params.length+1} OR c.last_name ILIKE $${params.length+2} OR c.email ILIKE $${params.length+3} OR c.phone ILIKE $${params.length+4})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (company_id) {
      query += ` AND c.company_id = $${params.length+1}`;
      params.push(company_id);
    }

    query += ` ORDER BY c.last_name ASC, c.first_name ASC`;
    const { rows } = await db.pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await db.prepare(`
      SELECT c.*, co.name AS company_name
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create contact
router.post('/', async (req, res) => {
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update contact
router.put('/:id', async (req, res) => {
  try {
    const {
      company_id, first_name, last_name, title, email,
      phone, mobile, preferred_contact, is_primary, notes
    } = req.body;

    await db.prepare(`
      UPDATE contacts SET
        company_id = ?, first_name = ?, last_name = ?, title = ?, email = ?,
        phone = ?, mobile = ?, preferred_contact = ?, is_primary = ?, notes = ?,
        updated_at = NOW()
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE contact
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
