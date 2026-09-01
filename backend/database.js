'use strict';
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ─── Connection Pool ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

// ─── SQL Compatibility Helpers ────────────────────────────────────────────────

/** Convert ? placeholders to $1, $2, $3… */
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Normalize args: handles .run(...args) and .run([argsArray]) */
function flatParams(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return Array.from(args);
}

/** Fix SQLite-specific SQL patterns for PostgreSQL compatibility */
function patchSQL(sql) {
  // settings upsert
  sql = sql.replace(
    /INSERT\s+OR\s+REPLACE\s+INTO\s+settings\s*\(key,\s*value\)\s*VALUES\s*\(\$1,\s*\$2\)/gi,
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value'
  );
  // generic INSERT OR REPLACE → INSERT (caller adds ON CONFLICT if needed)
  sql = sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
  // julianday → EPOCH math
  sql = sql.replace(
    /CAST\s*\(\s*\(julianday\s*\(CURRENT_TIMESTAMP\)\s*-\s*julianday\s*\(started_at\)\)\s*\*\s*86400\s*AS\s*INTEGER\s*\)/gi,
    "ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)))::INTEGER"
  );
  sql = sql.replace(
    /ROUND\s*\(\s*\(julianday\s*\(CURRENT_TIMESTAMP\)\s*-\s*julianday\s*\(tl\.updated_at\)\)\s*\*\s*1440\s*\)/gi,
    "ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tl.updated_at)) / 60)"
  );
  return sql;
}

// ─── Statement Wrapper ────────────────────────────────────────────────────────

function prepare(rawSql) {
  const sql = patchSQL(toPositional(rawSql.trim()));
  const isInsert = /^\s*INSERT\s+/i.test(sql);
  const hasReturning = /\bRETURNING\b/i.test(sql);
  const hasOnConflict = /\bON\s+CONFLICT\b/i.test(sql);

  // Append RETURNING id to plain INSERTs so callers can read lastInsertRowid
  const runSql = (isInsert && !hasReturning && !hasOnConflict)
    ? sql + ' RETURNING id'
    : sql;

  return {
    async run(...args) {
      const params = flatParams(args);
      const result = await pool.query(runSql, params.length ? params : undefined);
      const lastInsertRowid = result.rows[0]?.id ?? null;
      return { lastInsertRowid, changes: result.rowCount };
    },
    async get(...args) {
      const params = flatParams(args);
      const result = await pool.query(sql, params.length ? params : undefined);
      return result.rows[0] ?? null;
    },
    async all(...args) {
      const params = flatParams(args);
      const result = await pool.query(sql, params.length ? params : undefined);
      return result.rows;
    },
  };
}

// ─── Transaction Wrapper ──────────────────────────────────────────────────────

