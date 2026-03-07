const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const billingService = require('../services/billingService');
const { notifyAllAdmins, notifyUser } = require('../services/notificationService');

async function fetchBookingsRows(email = null) {
  const whereClause = email ? 'WHERE b.email = ?' : '';
  const params = email ? [email] : [];

  const queryWithReschedule = `SELECT b.*, 
              u.first_name, u.last_name,
              approver.first_name AS approver_first_name,
              approver.last_name AS approver_last_name,
              (SELECT rr.requested_date FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_date,
              (SELECT rr.requested_start FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_start,
              (SELECT rr.requested_end FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_end,
              (SELECT rr.status FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS reschedule_status
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN users approver ON b.approved_by = approver.id
       ${whereClause}
       ORDER BY b.created_at DESC`;

  try {
    const [rows] = await pool.query(queryWithReschedule, params);
    return rows;
  } catch (error) {
    const isMissingRescheduleTable =
      error &&
      error.code === 'ER_NO_SUCH_TABLE' &&
      /reschedule_requests/i.test(String(error.message || ''));

    if (!isMissingRescheduleTable) {
      throw error;
    }

    const queryWithoutReschedule = `SELECT b.*, 
              u.first_name, u.last_name,
              approver.first_name AS approver_first_name,
              approver.last_name AS approver_last_name,
              NULL AS requested_date,
              NULL AS requested_start,
              NULL AS requested_end,
              NULL AS reschedule_status
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN users approver ON b.approved_by = approver.id
       ${whereClause}
       ORDER BY b.created_at DESC`;

    const [rows] = await pool.query(queryWithoutReschedule, params);
    return rows;
  }
}

// Get all bookings (public endpoint for calendar display)
router.get('/', async (req, res) => {
  try {
    // Disable caching to always get fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const bookings = await fetchBookingsRows();

    // Normalize date fields to YYYY-MM-DD strings to avoid timezone shifts on the client
    const formatted = (bookings || []).map(b => ({
      ...b,
      date: b && b.date ? (b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date).split('T')[0]) : b.date,
      requestedDate: b && b.requested_date ? (b.requested_date instanceof Date ? b.requested_date.toISOString().split('T')[0] : String(b.requested_date).split('T')[0]) : null,
      requestedStart: b && b.requested_start ? String(b.requested_start) : null,
      requestedEnd: b && b.requested_end ? String(b.requested_end) : null,
      rescheduleStatus: b && b.reschedule_status ? b.reschedule_status : null
    }));

    res.json({ success: true, bookings: formatted });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch bookings',
      error: error.message 
    });
  }
});

// Get bookings by user email (for customers)
router.get('/user/:email', async (req, res) => {
  try {
    // Disable caching to always get fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const { email } = req.params;
    const bookings = await fetchBookingsRows(email);

    const formatted = (bookings || []).map(b => ({
      ...b,
      date: b && b.date ? (b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date).split('T')[0]) : b.date,
      requestedDate: b && b.requested_date ? (b.requested_date instanceof Date ? b.requested_date.toISOString().split('T')[0] : String(b.requested_date).split('T')[0]) : null,
      requestedStart: b && b.requested_start ? String(b.requested_start) : null,
      requestedEnd: b && b.requested_end ? String(b.requested_end) : null,
      rescheduleStatus: b && b.reschedule_status ? b.reschedule_status : null
    }));

    res.json({ success: true, bookings: formatted });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch bookings',
      error: error.message 
    });
  }
});

