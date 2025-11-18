const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const billingService = require('../services/billingService');
const { notifyAllAdmins } = require('../services/notificationService');
const { authenticateToken } = require('../middleware/auth');

// POST /api/payments - Simulated payment processing
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('--- PAYMENT ATTEMPT ---');
    console.log('Request body:', req.body);
    const { bookingId, amount, totalAmount, paymentType, paymentMethod, cardholderName, cardNumber, gcashNumber, referenceNumber } = req.body;
    console.log('💳 Payment request received:', { bookingId, amount, totalAmount, paymentType, paymentMethod, user: req.user.id });
    
    // Check booking status
    const [bookingRows] = await pool.query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );
    
    if (!bookingRows.length) {
      console.error('❌ Booking not found:', bookingId);
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const booking = bookingRows[0];
    console.log('📋 Booking found:', { id: booking.booking_id, status: booking.status });
    
    if (booking.status !== 'approved') {
      console.error('❌ Booking not approved:', booking.status);
      return res.status(400).json({ message: `Booking is not approved for payment (current status: ${booking.status})` });
    }
    
    // Find the invoice for this booking
    const [invoiceRows] = await pool.query(
      `SELECT * FROM invoices 
       WHERE description LIKE ? 
       AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [`%Booking for ${booking.service}%${booking.date}%`]
    );
    
    let invoiceId = null;
    if (invoiceRows.length > 0) {
      invoiceId = invoiceRows[0].invoice_id;
      console.log('📄 Invoice found:', invoiceId);

      // Special handling: if customer selected cash payment in the test gateway,
      // notify admins that the customer will pay in cash and do NOT process any payment.
      if (paymentMethod && String(paymentMethod).toLowerCase().includes('cash')) {
        try {
          const requester = req.user && (req.user.email || req.user.id) ? (req.user.email || `User #${req.user.id}`) : 'A customer';
          await notifyAllAdmins(
            'payment_pending_cash',
            'Customer requests cash payment',
            `${requester} selected cash payment for booking ${bookingId}. The customer will pay in cash upon delivery/pickup.`,
            { bookingId, invoiceId, amount, paymentMethod, requestedBy: req.user && req.user.id ? req.user.id : null }
          );
          console.log('ℹ️ Admins notified for cash payment request');
        } catch (nErr) {
          console.warn('Failed to notify admins for cash payment request:', nErr && nErr.message);
        }

        // Return early: do not process or record a payment; booking remains unpaid.
        return res.json({ success: true, message: 'Cash payment requested; admins have been notified. No online payment recorded.' });
      }
      // Delegate payment processing to billingService which centralizes
      // payment insertion and related updates (rent_requests, bookings,
      // instrument_items, transactions, notifications).
      try {
        const processedBy = req.user?.id || 1;
        const paymentNote = paymentType === 'downpayment'
          ? `Down payment (50%) for reservation ID ${bookingId} - ₱${amount.toLocaleString()}. Remaining: ₱${((totalAmount || amount * 2) - amount).toLocaleString()}`
          : `Full payment for reservation ID ${bookingId} - Customer self-payment`;

        await billingService.processPayment(invoiceId, processedBy, amount, paymentMethod || 'card', paymentNote);
        console.log('✅ Payment processed via billingService for invoice', invoiceId);
      } catch (srvErr) {
        console.error('Failed to process payment via billingService:', srvErr && srvErr.message);
        // Fall back to legacy behavior: create payment record and mark invoice paid
        const [paymentResult] = await pool.query(
          'INSERT INTO payments (invoice_id, amount_paid, payment_method, processed_by, notes) VALUES (?, ?, ?, ?, ?)',
          [invoiceId, amount, paymentMethod || 'card', req.user?.id || 1, paymentNote]
        );
        await pool.query('UPDATE invoices SET status = ? WHERE invoice_id = ?', ['paid', invoiceId]);
        console.log('✅ Fallback payment record created:', paymentResult.insertId);
      }
    } else {
      console.log('⚠️ No invoice found for booking, creating direct payment');
    }
    
    // Update booking status to Paid
    await pool.query(
      'UPDATE bookings SET status = ? WHERE booking_id = ?',
      ['paid', bookingId]
    );
    
    console.log('✅ Booking status updated to paid');
    
    // Format date for notification
    let formattedDate = booking.date;
    try {
      const dateStr = typeof booking.date === 'string' ? booking.date.split('T')[0] : booking.date;
      const dateObj = new Date(dateStr + 'T00:00:00');
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }
    
    res.json({ 
      success: true,
      message: 'Payment successful. The reservation has been marked as paid.',
      bookingId: bookingId,
      invoiceId: invoiceId,
      booking: {
        id: booking.booking_id,
        service: booking.service,
        date: formattedDate,
        email: booking.email,
        amount: amount,
        paymentMethod: paymentMethod
      }
    });
  } catch (err) {
    console.error('❌ Payment error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      success: false,
      message: 'Payment failed', 
      error: err.message,
      stack: err.stack
    });
  }
});

module.exports = router;

// GET /api/payments/user/:email - Get payments for a user by their email
router.get('/user/:email', authenticateToken, async (req, res) => {
  try {
    const email = String(req.params.email || '').toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    // Find user id by email
    const [users] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    if (!users || users.length === 0) {
      return res.json({ success: true, payments: [] });
    }
    const userId = users[0].id;

    // Get invoices owned by this user
    const [invoices] = await pool.query('SELECT invoice_id FROM invoices WHERE user_id = ?', [userId]);
    if (!invoices || invoices.length === 0) {
      return res.json({ success: true, payments: [] });
    }

    const invoiceIds = invoices.map(i => i.invoice_id).filter(Boolean);
    if (invoiceIds.length === 0) return res.json({ success: true, payments: [] });

    // Query payments linked to those invoices
    const placeholders = invoiceIds.map(() => '?').join(',');
    const [payments] = await pool.query(
      `SELECT * FROM payments WHERE invoice_id IN (${placeholders}) ORDER BY processed_at DESC`,
      invoiceIds
    );

    res.json({ success: true, payments });
  } catch (err) {
    console.error('Error fetching payments for user:', err && err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch payments for user' });
  }
});
