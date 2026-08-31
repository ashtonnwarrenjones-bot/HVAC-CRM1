const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const UPLOAD_DIR = path.join(__dirname, '../uploads/attachments');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// GET /api/attachments?company_id=&proposal_id=
router.get('/', async (req, res) => {
  try {
    const { company_id, proposal_id } = req.query;
    let sql = 'SELECT id, company_id, proposal_id, filename, original_name, mimetype, size, uploaded_at FROM attachments WHERE 1=1';
    const params = [];
    if (company_id) {
      sql += ` AND company_id = $${params.length+1}`;
      params.push(company_id);
    }
    if (proposal_id) {
      sql += ` AND proposal_id = $${params.length+1}`;
      params.push(proposal_id);
    }
    sql += ' ORDER BY uploaded_at DESC';
    const { rows } = await db.pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/attachments — multipart form with file + optional company_id / proposal_id
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { company_id, proposal_id } = req.body;
    const result = await db.prepare(`
      INSERT INTO attachments (company_id, proposal_id, filename, original_name, mimetype, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      company_id ? parseInt(company_id, 10) : null,
      proposal_id ? parseInt(proposal_id, 10) : null,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size
    );
    const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(att);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attachments/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!att) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOAD_DIR, att.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing from disk' });
    res.download(filePath, att.original_name);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', async (req, res) => {
  try {
    const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!att) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOAD_DIR, att.filename);
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    await db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
