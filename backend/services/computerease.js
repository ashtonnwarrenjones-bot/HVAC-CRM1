'use strict';

/**
 * ComputerEase Integration Service
 *
 * Connects to ComputerEase's SQL Server database (mssql) to:
 *   - Test the connection
 *   - Read CE jobs for matching (by job number or customer)
 *   - Read P.O. numbers created against a CE job
 *   - Push completed job costs (labor + materials) into CE job cost ledger
 *
 * ComputerEase runs on Microsoft SQL Server. All table/column names
 * are configured via the costCodes settings so they can be adjusted
 * once the CE schema is confirmed for this installation.
 *
 * NOTE: Direct DB writes are done only to the job cost detail table.
 * CE's own workflow (job creation, P.O. creation, invoicing) is
 * never modified — this service reads those and writes only costs.
 */

let sql;
try {
  sql = require('mssql');
} catch (_) {
  sql = null; // mssql not installed yet — connection will return helpful error
}

// ─── Connection pool cache ────────────────────────────────────────────────────
let _pool = null;
let _poolConfig = null;

function configKey(cfg) {
  return `${cfg.server}|${cfg.port}|${cfg.database}|${cfg.username}`;
}

async function getPool(config) {
  if (!sql) throw new Error('mssql package not installed. Run: npm install mssql in the backend directory.');

  const key = configKey(config);
  if (_pool && _poolConfig === key) return _pool;

  // Close old pool if config changed
  if (_pool) {
    try { await _pool.close(); } catch (_) {}
    _pool = null;
  }

  const mssqlConfig = {
    server:   config.server,
    port:     parseInt(config.port) || 1433,
    database: config.database,
    user:     config.username,
    password: config.password,
    options: {
      trustServerCertificate: true,   // typical for on-prem CE installs
      enableArithAbort:        true,
      connectTimeout:          10000,
      requestTimeout:          15000,
    },
    pool: {
      max:              5,
      min:              0,
      idleTimeoutMillis: 30000,
    },
  };

  _pool = await sql.connect(mssqlConfig);
  _poolConfig = key;
  return _pool;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Test the CE database connection.
 * Returns { ok: true, version, tables } on success or { ok: false, error } on failure.
 */
async function testConnection(config) {
  try {
    const pool = await getPool(config);
    const result = await pool.request().query('SELECT @@VERSION AS version');
    const version = result.recordset[0]?.version?.split('\n')[0] || 'SQL Server';

    // Discover tables to help with schema mapping
    const tables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM   INFORMATION_SCHEMA.TABLES
      WHERE  TABLE_TYPE = 'BASE TABLE'
      ORDER  BY TABLE_NAME
    `);
    const tableNames = tables.recordset.map(r => r.TABLE_NAME);

    return { ok: true, version, tables: tableNames };
  } catch (err) {
    // Reset pool so next attempt reconnects fresh
    _pool = null; _poolConfig = null;
    return { ok: false, error: err.message };
  }
}

/**
 * List columns of a table — used for schema discovery in Settings.
 */
async function describeTable(config, tableName) {
  try {
    const pool = await getPool(config);
    const result = await pool.request()
      .input('table', sql.VarChar, tableName)
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM   INFORMATION_SCHEMA.COLUMNS
        WHERE  TABLE_NAME = @table
        ORDER  BY ORDINAL_POSITION
      `);
    return { ok: true, columns: result.recordset };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch recent CE jobs for matching against CRM jobs.
 * tableMap: { jobs: 'JCJOB', jobNumCol: 'JOB_NUMBER', custCol: 'CUSTOMER_NAME', descCol: 'JOB_DESCRIPTION', statusCol: 'JOB_STATUS' }
 */
async function fetchCEJobs(config, tableMap = {}) {
  const {
    jobsTable   = 'JCJOB',
    jobNumCol   = 'JOB_NUMBER',
    custCol     = 'CUSTOMER_NAME',
    descCol     = 'JOB_DESCRIPTION',
    statusCol   = 'JOB_STATUS',
    dateCol     = 'START_DATE',
  } = tableMap;

  try {
    const pool = await getPool(config);
    const result = await pool.request().query(`
      SELECT TOP 200
        ${jobNumCol}   AS job_number,
        ${custCol}     AS customer_name,
        ${descCol}     AS description,
        ${statusCol}   AS status,
        ${dateCol}     AS start_date
      FROM ${jobsTable}
      ORDER BY ${dateCol} DESC
    `);
    return { ok: true, jobs: result.recordset };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch P.O.s linked to a CE job number.
 * tableMap: { poTable: 'APPO', poNumCol: 'PO_NUMBER', jobNumCol: 'JOB_NUMBER', vendorCol: 'VENDOR_NAME', amountCol: 'PO_AMOUNT' }
 */
async function fetchJobPOs(config, ceJobNumber, tableMap = {}) {
  const {
    poTable    = 'APPO',
    poNumCol   = 'PO_NUMBER',
    jobNumCol  = 'JOB_NUMBER',
    vendorCol  = 'VENDOR_NAME',
    amountCol  = 'PO_AMOUNT',
    dateCol    = 'PO_DATE',
    descCol    = 'PO_DESCRIPTION',
  } = tableMap;

  try {
    const pool = await getPool(config);
    const result = await pool.request()
      .input('jobNum', sql.VarChar, String(ceJobNumber))
      .query(`
        SELECT
          ${poNumCol}  AS po_number,
          ${vendorCol} AS vendor_name,
          ${amountCol} AS amount,
          ${dateCol}   AS po_date,
          ${descCol}   AS description
        FROM ${poTable}
        WHERE ${jobNumCol} = @jobNum
        ORDER BY ${dateCol} DESC
      `);
    return { ok: true, pos: result.recordset };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Push completed job costs (labor + materials) into CE job cost detail table.
 *
 * tableMap: {
 *   costTable:    'JCDETAIL',
 *   jobNumCol:    'JOB_NUMBER',
 *   costTypeCol:  'COST_TYPE',      -- 'L' labor, 'M' material
 *   costCodeCol:  'COST_CODE',
 *   dateCol:      'TRANS_DATE',
 *   descCol:      'DESCRIPTION',
 *   qtyCol:       'QUANTITY',
 *   unitCostCol:  'UNIT_COST',
 *   totalCol:     'EXTENDED_AMOUNT',
 *   empCol:       'EMPLOYEE_ID',
 * }
 * laborCostCode:    default cost code for labor (e.g. '001')
 * materialCostCode: default cost code for materials (e.g. '002')
 */
async function pushJobCosts(config, ceJobNumber, timeEntries, parts, tableMap = {}) {
  const {
    costTable        = 'JCDETAIL',
    jobNumCol        = 'JOB_NUMBER',
    costTypeCol      = 'COST_TYPE',
    costCodeCol      = 'COST_CODE',
    dateCol          = 'TRANS_DATE',
    descCol          = 'DESCRIPTION',
    qtyCol           = 'QUANTITY',
    unitCostCol      = 'UNIT_COST',
    totalCol         = 'EXTENDED_AMOUNT',
    laborCostCode    = config.laborCostCode    || '001',
    materialCostCode = config.materialCostCode || '002',
  } = tableMap;

  const rows = [];

  // Labor rows
  for (const entry of timeEntries) {
    const hours    = ((entry.duration_seconds || 0) / 3600).toFixed(2);
    const rate     = parseFloat(config.defaultLaborRate || 0);
    const total    = (parseFloat(hours) * rate).toFixed(2);
    const dateVal  = entry.started_at ? entry.started_at.split('T')[0] : new Date().toISOString().split('T')[0];
    rows.push({
      type: 'L', code: laborCostCode,
      date: dateVal,
      desc: `Labor: ${entry.username || entry.technician || 'Tech'} (${hours} hrs)`,
      qty: hours, unitCost: rate, total,
    });
  }

  // Material rows
  for (const part of parts) {
    const qty       = parseFloat(part.quantity || 1);
    const unitCost  = parseFloat(part.unit_cost || part.price || 0);
    const total     = (qty * unitCost).toFixed(2);
    const dateVal   = new Date().toISOString().split('T')[0];
    rows.push({
      type: 'M', code: materialCostCode,
      date: dateVal,
      desc: `Material: ${part.name || part.description || 'Part'} x${qty}`,
      qty, unitCost, total,
    });
  }

  if (rows.length === 0) return { ok: true, inserted: 0, message: 'No costs to push' };

  try {
    const pool = await getPool(config);
    let inserted = 0;
    for (const row of rows) {
      await pool.request()
        .input('jobNum',   sql.VarChar,  String(ceJobNumber))
        .input('type',     sql.VarChar,  row.type)
        .input('code',     sql.VarChar,  row.code)
        .input('date',     sql.VarChar,  row.date)
        .input('desc',     sql.VarChar,  row.desc.slice(0, 200))
        .input('qty',      sql.Decimal(18,2), parseFloat(row.qty))
        .input('unitCost', sql.Decimal(18,2), parseFloat(row.unitCost))
        .input('total',    sql.Decimal(18,2), parseFloat(row.total))
        .query(`
          INSERT INTO ${costTable}
            (${jobNumCol}, ${costTypeCol}, ${costCodeCol}, ${dateCol}, ${descCol}, ${qtyCol}, ${unitCostCol}, ${totalCol})
          VALUES
            (@jobNum, @type, @code, @date, @desc, @qty, @unitCost, @total)
        `);
      inserted++;
    }
    return { ok: true, inserted };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Close the connection pool (called on server shutdown).
 */
async function closePool() {
  if (_pool) {
    try { await _pool.close(); } catch (_) {}
    _pool = null; _poolConfig = null;
  }
}

module.exports = { testConnection, describeTable, fetchCEJobs, fetchJobPOs, pushJobCosts, closePool };
