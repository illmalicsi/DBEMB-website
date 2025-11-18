const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const billingService = require('../services/billingService');
const { notifyAllAdmins, notifyUser } = require('../services/notificationService');

// Helper utilities to work with inventory consistently across schema versions.
// These helpers will prefer the normalized `instrument_inventory` table when
// available, and fall back to the legacy `instruments.quantity` column if present.
let _schemaCache = null;
async function _ensureSchemaCache() {
  if (_schemaCache) return _schemaCache;
  try {
    const [tbls] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('instrument_inventory')");
    const invExists = tbls && tbls.length > 0;
    const [cols] = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'instruments' AND column_name = 'quantity'");
    const instrumentsHasQuantity = cols && cols.length > 0;
    const [plCols] = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'instruments' AND column_name = 'primary_location_id'");
    const primaryLocationExists = plCols && plCols.length > 0;
    _schemaCache = { invExists, instrumentsHasQuantity, primaryLocationExists };
  } catch (e) {
    // if information_schema queries fail, default to safest assumptions
    _schemaCache = { invExists: false, instrumentsHasQuantity: false, primaryLocationExists: false };
  }
  return _schemaCache;
}

async function getTotalInventory(connOrPool, instrumentId) {
  const schema = await _ensureSchemaCache();
  const db = connOrPool || pool;
  if (schema.invExists) {
    const [rows] = await db.query('SELECT COALESCE(SUM(quantity),0) AS total FROM instrument_inventory WHERE instrument_id = ?', [instrumentId]);
    return rows && rows[0] ? Number(rows[0].total) : 0;
  }
  if (schema.instrumentsHasQuantity) {
    const [rows] = await db.query('SELECT COALESCE(quantity,0) AS total FROM instruments WHERE instrument_id = ?', [instrumentId]);
    return rows && rows[0] ? Number(rows[0].total) : 0;
  }
  return 0;
}

// Safely update an instrument's availability_status while handling legacy
// enum values or DB enum truncation errors. If the DB rejects a value
// (for example 'Reserved' no longer exists), this helper will remap
// to a safe alternative (map 'Reserved' -> 'Rented') and retry once.
async function safeUpdateInstrumentAvailability(connOrPool, instrumentId, desiredStatus) {
  const db = connOrPool || pool;
  let status = desiredStatus;
  if (status === 'Reserved') status = 'Rented';
  const allowed = new Set(['Available', 'Rented', 'Borrowed', 'Maintenance', 'Unavailable']);
  if (!allowed.has(status)) status = 'Available';

  try {
    // Use .query on connection-like objects and .execute on pool when appropriate
    if (typeof db.query === 'function') {
      await db.query('UPDATE instruments SET availability_status = ? WHERE instrument_id = ?', [status, instrumentId]);
    } else {
      await pool.query('UPDATE instruments SET availability_status = ? WHERE instrument_id = ?', [status, instrumentId]);
    }
  } catch (err) {
    const msg = err && err.message ? err.message : '';
    const errno = err && err.errno ? err.errno : null;
    // MySQL reports truncated/invalid-enum errors with errno 1265 or messages mentioning Data truncated
    if (errno === 1265 || /Data truncated/i.test(msg) || /incorrect enum value/i.test(msg)) {
      if (status !== 'Rented') {
        try {
          await db.query('UPDATE instruments SET availability_status = ? WHERE instrument_id = ?', ['Rented', instrumentId]);
          return;
        } catch (e2) {
          // fall through to rethrow original error below
        }
      }
    }
    throw err;
  }
}

// Prefer to update instrument_inventory at the instrument's primary_location_id.
// If that table is unavailable, fall back to updating instruments.quantity if it exists.
// If locationId is provided, use that specific location instead of auto-detection
async function decrementInventory(conn, instrumentId, amount, locationId = null) {
  const schema = await _ensureSchemaCache();
  if (schema.invExists) {
    // Use provided locationId, or find primary location for this instrument (if column exists)
    let locId = locationId;
    if (!locId && schema.primaryLocationExists) {
      const forUpdate = (conn && typeof conn.beginTransaction === 'function');
      const sql = forUpdate ? 'SELECT primary_location_id FROM instruments WHERE instrument_id = ? FOR UPDATE' : 'SELECT primary_location_id FROM instruments WHERE instrument_id = ?';
      const [pRows] = await conn.query(sql, [instrumentId]);
      locId = pRows && pRows[0] ? pRows[0].primary_location_id : null;
    }
    if (!locId) {
      // Choose any active location as a sensible default. Do NOT attempt to insert arbitrary locations
      // because the DB enforces a trigger that blocks non-canonical location names in dev seeds.
      const [mRows] = await conn.query('SELECT location_id FROM locations WHERE is_active = 1 LIMIT 1');
      if (mRows && mRows.length) {
        locId = mRows[0].location_id;
      } else {
        // No valid location configured — surface a clear error so callers can handle it instead of triggering
        // the DB-level restriction which causes a transaction rollback.
        throw new Error('No valid locations configured on server. Please seed allowed locations before creating reservations.');
      }
    }
    // ensure inventory row exists
    await conn.query('INSERT INTO instrument_inventory (instrument_id, location_id, quantity) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE quantity = quantity', [instrumentId, locId]);
    // decrement safely (allow negative detection upstream)
    await conn.query('UPDATE instrument_inventory SET quantity = quantity - ? WHERE instrument_id = ? AND location_id = ?', [amount, instrumentId, locId]);
    // Clamp negatives introduced by concurrent/erroneous updates so negative values do not persist
    try {
      await conn.query('UPDATE instrument_inventory SET quantity = GREATEST(quantity, 0) WHERE instrument_id = ? AND location_id = ?', [instrumentId, locId]);
    } catch (e) {
      console.warn('Failed to clamp instrument_inventory negatives:', e && e.message);
    }
    return;
  }
  if (schema.instrumentsHasQuantity) {
    await conn.query('UPDATE instruments SET quantity = quantity - ? WHERE instrument_id = ?', [amount, instrumentId]);
    try {
      await conn.query('UPDATE instruments SET quantity = GREATEST(quantity, 0) WHERE instrument_id = ?', [instrumentId]);
    } catch (e) {
      console.warn('Failed to clamp instruments.quantity negatives:', e && e.message);
    }
    return;
  }
  // If neither exists, no-op (we've chosen not to fail here to keep the route available)
}

async function incrementInventory(conn, instrumentId, amount, locationId = null) {
  const schema = await _ensureSchemaCache();
  if (schema.invExists) {
    // Use provided locationId, or auto-detect
    let locId = locationId;
    if (!locId && schema.primaryLocationExists) {
      const forUpdate = (conn && typeof conn.beginTransaction === 'function');
      const sql = forUpdate ? 'SELECT primary_location_id FROM instruments WHERE instrument_id = ? FOR UPDATE' : 'SELECT primary_location_id FROM instruments WHERE instrument_id = ?';
      const [pRows] = await conn.query(sql, [instrumentId]);
      locId = pRows && pRows[0] ? pRows[0].primary_location_id : null;
    }
    if (!locId) {
      const [mRows] = await conn.query('SELECT location_id FROM locations WHERE is_active = 1 LIMIT 1');
      if (mRows && mRows.length) {
        locId = mRows[0].location_id;
      } else {
        throw new Error('No valid locations configured on server. Please seed allowed locations before creating reservations.');
      }
    }
    await conn.query('INSERT INTO instrument_inventory (instrument_id, location_id, quantity) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE quantity = quantity', [instrumentId, locId]);
    await conn.query('UPDATE instrument_inventory SET quantity = quantity + ? WHERE instrument_id = ? AND location_id = ?', [amount, instrumentId, locId]);
    return;
  }
  if (schema.instrumentsHasQuantity) {
    await conn.query('UPDATE instruments SET quantity = quantity + ? WHERE instrument_id = ?', [amount, instrumentId]);
    return;
  }
}

// Choose a sensible reservation location for an instrument (used to record where create-time
// reservations were pulled from). This mirrors the location selection logic in decrementInventory
// but returns the chosen location id so callers can persist it in the request row.
async function chooseReservationLocation(conn, instrumentId) {
  const schema = await _ensureSchemaCache();
  if (schema.invExists) {
    let locId = null;
    if (schema.primaryLocationExists) {
      const [pRows] = await conn.query('SELECT primary_location_id FROM instruments WHERE instrument_id = ? FOR UPDATE', [instrumentId]);
      locId = pRows && pRows[0] ? pRows[0].primary_location_id : null;
    }
    if (!locId) {
      const [mRows] = await conn.query('SELECT location_id FROM locations WHERE is_active = 1 LIMIT 1');
      if (mRows && mRows.length) {
        locId = mRows[0].location_id;
      } else {
        throw new Error('No valid locations configured on server. Please seed allowed locations before creating reservations.');
      }
    }
    return locId;
  }
  return null;
}


// Get all borrow requests
router.get('/borrow-requests', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        br.*,
        u.first_name AS userName,
        u.email AS userEmail,
        u.phone AS userPhone,
        CONCAT(u.first_name, ' ', u.last_name) AS fullName
      FROM borrow_requests br
      JOIN users u ON br.user_id = u.id
      ORDER BY br.request_date DESC
    `);
    // Normalize DB snake_case to camelCase expected by the frontend
    const normalized = rows.map(r => ({
      ...r,
      instrumentName: r.instrument_name || r.instrumentName || r.instrument || null,
      instrument: r.instrument || r.instrument_name || null,
      startDate: r.start_date || r.startDate || null,
      endDate: r.end_date || r.endDate || null,
      createdAt: r.request_date || r.created_at || r.createdAt || null,
      userName: r.userName || r.first_name || null,
      userEmail: r.userEmail || r.email || null,
      phone: r.phone || r.userPhone || null
    }));
    res.json({ success: true, requests: normalized });
  } catch (error) {
    console.error('Error fetching borrow requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch borrow requests' });
  }
});

// Get all rent requests
router.get('/rent-requests', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        rr.*,
        u.first_name AS userName,
        u.email AS userEmail,
        u.phone AS userPhone,
        CONCAT(u.first_name, ' ', u.last_name) AS fullName
      FROM rent_requests rr
      JOIN users u ON rr.user_id = u.id
      ORDER BY rr.request_date DESC
    `);
    // Normalize DB snake_case to camelCase expected by the frontend
    const normalized = rows.map(r => ({
      ...r,
      instrumentName: r.instrument_name || r.instrumentName || r.instrument || null,
      instrument: r.instrument || r.instrument_name || null,
      startDate: r.start_date || r.startDate || null,
      endDate: r.end_date || r.endDate || null,
      createdAt: r.request_date || r.created_at || r.createdAt || null,
      rentalFee: r.rental_fee || r.rentalFee || null,
      userName: r.userName || r.first_name || null,
      userEmail: r.userEmail || r.email || null,
      phone: r.phone || r.userPhone || null
    }));
    res.json({ success: true, requests: normalized });
  } catch (error) {
    console.error('Error fetching rent requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rent requests' });
  }
});

// Get user's own requests
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [borrowRequests] = await pool.query(
      'SELECT *, "borrow" as type FROM borrow_requests WHERE user_id = ? ORDER BY request_date DESC',
      [userId]
    );

    const [rentRequests] = await pool.query(
      'SELECT *, "rent" as type FROM rent_requests WHERE user_id = ? ORDER BY request_date DESC',
      [userId]
    );

    res.json({
      success: true,
      borrowRequests,
      rentRequests,
      allRequests: [...borrowRequests, ...rentRequests].sort((a, b) =>
        new Date(b.request_date) - new Date(a.request_date)
      )
    });
  } catch (error) {
    console.error('Error fetching user requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your requests' });
  }
});

