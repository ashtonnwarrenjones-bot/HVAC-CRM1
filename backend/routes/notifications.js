const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all notifications (most recent first)
router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
  ).all();
  const unread = rows.filter(r => !r.read_at).length;
  res.json({ notifications: rows, unread });
});

// PUT mark one as read
router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT mark all as read
router.put('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL').run();
  res.json({ ok: true });
});

// DELETE one notification
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
