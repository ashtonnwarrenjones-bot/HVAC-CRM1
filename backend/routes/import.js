const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../database');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser — handles quoted fields, escaped quotes, BOM, mixed line endings
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(buf) {
  let text = buf.toString('utf-8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const splitLine = (line) => {
    const fields = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { field += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields;
  };

  // Split respecting quoted newlines
  const lines = [];
  let current = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { current += '""'; i++; }
      else { inQ = !inQ; current += ch; }
    } else if (ch === '\n' && !inQ) {
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Field mappers — Salesforce standard export column names → CRM schema
// ─────────────────────────────────────────────────────────────────────────────
function mapAccount(row) {
  const noteParts = [];
  if (row['Industry']) noteParts.push(`Industry: ${row['Industry']}`);
  if (row['Description']) noteParts.push(row['Description']);

  return {
    name:           row['Account Name'] || row['Name'] || '',
    phone:          row['Phone'] || row['Business Phone'] || '',
    website:        row['Website'] || '',
    address:        row['Billing Street'] || row['Street'] || '',
    city:           row['Billing City'] || row['City'] || '',
    state:          row['Billing State/Province'] || row['Billing State'] || row['State'] || '',
    zip:            row['Billing Zip/Postal Code'] || row['Billing Zip'] || row['Zip'] || '',
    annual_revenue: parseFloat((row['Annual Revenue'] || '').replace(/[$,]/g, '')) || null,
    notes:          noteParts.join('\n') || null,
  };
}

function mapContact(row) {
  return {
    first_name:   row['First Name'] || '',
    last_name:    row['Last Name'] || '',
    email:        row['Email'] || '',
    phone:        row['Phone'] || row['Business Phone'] || '',
    mobile:       row['Mobile'] || '',
    title:        row['Title'] || '',
    notes:        row['Description'] || null,
    company_name: row['Account Name'] || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import/salesforce/preview
// Upload CSVs and return parsed rows with duplicate flags — no DB writes
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/salesforce/preview',
  upload.fields([{ name: 'accounts', maxCount: 1 }, { name: 'contacts', maxCount: 1 }]),
  async (req, res) => {
    try {
      const result = { accounts: [], contacts: [] };

      if (req.files?.accounts?.[0]) {
        const rows = parseCSV(req.files.accounts[0].buffer);
        result.accounts = await Promise.all(
          rows.map(mapAccount).filter(a => a.name).map(async a => {
            const existing = await db.prepare('SELECT id FROM companies WHERE LOWER(name) = LOWER(?)').get(a.name);
            return { ...a, _exists: !!existing };
          })
        );
      }

      if (req.files?.contacts?.[0]) {
        const rows = parseCSV(req.files.contacts[0].buffer);
        result.contacts = await Promise.all(
          rows.map(mapContact).filter(c => c.last_name || c.first_name).map(async c => {
            const exists = c.email
              ? !!(await db.prepare('SELECT id FROM contacts WHERE LOWER(email) = LOWER(?)').get(c.email))
              : false;
            return { ...c, _exists: exists };
          })
        );
      }

      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import/salesforce/execute
// Perform the actual import
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/salesforce/execute',
  upload.fields([{ name: 'accounts', maxCount: 1 }, { name: 'contacts', maxCount: 1 }]),
  async (req, res) => {
    try {
      const skipDupes = req.body.skip_duplicates !== 'false';
      const summary = {
        companies_created: 0,
        companies_skipped: 0,
        contacts_created: 0,
        contacts_skipped: 0,
        errors: [],
      };

      // Pre-load company map (name.lower → id) so contacts can link to newly-created companies
      const companyMap = {};
      const existingCompanies = await db.prepare('SELECT id, LOWER(name) AS key FROM companies').all();
      existingCompanies.forEach(c => { companyMap[c.key] = c.id; });

      // ── Import Accounts ──────────────────────────────────────────────────
      if (req.files?.accounts?.[0]) {
        for (const row of parseCSV(req.files.accounts[0].buffer)) {
          const m = mapAccount(row);
          if (!m.name) continue;
          const key = m.name.toLowerCase();

          if (companyMap[key]) {
            summary.companies_skipped++;
            continue;
          }

          try {
            const r = await db.prepare(`
              INSERT INTO companies (name, phone, website, address, city, state, zip, annual_revenue, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              m.name,
              m.phone   || null,
              m.website || null,
              m.address || null,
              m.city    || null,
              m.state   || null,
              m.zip     || null,
              m.annual_revenue,
              m.notes,
            );
            companyMap[key] = r.lastInsertRowid;
            summary.companies_created++;
          } catch (err) {
            summary.errors.push(`Company "${m.name}": ${err.message}`);
          }
        }
      }

      // ── Import Contacts ──────────────────────────────────────────────────
      if (req.files?.contacts?.[0]) {
        for (const row of parseCSV(req.files.contacts[0].buffer)) {
          const m = mapContact(row);
          if (!m.first_name && !m.last_name) continue;

          if (m.email && skipDupes) {
            const dupe = await db.prepare('SELECT id FROM contacts WHERE LOWER(email) = LOWER(?)').get(m.email);
            if (dupe) { summary.contacts_skipped++; continue; }
          }

          // Resolve company — auto-create if it doesn't exist yet
          let company_id = null;
          if (m.company_name) {
            const key = m.company_name.toLowerCase();
            if (companyMap[key]) {
              company_id = companyMap[key];
            } else {
              // Create a stub company so the contact is linked
              try {
                const r = await db.prepare(
                  'INSERT INTO companies (name) VALUES (?)'
                ).run(m.company_name);
                company_id = r.lastInsertRowid;
                companyMap[key] = company_id;
                summary.companies_created++;
              } catch (err) {
                summary.errors.push(`Auto-create company "${m.company_name}": ${err.message}`);
              }
            }
          }

          try {
            await db.prepare(`
              INSERT INTO contacts (company_id, first_name, last_name, title, email, phone, mobile, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              company_id,
              m.first_name,
              m.last_name,
              m.title  || null,
              m.email  || null,
              m.phone  || null,
              m.mobile || null,
              m.notes,
            );
            summary.contacts_created++;
          } catch (err) {
            summary.errors.push(`Contact "${m.first_name} ${m.last_name}": ${err.message}`);
          }
        }
      }

      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

module.exports = router;
