const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Helper functions
async function getConfig(type) {
  const result = await pool.query(
    'SELECT config FROM integration_configs WHERE type = $1',
    [type]
  );
  return result.rows[0]?.config || {};
}

async function saveConfig(type, config) {
  await pool.query(
    `INSERT INTO integration_configs (type, config) VALUES ($1, $2)
     ON CONFLICT (type) DO UPDATE SET config = $2, updated_at = NOW()`,
    [type, JSON.stringify(config)]
  );
}

async function addLog(type, action, status, details = '') {
  await pool.query(
    `INSERT INTO integration_logs (type, action, status, details) VALUES ($1, $2, $3, $4)`,
    [type, action, status, details]
  );
}

// GET /api/integrations/settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM integration_configs');
    const settings = {};
    for (const row of result.rows) {
      settings[row.type] = row.config;
    }
    res.json(settings);
  } catch (err) {
    console.error('Error fetching integration settings:', err);
    res.status(500).json({ error: 'Failed to fetch integration settings' });
  }
});

// GET /api/integrations/log
router.get('/log', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM integration_logs ORDER BY created_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching integration log:', err);
    res.status(500).json({ error: 'Failed to fetch integration log' });
  }
});

module.exports = router;
