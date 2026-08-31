const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/tasks  — optionally filter by ?company_id=&completed=0
router.get('/', async (req, res) => {
  try {
    const { company_id, completed } = req.query;
    let sql = `
      SELECT t.*, co.name AS company_name
      FROM tasks t
      LEFT JOIN companies co ON t.company_id = co.id
      WHERE 1=1
    `;
    const params = [];
    if (company_id) {
      sql += ` AND t.company_id = $${params.length+1}`;
      params.push(company_id);
    }
    if (completed !== undefined) {
      sql += ` AND t.completed = $${params.length+1}`;
      params.push(parseInt(completed, 10));
    }
    sql += ' ORDER BY t.completed ASC, t.due_date ASC, t.created_at DESC';
    const { rows } = await db.pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { company_id, deal_id, contact_id, title, notes, due_date, assigned_to, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const result = await db.prepare(`
      INSERT INTO tasks (company_id, deal_id, contact_id, title, notes, due_date, assigned_to, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(company_id || null, deal_id || null, contact_id || null, title, notes || null,
      due_date || null, assigned_to || null, priority || 'normal');
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, notes, due_date, assigned_to, priority, completed } = req.body;
    const completedAt = completed ? new Date().toISOString() : null;
    await db.prepare(`
      UPDATE tasks SET
        title = ?, notes = ?, due_date = ?, assigned_to = ?, priority = ?,
        completed = ?, completed_at = ?
      WHERE id = ?
    `).run(title, notes || null, due_date || null, assigned_to || null,
      priority || 'normal', completed ? 1 : 0, completedAt, req.params.id);
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
