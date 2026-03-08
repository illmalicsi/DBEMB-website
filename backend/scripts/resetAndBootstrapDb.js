#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BOOTSTRAP_DIR = path.join(__dirname, '..', 'bootstrap');

function parseArgs(argv) {
  return {
    confirmReset: argv.includes('--confirm-reset'),
    list: argv.includes('--list')
  };
}

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'dbemb',
    port: Number(process.env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
    multipleStatements: true
  };
}

function getBootstrapFiles() {
  if (!fs.existsSync(BOOTSTRAP_DIR)) {
    throw new Error(`Bootstrap folder not found: ${BOOTSTRAP_DIR}`);
  }

  return fs
    .readdirSync(BOOTSTRAP_DIR)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function clearCurrentSchema(conn, dbName) {
  const [tables] = await conn.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
    `,
    [dbName]
  );

  if (!tables.length) {
    console.log('No existing tables found.');
    return;
  }

  console.log(`Dropping ${tables.length} table(s)...`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const row of tables) {
    const tableName = row.table_name;
    await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`  dropped: ${tableName}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function applyBootstrapFiles(conn, files) {
  for (const file of files) {
    const fullPath = path.join(BOOTSTRAP_DIR, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`Applying: ${file}`);
    await conn.query(sql);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = getDbConfig();
  const files = getBootstrapFiles();

  if (args.list) {
    console.log('Bootstrap order:');
    files.forEach((f) => console.log(`  - ${f}`));
    return;
  }

  if (!args.confirmReset) {
    console.error('Refusing to run destructive reset without --confirm-reset');
    console.error('Usage: node scripts/resetAndBootstrapDb.js --confirm-reset');
    process.exit(1);
  }

  if (!files.length) {
    console.log('No bootstrap SQL files found. Nothing to apply.');
    return;
  }

  let conn;
  try {
    conn = await mysql.createConnection(config);

    const [dbRows] = await conn.query('SELECT DATABASE() AS db_name');
    const dbName = dbRows[0] && dbRows[0].db_name;
    if (!dbName) {
      throw new Error('No active database selected. Check DB_NAME in your .env');
    }

    console.log(`Target database: ${dbName}`);
    await clearCurrentSchema(conn, dbName);
    await applyBootstrapFiles(conn, files);

    console.log('Database reset + bootstrap completed.');
  } catch (err) {
    console.error('Reset/bootstrap failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

main();