// Create borrow request
router.post('/borrow-request', authenticateToken, async (req, res) => {
  try {
    // DEBUG: Log minimal incoming payload and auth info to help trace why DB rows are not created
    try {
      console.log('DEBUG [POST /borrow-request] invoked', {
        path: req.path,
        userId: req.user && req.user.id,
        userEmail: req.user && req.user.email,
        payloadSummary: {
          instrumentId: req.body && req.body.instrumentId,
          instrumentName: req.body && req.body.instrumentName,
          quantity: req.body && req.body.quantity,
          startDate: req.body && req.body.startDate,
          endDate: req.body && req.body.endDate
        }
      });
    } catch (dbg) { console.warn('DEBUG log failed in borrow-request handler', dbg && dbg.message); }
    let { instrumentId, instrumentName, instrumentType, quantity, startDate, endDate, purpose, notes } = req.body;
    const userId = req.user && req.user.id;

    // Guard: ensure we have an authenticated user id before attempting DB writes.
    if (!userId) {
      console.warn('Borrow-request attempted without authenticated user');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // START TRANSACTION - Reserve inventory immediately upon borrow request creation
    const conn = await pool.getConnection();
    try {
      // If the client provided an instrumentName but not an instrumentId, try to
      // resolve the name to an existing instrument_id so we can create a borrow
      // request against the correct instrument. Do NOT return early here.
      if (instrumentName && !instrumentId) {
        try {
          const [found] = await conn.query('SELECT instrument_id FROM instruments WHERE name = ? LIMIT 1', [String(instrumentName).trim()]);
          if (found && found.length) {
            instrumentId = found[0].instrument_id;
            console.log('Resolved instrumentName to instrumentId', instrumentId);
          }
        } catch (lookupErr) {
          console.warn('Instrument existence lookup failed (continuing):', lookupErr && lookupErr.message);
        }
      }

      await conn.beginTransaction();

      // Lock instrument row to prevent race conditions
      const [instRows] = await conn.query('SELECT * FROM instruments WHERE instrument_id = ? FOR UPDATE', [instrumentId]);
      if (!instRows || instRows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, message: 'Instrument not found' });
      }

      // Check available inventory
      const available = await getTotalInventory(conn, instrumentId);
      const qtyRequested = Number(quantity) || 1;

      if (available < qtyRequested) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory. Only ${available} available, but ${qtyRequested} requested.`
        });
      }

      // Decrement inventory IMMEDIATELY (reserve it for this member).
      // We do NOT accept a customer-chosen location at creation; decrementInventory
      // will choose the instrument's primary/fallback location. We no longer persist
      // a reserved location on the request row.
      const chosenLoc = null;
      await decrementInventory(conn, instrumentId, qtyRequested);

      // Update availability status if needed
      try {
        const remaining = await getTotalInventory(conn, instrumentId);
        const newStatus = remaining > 0 ? 'Available' : 'Borrowed';
        await safeUpdateInstrumentAvailability(conn, instrumentId, newStatus);
      } catch (sErr) {
        console.warn('Failed to update instrument availability_status after borrow reservation:', sErr && sErr.message);
      }

      // Create the borrow request with status='pending'
      const [result] = await conn.query(
        `INSERT INTO borrow_requests 
         (user_id, instrument_id, instrument_name, instrument_type, quantity, start_date, end_date, purpose, notes, phone, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, instrumentId, instrumentName, instrumentType, qtyRequested, startDate, endDate, purpose, notes, req.body.phone || null]
      );

      await conn.commit();
      conn.release();

      console.log(`✅ Borrow request created with immediate inventory hold. Request ID: ${result.insertId}, Qty: ${qtyRequested}`);

      // Notify all admins about new borrowing request
      try {
        // Fetch user display name/email for nicer notification wording
        const [usr] = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = ? LIMIT 1', [userId]);
        const userRow = usr && usr[0] ? usr[0] : null;
        const displayName = userRow ? ((userRow.first_name || '') + ' ' + (userRow.last_name || '')).trim() || userRow.email : 'A user';
        const userEmail = userRow ? userRow.email : null;
        await notifyAllAdmins(
          'borrowing_request',
          'New Borrowing Request',
          `${displayName} has requested to borrow ${qtyRequested}x ${instrumentName} from ${startDate} to ${endDate}`,
          { requestId: result.insertId, instrumentName, quantity: qtyRequested, startDate, endDate, userId, userName: displayName, userEmail }
        );
      } catch (nErr) {
        console.warn('Failed to notify admins for borrow request:', nErr && nErr.message);
      }

      res.json({
        success: true,
        message: 'Borrow request submitted successfully. Instrument has been held for you pending admin approval.',
        requestId: result.insertId
      });
    } catch (txErr) {
      console.error('Transaction error creating borrow request:', txErr);
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      res.status(500).json({ success: false, message: 'Failed to submit borrow request' });
    }
  } catch (error) {
    console.error('Error creating borrow request:', error);
    res.status(500).json({ success: false, message: 'Failed to submit borrow request' });
  }
});

// Handler to create a rent request (used for both singular and plural endpoints)
async function createRentRequestHandler(req, res) {
  try {
    // Support two payload shapes for compatibility:
    // - legacy single-item fields: { instrumentId, instrumentName, ... }
    // - new atomic multi-item payload: { items: [{ instrumentId, instrumentName, instrumentType, quantity }, ...], startDate, endDate, purpose, notes }
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : null;
    const legacy = !items;
    const legacyFields = legacy ? body : null;
    const userId = req.user && req.user.id;

    // Guard: ensure we have an authenticated user id before attempting DB writes.
    if (!userId) {
      console.warn('rent-requests attempted without authenticated user');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    // For multi-item payloads handle atomic creation
    if (items && Array.isArray(items)) {
      if (!body.startDate || !body.endDate || !body.purpose) {
        return res.status(400).json({ success: false, message: 'Missing required fields (startDate, endDate, purpose)' });
      }

      // Build aggregated quantities per instrumentId to validate inventory once per instrument
      const qtyMap = new Map();
      for (const it of items) {
        const iid = it.instrumentId ? Number(it.instrumentId) : null;
        const q = Number(it.quantity) || 1;
        if (iid) {
          qtyMap.set(iid, (qtyMap.get(iid) || 0) + q);
        }
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Validate availability for each instrumentId
        for (const [iid, needed] of qtyMap.entries()) {
          const [instRows] = await conn.query('SELECT * FROM instruments WHERE instrument_id = ? FOR UPDATE', [iid]);
          if (!instRows || instRows.length === 0) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: `Instrument not found: ${iid}` });
          }
          const available = await getTotalInventory(conn, iid);
          if (available < needed) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ success: false, message: `Insufficient inventory for instrument ${iid}. Available: ${available}, Requested: ${needed}` });
          }
        }

        // Reserve inventory immediately at creation (Option B): decrement per-instrument
        // quantities so the requested units are held for this customer until approved/rejected.
        // We still do not assign concrete serial items here; assignment happens on approval.
        for (const [iid, needed] of qtyMap.entries()) {
          // schema-aware decrement (will choose a location internally if needed)
          await decrementInventory(conn, iid, needed);

          // Update availability_status for each instrument
          try {
            const remaining = await getTotalInventory(conn, iid);
            const newStatus = remaining > 0 ? 'Available' : 'Rented';
            // Sanitize availability status to avoid writing legacy values
            let safeStatus = newStatus;
            if (safeStatus === 'Reserved') safeStatus = 'Rented';
            const allowed = new Set(['Available', 'Rented', 'Borrowed', 'Maintenance', 'Unavailable']);
            if (!allowed.has(safeStatus)) safeStatus = 'Available';
            await safeUpdateInstrumentAvailability(conn, iid, safeStatus);
          } catch (sErr) {
            console.warn('Failed to update instrument availability_status after reservation (multi-item):', sErr && sErr.message);
          }
        }

        // Insert a rent_requests row per item
        // Compute sensible rental_fee and total_amount per item when possible so later approval/invoice code
        // has the correct values (avoids creating ₱0 invoices when frontend didn't include fees).
        const createdIds = [];
        for (const it of items) {
          const instrumentIdVal = it.instrumentId ? Number(it.instrumentId) : null;
          const instrumentNameVal = it.instrumentName || null;
          const instrumentTypeVal = it.instrumentType || null;
          const qty = Number(it.quantity) || 1;

          // Derive per-day price from instruments table when available
          let perDayPrice = null;
          if (instrumentIdVal) {
            try {
              const [pRows] = await conn.query('SELECT price_per_day FROM instruments WHERE instrument_id = ? LIMIT 1', [instrumentIdVal]);
              if (pRows && pRows[0]) perDayPrice = Number(pRows[0].price_per_day) || null;
            } catch (pErr) {
              // ignore and leave price as null
              console.warn('Failed to fetch price_per_day for instrument', instrumentIdVal, pErr && pErr.message);
            }
          }

          // Compute rental duration in days (inclusive), fallback to 1
          let days = 1;
          try {
            if (body.startDate && body.endDate) {
              const s = new Date(body.startDate);
              const e = new Date(body.endDate);
              if (!isNaN(s) && !isNaN(e)) {
                const diffTime = Math.abs(e - s);
                days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              }
            }
          } catch (dErr) {
            days = 1;
          }

          const computedTotal = (perDayPrice != null) ? (perDayPrice * days * qty) : null;
          const computedRentalFee = perDayPrice != null ? perDayPrice : null;

          const [result] = await conn.query(
            `INSERT INTO rent_requests 
             (user_id, instrument_id, instrument_name, instrument_type, quantity, start_date, end_date, purpose, notes, phone, rental_fee, status, payment_mode, payment_type, payment_amount, total_amount, remaining_balance) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
            [
              userId, instrumentIdVal, instrumentNameVal, instrumentTypeVal, qty, body.startDate, body.endDate, body.purpose, body.notes || null, body.phone || null, computedRentalFee,
              body.paymentMode || null,
              body.paymentType || 'full',
              (typeof body.paymentAmount !== 'undefined' && body.paymentAmount !== null)
                ? body.paymentAmount
                : (computedTotal != null ? computedTotal : (typeof body.rentalFee !== 'undefined' && body.rentalFee !== null ? (Number(body.rentalFee) * days * qty) : null)),
              (typeof body.totalAmount !== 'undefined' && body.totalAmount !== null)
                ? body.totalAmount
                : (computedTotal != null ? computedTotal : (typeof body.rentalFee !== 'undefined' && body.rentalFee !== null ? (Number(body.rentalFee) * days * qty) : 0)),
              (typeof body.remainingBalance !== 'undefined' && body.remainingBalance !== null) ? body.remainingBalance : 0
            ]
          );
          createdIds.push(result.insertId);
        }

        await conn.commit(); conn.release();

        // Notify admins once with summary (include user name/email for clarity)
        try {
          const [usr] = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = ? LIMIT 1', [userId]);
          const userRow = usr && usr[0] ? usr[0] : null;
          const displayName = userRow ? (((userRow.first_name || '') + ' ' + (userRow.last_name || '')).trim() || userRow.email || `User #${userId}`) : `User #${userId}`;
          const userEmail = userRow ? userRow.email : null;

          // Try to enrich items with price_per_day when instrument_id provided
          const instrumentIds = items.map(i => i.instrumentId).filter(Boolean).map(Number);
          let priceMap = new Map();
          if (instrumentIds.length) {
            try {
              const [prices] = await pool.query(`SELECT instrument_id, price_per_day FROM instruments WHERE instrument_id IN (${instrumentIds.map(() => '?').join(',')})`, instrumentIds);
              for (const p of prices) priceMap.set(Number(p.instrument_id), p.price_per_day || null);
            } catch (pErr) {
              console.warn('Failed to fetch instrument prices for admin notification:', pErr && pErr.message);
            }
          }

          const itemLabels = items.map(i => {
            const qty = Number(i.quantity) || 1;
            const name = i.instrumentName || (i.instrumentId ? `Instrument ${i.instrumentId}` : 'custom');
            const price = i.instrumentId ? priceMap.get(Number(i.instrumentId)) : null;
            return price ? `${qty}x ${name} (₱${Number(price)}/day)` : `${qty}x ${name}`;
          });

          const itemsLabelPlain = items.map(i => i && (i.instrumentName || i.name || i.instrument_name) ? (i.instrumentName || i.name || i.instrument_name) : '').filter(Boolean);
          const itemsLabelText = itemsLabelPlain.length === 0 ? itemLabels.join(', ') : (itemsLabelPlain.length === 1 ? itemsLabelPlain[0] : itemsLabelPlain.join(', '));
          const titleForAdmin = itemsLabelPlain.length === 1 ? `New Rental Request - ${itemsLabelPlain[0]}` : 'New Rental Request (Multiple Items)';

          await notifyAllAdmins(
            'rental_request',
            titleForAdmin,
            `${displayName} has requested to rent ${itemLabels.join(', ')} from ${body.startDate} to ${body.endDate}`,
            { requestIds: createdIds, items, userId, userName: displayName, userEmail }
          );
        } catch (nErr) {
          console.warn('Failed to notify admins for multi-rental request:', nErr && nErr.message);
        }

        return res.json({ success: true, message: 'Rent requests submitted', requestIds: createdIds });
      } catch (txErr) {
        console.error('Transaction error creating multi rent requests:', txErr);
        try { await conn.rollback(); } catch (e) { }
        conn.release();
        return res.status(500).json({ success: false, message: 'Failed to submit rent requests' });
      }
    }

    // Legacy single-item behavior continues below
    const { instrumentId, instrumentName, instrumentType, quantity, startDate, endDate, purpose, notes, rentalFee } = legacyFields || {};
    // Do NOT accept a client-chosen location for reservation in legacy flow; server will pick one.

    // Validate required fields before attempting DB insert to avoid 500s from SQL NOT NULL errors
    const missing = [];
    if (!instrumentId) missing.push('instrumentId');
    if (!instrumentName) missing.push('instrumentName');
    if (!instrumentType) missing.push('instrumentType');
    if (!startDate) missing.push('startDate');
    if (!endDate) missing.push('endDate');
    if (!purpose) missing.push('purpose');

    if (missing.length > 0) {
      console.warn('Rent-request missing required fields:', missing);
      return res.status(400).json({ success: false, message: 'Missing required fields', missing });
    }

    // Debug logging: show incoming rent-requests details for tracing missing requests
    try {
      console.log(`Incoming rent-requests from user=${req.user.email || userId}:`, { instrumentId, instrumentName, instrumentType, startDate, endDate, quantity, rentalFee, purpose });
    } catch (e) {
      console.warn('Failed to log rent-requests debug info', e);
    }

    // START TRANSACTION - Reserve inventory immediately upon request creation
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock instrument row to prevent race conditions
      const [instRows] = await conn.query('SELECT * FROM instruments WHERE instrument_id = ? FOR UPDATE', [instrumentId]);
      if (!instRows || instRows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, message: 'Instrument not found' });
      }

      // Check available inventory
      const available = await getTotalInventory(conn, instrumentId);
      const qtyRequested = Number(quantity) || 1;

      if (available < qtyRequested) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory. Only ${available} available, but ${qtyRequested} requested.`
        });
      }

      // Decrement inventory IMMEDIATELY (reserve it for this customer).
      // We do NOT use any client-provided location; decrementInventory will auto-select a location.
      // We no longer persist a reserved location on the request row.
      const chosenLoc = null;
      await decrementInventory(conn, instrumentId, qtyRequested);

      // Update availability status if needed
      try {
        const remaining = await getTotalInventory(conn, instrumentId);
        const newStatus = remaining > 0 ? 'Available' : 'Rented';
        await safeUpdateInstrumentAvailability(conn, instrumentId, newStatus);
      } catch (sErr) {
        console.warn('Failed to update instrument availability_status after reservation:', sErr && sErr.message);
      }

      // Create the rent request with status='pending'
      // Ensure we have sensible computed values when frontend omits them (rental_fee may be per-day)
      let computedPerDay = null;
      try {
        const [pRows] = await conn.query('SELECT price_per_day FROM instruments WHERE instrument_id = ? LIMIT 1', [instrumentId]);
        if (pRows && pRows[0]) computedPerDay = Number(pRows[0].price_per_day) || null;
      } catch (pErr) {
        console.warn('Failed to fetch price_per_day for instrument (legacy path)', instrumentId, pErr && pErr.message);
      }

      // Compute rental duration in days (inclusive), fallback to 1
      let computedDays = 1;
      try {
        if (startDate && endDate) {
          const s = new Date(startDate);
          const e = new Date(endDate);
          if (!isNaN(s) && !isNaN(e)) {
            const diffTime = Math.abs(e - s);
            computedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }
        }
      } catch (dErr) {
        computedDays = 1;
      }

      const qty = Number(quantity) || 1;
      const computedTotal = (computedPerDay != null) ? (computedPerDay * computedDays * qty) : null;
      const computedRentalFee = (computedPerDay != null) ? computedPerDay : null;

      const [result] = await conn.query(
        `INSERT INTO rent_requests 
         (user_id, instrument_id, instrument_name, instrument_type, quantity, start_date, end_date, purpose, notes, phone, rental_fee, status, payment_mode, payment_type, payment_amount, total_amount, remaining_balance) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        [
          userId, instrumentId, instrumentName, instrumentType, qtyRequested, startDate, endDate, purpose, notes, req.body.phone || null,
          // persist per-day rental_fee when available, otherwise prefer provided rentalFee
          (typeof req.body.rentalFee !== 'undefined' && req.body.rentalFee !== null) ? req.body.rentalFee : computedRentalFee,
          req.body.paymentMode || null,
          req.body.paymentType || 'full',
          // payment_amount: prefer explicit payload, fallback to computed total or rentalFee*days*qty as last resort
          (typeof req.body.paymentAmount !== 'undefined' && req.body.paymentAmount !== null)
            ? req.body.paymentAmount
            : (computedTotal != null ? computedTotal : (typeof req.body.rentalFee !== 'undefined' && req.body.rentalFee !== null ? (Number(req.body.rentalFee) * computedDays * qty) : 0)),
          // total_amount: prefer explicit payload, otherwise computed total, otherwise rentalFee*days*qty (or 0)
          (typeof req.body.totalAmount !== 'undefined' && req.body.totalAmount !== null)
            ? req.body.totalAmount
            : (computedTotal != null ? computedTotal : (typeof req.body.rentalFee !== 'undefined' && req.body.rentalFee !== null ? (Number(req.body.rentalFee) * computedDays * qty) : 0)),
          (typeof req.body.remainingBalance !== 'undefined' && req.body.remainingBalance !== null) ? req.body.remainingBalance : 0
        ]
      );

      await conn.commit();
      conn.release();

      console.log(`✅ Rent request created with immediate inventory hold. Request ID: ${result.insertId}, Qty: ${qtyRequested}`);

      // Notify all admins about new rental request (include user name/email)
      try {
        const [usr] = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = ? LIMIT 1', [userId]);
        const userRow = usr && usr[0] ? usr[0] : null;
        const displayName = userRow ? (((userRow.first_name || '') + ' ' + (userRow.last_name || '')).trim() || userRow.email || `User #${userId}`) : `User #${userId}`;
        const userEmail = userRow ? userRow.email : null;

        // Try to fetch price_per_day for instrument to include fee in admin summary
        let pricePerDay = null;
        try {
          const [pRows] = await pool.query('SELECT price_per_day FROM instruments WHERE instrument_id = ? LIMIT 1', [instrumentId]);
          if (pRows && pRows[0]) pricePerDay = pRows[0].price_per_day;
        } catch (pErr) {
          // ignore
        }
        const priceLabel = pricePerDay ? ` (₱${pricePerDay}/day)` : '';

        // Title should include the instrument name for single-item rentals
        const singleTitle = `New Rental Request - ${instrumentName}`;
        await notifyAllAdmins(
          'rental_request',
          singleTitle,
          `${displayName} has requested to rent ${qtyRequested}x ${instrumentName}${priceLabel} from ${startDate} to ${endDate}`,
          { requestId: result.insertId, instrumentName, quantity: qtyRequested, startDate, endDate, userId, userName: displayName, userEmail }
        );
      } catch (nErr) {
        console.warn('Failed to notify admins for rental request:', nErr && nErr.message);
      }

      res.json({
        success: true,
        message: 'Rent request submitted successfully. Instrument has been held for you pending admin approval.',
        requestId: result.insertId
      });
    } catch (txErr) {
      console.error('Transaction error creating rent request:', txErr);
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      res.status(500).json({ success: false, message: 'Failed to submit rent request' });
    }
  } catch (error) {
    console.error('Error creating rent request:', error);
    res.status(500).json({ success: false, message: 'Failed to submit rent request' });
  }
}

