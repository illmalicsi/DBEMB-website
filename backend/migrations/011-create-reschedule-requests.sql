-- Migration 011: Create reschedule_requests table (idempotent)

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
