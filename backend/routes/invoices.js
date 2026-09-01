const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/invoices?company_id=X&status=unpaid
router.get('/', async (req, res) => {
  try {
    const { company_id, status } = req.query;
    let query = `
      SELECT i.*, c.name AS company_name
      FROM invoices i
      LEFT JOIN companies c ON c.id = i.company_id
      WHERE 1=1
    `;
    const params = [];
    if (company_id) { query += ' AND i.company_id = ?'; params.push(company_id); }
    if (status) { query += ' AND i.status = ?'; params.push(status); }
    query += ' ORDER BY i.created_at DESC';
    const rows = await db.prepare(query).all(...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.prepare(`
      SELECT i.*, c.name AS company_name, c.address, c.city, c.state, c.zip, c.phone AS company_phone
      FROM invoices i
      LEFT JOIN companies c ON c.id = i.company_id
      WHERE i.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/invoices  — create invoice (optionally from a job or proposal)
router.post('/', async (req, res) => {
  try {
    const {
      company_id, job_id, proposal_id, title, invoice_number,
      amount, tax_amount, notes, due_date
    } = req.body;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    if (!amount) return res.status(400).json({ error: 'amount required' });

    // Auto-generate invoice number if not provided
    let invNum = invoice_number;
    if (!invNum) {
      const last = await db.prepare(`SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1`).get();
      const lastNum = last ? parseInt((last.invoice_number || 'INV-0').split('-')[1] || '0', 10) : 0;
      invNum = `INV-${String(lastNum + 1).padStart(4, '0')}`;
    }

    const total = (parseFloat(amount) || 0) + (parseFloat(tax_amount) || 0);

    const r = await db.prepare(`
      INSERT INTO invoices
        (company_id, job_id, proposal_id, title, invoice_number,
         amount, tax_amount, total, notes, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')
    `).run(
      company_id, job_id || null, proposal_id || null,
      title || 'Invoice', invNum,
      parseFloat(amount), parseFloat(tax_amount) || 0, total,
      notes || null, due_date || null
    );
    const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/invoices/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, amount, tax_amount, notes, due_date, status } = req.body;
    const total = (parseFloat(amount) || 0) + (parseFloat(tax_amount) || 0);
    await db.prepare(`
      UPDATE invoices SET
        title = ?, amount = ?, tax_amount = ?, total = ?,
        notes = ?, due_date = ?, status = ?
      WHERE id = ?
    `).run(
      title, parseFloat(amount), parseFloat(tax_amount) || 0, total,
      notes || null, due_date || null, status || 'unpaid',
      req.params.id
    );
    const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/invoices/:id/pay  — mark as paid
router.patch('/:id/pay', async (req, res) => {
  try {
    await db.prepare(`
      UPDATE invoices SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.id);
    const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
