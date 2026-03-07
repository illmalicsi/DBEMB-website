import React, { useEffect, useState } from 'react';
import AuthService from '../services/authService';
import NotificationService from '../services/notificationService';
import {
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUser,
  FaCheckCircle, FaPhone, FaEnvelope
} from '../icons/fa';
import ConflictModal from './ConflictModal';
import { API_BASE_URL } from '../services/apiConfig';
import { formatCurrency } from '../utils/formatters';

// Simple helper to PUT booking status with credentials included
// Returns an object { ok, status, data }
const updateBookingStatus = async (bookingId, status) => {
  const url = `${API_BASE_URL}/bookings/${bookingId}/status`;
  const resp = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  let data = null;
  try {
    data = await resp.json();
  } catch (err) {
    data = null;
  }
  return { ok: resp.ok, status: resp.status, data };
};

const UpcomingSchedule = () => {
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [bookingToApprove, setBookingToApprove] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [bookingToReject, setBookingToReject] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [centerModalMessage, setCenterModalMessage] = useState('');

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f1f5f9 100%)',
    paddingBottom: '48px'
  };

  const pageInner = {
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '24px'
  };

  const headerStyle = {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    marginBottom: '24px'
  };

  const headerInner = {
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '18px'
  };

  const cardBase = {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(2,6,23,0.08)',
    border: '1px solid #e6eef8',
    overflow: 'hidden',
    marginBottom: '20px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  };

  const cardInner = {
    padding: '24px'
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
    border: '4px solid #f3f4f6',
    borderTop: '4px solid #2563eb',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    animation: 'spin 1s linear infinite'
  };

  const fetchUpcomingBookings = async (excludeIds = []) => {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.bookings)) {
        // Filter for pending bookings and sort by date. Prefer any requested_* values
        // when a reschedule request exists so admins see the requested date/time.
        // Include bookings where status is 'pending' OR a reschedule request has been submitted.
        const pending = data.bookings
          .map(b => {
            const displayDate = b.requested_date || b.requestedDate || b.date;
            const displayStart = b.requested_start || b.requestedStart || b.start_time || b.startTime || null;
            const displayEnd = b.requested_end || b.requestedEnd || b.end_time || b.endTime || null;
            const rescheduleStatus = b.reschedule_status || b.rescheduleStatus || null;
            const rescheduleRequested = !!(b.requested_date || b.requestedDate) && (rescheduleStatus === 'submitted' || rescheduleStatus === null);
            return {
              ...b,
              id: b.booking_id,
              displayDate,
              displayStart,
              displayEnd,
              rescheduleRequested,
              rescheduleStatus,
              dateObj: new Date(displayDate)
            };
          })
          // Only include: new pending bookings, or reschedule requests that are actually pending review.
          // Exclude bookings already approved (even if a reschedule row exists) so approved bookings don't reappear.
          .filter(b => (
            b.status === 'pending' ||
            (b.rescheduleRequested && b.rescheduleStatus === 'submitted' && b.status !== 'approved')
          ) && !excludeIds.some(id => id && (String(id) === String(b.booking_id) || String(id) === String(b.id))))
          .sort((a, b) => {
            // Sort by date first, then by start time
            const dateCompare = a.dateObj - b.dateObj;
            if (dateCompare !== 0) return dateCompare;
            if (a.start_time && b.start_time) {
              return a.start_time.localeCompare(b.start_time);
            }
            return 0;
          });

        setUpcomingBookings(pending);
      } else {
        setUpcomingBookings([]);
      }
    } catch (error) {
      console.error('Error fetching upcoming bookings:', error);
      setUpcomingBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcomingBookings();

    // Listen for booking updates
    const handler = () => fetchUpcomingBookings();
    window.addEventListener('bookingsUpdated', handler);

    // Listen for navigation requests (from notifications)
    const navigateHandler = async (ev) => {
      try {
        const detail = (ev && ev.detail) ? ev.detail : {};
        if (!detail || detail.type !== 'booking') return;
        const targetId = detail.id || detail.bookingId || detail.booking_id;
        if (!targetId) return;

        // Fetch fresh bookings from server and try to locate the target
        try {
          const response = await fetch(`${API_BASE_URL}/bookings`, { credentials: 'include' });
          const data = await response.json();
          const list = Array.isArray(data.bookings) ? data.bookings : [];
          const pending = list.map(b => ({ ...b, id: b.booking_id }));
          const found = pending.find(b => String(b.id) === String(targetId) || String(b.booking_id) === String(targetId));
          if (found) {
              // Refresh the main pending list using the same fetch logic, then open the selected booking.
              // This ensures we apply the same filtering (so approved bookings with reschedule rows won't appear).
              await fetchUpcomingBookings();
              setSelectedBooking({ ...found, id: found.booking_id });
              setTimeout(() => {
                const el = document.getElementById(`booking-${found.booking_id}`);
                if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 120);
            }
        } catch (err) {
          console.warn('navigateHandler: failed to fetch bookings', err);
        }
      } catch (err) {
        console.error('navigateHandler (bookings) error', err);
      }
    };
    window.addEventListener('navigateTo', navigateHandler);

    return () => {
      window.removeEventListener('bookingsUpdated', handler);
      window.removeEventListener('navigateTo', navigateHandler);
    };
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingDate = new Date(dateStr);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (bookingDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const groupByDate = (bookings) => {
    const grouped = {};
    bookings.forEach(booking => {
      // Prefer displayDate (which may be the requested date for reschedules), fallback to original date
      const raw = booking.displayDate || booking.date || '';
      const dateKey = String(raw).split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(booking);
    });
    return grouped;
  };

  const groupedBookings = groupByDate(upcomingBookings);

  // Open approve modal for a single booking
  const approveBooking = (booking) => {
    if (!AuthService.isAuthenticated()) return alert('You must be logged in to approve bookings');
    setBookingToApprove(booking);
    setShowApproveModal(true);
  };

  // Confirm approval (modal action)
  const confirmApproveBooking = async () => {
    const booking = bookingToApprove;
    if (!booking) return;
    try {
      setProcessingId(booking.id);
      setShowApproveModal(false);
      const result = await updateBookingStatus(booking.id, 'approved');
      if (result.status === 409) {
        // Conflict: another booking was already approved that overlaps
        const conflicts = (result.data && result.data.conflicts) || [];
        setConflictDetails(conflicts);
        setShowConflictModal(true);
      } else if (result.ok && result.data && result.data.success) {
        NotificationService.notifyBookingConfirmed(result.data.booking || booking);
        // Immediately remove from local state
        const bookingId = String(booking.id || booking.booking_id);
        setUpcomingBookings(prev => prev.filter(b => {
          const bid = String(b.id || b.booking_id);
          return bid !== bookingId;
        }));
        window.dispatchEvent(new CustomEvent('bookingsUpdated', { detail: { reload: true } }));
        // Refresh list in background to sync with server, exclude removed id to avoid re-adding while server lags
        fetchUpcomingBookings([bookingId]);
        // show small success modal (auto-dismiss)
        setSuccessMessage(`Booking for ${booking.customer_name} approved.`);
        setShowSuccessModal(true);
        // Close any open booking detail modal
        setSelectedBooking(null);
      } else {
        throw new Error((result.data && result.data.message) || 'Failed to approve booking');
      }
    } catch (err) {
      console.error('Error approving booking:', err);
      alert(err.message || 'Error approving booking');
    } finally {
      setProcessingId(null);
      setBookingToApprove(null);
    }
  };

  // Auto-dismiss the success modal after 3 seconds
  useEffect(() => {
    if (!showSuccessModal) return;
    const t = setTimeout(() => {
      setShowSuccessModal(false);
      setSuccessMessage('');
    }, 3000);
    return () => clearTimeout(t);
  }, [showSuccessModal]);

  // Reject a single booking
  const rejectBooking = async (booking) => {
    if (!AuthService.isAuthenticated()) return alert('You must be logged in to reject bookings');
    // open modal instead of window.confirm
    setBookingToReject(booking);
    setShowRejectModal(true);
  };

  // Confirm rejection (modal action)
  const confirmRejectBooking = async () => {
    const booking = bookingToReject;
    if (!booking) return;
    try {
      setProcessingId(booking.id);
      setShowRejectModal(false);
      const result = await updateBookingStatus(booking.id, 'rejected');
      if (result.ok && result.data && result.data.success) {
        NotificationService.notifyBookingRejected(result.data.booking || booking);
        // Immediately remove from local state
        const bookingId = String(booking.id || booking.booking_id);
        setUpcomingBookings(prev => prev.filter(b => {
          const bid = String(b.id || b.booking_id);
          return bid !== bookingId;
        }));
        window.dispatchEvent(new CustomEvent('bookingsUpdated', { detail: { reload: true } }));
        // Refresh list in background to sync with server, exclude removed id to avoid re-adding while server lags
        fetchUpcomingBookings([bookingId]);
        // Show centered auto-dismissing modal with booking type
        setCenterModalMessage(`Booking "${booking.service}" rejected`);
        setShowCenterModal(true);
        // Close any open booking detail modal
        setSelectedBooking(null);
      } else {
        throw new Error((result.data && result.data.message) || 'Failed to reject booking');
      }
    } catch (err) {
      console.error('Error rejecting booking:', err);
      alert(err.message || 'Error rejecting booking');
    } finally {
      setProcessingId(null);
      setBookingToReject(null);
    }
  };

  // Auto-dismiss the centered modal (for rejection) after 3 seconds
  useEffect(() => {
    if (!showCenterModal) return;
    const t = setTimeout(() => {
      setShowCenterModal(false);
      setCenterModalMessage('');
    }, 3000);
    return () => clearTimeout(t);
  }, [showCenterModal]);

  return (
    <div style={containerStyle}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <div style={headerStyle}>
        <div style={headerInner}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FaCalendarAlt style={{ width: 28, height: 28, color: '#fff' }} />
          </div>
          <div>
            <p style={{ color: '#475569', marginTop: '6px', marginBottom: 0 }}>
              View all bookings awaiting approval
            </p>
          </div>
        </div>
      </div>

      <div style={pageInner}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={spinner}></div>
          </div>
        ) : upcomingBookings.length === 0 ? (
          <div style={emptyCard}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#f1f5f9',
              marginBottom: 24
            }}>
              <FaCalendarAlt style={{ width: 40, height: 40, color: '#94a3b8' }} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
              No Pending Bookings
            </h3>
            <p style={{ color: '#475569' }}>
              There are no bookings awaiting approval at this time.
            </p>
          </div>
        ) : (
          <div>
                <div style={{ marginBottom: '20px', padding: '16px 20px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FaCheckCircle style={{ width: 20, height: 20, color: '#2563eb' }} />
                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e40af' }}>
                      {upcomingBookings.length} Pending {upcomingBookings.length === 1 ? 'Booking' : 'Bookings'} Scheduled
                    </span>
                  </div>
                </div>

                {/* Approve confirmation modal */}
                {showApproveModal && bookingToApprove && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{ width: 520, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(2,6,23,0.3)' }}>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Approve Booking</h3>
                      <p style={{ marginTop: 8, color: '#475569' }}>
                        Are you sure you want to approve the booking for <strong>{bookingToApprove.customer_name}</strong>?
                      </p>
                      <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowApproveModal(false); setBookingToApprove(null); }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={confirmApproveBooking} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>{processingId ? 'Processing...' : 'Approve'}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reject confirmation modal */}
                {showRejectModal && bookingToReject && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{ width: 520, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(2,6,23,0.3)' }}>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Reject Booking</h3>
                      <p style={{ marginTop: 8, color: '#475569' }}>
                        Are you sure you want to reject the booking for <strong>{bookingToReject.customer_name}</strong>?
                      </p>
                      <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowRejectModal(false); setBookingToReject(null); }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={confirmRejectBooking} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}>{processingId ? 'Processing...' : 'Reject'}</button>
                      </div>
                    </div>
                  </div>
                )}

                <ConflictModal
                  open={showConflictModal}
                  conflicts={conflictDetails}
                  onClose={() => { setShowConflictModal(false); setConflictDetails([]); }}
                  onView={(bookingId) => {
                    // try navigate to booking detail or scroll into view in this list
                    const id = bookingId;
                    // Attempt to find element in DOM by id used elsewhere
                    const el = document.getElementById(`booking-${id}`);
                    if (el && el.scrollIntoView) {
                      setShowConflictModal(false);
                      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
                    } else {
                      // fallback: open booking detail page if route exists
                      window.open(`/bookings/${id}`, '_blank');
                    }
                  }}
                />

                {/* Success modal / toast (auto-dismiss after 3s) */}
                {showSuccessModal && (
                  <div style={{ position: 'fixed', right: 20, bottom: 24, zIndex: 2200 }}>
                    <div style={{ minWidth: 280, maxWidth: 420, background: '#0f172a', color: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 24px rgba(2,6,23,0.24)' }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{successMessage}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1' }}>Approved successfully</div>
                    </div>
                  </div>
                )}

                {/* Centered rejection success modal (auto-dismiss) */}
                {showCenterModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2300 }}>
                    <div style={{ minWidth: 320, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(2,6,23,0.3)', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{centerModalMessage}</div>
                    </div>
                  </div>
                )}

            {Object.keys(groupedBookings).map(dateKey => (
              <div key={dateKey} style={{ marginBottom: '32px' }}>
                <div style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  borderLeft: '4px solid #2563eb'
                }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {formatDate(dateKey)}
                  </h2>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {groupedBookings[dateKey].length} {groupedBookings[dateKey].length === 1 ? 'booking' : 'bookings'}
                  </p>
                </div>

                {groupedBookings[dateKey].map((booking) => (
                  <div
                    id={`booking-${booking.id}`}
                    key={booking.id}
                    style={cardBase}
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
                            <span style={{
                              fontSize: '12px',
                              color: '#64748b',
                              fontWeight: 600,
                              background: '#f8fafc',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}>
                              Booking
                            </span>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              borderRadius: 9999,
                              fontSize: 13,
                              fontWeight: 600,
                              background: '#fef3c7',
                              color: '#92400e'
                            }}>
                              <FaClock style={{ width: 14, height: 14 }} />
                              Pending
                            </div>
                          </div>
                          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px 0' }}>
                            {booking.service}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: '14px' }}>
                            <FaUser style={{ width: 14, height: 14 }} />
                            <span style={{ fontWeight: 600 }}>{booking.customer_name}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                            Estimated Value
                          </div>
                          <div style={{ fontSize: 30, fontWeight: 700, color: '#2563eb' }}>
                            {formatCurrency(booking.estimated_value || 5000)}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: window.innerWidth > 768 ? 'repeat(3, 1fr)' : '1fr',
                        gap: 12,
                        marginBottom: 16
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '8px',
                            background: '#fef3c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FaClock style={{ width: 18, height: 18, color: '#d97706' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                              Time
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                              {booking.start_time} - {booking.end_time}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '8px',
                            background: '#dcfce7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FaMapMarkerAlt style={{ width: 18, height: 18, color: '#16a34a' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                              Location
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                              {booking.location}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '8px',
                            background: '#e0e7ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FaPhone style={{ width: 18, height: 18, color: '#4f46e5' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                              Contact
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                              {booking.phone}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{
                        paddingTop: 12,
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#64748b',
                        fontSize: '14px'
                      }}>
                        <FaEnvelope style={{ width: 14, height: 14 }} />
                        <span>{booking.email}</span>
                      </div>
                      {/* Action buttons */}
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => approveBooking(booking)}
                          disabled={processingId === booking.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #10b981',
                            background: processingId === booking.id ? '#f0fdf4' : '#10b981',
                            color: processingId === booking.id ? '#10b981' : 'white',
                            cursor: processingId === booking.id ? 'not-allowed' : 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {processingId === booking.id ? 'Processing...' : 'Approve'}
                        </button>

                        <button
                          onClick={() => rejectBooking(booking)}
                          disabled={processingId === booking.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #ef4444',
                            background: processingId === booking.id ? '#fff1f2' : 'white',
                            color: '#ef4444',
                            cursor: processingId === booking.id ? 'not-allowed' : 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {processingId === booking.id ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {/* Selected booking modal */}
            {selectedBooking && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setSelectedBooking(null)}>
                <div style={{ background: 'white', borderRadius: 12, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{selectedBooking.service}</h3>
                    <button onClick={() => setSelectedBooking(null)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
                  </div>
                  <div style={{ padding: 20 }}>
                    <h4 style={{ marginTop: 0 }}>{selectedBooking.service}</h4>
                    <p><strong>Customer:</strong> {selectedBooking.customer_name}</p>
                    <p><strong>Date:</strong> {selectedBooking.date}</p>
                    <p><strong>Time:</strong> {selectedBooking.start_time} - {selectedBooking.end_time}</p>
                    <p><strong>Location:</strong> {selectedBooking.location}</p>
                    <p><strong>Contact:</strong> {selectedBooking.phone} • {selectedBooking.email}</p>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { approveBooking(selectedBooking); setSelectedBooking(null); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: 700 }}>Approve</button>
                      <button onClick={() => { rejectBooking(selectedBooking); setSelectedBooking(null); }} style={{ padding: '8px 12px', borderRadius: 8, background: 'white', color: '#ef4444', border: '1px solid #ef4444', fontWeight: 700 }}>Reject</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingSchedule;