// Keep both routes available: the old singular route for compatibility and the preferred plural route
router.post('/rent-request', authenticateToken, createRentRequestHandler);
router.post('/rent-requests', authenticateToken, createRentRequestHandler);

// Customer requests reschedule for a rent request (rental)
router.post('/requests/:id/reschedule-request', authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ success: false, message: 'Invalid request id' });

    const { newStart, newEnd, newStartDate, newEndDate } = req.body || {};

    // Fetch rent request to ensure it exists and to get user info
    const [rows] = await pool.query('SELECT rr.*, u.first_name, u.last_name, u.email FROM rent_requests rr LEFT JOIN users u ON rr.user_id = u.id WHERE rr.request_id = ? LIMIT 1', [requestId]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Rent request not found' });
    const rent = rows[0];

    const displayName = ((rent.first_name || '') + ' ' + (rent.last_name || '')).trim() || rent.email || `User #${rent.user_id}`;

    // Notify admins about the reschedule request
    try {
      await notifyAllAdmins(
        'rental_reschedule_request',
        'Rental Reschedule Request',
        `${displayName} requests to reschedule rental ${rent.instrument_name} (Request #${requestId}) to ${newStartDate || newStart || 'N/A'} - ${newEndDate || newEnd || 'N/A'}`,
        { requestId, instrumentName: rent.instrument_name, oldStart: rent.start_date, oldEnd: rent.end_date, newStart: newStartDate || newStart, newEnd: newEndDate || newEnd, userId: rent.user_id, userEmail: rent.email }
      );
    } catch (nErr) {
      console.warn('Failed to notify admins for rental reschedule request:', nErr && nErr.message);
    }

    // Optionally notify the user that request was received
    try {
      await notifyUser(rent.email, 'rental_reschedule_submitted', 'Rental Reschedule Submitted', 'We received your reschedule request. Our team will review it and contact you.', { requestId, newStart: newStartDate || newStart, newEnd: newEndDate || newEnd });
    } catch (uErr) {
      console.warn('Failed to notify user about rental reschedule submission:', uErr && uErr.message);
    }

    res.status(201).json({ success: true, message: 'Reschedule request submitted' });
  } catch (error) {
    console.error('Error submitting rental reschedule request:', error);
    res.status(500).json({ success: false, message: 'Failed to submit reschedule request' });
  }
});

// Customer cancels a rent request (rental) - customer must be authenticated
router.patch('/requests/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ success: false, message: 'Invalid request id' });

    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    console.log(`Attempting rent cancel: requestId=${requestId}, userId=${userId}`);

    // Fetch rent request and ensure it belongs to the requesting user
    const [rows] = await pool.query('SELECT * FROM rent_requests WHERE request_id = ? LIMIT 1', [requestId]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Rent request not found' });
    const rent = rows[0];
    console.log('Rent row:', rent);
    if (Number(rent.user_id) !== Number(userId)) return res.status(403).json({ success: false, message: 'You do not have permission to cancel this rent request' });

    // Do not allow cancelling already-cancelled or rejected requests
    if (String(rent.status).toLowerCase() === 'cancelled' || String(rent.status).toLowerCase() === 'rejected') {
      return res.status(400).json({ success: false, message: `This rent request is already ${rent.status}` });
    }

    // Update status to cancelled
    try {
      const [updateRes] = await pool.query('UPDATE rent_requests SET status = ? WHERE request_id = ?', ['cancelled', requestId]);
      console.log('Rent cancel update result:', updateRes && updateRes.affectedRows ? updateRes.affectedRows : updateRes);
    } catch (uErr) {
      // Handle MySQL enum truncation (e.g., 'cancelled' not present in ENUM)
      const msg = uErr && uErr.message ? uErr.message : '';
      console.warn('DB error updating rent_requests status, attempting fallback:', msg);
      if (uErr && (uErr.errno === 1265 || /Data truncated/i.test(msg) || /incorrect enum value/i.test(msg))) {
        try {
          // Fallback to 'rejected' which exists in older schemas
          const [fb] = await pool.query('UPDATE rent_requests SET status = ? WHERE request_id = ?', ['rejected', requestId]);
          console.log('Rent cancel fallback update result (rejected):', fb && fb.affectedRows ? fb.affectedRows : fb);
        } catch (fbErr) {
          console.error('Fallback DB error updating rent_requests status:', fbErr && fbErr.message, fbErr);
          if (process.env.NODE_ENV === 'development') {
            return res.status(500).json({ success: false, message: 'Failed to cancel rent request (DB fallback)', error: fbErr && fbErr.message, stack: fbErr && fbErr.stack });
          }
          return res.status(500).json({ success: false, message: 'Failed to cancel rent request' });
        }
      } else {
        console.error('DB error updating rent_requests status:', msg, uErr);
        if (process.env.NODE_ENV === 'development') {
          return res.status(500).json({ success: false, message: 'Failed to cancel rent request (DB)', error: uErr && uErr.message, stack: uErr && uErr.stack });
        }
        return res.status(500).json({ success: false, message: 'Failed to cancel rent request' });
      }
    }

    // Inventory release is intentionally skipped here — manual handling expected.

    // Notify admins about cancellation
    try {
      const displayName = (req.user && ((req.user.first_name || '') + ' ' + (req.user.last_name || '')).trim()) || req.user.email || `User #${userId}`;
      await notifyAllAdmins(
        'rental_cancelled',
        'Rental Cancelled',
        `${displayName} cancelled their rental request for ${rent.instrument_name || rent.instrumentName || 'an instrument'}`,
        { requestId, instrumentName: rent.instrument_name || rent.instrumentName || null, quantity: rent.quantity || 1, userId }
      );
    } catch (nErr) {
      console.warn('Failed to notify admins for rent cancellation:', nErr && nErr.message);
    }

    return res.json({ success: true, message: 'Rent request cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling rent request:', error);
    const resp = { success: false, message: 'Failed to cancel rent request' };
    if (process.env.NODE_ENV === 'development') {
      resp.error = error && error.message ? error.message : String(error);
      resp.stack = error && error.stack ? error.stack : null;
    }
    return res.status(500).json(resp);
  }
});

