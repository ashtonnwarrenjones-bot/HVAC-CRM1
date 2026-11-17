const express = require('express');
const router = express.Router();
const db = require('../database');

const IMPORT_SECRET = 'mahalo-lmn-2024';

// POST /api/import-lmn-public/fetch-and-import
// No auth required — protected by import_secret instead
// Called from LMN browser tab (cross-origin, no CRM JWT available)
router.post('/fetch-and-import', async (req, res) => {
  try {
    const { lmn_token, import_secret } = req.body;
    if (!lmn_token) return res.status(400).json({ error: 'lmn_token required' });
    if (import_secret !== IMPORT_SECRET) return res.status(403).json({ error: 'forbidden' });

    // Fetch leads from LMN API
    const lmnRes = await fetch(
      'https://app-lmn-internal-prod-internal.golmn.com/api/v1/leads-data?pageSize=1000&page=1',
      { headers: { Authorization: 'Bearer ' + lmn_token } }
    );
    if (!lmnRes.ok) {
      const txt = await lmnRes.text();
      return res.status(502).json({ error: 'LMN fetch failed', status: lmnRes.status, detail: txt.slice(0, 200) });
    }
    const lmnData = await lmnRes.json();
    const leads = lmnData.leads || lmnData.Leads || lmnData.data || lmnData;

    if (!Array.isArray(leads)) {
      return res.status(502).json({ error: 'Unexpected LMN response shape', keys: Object.keys(lmnData) });
    }

    const summary = { companies_created: 0, companies_skipped: 0, contacts_created: 0, contacts_skipped: 0, errors: [] };
    const typeMap = { 0: 'prospect', 1: 'client', 2: 'prospect', 3: 'prospect' };

    for (const lead of leads) {
      try {
        if (lead.IsArchived) continue;
        const name = (lead.LeadName || '').trim();
        if (!name) continue;

        let company_id = null;
        const existing = db.prepare('SELECT id FROM companies WHERE LOWER(name) = LOWER(?)').get(name);
        if (existing) {
          company_id = existing.id;
          summary.companies_skipped++;
        } else {
          const result = db.prepare(
            `INSERT INTO companies (name, address, city, state, zip, phone, website, property_type, contract_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            name,
            lead.Address1 || null,
            lead.City || null,
            lead.Province || null,
            lead.PostalCode || null,
            lead.Phone1 || null,
            null,
            'commercial',
            typeMap[lead.LeadType] || 'prospect',
            lead.Notes || null
          );
          company_id = result.lastInsertRowid;
          summary.companies_created++;
        }

        const fName = (lead.Firstname || '').trim() || 'Unknown';
        const lName = (lead.Lastname || '').trim() || 'Unknown';
        const existingContact = db.prepare(
          'SELECT id FROM contacts WHERE company_id = ? AND LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)'
        ).get(company_id, fName, lName);

        if (existingContact) {
          summary.contacts_skipped++;
        } else {
          db.prepare(
            `INSERT INTO contacts (company_id, first_name, last_name, email, phone, mobile, title, is_primary, notes) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
          ).run(company_id, fName, lName, lead.Email1 || null, lead.Phone1 || null, lead.Phone2 || null, lead.Position || null, null);
          summary.contacts_created++;
        }
      } catch (e) {
        summary.errors.push({ lead: lead.LeadName, error: e.message });
      }
    }

    res.json({ ...summary, total_leads: leads.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
