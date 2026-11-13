const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/properties?company_id=X
router.get('/', async (req, res) => {
  try {
    const { company_id } = req.query;
    let rows;
    if (company_id) {
      rows = await db.prepare('SELECT * FROM properties WHERE company_id = ? ORDER BY name').all(company_id);
    } else {
      rows = await db.prepare('SELECT p.*, c.name as company_name FROM properties p LEFT JOIN companies c ON c.id = p.company_id ORDER BY p.name').all();
    }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.prepare('SELECT p.*, c.name as company_name FROM properties p LEFT JOIN companies c ON c.id = p.company_id WHERE p.id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/properties
router.post('/', async (req, res) => {
  try {
    const { company_id, name, address, city, state, zip, property_type, square_footage, lot_size, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const r = await db.prepare(
      'INSERT INTO properties (company_id, name, address, city, state, zip, property_type, square_footage, lot_size, notes) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(company_id, name, address, city, state, zip, property_type || 'commercial', square_footage, lot_size, notes);
    const id = r.lastInsertRowid || r.rows?.[0]?.id;
    const row = await db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/properties/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, address, city, state, zip, property_type, square_footage, lot_size, notes } = req.body;
    await db.prepare(
      'UPDATE properties SET name=?, address=?, city=?, state=?, zip=?, property_type=?, square_footage=?, lot_size=?, notes=? WHERE id=?'
    ).run(name, address, city, state, zip, property_type, square_footage, lot_size, notes, req.params.id);
    const row = await db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/properties/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