// Check for schedule conflicts
router.post('/check-conflict', async (req, res) => {
  try {
    const { date, startTime, endTime, location, excludeBookingId } = req.body;

    if (!date || !startTime || !endTime || !location) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields for conflict check'
      });
    }

    console.log('🔍 Checking for conflicts:', { date, startTime, endTime, location, excludeBookingId });

    // Check for overlapping bookings on the same date and location
    // Only check approved bookings (not pending, rejected or cancelled)
    let query = `
      SELECT booking_id, customer_name, service, start_time, end_time, status
      FROM bookings 
      WHERE date = ? 
      AND location = ?
      AND status = 'approved'
      AND (
        (start_time < ? AND end_time > ?) OR
        (start_time < ? AND end_time > ?) OR
        (start_time >= ? AND end_time <= ?)
      )
    `;
    
    const params = [
      date, 
      location,
      endTime, startTime,
      endTime, startTime,
      startTime, endTime
    ];

    // Exclude a specific booking if provided (for editing)
    if (excludeBookingId) {
      query += ' AND booking_id != ?';
      params.push(excludeBookingId);
    }

    const [conflicts] = await pool.query(query, params);

    console.log(`✅ Found ${conflicts.length} conflicting approved bookings`);

    res.json({
      success: true,
      hasConflict: conflicts.length > 0,
      conflicts: conflicts.map(c => ({
        id: c.booking_id,
        customerName: c.customer_name,
        service: c.service,
        startTime: c.start_time,
        endTime: c.end_time,
        status: c.status
      }))
    });
  } catch (error) {
    console.error('Error checking for conflicts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for conflicts',
      error: error.message
    });
  }
});

