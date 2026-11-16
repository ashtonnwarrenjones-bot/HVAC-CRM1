const express = require('express');
const router = express.Router();
const db = require('../database');
const { pool } = require('../database');

function nextInvNumber(existing) {
  const nums = (existing || []).map(r => parseInt((r.invoice_number || '').replace(/[^0-9]/g, '')) || 0);
  const max = nums.length ? Math.max(...nums) : 999;
  return 'INV-' + String(max + 1).padStart(4, '0');
}

// ── QB helpers ────────────────────────────────────────────────────────────────

async function getQBConfig() {
  const r = await pool.query(
    "SELECT config_json FROM integration_settings WHERE integration_key = 'quickbooks' AND enabled = TRUE LIMIT 1"
  );
  if (!r.rows.length) return null;
  try { return JSON.parse(r.rows[0].config_json); } catch { return null; }
}

async function refreshQBToken(config) {
  if (!config || !config.refresh_token) return null;
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(config.refresh_token)}`
    });
    const data = await resp.json();
    if (data.access_token) {
      const updated = { ...config, access_token: data.access_token, refresh_token: data.refresh_token || config.refresh_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
      await pool.query("UPDATE integration_settings SET config_json = $1 WHERE integration_key = 'quickbooks'", [JSON.stringify(updated)]);
      return updated;
    }
  } catch (_) {}
  return null;
}

async function getValidQBToken() {
  let config = await getQBConfig();
  if (!config) return null;
  if (!config.expires_at || Date.now() > config.expires_at - 60000) {
    config = await refreshQBToken(config);
  }
  return config;
}

async function qbRequest(method, path, body, config) {
  const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${config.realm_id}`;
  const resp = await fetch(`${baseUrl}${path}?minorversion=65`, {
    method,
    headers: { 'Authorization': `Bearer ${config.access_token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json();
}

async function pushInvoiceToQB(invoice, lineItems) {
  try {
    const config = await getValidQBToken();
    if (!config) return { error: 'QuickBooks not connected' };

    // Get/create QB customer for company
    let qbCustomerId = null;
    if (invoice.company_id) {
      const mapping = await pool.query("SELECT qb_id FROM qb_mappings WHERE entity_type = 'customer' AND crm_id = $1", [invoice.company_id]);
      if (mapping.rows.length) {
        qbCustomerId = mapping.rows[0].qb_id;
      } else {
        // Create customer in QB
        const co = await db.prepare('SELECT name, phone, city, state FROM companies WHERE id = ?').get(invoice.company_id);
        if (co) {
          const created = await qbRequest('POST', '/customer', {
            DisplayName: co.name,
            PrimaryPhone: co.phone ? { FreeFormNumber: co.phone } : undefined,
            BillAddr: (co.city || co.state) ? { City: co.city, CountrySubDivisionCode: co.state } : undefined,
          }, config);
          if (created.Customer) {
            qbCustomerId = created.Customer.Id;
            await pool.query("INSERT INTO qb_mappings (entity_type, crm_id, qb_id) VALUES ('customer', $1, $2) ON CONFLICT (entity_type, crm_id) DO UPDATE SET qb_id = $2, synced_at = CURRENT_TIMESTAMP", [invoice.company_id, qbCustomerId]);
          }
        }
      }
    }

    if (!qbCustomerId) return { error: 'Could not resolve QuickBooks customer' };

    // Build QB invoice lines
    const lines = [];
    if (lineItems && lineItems.length) {
      for (const li of lineItems) {
        lines.push({
          Amount: li.total || (li.quantity * li.unit_price),
          DetailType: 'SalesItemLineDetail',
          Description: li.description,
          SalesItemLineDetail: {
            Qty: li.quantity,
            UnitPrice: li.unit_price,
          },
        });
      }
    } else {
      lines.push({
        Amount: invoice.total || (invoice.amount + (invoice.tax_amount || 0)),
        DetailType: 'SalesItemLineDetail',
        Description: invoice.title || 'Service',
        SalesItemLineDetail: { Qty: 1, UnitPrice: invoice.total || invoice.amount },
      });
    }

    const qbInvoiceBody = {
      CustomerRef: { value: qbCustomerId },
      DocNumber: invoice.invoice_number,
      DueDate: invoice.due_date || undefined,
      Line: lines,
      PrivateNote: invoice.notes || undefined,
    };

    // Check if already synced — if so, update
    const existingMap = await pool.query("SELECT qb_id FROM qb_mappings WHERE entity_type = 'invoice' AND crm_id = $1", [invoice.id]);
    let qbInvoice;
    if (existingMap.rows.length) {
      const existing = await qbRequest('GET', `/invoice/${existingMap.rows[0].qb_id}`, null, config);
      if (existing.Invoice) {
        qbInvoice = await qbRequest('POST', '/invoice', {
          ...qbInvoiceBody,
          Id: existingMap.rows[0].qb_id,
          SyncToken: existing.Invoice.SyncToken,
          sparse: true,
        }, config);
      }
    } else {
      qbInvoice = await qbRequest('POST', '/invoice', qbInvoiceBody, config);
    }

    if (qbInvoice && qbInvoice.Invoice) {
      const qbId = qbInvoice.Invoice.Id;
      await pool.query("INSERT INTO qb_mappings (entity_type, crm_id, qb_id) VALUES ('invoice', $1, $2) ON CONFLICT (entity_type, crm_id) DO UPDATE SET qb_id = $2, synced_at = CURRENT_TIMESTAMP", [invoice.id, qbId]);
      await pool.query("UPDATE invoices SET qb_id = $1, qb_synced_at = CURRENT_TIMESTAMP WHERE id = $2", [qbId, invoice.id]);
      return { success: true, qb_id: qbId };
    }
    return { error: 'QB API error', details: qbInvoice };
  } catch (e) {
    return { error: e.message };
  }
}

// ── GET all invoices ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { company_id, status, job_id } = req.query;
    let sql = `
      SELECT i.*,
        c.name AS company_name,
        co.first_name || ' ' || co.last_name AS contact_name,
        j.title AS job_title,
        e.estimate_number,
        m.qb_id AS qb_mapping_id
      FROM invoices i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN contacts co ON i.contact_id = co.id
      LEFT JOIN jobs j ON i.job_id = j.id
      LEFT JOIN estimates e ON i.estimate_id = e.id
      LEFT JOIN qb_mappings m ON m.entity_type = 'invoice' AND m.crm_id = i.id
    `;
    const params = [];
    const where = [];
    if (company_id) { where.push(`i.company_id = ?`); params.push(parseInt(company_id, 10)); }
    if (status) { where.push(`i.status = ?`); params.push(status); }
    if (job_id) { where.push(`i.job_id = ?`); params.push(parseInt(job_id, 10)); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY i.created_at DESC';
    res.json(await db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single invoice with line items
router.get('/:id', async (req, res) => {
  try {
    const inv = await db.prepare(`
      SELECT i.*,
        c.name AS company_name,
        co.first_name || ' ' || co.last_name AS contact_name, co.email AS contact_email,
        j.title AS job_title,
        e.estimate_number,
        m.qb_id AS qb_mapping_id, m.synced_at AS qb_synced_at_map
      FROM invoices i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN contacts co ON i.contact_id = co.id
      LEFT JOIN jobs j ON i.job_id = j.id
      LEFT JOIN estimates e ON i.estimate_id = e.id
      LEFT JOIN qb_mappings m ON m.entity_type = 'invoice' AND m.crm_id = i.id
      WHERE i.id = ?
    `).get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    // Load line items
    const lineItems = await db.prepare(`
      SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order
    `).all(req.params.id);
    res.json({ ...inv, line_items: lineItems });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create invoice (optionally from a job)
router.post('/', async (req, res) => {
  try {
    const {
      company_id, contact_id, job_id, proposal_id, estimate_id,
      title, invoice_number, amount, tax_amount, notes, due_date,
      line_items, sync_to_qb
    } = req.body;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });

    const existing = await db.prepare('SELECT invoice_number FROM invoices ORDER BY created_at DESC').all();
    const invNumber = invoice_number || nextInvNumber(existing);
    const amt = parseFloat(amount) || 0;
    const tax = parseFloat(tax_amount) || 0;
    const total = amt + tax;

    // If from a job, derive amount from estimate items
    let derivedLineItems = line_items;
    if (job_id && (!derivedLineItems || !derivedLineItems.length)) {
      const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
      if (job && job.estimate_id) {
        const estItems = await db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY sort_order').all(job.estimate_id);
        if (estItems.length) {
          derivedLineItems = estItems.map(ei => ({
            description: ei.description,
            quantity: ei.quantity,
            unit: ei.unit,
            unit_price: ei.unit_price,
            total: ei.total,
          }));
        }
      }
    }

    const result = await db.prepare(`
      INSERT INTO invoices (company_id, contact_id, job_id, proposal_id, estimate_id, title, invoice_number, amount, tax_amount, total, notes, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      company_id, contact_id || null, job_id || null, proposal_id || null, estimate_id || null,
      title || 'Invoice', invNumber, amt, tax, total, notes || null, due_date || null
    );

    const invId = result.lastInsertRowid;

    // Insert line items
    if (derivedLineItems && derivedLineItems.length) {
      for (let i = 0; i < derivedLineItems.length; i++) {
        const li = derivedLineItems[i];
        const liTotal = parseFloat(li.total) || (parseFloat(li.quantity || 1) * parseFloat(li.unit_price || 0));
        await db.prepare(`
          INSERT INTO invoice_line_items (invoice_id, description, quantity, unit, unit_price, total, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(invId, li.description || 'Service', li.quantity || 1, li.unit || 'each', li.unit_price || 0, liTotal, i);
      }
    }

    // Mark job as invoice_created
    if (job_id) {
      await db.prepare('UPDATE jobs SET invoice_created = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(job_id);
    }

    const inv = await db.prepare(`
      SELECT i.*, c.name AS company_name
      FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.id = ?
    `).get(invId);
    const lineItemsOut = await db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order').all(invId);

    // Auto-sync to QB if requested
    let qbResult = null;
    if (sync_to_qb) {
      qbResult = await pushInvoiceToQB(inv, lineItemsOut);
    }

    res.status(201).json({ ...inv, line_items: lineItemsOut, qb: qbResult });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update invoice
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const {
      company_id, contact_id, job_id, estimate_id,
      title, invoice_number, amount, tax_amount, notes, due_date, status,
      line_items, sync_to_qb
    } = req.body;
    const amt = parseFloat(amount) || 0;
    const tax = parseFloat(tax_amount) || 0;
    const total = amt + tax;
    const paidAt = status === 'paid' ? 'CURRENT_TIMESTAMP' : null;

    if (paidAt) {
      await db.prepare(`
        UPDATE invoices SET company_id=?, contact_id=?, job_id=?, estimate_id=?,
          title=?, invoice_number=?, amount=?, tax_amount=?, total=?, notes=?, due_date=?, status=?,
          paid_at=CURRENT_TIMESTAMP WHERE id=?
      `).run(company_id, contact_id||null, job_id||null, estimate_id||null, title||'Invoice', invoice_number, amt, tax, total, notes||null, due_date||null, status||'unpaid', req.params.id);
    } else {
      await db.prepare(`
        UPDATE invoices SET company_id=?, contact_id=?, job_id=?, estimate_id=?,
          title=?, invoice_number=?, amount=?, tax_amount=?, total=?, notes=?, due_date=?, status=?
        WHERE id=?
      `).run(company_id, contact_id||null, job_id||null, estimate_id||null, title||'Invoice', invoice_number, amt, tax, total, notes||null, due_date||null, status||'unpaid', req.params.id);
    }

    // Update line items
    if (line_items !== undefined) {
      await db.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').run(req.params.id);
      for (let i = 0; i < line_items.length; i++) {
        const li = line_items[i];
        const liTotal = parseFloat(li.total) || (parseFloat(li.quantity || 1) * parseFloat(li.unit_price || 0));
        await db.prepare(`
          INSERT INTO invoice_line_items (invoice_id, description, quantity, unit, unit_price, total, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, li.description || 'Service', li.quantity || 1, li.unit || 'each', li.unit_price || 0, liTotal, i);
      }
    }

    const inv = await db.prepare(`
      SELECT i.*, c.name AS company_name
      FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.id = ?
    `).get(req.params.id);
    const lineItemsOut = await db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order').all(req.params.id);

    let qbResult = null;
    if (sync_to_qb) {
      qbResult = await pushInvoiceToQB(inv, lineItemsOut);
    }

    res.json({ ...inv, line_items: lineItemsOut, qb: qbResult });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH mark as paid
router.patch('/:id/paid', async (req, res) => {
  try {
    await db.prepare('UPDATE invoices SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?').run('paid', req.params.id);
    // Sync paid status to QB
    try {
      const config = await getValidQBToken();
      if (config) {
        const mapping = await pool.query("SELECT qb_id FROM qb_mappings WHERE entity_type = 'invoice' AND crm_id = $1", [parseInt(req.params.id)]);
        if (mapping.rows.length) {
          // QB doesn't support marking invoice paid directly — requires a payment
          // For now just log the sync
          await pool.query("INSERT INTO integration_sync_log (integration_key, operation, status, message) VALUES ('quickbooks', 'invoice_paid', 'info', $1)", [`Invoice ${req.params.id} marked paid in CRM`]);
        }
      }
    } catch (_) {}
    const inv = await db.prepare(`
      SELECT i.*, c.name AS company_name
      FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.id = ?
    `).get(req.params.id);
    res.json(inv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST sync invoice to QB
router.post('/:id/sync-qb', async (req, res) => {
  try {
    const inv = await db.prepare(`
      SELECT i.*, c.name AS company_name
      FROM invoices i LEFT JOIN companies c ON i.company_id = c.id WHERE i.id = ?
    `).get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const lineItems = await db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order').all(req.params.id);
    const result = await pushInvoiceToQB(inv, lineItems);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET QB sync status for all invoices (poll QB for payments)
router.get('/qb-sync/status', async (req, res) => {
  try {
    const config = await getValidQBToken();
    if (!config) return res.json({ connected: false });

    // Get unpaid invoices with QB mappings
    const rows = await pool.query(`
      SELECT i.id, i.invoice_number, i.status, i.total, m.qb_id
      FROM invoices i
      JOIN qb_mappings m ON m.entity_type = 'invoice' AND m.crm_id = i.id
      WHERE i.status = 'unpaid'
      ORDER BY i.created_at DESC
      LIMIT 20
    `);

    const updates = [];
    for (const inv of rows.rows) {
      try {
        const qbInv = await qbRequest('GET', `/invoice/${inv.qb_id}`, null, config);
        if (qbInv.Invoice && qbInv.Invoice.Balance === 0) {
          // Paid in QB — mark paid in CRM
          await pool.query("UPDATE invoices SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = $1", [inv.id]);
          updates.push({ id: inv.id, invoice_number: inv.invoice_number, status: 'paid', synced: true });
        }
      } catch (_) {}
    }
    res.json({ connected: true, updates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE invoice
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