// Admin: mark a cancelled rental as returned and release inventory back to stock
router.post('/requests/:id/return', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ success: false, message: 'Invalid request id' });

    // Fetch the rent request
    const [rows] = await pool.query('SELECT * FROM rent_requests WHERE request_id = ? LIMIT 1', [requestId]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Rent request not found' });
    const rent = rows[0];

    const instrumentId = rent.instrument_id || rent.instrumentId || null;
    const qty = Number(rent.quantity) || 1;

    // Perform inventory increment inside a connection transaction to ensure consistency
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (instrumentId) {
        await incrementInventory(conn, Number(instrumentId), qty);
      }

      // Update rent_request status to returned (if column exists), else store returned_at if available
      try {
        await conn.query('UPDATE rent_requests SET status = ?, updated_at = NOW() WHERE request_id = ?', ['returned', requestId]);
      } catch (uErr) {
        // best-effort: if status column / update fails, log and continue
        console.warn('Failed to update rent_requests status to returned:', uErr && uErr.message);
      }

      // Optionally update instrument availability
      try {
        const remaining = await getTotalInventory(conn, Number(instrumentId));
        const newStatus = remaining > 0 ? 'Available' : 'Borrowed';
        await safeUpdateInstrumentAvailability(conn, Number(instrumentId), newStatus);
      } catch (sErr) {
        console.warn('Failed to update instrument availability after return:', sErr && sErr.message);
      }

      await conn.commit(); conn.release();
    } catch (txErr) {
      try { await conn.rollback(); } catch (e) {}
      conn.release();
      console.error('Transaction failed returning inventory:', txErr);
      return res.status(500).json({ success: false, message: 'Failed to return inventory', error: txErr && txErr.message });
    }

    // Notify the customer that their rental has been marked returned
    try {
      if (rent.user_id && rent.user_id > 0 && rent.email) {
        await notifyUser(rent.email, 'info', 'Rental Returned', `Your rental of ${rent.instrument_name || rent.instrumentName || 'an instrument'} has been marked as returned and placed back to inventory.`, { requestId });
      } else if (rent.user_id && rent.user_id > 0) {
        // fetch user email if missing
        const [uRows] = await pool.query('SELECT email FROM users WHERE id = ? LIMIT 1', [rent.user_id]);
        if (uRows && uRows[0] && uRows[0].email) {
          await notifyUser(uRows[0].email, 'info', 'Rental Returned', `Your rental of ${rent.instrument_name || rent.instrumentName || 'an instrument'} has been marked as returned and placed back to inventory.`, { requestId });
        }
      }
    } catch (nErr) {
      console.warn('Failed to notify user about return:', nErr && nErr.message);
    }

    // Notify admins for audit trail
    try {
      await notifyAllAdmins('rental_returned', 'Rental Returned', `Admin ${req.user.email || req.user.id} marked rental request #${requestId} as returned.`, { requestId, instrumentId, quantity: qty });
    } catch (aErr) {
      console.warn('Failed to notify admins about returned rental:', aErr && aErr.message);
    }

    return res.json({ success: true, message: 'Inventory returned successfully' });
  } catch (error) {
    console.error('Error in return endpoint:', error);
    return res.status(500).json({ success: false, message: 'Failed to return inventory', error: error && error.message });
  }
});

