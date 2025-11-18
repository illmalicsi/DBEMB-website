const { pool } = require('../config/database');

/**
 * Send notification to all admin users
 * @param {string} type - Notification type (e.g., 'new_member', 'booking_request', 'rental_request', 'payment')
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} data - Additional data (JSON)
 */
async function notifyAllAdmins(type, title, message, data = null) {
  try {
    // Get all admin emails
    const [admins] = await pool.execute(
      `SELECT DISTINCT u.email 
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'admin' AND u.is_active = 1 AND u.is_blocked = 0`
    );

    if (admins.length === 0) {
      console.log('⚠️  No active admins found to notify');
      return;
    }

    // Allow improved admin notification formatting for certain types
    const formatted = formatAdminNotification(type, title, message, data);
    const dataJson = formatted.data ? JSON.stringify(formatted.data) : null;

    // Insert notification for each admin (preserve delivered_at as NOW)
    for (const admin of admins) {
      await pool.execute(
        `INSERT INTO notifications (user_email, type, title, message, data, delivered_at, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [admin.email, type, formatted.title, formatted.message, dataJson]
      );
    }

    console.log(`✅ Notified ${admins.length} admin(s): ${type} - ${formatted.title}`);
  } catch (error) {
    console.error('❌ Error notifying admins:', error);
  }
}

// Helper: format amounts in PHP with grouping
function formatCurrencyPhp(value) {
  try {
    return Number(value || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
  } catch (e) {
    return `₱${Number(value || 0).toFixed(2)}`;
  }
}

// Build better admin-facing title/message/data for known notification types
function formatAdminNotification(type, title, message, data) {
  try {
    // Default passthrough
    const out = { title: title || '', message: message || '', data: data || null };

    if (type === 'payment_received') {
      // Expect data: { invoiceId, invoiceNumber, amountPaid, totalPaid, invoiceAmount, userName, bookingLabel }
      const userName = (data && (data.userName || data.name)) || '';
      const amt = data && (data.amountPaid || data.totalPaid || data.invoiceAmount) ? (data.amountPaid || data.totalPaid || data.invoiceAmount) : null;
      const amountStr = amt ? formatCurrencyPhp(amt) : '';
      const invoiceRef = (data && (data.invoiceNumber || data.invoiceId)) ? (data.invoiceNumber || `#${data.invoiceId}`) : '';
      const bookingLabel = data && data.bookingLabel ? ` for ${data.bookingLabel}` : '';

      out.title = 'Payment Received';
      out.message = userName ? `${userName} paid ${amountStr}${bookingLabel || ` for Invoice ${invoiceRef}`}` : message || `Payment received: ${invoiceRef} - ${amountStr}`;
      out.data = Object.assign({}, data, { amount_formatted: amountStr });
      return out;
    }

    if (type === 'booking_request' || type === 'rental_request') {
      // Expect data: booking_request -> { requestId, service, date, userName }
      //           rental_request  -> { requestIds, items: [{ instrumentName, quantity, ... }], startDate, endDate, userName }
      const date = data && (data.date || data.startDate || data.requestedDate) ? (data.date || data.startDate || data.requestedDate) : null;
      const when = date ? ` on ${new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : '';

      // If rental_request and items array present, build a clearer title/message including instrument names
      if (type === 'rental_request' && data && Array.isArray(data.items) && data.items.length > 0) {
        const itemNames = data.items.map(i => (i && (i.instrumentName || i.name || i.instrument_name)) || '').filter(Boolean);
        const itemsLabel = itemNames.length === 0 ? '' : (itemNames.length === 1 ? itemNames[0] : itemNames.join(', '));

        out.title = title || (itemNames.length > 1 ? 'New Rental Request (Multiple Items)' : `New Rental Request - ${itemsLabel}`);
        const userName = data && (data.userName || data.name) ? (data.userName || data.name) : '';
        out.message = userName ? `${userName} requested ${itemsLabel}${when}` : message || out.message;
        out.data = Object.assign({}, out.data, { items: data.items, itemsLabel });
        return out;
      }

      // Support legacy/singular payloads where instrumentName/quantity were passed directly
      if (type === 'rental_request' && data && (data.instrumentName || data.instrument_name)) {
        const instrumentName = data.instrumentName || data.instrument_name || data.name || '';
        const qty = (typeof data.quantity !== 'undefined' && data.quantity !== null) ? Number(data.quantity) : (data.qty || data.quantity || 1);
        const itemsLabel = qty && qty > 1 ? `${qty}x ${instrumentName}` : instrumentName;
        out.title = title || (qty > 1 ? 'New Rental Request (Multiple Items)' : `New Rental Request - ${instrumentName}`);
        const userName = data && (data.userName || data.name) ? (data.userName || data.name) : '';
        out.message = userName ? `${userName} requested ${itemsLabel}${when}` : message || out.message;
        out.data = Object.assign({}, out.data, { instrumentName, quantity: qty, itemsLabel });
        return out;
      }

      // Fallback for booking_request or rental_request without items
      const service = data && data.service ? data.service : '';
      out.title = title || 'New Booking Request';
      out.message = data && (data.userName || data.name) ? `${(data.userName || data.name)} requested ${service}${when}` : message || out.message;
      return out;
    }

    if (type === 'new_customer') {
      const name = data && (data.name || data.userName) ? (data.name || data.userName) : '';
      out.title = title || 'New Customer Registered';
      out.message = name ? `${name} has registered as a new customer` : out.message;
      // attach a suggested icon for admin UIs
      out.data = Object.assign({}, out.data, { icon: 'person-plus' });
      return out;
    }

    if (type === 'receipt_ready') {
      const inv = data && (data.invoiceNumber || data.invoiceId) ? (data.invoiceNumber || `#${data.invoiceId}`) : '';
      out.title = title || 'Receipt Ready';
      out.message = inv ? `Receipt for ${inv} is now available` : out.message;
      out.data = Object.assign({}, out.data, { icon: 'receipt' });
      return out;
    }

    // Default icons for known types
    const defaultIconMap = {
      payment_received: 'check-circle',
      success: 'check-circle',
      warning: 'exclamation-triangle',
      booking_request: 'exclamation-triangle',
      rental_request: 'exclamation-triangle',
      new_customer: 'person-plus',
      receipt_ready: 'receipt'
    };

    const chosen = defaultIconMap[type] || null;
    if (chosen) out.data = Object.assign({}, out.data, { icon: chosen });

    return out;
  } catch (e) {
    return { title: title || '', message: message || '', data: data || null };
  }
}

/**
 * Send notification to a specific user
 * @param {string} userEmail - User email
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} data - Additional data (JSON)
 */
async function notifyUser(userEmail, type, title, message, data = null) {
  try {
    const dataJson = data ? JSON.stringify(data) : null;

    await pool.execute(
      `INSERT INTO notifications (user_email, type, title, message, data, delivered_at, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [userEmail, type, title, message, dataJson]
    );

    console.log(`✅ Notified user ${userEmail}: ${type} - ${title}`);
  } catch (error) {
    console.error('❌ Error notifying user:', error);
  }
}

module.exports = {
  notifyAllAdmins,
  notifyUser
};
