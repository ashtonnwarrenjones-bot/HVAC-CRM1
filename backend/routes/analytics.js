const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Technician scorecard
router.get('/tech-scorecard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await pool.query(`
      SELECT
        j.technician,
        COUNT(j.id) AS total_jobs,
        COUNT(j.id) FILTER (WHERE j.status = 'completed') AS completed_jobs,
        COALESCE(SUM(i.total), 0) AS total_revenue,
        CASE WHEN COUNT(j.id) FILTER (WHERE j.status = 'completed') > 0
             THEN COALESCE(SUM(i.total), 0) / COUNT(j.id) FILTER (WHERE j.status = 'completed')
             ELSE 0 END AS avg_ticket
      FROM jobs j
      LEFT JOIN invoices i ON i.job_id = j.id AND i.status = 'paid'
      WHERE j.technician IS NOT NULL AND j.technician <> ''
        AND j.scheduled_date >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY j.technician
      ORDER BY total_revenue DESC
    `, [parseInt(days)]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lead source analytics
router.get('/lead-sources', async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const result = await pool.query(`
      SELECT
        COALESCE(c.lead_source, 'Unknown') AS source,
        COUNT(DISTINCT c.id) AS company_count,
        COUNT(j.id) AS job_count,
        COALESCE(SUM(i.total), 0) AS revenue
      FROM companies c
      LEFT JOIN jobs j ON j.company_id = c.id
        AND j.scheduled_date >= CURRENT_DATE - INTERVAL '1 day' * $1
      LEFT JOIN invoices i ON i.company_id = c.id AND i.status = 'paid'
      GROUP BY COALESCE(c.lead_source, 'Unknown')
      ORDER BY revenue DESC
    `, [parseInt(days)]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revenue summary (monthly)
router.get('/revenue', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
        COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) AS paid_revenue,
        COALESCE(SUM(total) FILTER (WHERE status = 'unpaid'), 0) AS outstanding
      FROM invoices
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
