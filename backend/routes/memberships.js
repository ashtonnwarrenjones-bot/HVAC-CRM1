const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET all memberships
router.get('/', async (req, res) => {
  try {
    const { company_id, status } = req.query;
    let sql = `SELECT m.*, c.name AS company_name,
                 CONCAT(ct.first_name, ' ', ct.last_name) AS contact_name
               FROM memberships m
               LEFT JOIN companies c ON c.id = m.company_id
               LEFT JOIN contacts ct ON ct.id = m.contact_id
               WHERE 1=1`;
    const params = [];
    if (company_id) { params.push(company_id); sql += ` AND m.company_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND m.status = $${params.length}`; }
    sql += ' ORDER BY m.created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, c.name AS company_name FROM memberships m
       LEFT JOIN companies c ON c.id = m.company_id WHERE m.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const { company_id, contact_id, plan_name, plan_type, price, status, start_date, next_service_date, notes } = req.body;
    if (!company_id) return res.status(400).json({ error: 'Company is required.' });
    if (!plan_name) return res.status(400).json({ error: 'Plan name is required.' });
    const result = await pool.query(
      `INSERT INTO memberships (company_id, contact_id, plan_name, plan_type, price, status, start_date, next_service_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [company_id, contact_id || null, plan_name, plan_type || 'monthly',
       parseFloat(price) || 0, status || 'active',
       start_date || null, next_service_date || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const { company_id, contact_id, plan_name, plan_type, price, status, start_date, next_service_date, notes } = req.body;
    const result = await pool.query(
      `UPDATE memberships SET company_id=$1, contact_id=$2, plan_name=$3, plan_type=$4,
       price=$5, status=$6, start_date=$7, next_service_date=$8, notes=$9 WHERE id=$10 RETURNING *`,
      [company_id, contact_id || null, plan_name, plan_type || 'monthly',
       parseFloat(price) || 0, status || 'active',
       start_date || null, next_service_date || null, notes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM memberships WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats
router.get('/meta/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COALESCE(SUM(price) FILTER (WHERE status = 'active'), 0) AS mrr
      FROM memberships
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