// Approve borrow request
router.put('/borrow-request/:id/approve', authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      console.warn('Invalid borrow request id provided for approve:', req.params.id);
      return res.status(400).json({ success: false, message: 'Invalid request id' });
    }
    const approvedBy = req.user.id;
    const locationId = req.body.locationId ? Number(req.body.locationId) : null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [reqRows] = await conn.query('SELECT * FROM borrow_requests WHERE request_id = ? FOR UPDATE', [requestId]);
      if (!reqRows || reqRows.length === 0) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, message: 'Borrow request not found' });
      }

      const requestRow = reqRows[0];
      if (requestRow.status !== 'pending') {
        await conn.rollback(); conn.release();
        return res.status(400).json({ success: false, message: 'Request is not pending' });
      }

      const instrumentId = requestRow.instrument_id;
      const qtyRequested = Number(requestRow.quantity) || 0;

      const [instRows] = await conn.query('SELECT * FROM instruments WHERE instrument_id = ? FOR UPDATE', [instrumentId]);
      if (!instRows || instRows.length === 0) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, message: 'Instrument not found' });
      }

      // Update availability status depending on remaining quantity
      try {
        const remaining = await getTotalInventory(conn, instrumentId);
        const newStatus = remaining > 0 ? 'Available' : 'Borrowed';
        let safeStatus = newStatus;
        if (safeStatus === 'Reserved') safeStatus = 'Rented';
        const allowed2 = new Set(['Available', 'Rented', 'Borrowed', 'Maintenance', 'Unavailable']);
        if (!allowed2.has(safeStatus)) safeStatus = 'Available';
        await safeUpdateInstrumentAvailability(conn, instrumentId, safeStatus);
      } catch (sErr) {
        console.warn('Failed to update instrument availability_status after borrow approval:', sErr && sErr.message);
      }

      // Mark request approved and persist chosen location
      await conn.query('UPDATE borrow_requests SET status = ?, approved_by = ?, approved_at = NOW(), location_id = ? WHERE request_id = ?', ['approved', approvedBy, locationId || null, requestId]);

      // Assign concrete instrument_items to this borrow (if available) so concrete
      // inventory reflects the borrowed units in instrument_items table. This mirrors
      // the rent approval assignment logic but marks items as 'Borrowed' and sets
      // `current_borrow_id` for later return processing.
      try {
        const targetLocation = locationId || null;
        let assignIds = [];
        if (targetLocation) {
          const [locRows] = await conn.query(
            `SELECT item_id FROM instrument_items WHERE instrument_id = ? AND is_active = TRUE AND status = 'Available' AND (location_id = ? OR location_id IS NULL) LIMIT ? FOR UPDATE`,
            [instrumentId, targetLocation, qtyRequested]
          );
          assignIds = (locRows || []).map(r => r.item_id);
        }
        if (assignIds.length < qtyRequested) {
          const need = qtyRequested - assignIds.length;
          const [moreRows] = await conn.query(
            `SELECT item_id FROM instrument_items WHERE instrument_id = ? AND is_active = TRUE AND status = 'Available' ${targetLocation ? 'AND (location_id IS NULL OR location_id != ?)' : ''} LIMIT ? FOR UPDATE`,
            targetLocation ? [instrumentId, targetLocation, need] : [instrumentId, need]
          );
          assignIds = assignIds.concat((moreRows || []).map(r => r.item_id));
        }
        if (assignIds.length > 0) {
          const itemStatus = 'Borrowed';
          if (targetLocation) {
            await conn.query(
              `UPDATE instrument_items SET status = ?, current_borrow_id = ?, location_id = ?, updated_at = NOW() WHERE item_id IN (${assignIds.map(() => '?').join(',')})`,
              [itemStatus, requestId, targetLocation, ...assignIds]
            );
          } else {
            await conn.query(
              `UPDATE instrument_items SET status = ?, current_borrow_id = ?, updated_at = NOW() WHERE item_id IN (${assignIds.map(() => '?').join(',')})`,
              [itemStatus, requestId, ...assignIds]
            );
          }
          console.log(`Assigned instrument_items to borrow request ${requestId}: ${assignIds.join(',')}`);
          // Audit log entry (record assigned item ids)
          try {
            await conn.query(
              `INSERT INTO audit_log (table_name, record_id, action, user_id, user_email, after_value) VALUES ('instrument_items', ?, 'ASSIGN_BORROW', ?, ?, ?)`,
              [assignIds.join(','), approvedBy, req.user.email || null, JSON.stringify({ assignedItems: assignIds, requestId })]
            );
          } catch (alogErr) {
            console.warn('Failed to write audit log for instrument item assignment (borrow):', alogErr && alogErr.message);
          }
        }
      } catch (assignErr) {
        console.warn('Failed to assign concrete instrument_items during borrow approval:', assignErr && assignErr.message);
      }

      await conn.commit(); conn.release();

      console.log(`✅ Borrow request ${requestId} approved${locationId ? ` from location ${locationId}` : ''}. Inventory already reserved, now confirmed as borrowed.`);

      // Persist a notification for the user to inform them of approval
      try {
        const [userRows] = await pool.query('SELECT email, first_name, last_name FROM users WHERE id = ?', [requestRow.user_id]);
        const userEmail = userRows && userRows[0] ? userRows[0].email : null;
        const instrumentLabel = requestRow.instrument_name || requestRow.instrument || 'instrument';
        if (userEmail) {
          try {
            await pool.query(
              `INSERT INTO notifications (user_email, type, title, message, data, delivered_at, created_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
              [String(userEmail).toLowerCase().trim(), 'success', 'Instrument Borrow Approved', `Your borrow request for "${instrumentLabel}" has been approved.`, JSON.stringify({ requestId: requestId, instrument: instrumentLabel, amount: 0 })]
            );
            console.log('Created notification for user', userEmail, 'borrow request', requestId);
          } catch (notifErr) {
            console.warn('Failed to create notification for borrow approval:', notifErr && notifErr.message);
          }
        }
      } catch (e) {
        console.warn('Failed to look up user for notification after borrow approval:', e && e.message);
      }

      res.json({ success: true, message: 'Borrow request approved' });
    } catch (txErr) {
      console.error('Transaction error approving borrow request:', txErr);
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      res.status(500).json({ success: false, message: 'Failed to approve request' });
    }
  } catch (error) {
    console.error('Error approving borrow request:', error);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
});

// Approve rent request
router.put('/rent-requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const conn = await pool.getConnection();
    let instrumentId, qtyRequested, requestRow;
    let dbError = null;
    const approvedBy = req.user.id;
    const locationId = req.body.locationId ? Number(req.body.locationId) : null;
    try {
      await conn.beginTransaction();
      const [reqRows] = await conn.query('SELECT * FROM rent_requests WHERE request_id = ? FOR UPDATE', [requestId]);
      if (!reqRows || reqRows.length === 0) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, message: 'Rent request not found' });
      }
      requestRow = reqRows[0];
      instrumentId = requestRow.instrument_id;
      qtyRequested = Number(requestRow.quantity) || 1;

      // Mark instrument as rented immediately (no reservation holding period)
      // Set availability to 'Available' if inventory remains after assignment,
      // otherwise set to 'Rented'. This prevents hiding instruments that still
      // have units available when a partial quantity was approved.
      try {
        let remainingAfter = await getTotalInventory(conn, instrumentId);
        // If instrument_inventory exists but reports zero, prefer counting concrete available items
        const schema = await _ensureSchemaCache();
        if (schema.invExists && Number(remainingAfter) === 0) {
          try {
            const [cntRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM instrument_items WHERE instrument_id = ? AND is_active = TRUE AND status = 'Available'`, [instrumentId]);
            const availItems = cntRows && cntRows[0] ? Number(cntRows[0].cnt || 0) : 0;
            remainingAfter = availItems;
          } catch (ie) {
            // ignore and keep remainingAfter as-is
          }
        }
        const availStatus = remainingAfter > 0 ? 'Available' : 'Rented';
        await safeUpdateInstrumentAvailability(conn, instrumentId, availStatus);
      } catch (availErr) {
        // fallback to mark as Rented if inventory check fails
        try { await safeUpdateInstrumentAvailability(conn, instrumentId, 'Rented'); } catch (e) { }
      }

      // Set request status to 'approved' (rental is now active) and persist chosen location
      const newRequestStatus = 'approved';
      await conn.query(
        'UPDATE rent_requests SET status = ?, approved_by = ?, approved_at = NOW(), location_id = ? WHERE request_id = ?',
        [newRequestStatus, approvedBy, locationId || null, requestId]
      );

      // Assign instrument_items and set to 'Rented'
      try {
        const targetLocation = locationId || null;
        let assignIds = [];
        if (targetLocation) {
          const [locRows] = await conn.query(
            `SELECT item_id FROM instrument_items WHERE instrument_id = ? AND is_active = TRUE AND status = 'Available' AND (location_id = ? OR location_id IS NULL) LIMIT ? FOR UPDATE`,
            [instrumentId, targetLocation, qtyRequested]
          );
          assignIds = (locRows || []).map(r => r.item_id);
        }
        if (assignIds.length < qtyRequested) {
          const need = qtyRequested - assignIds.length;
          const [moreRows] = await conn.query(
            `SELECT item_id FROM instrument_items WHERE instrument_id = ? AND is_active = TRUE AND status = 'Available' ${targetLocation ? 'AND (location_id IS NULL OR location_id != ?)' : ''} LIMIT ? FOR UPDATE`,
            targetLocation ? [instrumentId, targetLocation, need] : [instrumentId, need]
          );
          assignIds = assignIds.concat((moreRows || []).map(r => r.item_id));
        }
        if (assignIds.length > 0) {
          // Set concrete items to 'Rented' on approval
          const itemStatus = 'Rented';
          if (targetLocation) {
            await conn.query(
              `UPDATE instrument_items SET status = ?, current_rental_id = ?, location_id = ?, updated_at = NOW() WHERE item_id IN (${assignIds.map(() => '?').join(',')})`,
              [itemStatus, requestId, targetLocation, ...assignIds]
            );
          } else {
            await conn.query(
              `UPDATE instrument_items SET status = ?, current_rental_id = ?, updated_at = NOW() WHERE item_id IN (${assignIds.map(() => '?').join(',')})`,
              [itemStatus, requestId, ...assignIds]
            );
          }
          console.log(`Assigned instrument_items to rent request ${requestId}: ${assignIds.join(',')}`);
          // Audit log entry (record assigned item ids)
          try {
            await conn.query(
              `INSERT INTO audit_log (table_name, record_id, action, user_id, user_email, after_value) VALUES ('instrument_items', ?, 'ASSIGN_RENT', ?, ?, ?)`,
              [assignIds.join(','), approvedBy, req.user.email || null, JSON.stringify({ assignedItems: assignIds, requestId })]
            );
          } catch (alogErr) {
            console.warn('Failed to write audit log for instrument item assignment:', alogErr && alogErr.message);
          }
        }
      } catch (assignErr) {
        console.warn('Failed to assign concrete instrument_items during approval:', assignErr && assignErr.message);
      }

      await conn.commit();
      conn.release();

      console.log(`✅ Rent request ${requestId} approved. Status: ${newRequestStatus} - Rental is now active`);
    } catch (txErr) {
      dbError = txErr;
      console.error('Transaction error approving rent request:', txErr);
      try { await conn.rollback(); } catch (e) { }
      conn.release();
    }

    if (dbError) {
      return res.status(500).json({ success: false, message: 'Failed to approve request' });
    }

    // Create invoice for the rental
    let createdInvoiceId = null;
    try {
      let invoiceAmount = 0;
      let daysForInvoice = 1;
      try {
        if (requestRow.start_date && requestRow.end_date) {
          const s = new Date(requestRow.start_date);
          const e = new Date(requestRow.end_date);
          if (!isNaN(s) && !isNaN(e)) {/* Lines 887-889 omitted */ }
        }
      } catch (dErr) {
        daysForInvoice = 1;
      }
      const qtyForInvoice = Number(requestRow.quantity) || 1;
      if (requestRow.total_amount != null && requestRow.total_amount !== '') {
        invoiceAmount = Number(requestRow.total_amount) || 0;
      } else if (requestRow.rental_fee != null && requestRow.rental_fee !== '') {
        invoiceAmount = Number(requestRow.rental_fee) * daysForInvoice * qtyForInvoice;
      } else {
        // fallback: try price_per_day
        let pricePerDay = null;
        try {/* Lines 903-905 omitted */ } catch (pErr) { }
        invoiceAmount = pricePerDay * daysForInvoice * qtyForInvoice;
      }
      const description = `Rental: ${requestRow.instrument_name} (${requestRow.start_date} to ${requestRow.end_date})`;
      console.log(`💰 Creating invoice for rental - User: ${requestRow.user_id}, Amount: ${invoiceAmount}`);
      const invoice = await billingService.generateInvoice(requestRow.user_id, invoiceAmount, description);
      createdInvoiceId = invoice.invoice_id;
      await pool.query('UPDATE invoices SET status = ? WHERE invoice_id = ?', ['approved', invoice.invoice_id]);
      await pool.query('UPDATE rent_requests SET invoice_id = ? WHERE request_id = ?', [invoice.invoice_id, requestId]);
      console.log(`✅ Invoice created and approved - ID: ${invoice.invoice_id}, Number: ${invoice.invoice_number}`);
    } catch (invoiceErr) {
      console.error('❌ Failed to create invoice for rent request:', invoiceErr);
    }

    // Persist a notification for the user to inform them of approval
    try {
      const [userRows] = await pool.query('SELECT email, first_name, last_name FROM users WHERE id = ?', [requestRow.user_id]);
      const userEmail = userRows && userRows[0] ? userRows[0].email : null;
      const instrumentLabel = requestRow.instrument_name || requestRow.instrument || 'instrument';
      let amountForThis = null;
      const qty = Number(requestRow.quantity) || 1;
      let daysForInvoice = 1;
      try {
        if (requestRow.start_date && requestRow.end_date) {
          const s = new Date(requestRow.start_date);
          const e = new Date(requestRow.end_date);
          if (!isNaN(s) && !isNaN(e)) {
            const diffTime = Math.abs(e - s);
            daysForInvoice = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }
        }
      } catch (dErr) {
        daysForInvoice = 1;
      }
      if (requestRow.rental_fee != null && requestRow.rental_fee !== '') {
        amountForThis = Number(requestRow.rental_fee) * daysForInvoice * qty;
      } else if (requestRow.total_amount != null && requestRow.total_amount !== '') {
        amountForThis = Number(requestRow.total_amount) || 0;
      }
      let pricePerDay = null;
      try {
        const [pRows] = await pool.query('SELECT price_per_day FROM instruments WHERE instrument_id = ? LIMIT 1', [instrumentId]);
        if (pRows && pRows[0]) pricePerDay = pRows[0].price_per_day;
      } catch (pErr) { }
      if (userEmail) {
        try {
          const formattedAmount = amountForThis ? amountForThis.toLocaleString() : '0';
          const message = `Your rental request for "${instrumentLabel}" has been approved! The amount due is ₱${formattedAmount}. Your rental is now active!\n\nPlease proceed to payment. Thank you for choosing our services!`;
          await pool.query(
            `INSERT INTO notifications (user_email, type, title, message, data, delivered_at, created_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              String(userEmail).toLowerCase().trim(),
              'success',
              'Instrument Rental Approved',
              message,
              JSON.stringify({ requestId: requestId, instrument: instrumentLabel, amount: amountForThis, invoiceId: createdInvoiceId, price_per_day: pricePerDay, status: 'approved' })
            ]
          );
          console.log('Created notification for user', userEmail, 'rent request', requestId, 'amount', amountForThis);
        } catch (notifErr) {
          console.warn('Failed to create notification for rent approval:', notifErr && notifErr.message);
        }
      }
    } catch (e) {
      console.warn('Failed to look up user for notification after rent approval:', e && e.message);
    }

    res.json({
      success: true,
      message: 'Rent request approved. Instrument is now rented and ready for pickup.'
    });
  } catch (error) {
    console.error('Error approving rent request:', error);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
});
// Reject rent request
router.put('/rent-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      console.warn('Invalid rent request id provided for reject:', req.params.id);
      return res.status(400).json({ success: false, message: 'Invalid request id' });
    }
    const approvedBy = req.user.id;

    // START TRANSACTION - Need to return inventory when rejecting
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock rent request
      const [reqRows] = await conn.query('SELECT * FROM rent_requests WHERE request_id = ? FOR UPDATE', [requestId]);
      if (!reqRows || reqRows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, message: 'Rent request not found' });
      }

      const requestRow = reqRows[0];
      if (requestRow.status !== 'pending') {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ success: false, message: 'Can only reject pending requests' });
      }

      const instrumentId = requestRow.instrument_id;
      const qtyToReturn = Number(requestRow.quantity) || 0;

      // Lock instrument
      const [instRows] = await conn.query('SELECT * FROM instruments WHERE instrument_id = ? FOR UPDATE', [instrumentId]);
      if (!instRows || instRows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, message: 'Instrument not found' });
      }

      // RETURN the inventory (increment it back) since the reservation is rejected.
      // We no longer track an explicit reserved location on the request; return to default.
      await incrementInventory(conn, instrumentId, qtyToReturn, null);

      // Update availability status
      try {
        const remaining = await getTotalInventory(conn, instrumentId);
        const newStatus = remaining > 0 ? 'Available' : 'Unavailable';
        await safeUpdateInstrumentAvailability(conn, instrumentId, newStatus);
      } catch (sErr) {
        console.warn('Failed to update instrument availability_status after rejection:', sErr && sErr.message);
      }

      // Mark request as rejected
      await conn.query(
        'UPDATE rent_requests SET status = ?, approved_by = ?, approved_at = NOW() WHERE request_id = ?',
        ['rejected', approvedBy, requestId]
      );

      await conn.commit();
      conn.release();

      console.log(`✅ Rent request ${requestId} rejected. Inventory returned: ${qtyToReturn} units.`);

      res.json({ success: true, message: 'Rent request rejected and inventory returned' });
    } catch (txErr) {
      console.error('Transaction error rejecting rent request:', txErr);
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      res.status(500).json({ success: false, message: 'Failed to reject request' });
    }
  } catch (error) {
    console.error('Error rejecting rent request:', error);
    res.status(500).json({ success: false, message: 'Failed to reject request' });
  }
});

// Mark a rent request as returned (process return, increment inventory)
router.put('/rent-requests/:id/return', authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid request id' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock rent request
      const [reqRows] = await conn.query('SELECT * FROM rent_requests WHERE request_id = ? FOR UPDATE', [requestId]);
      if (!reqRows || reqRows.length === 0) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, message: 'Rent request not found' });
      }

      const requestRow = reqRows[0];
      if (!['approved', 'paid'].includes(requestRow.status)) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ success: false, message: 'Only approved or paid requests can be returned' });
      }

      const instrumentId = requestRow.instrument_id;
      const qty = Number(requestRow.quantity) || 0;

      // If concrete instrument_items were assigned to this request, mark them Available
      try {
        const [assignedRows] = await conn.query('SELECT item_id, location_id FROM instrument_items WHERE current_rental_id = ? FOR UPDATE', [requestId]);
        if (assignedRows && assignedRows.length) {
          // Count per-location so we can increment inventory accurately
          const counts = {};
          for (const r of assignedRows) {
            const loc = r.location_id || null;
            counts[loc] = (counts[loc] || 0) + 1;
          }
          // Update concrete items to Available and clear current_rental_id
          const itemIds = assignedRows.map(r => r.item_id);
          await conn.query(`UPDATE instrument_items SET status = 'Available', current_rental_id = NULL, updated_at = NOW() WHERE item_id IN (${itemIds.map(() => '?').join(',')})`, itemIds);

          // Increment inventory per-location where possible
          for (const locKey of Object.keys(counts)) {
            const count = counts[locKey] || 0;
            const locId = locKey ? Number(locKey) : null;
            if (count > 0) await incrementInventory(conn, instrumentId, count, locId);
          }
        } else {
          // Fallback: increment generic inventory if no concrete items found
          await incrementInventory(conn, instrumentId, qty);
        }
      } catch (invErr) {
        console.warn('Failed to restore concrete instrument_items during return, falling back to generic increment:', invErr && invErr.message);
        await incrementInventory(conn, instrumentId, qty);
      }

      // Update request to returned
      await conn.query('UPDATE rent_requests SET status = ?, returned_at = NOW() WHERE request_id = ?', ['returned', requestId]);

      // Update instrument availability_status based on new quantity
      const remaining = await getTotalInventory(conn, instrumentId);
      const newStatus = remaining > 0 ? 'Available' : 'Rented';
      let safeStatus = newStatus;
      if (safeStatus === 'Reserved') safeStatus = 'Rented';
      const allowed3 = new Set(['Available', 'Rented', 'Borrowed', 'Maintenance', 'Unavailable']);
      if (!allowed3.has(safeStatus)) safeStatus = 'Available';
      await safeUpdateInstrumentAvailability(conn, instrumentId, safeStatus);

      await conn.commit(); conn.release();

      // Optional: create notification for user about return processed
      try {
        const [userRows] = await pool.query('SELECT email FROM users WHERE id = ?', [requestRow.user_id]);
        const userEmail = userRows && userRows[0] ? userRows[0].email : null;
        if (userEmail) {
          await pool.query(
            `INSERT INTO notifications (user_email, type, title, message, data, delivered_at, created_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [String(userEmail).toLowerCase().trim(), 'info', 'Return Processed', `Your rental for "${requestRow.instrument_name}" has been marked as returned. Thank you.`, JSON.stringify({ requestId })]
          );
        }
      } catch (nErr) {
        console.warn('Failed to create return notification for rent request', requestId, nErr && nErr.message);
      }

      res.json({ success: true, message: 'Rent request marked as returned' });
    } catch (txErr) {
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      console.error('Transaction error processing rent return:', txErr);
      res.status(500).json({ success: false, message: 'Failed to process return' });
    }
  } catch (err) {
    console.error('Error processing rent return:', err);
    res.status(500).json({ success: false, message: 'Failed to process return', error: err.message });
  }
});

