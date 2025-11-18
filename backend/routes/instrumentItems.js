const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================================================
// INSTRUMENT ITEMS ENDPOINTS (Individual instruments with serial numbers)
// ============================================================================

// Get all instrument items with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      instrumentId, 
      locationId, 
      status, 
      condition, 
      serialNumber,
      search 
    } = req.query;

    // If user asked for archived items, use is_active = FALSE, otherwise default to active items
    const activeClause = (status === 'Archived') ? 'ii.is_active = FALSE' : 'ii.is_active = TRUE';

    let query = `
      SELECT 
        ii.*,
        i.name as instrument_name,
        i.category,
        i.subcategory,
        i.brand,
        l.location_name,
        l.location_type,
        u_rental.email as current_renter_email,
        u_rental.first_name as current_renter_first_name,
        u_rental.last_name as current_renter_last_name,
        u_borrow.email as current_borrower_email,
        u_borrow.first_name as current_borrower_first_name,
        u_borrow.last_name as current_borrower_last_name
      FROM instrument_items ii
      JOIN instruments i ON ii.instrument_id = i.instrument_id
      LEFT JOIN locations l ON ii.location_id = l.location_id
      LEFT JOIN rent_requests rr ON ii.current_rental_id = rr.request_id
      LEFT JOIN users u_rental ON rr.user_id = u_rental.id
      LEFT JOIN borrow_requests br ON ii.current_borrow_id = br.request_id
      LEFT JOIN users u_borrow ON br.user_id = u_borrow.id
      WHERE ${activeClause}
    `;

    const params = [];

    if (instrumentId) {
      query += ' AND ii.instrument_id = ?';
      params.push(instrumentId);
    }

    if (locationId) {
      query += ' AND ii.location_id = ?';
      params.push(locationId);
    }

    // If filtering for 'Archived' we already switched is_active; don't filter by ii.status = 'Archived'
    if (status && status !== 'Archived') {
      query += ' AND ii.status = ?';
      params.push(status);
    }

    if (condition) {
      query += ' AND ii.condition_status = ?';
      params.push(condition);
    }

    if (serialNumber) {
      query += ' AND ii.serial_number LIKE ?';
      params.push(`%${serialNumber}%`);
    }

    if (search) {
      query += ' AND (ii.serial_number LIKE ? OR i.name LIKE ? OR i.brand LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY i.name, ii.serial_number';

    const [rows] = await pool.query(query, params);

    // Debug: when requesting Archived items, log the activeClause and result count to help diagnose
    if (status === 'Archived') {
      try {
        const ids = Array.isArray(rows) ? rows.map(r => r.item_id).slice(0, 40) : [];
        console.log(`instrumentItems GET (status=Archived): activeClause=${activeClause}, returned=${rows.length}, sampleIds=${JSON.stringify(ids)}`);
      } catch (e) { /* ignore logging errors */ }
    }

    res.json({
      success: true,
      items: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('Error fetching instrument items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch instrument items' });
  }
});

// Get single instrument item by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        ii.*,
        i.name as instrument_name,
        i.category,
        i.subcategory,
        i.brand,
        i.price_per_day,
        l.location_name,
        l.location_type,
        l.address as location_address
      FROM instrument_items ii
      JOIN instruments i ON ii.instrument_id = i.instrument_id
      LEFT JOIN locations l ON ii.location_id = l.location_id
      WHERE ii.item_id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Instrument item not found' });
    }

    let maintenanceHistory = [];


    res.json({
      success: true,
      item: {
        ...rows[0],
        maintenanceHistory
      }
    });
  } catch (error) {
    console.error('Error fetching instrument item:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch instrument item' });
  }
});

