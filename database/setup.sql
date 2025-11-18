  -- ============================================================================
  -- DATABASE INITIALIZATION
  -- ============================================================================
  CREATE DATABASE IF NOT EXISTS dbemb;
  USE dbemb;

  -- ============================================================================
  -- HELPER PROCEDURES
  -- ============================================================================
  DROP PROCEDURE IF EXISTS add_index_if_missing;
  DELIMITER $$
  CREATE PROCEDURE add_index_if_missing(tbl VARCHAR(64), idx VARCHAR(64), stmt TEXT)
  BEGIN
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = tbl AND index_name = idx) = 0 THEN
      SET @s = stmt;
      PREPARE st FROM @s;
      EXECUTE st;
      DEALLOCATE PREPARE st;
    END IF;
  END$$
  
  -- --------------------------------------------------------------------------
  -- MIGRATION: consolidate short-name locations into canonical combined names
  -- This block is idempotent: it will move any references to the short-name
  -- rows ('Shrine Hills', 'Matina Crossing') to the canonical
  -- 'Shrine Hills, Matina Crossing' row (if present) and then remove the
  -- short-name rows. It does nothing if the short-name rows are absent.
  -- --------------------------------------------------------------------------

  -- Map any instrument_items that point to the short 'Shrine Hills' row into the canonical row
  UPDATE instrument_items ii
  JOIN (
    SELECT location_id AS src_id FROM (SELECT * FROM locations) AS __l WHERE location_name = 'Shrine Hills' LIMIT 1
  ) s
  JOIN (
    SELECT location_id AS dst_id FROM (SELECT * FROM locations) AS __d WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  ) d ON 1=1
  SET ii.location_id = d.dst_id
  WHERE ii.location_id = s.src_id;

  UPDATE instrument_inventory ii2
  JOIN (
    SELECT location_id AS src_id FROM (SELECT * FROM locations) AS __l WHERE location_name = 'Shrine Hills' LIMIT 1
  ) s2
  JOIN (
    SELECT location_id AS dst_id FROM (SELECT * FROM locations) AS __d WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  ) d2 ON 1=1
  SET ii2.location_id = d2.dst_id
  WHERE ii2.location_id = s2.src_id;

  UPDATE instrument_locations il
  JOIN (
    SELECT location_id AS src_id FROM (SELECT * FROM locations) AS __l WHERE location_name = 'Shrine Hills' LIMIT 1
  ) s3
  JOIN (
    SELECT location_id AS dst_id FROM (SELECT * FROM locations) AS __d WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  ) d3 ON 1=1
  SET il.location_id = d3.dst_id
  WHERE il.location_id = s3.src_id;

  -- Repeat for 'Matina Crossing' -> canonical 'Shrine Hills, Matina Crossing'
  UPDATE instrument_items ii
  JOIN (
    SELECT location_id AS src_id FROM (SELECT * FROM locations) AS __l WHERE location_name = 'Matina Crossing' LIMIT 1
  ) s_m
  JOIN (
    SELECT location_id AS dst_id FROM (SELECT * FROM locations) AS __d WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  ) d_m ON 1=1
  SET ii.location_id = d_m.dst_id
  WHERE ii.location_id = s_m.src_id;

  UPDATE instrument_inventory ii2
  JOIN (
    SELECT location_id AS src_id FROM (SELECT * FROM locations) AS __l WHERE location_name = 'Matina Crossing' LIMIT 1
  ) s2m
  JOIN (
    SELECT location_id AS dst_id FROM (SELECT * FROM locations) AS __d WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  ) d2m ON 1=1
  SET ii2.location_id = d2m.dst_id
  WHERE ii2.location_id = s2m.src_id;

  UPDATE instrument_locations il2
  JOIN (
    SELECT location_id AS src_id FROM (SELECT * FROM locations) AS __l WHERE location_name = 'Matina Crossing' LIMIT 1
  ) s3m
  JOIN (
    SELECT location_id AS dst_id FROM (SELECT * FROM locations) AS __d WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  ) d3m ON 1=1
  SET il2.location_id = d3m.dst_id
  WHERE il2.location_id = s3m.src_id;

  -- Remove the short-name rows if they exist
  DELETE FROM locations WHERE location_name IN ('Shrine Hills', 'Matina Crossing');

  DELIMITER ;

  -- ============================================================================
  -- CORE TABLES: USERS & ROLES
  -- ============================================================================

  -- Roles table
  CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL
  );

  -- Users table with all extensions
  CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar LONGTEXT NULL COMMENT 'User profile picture (base64 encoded or URL)',
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
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    INDEX idx_password_reset_token (password_reset_token)
  );

  -- User indexes
  CALL add_index_if_missing('users','idx_users_role','ALTER TABLE users ADD INDEX idx_users_role (role_id)');
  CALL add_index_if_missing('users','idx_users_active','ALTER TABLE users ADD INDEX idx_users_active (is_active, is_blocked)');

  -- ============================================================================
  -- LOCATIONS MANAGEMENT
  -- ============================================================================

  -- Locations table
  CREATE TABLE IF NOT EXISTS locations (
    location_id INT PRIMARY KEY AUTO_INCREMENT,
    location_name VARCHAR(255) NOT NULL UNIQUE,
    location_type ENUM('primary','secondary') NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

  -- ============================================================================
  -- INSTRUMENTS MANAGEMENT
  -- ============================================================================

  -- Main instruments table
  CREATE TABLE IF NOT EXISTS instruments (
    instrument_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    category ENUM('percussion','wind','brass','woodwind','other') NOT NULL,
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    quantity INT DEFAULT 0,
    primary_location_id INT NULL,
    condition_status ENUM('Excellent','Good','Fair','Poor') DEFAULT 'Good',
    availability_status ENUM('Available','Rented','Borrowed','Maintenance','Unavailable') DEFAULT 'Available',
    price_per_day DECIMAL(10,2) DEFAULT NULL,
    notes TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_instruments_name (name),
    FOREIGN KEY (primary_location_id) REFERENCES locations(location_id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  -- Instrument indexes
  CALL add_index_if_missing('instruments','idx_instruments_status','ALTER TABLE instruments ADD INDEX idx_instruments_status (availability_status)');
  CALL add_index_if_missing('instruments','idx_instruments_category','ALTER TABLE instruments ADD INDEX idx_instruments_category (category)');

  -- Individual instrument items (serial number tracking)
  CREATE TABLE IF NOT EXISTS instrument_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    instrument_id INT NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    location_id INT NULL,
    status ENUM('Available','Rented','Borrowed','Under Maintenance','Retired') DEFAULT 'Available',
    condition_status ENUM('Excellent','Good','Fair','Poor','Needs Repair') DEFAULT 'Good',
    acquisition_date DATE NULL,
    purchase_cost DECIMAL(10,2) NULL,
    current_rental_id INT NULL,
    current_borrow_id INT NULL,
    last_maintenance_date DATE NULL,
    notes TEXT,
    photo_url VARCHAR(500) NULL,
    barcode_data VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (instrument_id) REFERENCES instruments(instrument_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_instrument_items_instrument (instrument_id),
    INDEX idx_instrument_items_serial (serial_number),
    INDEX idx_instrument_items_status (status),
    INDEX idx_instrument_items_location (location_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  -- Instrument inventory by location (with status)
  CREATE TABLE IF NOT EXISTS instrument_inventory (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    instrument_id INT NOT NULL,
    location_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Available',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (instrument_id) REFERENCES instruments(instrument_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_instrument_location (instrument_id, location_id)
  );

  -- Inventory indexes
  CALL add_index_if_missing('instrument_inventory','idx_inventory_instrument','ALTER TABLE instrument_inventory ADD INDEX idx_inventory_instrument (instrument_id)');
  CALL add_index_if_missing('instrument_inventory','idx_inventory_location','ALTER TABLE instrument_inventory ADD INDEX idx_inventory_location (location_id)');
  CALL add_index_if_missing('instrument_inventory','idx_inventory_status','ALTER TABLE instrument_inventory ADD INDEX idx_inventory_status (status)');

  -- Instrument locations (string-based)
  CREATE TABLE IF NOT EXISTS instrument_locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instrument_id INT NOT NULL,
    location_id INT NULL,
    location_name VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (instrument_id) REFERENCES instruments(instrument_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    UNIQUE KEY uq_inst_loc (instrument_id, location_name)
  );

  -- Instrument location indexes
  CALL add_index_if_missing('instrument_locations','idx_instloc_inst','ALTER TABLE instrument_locations ADD INDEX idx_instloc_inst (instrument_id)');

  -- ============================================================================
  -- Inventory data reconciliation and safeguards
  -- The following statements help ensure instruments.quantity reflects the
  -- normalized instrument_inventory table and prevent negative quantities.
  -- These are safe idempotent operations for fresh installs and existing DBs.
  -- ============================================================================

  -- Clamp any negative quantities to zero so legacy bad updates don't persist
  -- Use temporary tables and key-based WHERE clauses so clients like
  -- MySQL Workbench in SQL_SAFE_UPDATES mode will allow the UPDATE.
  CREATE TEMPORARY TABLE IF NOT EXISTS tmp_neg_inventories AS
    SELECT inventory_id FROM instrument_inventory WHERE quantity < 0;

  UPDATE instrument_inventory ii
  SET ii.quantity = 0
  WHERE ii.inventory_id IN (SELECT inventory_id FROM tmp_neg_inventories);

  DROP TEMPORARY TABLE IF EXISTS tmp_neg_inventories;

  CREATE TEMPORARY TABLE IF NOT EXISTS tmp_neg_instruments AS
    SELECT instrument_id FROM instruments WHERE quantity < 0;

  UPDATE instruments i
  SET i.quantity = 0
  WHERE i.instrument_id IN (SELECT instrument_id FROM tmp_neg_instruments);

  DROP TEMPORARY TABLE IF EXISTS tmp_neg_instruments;

  -- Recompute aggregate per-instrument quantity from instrument_inventory (authoritative)
  UPDATE instruments i
  LEFT JOIN (
    SELECT instrument_id, COALESCE(SUM(quantity),0) AS total_qty
    FROM instrument_inventory
    GROUP BY instrument_id
  ) inv ON inv.instrument_id = i.instrument_id
  SET i.quantity = COALESCE(inv.total_qty, 0);

  -- For installations that use serial-tracked items as source-of-truth,
  -- ensure instruments.quantity is at least the count of active instrument_items
  UPDATE instruments i
  LEFT JOIN (
    SELECT instrument_id, COUNT(*) AS tracked
    FROM instrument_items
    WHERE is_active = 1
    GROUP BY instrument_id
  ) itm ON itm.instrument_id = i.instrument_id
  SET i.quantity = GREATEST(i.quantity, COALESCE(itm.tracked, 0));

  -- Create lightweight triggers to prevent negative quantities on writes.
  -- Use DROP IF EXISTS to make re-running this script safe.
  DROP TRIGGER IF EXISTS trg_instrument_inventory_before_insert;
  DROP TRIGGER IF EXISTS trg_instrument_inventory_before_update;
  DROP TRIGGER IF EXISTS trg_instruments_before_update;

  DELIMITER $$
  CREATE TRIGGER trg_instrument_inventory_before_insert
  BEFORE INSERT ON instrument_inventory
  FOR EACH ROW
  BEGIN
    IF NEW.quantity < 0 THEN
      SET NEW.quantity = 0;
    END IF;
  END$$

  CREATE TRIGGER trg_instrument_inventory_before_update
  BEFORE UPDATE ON instrument_inventory
  FOR EACH ROW
  BEGIN
    IF NEW.quantity < 0 THEN
      SET NEW.quantity = 0;
    END IF;
  END$$

  CREATE TRIGGER trg_instruments_before_update
  BEFORE UPDATE ON instruments
  FOR EACH ROW
  BEGIN
    IF NEW.quantity < 0 THEN
      SET NEW.quantity = 0;
    END IF;
  END$$
  DELIMITER ;

  -- Replacement history
  CREATE TABLE IF NOT EXISTS instrument_replacements (
    replacement_id INT PRIMARY KEY AUTO_INCREMENT,
    original_instrument_id INT NOT NULL,
    replacement_instrument_id INT DEFAULT NULL,
    note TEXT,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_instrument_id) REFERENCES instruments(instrument_id) ON DELETE CASCADE,
    FOREIGN KEY (replacement_instrument_id) REFERENCES instruments(instrument_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Replacement indexes
  CALL add_index_if_missing('instrument_replacements','idx_instrep_orig','ALTER TABLE instrument_replacements ADD INDEX idx_instrep_orig (original_instrument_id)');
  CALL add_index_if_missing('instrument_replacements','idx_instrep_rep','ALTER TABLE instrument_replacements ADD INDEX idx_instrep_rep (replacement_instrument_id)');

  -- ============================================================================
  -- SEED: Sample instruments and instrument items
  -- (No seed locations are inserted here to avoid introducing site-specific locations)
  -- ============================================================================

  -- (Trumpet and Snare Drum seeds removed per user request)

  -- (Instrument items for Trumpet and Snare Drum removed per user request)

  -- Assign sample instrument_items to the requested combined location names so the UI shows real names instead of "N/A".
  -- This is idempotent: only items without a valid location_id will be updated.
  UPDATE instrument_items SET location_id = (
    SELECT location_id FROM locations WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  )
  WHERE item_id IN (1,2,3,4,5) AND (location_id IS NULL OR location_id NOT IN (SELECT location_id FROM locations));

  UPDATE instrument_items SET location_id = (
    SELECT location_id FROM locations WHERE location_name = 'Sunrise Village, Matina Aplaya' LIMIT 1
  )
  WHERE item_id IN (6,7,8) AND (location_id IS NULL OR location_id NOT IN (SELECT location_id FROM locations));

  -- Many generated instrument serials use the PER-<inst>-<loc>-<seq> pattern where the
  -- middle token denotes a location index (1 or 2). Map those to the separate site
  -- names so the UI shows 'Shrine Hills' (1) and 'Matina Crossing' (2).
  -- Only update when location_id is NULL or points to a non-known location (idempotent).
  -- Map generated PER-... serials to the canonical combined site 'Shrine Hills, Matina Crossing'
  -- (both older short names map to the combined canonical row).
  UPDATE instrument_items ii
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  SET ii.location_id = l.location_id
  WHERE ii.serial_number LIKE 'PER-%-1-%'
    AND (ii.location_id IS NULL OR ii.location_id NOT IN (SELECT location_id FROM locations));

  UPDATE instrument_items ii
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  SET ii.location_id = l.location_id
  WHERE ii.serial_number LIKE 'PER-%-2-%'
    AND (ii.location_id IS NULL OR ii.location_id NOT IN (SELECT location_id FROM locations));

  -- Update inventory counts for the seeded instruments/locations
  -- Note: instrument_inventory seed omitted to avoid referencing site-specific locations

  -- --------------------------------------------------------------------------
  -- Ensure acquisition_date and purchase_cost exist for all instrument_items
  -- For any existing rows missing these values, set a deterministic acquisition
  -- date in the 2020-2024 range (based on item_id modulo) and reasonable
  -- purchase_cost defaults based on the parent instrument category.
  -- --------------------------------------------------------------------------

  -- Set acquisition_date to a date between 2020-01-01 and ~2024-12-31
  -- Use a JOIN on item_id to avoid MySQL safe-update mode (which requires a key column in the WHERE)
  -- Use a temporary table to collect item_ids missing acquisition_date and
  -- then perform an UPDATE JOIN. This avoids SQL_SAFE_UPDATES errors and
  -- remains idempotent.
  CREATE TEMPORARY TABLE IF NOT EXISTS tmp_missing_acq AS
    SELECT item_id FROM instrument_items WHERE acquisition_date IS NULL;

  -- If there are any missing ids, update them
  UPDATE instrument_items ii
  JOIN tmp_missing_acq t ON ii.item_id = t.item_id
  SET ii.acquisition_date = DATE_ADD('2020-01-01', INTERVAL (ii.item_id % 1826) DAY);

  DROP TEMPORARY TABLE IF EXISTS tmp_missing_acq;

  -- Set purchase_cost based on instrument category when missing
  -- Update purchase_cost for items missing it; join through a derived table to satisfy safe-update
    -- Use a temporary table to collect items missing purchase_cost, then update via JOIN
    -- This avoids the SQL_SAFE_UPDATES restriction (requires WHERE with key column) and is idempotent.
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_missing_cost AS
      SELECT item_id, instrument_id FROM instrument_items WHERE purchase_cost IS NULL;

    UPDATE instrument_items ii
    JOIN tmp_missing_cost t ON ii.item_id = t.item_id
    JOIN instruments i ON t.instrument_id = i.instrument_id
    SET ii.purchase_cost = CASE
      WHEN i.category = 'brass' THEN 12000.00
      WHEN i.category = 'percussion' THEN 8000.00
      WHEN i.category = 'wind' THEN 11000.00
      WHEN i.category = 'woodwind' THEN 10000.00
      ELSE 7000.00
    END;

    DROP TEMPORARY TABLE IF EXISTS tmp_missing_cost;


  -- ============================================================================
  -- FINANCIAL MANAGEMENT
  -- ============================================================================

  -- Invoices table
  CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description VARCHAR(255),
    invoice_number VARCHAR(64) UNIQUE NULL,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
    status ENUM('pending','approved','paid','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  -- Invoice indexes
  CALL add_index_if_missing('invoices','idx_invoices_user','ALTER TABLE invoices ADD INDEX idx_invoices_user (user_id)');
  CALL add_index_if_missing('invoices','idx_invoices_status','ALTER TABLE invoices ADD INDEX idx_invoices_status (status)');

  -- Payments table
  CREATE TABLE IF NOT EXISTS payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash','card','bank_transfer','online') DEFAULT 'cash',
    processed_by INT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  -- Payment indexes
  CALL add_index_if_missing('payments','idx_payments_invoice','ALTER TABLE payments ADD INDEX idx_payments_invoice (invoice_id)');

  -- Transactions table
  CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    invoice_id INT,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(64) DEFAULT NULL,
    transaction_type ENUM('invoice','payment','refund','rental','borrowing') NOT NULL,
    status ENUM('pending','completed','failed','cancelled') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  -- Transaction indexes
  CALL add_index_if_missing('transactions','idx_transactions_user','ALTER TABLE transactions ADD INDEX idx_transactions_user (user_id)');
  CALL add_index_if_missing('transactions','idx_transactions_payment_method','ALTER TABLE transactions ADD INDEX idx_transactions_payment_method (payment_method)');

  -- Expenses table
  CREATE TABLE IF NOT EXISTS expenses (
    expense_id INT PRIMARY KEY AUTO_INCREMENT,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    incurred_by INT NULL,
    incurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incurred_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  -- ============================================================================
  -- BORROW & RENT REQUESTS
  -- ============================================================================

  -- Borrow requests table (with all payment extensions)
  CREATE TABLE IF NOT EXISTS borrow_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    instrument_id INT NOT NULL,
    instrument_item_id INT NULL,
    instrument_name VARCHAR(255) NOT NULL,
    instrument_type VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    purpose TEXT NOT NULL,
    notes TEXT,
    phone VARCHAR(20) NULL,
    status ENUM('pending','approved','rejected','returned') DEFAULT 'pending',
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    location_id INT NULL,
    returned_at TIMESTAMP NULL,
    checkout_condition ENUM('Excellent','Good','Fair','Poor','Needs Repair') NULL,
    checkin_condition ENUM('Excellent','Good','Fair','Poor','Needs Repair') NULL,
    damage_fee DECIMAL(10,2) DEFAULT 0.00,
    deposit_amount DECIMAL(10,2) DEFAULT 0.00,
    deposit_returned BOOLEAN DEFAULT FALSE,
    payment_mode VARCHAR(50) NULL COMMENT 'Payment method: cash, gcash, credit-card, debit-card, bank-transfer',
    payment_type VARCHAR(20) NULL DEFAULT 'full' COMMENT 'Payment type: full or down (50%)',
    payment_amount DECIMAL(10,2) NULL COMMENT 'Amount paid (either full or down payment)',
    total_amount DECIMAL(10,2) NULL COMMENT 'Total rental fee amount',
    remaining_balance DECIMAL(10,2) NULL DEFAULT 0 COMMENT 'Remaining balance if down payment was made',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (instrument_item_id) REFERENCES instrument_items(item_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  -- Borrow request indexes
  CALL add_index_if_missing('borrow_requests','idx_borrow_requests_user','ALTER TABLE borrow_requests ADD INDEX idx_borrow_requests_user (user_id)');
  CALL add_index_if_missing('borrow_requests','idx_borrow_requests_status','ALTER TABLE borrow_requests ADD INDEX idx_borrow_requests_status (status)');

  -- Rent requests table (with all payment extensions)
  CREATE TABLE IF NOT EXISTS rent_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    instrument_id INT NOT NULL,
    instrument_item_id INT NULL,
    instrument_name VARCHAR(255) NOT NULL,
    instrument_type VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    purpose TEXT NOT NULL,
    notes TEXT,
    phone VARCHAR(20) NULL,
    rental_fee DECIMAL(10,2),
    late_fee DECIMAL(10,2) DEFAULT 0.00,
    damage_fee DECIMAL(10,2) DEFAULT 0.00,
    deposit_amount DECIMAL(10,2) DEFAULT 0.00,
    deposit_returned BOOLEAN DEFAULT FALSE,
  status ENUM('pending','approved','rejected','paid','returned') DEFAULT 'pending',
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    location_id INT NULL,
    paid_at TIMESTAMP NULL,
    returned_at TIMESTAMP NULL,
    checkout_condition ENUM('Excellent','Good','Fair','Poor','Needs Repair') NULL,
    checkin_condition ENUM('Excellent','Good','Fair','Poor','Needs Repair') NULL,
    invoice_id INT NULL,
    payment_mode VARCHAR(50) NULL COMMENT 'Payment method: cash, gcash, credit-card, debit-card, bank-transfer',
    payment_type VARCHAR(20) NULL DEFAULT 'full' COMMENT 'Payment type: full or down (50%)',
    payment_amount DECIMAL(10,2) NULL COMMENT 'Amount paid (either full or down payment)',
    total_amount DECIMAL(10,2) NULL COMMENT 'Total rental fee amount',
    remaining_balance DECIMAL(10,2) NULL DEFAULT 0 COMMENT 'Remaining balance if down payment was made',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (instrument_item_id) REFERENCES instrument_items(item_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL ON UPDATE CASCADE
    ,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  -- Rent request indexes
  CALL add_index_if_missing('rent_requests','idx_rent_requests_user','ALTER TABLE rent_requests ADD INDEX idx_rent_requests_user (user_id)');
  CALL add_index_if_missing('rent_requests','idx_rent_requests_status','ALTER TABLE rent_requests ADD INDEX idx_rent_requests_status (status)');
  -- reserved_location index removed (reserved columns removed)

  -- ============================================================================
  -- Migration: Ensure 'cancelled' status exists on rent_requests.status ENUM
  -- This ALTER is safe to run repeatedly: if the enum already contains
  -- 'cancelled' the MODIFY will effectively be a no-op.
  -- Added 2025-11-18
  ALTER TABLE rent_requests
    MODIFY COLUMN status ENUM('pending','approved','rejected','paid','returned','cancelled') DEFAULT 'pending';



  -- Condition assessment foreign keys/indexes removed with table.

  -- Update foreign keys for instrument_items
  SET @fk_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE table_schema = DATABASE() 
    AND table_name = 'instrument_items' 
    AND CONSTRAINT_NAME = 'fk_item_current_rental'
  );
  SET @stmt = IF(@fk_exists = 0,
    'ALTER TABLE instrument_items ADD CONSTRAINT fk_item_current_rental FOREIGN KEY (current_rental_id) REFERENCES rent_requests(request_id) ON DELETE SET NULL',
    'SELECT 1');
  PREPARE st FROM @stmt; EXECUTE st; DEALLOCATE PREPARE st;

  SET @fk_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE table_schema = DATABASE() 
    AND table_name = 'instrument_items' 
    AND CONSTRAINT_NAME = 'fk_item_current_borrow'
  );
  SET @stmt = IF(@fk_exists = 0,
    'ALTER TABLE instrument_items ADD CONSTRAINT fk_item_current_borrow FOREIGN KEY (current_borrow_id) REFERENCES borrow_requests(request_id) ON DELETE SET NULL',
    'SELECT 1');
  PREPARE st FROM @stmt; EXECUTE st; DEALLOCATE PREPARE st;

  -- ============================================================================
  -- SERVICES & BOOKINGS
  -- ============================================================================

  -- Band packages table
  CREATE TABLE IF NOT EXISTS band_packages (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    package_key VARCHAR(100) UNIQUE NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    num_players INT,
    includes_food BOOLEAN DEFAULT FALSE,
    includes_transport BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

  -- Services table
  CREATE TABLE IF NOT EXISTS services (
    service_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    default_price DECIMAL(10,2) DEFAULT NULL,
    duration_minutes INT DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

  -- Bookings table (with all extensions)
  CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    customer_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    service VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255) NOT NULL,
    estimated_value DECIMAL(10,2),
    status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
    notes TEXT,
    package_type VARCHAR(255) NULL COMMENT 'Band package selection for Band Gigs/Parade Events',
    rental_instrument VARCHAR(255) NULL COMMENT 'Instrument name for rentals',
    rental_start_date DATE NULL COMMENT 'Rental start date for instrument rentals',
    rental_end_date DATE NULL COMMENT 'Rental end date for instrument rentals',
    num_pieces INT NULL COMMENT 'Number of pieces for Music Arrangement service',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_by INT NULL,
    approved_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );

  -- Booking indexes
  CALL add_index_if_missing('bookings','idx_bookings_user','ALTER TABLE bookings ADD INDEX idx_bookings_user (user_id)');
  CALL add_index_if_missing('bookings','idx_bookings_status','ALTER TABLE bookings ADD INDEX idx_bookings_status (status)');
  CALL add_index_if_missing('bookings','idx_bookings_date','ALTER TABLE bookings ADD INDEX idx_bookings_date (date)');
  CALL add_index_if_missing('bookings','idx_bookings_email','ALTER TABLE bookings ADD INDEX idx_bookings_email (email)');
  CALL add_index_if_missing('bookings','idx_booking_date_status','ALTER TABLE bookings ADD INDEX idx_booking_date_status (date, status)');
  CALL add_index_if_missing('bookings','idx_booking_created_at','ALTER TABLE bookings ADD INDEX idx_booking_created_at (created_at)');

  -- Booking payments table
  CREATE TABLE IF NOT EXISTS booking_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME NOT NULL,
    payment_status VARCHAR(32) NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
  );

  -- ============================================================================
  -- NOTIFICATIONS & AUDIT
  -- ============================================================================

  -- Notifications table
  CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSON DEFAULT NULL,
    read_at DATETIME DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_by INT NULL,
    INDEX idx_user_email (user_email),
    INDEX idx_read_at (read_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  -- Reschedule requests table: stores customer-initiated reschedule requests for bookings
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

  -- Audit log table
  CREATE TABLE IF NOT EXISTS audit_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(64) NOT NULL,
    record_id INT NOT NULL,
    action ENUM('CREATE','UPDATE','DELETE','CHECKOUT','CHECKIN','APPROVE','REJECT','ARCHIVE') NOT NULL,
    user_id INT NULL,
    user_email VARCHAR(255) NULL,
    before_value JSON NULL,
    after_value JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_audit_table (table_name, record_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


  -- ============================================================================
  -- SEED DATA: ROLES & USERS
  -- ============================================================================

  INSERT INTO roles (role_id, role_name) VALUES
    (1, 'admin'),
    (2, 'member'),
    (3, 'user')
  ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

  INSERT INTO users (first_name, last_name, email, password_hash, role_id)
  VALUES (
    'Ivan Louie',
    'Malicsi',
    'ivanlouiemalicsi@gmail.com',
    'Admin123!',
    1
  ) ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash),
    role_id = VALUES(role_id);

  INSERT INTO users (first_name, last_name, email, password_hash, role_id) VALUES
    ('Harley', 'Cuba', 'hlncuba@addu.edu.ph', 'password123', 2),
    ('Jan Aceryl', 'Futalan', 'jnfutalan@addu.edu.ph', 'password123', 3),
    ('Ivan', 'Lim', 'ilimlouiemalicsi@gmail.com', 'password123', 3),
    ('Harley', 'Potter', 'harley.potter@blueeagles.com', 'HarleyPass123!', 3)
  ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash);

  UPDATE users 
  SET email = TRIM(email)
  WHERE id > 0;

  -- ============================================================================
  -- SEED DATA: LOCATIONS
  -- ============================================================================

  -- Canonical site locations used by the application. Keep these idempotent.
  INSERT INTO locations (location_name, location_type, address) VALUES
    ('Shrine Hills, Matina Crossing', 'primary', 'Shrine Hills, Matina Crossing, Davao City'),
    ('Sunrise Village, Matina Aplaya', 'secondary', 'Sunrise Village, Matina Aplaya, Davao City')
  ON DUPLICATE KEY UPDATE location_type = VALUES(location_type), address = VALUES(address);

  -- NOTE: short-name rows (eg 'Shrine Hills', 'Matina Crossing') were previously
  -- created to support older mapping logic. We intentionally no longer create
  -- them here to keep the canonical set to exactly two locations.

  -- Prevent creation of other ad-hoc locations at runtime by raising an error on disallowed inserts/updates.
  -- This is intentionally strict for development environments; remove or relax if you expect more locations later.
  DROP TRIGGER IF EXISTS tr_block_other_locations_insert;
  DROP TRIGGER IF EXISTS tr_block_other_locations_update;
  DELIMITER $$
  CREATE TRIGGER tr_block_other_locations_insert
  BEFORE INSERT ON locations
  FOR EACH ROW
  BEGIN
    IF NEW.location_name NOT IN (
      'Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya'
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insertion blocked: only predefined locations are allowed.';
    END IF;
  END$$


  CREATE TRIGGER tr_block_other_locations_update
  BEFORE UPDATE ON locations
  FOR EACH ROW
  BEGIN
    IF NEW.location_name NOT IN (
      'Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya'
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Update blocked: only predefined locations are allowed.';
    END IF;
  END$$
  -- Additional instrument seeds (ensure this INSERT has the proper columns)
  INSERT INTO instruments (name, category, subcategory, brand, condition_status, availability_status, price_per_day) VALUES
    -- Snare Drums
    ('Yamaha Black Snare Drum #01', 'percussion', 'Snare Drums', 'Yamaha', 'Good', 'Available', 1000.00),
    ('Yamaha Black Snare Drum #02', 'percussion', 'Snare Drums', 'Yamaha', 'Good', 'Available', 1000.00),
    ('Yamaha Black Snare Drum (Evans Drum Head) #03', 'percussion', 'Snare Drums', 'Yamaha', 'Excellent', 'Available', 1000.00),
    ('Pearl Snare Drum Color White #01', 'percussion', 'Snare Drums', 'Pearl', 'Good', 'Available', 1000.00),
    ('Pearl Snare Drum Color Dirt White #02', 'percussion', 'Snare Drums', 'Pearl', 'Fair', 'Available', 1000.00),
    
    -- Bass Drums
    ('Lazer Bass Drum #01', 'percussion', 'Bass Drums', 'Lazer', 'Good', 'Available', 500.00),
    ('E-lance Bass Drum #02', 'percussion', 'Bass Drums', 'E-lance', 'Good', 'Available', 500.00),
    ('E-lance Bass Drum #03', 'percussion', 'Bass Drums', 'E-lance', 'Good', 'Available', 500.00),
    ('E-lance Bass Drum #04', 'percussion', 'Bass Drums', 'E-lance', 'Good', 'Available', 500.00),
    ('Fernando Bass Drum #02', 'percussion', 'Bass Drums', 'Fernando', 'Good', 'Available', 500.00),
    
    -- Tenor Drums
    ('E-lance Percussion Black Tenor Drums', 'percussion', 'Tenor Drums', 'E-lance', 'Good', 'Available', 500.00),
    ('Century Percussion White Tenor Drums', 'percussion', 'Tenor Drums', 'Century', 'Good', 'Available', 500.00),
    
    -- Cymbals
    ('Zildjian Marching Cymbals', 'percussion', 'Cymbals', 'Zildjian', 'Excellent', 'Available', 500.00),
    
    -- Other Percussion
    ('E-lance Percussion Marching Glockenspiel #01', 'percussion', 'Other Percussion', 'E-lance', 'Good', 'Available', 500.00),
    ('E-lance Percussion Marching Glockenspiel #02', 'percussion', 'Other Percussion', 'E-lance', 'Good', 'Available', 500.00),
    
    -- Woodwind & Brass
    ('Yamaha Clarinet', 'woodwind', 'Woodwinds', 'Yamaha', 'Good', 'Available', 500.00),
    ('Fernando Tuba', 'brass', 'Brass', 'Fernando', 'Good', 'Available', 500.00)
  ON DUPLICATE KEY UPDATE name = VALUES(name);

  -- ============================================================================
  -- SEED DATA: INSTRUMENT INVENTORY
  -- ============================================================================

  -- Temporarily drop triggers to avoid conflicts during seed data
  DROP TRIGGER IF EXISTS tr_instrument_inventory_after_insert;
  DROP TRIGGER IF EXISTS tr_instrument_inventory_after_update;
  DROP TRIGGER IF EXISTS tr_instrument_inventory_after_delete;

  INSERT INTO instrument_inventory (instrument_id, location_id, quantity, status)
  SELECT i.instrument_id, l.location_id, 1, 'Available'
  FROM instruments i
  CROSS JOIN locations l 
  WHERE l.location_name IN ('Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya')
  ON DUPLICATE KEY UPDATE 
    quantity = VALUES(quantity),
    status = VALUES(status);

  -- Recreate triggers after seed data
  DELIMITER $

  CREATE TRIGGER tr_instrument_inventory_after_insert
  AFTER INSERT ON instrument_inventory
  FOR EACH ROW
  BEGIN
    UPDATE instruments 
    SET quantity = COALESCE(quantity,0) + NEW.quantity 
    WHERE instrument_id = NEW.instrument_id;
  END$

  CREATE TRIGGER tr_instrument_inventory_after_update
  AFTER UPDATE ON instrument_inventory
  FOR EACH ROW
  BEGIN
    UPDATE instruments 
    SET quantity = COALESCE(quantity,0) - COALESCE(OLD.quantity,0) + COALESCE(NEW.quantity,0) 
    WHERE instrument_id = NEW.instrument_id;
    
    IF OLD.instrument_id IS NOT NULL AND OLD.instrument_id != NEW.instrument_id THEN
      UPDATE instruments 
      SET quantity = COALESCE(quantity,0) - COALESCE(OLD.quantity,0) 
      WHERE instrument_id = OLD.instrument_id;
    END IF;
  END$

  CREATE TRIGGER tr_instrument_inventory_after_delete
  AFTER DELETE ON instrument_inventory
  FOR EACH ROW
  BEGIN
    UPDATE instruments 
    SET quantity = COALESCE(quantity,0) - COALESCE(OLD.quantity,0) 
    WHERE instrument_id = OLD.instrument_id;
  END$

  DELIMITER ;

  -- Populate instrument_locations from inventory
  INSERT IGNORE INTO instrument_locations (instrument_id, location_id, location_name, quantity, status)
  SELECT ii.instrument_id, ii.location_id, l.location_name, ii.quantity, ii.status
  FROM instrument_inventory ii
  JOIN locations l ON ii.location_id = l.location_id;

  -- Set primary location for all instruments
  UPDATE instruments
  SET primary_location_id = (
    SELECT location_id FROM locations WHERE location_name = 'Shrine Hills, Matina Crossing' LIMIT 1
  )
  WHERE instrument_id > 0;

  -- Fallback: set primary location to first available location if still NULL
  UPDATE instruments i
  JOIN (
    SELECT instrument_id, MIN(location_id) AS location_id
    FROM instrument_inventory
    GROUP BY instrument_id
  ) t ON t.instrument_id = i.instrument_id
  SET i.primary_location_id = t.location_id
  WHERE i.primary_location_id IS NULL;

  -- Update total quantities
  -- Compute per-instrument total from instrument_inventory, but ensure each instrument
  -- has at least one unit per canonical site (Shrine Hills & Sunrise Village) so totals
  -- reflect the seeded inventory (1 per site). This is idempotent and uses joins
  -- so it will work with SQL_SAFE_UPDATES enabled in MySQL clients.
  UPDATE instruments i
  LEFT JOIN (
    SELECT instrument_id, SUM(quantity) AS total_quantity
    FROM instrument_inventory
    GROUP BY instrument_id
  ) t ON t.instrument_id = i.instrument_id
  JOIN (
    SELECT COUNT(*) AS canonical_sites FROM locations
    WHERE location_name IN ('Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya')
  ) s
  SET i.quantity = GREATEST(COALESCE(t.total_quantity, 0), s.canonical_sites)
  WHERE i.instrument_id > 0;

  -- ============================================================================
  -- SEED DATA: SERVICES
  -- ============================================================================

  INSERT INTO services (name, description, default_price, duration_minutes) VALUES
    ('Band Gigs', 'Full band performance for events', 20000.00, 240),
    ('Parade Events', 'Marching band performance for parades', 15000.00, 180),
    ('Instrument Rentals', 'Short-term instrument rentals', 500.00, NULL),
    ('Music Arrangement', 'Custom music arrangement per piece', 3000.00, NULL),
    ('Music Workshops', 'Educational workshops and masterclasses', 5000.00, 180)
  ON DUPLICATE KEY UPDATE 
    description = VALUES(description), 
    default_price = VALUES(default_price);

  -- ============================================================================
  -- SEED DATA: BAND PACKAGES
  -- ============================================================================

  INSERT INTO band_packages (package_key, package_name, description, price, num_players, includes_food, includes_transport, display_order) VALUES
    ('20-players-with', '20 Players (with Food & Transport)', 'Band package with 20 players including food and transport', 15000.00, 20, TRUE, TRUE, 1),
    ('20-players-without', '20 Players (without Food & Transport)', 'Band package with 20 players without food and transport', 20000.00, 20, FALSE, FALSE, 2),
    ('30-players-with', '30 Players (with Food & Transport)', 'Band package with 30 players including food and transport', 25000.00, 30, TRUE, TRUE, 3),
    ('30-players-without', '30 Players (without Food & Transport)', 'Band package with 30 players without food and transport', 30000.00, 30, FALSE, FALSE, 4),
    ('full-band', 'Full Band', 'Complete band setup with all musicians', 35000.00, NULL, FALSE, FALSE, 5)
  ON DUPLICATE KEY UPDATE 
    package_name = VALUES(package_name),
    price = VALUES(price);


  -- Example explicit items for the seeded percussion/brass/woodwind instruments
  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('SN-', i.instrument_id, '-001') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2021-03-15'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'Yamaha Black Snare Drum #01'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('SN-', i.instrument_id, '-001'))
  LIMIT 1;

  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('SN-', i.instrument_id, '-002') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2021-04-10'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'Yamaha Black Snare Drum #02'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('SN-', i.instrument_id, '-002'))
  LIMIT 1;

  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('SN-', i.instrument_id, '-003') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2020-09-05'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'Yamaha Black Snare Drum (Evans Drum Head) #03'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('SN-', i.instrument_id, '-003'))
  LIMIT 1;

  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('SN-', i.instrument_id, '-004') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2022-01-20'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'Pearl Snare Drum Color White #01'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('SN-', i.instrument_id, '-004'))
  LIMIT 1;

  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('SN-', i.instrument_id, '-005') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2022-02-14'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'Pearl Snare Drum Color Dirt White #02'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('SN-', i.instrument_id, '-005'))
  LIMIT 1;

  -- Bass drums
  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('BD-', i.instrument_id, '-001') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2020-06-30'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Sunrise Village, Matina Aplaya'
  WHERE i.name = 'Lazer Bass Drum #01'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('BD-', i.instrument_id, '-001'))
  LIMIT 1;

  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('BD-', i.instrument_id, '-002') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2021-08-11'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Sunrise Village, Matina Aplaya'
  WHERE i.name = 'E-lance Bass Drum #02'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('BD-', i.instrument_id, '-002'))
  LIMIT 1;

  -- Glockenspiels
  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('GL-', i.instrument_id, '-001') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2023-03-01'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'E-lance Percussion Marching Glockenspiel #01'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('GL-', i.instrument_id, '-001'))
  LIMIT 1;

  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('GL-', i.instrument_id, '-002') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2023-03-05'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'E-lance Percussion Marching Glockenspiel #02'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('GL-', i.instrument_id, '-002'))
  LIMIT 1;

  -- Woodwind / Brass
  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('WW-', i.instrument_id, '-001') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2020-11-11'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Shrine Hills, Matina Crossing'
  WHERE i.name = 'Yamaha Clarinet'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('WW-', i.instrument_id, '-001'))
  LIMIT 1;

  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT i.instrument_id,
         CONCAT('BR-', i.instrument_id, '-001') AS serial_number,
         l.location_id,
         'Available',
         i.condition_status,
         '2019-12-01'
  FROM instruments i
  JOIN locations l ON l.location_name = 'Sunrise Village, Matina Aplaya'
  WHERE i.name = 'Fernando Tuba'
    AND NOT EXISTS (SELECT 1 FROM instrument_items WHERE serial_number = CONCAT('BR-', i.instrument_id, '-001'))
  LIMIT 1;

  -- Small buffer: ensure these explicit items are present before the generator runs
  -- Ensure every instrument has one instrument_item at each canonical site
  -- Insert one item per instrument x location (Shrine Hills, Matina Crossing & Sunrise Village, Matina Aplaya)
  -- Idempotent: only inserts when that instrument/location pair doesn't already have an item
  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT
    i.instrument_id,
    CONCAT(UPPER(SUBSTRING(i.category,1,3)), '-', i.instrument_id, '-', l.location_id, '-001') AS serial_number,
    l.location_id,
    'Available',
    i.condition_status,
    DATE_ADD('2020-01-01', INTERVAL ((i.instrument_id + l.location_id) % 1826) DAY) AS acquisition_date
  FROM instruments i
  JOIN locations l ON l.location_name IN ('Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya')
  WHERE NOT EXISTS (
    SELECT 1 FROM instrument_items ii WHERE ii.instrument_id = i.instrument_id AND ii.location_id = l.location_id
  );

  -- Generate serial numbers for existing instruments
  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date)
  SELECT 
    i.instrument_id,
    CONCAT(
      UPPER(SUBSTRING(i.category, 1, 3)), ~
      '-',
      i.instrument_id,
      '-',
      ii.location_id,
      '-',
      LPAD((@row_num := @row_num + 1), 4, '0')
    ) AS serial_number,
    ii.location_id,
    CASE 
      WHEN i.availability_status = 'Available' THEN 'Available'
      WHEN i.availability_status = 'Rented' THEN 'Rented'
      WHEN i.availability_status = 'Borrowed' THEN 'Borrowed'
      WHEN i.availability_status = 'Maintenance' THEN 'Under Maintenance'
      ELSE 'Available'
    END AS status,
    i.condition_status,
    CURDATE() - INTERVAL FLOOR(RAND() * 365) DAY AS acquisition_date
  FROM instruments i
  CROSS JOIN instrument_inventory ii ON i.instrument_id = ii.instrument_id
  CROSS JOIN (SELECT @row_num := 0) r
  WHERE ii.quantity > 0
    AND NOT EXISTS (
      SELECT 1 FROM instrument_items 
      WHERE instrument_id = i.instrument_id 
      AND location_id = ii.location_id
    )
  LIMIT 1000;

  -- --------------------------------------------------------------------------
  -- QUICKSEED: Ensure one instrument_item per instrument_inventory row when missing
  -- Idempotent: inserts a single instrument_item for each instrument/location that
  -- currently does not have any instrument_items. This is useful for quick local
  -- developer setups and mirrors the separate quickseed script.
  -- --------------------------------------------------------------------------
  INSERT INTO instrument_items (
    instrument_id,
    serial_number,
    location_id,
    status,
    condition_status,
    acquisition_date,
    purchase_cost,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    ii.instrument_id,
    CONCAT(
      UPPER(SUBSTRING(i.category,1,3)), '-', i.instrument_id, '-', ii.location_id, '-',
      LPAD(
        (
          SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(it.serial_number, '-', -1) AS UNSIGNED)), 0) + 1
          FROM instrument_items it
          WHERE it.instrument_id = ii.instrument_id AND it.location_id = ii.location_id
        ),
        4,
        '0'
      )
    ) AS serial_number,
    ii.location_id,
    CASE
      WHEN i.availability_status = 'Available' THEN 'Available'
      WHEN i.availability_status = 'Rented' THEN 'Rented'
      WHEN i.availability_status = 'Borrowed' THEN 'Borrowed'
      WHEN i.availability_status = 'Maintenance' THEN 'Under Maintenance'
      ELSE 'Available'
    END AS status,
    COALESCE(i.condition_status, 'Good') AS condition_status,
    DATE_ADD('2020-01-01', INTERVAL ((ii.instrument_id + ii.location_id) % 1826) DAY) AS acquisition_date,
    CASE
      WHEN i.category = 'brass' THEN 12000.00
      WHEN i.category = 'percussion' THEN 8000.00
      WHEN i.category = 'wind' THEN 11000.00
      WHEN i.category = 'woodwind' THEN 10000.00
      ELSE 7000.00
    END AS purchase_cost,
    TRUE AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
  FROM instrument_inventory ii
  JOIN instruments i ON i.instrument_id = ii.instrument_id
  LEFT JOIN instrument_items it_check ON it_check.instrument_id = ii.instrument_id AND it_check.location_id = ii.location_id
  WHERE ii.quantity > 0
    AND it_check.item_id IS NULL;

  -- --------------------------------------------------------------------------
  -- MINISEED: If no instrument_items exist at all, populate a minimal set
  -- This helps developers quickly get the UI working without running the full
  -- application-level seed. Idempotent: only runs when instrument_items is empty.
  -- --------------------------------------------------------------------------
  INSERT INTO instruments (name, category, subcategory, brand, condition_status, availability_status, price_per_day)
  SELECT * FROM (
    SELECT 'Dev Snare Drum' AS name, 'percussion' AS category, 'Snare Drums' AS subcategory, 'DevBrand' AS brand, 'Good' AS condition_status, 'Available' AS availability_status, 1000.00 AS price_per_day
    UNION ALL
    SELECT 'Dev Bass Drum', 'percussion', 'Bass Drums', 'DevBrand', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Dev Clarinet', 'woodwind', 'Woodwinds', 'DevBrand', 'Good', 'Available', 500.00
    UNION ALL
    -- Also include the common seeded instruments so the MINISEED provides a fuller dev dataset
  -- Snare Drums
  SELECT 'Yamaha Black Snare Drum #01', 'percussion', 'Snare Drums', 'Yamaha', 'Good', 'Available', 1000.00
    UNION ALL
    SELECT 'Yamaha Black Snare Drum #02', 'percussion', 'Snare Drums', 'Yamaha', 'Good', 'Available', 1000.00
    UNION ALL
    SELECT 'Yamaha Black Snare Drum (Evans Drum Head) #03', 'percussion', 'Snare Drums', 'Yamaha', 'Excellent', 'Available', 1000.00
    UNION ALL
    SELECT 'Pearl Snare Drum Color White #01', 'percussion', 'Snare Drums', 'Pearl', 'Good', 'Available', 1000.00
    UNION ALL
    SELECT 'Pearl Snare Drum Color Dirt White #02', 'percussion', 'Snare Drums', 'Pearl', 'Fair', 'Available', 1000.00
    -- Additional Snare Drum examples
    UNION ALL
    SELECT 'Yamaha Marching Snare 14x6.5', 'percussion', 'Snare Drums', 'Yamaha', 'Good', 'Available', 1000.00
    UNION ALL
    SELECT 'Pearl Modern Snare 14x6', 'percussion', 'Snare Drums', 'Pearl', 'Good', 'Available', 1000.00
    UNION ALL
    SELECT 'Ludwig Classic Snare 14x5.5', 'percussion', 'Snare Drums', 'Ludwig', 'Good', 'Available', 1000.00
    UNION ALL
    SELECT 'Mapex Marching Snare 14x7', 'percussion', 'Snare Drums', 'Mapex', 'Good', 'Available', 1000.00
    UNION ALL
    SELECT 'Gretsch Signature Snare 14x6.5', 'percussion', 'Snare Drums', 'Gretsch', 'Good', 'Available', 1000.00
    -- Bass Drums
    UNION ALL
    SELECT 'Lazer Bass Drum #01', 'percussion', 'Bass Drums', 'Lazer', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'E-lance Bass Drum #02', 'percussion', 'Bass Drums', 'E-lance', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'E-lance Bass Drum #03', 'percussion', 'Bass Drums', 'E-lance', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'E-lance Bass Drum #04', 'percussion', 'Bass Drums', 'E-lance', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Fernando Bass Drum #02', 'percussion', 'Bass Drums', 'Fernando', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Pearl Marching Bass 22x14', 'percussion', 'Bass Drums', 'Pearl', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Yamaha Bass Drum 24x14', 'percussion', 'Bass Drums', 'Yamaha', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Ludwig Bass Drum 26x16', 'percussion', 'Bass Drums', 'Ludwig', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Mapex Bass Drum 24x15', 'percussion', 'Bass Drums', 'Mapex', 'Good', 'Available', 500.00
    -- Tenor Drums
    UNION ALL
    SELECT 'E-lance Percussion Black Tenor Drums', 'percussion', 'Tenor Drums', 'E-lance', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Century Percussion White Tenor Drums', 'percussion', 'Tenor Drums', 'Century', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Yamaha Quad Tenor Set', 'percussion', 'Tenor Drums', 'Yamaha', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Pearl Tenor Quartet', 'percussion', 'Tenor Drums', 'Pearl', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Mapex Tenor Set', 'percussion', 'Tenor Drums', 'Mapex', 'Good', 'Available', 500.00
    -- Cymbals
    UNION ALL
    SELECT 'Zildjian Marching Cymbals', 'percussion', 'Cymbals', 'Zildjian', 'Excellent', 'Available', 500.00
    UNION ALL
    SELECT 'Zildjian Marching Cymbal Pair 18in', 'percussion', 'Cymbals', 'Zildjian', 'Excellent', 'Available', 500.00
    UNION ALL
    SELECT 'Sabian Marching Cymbal Pair 18in', 'percussion', 'Cymbals', 'Sabian', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Meinl Marching Cymbal 18in', 'percussion', 'Cymbals', 'Meinl', 'Good', 'Available', 500.00
    -- Other Percussion
    UNION ALL
    SELECT 'E-lance Percussion Marching Glockenspiel #01', 'percussion', 'Other Percussion', 'E-lance', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'E-lance Percussion Marching Glockenspiel #02', 'percussion', 'Other Percussion', 'E-lance', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'E-lance Glockenspiel Marching', 'percussion', 'Other Percussion', 'E-lance', 'Good', 'Available', 400.00
    UNION ALL
    SELECT 'Yamaha Marching Tambourine', 'percussion', 'Other Percussion', 'Yamaha', 'Good', 'Available', 200.00
    UNION ALL
    SELECT 'Century Marching Triangle', 'percussion', 'Other Percussion', 'Century', 'Good', 'Available', 150.00
    UNION ALL
    SELECT 'Marimba Practice Pad', 'percussion', 'Other Percussion', 'Generic', 'Good', 'Available', 300.00
    -- Woodwind & Brass
    UNION ALL
    SELECT 'Yamaha Clarinet', 'woodwind', 'Woodwinds', 'Yamaha', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Yamaha Bb Clarinet', 'woodwind', 'Woodwinds', 'Yamaha', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Buffet Clarinet Bb', 'woodwind', 'Woodwinds', 'Buffet', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Yamaha Alto Saxophone', 'woodwind', 'Woodwinds', 'Yamaha', 'Good', 'Available', 700.00
    UNION ALL
    SELECT 'Selmer Alto Saxophone', 'woodwind', 'Woodwinds', 'Selmer', 'Good', 'Available', 800.00
    UNION ALL
    SELECT 'Fernando Tuba', 'brass', 'Brass', 'Fernando', 'Good', 'Available', 500.00
    UNION ALL
    SELECT 'Vincent Bach Trombone', 'brass', 'Brass', 'Vincent Bach', 'Good', 'Available', 600.00
    UNION ALL
    SELECT 'Yamaha Trumpet YTR-2330', 'brass', 'Brass', 'Yamaha', 'Good', 'Available', 400.00
    UNION ALL
    SELECT 'Conn Tuba', 'brass', 'Brass', 'Conn', 'Good', 'Available', 900.00
    UNION ALL
    SELECT 'King Cornet', 'brass', 'Brass', 'King', 'Good', 'Available', 350.00
   
  ) t
  WHERE NOT EXISTS (SELECT 1 FROM instrument_items LIMIT 1)
  ON DUPLICATE KEY UPDATE name = VALUES(name);

  -- Ensure canonical locations exist (no-op if present)
  INSERT INTO locations (location_name, location_type, address)
  SELECT * FROM (
    SELECT 'Shrine Hills, Matina Crossing','primary','Shrine Hills, Matina Crossing, Davao City'
    UNION ALL
    SELECT 'Sunrise Village, Matina Aplaya','secondary','Sunrise Village, Matina Aplaya, Davao City'
  ) l
  WHERE NOT EXISTS (SELECT 1 FROM instrument_items LIMIT 1)
  ON DUPLICATE KEY UPDATE address = VALUES(address);

  -- Populate instrument_inventory for the new dev instruments across canonical sites
  -- Temporarily drop inventory triggers to avoid MySQL trigger limitation
  -- (triggers update `instruments` and cannot run while the INSERT SELECT reads `instruments`).
  DROP TRIGGER IF EXISTS tr_instrument_inventory_after_insert;
  DROP TRIGGER IF EXISTS tr_instrument_inventory_after_update;
  DROP TRIGGER IF EXISTS tr_instrument_inventory_after_delete;

  INSERT INTO instrument_inventory (instrument_id, location_id, quantity, status)
  SELECT i.instrument_id, loc.location_id, 1, 'Available'
  FROM instruments i
  JOIN locations loc ON loc.location_name IN ('Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya')
  WHERE i.name IN (
    'Dev Snare Drum','Dev Bass Drum','Dev Clarinet',
    'Yamaha Black Snare Drum #01','Yamaha Black Snare Drum #02','Yamaha Black Snare Drum (Evans Drum Head) #03',
    'Pearl Snare Drum Color White #01','Pearl Snare Drum Color Dirt White #02',
    'Yamaha Marching Snare 14x6.5','Pearl Modern Snare 14x6','Ludwig Classic Snare 14x5.5','Mapex Marching Snare 14x7','Gretsch Signature Snare 14x6.5',
    'Lazer Bass Drum #01','E-lance Bass Drum #02','E-lance Bass Drum #03','E-lance Bass Drum #04','Fernando Bass Drum #02','Pearl Marching Bass 22x14','Yamaha Bass Drum 24x14','Ludwig Bass Drum 26x16','Mapex Bass Drum 24x15',
    'E-lance Percussion Black Tenor Drums','Century Percussion White Tenor Drums','Yamaha Quad Tenor Set','Pearl Tenor Quartet','Mapex Tenor Set',
    'Zildjian Marching Cymbals','Zildjian Marching Cymbal Pair 18in','Sabian Marching Cymbal Pair 18in','Meinl Marching Cymbal 18in',
    'E-lance Percussion Marching Glockenspiel #01','E-lance Percussion Marching Glockenspiel #02','E-lance Glockenspiel Marching','Yamaha Marching Tambourine','Century Marching Triangle','Marimba Practice Pad',
    'Yamaha Clarinet','Yamaha Bb Clarinet','Buffet Clarinet Bb','Yamaha Alto Saxophone','Selmer Alto Saxophone',
    'Fernando Tuba','Vincent Bach Trombone','Yamaha Trumpet YTR-2330','Conn Tuba','King Cornet'
  )
    AND NOT EXISTS (SELECT 1 FROM instrument_items LIMIT 1)
  ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), status = VALUES(status);

  -- Recreate inventory triggers immediately after the seed insert
  DELIMITER $

  CREATE TRIGGER tr_instrument_inventory_after_insert
  AFTER INSERT ON instrument_inventory
  FOR EACH ROW
  BEGIN
    UPDATE instruments 
    SET quantity = COALESCE(quantity,0) + NEW.quantity 
    WHERE instrument_id = NEW.instrument_id;
  END$

  CREATE TRIGGER tr_instrument_inventory_after_update
  AFTER UPDATE ON instrument_inventory
  FOR EACH ROW
  BEGIN
    UPDATE instruments 
    SET quantity = COALESCE(quantity,0) - COALESCE(OLD.quantity,0) + COALESCE(NEW.quantity,0) 
    WHERE instrument_id = NEW.instrument_id;
    
    IF OLD.instrument_id IS NOT NULL AND OLD.instrument_id != NEW.instrument_id THEN
      UPDATE instruments 
      SET quantity = COALESCE(quantity,0) - COALESCE(OLD.quantity,0) 
      WHERE instrument_id = OLD.instrument_id;
    END IF;
  END$

  CREATE TRIGGER tr_instrument_inventory_after_delete
  AFTER DELETE ON instrument_inventory
  FOR EACH ROW
  BEGIN
    UPDATE instruments 
    SET quantity = COALESCE(quantity,0) - COALESCE(OLD.quantity,0) 
    WHERE instrument_id = OLD.instrument_id;
  END$

  DELIMITER ;

  -- Insert one instrument_item per inventory row for the dev instruments when none exist
  INSERT INTO instrument_items (instrument_id, serial_number, location_id, status, condition_status, acquisition_date, purchase_cost, is_active, created_at, updated_at)
  SELECT
    ii.instrument_id,
    CONCAT('DEV-', ii.instrument_id, '-', ii.location_id, '-001') AS serial_number,
    ii.location_id,
    'Available',
    COALESCE(i.condition_status,'Good'),
    CURDATE() AS acquisition_date,
    1000.00 AS purchase_cost,
    TRUE,
    NOW(),
    NOW()
  FROM instrument_inventory ii
  JOIN instruments i ON i.instrument_id = ii.instrument_id
  LEFT JOIN instrument_items itc ON itc.instrument_id = ii.instrument_id AND itc.location_id = ii.location_id
  WHERE i.name IN (
    'Dev Snare Drum','Dev Bass Drum','Dev Clarinet',
    'Yamaha Black Snare Drum #01','Yamaha Black Snare Drum #02','Yamaha Black Snare Drum (Evans Drum Head) #03',
    'Pearl Snare Drum Color White #01','Pearl Snare Drum Color Dirt White #02',
    'Yamaha Marching Snare 14x6.5','Pearl Modern Snare 14x6','Ludwig Classic Snare 14x5.5','Mapex Marching Snare 14x7','Gretsch Signature Snare 14x6.5',
    'Lazer Bass Drum #01','E-lance Bass Drum #02','E-lance Bass Drum #03','E-lance Bass Drum #04','Fernando Bass Drum #02','Pearl Marching Bass 22x14','Yamaha Bass Drum 24x14','Ludwig Bass Drum 26x16','Mapex Bass Drum 24x15',
    'E-lance Percussion Black Tenor Drums','Century Percussion White Tenor Drums','Yamaha Quad Tenor Set','Pearl Tenor Quartet','Mapex Tenor Set',
    'Zildjian Marching Cymbals','Zildjian Marching Cymbal Pair 18in','Sabian Marching Cymbal Pair 18in','Meinl Marching Cymbal 18in',
    'E-lance Percussion Marching Glockenspiel #01','E-lance Percussion Marching Glockenspiel #02','E-lance Glockenspiel Marching','Yamaha Marching Tambourine','Century Marching Triangle','Marimba Practice Pad',
    'Yamaha Clarinet','Yamaha Bb Clarinet','Buffet Clarinet Bb','Yamaha Alto Saxophone','Selmer Alto Saxophone',
    'Fernando Tuba','Vincent Bach Trombone','Yamaha Trumpet YTR-2330','Conn Tuba','King Cornet'
  )
    AND ii.quantity > 0
    AND NOT EXISTS (SELECT 1 FROM instrument_items LIMIT 1);

  -- ============================================================================
  -- Final reconciliation: ensure instruments.quantity matches inventory totals
  -- If some instruments have no inventory rows, set quantity = number of canonical sites
  -- Use temporary tables and keyed WHERE clauses so this is safe with SQL_SAFE_UPDATES.

  CREATE TEMPORARY TABLE IF NOT EXISTS tmp_inv_totals AS
    SELECT instrument_id, COALESCE(SUM(quantity),0) AS total_qty
    FROM instrument_inventory
    GROUP BY instrument_id;

  SELECT COUNT(*) INTO @canonical_sites
  FROM locations
  WHERE location_name IN ('Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya');

  -- Update instruments that have inventory totals (use JOIN only; do not re-select tmp table)
  UPDATE instruments i
  JOIN tmp_inv_totals t ON i.instrument_id = t.instrument_id
  SET i.quantity = GREATEST(t.total_qty, COALESCE(@canonical_sites, 2));

  -- For instruments with no inventory rows at all, set quantity = canonical_sites (if any)
  UPDATE instruments
  SET quantity = COALESCE(@canonical_sites, 2)
  WHERE instrument_id NOT IN (SELECT instrument_id FROM instrument_inventory)
    AND instrument_id > 0;

  DROP TEMPORARY TABLE IF EXISTS tmp_inv_totals;

  -- CLEANUP
  -- ============================================================================

  DROP PROCEDURE IF EXISTS add_index_if_missing;

  -- ============================================================================
  -- VERIFICATION QUERIES
  -- ============================================================================

  SELECT 'Database setup complete!' AS message;
  SELECT COUNT(*) AS total_users FROM users;
  SELECT COUNT(*) AS total_locations FROM locations;
  SELECT COUNT(*) AS total_instruments FROM instruments;
  SELECT COUNT(*) AS total_instrument_items FROM instrument_items;
  SELECT COUNT(*) AS total_inventory_records FROM instrument_inventory;
  SELECT COUNT(*) AS total_invoices FROM invoices;
  SELECT COUNT(*) AS total_borrow_requests FROM borrow_requests;
  SELECT COUNT(*) AS total_rent_requests FROM rent_requests;
  SELECT COUNT(*) AS total_bookings FROM bookings;
  SELECT COUNT(*) AS total_services FROM services;
  SELECT COUNT(*) AS total_band_packages FROM band_packages;

  SELECT '✓ All migrations consolidated successfully!' AS status;