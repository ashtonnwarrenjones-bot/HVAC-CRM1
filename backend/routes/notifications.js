const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all notifications (most recent first)
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
    ).all();
    const unread = rows.filter(r => !r.read_at).length;
    res.json({ notifications: rows, unread });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT mark one as read
router.put('/:id/read', async (req, res) => {
  try {
    await db.prepare('UPDATE notifications SET read_at = NOW() WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT mark all as read
router.put('/read-all', async (req, res) => {
  try {
    await db.prepare('UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL').run();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE one notification
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