// Create new instrument item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      instrument_id,
      serial_number,
      location_id,
      status,
      condition_status,
      acquisition_date,
      purchase_cost,
      notes,
      photo_url
    } = req.body;

    if (!instrument_id || !serial_number) {
      return res.status(400).json({ 
        success: false, 
        message: 'Instrument ID and serial number are required' 
      });
    }

    // Check if serial number already exists
    const [existing] = await pool.query(
      'SELECT item_id FROM instrument_items WHERE serial_number = ?',
      [serial_number]
    );

    if (existing.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Serial number already exists' 
      });
    }

    const [result] = await pool.query(`
      INSERT INTO instrument_items (
        instrument_id, serial_number, location_id, status, condition_status,
        acquisition_date, purchase_cost, notes, photo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      instrument_id,
      serial_number,
      location_id || null,
      status || 'Available',
      condition_status || 'Good',
      acquisition_date || null,
      purchase_cost || null,
      notes || null,
      photo_url || null
    ]);

    // Log to audit trail
    await pool.query(`
      INSERT INTO audit_log (table_name, record_id, action, user_id, user_email, after_value)
      VALUES ('instrument_items', ?, 'CREATE', ?, ?, ?)
    `, [result.insertId, userId, req.user.email, JSON.stringify(req.body)]);

    res.json({
      success: true,
      message: 'Instrument item created successfully',
      itemId: result.insertId
    });
  } catch (error) {
    console.error('Error creating instrument item:', error);
    res.status(500).json({ success: false, message: 'Failed to create instrument item' });
  }
});

// Create multiple instrument items in a single request (bulk)
router.post('/bulk', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    // Normalize and validate payload serials
    const cleaned = items.map(it => ({ ...it, serial_number: (it.serial_number || '').toString().trim() }));
    const serials = cleaned.map(it => it.serial_number).filter(Boolean);

    if (serials.length !== cleaned.length) {
      return res.status(400).json({ success: false, message: 'All items must include a serial_number' });
    }

    // Check for duplicates inside payload
    const dupInPayload = serials.filter((s, i, arr) => arr.indexOf(s) !== i);
    if (dupInPayload.length > 0) {
      return res.status(400).json({ success: false, message: 'Duplicate serial numbers in payload', duplicates: Array.from(new Set(dupInPayload)) });
    }

    // Check for existing serials in DB
    const placeholders = serials.map(() => '?').join(',');
    const [existing] = await connection.query(
      `SELECT serial_number FROM instrument_items WHERE serial_number IN (${placeholders})`,
      serials
    );

    if (existing.length > 0) {
      const existingSerials = existing.map(r => r.serial_number);
      return res.status(409).json({ success: false, message: 'Some serial numbers already exist', existing: existingSerials });
    }

    // Begin transaction and insert all items
    await connection.beginTransaction();
    const insertedIds = [];

    for (const it of cleaned) {
      const {
        instrument_id,
        serial_number,
        location_id,
        status,
        condition_status,
        acquisition_date,
        purchase_cost,
        notes,
        photo_url
      } = it;

      if (!instrument_id || !serial_number) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Each item must include instrument_id and serial_number' });
      }

      const [result] = await connection.query(`
        INSERT INTO instrument_items (
          instrument_id, serial_number, location_id, status, condition_status,
          acquisition_date, purchase_cost, notes, photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        instrument_id,
        serial_number,
        location_id || null,
        status || 'Available',
        condition_status || 'Good',
        acquisition_date || null,
        purchase_cost || null,
        notes || null,
        photo_url || null
      ]);

      insertedIds.push(result.insertId);

      // Audit log per item
      await connection.query(`
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_email, after_value)
        VALUES ('instrument_items', ?, 'CREATE', ?, ?, ?)
      `, [result.insertId, userId, req.user.email, JSON.stringify(it)]);
    }

    await connection.commit();

    res.json({ success: true, message: 'Bulk insert completed', count: insertedIds.length, ids: insertedIds });
  } catch (error) {
    try { await connection.rollback(); } catch (e) { /* ignore */ }
    console.error('Error in bulk creating instrument items:', error);
    res.status(500).json({ success: false, message: 'Failed to create instrument items in bulk' });
  } finally {
    connection.release();
  }
});

