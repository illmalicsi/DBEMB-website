// Notification Service with optional backend persistence.
// Set REACT_APP_USE_REMOTE_NOTIF=true in env to enable storing/fetching notifications
// from the backend API (expects /notifications endpoints). Otherwise falls back to localStorage.

import mysqlService from './mysqlService';
import { API_BASE_URL } from './apiConfig';

const NOTIFICATION_STORAGE_KEY = 'userNotifications';
const ADMIN_RECIPIENTS_KEY = 'adminRecipients';
const USE_REMOTE = (process.env.REACT_APP_USE_REMOTE_NOTIF || 'false').toLowerCase() === 'true';

class NotificationService {
  // Configure admin recipients (optional utility)
  static setAdminRecipients(emails = []) {
    try {
      const list = Array.isArray(emails) ? emails : [];
      localStorage.setItem(ADMIN_RECIPIENTS_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('Error setting admin recipients:', e);
      return false;
    }
  }

  static getAdminRecipients() {
    try {
      const stored = localStorage.getItem(ADMIN_RECIPIENTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {
      console.error('Error reading admin recipients:', e);
    }
    // Fallback default admin inboxes (include common dev/admin addresses)
    return ['admin@blueeagles.com', 'admin@local'];
  }

  static createAdminNotification(notification) {
    const admins = this.getAdminRecipients();
    admins.forEach(email => this.createNotification(email, notification));
    return admins.length;
  }

  // Create a notification. Returns the created notification object or null.
  // If USE_REMOTE=true, this will attempt to persist to the backend and fall back to localStorage on failure.
  static async createNotification(userEmail, notification) {
    const payload = {
      userEmail: (userEmail || '').toLowerCase().trim(),
      type: notification.type || 'info',
      title: notification.title,
      message: notification.message,
      // Ensure an `icon` hint is present in data so remote/store consumers can render it
      data: Object.assign({}, notification.data || {}, { icon: notification.icon || notification.type || null }),
      read: false,
      createdAt: new Date().toISOString()
    };

    // Try remote persistence first when enabled
    if (USE_REMOTE) {
      try {
        const created = await mysqlService.createNotification(payload);
        // notify listeners
        window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { userEmail: payload.userEmail, notification: created } }));
        return created;
      } catch (err) {
        console.warn('Remote notification persist failed, falling back to localStorage:', err);
        // fall through to localStorage fallback
      }
    }

    // Localstorage fallback (ensure we await any remote fetch attempts)
    try {
      // getAllNotifications may return a Promise when remote is enabled
      const maybe = this.getAllNotifications();
      const notifications = Array.isArray(maybe) ? maybe : (await maybe);
      const newNotification = { id: Date.now(), ...payload };
      const arr = Array.isArray(notifications) ? notifications : [];
      arr.push(newNotification);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { userEmail: payload.userEmail, notification: newNotification } }));
      return newNotification;
    } catch (error) {
      console.error('Error creating notification (local fallback):', error);
      return null;
    }
  }

  // Get all notifications (if remote enabled returns Promise resolving to array)
  static async getAllNotifications() {
    if (USE_REMOTE) {
      try {
        const resp = await mysqlService.fetchNotifications();
  // normalize remote response shape { success:true, notifications: [...] }
  let list = [];
  if (resp && Array.isArray(resp.notifications)) list = resp.notifications;
  else if (Array.isArray(resp)) list = resp;
  else list = [];
  // normalize shape: ensure `read` boolean exists based on `read_at` timestamp
  return list.map(n => ({ ...n, read: !!n.read_at }));
      } catch (err) {
        console.warn('Failed to fetch remote notifications, falling back to localStorage:', err);
      }
    }

    try {
      const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  // Get notifications for a specific user
  static async getUserNotifications(userEmail) {
    const normalized = (userEmail || '').toLowerCase().trim();
    if (USE_REMOTE) {
      try {
        const resp = await mysqlService.fetchNotifications(normalized);
        console.debug('NotificationService: remote fetchNotifications response for', normalized, resp);
  // normalize to array
  let list = [];
  if (resp && Array.isArray(resp.notifications)) list = resp.notifications;
  else if (Array.isArray(resp)) list = resp;
  else list = [];
  return list.map(n => ({ ...n, read: !!n.read_at }));
      } catch (err) {
        console.warn('Failed to fetch user notifications remotely, falling back to localStorage:', err);
      }
    }

    try {
      const allNotifications = this.getAllNotifications();
      // getAllNotifications may be a Promise if remote; ensure we have array
      const arr = Array.isArray(allNotifications) ? allNotifications : (await allNotifications);
      return arr.filter(n => (n.userEmail || '').toLowerCase().trim() === normalized);
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  // Notify admins and customer about a new booking request
  static notifyNewBooking(booking) {
    // Safe date formatting
    let formattedDate = 'the scheduled date';
    if (booking.date) {
      try {
        const dateStr = typeof booking.date === 'string' ? booking.date.split('T')[0] : booking.date;
        const dateObj = new Date(dateStr + 'T00:00:00');
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
        }
      } catch (e) {
        console.error('Error formatting date (new booking):', e);
      }
    }

    const amount = booking.estimatedValue || booking.estimated_value || 5000;

    // Customer notification: confirmation that request was received
    this.createNotification((booking.email || '').toLowerCase(), {
      type: 'info',
      title: 'Booking Request Received',
      message: `We received your booking request for "${booking.service}" on ${formattedDate}. Our team will review it and notify you once approved.`,
      data: {
        bookingId: booking.booking_id || booking.id,
        service: booking.service,
        date: booking.date,
        startTime: booking.start_time || booking.startTime,
        endTime: booking.end_time || booking.endTime,
        location: booking.location,
        estimated_value: amount
      }
    });

    // Admin notification: new booking awaiting review
    this.createAdminNotification({
      type: 'warning',
      title: 'New Booking Request',
      message: `${booking.customer_name || booking.customerName} requested "${booking.service}" on ${formattedDate}. Please review and approve/reject.`,
      data: {
        bookingId: booking.booking_id || booking.id,
        customer: booking.customer_name || booking.customerName,
        email: booking.email,
        phone: booking.phone,
        service: booking.service,
        date: booking.date,
        startTime: booking.start_time || booking.startTime,
        endTime: booking.end_time || booking.endTime,
        location: booking.location,
        estimated_value: amount,
        status: booking.status || 'pending'
      }
    });
  }

  // Get unread notifications for a user
  static getUnreadNotifications(userEmail) {
    try {
      const userNotifications = this.getUserNotifications(userEmail);
      return userNotifications.filter(n => !n.read);
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    try {
      // If remote persistence is enabled, attempt to mark remote notification as read
      if (USE_REMOTE) {
        try {
          await mysqlService.markAsRead(notificationId);
        } catch (err) {
          console.warn('Remote markAsRead failed, falling back to local update:', err);
        }
      }

      // Always update local cache/fallback so UI reacts immediately
      const maybe = this.getAllNotifications();
      const notifications = Array.isArray(maybe) ? maybe : (await maybe);
      const updated = notifications.map(n =>
        n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
      );
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(updated));

      window.dispatchEvent(new Event('notificationsUpdated'));
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark notification as unread
  static async markAsUnread(notificationId) {
    try {
      const maybe = this.getAllNotifications();
      const notifications = Array.isArray(maybe) ? maybe : (await maybe);
      const updated = notifications.map(n => 
        n.id === notificationId ? { ...n, read: false } : n
      );
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(updated));
      
      window.dispatchEvent(new Event('notificationsUpdated'));
      return true;
    } catch (error) {
      console.error('Error marking notification as unread:', error);
      return false;
    }
  }

  // Mark all user notifications as read
  static async markAllAsRead(userEmail) {
    try {
      const normalized = (userEmail || '').toLowerCase().trim();
      // If remote is enabled try to mark all notifications read server-side using batch endpoint
      if (USE_REMOTE) {
        try {
          await mysqlService.markAllAsRead(normalized);
        } catch (err) {
          console.warn('markAllAsRead: remote batch endpoint failed, falling back to per-item updates', err);
          // Fallback to previous per-item approach
          try {
            const remote = await mysqlService.fetchNotifications(normalized);
            if (Array.isArray(remote) && remote.length) {
              await Promise.all(remote
                .filter(n => !n.read && (n.userEmail || '').toLowerCase().trim() === normalized)
                .map(n => mysqlService.markAsRead(n.id).catch(e => { console.warn('markAllAsRead fallback: failed mark id', n.id, e); }))
              );
            }
          } catch (e) {
            console.warn('markAllAsRead: fallback per-item update failed', e);
          }
        }
      }

      // Always update local cache/fallback so UI reacts immediately
      const maybe = this.getAllNotifications();
      const notifications = Array.isArray(maybe) ? maybe : (await maybe);
      const updated = notifications.map(n =>
        (n.userEmail || '').toLowerCase().trim() === normalized ? { ...n, read: true, read_at: new Date().toISOString() } : n
      );
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(updated));

      window.dispatchEvent(new Event('notificationsUpdated'));
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId) {
    try {
      const maybe = this.getAllNotifications();
      const notifications = Array.isArray(maybe) ? maybe : (await maybe);
      const filtered = notifications.filter(n => n.id !== notificationId);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(filtered));
      
      window.dispatchEvent(new Event('notificationsUpdated'));
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  // Clear all notifications for a user
  static async clearUserNotifications(userEmail) {
    try {
      const maybe = this.getAllNotifications();
      const notifications = Array.isArray(maybe) ? maybe : (await maybe);
      const filtered = notifications.filter(n => n.userEmail !== userEmail.toLowerCase().trim());
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(filtered));
      
      window.dispatchEvent(new Event('notificationsUpdated'));
      return true;
    } catch (error) {
      console.error('Error clearing user notifications:', error);
      return false;
    }
  }

  // Notify about booking confirmation
  static async notifyBookingConfirmed(booking) {
    console.log('📬 NotificationService: Creating booking confirmation for:', booking);
    console.log('💰 Invoice ID:', booking.invoice_id);

    // Try to get invoice info from backend when invoice_id is present
    let totalAmount = 0;
    let invoiceNumber = booking.invoice_number || booking.invoiceNumber || null;

    // If the server already returned an authoritative invoice amount on the booking
    // object, prefer that immediately (avoids network fetch and prevents fallback
    // to legacy 5000 default when backend is unavailable).
    if (typeof booking.invoice_amount === 'number' && booking.invoice_amount > 0) {
      totalAmount = Number(booking.invoice_amount);
      invoiceNumber = invoiceNumber || booking.invoice_number || booking.invoiceNumber || null;
    }

    if (booking.invoice_id && !totalAmount) {
      try {
        const resp = await fetch(`${API_BASE_URL}/billing/invoices/${booking.invoice_id}`, { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          const inv = data && (data.invoice || data) ? (data.invoice || data) : null;
          if (inv) {
            invoiceNumber = invoiceNumber || inv.invoice_number || null;
            const invAmount = Number(inv.amount || inv.invoice_amount || inv.total || 0);
            if (invAmount && invAmount > 0) {
              totalAmount = invAmount;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch invoice for notification:', e);
      }
    }

    // Prefer booking.estimated_value, then booking.estimatedValue, then fallback
    if (!totalAmount) {
      if (typeof booking.estimated_value === 'number' && booking.estimated_value > 0) {
        totalAmount = booking.estimated_value;
      } else if (typeof booking.estimatedValue === 'number' && booking.estimatedValue > 0) {
        totalAmount = booking.estimatedValue;
      } else {
      // Try to compute from package/instrument if possible
      if (booking.service && booking.notes) {
        // Band/Parade
        if (booking.service === 'Band Gigs' || booking.service === 'Parade Events') {
          const m = String(booking.notes).match(/Package:\s*([^\n]+)/i);
          const label = m ? m[1].trim() : null;
          const bandPrices = {
            '20 Players (with Food & Transport)': 15000,
            '20 Players (without Food & Transport)': 20000,
            '30 Players (with Food & Transport)': 25000,
            '30 Players (without Food & Transport)': 30000,
            'Full Band': 35000
          };
          if (label && bandPrices[label]) totalAmount = bandPrices[label];
        }
        // Instrument Rentals
        if (booking.service === 'Instrument Rentals') {
          const mi = String(booking.notes).match(/Instrument:\s*([^\n]+)/i);
          const instrumentLabel = mi ? mi[1].trim() : null;
          const mdays = String(booking.notes).match(/\((\d+)\s*days?\)/i);
          let days = mdays ? parseInt(mdays[1], 10) : 0;
          const instrumentPrices = {
            'Trumpet': 500,
            'Trombone': 500,
            'French Horn': 500,
            'Tuba': 500,
            'Flute': 500,
            'Clarinet': 500,
            'Saxophone': 500,
            'Yamaha Snare Drum': 1000,
            'Pearl Snare Drum': 1000,
            'Bass Drum': 500,
            'Cymbals': 500
          };
          if (instrumentLabel && instrumentPrices[instrumentLabel] && days > 0) {
            totalAmount = instrumentPrices[instrumentLabel] * days;
          }
        }
        // Music Arrangement
        if (booking.service === 'Music Arrangement') {
          const m = String(booking.notes).match(/Number\s+of\s+Pieces:\s*(\d+)/i);
          const pieces = m ? parseInt(m[1], 10) : 1;
          totalAmount = 3000 * pieces;
        }
        // Music Workshops
        if (booking.service === 'Music Workshops') {
          totalAmount = 5000;
        }
      }
        // Fallback if still not found
        if (!totalAmount) totalAmount = 5000;
      }
    }

    const downPayment = Math.round(totalAmount * 0.5); // 50% down payment
    
    // Format date safely - handle both date objects and strings
    let formattedDate = 'the scheduled date';
    if (booking.date) {
      try {
        // If it's already a formatted string (YYYY-MM-DD), parse it
        const dateStr = typeof booking.date === 'string' ? booking.date.split('T')[0] : booking.date;
        const dateObj = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
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
    }
    
    return this.createNotification(booking.email, {
      type: 'success',
      title: 'Booking Confirmed!',
      // Do not include invoice number in the user-facing message — only show amount
      message: `Your booking for "${booking.service}" on ${formattedDate} has been confirmed.\n\nAmount due: ₱${Number(totalAmount).toLocaleString()}`,
      data: {
        bookingId: booking.booking_id || booking.id,
        amount: totalAmount,
        invoiceId: booking.invoice_id || null,
        invoiceNumber: invoiceNumber || null,
        service: booking.service,
        date: booking.date,
        startTime: booking.startTime || booking.start_time,
        endTime: booking.endTime || booking.end_time,
        location: booking.location,
        paymentDetails: {
          totalAmount: totalAmount,
          downPayment: downPayment,
          fullPayment: totalAmount,
          accountName: 'Davao Blue Eagles Music Studio',
          accountNumber: '1234-5678-9012',
          bankName: 'Bank of the Philippine Islands (BPI)',
          gcashNumber: '0917-123-4567',
          gcashName: 'Davao Blue Eagles',
          paymentOptions: [
            { type: 'Down Payment (50%)', amount: downPayment },
            { type: 'Full Payment (100%)', amount: totalAmount }
          ],
          instructions: 'Please send proof of payment via email or upload to the customer portal.'
        }
      }
    });
  }

  // Notify about booking rejection
  static notifyBookingRejected(booking) {
    // Format date safely
    let formattedDate = 'the scheduled date';
    if (booking.date) {
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
    }
    
    return this.createNotification(booking.email, {
      type: 'error',
      title: 'Booking Not Approved',
      message: `Unfortunately, your booking for \"${booking.service}\" on ${formattedDate} could not be approved, due to a schedule conflict. Thank you for choosing our service!`,
      data: {
        bookingId: booking.id,
        service: booking.service,
        date: booking.date
      }
    });
  }

  // Notify about booking cancellation
  static notifyBookingCancelled(booking) {
    // Format date safely
    let formattedDate = 'the scheduled date';
    if (booking.date) {
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
    }
    
    return this.createNotification(booking.email, {
      type: 'warning',
      title: 'Booking Cancelled',
      message: `Your booking for "${booking.service}" on ${formattedDate} has been cancelled.`,
      data: {
        bookingId: booking.id,
        service: booking.service,
        date: booking.date
      }
    });
  }
}

export default NotificationService;