function transaction(fn) {
  return async (...args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(...args);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
}

// ─── Notification Helper ──────────────────────────────────────────────────────

async function createNotification({ type, title, message, entity_type, entity_id, company_id, sales_rep_name }) {
  try {
    await pool.query(
      'INSERT INTO notifications (type, title, message, entity_type, entity_id, company_id, sales_rep_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [type, title, message || null, entity_type || null, entity_id || null, company_id || null, sales_rep_name || null]
    );
  } catch (_) {}
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT, city TEXT, state TEXT DEFAULT 'CO', zip TEXT,
    phone TEXT, website TEXT,
    property_type TEXT DEFAULT 'commercial',
    contract_type TEXT DEFAULT 'prospect',
    num_hvac_units INTEGER, num_plumbing_fixtures INTEGER,
    annual_revenue REAL, notes TEXT,
    sales_rep_name TEXT, sales_rep_email TEXT, sales_rep_phone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    title TEXT, email TEXT, phone TEXT, mobile TEXT,
    preferred_contact TEXT DEFAULT 'email',
    is_primary INTEGER DEFAULT 0, notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS proposals (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL, proposal_number TEXT,
    status TEXT DEFAULT 'draft', service_type TEXT,
    subtotal REAL DEFAULT 0, tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0, total_amount REAL DEFAULT 0,
    valid_days INTEGER DEFAULT 30, notes TEXT, terms TEXT,
    signature_token TEXT, signed_at TEXT, signed_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS proposal_line_items (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    description TEXT NOT NULL, quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'ea', unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0, sort_order INTEGER DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'note', subject TEXT, body TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS deals (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
    title TEXT NOT NULL, stage TEXT DEFAULT 'lead',
    value REAL DEFAULT 0, probability INTEGER DEFAULT 20,
    service_type TEXT, close_date TEXT, lost_reason TEXT, notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    name TEXT,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL, job_type TEXT DEFAULT 'maintenance',
    technician TEXT, status TEXT DEFAULT 'scheduled',
    scheduled_date TEXT, scheduled_time TEXT,
    duration_hours REAL DEFAULT 2, notes TEXT,
    is_reminder INTEGER DEFAULT 0,
    checked_in_at TIMESTAMP, checked_out_at TIMESTAMP,
    checkin_lat REAL, checkin_lng REAL,
    checkout_lat REAL, checkout_lng REAL,
    dispatch_notes TEXT, equipment_serial TEXT, equipment_model TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL, notes TEXT, due_date TEXT,
    assigned_to TEXT, priority TEXT DEFAULT 'normal',
    completed INTEGER DEFAULT 0, completed_at TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, original_name TEXT NOT NULL,
    mimetype TEXT, size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS portal_tokens (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS portal_messages (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name TEXT,
    subject TEXT DEFAULT 'Message from Customer',
    message TEXT NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL, title TEXT NOT NULL,
    message TEXT, entity_type TEXT, entity_id INTEGER,
    company_id INTEGER, sales_rep_name TEXT,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Mobile tables
  `CREATE TABLE IF NOT EXISTS job_activity (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    action TEXT, note TEXT, created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS job_notes (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    note TEXT, created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS job_checklists (
    job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
    checklist_data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS job_parts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    name TEXT, quantity INTEGER DEFAULT 1,
    unit_cost REAL, logged_by TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS job_time_entries (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    user_id INTEGER, started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stopped_at TIMESTAMP, duration_seconds INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS tech_locations (
    user_id INTEGER PRIMARY KEY,
    username TEXT, lat REAL, lng REAL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS user_push_tokens (
    user_id INTEGER PRIMARY KEY,
    token TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    body TEXT, sent_by TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Photos
  `CREATE TABLE IF NOT EXISTS job_photos (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    filename TEXT NOT NULL, original_name TEXT,
    mimetype TEXT, size INTEGER, caption TEXT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Equipment / Asset tracking
  `CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    unit_type TEXT,
    make TEXT,
    model TEXT,
    serial_number TEXT,
    install_date DATE,
    last_service_date DATE,
    warranty_expiry DATE,
    location_notes TEXT,
    condition TEXT DEFAULT 'good',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Invoices
  `CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Invoice',
    invoice_number TEXT UNIQUE,
    amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    notes TEXT,
    due_date DATE,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
];

// ─── Demo data seeder ─────────────────────────────────────────────────────────

async function seedDemoData(force = false) {
  const existing = await pool.query('SELECT id FROM companies LIMIT 1');
  if (existing.rows.length > 0 && !force) return;

  if (force) {
    const tables = ['tasks','activities','deals','jobs','proposal_line_items',
      'proposals','contacts','companies'];
    for (const t of tables) {
      await pool.query(`DELETE FROM ${t}`);
    }
    await pool.query("DELETE FROM users WHERE role = 'demo'");
  }

  console.log('🌱 Seeding demo data...');

  // Demo user (read-only)
  const demoHash = await bcrypt.hash('demo123', 10);
  await pool.query(
    "INSERT INTO users (username, password_hash, role) VALUES ('demo', $1, 'demo') ON CONFLICT (username) DO NOTHING",
    [demoHash]
  );

  // ── Companies ──────────────────────────────────────────────────────────────
  const companiesData = [
    { name:'Apex Tower Management', address:'742 Michigan Ave', city:'Chicago', state:'IL', zip:'60611', phone:'(312) 555-0142', website:'apextower.com', property_type:'commercial', contract_type:'active', num_hvac_units:24, annual_revenue:2800000, notes:'Premium high-rise property. 32-floor office tower. Annual maintenance contract since 2019.' },
    { name:'Summit Health Partners', address:'2100 Wellness Way', city:'Denver', state:'CO', zip:'80204', phone:'(720) 555-0298', website:'summithealthpartners.org', property_type:'commercial', contract_type:'active', num_hvac_units:18, annual_revenue:890000, notes:'Medical facility — HVAC uptime is critical. 24/7 response required per contract.' },
    { name:'Metro Restaurant Group', address:'510 Broadway', city:'Denver', state:'CO', zip:'80203', phone:'(303) 555-0371', website:'metrorestaurantgroup.com', property_type:'commercial', contract_type:'prospect', num_hvac_units:8, annual_revenue:420000, notes:'4 restaurant locations in downtown Denver. Kitchen exhaust systems are primary need.' },
    { name:'Ridgeline Office Park', address:'3500 Arapahoe Ave', city:'Boulder', state:'CO', zip:'80303', phone:'(303) 555-0519', website:'ridgelineofficepark.com', property_type:'commercial', contract_type:'active', num_hvac_units:12, annual_revenue:640000, notes:'Multi-tenant office park, 6 buildings. Phase 2 expansion underway.' },
    { name:'Greenfield School District', address:'1200 School Road', city:'Lakewood', state:'CO', zip:'80226', phone:'(303) 555-0684', website:'greenfieldschools.org', property_type:'commercial', contract_type:'prospect', num_hvac_units:30, annual_revenue:0, notes:'K-12 district with 5 campuses. HVAC infrastructure aging — upgrade RFP expected Q2.' },
  ];

  const compIds = [];
  for (const c of companiesData) {
    const r = await pool.query(
      `INSERT INTO companies (name,address,city,state,zip,phone,website,property_type,contract_type,num_hvac_units,annual_revenue,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [c.name,c.address,c.city,c.state,c.zip,c.phone,c.website,c.property_type,c.contract_type,c.num_hvac_units||0,c.annual_revenue||0,c.notes]
    );
    compIds.push(r.rows[0].id);
  }
  const [apexId, summitId, metroId, ridgeId, greenId] = compIds;

  // ── Contacts ──────────────────────────────────────────────────────────────
  const contactsData = [
    { company_id:apexId,   first_name:'David',    last_name:'Chen',     title:'Facilities Director',    email:'dchen@apextower.com',          phone:'(312) 555-0143', is_primary:1 },
    { company_id:apexId,   first_name:'Sarah',    last_name:'Kim',      title:'Building Manager',       email:'skim@apextower.com',           phone:'(312) 555-0144', is_primary:0 },
    { company_id:summitId, first_name:'Robert',   last_name:'Martinez', title:'VP Operations',          email:'rmartinez@summitHP.org',       phone:'(720) 555-0299', is_primary:1 },
    { company_id:summitId, first_name:'Jennifer', last_name:'Walsh',    title:'Facilities Coordinator', email:'jwalsh@summitHP.org',          phone:'(720) 555-0300', is_primary:0 },
    { company_id:metroId,  first_name:'Tony',     last_name:'Ricci',    title:'Owner',                  email:'tricci@metroRG.com',           phone:'(303) 555-0372', is_primary:1 },
    { company_id:metroId,  first_name:'Amy',      last_name:'Foster',   title:'Operations Manager',     email:'afoster@metroRG.com',          phone:'(303) 555-0373', is_primary:0 },
    { company_id:ridgeId,  first_name:'Mark',     last_name:'Thompson', title:'Property Manager',       email:'mthompson@ridgelineOP.com',    phone:'(303) 555-0520', is_primary:1 },
    { company_id:ridgeId,  first_name:'Carlos',   last_name:'Rivera',   title:'Facilities Manager',     email:'crivera@ridgelineOP.com',      phone:'(303) 555-0521', is_primary:0 },
    { company_id:greenId,  first_name:'Lisa',     last_name:'Nguyen',   title:'Admin Director',         email:'lnguyen@greenfieldschools.org',phone:'(303) 555-0685', is_primary:1 },
    { company_id:greenId,  first_name:'Kevin',    last_name:'Park',     title:'Maintenance Director',   email:'kpark@greenfieldschools.org',  phone:'(303) 555-0686', is_primary:0 },
  ];

  const primaryContact = {};
  for (const c of contactsData) {
    const r = await pool.query(
      `INSERT INTO contacts (company_id,first_name,last_name,title,email,phone,is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [c.company_id,c.first_name,c.last_name,c.title,c.email,c.phone,c.is_primary]
    );
    if (c.is_primary) primaryContact[c.company_id] = r.rows[0].id;
  }

  // ── Proposals ────────────────────────────────────────────────────────────
  const dateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const proposalsData = [
    { company_id:apexId,   contact_id:primaryContact[apexId],   title:'Annual HVAC Maintenance Contract 2025',       proposal_number:'PRO-2025-001', status:'accepted', service_type:'Maintenance',  subtotal:23400,  tax_rate:6, tax_amount:1404,    total_amount:24804,  valid_days:30, notes:'Full-year preventive maintenance for 24 HVAC units.',                                         terms:'Net 30. Service visits scheduled quarterly. Emergency response within 4 hours.',           signed_by:'David Chen',    signed_at:dateStr(45)+'T14:22:00Z', created_at:dateStr(60) },
    { company_id:summitId, contact_id:primaryContact[summitId], title:'Emergency Chiller Replacement — Unit 3',      proposal_number:'PRO-2025-002', status:'sent',     service_type:'Installation', subtotal:63679,  tax_rate:6, tax_amount:3820.74, total_amount:67500,  valid_days:14, notes:'Unit 3 chiller failure. Replacement with Carrier 30XA-200 ton unit.',                      terms:'Net 15. 50% deposit required to order equipment. Estimated lead time 3 weeks.',            signed_by:null, signed_at:null, created_at:dateStr(12) },
    { company_id:metroId,  contact_id:primaryContact[metroId],  title:'Commercial Kitchen Exhaust Cleaning (4 Locs)',proposal_number:'PRO-2025-003', status:'draft',    service_type:'Cleaning',     subtotal:7736,   tax_rate:6, tax_amount:464.16,  total_amount:8200,   valid_days:30, notes:'Annual hood and duct cleaning for all 4 Metro Restaurant locations.',                       terms:'Net 30. Scheduling coordinated to minimize kitchen downtime.',                              signed_by:null, signed_at:null, created_at:dateStr(5) },
    { company_id:ridgeId,  contact_id:primaryContact[ridgeId],  title:'Preventive Maintenance Agreement — Phase 2',  proposal_number:'PRO-2025-004', status:'accepted', service_type:'Maintenance',  subtotal:17358,  tax_rate:6, tax_amount:1041.48, total_amount:18400,  valid_days:30, notes:'PM contract for 3 new buildings in Phase 2 expansion.',                                    terms:'Annual contract. Quarterly visits. Parts billed separately.',                               signed_by:'Mark Thompson', signed_at:dateStr(30)+'T10:05:00Z', created_at:dateStr(50) },
    { company_id:summitId, contact_id:primaryContact[summitId], title:'Boiler Room Upgrade & Controls Modernization', proposal_number:'PRO-2025-005', status:'sent',     service_type:'Installation', subtotal:134000, tax_rate:6, tax_amount:8040,    total_amount:142040, valid_days:30, notes:'Full boiler room overhaul with new Honeywell building automation controls.',                 terms:'Net 30. 30% deposit required. Project duration: 6 weeks.',                                 signed_by:null, signed_at:null, created_at:dateStr(20) },
    { company_id:greenId,  contact_id:primaryContact[greenId],  title:'District-Wide Summer HVAC Tune-Up Program',   proposal_number:'PRO-2025-006', status:'draft',    service_type:'Maintenance',  subtotal:29811,  tax_rate:6, tax_amount:1788.66, total_amount:31600,  valid_days:45, notes:'Comprehensive pre-season tune-up for all 5 school campuses before fall semester.',          terms:'Net 45. Work to be completed during June–July school break.',                               signed_by:null, signed_at:null, created_at:dateStr(3) },
    { company_id:apexId,   contact_id:primaryContact[apexId],   title:'Refrigerant Leak Detection & Repair',         proposal_number:'PRO-2025-007', status:'accepted', service_type:'Repair',       subtotal:3868,   tax_rate:6, tax_amount:232.08,  total_amount:4100,   valid_days:7,  notes:'Detected refrigerant loss during quarterly PM. Scope: leak detection, repair, and recharge.',terms:'Net 15. Work performed after hours to minimize tenant disruption.',                         signed_by:'Sarah Kim',     signed_at:dateStr(15)+'T16:40:00Z', created_at:dateStr(18) },
    { company_id:ridgeId,  contact_id:primaryContact[ridgeId],  title:'New Construction HVAC Design-Build — Bldg 7', proposal_number:'PRO-2025-008', status:'sent',     service_type:'Installation', subtotal:84434,  tax_rate:6, tax_amount:5066.04, total_amount:89500,  valid_days:30, notes:'Design-build contract for the new 22,000 sq ft Building 7 in Phase 3.',                    terms:'Net 30. Progress billing: 25% mobilization, 50% rough-in, 25% completion.',                signed_by:null, signed_at:null, created_at:dateStr(8) },
  ];

  const proposalIds = {};
  for (const p of proposalsData) {
    const r = await pool.query(
      `INSERT INTO proposals (company_id,contact_id,title,proposal_number,status,service_type,
        subtotal,tax_rate,tax_amount,total_amount,valid_days,notes,terms,signed_by,signed_at,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [p.company_id,p.contact_id,p.title,p.proposal_number,p.status,p.service_type,
       p.subtotal,p.tax_rate,p.tax_amount,p.total_amount,p.valid_days,p.notes,p.terms,
       p.signed_by||null,p.signed_at||null,p.created_at,p.created_at]
    );
    const pid = r.rows[0].id;
    proposalIds[p.proposal_number] = pid;

    // Line items
    const lineItems = getLineItems(p.proposal_number);
    for (const li of lineItems) {
      await pool.query(
        `INSERT INTO proposal_line_items (proposal_id,description,quantity,unit,unit_price,total_price,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [pid,li.description,li.quantity,li.unit,li.unit_price,li.total_price,li.sort_order]
      );
    }
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const jobsData = [
    { company_id:apexId,   contact_id:primaryContact[apexId],   title:'Q1 Preventive Maintenance — Floors 1-16',      job_type:'maintenance', technician:'Marcus Johnson', status:'completed',  scheduled_date:dateStr(30), scheduled_time:'08:00', duration_hours:8, notes:'All 12 units on floors 1-16 serviced. Filters replaced. Coils cleaned.' },
    { company_id:summitId, contact_id:primaryContact[summitId], title:'Emergency A/C Repair — ICU Wing',               job_type:'repair',       technician:'Tyler Brooks',   status:'completed',  scheduled_date:dateStr(22), scheduled_time:'14:00', duration_hours:4, notes:'Compressor failure on RTU-6. Replaced capacitor and contractor. Unit restored.' },
    { company_id:ridgeId,  contact_id:primaryContact[ridgeId],  title:'Filter Change & Inspection — Buildings 1-3',    job_type:'maintenance', technician:'Marcus Johnson', status:'scheduled',  scheduled_date:dateStr(-7), scheduled_time:'07:30', duration_hours:6, notes:'Monthly filter replacement and belt inspection.' },
    { company_id:metroId,  contact_id:primaryContact[metroId],  title:'Kitchen Exhaust Cleaning — Broadway Location',  job_type:'cleaning',    technician:'Sandra Lee',     status:'scheduled',  scheduled_date:dateStr(-14),scheduled_time:'22:00', duration_hours:3, notes:'After-hours cleaning per fire code requirements.' },
    { company_id:summitId, contact_id:primaryContact[summitId], title:'Pre-Season Boiler Inspection — Mechanical Rm B',job_type:'inspection',  technician:'Tyler Brooks',   status:'in_progress',scheduled_date:dateStr(-3), scheduled_time:'09:00', duration_hours:5, notes:'Annual boiler inspection before heating season.' },
    { company_id:greenId,  contact_id:primaryContact[greenId],  title:'Annual HVAC Inspection — Greenfield Middle School',job_type:'inspection',technician:'Marcus Johnson',status:'scheduled',  scheduled_date:dateStr(-21),scheduled_time:'08:00', duration_hours:10,notes:'Full campus inspection. 8 rooftop units + cafeteria system.' },
  ];

  for (const j of jobsData) {
    await pool.query(
      `INSERT INTO jobs (company_id,contact_id,title,job_type,technician,status,scheduled_date,scheduled_time,duration_hours,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [j.company_id,j.contact_id,j.title,j.job_type,j.technician,j.status,j.scheduled_date,j.scheduled_time,j.duration_hours,j.notes]
    );
  }

  // ── Deals ─────────────────────────────────────────────────────────────────
  const dealsData = [
    { company_id:apexId,   contact_id:primaryContact[apexId],   proposal_id:proposalIds['PRO-2025-001'], title:'Apex Tower 2025 Contract Renewal',         stage:'negotiation',  value:24804,  probability:85, service_type:'Maintenance',  close_date:dateStr(-30), notes:'Renewal of existing annual contract. Client wants 5% pricing hold.' },
    { company_id:summitId, contact_id:primaryContact[summitId], proposal_id:proposalIds['PRO-2025-002'], title:'Summit Health Chiller Replacement',         stage:'proposal',     value:67500,  probability:65, service_type:'Installation', close_date:dateStr(-21), notes:'High urgency — existing unit unreliable. Board approval needed for spend over $50k.' },
    { company_id:metroId,  contact_id:primaryContact[metroId],  proposal_id:null,                        title:'Metro Restaurant — Multi-Location Contract',stage:'qualification',value:45000,  probability:30, service_type:'Maintenance',  close_date:dateStr(-60), notes:'Tony Ricci shopping 3 other vendors. Our price is competitive. Kitchen exhaust is the hook.' },
    { company_id:greenId,  contact_id:primaryContact[greenId],  proposal_id:proposalIds['PRO-2025-006'], title:'Greenfield District HVAC Modernization',    stage:'proposal',     value:185000, probability:50, service_type:'Installation', close_date:dateStr(-45), notes:'RFP submitted. Budget approved by school board. Decision expected Q2.' },
    { company_id:ridgeId,  contact_id:primaryContact[ridgeId],  proposal_id:proposalIds['PRO-2025-008'], title:'Ridgeline Phase 3 — Building 7 Design-Build',stage:'negotiation',  value:89500,  probability:80, service_type:'Installation', close_date:dateStr(-15), notes:'Mark Thompson wants to start Q2. Contract language being reviewed by their legal team.' },
  ];

  for (const d of dealsData) {
    await pool.query(
      `INSERT INTO deals (company_id,contact_id,proposal_id,title,stage,value,probability,service_type,close_date,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [d.company_id,d.contact_id,d.proposal_id||null,d.title,d.stage,d.value,d.probability,d.service_type,d.close_date,d.notes]
    );
  }

  // ── Activities ────────────────────────────────────────────────────────────
  const activitiesData = [
    { company_id:apexId,   type:'call',    subject:'Q2 planning call with David Chen',        body:'Discussed scope for summer PM work. David confirmed budget approved for chiller inspection on floors 17-32. Follow up with revised pricing.' },
    { company_id:summitId, type:'email',   subject:'Chiller proposal follow-up',              body:'Sent revised proposal with updated lead time from Carrier. Jennifer Walsh confirmed board meeting is March 15th.' },
    { company_id:ridgeId,  type:'meeting', subject:'Site walk — Building 7 new construction', body:'Met with Mark Thompson and architect on site. Mechanical room layout finalized. Equipment specs locked in.' },
    { company_id:metroId,  type:'call',    subject:'Initial consultation — Tony Ricci',       body:'Tony wants all-in pricing for kitchen exhaust cleaning across 4 locations. Pricing competitive — he is also talking to ABC Mechanical.' },
    { company_id:greenId,  type:'email',   subject:'RFP submission confirmation',             body:'Submitted RFP response to Lisa Nguyen. Proposal includes 5-year maintenance plan with phased equipment upgrades.' },
    { company_id:apexId,   type:'note',    subject:'Leak repair completed — floors 18-24',    body:'Marcus located two pinhole leaks in refrigerant line. Braised and pressure-tested. Recharged with 12 lbs R-410A. All units operating within spec.' },
  ];

  for (const a of activitiesData) {
    await pool.query(
      'INSERT INTO activities (company_id,type,subject,body) VALUES ($1,$2,$3,$4)',
      [a.company_id,a.type,a.subject,a.body]
    );
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const tasksData = [
    { company_id:summitId, title:'Follow up on chiller proposal decision',   due_date:dateStr(-5),  priority:'high' },
    { company_id:ridgeId,  title:'Send contract draft to legal team',         due_date:dateStr(-2),  priority:'high' },
    { company_id:metroId,  title:'Call Tony Ricci re: final pricing',         due_date:dateStr(-10), priority:'normal' },
    { company_id:greenId,  title:'Schedule site assessment — Greenfield HS',  due_date:dateStr(-14), priority:'normal' },
    { company_id:apexId,   title:'Q2 PM scheduling — coordinate with David',  due_date:dateStr(-20), priority:'low' },
  ];

  for (const t of tasksData) {
    await pool.query(
      'INSERT INTO tasks (company_id,title,due_date,priority) VALUES ($1,$2,$3,$4)',
      [t.company_id,t.title,t.due_date,t.priority]
    );
  }

  console.log('✅ Demo data seeded successfully.');
}

// ─── Line items helper ────────────────────────────────────────────────────────

function getLineItems(proposalNumber) {
  const items = {
    'PRO-2025-001': [
      { description:'Quarterly Preventive Maintenance Visits (4)', quantity:4, unit:'visit', unit_price:3800, total_price:15200, sort_order:1 },
      { description:'Filter Replacement — MERV-13 (24 units × 4 changes)', quantity:96, unit:'ea', unit_price:65, total_price:6240, sort_order:2 },
      { description:'Annual Coil Cleaning & Tune-Up', quantity:24, unit:'unit', unit_price:82, total_price:1960, sort_order:3 },
    ],
    'PRO-2025-002': [
      { description:'Carrier 30XA-200 Ton Air-Cooled Chiller (supply & install)', quantity:1, unit:'ea', unit_price:54000, total_price:54000, sort_order:1 },
      { description:'Crane & rigging — rooftop removal/placement', quantity:1, unit:'ea', unit_price:6500, total_price:6500, sort_order:2 },
      { description:'Refrigerant charge, startup & commissioning', quantity:1, unit:'ea', unit_price:3179, total_price:3179, sort_order:3 },
    ],
    'PRO-2025-003': [
      { description:'Kitchen Hood & Duct Cleaning (per location)', quantity:4, unit:'location', unit_price:1650, total_price:6600, sort_order:1 },
      { description:'Exhaust Fan Inspection & Lubrication', quantity:8, unit:'fan', unit_price:142, total_price:1136, sort_order:2 },
    ],
    'PRO-2025-004': [
      { description:'Semi-Annual PM Visits — Phase 2 Buildings (3 bldgs × 2)', quantity:6, unit:'visit', unit_price:2200, total_price:13200, sort_order:1 },
      { description:'Filter Replacement Program (12 units)', quantity:48, unit:'ea', unit_price:58, total_price:2784, sort_order:2 },
      { description:'Belt & Drive Inspection (annual)', quantity:12, unit:'unit', unit_price:115, total_price:1374, sort_order:3 },
    ],
    'PRO-2025-005': [
      { description:'Boiler Replacement — Cleaver Brooks CB-200 (2 units)', quantity:2, unit:'ea', unit_price:48000, total_price:96000, sort_order:1 },
      { description:'Honeywell BAS Controls Package & Programming', quantity:1, unit:'system', unit_price:28500, total_price:28500, sort_order:2 },
      { description:'Piping, Valves & Insulation Allowance', quantity:1, unit:'allowance', unit_price:9500, total_price:9500, sort_order:3 },
    ],
    'PRO-2025-006': [
      { description:'Full-System Tune-Up Per Campus (5 campuses)', quantity:5, unit:'campus', unit_price:4800, total_price:24000, sort_order:1 },
      { description:'Filter Replacement — All RTUs (30 units)', quantity:30, unit:'unit', unit_price:95, total_price:2850, sort_order:2 },
      { description:'Refrigerant Level Check & Top-Off (allowance)', quantity:1, unit:'allowance', unit_price:2961, total_price:2961, sort_order:3 },
    ],
    'PRO-2025-007': [
      { description:'Refrigerant Leak Detection Survey (floors 18-24)', quantity:7, unit:'floor', unit_price:285, total_price:1995, sort_order:1 },
      { description:'Leak Repair & Pressure Test', quantity:1, unit:'ea', unit_price:873, total_price:873, sort_order:2 },
      { description:'R-410A Refrigerant Recharge', quantity:12, unit:'lb', unit_price:83.33, total_price:1000, sort_order:3 },
    ],
    'PRO-2025-008': [
      { description:'HVAC Design Engineering & Permitting', quantity:1, unit:'project', unit_price:12500, total_price:12500, sort_order:1 },
      { description:'RTU Equipment Supply & Installation (4 units)', quantity:4, unit:'unit', unit_price:14500, total_price:58000, sort_order:2 },
      { description:'Ductwork Fabrication & Installation', quantity:1, unit:'allowance', unit_price:13934, total_price:13934, sort_order:3 },
    ],
  };
  return items[proposalNumber] || [];
}

// ─── DB Init ──────────────────────────────────────────────────────────────────

async function initDb() {
  console.log('🔌 Connecting to PostgreSQL...');

  // Create all tables
  for (const stmt of SCHEMA_STATEMENTS) {
    try {
      await pool.query(stmt);
    } catch (e) {
      console.error('Schema error:', e.message);
    }
  }

  // Safe column additions (ignore if already exists)
  const columnMigrations = [
    "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signature_token TEXT",
    "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signed_at TEXT",
    "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signed_by TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sales_rep_name TEXT",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sales_rep_email TEXT",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sales_rep_phone TEXT",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checkin_lat REAL",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checkin_lng REAL",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checkout_lat REAL",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checkout_lng REAL",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatch_notes TEXT",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equipment_serial TEXT",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equipment_model TEXT",
  ];

  for (const sql of columnMigrations) {
    try { await pool.query(sql); } catch (_) {}
  }

  // Seed demo data if the DB is empty
  await seedDemoData();

  console.log('✅ PostgreSQL database ready.');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

const db = { prepare, transaction };

module.exports = db;
module.exports.initDb = initDb;
module.exports.seedDemoData = seedDemoData;
module.exports.createNotification = createNotification;
module.exports.pool = pool;
