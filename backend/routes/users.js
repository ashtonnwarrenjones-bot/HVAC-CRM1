const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');

// GET all users
router.get('/', async (req, res) => {
  const users = await db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

// POST create user
router.post('/', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const existing = await db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  if (existing) return res.status(400).json({ error: 'Username already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role || 'technician');
  res.json({ id: info.lastInsertRowid, username, role: role || 'technician' });
});

// DELETE user
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
