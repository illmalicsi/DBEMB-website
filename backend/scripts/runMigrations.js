#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function parseArgs(argv) {
  const args = { list: false, file: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--list') {
      args.list = true;
      continue;
    }
    if (token === '--file') {
      args.file = argv[i + 1] || null;
      i += 1;
    }
  }
  return args;
}

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'dbemb',
    port: Number(process.env.DB_PORT || 3306),
    ssl: {
      rejectUnauthorized: false
    },
    multipleStatements: true
  };
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

function checksumOf(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function readApplied(conn) {
  const [rows] = await conn.query('SELECT migration_name, checksum, applied_at FROM schema_migrations ORDER BY migration_name ASC');
  const map = new Map();
  rows.forEach((row) => map.set(row.migration_name, row));
  return map;
}

async function listStatus(conn, files) {
  const applied = await readApplied(conn);

  console.log('Migration status:');
  files.forEach((name) => {
    if (applied.has(name)) {
      const row = applied.get(name);
      console.log(`  [APPLIED] ${name} (${row.applied_at})`);
    } else {
      console.log(`  [PENDING] ${name}`);
    }
  });
}

async function applyMigration(conn, fileName) {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  const sql = fs.readFileSync(filePath, 'utf8');
  const checksum = checksumOf(sql);

  const [rows] = await conn.query(
    'SELECT migration_name, checksum FROM schema_migrations WHERE migration_name = ? LIMIT 1',
    [fileName]
  );

  if (rows.length > 0) {
    const existing = rows[0];
    if (existing.checksum !== checksum) {
      throw new Error(
        `Checksum mismatch for already-applied migration ${fileName}. Create a new migration file instead of editing old ones.`
      );
    }
    console.log(`Skipping already applied migration: ${fileName}`);
    return;
  }

  console.log(`Applying migration: ${fileName}`);
  await conn.query(sql);
  await conn.query(
    'INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)',
    [fileName, checksum]
  );
  console.log(`Applied: ${fileName}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = getDbConfig();

  let conn;
  try {
    conn = await mysql.createConnection(config);
    await ensureMigrationsTable(conn);

    const files = loadMigrationFiles();
    if (files.length === 0) {
      console.log('No .sql migration files found.');
      return;
    }

    if (args.list) {
      await listStatus(conn, files);
      return;
    }

    const targets = args.file ? [args.file] : files;
    for (const fileName of targets) {
      if (!files.includes(fileName)) {
        throw new Error(`Migration file not found in backend/migrations: ${fileName}`);
      }
      await applyMigration(conn, fileName);
    }

    console.log('Done.');
  } catch (err) {
    console.error('Migration runner failed:', err && err.message ? err.message : err);
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