// Mark a borrow request as returned (process return, increment inventory)
router.put('/borrow-request/:id/return', authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid request id' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock borrow request
      const [reqRows] = await conn.query('SELECT * FROM borrow_requests WHERE request_id = ? FOR UPDATE', [requestId]);
      if (!reqRows || reqRows.length === 0) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, message: 'Borrow request not found' });
      }

      const requestRow = reqRows[0];
      if (requestRow.status !== 'approved') {
        await conn.rollback(); conn.release();
        return res.status(400).json({ success: false, message: 'Only approved borrow requests can be returned' });
      }

      const instrumentId = requestRow.instrument_id;
      const qty = Number(requestRow.quantity) || 0;

      // If concrete instrument_items were assigned to this borrow, mark them Available
      try {
        const [assignedRows] = await conn.query('SELECT item_id, location_id FROM instrument_items WHERE current_borrow_id = ? FOR UPDATE', [requestId]);
        if (assignedRows && assignedRows.length) {
          const counts = {};
          for (const r of assignedRows) {
            const loc = r.location_id || null;
            counts[loc] = (counts[loc] || 0) + 1;
          }
          const itemIds = assignedRows.map(r => r.item_id);
          await conn.query(`UPDATE instrument_items SET status = 'Available', current_borrow_id = NULL, updated_at = NOW() WHERE item_id IN (${itemIds.map(() => '?').join(',')})`, itemIds);
          for (const locKey of Object.keys(counts)) {
            const count = counts[locKey] || 0;
            const locId = locKey ? Number(locKey) : null;
            if (count > 0) await incrementInventory(conn, instrumentId, count, locId);
          }
        } else {
          await incrementInventory(conn, instrumentId, qty);
        }
      } catch (invErr) {
        console.warn('Failed to restore concrete instrument_items during borrow return, falling back to generic increment:', invErr && invErr.message);
        await incrementInventory(conn, instrumentId, qty);
      }

      // Update request to returned
      await conn.query('UPDATE borrow_requests SET status = ?, returned_at = NOW() WHERE request_id = ?', ['returned', requestId]);

      // Update instrument availability_status based on new quantity
      const remaining = await getTotalInventory(conn, instrumentId);
      const newStatus = remaining > 0 ? 'Available' : 'Borrowed';
      await safeUpdateInstrumentAvailability(conn, instrumentId, newStatus);

      await conn.commit(); conn.release();

      // Optional: create notification for user about return processed
      try {
        const [userRows] = await pool.query('SELECT email FROM users WHERE id = ?', [requestRow.user_id]);
        const userEmail = userRows && userRows[0] ? userRows[0].email : null;
        if (userEmail) {
          await pool.query(
            `INSERT INTO notifications (user_email, type, title, message, data, delivered_at, created_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [String(userEmail).toLowerCase().trim(), 'info', 'Return Processed', `Your borrow for "${requestRow.instrument_name}" has been marked as returned. Thank you.`, JSON.stringify({ requestId })]
          );
        }
      } catch (nErr) {
        console.warn('Failed to create return notification for borrow request', requestId, nErr && nErr.message);
      }

      res.json({ success: true, message: 'Borrow request marked as returned' });
    } catch (txErr) {
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      console.error('Transaction error processing borrow return:', txErr);
      res.status(500).json({ success: false, message: 'Failed to process return' });
    }
  } catch (err) {
    console.error('Error processing borrow return:', err);
    res.status(500).json({ success: false, message: 'Failed to process return', error: err.message });
  }
});

// Get all instruments - FIXED VERSION with better error handling
// This is mounted at /api/instruments/ in server.js
router.get('/', async (req, res) => {
  try {
    console.log('Fetching instruments from database...'); // Debug log
    const { start, end } = req.query;

    // Defensive: check if instrument_inventory table exists in current database
    // and whether instruments.primary_location_id exists. Some environments may
    // not have run the migrations/setup yet, which would cause the JOINs to throw.
    // Some environments may not have run the migrations/setup yet, which would cause
    // the JOIN on instrument_inventory to throw a SQL error. If the table is missing,
    // fall back to returning quantity = 0 to avoid 500 errors.
    let rows = [];
    try {
      const schema = await _ensureSchemaCache();
      const invExists = schema.invExists;
      const primaryExists = schema.primaryLocationExists;

      if (invExists) {
        if (primaryExists) {
          const [qRows] = await pool.query(`
            SELECT 
              i.instrument_id,
              i.name,
              i.category,
              i.subcategory,
              i.brand,
              i.condition_status,
              i.availability_status,
              i.price_per_day,
              i.notes,
              i.is_archived,
              i.created_at,
              i.updated_at,
              i.primary_location_id,
              pl.location_name AS primary_location_name,
              COALESCE(inv.total_qty, 0) AS quantity
            FROM instruments i
            LEFT JOIN locations pl ON i.primary_location_id = pl.location_id
            LEFT JOIN (
              SELECT instrument_id, COALESCE(SUM(quantity),0) AS total_qty
              FROM instrument_inventory
              GROUP BY instrument_id
            ) inv ON inv.instrument_id = i.instrument_id
            WHERE i.is_archived = FALSE
            ORDER BY i.category, i.name
          `);
          rows = qRows;
        } else {
          // instrument_inventory exists but instruments.primary_location_id column is missing
          const [qRows] = await pool.query(`
            SELECT 
              i.instrument_id,
              i.name,
              i.category,
              i.subcategory,
              i.brand,
              i.condition_status,
              i.availability_status,
              i.price_per_day,
              i.notes,
              i.is_archived,
              i.created_at,
              i.updated_at,
              COALESCE(inv.total_qty, 0) AS quantity
            FROM instruments i
            LEFT JOIN (
              SELECT instrument_id, COALESCE(SUM(quantity),0) AS total_qty
              FROM instrument_inventory
              GROUP BY instrument_id
            ) inv ON inv.instrument_id = i.instrument_id
            WHERE i.is_archived = FALSE
            ORDER BY i.category, i.name
          `);
          rows = qRows;
        }
      } else {
        console.warn('instrument_inventory table not found — returning instruments with quantity=0');
        if (primaryExists) {
          const [qRows] = await pool.query(`
            SELECT 
              i.instrument_id,
              i.name,
              i.category,
              i.subcategory,
              i.brand,
              i.condition_status,
              i.availability_status,
              i.price_per_day,
              i.notes,
              i.is_archived,
              i.created_at,
              i.updated_at,
              i.primary_location_id,
              pl.location_name AS primary_location_name,
              0 AS quantity
            FROM instruments i
            LEFT JOIN locations pl ON i.primary_location_id = pl.location_id
            WHERE i.is_archived = FALSE
            ORDER BY i.category, i.name
          `);
          rows = qRows;
        } else {
          const [qRows] = await pool.query(`
            SELECT 
              i.instrument_id,
              i.name,
              i.category,
              i.subcategory,
              i.brand,
              i.condition_status,
              i.availability_status,
              i.price_per_day,
              i.notes,
              i.is_archived,
              i.created_at,
              i.updated_at,
              0 AS quantity
            FROM instruments i
            WHERE i.is_archived = FALSE
            ORDER BY i.category, i.name
          `);
          rows = qRows;
        }
      }
    } catch (chkErr) {
      // If the information_schema query itself fails, log and rethrow so the outer
      // catch returns a helpful error message to the client.
      console.error('Failed to verify instrument_inventory existence:', chkErr);
      throw chkErr;
    }

    // If start/end provided, compute reserved quantities for overlapping rent/borrow requests
    // NOTE: When an `instrument_inventory` table is present we decrement inventory at
    // request-creation time (so `r.quantity` already reflects reserved units). In that
    // deployment mode we should NOT subtract rent_requests again or we'll double-count
    // reservations and under-report availableQuantity. For deployments without
    // `instrument_inventory` fall back to computing reserved counts from request rows.
    if (start && end && rows && rows.length) {
      const schema = await _ensureSchemaCache();
      const invExistsForThisDB = schema && schema.invExists;
      for (const r of rows) {
        try {
          if (invExistsForThisDB) {
            // Inventory table is authoritative and already adjusted on reservation.
            r.reserved_rent = 0;
            r.reserved_borrow = 0;
            r.availableQuantity = Number(r.quantity) || 0;
            r.computedAvailabilityStatus = (r.availableQuantity > 0) ? 'Available' : 'Rented/Unavailable';
            // DEBUG: log availableQuantity for this instrument (helps trace disappearing dropdown)
            console.log(`[INSTRUMENTS DEBUG] instrument_id=${r.instrument_id} name="${r.name}" availableQuantity=${r.availableQuantity} computedAvailabilityStatus="${r.computedAvailabilityStatus}" reserved_rent=${r.reserved_rent} reserved_borrow=${r.reserved_borrow}`);
            continue;
          }

          const instrumentId = r.instrument_id;
          // Sum rent_requests overlapping the requested period (count pending and approved)
          const [rentRows] = await pool.query(
            `SELECT COALESCE(SUM(quantity),0) AS reserved_rent FROM rent_requests WHERE instrument_id = ? AND status IN ('pending','approved') AND NOT (end_date < ? OR start_date > ?)`,
            [instrumentId, start, end]
          );
          const reservedRent = (rentRows && rentRows[0] && rentRows[0].reserved_rent) ? Number(rentRows[0].reserved_rent) : 0;

          // Sum borrow_requests overlapping the requested period
          const [borrowRows] = await pool.query(
            `SELECT COALESCE(SUM(quantity),0) AS reserved_borrow FROM borrow_requests WHERE instrument_id = ? AND status IN ('pending','approved') AND NOT (end_date < ? OR start_date > ?)`,
            [instrumentId, start, end]
          );
          const reservedBorrow = (borrowRows && borrowRows[0] && borrowRows[0].reserved_borrow) ? Number(borrowRows[0].reserved_borrow) : 0;

          const totalReserved = reservedRent + reservedBorrow;
          const availableQuantity = (Number(r.quantity) || 0) - totalReserved;
          r.reserved_rent = reservedRent;
          r.reserved_borrow = reservedBorrow;
          r.availableQuantity = availableQuantity >= 0 ? availableQuantity : 0;
          r.computedAvailabilityStatus = (availableQuantity > 0) ? 'Available' : 'Rented/Unavailable';
        } catch (e) {
          // best-effort per-row; continue on error
          console.warn('Failed to compute reservations for instrument', r.instrument_id, e && e.message);
          r.reserved_rent = 0;
          r.reserved_borrow = 0;
          r.availableQuantity = Number(r.quantity) || 0;
          r.computedAvailabilityStatus = r.availability_status || 'Unknown';
        }
      }
    } else {
      // No date range provided: expose current quantity and default availability
      for (const r of rows) {
        r.reserved_rent = 0;
        r.reserved_borrow = 0;
        r.availableQuantity = Number(r.quantity) || 0;
        r.computedAvailabilityStatus = r.availability_status || ((Number(r.quantity) || 0) > 0 ? 'Available' : 'Rented/Unavailable');
      }
    }

    // Attach per-location rows from instrument_locations (if table exists and has rows)
    try {
      const ids = rows.map(r => r.instrument_id).filter(Boolean);
      if (ids.length) {
        const [locRows] = await pool.query(`
          SELECT 
            il.instrument_id, 
            il.location_name,
            il.quantity,
            COALESCE(il.status, CASE WHEN il.quantity > 0 THEN 'Available' ELSE 'Unavailable' END) AS status,
            l.location_id
          FROM instrument_locations il
          LEFT JOIN locations l ON il.location_name = l.location_name
          WHERE il.instrument_id IN (?)
        `, [ids]);

        const locMap = {};
        for (const l of locRows) {
          if (!locMap[l.instrument_id]) locMap[l.instrument_id] = [];
          locMap[l.instrument_id].push({
            id: l.location_id,
            location_id: l.location_id,
            name: l.location_name,
            quantity: Number(l.quantity) || 0,
            status: l.status || 'Unavailable'
          });
        }
        for (const r of rows) {
          r.locations = locMap[r.instrument_id] || (r.primary_location_name ? [{
            id: r.primary_location_id,
            location_id: r.primary_location_id,
            name: r.primary_location_name,
            quantity: Number(r.quantity) || 0,
            status: (Number(r.quantity) || 0) > 0 ? 'Available' : 'Unavailable'
          }] : []);
        }
      }
    } catch (e) {
      // if instrument_locations doesn't exist or query fails, gracefully continue
      console.warn('instrument_locations not available or failed to load:', e && e.message);
      for (const r of rows) {
        r.locations = r.primary_location_name ? [{
          id: r.primary_location_id,
          location_id: r.primary_location_id,
          name: r.primary_location_name,
          quantity: Number(r.quantity) || 0,
          status: (Number(r.quantity) || 0) > 0 ? 'Available' : 'Unavailable'
        }] : [];
      }
    }

    console.log(`Successfully fetched ${rows.length} instruments`); // Debug log

    res.json({
      success: true,
      instruments: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching instruments:', error);
    console.error('Error stack:', error.stack); // More detailed error
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instruments',
      error: error.message // Include error message for debugging
    });
    // DEBUG: log computed availability when inventory is computed from request rows
    console.log(`[INSTRUMENTS DEBUG] instrument_id=${r.instrument_id} name="${r.name}" availableQuantity=${r.availableQuantity} computedAvailabilityStatus="${r.computedAvailabilityStatus}" reserved_rent=${r.reserved_rent} reserved_borrow=${r.reserved_borrow}`);
  }
});


// Create a new instrument (admin protected)
router.post('/', authenticateToken, async (req, res) => {
  // Temporary debug: if DEBUG_INSTRUMENTS env var is set to 'true', log incoming payload and user
  try {
    if (process.env.DEBUG_INSTRUMENTS === 'true') {
      // DEBUG: log current availableQuantity for non-date queries
      console.log(`[INSTRUMENTS DEBUG] instrument_id=${r.instrument_id} name="${r.name}" availableQuantity=${r.availableQuantity} computedAvailabilityStatus="${r.computedAvailabilityStatus}" reserved_rent=${r.reserved_rent} reserved_borrow=${r.reserved_borrow}`);
      try {
        console.log('DEBUG POST /api/instruments payload:', { body: req.body, user: req.user && { id: req.user.id, email: req.user.email } });
      } catch (dbgErr) {
        console.warn('Failed to log debug payload for /api/instruments:', dbgErr && dbgErr.message);
      }
    }
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { name, category, subcategory, brand, condition, status, quantity, price_per_day, notes, locations } = req.body || {};
    if (!name || !category) return res.status(400).json({ success: false, message: 'Name and category are required' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO instruments (name, category, subcategory, brand, condition_status, availability_status, price_per_day, notes, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW(), NOW())`,
        [name, category, subcategory || null, brand || null, condition || 'Good', status || 'Available', price_per_day || null, notes || null]
      );
      const instrumentId = result.insertId;

      // insert inventory rows for provided locations and mirror into instrument_locations
      // Wrap in try/catch so missing optional tables (instrument_inventory, instrument_locations)
      // or other schema differences don't cause the whole instrument creation to fail.
      let primarySet = null;
      try {
        if (Array.isArray(locations) && locations.length) {
          for (const l of locations) {
            const locName = (l && l.name) ? String(l.name).trim() : 'Main';
            const qty = Number(l && l.quantity) || 0;

            // find or create location in locations table
            const [locRows] = await conn.query('SELECT location_id, location_type FROM locations WHERE location_name = ? LIMIT 1', [locName]);
            let locId;
            let locType = null;
            if (locRows && locRows.length) {
              locId = locRows[0].location_id;
              locType = locRows[0].location_type;
            } else {
              const [locRes] = await conn.query('INSERT INTO locations (location_name, location_type) VALUES (?, ?)', [locName, 'secondary']);
              locId = locRes.insertId;
            }

            // insert into instrument_inventory (may not exist on some deployments)
            try {
              await conn.query('INSERT INTO instrument_inventory (instrument_id, location_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [instrumentId, locId, qty]);
            } catch (invErr) {
              console.warn('instrument_inventory insert skipped or failed (non-fatal):', invErr && invErr.message);
            }

            // insert into instrument_locations for backend compatibility (may not exist)
            try {
              await conn.query('INSERT INTO instrument_locations (instrument_id, location_id, location_name, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), location_name = VALUES(location_name)', [instrumentId, locId, locName, qty]);
            } catch (locErr) {
              console.warn('instrument_locations insert skipped or failed (non-fatal):', locErr && locErr.message);
            }

            // prefer a primary location if present
            if (!primarySet && (locType === 'primary' || (l && l.isPrimary))) {
              primarySet = locId;
            }
          }
        } else {
          // no locations provided: create a default 'Main' location row and set as primary
          const [locRows] = await conn.query('SELECT location_id FROM locations WHERE location_name = ? LIMIT 1', ['Main']);
          let locId;
          if (locRows && locRows.length) locId = locRows[0].location_id;
          else {
            const [locRes] = await conn.query('INSERT INTO locations (location_name, location_type) VALUES (?, ?)', ['Main', 'primary']);
            locId = locRes.insertId;
          }
          try {
            await conn.query('INSERT INTO instrument_inventory (instrument_id, location_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [instrumentId, locId, Number(quantity) || 0]);
          } catch (invErr) {
            console.warn('instrument_inventory insert skipped or failed (non-fatal):', invErr && invErr.message);
          }
          try {
            await conn.query('INSERT INTO instrument_locations (instrument_id, location_id, location_name, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), location_name = VALUES(location_name)', [instrumentId, locId, 'Main', Number(quantity) || 0]);
          } catch (locErr) {
            console.warn('instrument_locations insert skipped or failed (non-fatal):', locErr && locErr.message);
          }
          primarySet = locId;
        }
      } catch (outerErr) {
        console.warn('Non-fatal warning while inserting instrument location/inventory data:', outerErr && outerErr.message);
      }

      // set primary_location_id if we determined one (only if column exists)
      if (primarySet) {
        try {
          const schema = await _ensureSchemaCache();
          if (schema.primaryLocationExists) {
            await conn.query('UPDATE instruments SET primary_location_id = ? WHERE instrument_id = ?', [primarySet, instrumentId]);
          }
        } catch (e) {
          // ignore schema-check failures here; primary_location_id is optional
        }
      }

      await conn.commit(); conn.release();
      // Return both instrumentId (legacy camelCase) and instrument_id (snake_case)
      // so clients expecting either format will work.
      res.status(201).json({ success: true, instrumentId, instrument_id: instrumentId });
    } catch (txErr) {
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      // If duplicate instrument name error, try to return the existing instrument id instead of failing
      try {
        const isDup = txErr && (txErr.code === 'ER_DUP_ENTRY' || (txErr.message && txErr.message.includes('uq_instruments_name')));
        if (isDup && req.body && req.body.name) {
          try {
            const [rows] = await pool.query('SELECT instrument_id FROM instruments WHERE name = ? LIMIT 1', [String(req.body.name).trim()]);
            if (rows && rows.length) {
              const existingId = rows[0].instrument_id;
              console.warn('Instrument create attempted for existing name, returning conflict with existing id:', existingId);
              // Return 409 Conflict so callers know the name already exists and can handle it explicitly.
              return res.status(409).json({ success: false, message: 'Instrument already exists', instrumentId: existingId, instrument_id: existingId });
            }
          } catch (findErr) {
            console.error('Error looking up existing instrument after duplicate key:', findErr && findErr.stack ? findErr.stack : findErr);
          }
        }
      } catch (checkErr) {
        console.error('Error handling duplicate check:', checkErr && checkErr.stack ? checkErr.stack : checkErr);
      }

      console.error('Transaction error creating instrument:', txErr && txErr.stack ? txErr.stack : txErr);
      res.status(500).json({ success: false, message: 'Failed to create instrument', error: txErr && txErr.message ? txErr.message : String(txErr) });
    }
  } catch (err) {
    console.error('Error creating instrument:', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, message: 'Failed to create instrument', error: err && err.message ? err.message : String(err) });
  }
});


