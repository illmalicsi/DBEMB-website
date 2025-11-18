#!/usr/bin/env node
/**
 * Safe migration runner for adding 'cancelled' to rent_requests.status ENUM.
 *
 * This script is idempotent: it checks the current COLUMN_TYPE in
 * information_schema and only runs the ALTER TABLE if 'cancelled' is missing.
 *
 * Usage (from backend folder):
 *   node scripts/apply_migration_010_add_cancelled.js
 */

const { pool } = require('../config/database');

async function run() {
  const conn = await pool.getConnection();
  try {
    const dbNameRes = await conn.query('SELECT DATABASE() AS db');
    const dbName = dbNameRes && dbNameRes[0] && dbNameRes[0][0] ? dbNameRes[0][0].db : null;

    const [rows] = await conn.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rent_requests' AND COLUMN_NAME = 'status' LIMIT 1`
    );
    if (!rows || rows.length === 0) {
      console.error('Could not find rent_requests.status column. Aborting.');
      process.exit(1);
    }

    const columnType = rows[0].COLUMN_TYPE; // e.g. "enum('pending','approved',...)"
    if (typeof columnType !== 'string') {
      console.error('Unexpected COLUMN_TYPE:', columnType);
      process.exit(1);
    }

    if (columnType.includes("'cancelled'")) {
      console.log("Migration not required: 'cancelled' already present in rent_requests.status");
      conn.release();
      process.exit(0);
    }

    console.log("'cancelled' missing from enum; applying ALTER TABLE...");

    // We will construct the new enum by appending 'cancelled' to the existing enum values.
    // Extract inner list between parentheses.
    const m = columnType.match(/^enum\((.*)\)$/i);
    if (!m || !m[1]) {
      console.error('Failed to parse enum definition:', columnType);
      process.exit(1);
    }

    const existingList = m[1];
    // Append cancelled (ensure it is quoted)
    const newList = existingList + ", 'cancelled'";

    const sql = `ALTER TABLE rent_requests MODIFY COLUMN status ENUM(${newList}) DEFAULT 'pending'`;

    console.log('Running SQL:', sql);
    await conn.query(sql);
    console.log("Migration completed: 'cancelled' added to rent_requests.status");
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err && err.message ? err.message : err);
    try { conn.release(); } catch (e) {}
    process.exit(2);
  }
}

run();
