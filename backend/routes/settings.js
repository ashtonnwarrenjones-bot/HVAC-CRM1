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
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULTS };
  rows.forEach(r => { out[r.key] = r.value; });
  res.json(out);
});

// PUT update settings (bulk upsert)
router.put('/', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const upsertMany = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (key in DEFAULTS) upsert.run(key, value ?? '');
    }
  });
  upsertMany(req.body);

  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULTS };
  rows.forEach(r => { out[r.key] = r.value; });
  res.json(out);
});

module.exports = router;