// Update an instrument (admin protected) including per-location quantities and archive flag
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid instrument id' });
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { name, category, subcategory, brand, condition, status, is_archived, notes, price_per_day, locations } = req.body || {};

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // update instruments table
      const updates = [];
      const values = [];
      if (typeof name !== 'undefined') { updates.push('name = ?'); values.push(name); }
      if (typeof category !== 'undefined') { updates.push('category = ?'); values.push(category); }
      if (typeof subcategory !== 'undefined') { updates.push('subcategory = ?'); values.push(subcategory); }
      if (typeof brand !== 'undefined') { updates.push('brand = ?'); values.push(brand); }
      if (typeof condition !== 'undefined') { updates.push('condition_status = ?'); values.push(condition); }
      if (typeof status !== 'undefined') {
        // sanitize any legacy values before persisting
        let safeStatus = status;
        if (safeStatus === 'Reserved') safeStatus = 'Rented';
        const allowedStatus = new Set(['Available', 'Rented', 'Borrowed', 'Maintenance', 'Unavailable']);
        if (!allowedStatus.has(safeStatus)) safeStatus = 'Available';
        updates.push('availability_status = ?'); values.push(safeStatus);
      }
      if (typeof price_per_day !== 'undefined') { updates.push('price_per_day = ?'); values.push(price_per_day); }
      if (typeof notes !== 'undefined') { updates.push('notes = ?'); values.push(notes); }
      if (typeof is_archived !== 'undefined') { updates.push('is_archived = ?'); values.push(is_archived ? 1 : 0); }

      if (updates.length) {
        values.push(id);
        await conn.query(`UPDATE instruments SET ${updates.join(', ')}, updated_at = NOW() WHERE instrument_id = ?`, values);
      }

      // replace locations if provided - synchronize both instrument_locations (string mirror) and instrument_inventory (canonical per-location quantities)
      if (Array.isArray(locations)) {
        // clear existing mirrors and inventories for this instrument (we'll re-insert what's provided)
        await conn.query('DELETE FROM instrument_locations WHERE instrument_id = ?', [id]);
        await conn.query('DELETE FROM instrument_inventory WHERE instrument_id = ?', [id]);

        if (locations.length) {
          const insertLocs = [];
          for (const l of locations) {
            const locName = (l && l.name) ? String(l.name).trim() : 'Main';
            const qty = Number(l && typeof l.quantity !== 'undefined' ? l.quantity : 0) || 0;

            // find or create location in locations table
            const [locRows] = await conn.query('SELECT location_id, location_type FROM locations WHERE location_name = ? LIMIT 1', [locName]);
            let locId;
            let locType = null;
            if (locRows && locRows.length) {
              locId = locRows[0].location_id;
              locType = locRows[0].location_type;
            } else {
              const [locRes] = await conn.query('INSERT INTO locations (location_name, location_type) VALUES (?, ?)', [locName, 'secondary']);
              locId = locRes.insertId;
            }

            // upsert into instrument_inventory (canonical source of truth)
            await conn.query('INSERT INTO instrument_inventory (instrument_id, location_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [id, locId, qty]);

            // prepare instrument_locations mirror row (include location_id when available)
            insertLocs.push([id, locId, locName, qty]);
          }

          // bulk insert into instrument_locations (use location_id when known)
          if (insertLocs.length) {
            await conn.query('INSERT INTO instrument_locations (instrument_id, location_id, location_name, quantity) VALUES ?', [insertLocs]);
          }
        }
      }

      await conn.commit(); conn.release();
      res.json({ success: true, message: 'Instrument updated' });
    } catch (txErr) {
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      console.error('Transaction error updating instrument:', txErr);
      res.status(500).json({ success: false, message: 'Failed to update instrument' });
    }
  } catch (err) {
    console.error('Error updating instrument:', err);
    res.status(500).json({ success: false, message: 'Failed to update instrument' });
  }
});


