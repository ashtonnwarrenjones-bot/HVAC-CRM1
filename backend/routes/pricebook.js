const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET all pricebook items
router.get('/', async (req, res) => {
  try {
    const { category, active } = req.query;
    let sql = 'SELECT * FROM pricebook_items WHERE 1=1';
    const params = [];
    if (category) { params.push(category); sql += ` AND category = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND is_active = $${params.length}`; }
    sql += ' ORDER BY sort_order ASC, category ASC, name ASC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single item
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pricebook_items WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const { category, name, description, unit_price, unit, cost, is_active, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const result = await pool.query(
      `INSERT INTO pricebook_items (category, name, description, unit_price, unit, cost, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [category || null, name, description || null, parseFloat(unit_price) || 0,
       unit || 'each', parseFloat(cost) || 0, is_active !== false, sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const { category, name, description, unit_price, unit, cost, is_active, sort_order } = req.body;
    const result = await pool.query(
      `UPDATE pricebook_items SET category=$1, name=$2, description=$3, unit_price=$4,
       unit=$5, cost=$6, is_active=$7, sort_order=$8 WHERE id=$9 RETURNING *`,
      [category || null, name, description || null, parseFloat(unit_price) || 0,
       unit || 'each', parseFloat(cost) || 0, is_active !== false, sort_order || 0, req.params.id]
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
    await pool.query('DELETE FROM pricebook_items WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET distinct categories
router.get('/meta/categories', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT category FROM pricebook_items WHERE category IS NOT NULL ORDER BY category"
    );
    res.json(result.rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
