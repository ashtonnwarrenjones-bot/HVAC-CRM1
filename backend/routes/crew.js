const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/crew
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM crew_members WHERE active = 1 ORDER BY name').all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/crew
router.post('/', async (req, res) => {
  try {
    const { name, role, phone, email, hourly_rate } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const r = await db.prepare(
      'INSERT INTO crew_members (name, role, phone, email, hourly_rate) VALUES (?,?,?,?,?)'
    ).run(name, role || 'crew', phone, email, hourly_rate || 0);
    const id = r.lastInsertRowid || r.rows?.[0]?.id;
    const row = await db.prepare('SELECT * FROM crew_members WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/crew/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, email, hourly_rate, active } = req.body;
    await db.prepare(
      'UPDATE crew_members SET name=?, role=?, phone=?, email=?, hourly_rate=?, active=? WHERE id=?'
    ).run(name, role, phone, email, hourly_rate, active !== undefined ? active : 1, req.params.id);
    const row = await db.prepare('SELECT * FROM crew_members WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/crew/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('UPDATE crew_members SET active=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
