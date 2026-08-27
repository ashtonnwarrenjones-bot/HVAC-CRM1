const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'crm.db');
let _sqlDb = null;
let _inTransaction = false;

// Persist the in-memory DB to disk after every write
function saveDb() {
  if (_sqlDb) {
    const data = _sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// Normalize arguments into the array/object form sql.js expects
function normalizeParams(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) return args[0];
  return Array.from(args); // multiple positional args → array
}

// Statement wrapper that mirrors the better-sqlite3 Statement API
class Stmt {
  constructor(sql) {
    this._sql = sql;
  }

  run(...args) {
    const params = normalizeParams(args);
    const stmt = _sqlDb.prepare(this._sql);
    stmt.run(params);
    stmt.free();
    if (!_inTransaction) saveDb();
    const rowidRes = _sqlDb.exec('SELECT last_insert_rowid()');
    const changesRes = _sqlDb.exec('SELECT changes()');
    return {
      lastInsertRowid: rowidRes[0]?.values[0][0] ?? 0,
      changes: changesRes[0]?.values[0][0] ?? 0,
    };
  }

  get(...args) {
    const params = normalizeParams(args);
    const stmt = _sqlDb.prepare(this._sql);
    stmt.bind(params);
    const row = stmt.step() ? stmt.getAsObject() : undefined;
    stmt.free();
    return row;
  }

  all(...args) {
    const params = normalizeParams(args);
    const rows = [];
    const stmt = _sqlDb.prepare(this._sql);
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }
}

// Database wrapper that mirrors the better-sqlite3 Database API
const db = {
  prepare: (sql) => new Stmt(sql),

  exec: (sql) => {
    _sqlDb.run(sql);
    if (!_inTransaction) saveDb();
  },

  pragma: (p) => {
    try { _sqlDb.run(`PRAGMA ${p}`); } catch (_) {}
  },

  transaction: (fn) => {
    return (...args) => {
      _sqlDb.run('BEGIN');
      _inTransaction = true;
      try {
        const result = fn(...args);
        _sqlDb.run('COMMIT');
        _inTransaction = false;
        saveDb();
        return result;
      } catch (e) {
        try { _sqlDb.run('ROLLBACK'); } catch (_) {}
        _inTransaction = false;
        throw e;
      }
    };
  },
};

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT DEFAULT 'CO',
    zip TEXT,
    phone TEXT,
    website TEXT,
    property_type TEXT DEFAULT 'commercial',
    contract_type TEXT DEFAULT 'prospect',
    num_hvac_units INTEGER,
    num_plumbing_fixtures INTEGER,
    annual_revenue REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    preferred_contact TEXT DEFAULT 'email',
    is_primary INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    proposal_number TEXT,
    status TEXT DEFAULT 'draft',
    service_type TEXT,
    subtotal REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    valid_days INTEGER DEFAULT 30,
    notes TEXT,
    terms TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS proposal_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'ea',
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'note',
    subject TEXT,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    stage TEXT DEFAULT 'lead',
    value REAL DEFAULT 0,
    probability INTEGER DEFAULT 20,
    service_type TEXT,
    close_date TEXT,
    lost_reason TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

async function initDb() {
  const SQL = await initSqlJs();

  // Load existing DB from disk, or start fresh
  let buffer = null;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }
  _sqlDb = buffer ? new SQL.Database(buffer) : new SQL.Database();

  // Enable foreign keys
  try { _sqlDb.run('PRAGMA foreign_keys = ON'); } catch (_) {}

  // Create tables (safe to run on existing DB — IF NOT EXISTS)
  _sqlDb.run(SCHEMA);

  // Write initial file to disk
  saveDb();

  return db;
}

// Export db as the default export so routes can do:
//   const db = require('../database');
// And server.js can do:
//   const { initDb } = require('./database');
module.exports = db;
module.exports.initDb = initDb;
