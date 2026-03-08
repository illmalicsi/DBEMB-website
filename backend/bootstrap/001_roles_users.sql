-- 001_roles_users.sql
-- Single bootstrap file: create roles first, then users.

CREATE TABLE IF NOT EXISTS roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(50) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (role_id, role_name) VALUES
  (1, 'admin'),
  (2, 'member'),
  (3, 'user')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar LONGTEXT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_reset_token VARCHAR(255) DEFAULT NULL,
  password_reset_expires DATETIME DEFAULT NULL,
  role_id INT DEFAULT 3,
  phone VARCHAR(20),
  birthday DATE,
  instrument VARCHAR(100),
  address TEXT,
  identity_proof VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
  INDEX idx_password_reset_token (password_reset_token),
  INDEX idx_users_role (role_id),
  INDEX idx_users_active (is_active, is_blocked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default admin account
-- Password is stored as plaintext because your current backend supports plaintext
-- login for school project compatibility.
INSERT INTO users (
  first_name,
  last_name,
  email,
  password_hash,
  role_id,
  is_active,
  is_blocked
) VALUES (
  'Ivan Louie',
  'Malicsi',
  'ivanlouiemalicsi@gmail.com',
  'iamtheadminofthiswebsite',
  1,
  1,
  0
)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  password_hash = VALUES(password_hash),
  role_id = VALUES(role_id),
  is_active = VALUES(is_active),
  is_blocked = VALUES(is_blocked);

-- Enforce extra requirements for member accounts only.
DROP TRIGGER IF EXISTS trg_users_member_required_insert;
DROP TRIGGER IF EXISTS trg_users_member_required_update;

DELIMITER $$
CREATE TRIGGER trg_users_member_required_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role_id = 2 THEN
    IF NEW.instrument IS NULL OR TRIM(NEW.instrument) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require instrument';
    END IF;
    IF NEW.birthday IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require birthday';
    END IF;
    IF NEW.phone IS NULL OR TRIM(NEW.phone) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require phone';
    END IF;
    IF NEW.identity_proof IS NULL OR TRIM(NEW.identity_proof) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require identity proof';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_users_member_required_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.role_id = 2 THEN
    IF NEW.instrument IS NULL OR TRIM(NEW.instrument) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require instrument';
    END IF;
    IF NEW.birthday IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require birthday';
    END IF;
    IF NEW.phone IS NULL OR TRIM(NEW.phone) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require phone';
    END IF;
    IF NEW.identity_proof IS NULL OR TRIM(NEW.identity_proof) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member accounts require identity proof';
    END IF;
  END IF;
END$$
DELIMITER ;