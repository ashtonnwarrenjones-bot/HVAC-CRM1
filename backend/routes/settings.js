const express = require('express');
const router = express.Router();
const db = require('../database');

const DEFAULTS = {
  company_name: 'Your Company Name',
  company_phone: '(555) 000-0000',
  company_email: 'info@yourcompany.com',
  company_address: '',
  company_city: '',
  company_state: '',
  company_zip: '',
  company_license: '',
  company_logo: '',
  proposal_terms: 'Payment due net 30 days. Price valid for 30 days from proposal date. All work performed per manufacturer specifications and local code.',
  proposal_footer: 'Thank you for the opportunity to earn your business.',
  tax_rate_default: '0',
};

// GET all settings
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT key, value FROM settings').all();
    const out = { ...DEFAULTS };
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update settings (bulk upsert)
router.put('/', async (req, res) => {
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(req.body)) {
        if (key in DEFAULTS) {
          await client.query(
            `INSERT INTO settings (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [key, value ?? '']
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const rows = await db.prepare('SELECT key, value FROM settings').all();
    const out = { ...DEFAULTS };
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings/backup — full data export as downloadable JSON
router.get('/backup', async (req, res) => {
  try {
    const backup = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      companies:           await db.prepare('SELECT * FROM companies ORDER BY name').all(),
      contacts:            await db.prepare('SELECT * FROM contacts ORDER BY last_name, first_name').all(),
      proposals:           await db.prepare('SELECT * FROM proposals ORDER BY created_at DESC').all(),
      proposal_line_items: await db.prepare('SELECT * FROM proposal_line_items').all(),
      jobs:                await db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all(),
      deals:               await db.prepare('SELECT * FROM deals ORDER BY created_at DESC').all(),
    };

    const filename = `conduit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
