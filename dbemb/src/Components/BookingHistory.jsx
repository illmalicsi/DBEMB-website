import React, { useEffect, useState } from 'react';
import NotificationService from '../services/notificationService';
import AuthService from '../services/authService';
import {
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaCreditCard,
  FaCheckCircle, FaTimesCircle, FaExclamationCircle, FaUser, FaBan, FaMusic, FaHome, FaArrowLeft, FaChevronDown
} from '../icons/fa';

const statusConfig = {
  pending: { color: '#92400e', bg: '#fef3c7', icon: FaExclamationCircle, label: 'Pending', borderColor: '#f59e0b' },
  approved: { color: '#065f46', bg: '#d1fae5', icon: FaCheckCircle, label: 'Approved', borderColor: '#10b981' },
  rescheduled: { color: '#7c2d12', bg: '#fff7ed', icon: FaClock, label: 'Rescheduled', borderColor: '#fb923c' },
  paid: { color: '#1e3a8a', bg: '#dbeafe', icon: FaCreditCard, label: 'Paid', borderColor: '#3b82f6' },
  rejected: { color: '#7f1d1d', bg: '#fee2e2', icon: FaTimesCircle, label: 'Rejected', borderColor: '#ef4444' },
  cancelled: { color: '#7f1d1d', bg: '#fee2e2', icon: FaBan, label: 'Cancelled', borderColor: '#ef4444' }
};

