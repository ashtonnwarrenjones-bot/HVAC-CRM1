const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/equipment?company_id=X  — list equipment (optionally filtered by company)
router.get('/', async (req, res) => {
  try {
    const { company_id } = req.query;
    let rows;
    if (company_id) {
      rows = await db.prepare(`
        SELECT e.*, c.name AS company_name
        FROM equipment e
        LEFT JOIN companies c ON c.id = e.company_id
        WHERE e.company_id = ?
        ORDER BY e.unit_type, e.make, e.model
      `).all(company_id);
    } else {
      rows = await db.prepare(`
        SELECT e.*, c.name AS company_name
        FROM equipment e
        LEFT JOIN companies c ON c.id = e.company_id
        ORDER BY c.name, e.unit_type, e.make
      `).all();
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/equipment/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.prepare(`
      SELECT e.*, c.name AS company_name
      FROM equipment e
      LEFT JOIN companies c ON c.id = e.company_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/equipment
router.post('/', async (req, res) => {
  try {
    const {
      company_id, unit_type, make, model, serial_number,
      install_date, last_service_date, warranty_expiry,
      location_notes, condition, notes
    } = req.body;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const r = await db.prepare(`
      INSERT INTO equipment
        (company_id, unit_type, make, model, serial_number,
         install_date, last_service_date, warranty_expiry,
         location_notes, condition, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      company_id, unit_type || null, make || null, model || null,
      serial_number || null, install_date || null, last_service_date || null,
      warranty_expiry || null, location_notes || null, condition || 'good', notes || null
    );
    const row = await db.prepare('SELECT * FROM equipment WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/equipment/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      unit_type, make, model, serial_number, install_date,
      last_service_date, warranty_expiry, location_notes, condition, notes
    } = req.body;
    await db.prepare(`
      UPDATE equipment SET
        unit_type = ?, make = ?, model = ?, serial_number = ?,
        install_date = ?, last_service_date = ?, warranty_expiry = ?,
        location_notes = ?, condition = ?, notes = ?
      WHERE id = ?
    `).run(
      unit_type || null, make || null, model || null, serial_number || null,
      install_date || null, last_service_date || null, warranty_expiry || null,
      location_notes || null, condition || 'good', notes || null,
      req.params.id
    );
    const row = await db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/equipment/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
