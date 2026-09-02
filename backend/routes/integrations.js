'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../database');
const ce      = require('../services/computerease');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getConfig(key) {
  const row = await db.prepare('SELECT config_json, enabled FROM integration_settings WHERE integration_key = ?').get(key);
  if (!row) return null;
  try { return { ...JSON.parse(row.config_json || '{}'), enabled: row.enabled }; } catch { return null; }
}

async function saveConfig(key, config, enabled) {
  // Mask password before logging; keep it in DB
  await db.prepare(`
    INSERT INTO integration_settings (integration_key, config_json, enabled, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (integration_key) DO UPDATE
      SET config_json = EXCLUDED.config_json,
          enabled     = EXCLUDED.enabled,
          updated_at  = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(config), enabled ? true : false);
}

async function addLog(key, operation, status, message, details = null) {
  await db.prepare(
    'INSERT INTO integration_sync_log (integration_key, operation, status, message, details_json) VALUES (?, ?, ?, ?, ?)'
  ).run(key, operation, status, message, details ? JSON.stringify(details) : null);
}

// ─── GET /api/integrations/settings ──────────────────────────────────────────
// Returns all integration configs with passwords masked
router.get('/settings', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT integration_key, config_json, enabled, updated_at FROM integration_settings').all();
    const result = {};
    for (const row of rows) {
      try {
        const cfg = JSON.parse(row.config_json || '{}');
        if (cfg.password) cfg.password = '••••••••';
        result[row.integration_key] = { ...cfg, enabled: row.enabled, updated_at: row.updated_at };
      } catch { result[row.integration_key] = { enabled: row.enabled }; }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/integrations/computerease/config ───────────────────────────────
// Save CE connection config. Password '••••••••' means keep existing.
router.post('/computerease/config', async (req, res) => {
  try {
    const { server, port, database, username, password, enabled,
            laborCostCode, materialCostCode, defaultLaborRate,
            tableMap } = req.body;

    let existing = await getConfig('computerease');
    const storedPw = existing?.password;

    const config = {
      server:            server            || existing?.server            || '',
      port:              port              || existing?.port              || 1433,
      database:          database          || existing?.database          || '',
      username:          username          || existing?.username          || '',
      password:          (password && password !== '••••••••') ? password : (storedPw || ''),
      laborCostCode:     laborCostCode     || existing?.laborCostCode     || '001',
      materialCostCode:  materialCostCode  || existing?.materialCostCode  || '002',
      defaultLaborRate:  defaultLaborRate  || existing?.defaultLaborRate  || 0,
      tableMap:          tableMap          || existing?.tableMap          || {},
    };

    await saveConfig('computerease', config, enabled);
    await addLog('computerease', 'config_saved', 'info', 'Connection settings updated');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/integrations/computerease/test ─────────────────────────────────
// Test live connection to CE SQL Server
router.post('/computerease/test', async (req, res) => {
  try {
    const config = await getConfig('computerease');
    if (!config || !config.server) return res.status(400).json({ error: 'No CE config saved yet' });

    const result = await ce.testConnection(config);

    await addLog('computerease', 'connection_test', result.ok ? 'success' : 'error',
      result.ok ? `Connected — ${result.version}` : result.error,
      result.ok ? { tables: result.tables } : null
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/integrations/computerease/describe-table ───────────────────────
// Returns columns of a specific CE table (for schema mapping)
router.post('/computerease/describe-table', async (req, res) => {
  try {
    const config = await getConfig('computerease');
    if (!config) return res.status(400).json({ error: 'No CE config saved' });
    const result = await ce.describeTable(config, req.body.table);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/integrations/computerease/jobs ─────────────────────────────────
// Fetch recent CE jobs for job-number matching UI
router.get('/computerease/jobs', async (req, res) => {
  try {
    const config = await getConfig('computerease');
    if (!config) return res.status(400).json({ error: 'No CE config saved' });
    const result = await ce.fetchCEJobs(config, config.tableMap || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/integrations/computerease/pos/:ceJobNumber ─────────────────────
// Fetch P.O.s for a given CE job number
router.get('/computerease/pos/:ceJobNumber', async (req, res) => {
  try {
    const config = await getConfig('computerease');
    if (!config) return res.status(400).json({ error: 'No CE config saved' });
    const result = await ce.fetchJobPOs(config, req.params.ceJobNumber, config.tableMap || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/integrations/computerease/push-costs/:jobId ───────────────────
// Push a completed CRM job's time + parts into CE job cost ledger
router.post('/computerease/push-costs/:jobId', async (req, res) => {
  try {
    const config = await getConfig('computerease');
    if (!config || !config.enabled) return res.status(400).json({ error: 'ComputerEase integration not enabled' });

    const jobId = parseInt(req.params.jobId);
    const job   = await db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job)            return res.status(404).json({ error: 'Job not found' });
    if (!job.ce_job_number) return res.status(400).json({ error: 'No CE job number assigned to this job' });

    const timeEntries = await db.prepare('SELECT * FROM job_time_entries WHERE job_id = ?').all(jobId);
    const parts       = await db.prepare('SELECT * FROM job_parts       WHERE job_id = ?').all(jobId);

    const result = await ce.pushJobCosts(config, job.ce_job_number, timeEntries, parts, config.tableMap || {});

    if (result.ok) {
      await db.prepare('UPDATE jobs SET ce_synced_at = CURRENT_TIMESTAMP WHERE id = ?').run(jobId);
      await addLog('computerease', 'push_costs', 'success',
        `Pushed ${result.inserted} cost entries for CE job ${job.ce_job_number} (CRM job #${jobId})`,
        { jobId, ceJobNumber: job.ce_job_number, inserted: result.inserted }
      );
    } else {
      await addLog('computerease', 'push_costs', 'error',
        `Failed to push costs for job #${jobId}: ${result.error}`
      );
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/integrations/jobs/:jobId/ce-number ───────────────────────────
// Manually assign or update the CE job number on a CRM job
router.patch('/jobs/:jobId/ce-number', async (req, res) => {
  try {
    const { ce_job_number } = req.body;
    await db.prepare('UPDATE jobs SET ce_job_number = ? WHERE id = ?').run(ce_job_number, req.params.jobId);
    await addLog('computerease', 'ce_number_assigned', 'info',
      `CE job number ${ce_job_number} assigned to CRM job #${req.params.jobId}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/integrations/log ────────────────────────────────────────────────
// Return recent sync log entries
router.get('/log', async (req, res) => {
  try {
    const key   = req.query.key || null;
    const limit = parseInt(req.query.limit) || 50;
    let rows;
    if (key) {
      rows = await db.prepare(
        'SELECT * FROM integration_sync_log WHERE integration_key = ? ORDER BY created_at DESC LIMIT ?'
      ).all(key, limit);
    } else {
      rows = await db.prepare(
        'SELECT * FROM integration_sync_log ORDER BY created_at DESC LIMIT ?'
      ).all(limit);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
