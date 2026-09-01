const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/tasks  — optionally filter by ?company_id=&completed=0
router.get('/', async (req, res) => {
  const { company_id, completed } = req.query;
  let sql = `
    SELECT t.*, co.name AS company_name
    FROM tasks t
    LEFT JOIN companies co ON t.company_id = co.id
    WHERE 1=1
  `;
  const params = [];
  if (company_id) { sql += ' AND t.company_id = ?'; params.push(company_id); }
  if (completed !== undefined) { sql += ' AND t.completed = ?'; params.push(parseInt(completed, 10)); }
  sql += ' ORDER BY t.completed ASC, t.due_date ASC, t.created_at DESC';
  res.json(await db.prepare(sql).all(...params));
});

// POST /api/tasks
router.post('/', async (req, res) => {
  const { company_id, deal_id, contact_id, title, notes, due_date, assigned_to, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const result = await db.prepare(`
    INSERT INTO tasks (company_id, deal_id, contact_id, title, notes, due_date, assigned_to, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(company_id || null, deal_id || null, contact_id || null, title, notes || null,
    due_date || null, assigned_to || null, priority || 'normal');
  res.status(201).json(await db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  const { title, notes, due_date, assigned_to, priority, completed } = req.body;
  const completedAt = completed ? new Date().toISOString() : null;
  await db.prepare(`
    UPDATE tasks SET
      title = ?, notes = ?, due_date = ?, assigned_to = ?, priority = ?,
      completed = ?, completed_at = ?
    WHERE id = ?
  `).run(title, notes || null, due_date || null, assigned_to || null,
    priority || 'normal', completed ? 1 : 0, completedAt, req.params.id);
  res.json(await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
