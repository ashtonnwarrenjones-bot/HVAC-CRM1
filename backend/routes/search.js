const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/search?q=term  — global search across companies, contacts, proposals, jobs
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ companies: [], contacts: [], proposals: [], jobs: [] });

    const like = `%${q}%`;

    const [companies, contacts, proposals, jobs] = await Promise.all([
      db.prepare(`
        SELECT id, name, city, state, contract_type, phone
        FROM companies
        WHERE name LIKE ? OR city LIKE ? OR phone LIKE ?
        LIMIT 6
      `).all(like, like, like),

      db.prepare(`
        SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.title,
               co.name AS company_name, c.company_id
        FROM contacts c
        LEFT JOIN companies co ON co.id = c.company_id
        WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?
           OR (c.first_name || ' ' || c.last_name) LIKE ?
        LIMIT 6
      `).all(like, like, like, like),

      db.prepare(`
        SELECT p.id, p.title, p.proposal_number, p.status, p.total_amount,
               c.name AS company_name, p.company_id
        FROM proposals p
        LEFT JOIN companies c ON c.id = p.company_id
        WHERE p.title LIKE ? OR p.proposal_number LIKE ? OR c.name LIKE ?
        LIMIT 6
      `).all(like, like, like),

      db.prepare(`
        SELECT j.id, j.title, j.status, j.scheduled_date, j.technician,
               c.name AS company_name, j.company_id
        FROM jobs j
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.title LIKE ? OR j.technician LIKE ? OR c.name LIKE ?
        LIMIT 6
      `).all(like, like, like),
    ]);

    res.json({ companies, contacts, proposals, jobs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
