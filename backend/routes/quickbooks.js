'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database');

// ─── Constants ──────────────────────────────────────────────────────────────
const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QBO_SCOPES = 'com.intuit.quickbooks.accounting';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getConfig() {
  const row = await db.prepare("SELECT config_json, enabled FROM integration_settings WHERE integration_key = 'quickbooks'").get();
  if (!row) return null;
  try { return { ...JSON.parse(row.config_json || '{}'), enabled: row.enabled }; } catch { return null; }
}

async function saveConfig(config, enabled) {
  await db.prepare(`
    INSERT INTO integration_settings (integration_key, config_json, enabled, updated_at)
    VALUES ('quickbooks', ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (integration_key) DO UPDATE
    SET config_json = EXCLUDED.config_json, enabled = EXCLUDED.enabled, updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(config), enabled ? true : false);
}

async function addLog(operation, status, message, details = null) {
  await db.prepare(
    "INSERT INTO integration_sync_log (integration_key, operation, status, message, details_json) VALUES ('quickbooks', ?, ?, ?, ?)"
  ).run(operation, status, message, details ? JSON.stringify(details) : null);
}

async function refreshQBToken(config) {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: config.refresh_token });
  const resp = await axios.post(QBO_TOKEN_URL, params.toString(), {
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
  });
  const updated = { ...config, access_token: resp.data.access_token, refresh_token: resp.data.refresh_token, token_expires_at: Date.now() + (resp.data.expires_in * 1000) };
  await saveConfig(updated, true);
  return updated;
}

async function getValidToken() {
  let config = await getConfig();
  if (!config || !config.access_token) throw new Error('QuickBooks not connected');
  if (config.token_expires_at && Date.now() > config.token_expires_at - 120000) {
    config = await refreshQBToken(config);
  }
  return config;
}

async function qbRequest(method, path, data = null) {
  const config = await getValidToken();
  const url = `${QBO_API_BASE}/${config.realm_id}/${path}`;
  const resp = await axios({ method, url, headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, params: { minorversion: 65 }, data });
  return resp.data;
}

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

// GET /api/quickbooks/auth-url  (authenticated)
router.get('/auth-url', async (req, res) => {
  try {
    const clientId = process.env.QB_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'QB_CLIENT_ID not configured. Add it to Render environment variables.' });
    const redirectUri = process.env.QB_REDIRECT_URI || `https://circuitcrm.onrender.com/api/quickbooks/callback`;
    const state = Math.random().toString(36).substring(2, 15);
    const params = new URLSearchParams({ client_id: clientId, scope: QBO_SCOPES, redirect_uri: redirectUri, response_type: 'code', state });
    res.json({ url: `${QBO_AUTH_URL}?${params}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/quickbooks/callback  (PUBLIC — called by Intuit after OAuth)
router.get('/callback', async (req, res) => {
  try {
    const { code, realmId } = req.query;
    if (!code || !realmId) return res.redirect('/#/integrations?qb=error&reason=missing_params');
    const clientId = process.env.QB_CLIENT_ID;
    const clientSecret = process.env.QB_CLIENT_SECRET;
    const redirectUri = process.env.QB_REDIRECT_URI || `https://circuitcrm.onrender.com/api/quickbooks/callback`;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    const tokenResp = await axios.post(QBO_TOKEN_URL, params.toString(), {
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
    });
    const config = { realm_id: realmId, access_token: tokenResp.data.access_token, refresh_token: tokenResp.data.refresh_token, token_expires_at: Date.now() + (tokenResp.data.expires_in * 1000) };
    await saveConfig(config, true);
    await addLog('oauth_connected', 'success', `Connected to QB company realm ${realmId}`);
    res.redirect('/#/integrations?qb=connected');
  } catch (err) {
    await addLog('oauth_error', 'error', err.message);
    res.redirect(`/#/integrations?qb=error&reason=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/quickbooks/status  (authenticated)
router.get('/status', async (req, res) => {
  try {
    const config = await getConfig();
    if (!config || !config.access_token) return res.json({ connected: false });
    res.json({ connected: true, enabled: config.enabled, realm_id: config.realm_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quickbooks/disconnect
router.post('/disconnect', async (req, res) => {
  try {
    await saveConfig({}, false);
    await addLog('disconnected', 'info', 'QuickBooks disconnected');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Customer Sync ────────────────────────────────────────────────────────────

// POST /api/quickbooks/sync/customer/:companyId
router.post('/sync/customer/:companyId', async (req, res) => {
  try {
    const company = await db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const mapping = await db.prepare("SELECT * FROM qb_mappings WHERE entity_type = 'customer' AND crm_id = ?").get(company.id);
    const customerData = {
      DisplayName: company.name,
      CompanyName: company.name,
      BillAddr: { Line1: company.address || '', City: company.city || '', CountrySubDivisionCode: company.state || 'UT', PostalCode: company.zip || '' },
      ...(company.phone && { PrimaryPhone: { FreeFormNumber: company.phone } }),
      ...(company.website && { WebAddr: { URI: company.website } })
    };
    let result;
    if (mapping) {
      const existing = await qbRequest('get', `customer/${mapping.qb_id}`);
      result = await qbRequest('post', 'customer', { Customer: { ...customerData, Id: mapping.qb_id, SyncToken: existing.Customer.SyncToken, sparse: true } });
      await addLog('customer_updated', 'success', `Updated QB customer for ${company.name}`, { companyId: company.id, qbId: mapping.qb_id });
    } else {
      result = await qbRequest('post', 'customer', { Customer: customerData });
      const qbId = result.Customer.Id;
      await db.prepare("INSERT INTO qb_mappings (entity_type, crm_id, qb_id) VALUES ('customer', ?, ?)").run(company.id, qbId);
      await addLog('customer_created', 'success', `Created QB customer for ${company.name}`, { companyId: company.id, qbId });
    }
    res.json({ ok: true, customer: result.Customer });
  } catch (err) {
    await addLog('customer_sync_error', 'error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quickbooks/sync/all-customers
router.post('/sync/all-customers', async (req, res) => {
  try {
    const companies = await db.prepare('SELECT * FROM companies ORDER BY name').all();
    const results = [];
    for (const company of companies) {
      try {
        const mapping = await db.prepare("SELECT * FROM qb_mappings WHERE entity_type = 'customer' AND crm_id = ?").get(company.id);
        const customerData = { DisplayName: company.name, CompanyName: company.name, BillAddr: { Line1: company.address || '', City: company.city || '', CountrySubDivisionCode: company.state || 'UT', PostalCode: company.zip || '' } };
        if (mapping) {
          const existing = await qbRequest('get', `customer/${mapping.qb_id}`);
          await qbRequest('post', 'customer', { Customer: { ...customerData, Id: mapping.qb_id, SyncToken: existing.Customer.SyncToken, sparse: true } });
          results.push({ id: company.id, name: company.name, action: 'updated' });
        } else {
          const result = await qbRequest('post', 'customer', { Customer: customerData });
          await db.prepare("INSERT INTO qb_mappings (entity_type, crm_id, qb_id) VALUES ('customer', ?, ?)").run(company.id, result.Customer.Id);
          results.push({ id: company.id, name: company.name, action: 'created', qbId: result.Customer.Id });
        }
      } catch (e) { results.push({ id: company.id, name: company.name, action: 'error', error: e.message }); }
    }
    await addLog('bulk_customer_sync', 'success', `Synced ${results.length} companies to QB`, { results });
    res.json({ ok: true, results });
  } catch (err) {
    await addLog('bulk_customer_sync_error', 'error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Invoice Sync ─────────────────────────────────────────────────────────────

// POST /api/quickbooks/sync/invoice/:dealId
router.post('/sync/invoice/:dealId', async (req, res) => {
  try {
    const deal = await db.prepare('SELECT d.*, c.name as company_name FROM deals d LEFT JOIN companies c ON d.company_id = c.id WHERE d.id = ?').get(req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    // Ensure QB customer exists for this company
    let custMap = await db.prepare("SELECT * FROM qb_mappings WHERE entity_type = 'customer' AND crm_id = ?").get(deal.company_id);
    if (!custMap) {
      const company = await db.prepare('SELECT * FROM companies WHERE id = ?').get(deal.company_id);
      const r = await qbRequest('post', 'customer', { Customer: { DisplayName: company.name, CompanyName: company.name } });
      await db.prepare("INSERT INTO qb_mappings (entity_type, crm_id, qb_id) VALUES ('customer', ?, ?)").run(deal.company_id, r.Customer.Id);
      custMap = { qb_id: r.Customer.Id };
    }

    const invoiceData = {
      CustomerRef: { value: custMap.qb_id },
      DocNumber: `CRM-${deal.id}`,
      Line: [{ Amount: deal.value || 0, DetailType: 'SalesItemLineDetail', Description: `${deal.title} — ${deal.service_type || 'Facility Services'}`, SalesItemLineDetail: { ItemRef: { value: '1', name: 'Services' }, Qty: 1, UnitPrice: deal.value || 0 } }],
      PrivateNote: deal.notes || ''
    };

    const existing = await db.prepare("SELECT * FROM qb_mappings WHERE entity_type = 'invoice' AND crm_id = ?").get(deal.id);
    let result;
    if (existing) {
      const qbInv = await qbRequest('get', `invoice/${existing.qb_id}`);
      result = await qbRequest('post', 'invoice', { Invoice: { ...invoiceData, Id: existing.qb_id, SyncToken: qbInv.Invoice.SyncToken } });
      await addLog('invoice_updated', 'success', `Updated QB invoice for deal #${deal.id}`);
    } else {
      result = await qbRequest('post', 'invoice', { Invoice: invoiceData });
      const qbId = result.Invoice.Id;
      await db.prepare("INSERT INTO qb_mappings (entity_type, crm_id, qb_id) VALUES ('invoice', ?, ?)").run(deal.id, qbId);
      await addLog('invoice_created', 'success', `Created QB invoice for deal #${deal.id}`, { dealId: deal.id, qbId });
    }
    res.json({ ok: true, invoice: result.Invoice });
  } catch (err) {
    await addLog('invoice_sync_error', 'error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quickbooks/invoice/:dealId
router.get('/invoice/:dealId', async (req, res) => {
  try {
    const mapping = await db.prepare("SELECT * FROM qb_mappings WHERE entity_type = 'invoice' AND crm_id = ?").get(req.params.dealId);
    if (!mapping) return res.json({ exists: false });
    const qbInv = await qbRequest('get', `invoice/${mapping.qb_id}`);
    res.json({ exists: true, invoice: qbInv.Invoice, qbId: mapping.qb_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Webhook (payment updates from QB) ───────────────────────────────────────

// POST /api/quickbooks/webhook  (PUBLIC — called by Intuit)
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const entities = payload.eventNotifications?.[0]?.dataChangeEvent?.entities || [];
    for (const entity of entities) {
      await addLog('webhook_event', 'info', `QB ${entity.name} ${entity.operation} id=${entity.id}`, entity);
      if (entity.name === 'Invoice' && entity.operation === 'Update') {
        const mapping = await db.prepare("SELECT * FROM qb_mappings WHERE entity_type = 'invoice' AND qb_id = ?").get(String(entity.id));
        if (mapping) {
          try {
            const qbInv = await qbRequest('get', `invoice/${entity.id}`);
            const balance = qbInv.Invoice?.Balance;
            if (balance === 0) {
              await db.prepare("UPDATE deals SET stage = 'Paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(mapping.crm_id);
              await addLog('payment_received', 'success', `Deal #${mapping.crm_id} marked Paid via QB webhook`, { qbId: entity.id });
            }
          } catch (e) { /* non-fatal */ }
        }
      }
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Mappings lookup ──────────────────────────────────────────────────────────

router.get('/mappings', async (req, res) => {
  try {
    const mappings = await db.prepare('SELECT * FROM qb_mappings ORDER BY entity_type, crm_id').all();
    res.json(mappings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.callbackHandler = router;
