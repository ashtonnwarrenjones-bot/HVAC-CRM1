const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth routes (public)
app.use('/api/auth', require('./routes/auth'));

// Public proposal signing routes
const proposalsRouter = require('./routes/proposals');
app.get('/api/proposals/sign/:token', (req, res, next) => proposalsRouter(req, res, next));
app.post('/api/proposals/sign/:token', (req, res, next) => proposalsRouter(req, res, next));

// Public portal auth (magic link verification) — must be before portal middleware
const portalRouter = require('./routes/portal');
app.get('/api/portal/auth/:token', (req, res, next) => portalRouter(req, res, next));

// Protected API routes — require valid admin JWT
const requireAuth = require('./middleware/auth');

// Demo guard — block all write operations for demo/read-only role
const demoGuard = (req, res, next) => {
  if (req.user?.role === 'demo' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({ error: 'This is a read-only demo account. Sign up for a full account to make changes.' });
  }
  next();
};

app.use('/api/companies', requireAuth, demoGuard, require('./routes/companies'));
app.use('/api/contacts', requireAuth, demoGuard, require('./routes/contacts'));
app.use('/api/proposals', requireAuth, demoGuard, proposalsRouter);
app.use('/api/deals', requireAuth, demoGuard, require('./routes/deals'));
app.use('/api/settings', requireAuth, demoGuard, require('./routes/settings'));
app.use('/api/jobs', requireAuth, demoGuard, require('./routes/jobs'));
app.use('/api/tasks', requireAuth, demoGuard, require('./routes/tasks'));
app.use('/api/attachments', requireAuth, demoGuard, require('./routes/attachments'));
app.use('/api/notifications', requireAuth, require('./routes/notifications'));
app.use('/api/users', requireAuth, demoGuard, require('./routes/users'));
app.use('/api/photos', requireAuth, demoGuard, require('./routes/photos'));
app.use('/api/import', requireAuth, demoGuard, require('./routes/import'));

// Portal admin routes (admin JWT required)
app.use('/api/portal/admin', requireAuth, demoGuard, portalRouter);

// Portal customer routes (portal JWT required)
const requirePortalAuth = require('./middleware/portalAuth');
app.use('/api/portal', requirePortalAuth, portalRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Temporary setup — creates admin user if no users exist
app.post('/api/setup', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const bcrypt = require('bcryptjs');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const count = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(count.rows[0].count) > 0) {
      await pool.end();
      return res.json({ message: 'Users already exist', count: count.rows[0].count });
    }
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hash, 'admin']);
    await pool.end();
    res.json({ ok: true, message: 'Admin user created. Login: admin / admin123' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Temporary reset — force-resets admin password to admin123
app.post('/api/setup/reset', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const bcrypt = require('bcryptjs');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const hash = await bcrypt.hash('admin123', 10);
    // Show existing users
    const users = await pool.query('SELECT id, username, role FROM users');
    // Reset first user's password
    if (users.rows.length > 0) {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, users.rows[0].id]);
      await pool.end();
      return res.json({ ok: true, message: `Reset password for "${users.rows[0].username}". Login with that username and password: admin123`, users: users.rows });
    }
    // No users — create admin
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hash, 'admin']);
    await pool.end();
    res.json({ ok: true, message: 'Created admin user. Login: admin / admin123' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed demo data on demand (admin only, not available to demo role)
app.post('/api/admin/seed', requireAuth, demoGuard, async (req, res) => {
  try {
    const { seedDemoData } = require('./database');
    await seedDemoData(true); // force = true wipes and re-seeds
    res.json({ ok: true, message: 'Sample data loaded successfully.' });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

const { initDb } = require('./database');
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n⚡ Conduit API running at http://localhost:${PORT}`);
      console.log(`   Demo login: username=demo  password=demo123`);
      console.log(`   Health: http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;
