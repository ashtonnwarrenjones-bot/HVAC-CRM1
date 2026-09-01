const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all companies
router.get('/', async (req, res) => {
  const { search, contract_type } = req.query;
  let query = `
    SELECT c.*,
      (SELECT COUNT(*) FROM contacts WHERE company_id = c.id) AS contact_count,
      (SELECT COUNT(*) FROM proposals WHERE company_id = c.id) AS proposal_count,
      (SELECT SUM(total_amount) FROM proposals WHERE company_id = c.id AND status = 'accepted') AS total_revenue
    FROM companies c
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (c.name LIKE ? OR c.city LIKE ? OR c.address LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (contract_type) {
    query += ` AND c.contract_type = ?`;
    params.push(contract_type);
  }

  query += ` ORDER BY c.name ASC`;
  const companies = await db.prepare(query).all(...params);
  res.json(companies);
});

// GET single company with contacts and recent activities
router.get('/:id', async (req, res) => {
  const company = await db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  company.contacts = await db.prepare(
    'SELECT * FROM contacts WHERE company_id = ? ORDER BY is_primary DESC, last_name ASC'
  ).all(req.params.id);

  company.proposals = await db.prepare(
    'SELECT * FROM proposals WHERE company_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all(req.params.id);

  company.activities = await db.prepare(
    'SELECT a.*, c.first_name, c.last_name FROM activities a LEFT JOIN contacts c ON a.contact_id = c.id WHERE a.company_id = ? ORDER BY a.created_at DESC LIMIT 20'
  ).all(req.params.id);

  res.json(company);
});

// POST create company
router.post('/', async (req, res) => {
  const {
    name, address, city, state, zip, phone, website,
    property_type, contract_type, num_hvac_units,
    num_plumbing_fixtures, annual_revenue, notes,
    sales_rep_name, sales_rep_email, sales_rep_phone
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Company name is required' });

  const result = await db.prepare(`
    INSERT INTO companies (name, address, city, state, zip, phone, website,
      property_type, contract_type, num_hvac_units, num_plumbing_fixtures, annual_revenue, notes,
      sales_rep_name, sales_rep_email, sales_rep_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, address, city, state || 'CO', zip, phone, website,
    property_type || 'commercial', contract_type || 'prospect',
    num_hvac_units, num_plumbing_fixtures, annual_revenue, notes,
    sales_rep_name || null, sales_rep_email || null, sales_rep_phone || null);

  const company = await db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(company);
});

// PUT update company
router.put('/:id', async (req, res) => {
  const {
    name, address, city, state, zip, phone, website,
    property_type, contract_type, num_hvac_units,
    num_plumbing_fixtures, annual_revenue, notes,
    sales_rep_name, sales_rep_email, sales_rep_phone
  } = req.body;

  await db.prepare(`
    UPDATE companies SET
      name = ?, address = ?, city = ?, state = ?, zip = ?, phone = ?, website = ?,
      property_type = ?, contract_type = ?, num_hvac_units = ?,
      num_plumbing_fixtures = ?, annual_revenue = ?, notes = ?,
      sales_rep_name = ?, sales_rep_email = ?, sales_rep_phone = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, address, city, state, zip, phone, website,
    property_type, contract_type, num_hvac_units,
    num_plumbing_fixtures, annual_revenue, notes,
    sales_rep_name || null, sales_rep_email || null, sales_rep_phone || null,
    req.params.id);

  const company = await db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  res.json(company);
});

// DELETE company
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST add activity/note to company
router.post('/:id/activities', async (req, res) => {
  const { contact_id, type, subject, body } = req.body;
  const result = await db.prepare(`
    INSERT INTO activities (company_id, contact_id, type, subject, body)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, contact_id || null, type || 'note', subject, body);

  const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(activity);
});

module.exports = router;
