const express = require('express');
const router = express.Router();
const db = require('../database');

const STAGE_PROBABILITY = {
  lead: 10, contacted: 20, site_visit: 40, quoted: 60, won: 100, lost: 0
};

// GET all deals (optionally filtered by stage or company)
router.get('/', async (req, res) => {
  const { stage, company_id } = req.query;
  let query = `
    SELECT d.*,
      co.name AS company_name,
      c.first_name, c.last_name,
      p.proposal_number
    FROM deals d
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN proposals p ON d.proposal_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (stage) { query += ' AND d.stage = ?'; params.push(stage); }
  if (company_id) { query += ' AND d.company_id = ?'; params.push(company_id); }
  query += ' ORDER BY d.updated_at DESC';
  res.json(await db.prepare(query).all(...params));
});

// GET single deal
router.get('/:id', async (req, res) => {
  const deal = await db.prepare(`
    SELECT d.*,
      co.name AS company_name,
      c.first_name, c.last_name, c.email AS contact_email, c.phone AS contact_phone,
      p.proposal_number, p.title AS proposal_title, p.total_amount AS proposal_total
    FROM deals d
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN proposals p ON d.proposal_id = p.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.json(deal);
});

// POST create deal
router.post('/', async (req, res) => {
  const { company_id, contact_id, proposal_id, title, stage, value, probability, service_type, close_date, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const s = stage || 'lead';
  const result = await db.prepare(`
    INSERT INTO deals (company_id, contact_id, proposal_id, title, stage, value, probability, service_type, close_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(company_id || null, contact_id || null, proposal_id || null, title, s, value || 0,
    probability ?? STAGE_PROBABILITY[s] ?? 20, service_type, close_date, notes);
  res.status(201).json(await db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid));
});

// PUT update deal (including stage moves)
router.put('/:id', async (req, res) => {
  const { company_id, contact_id, proposal_id, title, stage, value, probability, service_type, close_date, lost_reason, notes } = req.body;
  const s = stage || 'lead';
  await db.prepare(`
    UPDATE deals SET
      company_id = ?, contact_id = ?, proposal_id = ?, title = ?, stage = ?,
      value = ?, probability = ?, service_type = ?, close_date = ?, lost_reason = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(company_id || null, contact_id || null, proposal_id || null, title, s, value || 0,
    probability ?? STAGE_PROBABILITY[s] ?? 20, service_type, close_date, lost_reason, notes,
    req.params.id);
  res.json(await db.prepare(`
    SELECT d.*, co.name AS company_name, c.first_name, c.last_name
    FROM deals d
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN contacts c ON d.contact_id = c.id
    WHERE d.id = ?
  `).get(req.params.id));
});

// PATCH stage only (quick move from Kanban)
router.patch('/:id/stage', async (req, res) => {
  const { stage, lost_reason } = req.body;
  if (!stage) return res.status(400).json({ error: 'Stage required' });
  await db.prepare(`
    UPDATE deals SET stage = ?, probability = ?, lost_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(stage, STAGE_PROBABILITY[stage] ?? 20, lost_reason || null, req.params.id);
  res.json({ ok: true });
});

// DELETE deal
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET pipeline summary (grouped by stage)
router.get('/summary/by-stage', async (req, res) => {
  const rows = await db.prepare(`
    SELECT stage,
      COUNT(*) AS count,
      SUM(value) AS total_value,
      SUM(value * probability / 100.0) AS weighted_value
    FROM deals
    WHERE stage NOT IN ('won','lost')
    GROUP BY stage
  `).all();
  res.json(rows);
});

module.exports = router;
