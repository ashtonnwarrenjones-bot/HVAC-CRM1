'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ─── GET /api/vendors/recommend?manufacturer=Carrier&model=50XC ──────────────
// Returns vendors who carry this brand — must be BEFORE /:id route
router.get('/recommend', async (req, res) => {
  try {
    const { manufacturer = '' } = req.query;
    if (!manufacturer) return res.json([]);

    const mfr = manufacturer.trim().toLowerCase();

    const vendors = await db.prepare(`
      SELECT v.*,
        COALESCE(json_agg(vb.brand ORDER BY vb.brand) FILTER (WHERE vb.brand IS NOT NULL), '[]') AS brands
      FROM vendors v
      LEFT JOIN vendor_brands vb ON vb.vendor_id = v.id
      WHERE v.active = TRUE
      GROUP BY v.id
    `).all();

    const scored = vendors
      .map(v => {
        const brands = (Array.isArray(v.brands) ? v.brands : JSON.parse(v.brands || '[]')).map(b => b.toLowerCase());
        let score = 0;
        for (const b of brands) {
          if (b === mfr) score += 100;
          else if (mfr.includes(b) || b.includes(mfr)) score += 50;
          else if (mfr.split(' ').some(word => b.includes(word) && word.length > 2)) score += 20;
        }
        return { ...v, match_score: score };
      })
      .filter(v => v.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score);

    res.json(scored);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vendors/quote-requests ─────────────────────────────────────────
router.get('/quote-requests', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT qr.*, v.name AS vendor_name, j.title AS job_title
      FROM quote_requests qr
      LEFT JOIN vendors v ON v.id = qr.vendor_id
      LEFT JOIN jobs j ON j.id = qr.job_id
      ORDER BY qr.sent_at DESC
      LIMIT 100
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vendors/quote-requests ────────────────────────────────────────
router.post('/quote-requests', async (req, res) => {
  try {
    const { job_id, vendor_id, manufacturer, model, serial_number, description, photo_urls, notes } = req.body;
    const result = await db.prepare(`
      INSERT INTO quote_requests (job_id, vendor_id, manufacturer, model, serial_number, description, photo_urls, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `).get(job_id, vendor_id, manufacturer, model, serial_number, description,
      Array.isArray(photo_urls) ? photo_urls.join(',') : photo_urls, notes);
    res.json({ ok: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vendors ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const vendors = await db.prepare(`
      SELECT v.*,
        COALESCE(json_agg(vb.brand ORDER BY vb.brand) FILTER (WHERE vb.brand IS NOT NULL), '[]') AS brands
      FROM vendors v
      LEFT JOIN vendor_brands vb ON vb.vendor_id = v.id
      WHERE v.active = TRUE
      GROUP BY v.id
      ORDER BY v.name
    `).all();
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vendors/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const vendor = await db.prepare(`
      SELECT v.*,
        COALESCE(json_agg(vb.brand ORDER BY vb.brand) FILTER (WHERE vb.brand IS NOT NULL), '[]') AS brands
      FROM vendors v
      LEFT JOIN vendor_brands vb ON vb.vendor_id = v.id
      WHERE v.id = ?
      GROUP BY v.id
    `).get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const parts = await db.prepare(
      'SELECT * FROM vendor_parts WHERE vendor_id = ? ORDER BY description'
    ).all(req.params.id);

    res.json({ ...vendor, parts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vendors ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name, contact_name, email, phone, parts_counter_phone,
      website, address, city, state, zip, notes, account_number, brands = [],
    } = req.body;

    const result = await db.prepare(`
      INSERT INTO vendors (name, contact_name, email, phone, parts_counter_phone, website, address, city, state, zip, notes, account_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(name, contact_name, email, phone, parts_counter_phone, website, address, city, state, zip, notes, account_number);

    const vendorId = result.id;

    // Insert brands
    for (const brand of brands) {
      if (brand?.trim()) {
        await db.prepare('INSERT INTO vendor_brands (vendor_id, brand) VALUES (?, ?)').run(vendorId, brand.trim());
      }
    }

    res.json({ ok: true, id: vendorId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/vendors/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const {
      name, contact_name, email, phone, parts_counter_phone,
      website, address, city, state, zip, notes, account_number, brands = [],
    } = req.body;

    await db.prepare(`
      UPDATE vendors SET
        name = ?, contact_name = ?, email = ?, phone = ?,
        parts_counter_phone = ?, website = ?, address = ?, city = ?,
        state = ?, zip = ?, notes = ?, account_number = ?
      WHERE id = ?
    `).run(name, contact_name, email, phone, parts_counter_phone, website, address, city, state, zip, notes, account_number, req.params.id);

    // Replace brands
    await db.prepare('DELETE FROM vendor_brands WHERE vendor_id = ?').run(req.params.id);
    for (const brand of brands) {
      if (brand?.trim()) {
        await db.prepare('INSERT INTO vendor_brands (vendor_id, brand) VALUES (?, ?)').run(req.params.id, brand.trim());
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/vendors/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('UPDATE vendors SET active = FALSE WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vendors/:id/parts ───────────────────────────────────────────────
router.get('/:id/parts', async (req, res) => {
  try {
    const parts = await db.prepare(
      'SELECT * FROM vendor_parts WHERE vendor_id = ? ORDER BY description'
    ).all(req.params.id);
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vendors/:id/parts ─────────────────────────────────────────────
router.post('/:id/parts', async (req, res) => {
  try {
    const { manufacturer_part_no, vendor_part_no, description, unit_cost, unit } = req.body;
    const result = await db.prepare(`
      INSERT INTO vendor_parts (vendor_id, manufacturer_part_no, vendor_part_no, description, unit_cost, unit)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING id
    `).get(req.params.id, manufacturer_part_no, vendor_part_no, description, unit_cost || 0, unit || 'each');
    res.json({ ok: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/vendors/:vendorId/parts/:partId ──────────────────────────────
router.delete('/:vendorId/parts/:partId', async (req, res) => {
  try {
    await db.prepare('DELETE FROM vendor_parts WHERE id = ? AND vendor_id = ?').run(req.params.partId, req.params.vendorId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/vendors/:id/import-csv ────────────────────────────────────────
// Import a price list CSV: columns mapped via req.body.columnMap
// Expected CSV headers (flexible): part_no, description, cost, unit
router.post('/:id/import-csv', async (req, res) => {
  try {
    const { rows, columnMap = {} } = req.body;
    // rows = array of objects from parsed CSV
    // columnMap = { descriptionCol, costCol, vendorPartNoCol, mfrPartNoCol, unitCol }
    const {
      descriptionCol = 'description',
      costCol = 'cost',
      vendorPartNoCol = 'vendor_part_no',
      mfrPartNoCol = 'manufacturer_part_no',
      unitCol = 'unit',
    } = columnMap;

    let inserted = 0;
    let updated  = 0;

    for (const row of rows) {
      const desc       = row[descriptionCol] || '';
      const cost       = parseFloat(row[costCol] || '0') || 0;
      const vendorPart = row[vendorPartNoCol] || '';
      const mfrPart    = row[mfrPartNoCol] || '';
      const unit       = row[unitCol] || 'each';

      if (!desc && !vendorPart) continue;

      // Upsert by vendor_part_no if provided
      if (vendorPart) {
        const existing = await db.prepare(
          'SELECT id FROM vendor_parts WHERE vendor_id = ? AND vendor_part_no = ?'
        ).get(req.params.id, vendorPart);

        if (existing) {
          await db.prepare(`
            UPDATE vendor_parts SET description=?, unit_cost=?, manufacturer_part_no=?, unit=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
          `).run(desc, cost, mfrPart, unit, existing.id);
          updated++;
        } else {
          await db.prepare(`
            INSERT INTO vendor_parts (vendor_id, manufacturer_part_no, vendor_part_no, description, unit_cost, unit)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(req.params.id, mfrPart, vendorPart, desc, cost, unit);
          inserted++;
        }
      } else {
        await db.prepare(`
          INSERT INTO vendor_parts (vendor_id, manufacturer_part_no, vendor_part_no, description, unit_cost, unit)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(req.params.id, mfrPart, vendorPart, desc, cost, unit);
        inserted++;
      }
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
