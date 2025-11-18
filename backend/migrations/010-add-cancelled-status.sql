-- Migration: Add 'cancelled' to rent_requests.status enum
-- Idempotent: run only if 'cancelled' is not already present

ALTER TABLE rent_requests
  MODIFY COLUMN status ENUM('pending','approved','rejected','paid','returned','cancelled') DEFAULT 'pending';