// Create a new booking
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      customerName,
      email,
      phone,
      service,
      date,
      startTime,
      endTime,
      location,
      estimatedValue,
      notes,
      status,
      packageType,
      rentalInstrument,
      rentalStartDate,
      rentalEndDate,
      numPieces
    } = req.body;

    // Validate required fields
    if (!customerName || !email || !phone || !service || !date || !startTime || !endTime || !location) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Allow status to be set (for migration), default to 'pending'
    let bookingStatus = status || 'pending';

    // Use the date string directly from the request to avoid any timezone conversions.
    const formattedDate = date;

    console.log('📅 Backend received booking date:', formattedDate);
    console.log('   Full booking data:', { customerName, service, date: formattedDate, startTime, endTime });

    // Check for schedule conflicts with APPROVED bookings only
    // NOTE: conflicts are checked globally (regardless of location) so the band
    // cannot be double-booked at the same time even at different locations.
    // Use a robust overlap check: two intervals overlap unless
    // existing.end_time <= new.start_time OR existing.start_time >= new.end_time
    const [conflicts] = await pool.query(
      `SELECT booking_id, customer_name, service, start_time, end_time, status
       FROM bookings
       WHERE date = ?
         AND status = 'approved'
         AND NOT (end_time <= ? OR start_time >= ?)
      `,
      [formattedDate, startTime, endTime]
    );

    let conflictDetails = null;
    if (conflicts.length > 0) {
      // There's an approved booking that conflicts, so mark as pending for admin review
      bookingStatus = 'pending';
      conflictDetails = conflicts.map(c => ({
        customerName: c.customer_name,
        service: c.service,
        startTime: c.start_time,
        endTime: c.end_time,
        status: c.status
      }));
      console.log('⚠️ Conflict detected with approved booking, creating as pending');
    }

    const [result] = await pool.query(
      `INSERT INTO bookings 
       (user_id, customer_name, email, phone, service, date, start_time, end_time, location, estimated_value, notes, status, package_type, rental_instrument, rental_start_date, rental_end_date, num_pieces)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, customerName, email, phone, service, formattedDate, startTime, endTime, location, estimatedValue || 5000, notes || null, bookingStatus, packageType || null, rentalInstrument || null, rentalStartDate || null, rentalEndDate || null, numPieces || null]
    );

    const [newBooking] = await pool.query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [result.insertId]
    );

    // Ensure date is returned as YYYY-MM-DD string to avoid timezone shifts on client
    if (newBooking && newBooking[0]) {
      const nb = newBooking[0];
      nb.date = nb.date ? (nb.date instanceof Date ? nb.date.toISOString().split('T')[0] : String(nb.date).split('T')[0]) : nb.date;
      newBooking[0] = nb;
    }

    console.log('✅ Booking created with date:', newBooking[0].date);

    // Notify all admins about new booking request
    await notifyAllAdmins(
      'booking_request',
      'New Booking Request',
      `${customerName} has requested a booking for ${service} on ${formattedDate}`,
      { bookingId: result.insertId, service, date: formattedDate, customerName, email }
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: newBooking[0],
      hasConflict: conflictDetails !== null,
      conflicts: conflictDetails
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
});

// Customer submits a reschedule request for a booking
router.post('/:id/reschedule-request', async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, newStart, newEnd, email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Missing email' });
    }

    // Insert reschedule request record
    const [result] = await pool.query(
      `INSERT INTO reschedule_requests (booking_id, user_id, user_email, requested_date, requested_start, requested_end, status, created_at)
       VALUES (?, (SELECT id FROM users WHERE email = ? LIMIT 1), ?, ?, ?, ?, 'submitted', NOW())`,
      [id, email, email, newDate || null, newStart || null, newEnd || null]
    );

    // Notify admins and the user
    try {
      // Attempt to read booking service/name and customer full name for clearer admin message
      let serviceName = null;
      let customerName = null;
      try {
        const [bkRows] = await pool.query('SELECT service, customer_name FROM bookings WHERE booking_id = ? LIMIT 1', [id]);
        if (Array.isArray(bkRows) && bkRows.length > 0) {
          serviceName = bkRows[0].service || null;
          customerName = bkRows[0].customer_name || null;
        }
      } catch (bkErr) {
        console.warn('Failed to fetch booking details for reschedule notification:', bkErr && bkErr.message);
      }

      await notifyAllAdmins(
        'reschedule_request',
        'Reschedule Request',
        `Customer ${customerName || email} requests to reschedule booking ${serviceName ? '"' + serviceName + '"' : id} to ${newDate} ${newStart || ''}-${newEnd || ''}`,
        { bookingId: id, requestedDate: newDate, requestedStart: newStart, requestedEnd: newEnd, service: serviceName }
      );

      await notifyUser(email, 'reschedule_request_submitted', 'Reschedule Request Submitted', 'We received your reschedule request. Our team will review it and contact you.', { bookingId: id, requestedDate: newDate, requestedStart: newStart, requestedEnd: newEnd });
    } catch (notifErr) {
      console.warn('Failed to send notifications for reschedule request:', notifErr && notifErr.message);
    }

    // Return the updated booking row (including latest reschedule fields) so
    // the client can update UI without a full refresh.
    try {
      const [rows] = await pool.query(
        `SELECT b.*, 
                (SELECT rr.requested_date FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_date,
                (SELECT rr.requested_start FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_start,
                (SELECT rr.requested_end FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_end,
                (SELECT rr.status FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS reschedule_status
         FROM bookings b
         WHERE b.booking_id = ? LIMIT 1`,
        [id]
      );

      const updatedBooking = rows && rows[0] ? rows[0] : null;
      return res.status(201).json({ success: true, message: 'Reschedule request saved', requestId: result.insertId, booking: updatedBooking });
    } catch (e) {
      console.warn('Failed to fetch updated booking after reschedule insert:', e && e.message);
      return res.status(201).json({ success: true, message: 'Reschedule request saved', requestId: result.insertId });
    }
  } catch (error) {
    console.error('Error saving reschedule request:', error);
    res.status(500).json({ success: false, message: 'Failed to submit reschedule request', error: error.message });
  }
});

// Admin approves or rejects reschedule request
router.put('/:id/reschedule-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    const approvedBy = req.user ? req.user.id : null;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    console.log(`📝 ${status === 'approved' ? 'Approving' : 'Rejecting'} reschedule request for booking ${id} by user ${approvedBy}`);

    // Get the latest reschedule request
    const [rescheduleRequests] = await pool.query(
      `SELECT * FROM reschedule_requests 
       WHERE booking_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [id]
    );

    if (rescheduleRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No reschedule request found for this booking'
      });
    }

    const rescheduleRequest = rescheduleRequests[0];

    // Update the reschedule request status
    await pool.query(
      `UPDATE reschedule_requests 
       SET status = ?, approved_by = ?, approved_at = NOW() 
       WHERE request_id = ?`,
      [status, approvedBy, rescheduleRequest.request_id]
    );

    // If approved, update the actual booking with the new schedule
    if (status === 'approved') {
      const updateFields = [];
      const updateValues = [];

      if (rescheduleRequest.requested_date) {
        updateFields.push('date = ?');
        updateValues.push(rescheduleRequest.requested_date);
      }
      if (rescheduleRequest.requested_start) {
        updateFields.push('start_time = ?');
        updateValues.push(rescheduleRequest.requested_start);
      }
      if (rescheduleRequest.requested_end) {
        updateFields.push('end_time = ?');
        updateValues.push(rescheduleRequest.requested_end);
      }

      updateFields.push('updated_at = NOW()');
      updateValues.push(id);

      if (updateFields.length > 1) { // More than just updated_at
        await pool.query(
          `UPDATE bookings 
           SET ${updateFields.join(', ')}
           WHERE booking_id = ?`,
          updateValues
        );
        console.log('✅ Booking schedule updated with new date/time');
      }
    }

    // Get updated booking with all related data
    const [updatedBooking] = await pool.query(
      `SELECT b.*, 
              approver.first_name AS approver_first_name,
              approver.last_name AS approver_last_name,
              (SELECT rr.requested_date FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_date,
              (SELECT rr.requested_start FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_start,
              (SELECT rr.requested_end FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS requested_end,
              (SELECT rr.status FROM reschedule_requests rr WHERE rr.booking_id = b.booking_id ORDER BY rr.created_at DESC LIMIT 1) AS reschedule_status
       FROM bookings b
       LEFT JOIN users approver ON b.approved_by = approver.id
       WHERE b.booking_id = ?`,
      [id]
    );

    // Notify customer
    const customerEmail = updatedBooking[0].email;
    const message = status === 'approved' 
      ? `Your reschedule request has been approved! Your booking is now scheduled for ${rescheduleRequest.requested_date || 'the new date'} at ${rescheduleRequest.requested_start || 'the new time'}.`
      : 'Your reschedule request has been reviewed. Please contact us for more information.';

    try {
      await notifyUser(
        customerEmail,
        `reschedule_${status}`,
        status === 'approved' ? 'Reschedule Approved' : 'Reschedule Update',
        message,
        { 
          bookingId: id, 
          requestedDate: rescheduleRequest.requested_date,
          requestedStart: rescheduleRequest.requested_start,
          requestedEnd: rescheduleRequest.requested_end
        }
      );
    } catch (notifErr) {
      console.warn('⚠️ Failed to send customer notification:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Reschedule request ${status} successfully`,
      booking: updatedBooking[0]
    });
  } catch (error) {
    console.error('❌ Error updating reschedule status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reschedule request',
      error: error.message
    });
  }
});

