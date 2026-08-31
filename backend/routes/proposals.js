const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../database');

// Helper: load settings with defaults (async)
async function getSettings() {
  const rows = await db.prepare('SELECT key, value FROM settings').all();
  const defaults = {
    company_name: 'Your Company Name',
    company_phone: '(555) 000-0000',
    company_email: 'info@yourcompany.com',
    company_address: '',
    company_city: '',
    company_state: '',
    company_zip: '',
    company_license: '',
    company_logo: '',
    proposal_terms: 'Payment due net 30 days. Price valid for 30 days from proposal date.',
    proposal_footer: 'Thank you for the opportunity to earn your business.',
  };
  rows.forEach(r => { defaults[r.key] = r.value; });
  return defaults;
}

// Multer config for Excel uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel/CSV files allowed'));
  }
});

// Helper: generate a proposal number
function generateProposalNumber() {
  const now = new Date();
  const yr = now.getFullYear().toString().slice(-2);
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PROP-${yr}${mo}-${rand}`;
}

// Helper: recalc totals (async)
async function recalcTotals(proposalId) {
  const items = await db.prepare('SELECT * FROM proposal_line_items WHERE proposal_id = ?').all(proposalId);
  const subtotal = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
  const proposal = await db.prepare('SELECT tax_rate FROM proposals WHERE id = ?').get(proposalId);
  const taxAmount = subtotal * ((proposal?.tax_rate || 0) / 100);
  const total = subtotal + taxAmount;
  await db.prepare('UPDATE proposals SET subtotal = ?, tax_amount = ?, total_amount = ?, updated_at = NOW() WHERE id = ?')
    .run(subtotal, taxAmount, total, proposalId);
  return { subtotal, taxAmount, total };
}

// GET all proposals
router.get('/', async (req, res) => {
  try {
    const proposals = await db.prepare(`
      SELECT p.*, co.name AS company_name, c.first_name, c.last_name
      FROM proposals p
      LEFT JOIN companies co ON p.company_id = co.id
      LEFT JOIN contacts c ON p.contact_id = c.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(proposals);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single proposal with line items
router.get('/:id', async (req, res) => {
  try {
    const proposal = await db.prepare(`
      SELECT p.*, co.name AS company_name, co.address AS company_address,
        co.city AS company_city, co.state AS company_state, co.zip AS company_zip,
        c.first_name, c.last_name, c.email AS contact_email, c.phone AS contact_phone, c.title AS contact_title
      FROM proposals p
      LEFT JOIN companies co ON p.company_id = co.id
      LEFT JOIN contacts c ON p.contact_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    proposal.line_items = await db.prepare(
      'SELECT * FROM proposal_line_items WHERE proposal_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(req.params.id);

    res.json(proposal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create proposal (manual)
router.post('/', async (req, res) => {
  try {
    const {
      company_id, contact_id, title, service_type,
      tax_rate, valid_days, notes, terms, line_items
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Proposal title is required' });

    const proposalNumber = generateProposalNumber();
    const result = await db.prepare(`
      INSERT INTO proposals (company_id, contact_id, title, proposal_number, service_type, tax_rate, valid_days, notes, terms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(company_id || null, contact_id || null, title, proposalNumber,
      service_type, tax_rate || 0, valid_days || 30, notes, terms);

    const proposalId = result.lastInsertRowid;

    // Insert line items if provided
    if (Array.isArray(line_items)) {
      for (let idx = 0; idx < line_items.length; idx++) {
        const item = line_items[idx];
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        await db.prepare(`
          INSERT INTO proposal_line_items (proposal_id, description, quantity, unit, unit_price, total_price, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(proposalId, item.description, qty, item.unit || 'ea', price, qty * price, idx);
      }
      await recalcTotals(proposalId);
    }

    const proposal = await db.prepare('SELECT * FROM proposals WHERE id = ?').get(proposalId);
    res.status(201).json(proposal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST upload Excel → parse line items preview
router.post('/parse-excel', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const normalizeKey = (key) => key.toLowerCase().replace(/[\s_-]+/g, '_');
    const normalized = rows.map(row => {
      const out = {};
      Object.entries(row).forEach(([k, v]) => { out[normalizeKey(k)] = v; });
      return out;
    });

    const lineItems = normalized
      .filter(r => r.description || r.desc || r.item || r.service)
      .map((r, idx) => {
        const desc = r.description || r.desc || r.item || r.service || r.work || '';
        const qty = parseFloat(r.quantity || r.qty || r.hours || 1) || 1;
        const unit = r.unit || r.uom || (r.hours !== undefined ? 'hr' : 'ea');
        const price = parseFloat(r.unit_price || r.price || r.rate || r.cost || r.amount || 0) || 0;
        return {
          description: String(desc).trim(),
          quantity: qty,
          unit: String(unit).trim() || 'ea',
          unit_price: price,
          total_price: qty * price,
          sort_order: idx
        };
      })
      .filter(i => i.description);

    fs.unlink(req.file.path, () => {});
    res.json({ line_items: lineItems, sheet_name: sheetName, row_count: rows.length });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: `Failed to parse file: ${err.message}` });
  }
});

// PUT update proposal
router.put('/:id', async (req, res) => {
  try {
    const {
      company_id, contact_id, title, service_type, status,
      tax_rate, valid_days, notes, terms, line_items
    } = req.body;

    await db.prepare(`
      UPDATE proposals SET
        company_id = ?, contact_id = ?, title = ?, service_type = ?, status = ?,
        tax_rate = ?, valid_days = ?, notes = ?, terms = ?,
        updated_at = NOW()
      WHERE id = ?
    `).run(company_id || null, contact_id || null, title, service_type, status || 'draft',
      tax_rate || 0, valid_days || 30, notes, terms, req.params.id);

    // Replace line items if provided
    if (Array.isArray(line_items)) {
      await db.prepare('DELETE FROM proposal_line_items WHERE proposal_id = ?').run(req.params.id);
      for (let idx = 0; idx < line_items.length; idx++) {
        const item = line_items[idx];
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        await db.prepare(`
          INSERT INTO proposal_line_items (proposal_id, description, quantity, unit, unit_price, total_price, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, item.description, qty, item.unit || 'ea', price, qty * price, idx);
      }
      await recalcTotals(req.params.id);
    }

    const proposal = await db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
    res.json(proposal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE proposal
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM proposals WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET download PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const proposal = await db.prepare(`
      SELECT p.*, co.name AS company_name, co.address AS company_address,
        co.city AS company_city, co.state AS company_state, co.zip AS company_zip,
        co.phone AS company_phone,
        c.first_name, c.last_name, c.email AS contact_email, c.phone AS contact_phone, c.title AS contact_title
      FROM proposals p
      LEFT JOIN companies co ON p.company_id = co.id
      LEFT JOIN contacts c ON p.contact_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const lineItems = await db.prepare(
      'SELECT * FROM proposal_line_items WHERE proposal_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(req.params.id);

    const settings = await getSettings();

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Proposal-${proposal.proposal_number}.pdf"`);
    doc.pipe(res);

    const blue = '#1E40AF';
    const gray = '#6B7280';
    const lightGray = '#F3F4F6';
    const darkText = '#111827';

    // --- Header ---
    doc.rect(0, 0, doc.page.width, 100).fill(blue);

    if (settings.company_logo && settings.company_logo.startsWith('data:image/')) {
      try {
        const base64Data = settings.company_logo.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, doc.page.width - 110, 12, { fit: [80, 76], align: 'right' });
      } catch (_) {}
    }

    doc.fill('white').fontSize(22).font('Helvetica-Bold')
      .text('SERVICE PROPOSAL', 50, 30);
    doc.fontSize(10).font('Helvetica')
      .text('Commercial HVAC & Plumbing Services', 50, 58)
      .text(`${settings.company_name} | ${settings.company_phone} | ${settings.company_email}`, 50, 72);
    doc.fill(darkText);

    const dateX = settings.company_logo ? 370 : 400;
    const dateW = settings.company_logo ? 115 : 145;
    doc.fontSize(10).font('Helvetica-Bold')
      .text(proposal.proposal_number, dateX, 32, { align: 'right', width: dateW });
    doc.font('Helvetica').fill(gray)
      .text(`Date: ${new Date(proposal.created_at).toLocaleDateString()}`, dateX, 48, { align: 'right', width: dateW })
      .text(`Valid for: ${proposal.valid_days} days`, dateX, 62, { align: 'right', width: dateW });

    doc.fill(darkText);
    let y = 120;

    // --- To / From boxes ---
    doc.rect(50, y, 230, 100).fill(lightGray);
    doc.rect(310, y, 235, 100).fill(lightGray);
    doc.fill(blue).fontSize(9).font('Helvetica-Bold')
      .text('PREPARED FOR', 60, y + 10)
      .text('SERVICE TYPE', 320, y + 10);
    doc.fill(darkText).fontSize(11).font('Helvetica-Bold')
      .text(proposal.company_name || '—', 60, y + 25);
    doc.fontSize(9).font('Helvetica')
      .text([
        proposal.first_name ? `${proposal.first_name} ${proposal.last_name}` : '',
        proposal.contact_title || '',
        proposal.company_address || '',
        [proposal.company_city, proposal.company_state, proposal.company_zip].filter(Boolean).join(', '),
        proposal.contact_phone || ''
      ].filter(Boolean).join('\n'), 60, y + 40);

    doc.fontSize(11).font('Helvetica-Bold')
      .text(proposal.service_type || 'HVAC / Plumbing Service', 320, y + 25);
    doc.fontSize(9).font('Helvetica').fill(gray)
      .text(`Status: ${(proposal.status || 'draft').toUpperCase()}`, 320, y + 42);
    if (proposal.notes) {
      doc.fill(darkText)
        .text(proposal.notes.substring(0, 120), 320, y + 58, { width: 210 });
    }

    y += 120;

    // --- Title ---
    doc.fill(darkText).fontSize(14).font('Helvetica-Bold')
      .text(proposal.title, 50, y + 10);
    y += 40;

    // --- Line Items Table ---
    const colX = { desc: 50, qty: 320, unit: 370, price: 420, total: 480 };
    const colW = { desc: 260, qty: 45, unit: 45, price: 55, total: 65 };

    doc.rect(50, y, doc.page.width - 100, 20).fill(blue);
    doc.fill('white').fontSize(9).font('Helvetica-Bold')
      .text('DESCRIPTION', colX.desc + 4, y + 5)
      .text('QTY', colX.qty, y + 5, { width: colW.qty, align: 'center' })
      .text('UNIT', colX.unit, y + 5, { width: colW.unit, align: 'center' })
      .text('UNIT PRICE', colX.price, y + 5, { width: colW.price, align: 'right' })
      .text('TOTAL', colX.total, y + 5, { width: colW.total, align: 'right' });
    y += 20;

    lineItems.forEach((item, i) => {
      const rowH = Math.max(20, doc.heightOfString(item.description, { width: colW.desc - 8 }) + 10);

      if (y + rowH > doc.page.height - 150) {
        doc.addPage();
        y = 50;
      }

      if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, rowH).fill(lightGray);
      doc.fill(darkText).fontSize(9).font('Helvetica')
        .text(item.description, colX.desc + 4, y + 5, { width: colW.desc - 8 })
        .text(String(item.quantity), colX.qty, y + 5, { width: colW.qty, align: 'center' })
        .text(item.unit || 'ea', colX.unit, y + 5, { width: colW.unit, align: 'center' })
        .text(`$${parseFloat(item.unit_price || 0).toFixed(2)}`, colX.price, y + 5, { width: colW.price, align: 'right' })
        .text(`$${parseFloat(item.total_price || 0).toFixed(2)}`, colX.total, y + 5, { width: colW.total, align: 'right' });
      y += rowH;
    });

    y += 10;

    const totalsX = 380;
    const totalsW = 160;
    const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    doc.fill(gray).fontSize(9).font('Helvetica')
      .text('Subtotal:', totalsX, y, { width: 80 })
      .text(fmt(proposal.subtotal), totalsX + 80, y, { width: 80, align: 'right' });
    y += 16;

    if ((proposal.tax_rate || 0) > 0) {
      doc.text(`Tax (${proposal.tax_rate}%):`, totalsX, y, { width: 80 })
        .text(fmt(proposal.tax_amount), totalsX + 80, y, { width: 80, align: 'right' });
      y += 16;
    }

    doc.rect(totalsX - 5, y, totalsW + 10, 24).fill(blue);
    doc.fill('white').fontSize(11).font('Helvetica-Bold')
      .text('TOTAL:', totalsX, y + 6, { width: 80 })
      .text(fmt(proposal.total_amount), totalsX + 80, y + 6, { width: 80, align: 'right' });
    y += 34;

    const termsText = proposal.terms || settings.proposal_terms;
    if (termsText) {
      y += 10;
      doc.fill(gray).fontSize(8).font('Helvetica-Bold').text('TERMS & CONDITIONS', 50, y);
      y += 12;
      doc.font('Helvetica').fill(darkText).text(termsText, 50, y, { width: doc.page.width - 100 });
      y += doc.heightOfString(termsText, { width: doc.page.width - 100 }) + 8;
    }

    if (settings.proposal_footer) {
      doc.fill(blue).fontSize(9).font('Helvetica-Bold')
        .text(settings.proposal_footer, 50, y + 8, { align: 'center', width: doc.page.width - 100 });
    }

    const licenseText = settings.company_license ? `License: ${settings.company_license} • ` : '';
    doc.fontSize(8).fill(gray)
      .text(`${licenseText}${settings.company_name} • Generated ${new Date().toLocaleDateString()}`,
        50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:id/request-signature — generate a signing token and return the signing URL
router.post('/:id/request-signature', async (req, res) => {
  try {
    const proposal = await db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const token = crypto.randomBytes(24).toString('hex');
    await db.prepare('UPDATE proposals SET signature_token = ?, status = ?, updated_at = NOW() WHERE id = ?')
      .run(token, 'sent', req.params.id);

    const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    res.json({ token, signing_url: `${baseUrl}/sign/${token}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /sign/:token — PUBLIC: return proposal summary for the signer (no auth)
router.get('/sign/:token', async (req, res) => {
  try {
    const proposal = await db.prepare(`
      SELECT p.id, p.title, p.proposal_number, p.total_amount, p.subtotal, p.tax_rate, p.tax_amount,
             p.status, p.signed_at, p.signed_by, p.notes, p.terms,
             co.name AS company_name
      FROM proposals p
      LEFT JOIN companies co ON p.company_id = co.id
      WHERE p.signature_token = ?
    `).get(req.params.token);

    if (!proposal) return res.status(404).json({ error: 'Invalid or expired signing link' });

    const lineItems = await db.prepare(
      'SELECT * FROM proposal_line_items WHERE proposal_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(proposal.id);

    res.json({ ...proposal, line_items: lineItems });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /sign/:token — PUBLIC: submit signature (no auth)
router.post('/sign/:token', async (req, res) => {
  try {
    const { signed_by } = req.body;
    if (!signed_by || !signed_by.trim()) return res.status(400).json({ error: 'Full name is required to sign' });

    const proposal = await db.prepare('SELECT id, status, signed_at, title, company_id FROM proposals WHERE signature_token = ?').get(req.params.token);
    if (!proposal) return res.status(404).json({ error: 'Invalid or expired signing link' });
    if (proposal.signed_at) return res.status(409).json({ error: 'This proposal has already been signed' });

    await db.prepare(`
      UPDATE proposals SET signed_by = ?, signed_at = NOW(),
        status = 'accepted', updated_at = NOW()
      WHERE signature_token = ?
    `).run(signed_by.trim(), req.params.token);

    // Create notification (fire and forget)
    try {
      const { createNotification } = require('../database');
      if (proposal.company_id) {
        db.prepare('SELECT name, sales_rep_name FROM companies WHERE id = ?').get(proposal.company_id)
          .then(company => {
            createNotification({
              type: 'proposal_signed',
              title: `✅ Proposal Signed: ${proposal.title}`,
              message: `Signed by ${signed_by.trim()}${company ? ` — ${company.name}` : ''}`,
              entity_type: 'proposal',
              entity_id: proposal.id,
              company_id: proposal.company_id,
              sales_rep_name: company?.sales_rep_name,
            });
          }).catch(() => {});
      } else {
        createNotification({
          type: 'proposal_signed',
          title: `✅ Proposal Signed: ${proposal.title}`,
          message: `Signed by ${signed_by.trim()}`,
          entity_type: 'proposal',
          entity_id: proposal.id,
        });
      }
    } catch (_) {}

    res.json({ success: true, message: 'Proposal signed successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