// Update instrument item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;
    let {
      serial_number,
      location_id,
      status,
      condition_status,
      acquisition_date,
      purchase_cost,
      notes,
      photo_url,
      last_maintenance_date
    } = req.body;

    // Accept legacy client value 'In Maintenance' and normalize to DB enum 'Under Maintenance'
    try {
      if (status === 'In Maintenance') status = 'Under Maintenance';
    } catch (e) { /* ignore */ }

    // Get current state for audit
    const [current] = await pool.query('SELECT * FROM instrument_items WHERE item_id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Instrument item not found' });
    }

    const updates = [];
    const values = [];

    if (serial_number !== undefined) {
      // Check if new serial number already exists (excluding current item)
      const [existing] = await pool.query(
        'SELECT item_id FROM instrument_items WHERE serial_number = ? AND item_id != ?',
        [serial_number, id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ 
          success: false, 
          message: 'Serial number already exists' 
        });
      }
      updates.push('serial_number = ?');
      values.push(serial_number);
    }

    if (location_id !== undefined) { updates.push('location_id = ?'); values.push(location_id); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (condition_status !== undefined) { updates.push('condition_status = ?'); values.push(condition_status); }
    if (acquisition_date !== undefined) { updates.push('acquisition_date = ?'); values.push(acquisition_date); }
    if (purchase_cost !== undefined) { updates.push('purchase_cost = ?'); values.push(purchase_cost); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (photo_url !== undefined) { updates.push('photo_url = ?'); values.push(photo_url); }
    if (last_maintenance_date !== undefined) { updates.push('last_maintenance_date = ?'); values.push(last_maintenance_date); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    // Dev logging: print the generated UPDATE statement and parameter values
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('InstrumentItems UPDATE SQL ->', `UPDATE instrument_items SET ${updates.join(', ')}, updated_at = NOW() WHERE item_id = ?`);
        console.log('InstrumentItems UPDATE values ->', values);
      }
    } catch (logErr) { /* ignore logging errors */ }

    await pool.query(
      `UPDATE instrument_items SET ${updates.join(', ')}, updated_at = NOW() WHERE item_id = ?`,
      values
    );

    // Log to audit trail
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('InstrumentItems AUDIT ->', { id, userId, userEmail: req.user.email, before: current[0], after: req.body });
      }
    } catch (logErr) { /* ignore logging errors */ }

    await pool.query(`
      INSERT INTO audit_log (table_name, record_id, action, user_id, user_email, before_value, after_value)
      VALUES ('instrument_items', ?, 'UPDATE', ?, ?, ?, ?)
    `, [id, userId, req.user.email, JSON.stringify(current[0]), JSON.stringify(req.body)]);

    res.json({
      success: true,
      message: 'Instrument item updated successfully'
    });
  } catch (error) {
    console.error('Error updating instrument item:', error);
    const devMsg = process.env.NODE_ENV !== 'production' && error && error.message ? error.message : 'Failed to update instrument item';
    res.status(500).json({ success: false, message: devMsg });
  }
});

// Delete (soft delete) instrument item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;

    // Get current state for audit
    const [current] = await pool.query('SELECT * FROM instrument_items WHERE item_id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Instrument item not found' });
    }

    // Check if item is currently in use
    if (current[0].current_rental_id || current[0].current_borrow_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete item that is currently rented or borrowed' 
      });
    }

    await pool.query(
      'UPDATE instrument_items SET is_active = FALSE, updated_at = NOW() WHERE item_id = ?',
      [id]
    );

    // Log to audit trail
    await pool.query(`
      INSERT INTO audit_log (table_name, record_id, action, user_id, user_email, before_value)
      VALUES ('instrument_items', ?, 'DELETE', ?, ?, ?)
    `, [id, userId, req.user.email, JSON.stringify(current[0])]);

    res.json({
      success: true,
      message: 'Instrument item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting instrument item:', error);
    res.status(500).json({ success: false, message: 'Failed to delete instrument item' });
  }
});

