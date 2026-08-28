const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes (public — no token required)
app.use('/api/auth', require('./routes/auth'));

// Protected API routes — require valid JWT
const requireAuth = require('./middleware/auth');
app.use('/api/companies', requireAuth, require('./routes/companies'));
app.use('/api/contacts', requireAuth, require('./routes/contacts'));
app.use('/api/proposals', requireAuth, require('./routes/proposals'));
app.use('/api/deals', requireAuth, require('./routes/deals'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/jobs', requireAuth, require('./routes/jobs'));

// Health check (public)
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Initialize database, then start server
const { initDb } = require('./database');

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🔧 HVAC CRM API running at http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;