// Update booking status (approve/reject)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    let approvedBy = req.user ? req.user.id : null;

    // Check if approver exists
    if (approvedBy) {
      const [userCheck] = await pool.query('SELECT id FROM users WHERE id = ?', [approvedBy]);
      if (userCheck.length === 0) {
        console.log('❌ Approver user not found:', approvedBy);
        approvedBy = null;
      }
    }

    console.log(`📝 Updating booking ${id} to status: ${status} by user ${approvedBy}`);

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      console.log('❌ Invalid status value:', status);
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // If changing to approved, ensure there is no other already-approved booking
    // that overlaps the same date/location/time. Use a DB transaction and row-level
    // locks to prevent race conditions where two admins approve overlapping bookings
    // simultaneously.
    if (status === 'approved') {
      const conn = await pool.getConnection();
      let lockName = null;
      try {
        console.log(`🔒 Approval attempt for booking ${id} by user ${approvedBy}`);
        
        // Read current booking to know date/location (no locking yet)
        const [curRows] = await conn.query('SELECT date, start_time, end_time, location FROM bookings WHERE booking_id = ?', [id]);
        const current = curRows && curRows[0];
        console.log('Current booking row:', current);
        
        if (!current) {
          conn.release();
          return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Create a stable lock name per date to serialize approvals for the same time slot
        // across all locations (we want ONE booking for the band at any given time).
        lockName = `booking_approval_${String(current.date)}`;
        console.log('🔐 Attempting to acquire lock:', lockName);

        // Acquire advisory lock (timeout 10s)
        const [lockRes] = await conn.query('SELECT GET_LOCK(?, 10) as got_lock', [lockName]);
        console.log('GET_LOCK result:', lockRes && lockRes[0]);
        const gotLock = lockRes && lockRes[0] && (lockRes[0].got_lock === 1 || lockRes[0].got_lock === '1');
        
        if (!gotLock) {
          console.warn('⚠️ Could not acquire lock:', lockName);
          conn.release();
          return res.status(423).json({ success: false, message: 'Could not acquire approval lock, try again' });
        }

        console.log('✅ Lock acquired, beginning transaction');
        
        // Start transaction and perform conflict check + update under lock
        await conn.beginTransaction();

        // Re-lock current booking row within transaction
        const [currentRows] = await conn.query('SELECT date, start_time, end_time, location FROM bookings WHERE booking_id = ? FOR UPDATE', [id]);
        const lockedCurrent = currentRows && currentRows[0];
        console.log('🔒 Locked current booking:', lockedCurrent);

        // ✅ Check for already-approved overlapping bookings ONLY (not pending).
        // Use the same robust overlap logic as above and ignore location so
        // the band cannot be double-booked across venues.
        const [conflicts] = await conn.query(
          `SELECT booking_id, customer_name, service, start_time, end_time, status, date
           FROM bookings
           WHERE date = ?
             AND status = 'approved'
             AND NOT (end_time <= ? OR start_time >= ?)
             AND booking_id != ?
          `,
          [
            lockedCurrent.date,
            lockedCurrent.start_time, lockedCurrent.end_time,
            id
          ]
        );

        console.log('Approval conflict params:', { date: lockedCurrent.date, start: lockedCurrent.start_time, end: lockedCurrent.end_time, bookingId: id });

        console.log(`🔍 Found ${conflicts.length} approved conflicts`);
        
        if (conflicts && conflicts.length > 0) {
          console.warn('❌ Approval blocked due to existing APPROVED conflicts:', conflicts);
          await conn.rollback();
          await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
          conn.release();
          
          return res.status(409).json({
            success: false,
            message: 'Cannot approve: an overlapping approved booking already exists.',
            conflicts: conflicts.map(c => ({ 
              bookingId: c.booking_id, 
              customer_name: c.customer_name,
              customerName: c.customer_name,
              service: c.service, 
              start_time: c.start_time,
              startTime: c.start_time,
              end_time: c.end_time,
              endTime: c.end_time,
              date: c.date,
              location: c.location,
              status: c.status
            }))
          });
        }

        console.log('✅ No approved conflicts, proceeding to update');
        
        // No conflicts, perform update
        const [result] = await conn.query(
          `UPDATE bookings 
           SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
           WHERE booking_id = ?`,
          [status, approvedBy, id]
        );

        console.log('📝 Update affectedRows:', result && result.affectedRows);
        
        if (result.affectedRows === 0) {
          await conn.rollback();
          await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
          conn.release();
          return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const [updatedRows] = await conn.query(
          `SELECT b.*, 
                  approver.first_name AS approver_first_name,
                  approver.last_name AS approver_last_name
           FROM bookings b
           LEFT JOIN users approver ON b.approved_by = approver.id
           WHERE b.booking_id = ?`,
          [id]
        );

        await conn.commit();
        
        // Release advisory lock
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
        conn.release();

        console.log('✅ Transaction committed successfully');

        // Attach updated booking for downstream processing
        const updatedBookingObj = updatedRows[0];
        req.__updatedBooking = updatedBookingObj;
        
      } catch (tranErr) {
        try { await conn.rollback(); } catch (e) { /* ignore */ }
        try { if (lockName) await conn.query('SELECT RELEASE_LOCK(?)', [lockName]); } catch (e) { /* ignore */ }
        conn.release();
        console.error('❌ Transaction error during approval:', tranErr);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to approve booking (transaction error)', 
          error: tranErr.message 
        });
      }
    }

    let updatedBooking;
    if (status === 'approved' && req.__updatedBooking) {
      // Transactional path already performed the update and attached the booking
      updatedBooking = [req.__updatedBooking];
      console.log('✅ Updated booking (transactional):', updatedBooking[0]);
    } else {
      const [result] = await pool.query(
        `UPDATE bookings 
         SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
         WHERE booking_id = ?`,
        [status, approvedBy, id]
      );

      console.log(`✅ Update result - Affected rows: ${result.affectedRows}`);

      if (result.affectedRows === 0) {
        console.log('❌ Booking not found with ID:', id);
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      const [rows] = await pool.query(
        `SELECT b.*, 
                approver.first_name AS approver_first_name,
                approver.last_name AS approver_last_name
         FROM bookings b
         LEFT JOIN users approver ON b.approved_by = approver.id
         WHERE b.booking_id = ?`,
        [id]
      );

      updatedBooking = rows;
      console.log('✅ Updated booking:', updatedBooking[0]);
    }

    // If booking was approved, automatically create an invoice
    if (status === 'approved' && updatedBooking[0]) {
      try {
        const booking = updatedBooking[0];
        const amount = booking.estimated_value || 5000;
        const description = `Booking for ${booking.service} on ${booking.date}`;
        
        // Find user by email (if they have an account)
        const [userResult] = await pool.query(
          'SELECT id FROM users WHERE email = ?',
          [booking.email]
        );
        
        if (userResult.length > 0) {
          const userId = userResult[0].id;
          console.log(`💰 Creating invoice for user ${userId}, amount: ₱${Number(amount).toLocaleString()}`);
          
          const invoice = await billingService.generateInvoice(userId, amount, description);
          
          // Approve the invoice immediately so customer can pay
          await pool.query('UPDATE invoices SET status = ? WHERE invoice_id = ?', ['approved', invoice.invoice_id]);
          
          console.log(`✅ Invoice created and approved - ID: ${invoice.invoice_id}, Number: ${invoice.invoice_number}`);
          
          // Skip server-side "Booking Approved" notification to avoid duplicate
          // notifications; the frontend emits the canonical "Booking Confirmed!" notification.
          console.log('ℹ️ Skipping server-side Booking Approved notification to avoid duplication');
          
          // Add invoice info to response
          updatedBooking[0].invoice_id = invoice.invoice_id;
          // Provide human-friendly invoice number and authoritative amount so frontend
          // can render accurate payment details without relying on client fallbacks.
          updatedBooking[0].invoice_number = invoice.invoice_number || null;
          updatedBooking[0].invoice_amount = Number(invoice.amount || 0);
        } else {
          console.log(`⚠️ No user account found for email: ${booking.email}, skipping invoice creation`);
        }
      } catch (invoiceError) {
        console.error('❌ Error creating invoice:', invoiceError);
        // Don't fail the booking approval if invoice creation fails
      }
    }

    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      booking: updatedBooking[0]
    });
  } catch (error) {
    console.error('❌ Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
});

