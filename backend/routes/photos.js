const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { isConfigured, uploadToSharePoint, getDownloadUrl, deleteFromSharePoint } = require('../services/sharepoint');

// ── Local upload directory (fallback when SharePoint not configured) ──
const UPLOAD_DIR = path.join(__dirname, '../uploads/photos');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer (always buffers to memory first; we decide where to write after) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (videos can be large)
});

// ── Ensure job_photos table exists ──
db.prepare(`
  CREATE TABLE IF NOT EXISTS job_photos (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id                INTEGER NOT NULL,
    company_id            INTEGER,
    filename              TEXT,
    original_name         TEXT NOT NULL,
    mimetype              TEXT,
    size                  INTEGER,
    storage               TEXT NOT NULL DEFAULT 'local',
    sharepoint_item_id    TEXT,
    sharepoint_web_url    TEXT,
    sharepoint_dl_url     TEXT,
    uploaded_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_by           TEXT
  )
`).run();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/photos/jobs/:jobId — upload a photo/video for a job
// ─────────────────────────────────────────────────────────────────────────────
router.post('/jobs/:jobId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const jobId = parseInt(req.params.jobId, 10);
  const job = db.prepare(`
    SELECT j.id, j.title, j.scheduled_date, j.company_id, c.name AS company_name
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.id = ?
  `).get(jobId);

  if (!job) return res.status(404).json({ error: 'Job not found' });

  let storage = 'local';
  let filename = null;
  let sharepointItemId = null;
  let sharepointWebUrl = null;
  let sharepointDlUrl = null;

  if (isConfigured()) {
    // Try SharePoint first
    const result = await uploadToSharePoint(
      req.file.buffer,
      req.file.mimetype,
      job.company_name || 'Unknown',
      job.title || 'Job',
      job.scheduled_date,
      req.file.originalname
    );

    if (result) {
      storage = 'sharepoint';
      sharepointItemId = result.itemId;
      sharepointWebUrl = result.webUrl;
      sharepointDlUrl = result.downloadUrl;
    }
  }

  if (storage === 'local') {
    // Save to local disk
    const safe = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    filename = `${Date.now()}-${safe}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
  }

  const info = db.prepare(`
    INSERT INTO job_photos
      (job_id, company_id, filename, original_name, mimetype, size, storage,
       sharepoint_item_id, sharepoint_web_url, sharepoint_dl_url, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    job.company_id || null,
    filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    storage,
    sharepointItemId,
    sharepointWebUrl,
    sharepointDlUrl,
    req.user?.username || null
  );

  res.status(201).json(db.prepare('SELECT * FROM job_photos WHERE id = ?').get(info.lastInsertRowid));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/photos/jobs/:jobId — list photos for a specific job
// ─────────────────────────────────────────────────────────────────────────────
router.get('/jobs/:jobId', (req, res) => {
  const photos = db.prepare(`
    SELECT * FROM job_photos WHERE job_id = ? ORDER BY uploaded_at DESC
  `).all(parseInt(req.params.jobId, 10));
  res.json(photos);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/photos/companies/:companyId — all photos for a company, grouped by job
// ─────────────────────────────────────────────────────────────────────────────
router.get('/companies/:companyId', (req, res) => {
  const rows = db.prepare(`
    SELECT
      p.*,
      j.title   AS job_title,
      j.scheduled_date,
      j.status  AS job_status
    FROM job_photos p
    LEFT JOIN jobs j ON j.id = p.job_id
    WHERE p.company_id = ?
    ORDER BY p.uploaded_at DESC
  `).all(parseInt(req.params.companyId, 10));

  // Group by job_id
  const groups = {};
  for (const row of rows) {
    const key = row.job_id;
    if (!groups[key]) {
      groups[key] = {
        job_id: row.job_id,
        job_title: row.job_title || `Job #${row.job_id}`,
        scheduled_date: row.scheduled_date,
        job_status: row.job_status,
        photos: [],
      };
    }
    groups[key].photos.push(row);
  }

  res.json(Object.values(groups));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/photos/:id/file — serve or redirect to photo file
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/file', async (req, res) => {
  const photo = db.prepare('SELECT * FROM job_photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Not found' });

  if (photo.storage === 'sharepoint') {
    // Get a fresh download URL from Graph API
    const url = await getDownloadUrl(photo.sharepoint_item_id);
    if (url) return res.redirect(url);
    // Fall back to webUrl if we can't get a download URL
    if (photo.sharepoint_web_url) return res.redirect(photo.sharepoint_web_url);
    return res.status(502).json({ error: 'Could not retrieve file from SharePoint' });
  }

  // Local storage
  if (!photo.filename) return res.status(404).json({ error: 'File missing' });
  const filePath = path.join(UPLOAD_DIR, photo.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing from disk' });
  res.setHeader('Content-Type', photo.mimetype || 'application/octet-stream');
  res.sendFile(filePath);
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/photos/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const photo = db.prepare('SELECT * FROM job_photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Not found' });

  if (photo.storage === 'sharepoint' && photo.sharepoint_item_id) {
    await deleteFromSharePoint(photo.sharepoint_item_id);
  } else if (photo.storage === 'local' && photo.filename) {
    const filePath = path.join(UPLOAD_DIR, photo.filename);
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  }

  db.prepare('DELETE FROM job_photos WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