export default function BookingHistory() {
  const [bookings, setBookings] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [rescheduleModal, setRescheduleModal] = useState({ open: false, type: 'booking', item: null, newDate: '', newStart: '', newEnd: '' });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '' });
  const [cancelModal, setCancelModal] = useState({ open: false, type: null, item: null });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Inline style helpers
  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f1f5f9 100%)',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
  };

  // Updated navigation styles to properly center the title
  const navStyle = {
    background: 'linear-gradient(180deg, #0b3b78 0%, #0b4f8a 100%)',
    color: '#fff',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    padding: windowWidth <= 768 ? '16px 20px' : '20px 40px',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'grid',
    gridTemplateColumns: windowWidth <= 768 ? '1fr auto' : '1fr auto 1fr', // Balanced 3 columns
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 12px rgba(7, 24, 48, 0.12)'
  };

  const logoSectionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: windowWidth <= 768 ? '8px' : '12px',
    justifySelf: 'start' // Align to start of first column
  };

  const logoTextStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  };

  const logoMainStyle = {
    fontFamily: 'Georgia, Times, "Times New Roman", serif',
    fontSize: windowWidth <= 768 ? '20px' : '28px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '0.02em'
  };

  const logoSubStyle = {
    fontSize: windowWidth <= 768 ? '10px' : '12px',
    color: '#ffffff',
    margin: 0,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  };

  const pageTitleStyle = {
    fontSize: windowWidth <= 768 ? '20px' : '26px',
    fontWeight: 600,
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.025em',
    textAlign: 'center',
    justifySelf: 'center', // Center in the middle column
    gridColumn: windowWidth <= 768 ? '1' : '2' // Place in column 2 on desktop, column 1 on mobile
  };

  // Profile dropdown styles - matching home.jsx exactly
  const profileButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: '#e6eef8',
    padding: '0',
    borderRadius: '999px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: windowWidth <= 768 ? '13px' : '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    justifySelf: 'end' // Align to end of last column
  };

  const profileDropdownStyle = {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    background: '#ffffff',
    border: '1px solid rgba(15, 76, 129, 0.08)',
    borderRadius: '12px',
    padding: '14px',
    minWidth: '240px',
    boxShadow: '0 12px 28px rgba(2,6,23,0.18)',
    zIndex: 1200
  };

  const userInfoStyle = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(11,59,120,0.04)'
  };

  const avatarStyle = {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    overflow: 'hidden',
    background: '#e6f2ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0b3b78',
    fontWeight: 800,
    fontSize: '18px'
  };

  const dropdownItemStyle = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: '#0b3b78',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    textAlign: 'left',
    textDecoration: 'none'
  };

  const pageInner = {
    maxWidth: '1120px',
    margin: '0 auto',
    padding: windowWidth <= 768 ? '20px 16px' : '24px'
  };

  const headerStyle = {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)'
  };

  const cardBase = {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(2,6,23,0.06)',
    border: '1px solid #e6eef8',
    overflow: 'hidden'
  };

  const emptyCard = {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 1px 4px rgba(2,6,23,0.06)',
    border: '1px solid #e2e8f0',
    padding: '64px',
    textAlign: 'center'
  };

  const spinner = {
    borderRadius: '9999px',
    height: '48px',
    width: '48px',
    borderBottom: '4px solid #2563eb'
  };

  const fetchData = async () => {
    let u = null;
    try {
      const profile = await AuthService.getProfile();
      u = profile && profile.user ? profile.user : null;
      setUser(u);
    } catch (e) {
      setUser(null);
      u = null;
    }

    try {
      const res = await fetch('http://localhost:5000/api/bookings', { credentials: 'include' });
      const data = await res.json();
      if (data.success && Array.isArray(data.bookings)) {
        let formatted = data.bookings.map(b => ({
          id: b.booking_id,
          customerName: b.customer_name,
          email: b.email,
          phone: b.phone,
          service: b.service,
          date: b.date ? b.date.split('T')[0] : b.date,
          startTime: b.start_time,
          endTime: b.end_time,
          location: b.location,
          estimatedValue: parseFloat(b.estimated_value || 5000),
          status: b.status,
          notes: b.notes,
          createdAt: b.created_at,
          requestedDate: b.requested_date ? (b.requested_date.split ? b.requested_date.split('T')[0] : b.requested_date) : null,
          requestedStart: b.requested_start || null,
          requestedEnd: b.requested_end || null,
          rescheduleStatus: b.reschedule_status || null
        }));

        const applied = formatted.map(b => {
          let displayDate = b.date;
          let displayStart = b.startTime;
          let displayEnd = b.endTime;
          let displayStatus = b.status;

          // Only treat as a "rescheduled" display if there's a submitted
          // reschedule request AND the booking is not already cancelled or rejected.
          // This prevents overwriting authoritative statuses like 'cancelled'.
          if (b.rescheduleStatus === 'submitted' && b.status !== 'cancelled' && b.status !== 'rejected') {
            displayDate = b.requestedDate || b.date;
            displayStart = b.requestedStart || b.startTime;
            displayEnd = b.requestedEnd || b.endTime;
            displayStatus = 'rescheduled';
          }

          return { 
            ...b, 
            displayDate, 
            displayStart, 
            displayEnd, 
            status: displayStatus
          };
        });

        console.debug('✅ Bookings after applying reschedule display:', applied);
        setBookings(applied);
      } else {
        setBookings([]);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setBookings([]);
      setLoading(false);
    }

    try {
      const paymentsRes = await fetch('http://localhost:5000/api/payments/user/' + (u?.email || ''), { credentials: 'include' });
      const paymentsBody = await paymentsRes.json();
      if (paymentsBody.success && Array.isArray(paymentsBody.payments)) {
        setPayments(paymentsBody.payments);
      } else {
        setPayments([]);
      }
    } catch (e) {
      setPayments([]);
    }

    (async () => {
      try {
        const instrumentPriceMapById = new Map();
        const instrumentPriceMapByName = new Map();
        try {
          const instrRes = await fetch('http://localhost:5000/api/instruments', { credentials: 'include' });
          if (instrRes && instrRes.ok) {
            const instrBody = await instrRes.json();
            const instrList = Array.isArray(instrBody) ? instrBody : (instrBody && Array.isArray(instrBody.instruments) ? instrBody.instruments : []);
            instrList.forEach(i => {
              if (i.instrument_id) instrumentPriceMapById.set(Number(i.instrument_id), Number(i.price_per_day) || null);
              const nameKey = (i.name || i.instrument_name || i.name || '') + '';
              if (nameKey) instrumentPriceMapByName.set(String(nameKey).toLowerCase().trim(), Number(i.price_per_day) || null);
            });
          }
        } catch (e) {
          console.warn('Failed to fetch instruments for price map (optional):', e && e.message);
        }

        const res = await fetch('http://localhost:5000/api/instruments/my-requests', { credentials: 'include' });
        let body = null;
        try {
          body = await res.json();
        } catch (parseErr) {
          console.warn('Failed to parse /api/instruments/my-requests response as JSON', parseErr);
        }

        console.debug('/api/instruments/my-requests response status:', res.status, 'body:', body);

        if (res.status === 401) {
          setError('Authentication required. Please sign in to view your rental & borrow history.');
        }

        if (body && body.success && Array.isArray(body.allRequests)) {
          const rows = body.allRequests.map(r => {
            const id = r.request_id || r.id;
            const instrumentName = r.instrument_name || r.instrumentName || r.instrument || r.instrumentLabel;
            const quantity = Number(r.quantity) || 1;
            const startDate = r.start_date || r.startDate || r.startDateTime || r.start;
            const endDate = r.end_date || r.endDate || r.endDateTime || r.end;
            const status = r.status || 'pending';
            const type = r.type || 'rent';
            const rawRentalFee = r.rental_fee || r.rentalFee || r.price_per_day || r.instrumentPricePerDay || null;
            const rawTotal = r.total_amount || r.totalAmount || r.amount || null;

            let days = 1;
            try {
              if (startDate && endDate) {
                const s = new Date(startDate);
                const e = new Date(endDate);
                if (!isNaN(s) && !isNaN(e)) {
                  const diff = Math.floor((e - s) / (1000 * 60 * 60 * 24));
                  days = diff >= 0 ? (diff + 1) : 1;
                }
              }
            } catch (dErr) { days = 1; }

            let rentalFee = rawRentalFee != null && rawRentalFee !== '' ? Number(rawRentalFee) : null;
            let totalAmount = rawTotal != null && rawTotal !== '' ? Number(rawTotal) : null;
            const instrumentId = r.instrument_id || r.instrumentId || null;

            return { id, instrumentId, instrumentName, quantity, startDate, endDate, status, type, rentalFee, totalAmount, notes: r.notes || r.purpose || '' };
          });

          for (let i = 0; i < rows.length; i++) {
            const rr = rows[i];
            let days = 1;
            try {
              if (rr.startDate && rr.endDate) {
                const s = new Date(rr.startDate);
                const e = new Date(rr.endDate);
                if (!isNaN(s) && !isNaN(e)) {
                  const diff = Math.floor((e - s) / (1000 * 60 * 60 * 24));
                  days = diff >= 0 ? (diff + 1) : 1;
                }
              }
            } catch (dErr) { days = 1; }

            if ((rr.rentalFee == null || rr.rentalFee === 0) && rr.instrumentId && instrumentPriceMapById.has(Number(rr.instrumentId))) {
              const p = instrumentPriceMapById.get(Number(rr.instrumentId));
              if (p != null) rr.rentalFee = Number(p);
            }
            if ((rr.rentalFee == null || rr.rentalFee === 0) && rr.instrumentName) {
              const key = String(rr.instrumentName).toLowerCase().trim();
              if (instrumentPriceMapByName.has(key)) {
                const p = instrumentPriceMapByName.get(key);
                if (p != null) rr.rentalFee = Number(p);
              }
            }

            if ((rr.rentalFee == null || rr.rentalFee === 0) && rr.totalAmount != null && days > 0 && rr.quantity > 0) {
              const derived = rr.totalAmount / (days * rr.quantity);
              rr.rentalFee = Number.isFinite(derived) ? Number(derived.toFixed(2)) : null;
            }

            if ((rr.totalAmount == null || rr.totalAmount === 0) && rr.rentalFee != null && days > 0 && rr.quantity > 0) {
              const computed = rr.rentalFee * days * rr.quantity;
              rr.totalAmount = Number.isFinite(computed) ? Number(computed.toFixed(2)) : null;
            }
          }

          setRentals(rows);
        } else {
          setRentals([]);
        }
      } catch (err) {
        console.warn('Error fetching /api/instruments/my-requests', err);
        setRentals([]);
      }
    })();
  };

  const handleCancelBooking = async (bookingId, email) => {
    try {
      const payloadEmail = (email && String(email).trim()) || (user && user.email) || '';
      if (!payloadEmail) {
        setConfirmModal({ open: true, title: 'Cancellation Failed', message: 'No email available to verify booking ownership.' });
        return;
      }

      const body = { email: String(payloadEmail).toLowerCase().trim() };
      console.debug('Cancelling booking', bookingId, 'payload:', body);

      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // Try to parse JSON, but fall back to plain text if parsing fails
      let data = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        const txt = await response.text().catch(() => null);
        data = { success: false, message: txt || `HTTP ${response.status}` };
      }

      console.debug('Cancel response', response.status, data);

      if (response.ok && data && data.success) {
        // Optimistically mark cancelled in UI immediately so actions are disabled
        setBookings(prev => prev.map(b => (Number(b.id) === Number(bookingId) ? { ...b, status: 'cancelled' } : b)));
        setConfirmModal({ open: true, title: 'Booking Cancelled', message: data.message || 'Booking cancelled successfully.' });
        await fetchData();
      } else {
        // Prefer server-provided message
        setConfirmModal({ open: true, title: 'Cancellation Failed', message: (data && data.message) ? data.message : `Failed to cancel booking (status ${response.status})` });
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setConfirmModal({ open: true, title: 'Cancellation Error', message: 'An error occurred while cancelling the booking. Please try again.' });
    }
  };

  useEffect(() => {
    fetchData();
    const handler = () => fetchData();
    window.addEventListener('transactionsUpdated', handler);
    return () => window.removeEventListener('transactionsUpdated', handler);
  }, [user?.email]);

  const openCancelModal = (type, item) => setCancelModal({ open: true, type, item });
  const closeCancelModal = () => setCancelModal({ open: false, type: null, item: null });

  // Prevent actions on already-cancelled items
  const safeOpenCancelModal = (type, item) => {
    if (!item) return;
    if (String(item.status).toLowerCase() === 'cancelled') {
      setConfirmModal({ open: true, title: 'Already Cancelled', message: 'This booking is already cancelled and cannot be changed.' });
      return;
    }
    openCancelModal(type, item);
  };

  const safeOpenRescheduleModal = (type, item) => {
    if (!item) return;
    if (String(item.status).toLowerCase() === 'cancelled') {
      setConfirmModal({ open: true, title: 'Cannot Reschedule', message: 'This booking has been cancelled and cannot be rescheduled.' });
      return;
    }
    openRescheduleModal(type, item);
  };

  const confirmCancel = async () => {
    const { type, item } = cancelModal;
    if (!item) return closeCancelModal();
    try {
      if (type === 'booking') {
        await handleCancelBooking(item.id, item.email);
      } else if (type === 'rental') {
        await handleCancelRental(item);
      }
      closeCancelModal();
    } catch (err) {
      console.error('Error during confirmCancel:', err);
      closeCancelModal();
    }
  };

  const openRescheduleModal = (type, item) => {
    if (type === 'booking') {
      setRescheduleModal({ open: true, type, item, newDate: item.displayDate || item.date || '', newStart: item.displayStart || item.startTime || '09:00', newEnd: item.displayEnd || item.endTime || '17:00' });
    } else {
      setRescheduleModal({ open: true, type, item, newDate: item.startDate ? item.startDate.split('T')[0] : '', newStart: '', newEnd: item.endDate ? item.endDate.split('T')[0] : '' });
    }
  };

  const closeRescheduleModal = () => setRescheduleModal({ open: false, type: 'booking', item: null, newDate: '', newStart: '', newEnd: '' });

  const submitReschedule = async () => {
    const { type, item, newDate, newStart, newEnd } = rescheduleModal;
    if (!item) return;
    
    try {
      if (type === 'booking') {
        try {
          const resp = await fetch(`http://localhost:5000/api/bookings/${item.id}/reschedule-request`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newDate, newStart, newEnd, email: item.email })
          });
          
          if (resp.ok) {
            const body = await resp.json();
            if (body && body.success) {
              setConfirmModal({ 
                open: true, 
                title: 'Reschedule Request Submitted', 
                message: 'We received your reschedule request. Our team will contact you shortly.' 
              });
              closeRescheduleModal();
              await fetchData();
              return;
            }
          }
        } catch (err) {
          console.warn('Reschedule endpoint failed:', err);
        }

        await NotificationService.createAdminNotification({
          type: 'info',
          title: 'Reschedule Request',
          message: `Customer ${item.customerName || item.email} requests to reschedule booking ${item.service ? '"' + item.service + '"' : item.id} to ${newDate} ${newStart || ''}-${newEnd || ''}`,
          data: { bookingId: item.id, service: item.service, requestedDate: newDate, requestedStart: newStart, requestedEnd: newEnd }
        });

        setConfirmModal({ 
          open: true, 
          title: 'Reschedule Request Submitted', 
          message: 'Your request has been sent to our team.' 
        });
        closeRescheduleModal();
        await fetchData();
        return;
      }

      try {
        const resp = await fetch(`http://localhost:5000/api/instruments/requests/${item.id}/reschedule-request`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newStart, newEnd })
        });
        
        if (resp.ok) {
          const body = await resp.json();
          if (body && body.success) {
            setConfirmModal({ 
              open: true, 
              title: 'Reschedule Request Submitted', 
              message: 'We received your reschedule request. Our team will contact you shortly.' 
            });
            closeRescheduleModal();
            await fetchData();
            return;
          }
        }
      } catch (err) {
        console.warn('Reschedule rental endpoint failed:', err);
      }

      await NotificationService.createAdminNotification({
        type: 'info',
        title: 'Rental Reschedule Request',
        message: `User requests reschedule for a rental from ${newDate || newStart} to ${newEnd}`,
        data: { requestId: item.id, newStart, newEnd }
      });

      setConfirmModal({ 
        open: true, 
        title: 'Reschedule Request Submitted', 
        message: 'Your rental shows as rescheduled. Our team has been notified.' 
      });
      closeRescheduleModal();
      await fetchData();
      
    } catch (err) {
      console.error('Error submitting reschedule:', err);
      alert('Failed to submit reschedule request.');
    }
  };

  const handleCancelRental = async (rental) => {
    try {
      // Use AuthService helper to ensure credentials and consistent error handling
      try {
        const apiBase = (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL.trim()) || 'http://localhost:5000/api';
        const url = `${apiBase}/instruments/requests/${rental.id}/cancel`;
        const resp = await AuthService.makeAuthenticatedRequest(url, { method: 'PATCH' });
        // AuthService throws on non-OK responses, so if we get here it's OK
        const body = await resp.json();
        if (body && body.success) {
          setConfirmModal({ open: true, title: 'Rental Cancelled', message: body.message || 'Rental cancelled successfully.' });
          await fetchData();
          return;
        }
        // Fallback: show server-provided message if present
        setConfirmModal({ open: true, title: 'Cancellation Failed', message: (body && body.message) ? body.message : 'Failed to cancel rental on server.' });
        await fetchData();
        return;
      } catch (err) {
        // AuthService.makeAuthenticatedRequest wraps network errors and surfaces server messages
        console.warn('Cancel rental failed:', err && err.message ? err.message : err);
        setConfirmModal({ open: true, title: 'Cancellation Failed', message: err && err.message ? err.message : 'Failed to cancel rental. Please try again later.' });
        await fetchData();
        return;
      }
    } catch (err) {
      console.error('Error cancelling rental:', err);
      setConfirmModal({ open: true, title: 'Error', message: 'An error occurred while cancelling the rental.' });
    }
  };

  const userBookings = bookings.filter(b => b.email === user?.email);

  function getPaymentForBooking(bookingId) {
    return payments.find(p => p.booking_id === bookingId);
  }

  const closeConfirmModal = () => setConfirmModal({ open: false, title: '', message: '' });

  const headerInner = {
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '18px'
  };

  const subtitleStyle = { color: '#475569', marginTop: '6px' };
  const userMeta = { marginTop: '8px', fontSize: '14px', color: '#64748b' };
  const listStyle = { display: 'flex', flexDirection: 'column', gap: '20px' };
  const cardStyleBase = { 
    ...cardBase, 
    borderLeftWidth: '6px',
    position: 'relative',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'default'
  };
  const cardInner = { padding: '24px' };
  const smallLabel = { fontSize: '12px', color: '#64748b', fontWeight: 600 };
  const serviceTitle = { fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: '6px 0' };
  const dateMeta = { fontSize: '12px', color: '#94a3b8' };
  const gridRow = { display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '12px' };
  const gridRowMd = { gridTemplateColumns: 'repeat(3, 1fr)' };
  const iconBox = { width: '40px', height: '40px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const payButton = {
    padding: '10px 18px',
    background: '#2563eb',
    color: '#fff',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600
  };
  const paymentBox = { background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'center' };

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown when clicking outside - exactly like home.jsx
  useEffect(() => {
    const handleClickOutside = (e) => {
      const path = e.composedPath ? e.composedPath() : (e.path || []);
      const isUser = path.some(p => p && (p.id === 'user-menu' || (p.dataset && p.dataset.userToggle)));
      if (!isUser) setShowProfileDropdown(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleProfileClick = (e) => {
    e.stopPropagation();
    setShowProfileDropdown(!showProfileDropdown);
  };

  const handleBackToHome = () => {
    window.location.href = '/';
  };

  const handleSignOut = async () => {
    try {
      await AuthService.logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/';
    }
  };

  return (
    <div style={containerStyle}>
      {/* Navigation Header */}
      <nav style={navStyle}>
        {/* Left: Logo and Band Name */}
        <div style={logoSectionStyle}>
          <img 
            src="/logo.png" 
            alt="Davao Blue Eagles Marching Band" 
            style={{ 
              height: windowWidth <= 768 ? '60px' : '70px',
              width: 'auto',
              objectFit: 'contain'
            }} 
          />
          <div style={logoTextStyle}>
            <h1 style={logoMainStyle}>DAVAO</h1>
            <p style={logoSubStyle}>BLUE EAGLES</p>
          </div>
        </div>

        {/* Center: Page Title - Properly centered */}
        <h2 style={pageTitleStyle}>Booking History</h2>

        {/* Right: Profile Dropdown */}
        <div style={{ position: 'relative', justifySelf: 'end' }}>
          <button
            style={profileButtonStyle}
            onClick={handleProfileClick}
            data-user-toggle="true"
            aria-controls="user-menu"
            aria-expanded={showProfileDropdown}
          >
            <div style={{ width: '34px', height: '34px', borderRadius: '999px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: user?.avatar ? 'transparent' : 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <FaUser style={{ color: 'white' }} />
              )}
            </div>
            {!windowWidth || windowWidth > 768 ? (
              <>
                <span style={{ marginLeft: '6px', color: '#e6eef8', fontWeight: '500' }}>
                  {user?.firstName || (user?.email ? user.email.split('@')[0] : 'User')}
                </span>
                <FaChevronDown style={{ width: '12px', height: '12px', marginLeft: '4px', color: '#cbd5e1' }} />
              </>
            ) : null}
          </button>

          {showProfileDropdown && (
            <div id="user-menu" role="menu" style={profileDropdownStyle}>
              <div style={userInfoStyle}>
                <div style={avatarStyle}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (user?.firstName || user?.email || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#06264a' }}>
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email || '').split('@')[0]}
                  </div>
                  <div style={{ fontSize: '12px', color: '#1e4f8a', marginTop: '3px' }}>{user?.email}</div>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                <a 
                  href="#profile" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    // Add profile functionality here if needed
                    setShowProfileDropdown(false); 
                  }} 
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => { e.target.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                >
                  <FaUser style={{ color: '#0b62d6', minWidth: '18px' }} />
                  <span>View Profile</span>
                </a>

                <a 
                  href="#home" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleBackToHome(); 
                    setShowProfileDropdown(false); 
                  }} 
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => { e.target.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                >
                  <FaHome style={{ color: '#0b62d6', minWidth: '18px' }} />
                  <span>Back to Home</span>
                </a>

                <a 
                  href="#bookings" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    window.location.reload(); 
                    setShowProfileDropdown(false); 
                  }} 
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => { e.target.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px' }}>
                    <path d="M3 12h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 6h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 18h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Refresh Bookings</span>
                </a>

                <a 
                  href="#instruments" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    const url = `${window.location.origin}${window.location.pathname}#/instrument-booking`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                    setShowProfileDropdown(false); 
                  }} 
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => { e.target.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                >
                  <FaMusic style={{ color: '#0b62d6', minWidth: '18px' }} />
                  <span>{user?.role === 'user' ? 'Rent Instrument' : 'Borrow Instrument'}</span>
                </a>

                {user?.role === 'admin' && (
                  <a 
                    href="#dashboard" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      // Add dashboard navigation here if needed
                      setShowProfileDropdown(false); 
                    }} 
                    style={dropdownItemStyle}
                    onMouseEnter={(e) => { e.target.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px' }}>
                      <path d="M3 12h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3 6h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3 18h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Admin Dashboard</span>
                  </a>
                )}

                <div style={{ height: '1px', background: 'rgba(11,59,120,0.06)', margin: '6px 0' }} />

                <button 
                  onClick={() => { handleSignOut(); setShowProfileDropdown(false); }} 
                  style={{ ...dropdownItemStyle, color: 'white', background: '#0b62d6', fontWeight: 800 }}
                  onMouseEnter={(e) => { e.target.style.background = '#0284c7'; }}
                  onMouseLeave={(e) => { e.target.style.background = '#0b62d6'; }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {rescheduleModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={closeRescheduleModal}>
          <div style={{ background: '#fff', borderRadius: 12, width: 'min(680px, 96%)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Request Reschedule</h3>
              <button onClick={closeRescheduleModal} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {rescheduleModal.type === 'booking' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <label style={{ fontWeight: 700 }}>New Event Date</label>
                    <input type="date" value={rescheduleModal.newDate} onChange={e => setRescheduleModal(prev => ({ ...prev, newDate: e.target.value }))} style={{ padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontWeight: 700 }}>Start Time</label>
                      <input type="time" value={rescheduleModal.newStart} onChange={e => setRescheduleModal(prev => ({ ...prev, newStart: e.target.value }))} style={{ padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontWeight: 700 }}>End Time</label>
                      <input type="time" value={rescheduleModal.newEnd} onChange={e => setRescheduleModal(prev => ({ ...prev, newEnd: e.target.value }))} style={{ padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb', width: '100%' }} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <label style={{ fontWeight: 700 }}>New Start Date</label>
                    <input type="date" value={rescheduleModal.newDate || rescheduleModal.newStart} onChange={e => setRescheduleModal(prev => ({ ...prev, newDate: e.target.value, newStart: e.target.value }))} style={{ padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <label style={{ fontWeight: 700 }}>New End Date</label>
                    <input type="date" value={rescheduleModal.newEnd} onChange={e => setRescheduleModal(prev => ({ ...prev, newEnd: e.target.value }))} style={{ padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button onClick={closeRescheduleModal} style={{ padding: '10px 14px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitReschedule} style={{ padding: '10px 14px', background: '#0369a1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Submit Request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }} onClick={closeConfirmModal}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 480, maxWidth: '96%', boxShadow: '0 8px 30px rgba(2,6,23,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>{confirmModal.title}</h3>
            <p style={{ marginBottom: 20, color: '#475569', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={closeConfirmModal} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }} onClick={closeCancelModal}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 480, maxWidth: '96%', boxShadow: '0 8px 30px rgba(2,6,23,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Cancel Confirmation</h3>
            <p style={{ marginTop: 8 }}>Are you sure you want to cancel this {cancelModal.type === 'booking' ? 'booking' : 'rental'}?</p>
            {cancelModal.item && cancelModal.type === 'booking' && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700 }}>{cancelModal.item.service}</div>
                <div style={{ color: '#475569', marginTop: '6px' }}>{(cancelModal.item.displayDate || cancelModal.item.date)} • {(cancelModal.item.displayStart || cancelModal.item.startTime)} - {(cancelModal.item.displayEnd || cancelModal.item.endTime)}</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={closeCancelModal} style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Close</button>
              <button onClick={confirmCancel} style={{ padding: '8px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={pageInner}>
        {error && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: '#fff3f2', border: '1px solid #fca5a5', color: '#7f1d1d' }}>
            {error}
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={spinner}></div>
          </div>
        ) : userBookings.length === 0 ? (
          <div style={emptyCard}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: '9999px', background: '#f1f5f9', marginBottom: 24 }}>
              <FaCalendarAlt style={{ width: 40, height: 40, color: '#94a3b8' }} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>No Bookings Yet</h3>
            <p style={{ color: '#475569' }}>You haven't made any bookings yet. Start by creating your first booking!</p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px', padding: '16px 0' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Your Bookings ({userBookings.length})
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b' }}>
                All your booking requests are displayed as individual cards below
              </p>
            </div>
            <div style={listStyle}>
            {userBookings.map((booking) => {
              const payment = getPaymentForBooking(booking.id);
              const status = statusConfig[booking.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const cardStyle = { 
                ...cardStyleBase, 
                borderLeftColor: status.borderColor,
                boxShadow: '0 2px 8px rgba(2,6,23,0.08)'
              };

              return (
                <div 
                  key={booking.id} 
                  style={cardStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(2,6,23,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(2,6,23,0.08)';
                  }}
                >
                  <div style={cardInner}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ ...smallLabel, background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            Booking
                          </span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 9999, fontSize: 13, fontWeight: 600, boxShadow: '0 1px 3px rgba(2,6,23,0.08)', background: status.bg, color: status.color }}>
                            <StatusIcon style={{ width: 14, height: 14 }} />
                            {status.label}
                          </div>
                        </div>
                        <h3 style={{ ...serviceTitle, fontSize: '20px', marginBottom: '4px' }}>{booking.service}</h3>
                        <div style={{ ...dateMeta, fontSize: '13px' }}>Booked on {new Date(booking.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Estimated Value</div>
                        <div style={{ fontSize: 30, fontWeight: 700, color: '#2563eb' }}>₱{booking.estimatedValue?.toLocaleString()}</div>
                      </div>
                    </div>

                    <div style={{ ...gridRow, ...(window.innerWidth > 768 ? gridRowMd : {}), marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#475569' }}>
                        <div style={{ ...iconBox, background: '#eff6ff' }}>
                          <FaCalendarAlt style={{ width: 18, height: 18, color: '#2563eb' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Date</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{booking.displayDate || booking.date}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#475569' }}>
                        <div style={{ ...iconBox, background: '#fef3c7' }}>
                          <FaClock style={{ width: 18, height: 18, color: '#d97706' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Time</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{(booking.displayStart || booking.startTime) + ' - ' + (booking.displayEnd || booking.endTime)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#475569' }}>
                        <div style={{ ...iconBox, background: '#dcfce7' }}>
                          <FaMapMarkerAlt style={{ width: 18, height: 18, color: '#16a34a' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Location</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{booking.location}</div>
                        </div>
                      </div>
                    </div>

                    {(booking.status === 'pending' || booking.status === 'approved' || booking.status === 'rescheduled') && (
                      <div style={{ paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
                        {booking.status === 'approved' && (
                          <button onClick={() => window.location.href = `/pay/${booking.id}`} style={payButton}>
                            <FaCreditCard style={{ width: 16, height: 16, marginRight: 8 }} />
                            Pay Now
                          </button>
                        )}
                        <button onClick={() => openRescheduleModal('booking', booking)} style={{ padding: '10px 18px', background: '#f59e0b', color: '#111827', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          Request Reschedule
                        </button>
                        <button 
                          onClick={() => openCancelModal('booking', booking)} 
                          style={{
                            padding: '10px 18px',
                            background: '#dc2626',
                            color: 'white',
                            borderRadius: 10,
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          <FaBan style={{ width: 16, height: 16, marginRight: 8 }} />
                          Cancel Booking
                        </button>
                      </div>
                    )}

                    {booking.status === 'paid' && payment && (
                      <div style={{ paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                        <div style={paymentBox}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaCheckCircle style={{ width: 18, height: 18, color: '#15803d' }} />
                            <span style={{ fontWeight: 700, color: '#065f46' }}>Payment Confirmed</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 14, flex: 1 }}>
                            <div>
                              <div style={{ color: '#166534', fontWeight: 700 }}>Method:</div>
                              <div style={{ color: '#065f46', marginTop: 4 }}>{payment.payment_method}</div>
                            </div>
                            <div>
                              <div style={{ color: '#166534', fontWeight: 700 }}>Amount:</div>
                              <div style={{ color: '#065f46', marginTop: 4 }}>₱{payment.amount_paid?.toLocaleString()}</div>
                            </div>
                            {payment.notes && (
                              <div>
                                <div style={{ color: '#166534', fontWeight: 700 }}>Reference:</div>
                                <div style={{ color: '#065f46', marginTop: 4 }}>{payment.notes}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
        
        {rentals && rentals.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ marginBottom: '20px', padding: '16px 0' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Your Rental & Borrow History ({rentals.length})
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b' }}>
                All instrument rental and borrow requests are shown here
              </p>
            </div>

            <div style={listStyle}>
              {rentals.map((r) => (
                <div key={r.id} style={{ ...cardStyleBase, borderLeftColor: r.type === 'rent' ? '#3730a3' : '#10b981' }}>
                  <div style={cardInner}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ ...smallLabel, background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            {r.type === 'rent' ? 'Rental' : 'Borrow'}
                          </span>
                        </div>
                        <h3 style={{ ...serviceTitle, fontSize: 18, marginTop: 8 }}>{r.instrumentName}</h3>
                        <div style={{ fontSize: 13, color: '#475569' }}>{r.quantity} unit(s)</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Status</div>
                        <div style={{ fontWeight: 700, marginTop: 6 }}>{(r.status || 'pending').toUpperCase()}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Start Date</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{r.startDate ? new Date(r.startDate).toLocaleString() : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>End Date</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{r.endDate ? new Date(r.endDate).toLocaleString() : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Fee / day</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>{r.rentalFee ? `₱${Number(r.rentalFee).toLocaleString()}` : 'N/A'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                      <div style={{ color: '#64748b' }}>{r.notes}</div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#3730a3' }}>{r.totalAmount ? `₱${Number(r.totalAmount).toLocaleString()}` : '—'}</div>
                        {(r.status && r.status !== 'cancelled' && r.status !== 'rejected') && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => openCancelModal('rental', r)} style={{ padding: '8px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}