// Delete a booking
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'DELETE FROM bookings WHERE booking_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete booking',
      error: error.message
    });
  }
});

// Cancel booking (customer self-service)
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to cancel booking'
      });
    }

    console.log(`🚫 Cancelling booking ${id} for email: ${email}`);

    // First, verify the booking belongs to the user
    const [booking] = await pool.query(
      'SELECT * FROM bookings WHERE booking_id = ? AND email = ?',
      [id, email.toLowerCase().trim()]
    );

    if (booking.length === 0) {
      console.log('❌ Booking not found or email mismatch');
      return res.status(404).json({
        success: false,
        message: 'Booking not found or you do not have permission to cancel it'
      });
    }

    // Don't allow cancelling already cancelled or rejected bookings
    if (booking[0].status === 'cancelled' || booking[0].status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: `This booking is already ${booking[0].status}`
      });
    }

    // Update status to cancelled
    const [result] = await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled', updated_at = NOW()
       WHERE booking_id = ?`,
      [id]
    );

    console.log(`✅ Booking ${id} cancelled successfully`);

    // Notify admins about cancellation
    try {
      await pool.query(
        `INSERT INTO notifications (user_email, type, title, message, data, delivered_at, created_at) 
         VALUES ('admin', 'info', 'Booking Cancelled', ?, ?, NOW(), NOW())`,
        [
          `${booking[0].customer_name} has cancelled their booking for ${booking[0].service} on ${booking[0].date}`,
          JSON.stringify({ bookingId: id, customerName: booking[0].customer_name, service: booking[0].service })
        ]
      );
    } catch (notifErr) {
      console.warn('⚠️ Failed to send admin notification:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
});

module.exports = router;