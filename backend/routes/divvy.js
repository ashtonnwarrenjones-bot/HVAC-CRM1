'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database');

// Divvy / BILL Spend & Expense API
// Docs: https://app.divvy.co/assets/divvy-public-api.html
const DIVVY_API_BASE = 'https://app.divvy.co/public_api/v2';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getConfig() {
  const row = await db.prepare("SELECT config_json, enabled FROM integration_settings WHERE integration_key = 'divvy'").get();
  if (!row) return null;
  try { return { ...JSON.parse(row.config_json || '{}'), enabled: row.enabled }; } catch { return null; }
}

async function saveConfig(config, enabled) {
  await db.prepare(`
    INSERT INTO integration_settings (integration_key, config_json, enabled, updated_at)
    VALUES ('divvy', ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (integration_key) DO UPDATE
    SET config_json = EXCLUDED.config_json, enabled = EXCLUDED.enabled, updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(config), enabled ? true : false);
}

async function addLog(operation, status, message, details = null) {
  await db.prepare(
    "INSERT INTO integration_sync_log (integration_key, operation, status, message, details_json) VALUES ('divvy', ?, ?, ?, ?)"
  ).run(operation, status, message, details ? JSON.stringify(details) : null);
}

async function divvyRequest(method, path, data = null) {
  const config = await getConfig();
  if (!config || !config.api_key) throw new Error('Divvy not connected. Save an API key first.');
  const resp = await axios({
    method,
    url: `${DIVVY_API_BASE}${path}`,
    headers: { Authorization: `Basic ${config.api_key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    data
  });
  return resp.data;
}

// ─── Config & Connection ──────────────────────────────────────────────────────