// Create a replacement instrument and record the replacement relationship
router.post('/:id/replacements', authenticateToken, async (req, res) => {
  try {
    const originalId = Number(req.params.id);
    if (!Number.isInteger(originalId) || originalId <= 0) return res.status(400).json({ success: false, message: 'Invalid original instrument id' });
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { name, category, subcategory, brand, condition, status, quantity, price_per_day, notes, locations, note } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: 'Replacement instrument name is required' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO instruments (name, category, subcategory, brand, condition_status, availability_status, price_per_day, notes, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW(), NOW())`,
        [name, category || 'other', subcategory || null, brand || null, condition || 'Good', status || 'Available', price_per_day || null, notes || null]
      );
      const replacementId = result.insertId;

      // insert inventory & instrument_locations for replacement instrument
      let primarySet = null;
      if (Array.isArray(locations) && locations.length) {
        for (const l of locations) {
          const locName = (l && l.name) ? String(l.name).trim() : 'Main';
          const qty = Number(l && l.quantity) || 0;
          const [locRows] = await conn.query('SELECT location_id, location_type FROM locations WHERE location_name = ? LIMIT 1', [locName]);
          let locId;
          let locType = null;
          if (locRows && locRows.length) {
            locId = locRows[0].location_id;
            locType = locRows[0].location_type;
          } else {
            const [locRes] = await conn.query('INSERT INTO locations (location_name, location_type) VALUES (?, ?)', [locName, 'secondary']);
            locId = locRes.insertId;
          }
          await conn.query('INSERT INTO instrument_inventory (instrument_id, location_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [replacementId, locId, qty]);
          await conn.query('INSERT INTO instrument_locations (instrument_id, location_id, location_name, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), location_name = VALUES(location_name)', [replacementId, locId, locName, qty]);
          if (!primarySet && (locType === 'primary' || (l && l.isPrimary))) primarySet = locId;
        }
      } else {
        const [locRows] = await conn.query('SELECT location_id FROM locations WHERE location_name = ? LIMIT 1', ['Main']);
        let locId;
        if (locRows && locRows.length) locId = locRows[0].location_id;
        else {
          const [locRes] = await conn.query('INSERT INTO locations (location_name, location_type) VALUES (?, ?)', ['Main', 'primary']);
          locId = locRes.insertId;
        }
        await conn.query('INSERT INTO instrument_inventory (instrument_id, location_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [replacementId, locId, Number(quantity) || 0]);
        await conn.query('INSERT INTO instrument_locations (instrument_id, location_id, location_name, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), location_name = VALUES(location_name)', [replacementId, locId, 'Main', Number(quantity) || 0]);
        primarySet = locId;
      }

      if (primarySet) {
        try {
          const schema = await _ensureSchemaCache();
          if (schema.primaryLocationExists) {
            await conn.query('UPDATE instruments SET primary_location_id = ? WHERE instrument_id = ?', [primarySet, replacementId]);
          }
        } catch (e) {
          // ignore schema-check failures here
        }
      }

      // record replacement relationship
      await conn.query('INSERT INTO instrument_replacements (original_instrument_id, replacement_instrument_id, note, created_by) VALUES (?, ?, ?, ?)', [originalId, replacementId, note || null, userId]);

      await conn.commit(); conn.release();
      res.status(201).json({ success: true, replacementId });
    } catch (txErr) {
      try { await conn.rollback(); } catch (e) { }
      conn.release();
      console.error('Transaction error creating replacement:', txErr);
      res.status(500).json({ success: false, message: 'Failed to create replacement' });
    }
  } catch (err) {
    console.error('Error creating replacement instrument:', err);
    res.status(500).json({ success: false, message: 'Failed to create replacement' });
  }
});

// Get available instrument types for signup form
router.get('/types', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT subcategory 
      FROM instruments 
      WHERE is_archived = 0 AND subcategory IS NOT NULL AND subcategory != ''
      ORDER BY subcategory
    `);
    const types = rows.map(r => r.subcategory);
    res.json({ success: true, types });
  } catch (error) {
    console.error('Error fetching instrument types:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch instrument types' });
  }
});

// Get single instrument with location details
router.get('/:id', async (req, res) => {
  try {
    const instrumentId = parseInt(req.params.id);

    if (isNaN(instrumentId)) {
      return res.status(400).json({ success: false, message: 'Invalid instrument ID' });
    }

    const [instruments] = await pool.query(`
      SELECT 
        i.*,
        i.availability_status AS computedAvailabilityStatus
      FROM instruments i
      WHERE i.instrument_id = ?
    `, [instrumentId]);

    if (!instruments || instruments.length === 0) {
      return res.status(404).json({ success: false, message: 'Instrument not found' });
    }

    const instrument = instruments[0];

    // Get locations from instrument_locations table
    const [locRows] = await pool.query(`
      SELECT 
        il.location_name,
        il.quantity,
        COALESCE(il.status, CASE WHEN il.quantity > 0 THEN 'Available' ELSE 'Unavailable' END) AS status,
        l.location_id
      FROM instrument_locations il
      LEFT JOIN locations l ON il.location_name = l.location_name
      WHERE il.instrument_id = ?
    `, [instrumentId]);

    instrument.locations = locRows.map(l => ({
      id: l.location_id,
      location_id: l.location_id,
      name: l.location_name,
      quantity: Number(l.quantity) || 0,
      status: l.status || 'Unavailable'
    }));

    res.json({ success: true, instrument });

  } catch (error) {
    console.error('Error fetching instrument:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch instrument', error: error.message });
  }
});

// Update location-specific inventory (real-time updates)
router.put('/:id/locations/:locationId', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const instrumentId = parseInt(req.params.id);
    const locationId = parseInt(req.params.locationId);
    const { quantity, status } = req.body;

    if (isNaN(instrumentId) || isNaN(locationId)) {
      return res.status(400).json({ success: false, message: 'Invalid instrument or location ID' });
    }

    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a non-negative number' });
    }

    await conn.beginTransaction();

    // Ensure the instrument exists
    const [instruments] = await conn.query(
      'SELECT instrument_id FROM instruments WHERE instrument_id = ? FOR UPDATE',
      [instrumentId]
    );

    if (!instruments || instruments.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Instrument not found' });
    }

    // Get location name from locations table
    const [locations] = await conn.query(
      'SELECT location_id, location_name FROM locations WHERE location_id = ?',
      [locationId]
    );

    if (!locations || locations.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    const locationName = locations[0].location_name;

    // Update or insert into instrument_locations table
    if (quantity !== undefined || status) {
      // Check if record exists
      const [existing] = await conn.query(
        'SELECT id FROM instrument_locations WHERE instrument_id = ? AND location_name = ?',
        [instrumentId, locationName]
      );

      if (existing && existing.length > 0) {
        // Update existing record
        if (quantity !== undefined && status) {
          await conn.query(
            'UPDATE instrument_locations SET quantity = ?, status = ? WHERE instrument_id = ? AND location_name = ?',
            [quantity, status, instrumentId, locationName]
          );
        } else if (quantity !== undefined) {
          await conn.query(
            'UPDATE instrument_locations SET quantity = ? WHERE instrument_id = ? AND location_name = ?',
            [quantity, instrumentId, locationName]
          );
        } else if (status) {
          await conn.query(
            'UPDATE instrument_locations SET status = ? WHERE instrument_id = ? AND location_name = ?',
            [status, instrumentId, locationName]
          );
        }
      } else {
        // Insert new record - default to Available
        await conn.query(
          'INSERT INTO instrument_locations (instrument_id, location_name, quantity, status) VALUES (?, ?, ?, ?)',
          [instrumentId, locationName, quantity || 0, status || 'Available']
        );
      }
    }

    // Recalculate total quantity across all locations
    const [totals] = await conn.query(`
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM instrument_locations
      WHERE instrument_id = ?
    `, [instrumentId]);

    const totalQuantity = totals && totals[0] ? Number(totals[0].total) : 0;

    // Compute overall status based on quantity and location statuses
    let overallStatus = 'Unavailable';
    if (totalQuantity > 0) {
      overallStatus = 'Available';
    } else {
      // Check location statuses when quantity is 0
      const [statusCheck] = await conn.query(`
        SELECT status FROM instrument_locations WHERE instrument_id = ? LIMIT 1
      `, [instrumentId]);

      if (statusCheck && statusCheck[0]) {
        const locStatus = statusCheck[0].status;
        // Use the location status if it's meaningful (not just Unavailable)
        if (locStatus && locStatus !== 'Unavailable') {
          // sanitize legacy location status values
          let safeLocStatus = locStatus === 'Reserved' ? 'Rented' : locStatus;
          const allowedStatus = new Set(['Available', 'Rented', 'Borrowed', 'Maintenance', 'Unavailable']);
          if (!allowedStatus.has(safeLocStatus)) safeLocStatus = 'Available';
          overallStatus = safeLocStatus;
        }
      }
    }

    // Update instrument table with recalculated totals
    await conn.query(`
      UPDATE instruments 
      SET quantity = ?, availability_status = ?
      WHERE instrument_id = ?
    `, [totalQuantity, overallStatus, instrumentId]);

    await conn.commit();

    // Fetch updated instrument data
    const [updatedInst] = await pool.query(
      'SELECT * FROM instruments WHERE instrument_id = ?',
      [instrumentId]
    );

    const instrument = updatedInst && updatedInst[0] ? updatedInst[0] : null;

    if (instrument) {
      // Get locations
      const [locRows] = await pool.query(`
        SELECT 
          il.location_name,
          il.quantity,
          COALESCE(il.status, CASE WHEN il.quantity > 0 THEN 'Available' ELSE 'Unavailable' END) AS status,
          l.location_id
        FROM instrument_locations il
        LEFT JOIN locations l ON il.location_name = l.location_name
        WHERE il.instrument_id = ?
      `, [instrumentId]);

      instrument.locations = locRows.map(l => ({
        id: l.location_id,
        location_id: l.location_id,
        name: l.location_name,
        quantity: Number(l.quantity) || 0,
        status: l.status || 'Unavailable'
      }));

      instrument.computedAvailabilityStatus = instrument.availability_status;
    }

    res.json({
      success: true,
      message: 'Location inventory updated successfully',
      instrument
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error updating location inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location inventory',
      error: error.message
    });
  } finally {
    conn.release();
  }
});

module.exports = router;
module.exports = router;