// Unarchive (restore) instrument item
router.post('/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;

    // Get current state for audit
    const [current] = await pool.query('SELECT * FROM instrument_items WHERE item_id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Instrument item not found' });
    }

    if (current[0].is_active === 1 || current[0].is_active === true) {
      return res.status(400).json({ success: false, message: 'Item is already active' });
    }

    // Debug: log the target being restored
    try {
      console.log(`instrumentItems UNARCHIVE: restoring item_id=${id}, currentActive=${current[0].is_active}`);
    } catch (e) { /* ignore */ }

    try {
      await pool.query(
        'UPDATE instrument_items SET is_active = TRUE, updated_at = NOW() WHERE item_id = ?',
        [id]
      );
    } catch (dbErr) {
      console.error('DB error restoring instrument item:', dbErr);
      const devMsg = process.env.NODE_ENV !== 'production' && dbErr && dbErr.message ? dbErr.message : 'Failed to restore instrument item';
      return res.status(500).json({ success: false, message: devMsg });
    }

    // Attempt to write audit log but don't fail the restore if audit insertion errors
    try {
      await pool.query(`
        INSERT INTO audit_log (table_name, record_id, action, user_id, user_email, before_value)
        VALUES ('instrument_items', ?, 'RESTORE', ?, ?, ?)
      `, [id, userId, req.user.email, JSON.stringify(current[0])]);
    } catch (auditErr) {
      console.error('Warning: failed to write audit log for restore:', auditErr);
    }

    res.json({
      success: true,
      message: 'Instrument item restored successfully'
    });
  } catch (error) {
    console.error('Error restoring instrument item:', error);
    res.status(500).json({ success: false, message: 'Failed to restore instrument item' });
  }
});

// Get statistics/dashboard data
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_items,
        SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as available_items,
        SUM(CASE WHEN status = 'Rented' THEN 1 ELSE 0 END) as rented_items,
        SUM(CASE WHEN status = 'Borrowed' THEN 1 ELSE 0 END) as borrowed_items,
        SUM(CASE WHEN status = 'Under Maintenance' THEN 1 ELSE 0 END) as maintenance_items,
        SUM(CASE WHEN status = 'Rented' THEN 1 ELSE 0 END) as reserved_items,
        SUM(CASE WHEN status = 'Retired' THEN 1 ELSE 0 END) as retired_items,
        SUM(CASE WHEN condition_status = 'Excellent' THEN 1 ELSE 0 END) as condition_excellent,
        SUM(CASE WHEN condition_status = 'Good' THEN 1 ELSE 0 END) as condition_good,
        SUM(CASE WHEN condition_status = 'Fair' THEN 1 ELSE 0 END) as condition_fair,
        SUM(CASE WHEN condition_status = 'Poor' THEN 1 ELSE 0 END) as condition_poor,
        SUM(CASE WHEN condition_status = 'Needs Repair' THEN 1 ELSE 0 END) as condition_needs_repair,
        COALESCE(SUM(purchase_cost), 0) as total_value
      FROM instrument_items
      WHERE is_active = TRUE
    `);

    const [byLocation] = await pool.query(`
      SELECT 
        l.location_name,
        l.location_type,
        COUNT(*) as total,
        SUM(CASE WHEN ii.status = 'Available' THEN 1 ELSE 0 END) as available
      FROM instrument_items ii
      JOIN locations l ON ii.location_id = l.location_id
      WHERE ii.is_active = TRUE
      GROUP BY l.location_id, l.location_name, l.location_type
      ORDER BY l.location_type, l.location_name
    `);

    const [byCategory] = await pool.query(`
      SELECT 
        i.category,
        COUNT(*) as total,
        SUM(CASE WHEN ii.status = 'Available' THEN 1 ELSE 0 END) as available
      FROM instrument_items ii
      JOIN instruments i ON ii.instrument_id = i.instrument_id
      WHERE ii.is_active = TRUE
      GROUP BY i.category
      ORDER BY i.category
    `);

    res.json({
      success: true,
      stats: stats[0],
      byLocation,
      byCategory
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

module.exports = router;
