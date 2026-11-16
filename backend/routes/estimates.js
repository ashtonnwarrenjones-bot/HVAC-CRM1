const express = require('express');
const router = express.Router();
const db = require('../database');

function nextEstimateNumber(existing) {
  const nums = (existing || []).map(r => parseInt((r.estimate_number || '').replace(/[^0-9]/g, '')) || 0);
  const max = nums.length ? Math.max(...nums) : 999;
  return 'EST-' + String(max + 1).padStart(4, '0');
}

// GET /api/estimates
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT e.*, c.name as company_name, p.name as property_name
      FROM estimates e
      LEFT JOIN companies c ON c.id = e.company_id
      LEFT JOIN properties p ON p.id = e.property_id
      ORDER BY e.created_at DESC
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/estimates/:id  (with line items)
router.get('/:id', async (req, res) => {
  try {
    const estimate = await db.prepare(`
      SELECT e.*, c.name as company_name, p.name as property_name,
             co.first_name, co.last_name, co.email as contact_email
      FROM estimates e
      LEFT JOIN companies c ON c.id = e.company_id
      LEFT JOIN properties p ON p.id = e.property_id
      LEFT JOIN contacts co ON co.id = e.contact_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    const items = await db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY sort_order').all(req.params.id);
    res.json({ ...estimate, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/estimates
router.post('/', async (req, res) => {
  try {
    const { company_id, property_id, contact_id, title, notes, valid_until, tax_rate,
            division, salesperson, confidence, items = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const existing = await db.prepare('SELECT estimate_number FROM estimates ORDER BY id DESC LIMIT 50').all();
    const estimate_number = nextEstimateNumber(existing);

    const subtotal = items.reduce((s, i) => s + ((i.quantity || 1) * (i.unit_price || 0)), 0);
    const total_cost = items.reduce((s, i) => s + ((i.quantity || 1) * (i.unit_cost || 0)), 0);
    const total_hours = items.reduce((s, i) => s + (parseFloat(i.hours) || 0), 0);
    const tr = parseFloat(tax_rate) || 0;
    const tax_amount = subtotal * (tr / 100);
    const total = subtotal + tax_amount;

    const r = await db.prepare(
      `INSERT INTO estimates (company_id, property_id, contact_id, title, estimate_number, notes, valid_until,
       tax_rate, subtotal, tax_amount, total, division, salesperson, confidence)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(company_id, property_id, contact_id, title, estimate_number, notes, valid_until,
          tr, subtotal, tax_amount, total,
          division || '', salesperson || '', confidence != null ? parseInt(confidence) : 50);
    const id = r.lastInsertRowid || r.rows?.[0]?.id;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const lineTotal = (it.quantity || 1) * (it.unit_price || 0);
      await db.prepare(
        `INSERT INTO estimate_items (estimate_id, pricebook_item_id, description, category, quantity, unit,
         unit_price, unit_cost, hours, total, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).run(id, it.pricebook_item_id || null, it.description, it.category || '',
            it.quantity || 1, it.unit || 'each',
            it.unit_price || 0, it.unit_cost || 0, it.hours || 0,
            lineTotal, i);
    }

    const estimate = await db.prepare('SELECT * FROM estimates WHERE id = ?').get(id);
    const savedItems = await db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY sort_order').all(id);
    res.status(201).json({ ...estimate, items: savedItems });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/estimates/:id
router.put('/:id', async (req, res) => {
  try {
    const { company_id, property_id, contact_id, title, status, notes, valid_until, tax_rate,
            division, salesperson, confidence, items } = req.body;
    const id = req.params.id;

    let subtotal = 0, tax_amount = 0, total = 0;
    if (items) {
      subtotal = items.reduce((s, i) => s + ((i.quantity || 1) * (i.unit_price || 0)), 0);
      const tr = parseFloat(tax_rate) || 0;
      tax_amount = subtotal * (tr / 100);
      total = subtotal + tax_amount;
    } else {
      const cur = await db.prepare('SELECT subtotal, tax_amount, total FROM estimates WHERE id = ?').get(id);
      subtotal = cur.subtotal; tax_amount = cur.tax_amount; total = cur.total;
    }

    await db.prepare(
      `UPDATE estimates SET company_id=?, property_id=?, contact_id=?, title=?, status=?, notes=?,
       valid_until=?, tax_rate=?, subtotal=?, tax_amount=?, total=?,
       division=?, salesperson=?, confidence=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(company_id, property_id, contact_id, title, status, notes, valid_until,
          parseFloat(tax_rate) || 0, subtotal, tax_amount, total,
          division || '', salesperson || '', confidence != null ? parseInt(confidence) : 50,
          id);

    if (items) {
      await db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(id);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const lineTotal = (it.quantity || 1) * (it.unit_price || 0);
        await db.prepare(
          `INSERT INTO estimate_items (estimate_id, pricebook_item_id, description, category, quantity, unit,
           unit_price, unit_cost, hours, total, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        ).run(id, it.pricebook_item_id || null, it.description, it.category || '',
              it.quantity || 1, it.unit || 'each',
              it.unit_price || 0, it.unit_cost || 0, it.hours || 0,
              lineTotal, i);
      }
    }

    const estimate = await db.prepare('SELECT * FROM estimates WHERE id = ?').get(id);
    const savedItems = await db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY sort_order').all(id);
    res.json({ ...estimate, items: savedItems });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/estimates/:id/convert — convert to job
router.post('/:id/convert', async (req, res) => {
  try {
    const id = req.params.id;
    const estimate = await db.prepare('SELECT * FROM estimates WHERE id = ?').get(id);
    if (!estimate) return res.status(404).json({ error: 'Not found' });

    const r = await db.prepare(
      `INSERT INTO jobs (company_id, title, job_type, status, notes)
       VALUES (?,?,?,?,?)`
    ).run(estimate.company_id, estimate.title, 'service', 'scheduled',
          `Created from estimate ${estimate.estimate_number}`);
    const jobId = r.lastInsertRowid || r.rows?.[0]?.id;

    await db.prepare('UPDATE estimates SET status=?, converted_job_id=? WHERE id=?').run('converted', jobId, id);
    const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    res.json({ job, estimate_id: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/estimates/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM estimates WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
