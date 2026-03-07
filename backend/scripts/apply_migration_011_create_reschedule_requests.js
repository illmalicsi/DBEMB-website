#!/usr/bin/env node

const { pool } = require('../config/database');

async function run() {
  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query(`
      SELECT 1 AS present
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reschedule_requests'
      LIMIT 1
    `);

    if (Array.isArray(existing) && existing.length > 0) {
      console.log('Migration not required: reschedule_requests already exists.');
      conn.release();
      process.exit(0);
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS reschedule_requests (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id INT DEFAULT NULL,
        user_email VARCHAR(255) NOT NULL,
        requested_date DATE DEFAULT NULL,
        requested_start TIME DEFAULT NULL,
        requested_end TIME DEFAULT NULL,
        status ENUM('submitted','reviewed','approved','rejected') DEFAULT 'submitted',
        admin_note TEXT DEFAULT NULL,
        processed_by INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME DEFAULT NULL,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_res_req_booking (booking_id),
        INDEX idx_res_req_user (user_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await conn.query(sql);
    console.log('Migration completed: created reschedule_requests table.');
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('Migration 011 failed:', err && err.message ? err.message : err);
    try { conn.release(); } catch (e) {}
    process.exit(2);
  }
}

run();