// POST /api/divvy/config
router.post('/config', async (req, res) => {
  try {
    const { api_key, enabled } = req.body;
    const existing = await getConfig();
    const config = {
      api_key: (api_key && api_key !== '••••••••') ? api_key : (existing?.api_key || '')
    };
    await saveConfig(config, enabled !== false);
    await addLog('config_saved', 'info', 'Divvy API key updated');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/divvy/status
router.get('/status', async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ connected: !!(config && config.api_key && config.enabled) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/divvy/test
router.post('/test', async (req, res) => {
  try {
    const result = await divvyRequest('get', '/transactions?limit=1');
    await addLog('connection_test', 'success', 'Divvy API connection successful');
    res.json({ ok: true, message: 'Connected to Divvy successfully' });
  } catch (err) {
    await addLog('connection_test', 'error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

// GET /api/divvy/transactions
// Fetch live transactions from Divvy API with optional filters
router.get('/transactions', async (req, res) => {
  try {
    const { limit = 100, from_date, to_date } = req.query;
    const params = new URLSearchParams({ limit: String(limit) });
    if (from_date) params.set('start', from_date);
    if (to_date) params.set('end', to_date);

    const result = await divvyRequest('get', `/transactions?${params}`);
    const rawTx = result.transactions || result.data || [];

    // Get already-tagged IDs so UI knows which are assigned
    const taggedRows = await db.prepare('SELECT external_id, deal_id FROM deal_expenses WHERE source = ?').all('divvy');
    const tagMap = {};
    taggedRows.forEach(r => { tagMap[r.external_id] = r.deal_id; });

    const transactions = rawTx.map(t => ({
      id: t.id,
      amount: t.amount,
      merchant_name: t.merchant_name || t.merchant,
      category: t.category_name || t.category,
      date: t.transaction_date || t.date,
      card_last4: t.card_last4 || t.last4,
      cardholder: t.cardholder_name || t.name,
      status: t.status,
      deal_id: tagMap[String(t.id)] || null,
      tagged: !!tagMap[String(t.id)]
    }));

    res.json(transactions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/divvy/transactions/deal/:dealId
// All tagged transactions for a specific deal
router.get('/transactions/deal/:dealId', async (req, res) => {
  try {
    const rows = await db.prepare(
      'SELECT * FROM deal_expenses WHERE deal_id = ? AND source = ? ORDER BY transaction_date DESC'
    ).all(req.params.dealId, 'divvy');
    const total = rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    res.json({ expenses: rows, total_spend: total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Tagging ──────────────────────────────────────────────────────────────────

// POST /api/divvy/tag
// Assign a Divvy transaction to a CRM deal
router.post('/tag', async (req, res) => {
  try {
    const { deal_id, transaction_id, amount, description, category, merchant, transaction_date } = req.body;
    if (!deal_id || !transaction_id) return res.status(400).json({ error: 'deal_id and transaction_id are required' });

    const deal = await db.prepare('SELECT id, title, budget FROM deals WHERE id = ?').get(deal_id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    await db.prepare(`
      INSERT INTO deal_expenses (deal_id, source, external_id, amount, description, category, merchant, transaction_date)
      VALUES (?, 'divvy', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (source, external_id) DO UPDATE SET
        deal_id = EXCLUDED.deal_id,
        amount = EXCLUDED.amount,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        merchant = EXCLUDED.merchant,
        transaction_date = EXCLUDED.transaction_date,
        synced_at = CURRENT_TIMESTAMP
    `).run(deal_id, String(transaction_id), amount, description || '', category || '', merchant || '', transaction_date || null);

    // Check budget alert
    const expenses = await db.prepare('SELECT amount FROM deal_expenses WHERE deal_id = ? AND source = ?').all(deal_id, 'divvy');
    const totalSpend = expenses.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    let budgetWarning = null;
    if (deal.budget && totalSpend >= deal.budget * 0.9) {
      budgetWarning = `Warning: ${Math.round((totalSpend / deal.budget) * 100)}% of budget spent on "${deal.title}"`;
    }

    await addLog('transaction_tagged', 'success', `Transaction ${transaction_id} tagged to deal #${deal_id}`, { deal_id, transaction_id, amount });
    res.json({ ok: true, total_spend: totalSpend, budget_warning: budgetWarning });
  } catch (err) {
    await addLog('tag_error', 'error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/divvy/tag/:transactionId
router.delete('/tag/:transactionId', async (req, res) => {
  try {
    await db.prepare("DELETE FROM deal_expenses WHERE source = 'divvy' AND external_id = ?").run(req.params.transactionId);
    await addLog('transaction_untagged', 'info', `Transaction ${req.params.transactionId} untagged`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Budget ───────────────────────────────────────────────────────────────────

// GET /api/divvy/summary/:dealId
router.get('/summary/:dealId', async (req, res) => {
  try {
    const deal = await db.prepare('SELECT id, title, value, budget FROM deals WHERE id = ?').get(req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const expenses = await db.prepare('SELECT * FROM deal_expenses WHERE deal_id = ? ORDER BY transaction_date DESC').all(req.params.dealId);
    const totalSpend = expenses.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const remaining = deal.budget != null ? deal.budget - totalSpend : null;
    const pct = deal.budget ? Math.round((totalSpend / deal.budget) * 100) : null;
    res.json({
      deal_id: deal.id, title: deal.title,
      contract_value: deal.value, budget: deal.budget,
      total_spend: totalSpend, remaining_budget: remaining,
      budget_pct: pct,
      over_budget: deal.budget != null && totalSpend > deal.budget,
      expenses
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/divvy/budget/:dealId
router.patch('/budget/:dealId', async (req, res) => {
  try {
    const { budget } = req.body;
    await db.prepare('UPDATE deals SET budget = ? WHERE id = ?').run(parseFloat(budget) || null, req.params.dealId);
    await addLog('budget_set', 'info', `Budget set to ${budget} for deal #${req.params.dealId}`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/divvy/budgets
// All deals with budget info — for dashboard widget
router.get('/budgets', async (req, res) => {
  try {
    const deals = await db.prepare(`
      SELECT d.id, d.title, d.value, d.budget, d.stage,
             COALESCE(SUM(e.amount), 0) as total_spend
      FROM deals d
      LEFT JOIN deal_expenses e ON e.deal_id = d.id
      WHERE d.budget IS NOT NULL
      GROUP BY d.id
      ORDER BY d.updated_at DESC
    `).all();
    res.json(deals.map(d => ({
      ...d,
      budget_pct: d.budget ? Math.round((d.total_spend / d.budget) * 100) : 0,
      over_budget: d.total_spend > d.budget
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
