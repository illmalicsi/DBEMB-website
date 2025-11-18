import React, { useState, useEffect, useMemo } from 'react';
import AuthService from '../services/authService';
import RequestQueue from '../services/requestQueue';
import { FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaCheckCircle, FaSpinner, FaChevronLeft, FaChevronRight, FaInfoCircle, FaGuitar } from '../icons/fa';
import StyledSelect from './StyledSelect';

const InstrumentBorrowing = () => {
  const today = new Date();
  
  // --- Core State ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // For Instrument Borrowing
  const [selectedInstrument, setSelectedInstrument] = useState('');
  const [customInstrumentName, setCustomInstrumentName] = useState('');
  const [fetchedInstruments, setFetchedInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(true);
  const [instrumentsError, setInstrumentsError] = useState(null);
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [quantity, setQuantity] = useState(1);

  // current logged-in user (if any)
  const [user, setUser] = useState(null);
  const [queuedNotice, setQueuedNotice] = useState(null);

  // --- Calendar State ---
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // --- Derived State ---
  const rentalDays = useMemo(() => {
    if (rentalStartDate && rentalEndDate) {
      const start = new Date(rentalStartDate);
      const end = new Date(rentalEndDate);
      if (end < start) return 0;
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  }, [rentalStartDate, rentalEndDate]);

  // Load user data
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('davaoBlueEaglesUser') || 'null');
      if (stored) {
        setUser(stored);
        if (stored.firstName || stored.email) {
          setName(stored.firstName ? `${stored.firstName} ${stored.lastName || ''}`.trim() : (stored.email || ''));
          setEmail(stored.email || '');
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);

  // Fetch available instruments from backend (fallback to localStorage)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingInstruments(true);
      setInstrumentsError(null);
      try {
  const res = await fetch('http://localhost:5000/api/instruments', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch instruments');
        const data = await res.json();
        if (!cancelled) {
          if (data && Array.isArray(data.instruments)) {
            setFetchedInstruments(data.instruments);
          } else if (Array.isArray(data)) {
            setFetchedInstruments(data);
          } else {
            setFetchedInstruments([]);
          }
        }
      } catch (err) {
        // fallback: try localStorage dbeInventory
        console.warn('InstrumentBorrowing: fetch instruments failed, falling back to localStorage', err);
        try {
          const saved = localStorage.getItem('dbeInventory');
          if (saved) {
            const parsed = JSON.parse(saved);
            // map to expected shape
            const mapped = (Array.isArray(parsed) ? parsed : []).map(it => ({
              instrument_id: it.id || it.instrument_id,
              name: it.name || it.label || '',
              category: it.category || '',
              subcategory: it.subcategory || '',
              // total quantity across locations
              quantity: it.locations ? it.locations.reduce((s,l)=>s+(Number(l.quantity)||0),0) : (it.quantity||0),
              // availableQuantity: prefer explicit availableQuantity if provided, else fall back to quantity
              availableQuantity: (typeof it.availableQuantity !== 'undefined') ? Number(it.availableQuantity) : (it.locations ? it.locations.reduce((s,l)=>s+(Number(l.quantity)||0),0) : (it.quantity||0)),
              location: it.locations && it.locations.length ? (it.locations[0].name || '') : (it.location||''),
              availability_status: it.archived ? 'Unavailable' : (it.status || 'Available'),
              condition_status: it.condition_status ?? it.conditionStatus ?? it.condition ?? null
            }));
            if (!cancelled) setFetchedInstruments(mapped.filter(i => i.availability_status === 'Available'));
          } else {
            if (!cancelled) setFetchedInstruments([]);
          }
        } catch (e) {
          if (!cancelled) setInstrumentsError(String(err || e));
        }
      } finally {
        if (!cancelled) setLoadingInstruments(false);
      }
    };
    load();
    // Note: customers do not choose a pickup location; server will select and persist a reservation location.
    return () => { cancelled = true; };
  }, []);

  // --- Calendar Utils ---
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstWeekday = (y, m) => new Date(y, m, 1).getDay();
  const pad2 = n => (n < 10 ? `0${n}` : `${n}`);
  const ymd = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleDateClick = (dateStr) => {
    if (dateStr >= todayStr) {
      if (!rentalStartDate || rentalEndDate) {
        setRentalStartDate(dateStr);
        setRentalEndDate('');
      } else if (dateStr >= rentalStartDate) {
        setRentalEndDate(dateStr);
      } else {
        setRentalStartDate(dateStr);
      }
    }
  };

  // --- Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const storageKey = 'borrowRequests';

      const selectedLabel = (() => {
        if (selectedInstrument === 'other') return customInstrumentName ? customInstrumentName.trim() : '';
        if (typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-')) {
          const id = parseInt(selectedInstrument.replace('db-', ''), 10);
          const inst = fetchedInstruments.find(i => Number(i.instrument_id) === id);
          return inst ? inst.name : selectedInstrument;
        }
        return selectedInstrument;
      })();

      // If logged in, prefer server-side creation
      if (AuthService.isAuthenticated()) {
        const instrumentIdVar = (typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-')) ? parseInt(selectedInstrument.replace('db-', ''), 10) : null;
        const instMatch = instrumentIdVar ? fetchedInstruments.find(i => Number(i.instrument_id) === instrumentIdVar) : null;
        const instrumentTypeVar = instMatch ? (instMatch.subcategory || '') : '';

        const foundInstrument = instMatch || null;

        const payload = {
          instrumentId: instrumentIdVar,
          instrumentName: selectedLabel,
          instrumentType: instrumentTypeVar,
          quantity: Number(quantity) || 1,
          startDate: rentalStartDate,
          endDate: rentalEndDate,
          purpose: purpose ? purpose.trim() : null,
          notes: notes ? notes.trim() : null,
          is_member_perk: true,
          rental_fee: null,
          // do not include locationId: server will choose reservation location
        };

        const endpoint = '/instruments/borrow-request';
        try {
          console.log('InstrumentBorrowing: submitting borrow payload to', endpoint, payload);
          const resp = await AuthService.post(endpoint, payload);
          console.log('InstrumentBorrowing: server response for borrow-request:', resp);
          if (!resp || resp.success !== true) throw new Error(resp && resp.message ? resp.message : 'Failed to submit request');

          const request = {
            id: resp.requestId || Date.now(),
            userId: user?.id || null,
            userName: name.trim(),
            userEmail: email.trim().toLowerCase(),
            phone: phone.trim(),
            instrument: selectedLabel,
            instrumentCondition: foundInstrument ? foundInstrument.condition_status : null,
            quantity: Number(quantity) || 1,
            startDate: rentalStartDate,
            endDate: rentalEndDate,
            purpose: payload.purpose,
            notes: payload.notes,
            status: 'pending',
            createdAt: new Date().toISOString()
          };

          // Notify other components to refresh from server
          window.dispatchEvent(new CustomEvent('borrowRequestCreated', { detail: request }));
          window.dispatchEvent(new Event('borrowRequestsUpdated'));

          setShowSuccess(true);
        } catch (err) {
          console.error('Server request failed, queuing in-memory for retry:', err);
          const queuedRequest = {
            id: `queued-${Date.now()}`,
            userId: user?.id || null,
            userName: name.trim(),
            userEmail: email.trim().toLowerCase(),
            phone: phone.trim(),
            instrument: selectedLabel,
            instrumentCondition: instMatch ? instMatch.condition_status : null,
            quantity: Number(quantity) || 1,
            startDate: rentalStartDate,
            endDate: rentalEndDate,
            purpose: purpose ? purpose.trim() : null,
            notes: notes ? notes.trim() : null,
            status: 'pending',
            createdAt: new Date().toISOString()
          };

          RequestQueue.addRequest({
            endpoint,
            payload,
            meta: queuedRequest,
            onSuccess: (resp) => {
              console.log('InstrumentBorrowing: queued borrow request synced response:', resp);
              const updated = { ...queuedRequest, id: resp.requestId || resp.request_id || Date.now(), request_id: resp.requestId || resp.request_id || null };
              console.log('InstrumentBorrowing: queued borrow updated meta:', updated);
              window.dispatchEvent(new CustomEvent('borrowRequestSynced', { detail: updated }));
              window.dispatchEvent(new Event('borrowRequestsUpdated'));
            },
            onFailure: (error) => {
              console.warn('Queued borrow request failed during retry:', error);
            }
          });

          setQueuedNotice('Your borrow request was queued and will be sent when connection is restored.');
          setShowSuccess(true);
        }
      } else {
        // Not authenticated: require login to persist to DB. Queueing requires an auth token.
        alert('Please login to submit borrow requests. Your details will not be saved otherwise.');
      }

      // Reset form
  setSelectedInstrument('');
  setCustomInstrumentName('');
      setRentalStartDate('');
      setRentalEndDate('');
      setPurpose('');
      setNotes('');
        setLocation('');
          setQuantity(1);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting request:', error);
      alert(error.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = useMemo(() => {
    return !!selectedInstrument && !!rentalStartDate && !!rentalEndDate && !!purpose && !!name && !!email && !!location;
  }, [selectedInstrument, rentalStartDate, rentalEndDate, purpose, name, email, location]);

  const minDate = today.toISOString().split('T')[0];

  const styles = {
    container: {
      minHeight: '100vh',
      background: '#ffffff',
      padding: '2rem 1rem',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    },
    wrapper: {
      maxWidth: '1400px',
      margin: '0 auto'
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem',
      padding: '0'
    },
    title: {
      fontSize: 'clamp(2rem, 5vw, 3.5rem)',
      fontWeight: '800',
      color: '#0b62d6',
      marginBottom: '1rem',
      letterSpacing: '-0.02em',
      padding: '0'
    },
    subtitle: {
      color: '#64748b',
      fontSize: '1.125rem',
      maxWidth: '600px',
      margin: '0 auto',
      lineHeight: '1.6',
      padding: '0'
    },
    mainContent: {
      display: 'grid',
      gridTemplateColumns: '1fr 350px',
      gap: '2rem',
      alignItems: 'start'
    },
    formContainer: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '2.5rem',
      border: '1px solid rgba(6, 95, 70, 0.1)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)'
    },
    formTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '2rem',
      color: '#0f172a',
      fontSize: '1.5rem',
      fontWeight: '700'
    },
    formGrid: {
      display: 'grid',
      gap: '1.5rem'
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    },
    label: {
      color: '#334155',
      fontSize: '0.875rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    required: {
      color: '#ef4444'
    },
    input: {
      width: '100%',
      padding: '1rem 1.25rem',
      background: 'rgba(248, 250, 252, 0.8)',
      border: '2px solid rgba(203, 213, 225, 0.5)',
      borderRadius: '12px',
      color: '#0f172a',
      fontSize: '1rem',
      fontFamily: 'inherit',
      transition: 'all 0.3s ease',
      outline: 'none',
      boxSizing: 'border-box'
    },
    textarea: {
      minHeight: '120px',
      resize: 'vertical'
    },
    button: {
      width: '100%',
      padding: '1.25rem 2rem',
      background: isFormValid
        ? 'linear-gradient(135deg, #065f46 0%, #059669 100%)'
        : 'rgba(203, 213, 225, 0.5)',
      color: isFormValid ? '#ffffff' : '#94a3b8',
      border: 'none',
      borderRadius: '16px',
      fontSize: '1.125rem',
      fontWeight: '700',
      cursor: isFormValid ? 'pointer' : 'not-allowed',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      boxShadow: isFormValid
        ? '0 10px 30px rgba(6, 95, 70, 0.2)'
        : 'none'
    },
    successMessage: {
      position: 'fixed',
      top: '2rem',
      right: '2rem',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#ffffff',
      padding: '1rem 1.5rem',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      zIndex: 1000,
      animation: 'slideIn 0.3s ease-out'
    },
    gridTwo: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1.5rem'
    },
    calendarContainer: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '1.5rem',
      border: '1px solid rgba(6, 95, 70, 0.1)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
      position: 'sticky',
      top: '2rem'
    },
    calendarHeader: {
      marginBottom: '1rem'
    },
    calendarTitle: {
      color: '#0f172a',
      fontSize: '1.125rem',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.75rem'
    },
    calendarNav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      marginBottom: '1rem'
    },
    navButton: {
      background: 'rgba(6, 95, 70, 0.1)',
      border: '1px solid rgba(6, 95, 70, 0.2)',
      borderRadius: '8px',
      padding: '0.5rem',
      color: '#065f46',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    monthYear: {
      color: '#334155',
      fontSize: '0.875rem',
      fontWeight: '600',
      minWidth: '100px',
      textAlign: 'center'
    },
    calendarGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '0.25rem'
    },
    dayHeader: {
      color: '#64748b',
      fontSize: '0.75rem',
      fontWeight: '600',
      textAlign: 'center',
      padding: '0.5rem 0.25rem'
    },
    dayCell: {
      aspectRatio: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      fontSize: '0.75rem',
      fontWeight: '500',
      position: 'relative'
    },
    dayAvailable: {
      background: 'rgba(16, 185, 129, 0.1)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.3)'
    },
    dayPast: {
      background: 'rgba(203, 213, 225, 0.3)',
      color: '#94a3b8',
      cursor: 'not-allowed'
    },
    daySelected: {
      background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
      color: '#ffffff',
      boxShadow: '0 4px 12px rgba(6, 95, 70, 0.3)'
    },
    legend: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.75rem',
      marginTop: '1.25rem',
      padding: '0.75rem',
      background: 'rgba(248, 250, 252, 0.8)',
      borderRadius: '12px'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      fontSize: '0.75rem',
      color: '#475569'
    },
    legendDot: {
      width: '10px',
      height: '10px',
      borderRadius: '50%'
    },
    memberBorrowBox: {
      marginTop: '1rem',
      padding: '1.25rem',
      border: '2px solid #bbf7d0',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
    },
    memberBorrowTitle: {
      fontWeight: '700',
      color: '#065f46',
      marginBottom: '0.5rem',
      fontSize: '1.125rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    memberBorrowText: {
      marginBottom: '0',
      color: '#065f46',
      fontSize: '0.875rem',
      lineHeight: '1.5'
    },
    priceInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      background: 'rgba(248, 250, 252, 0.8)',
      padding: '0.75rem 1rem',
      borderRadius: '12px',
      fontSize: '0.875rem',
      color: '#475569',
    }
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          
          input:focus, select:focus, textarea:focus {
            border-color: #065f46 !important;
            box-shadow: 0 0 0 3px rgba(6, 95, 70, 0.1) !important;
          }
          
          select option {
            background: #ffffff;
            color: #0f172a;
          }
          
          .calendar-day:hover:not(.day-past) {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(6, 95, 70, 0.2);
          }
          
          .nav-button:hover {
            background: rgba(6, 95, 70, 0.2) !important;
            transform: scale(1.05);
          }

          @media (max-width: 1024px) {
            .main-content {
              grid-template-columns: 1fr !important;
            }
            .calendar-container {
              position: relative !important;
              top: 0 !important;
            }
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      {showSuccess && (
        <div style={styles.successMessage}>
          <FaCheckCircle />
          Borrow request submitted for approval. We will contact you soon.
        </div>
      )}

      <div style={styles.wrapper}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            Instrument Borrowing
          </h1>
          <p style={styles.subtitle}>
            Borrow instruments as a member perk. Fill out the form below and we'll get back to you within 24 hours.
          </p>
        </div>

        <div className="main-content" style={styles.mainContent}>
          {/* Form Section */}
          <div style={styles.formContainer}>
            <div style={styles.formTitle}>
              <FaGuitar />
              Borrowing Details
            </div>

            <form onSubmit={handleSubmit} style={styles.formGrid}>
              {/* Member Perk Notice */}
              <div style={styles.memberBorrowBox}>
                <div style={styles.memberBorrowTitle}>
                  <FaCheckCircle />
                  Member Borrow Request (Free)
                </div>
                <div style={styles.memberBorrowText}>
                  As a member, you can borrow instruments at no cost. This is a special member perk with no rental fees applied.
                </div>
              </div>

              {/* Instrument Selection */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <FaGuitar />
                  Instrument
                  <span style={styles.required}>*</span>
                </label>
                <StyledSelect
                  value={selectedInstrument}
                  onChange={e => setSelectedInstrument(e.target.value)}
                  style={styles.input}
                  required
                >
                  <option value="">Select an instrument...</option>
                  {loadingInstruments && (
                    <option value="" disabled>Loading instruments...</option>
                  )}
                  {!loadingInstruments && fetchedInstruments && fetchedInstruments.length > 0 && (
                    fetchedInstruments.map(inst => {
                      const availableQty = (typeof inst.availableQuantity !== 'undefined') ? Number(inst.availableQuantity) : (Number(inst.quantity) || 0);
                      return (
                        <option key={`db-${inst.instrument_id}`} value={`db-${inst.instrument_id}`}>
                          {inst.name}
                        </option>
                      );
                    })
                  )}
                  <option value="other">Other (specify)</option>
                </StyledSelect>
                {selectedInstrument === 'other' && (
                  <input
                    type="text"
                    value={customInstrumentName}
                    onChange={e => setCustomInstrumentName(e.target.value)}
                    placeholder="Enter instrument name (e.g., 'Bass Drum')"
                    style={{ ...styles.input, marginTop: 8 }}
                    required
                  />
                )}
              </div>

              {/* Selected instrument summary (show only name, availability, condition - NO PRICE) */}
              {selectedInstrument && typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-') && (() => {
                const id = parseInt(selectedInstrument.replace('db-', ''), 10);
                const sel = fetchedInstruments.find(i => Number(i.instrument_id) === id);
                if (!sel) return null;
                const availableQty = (typeof sel.availableQuantity !== 'undefined') ? Number(sel.availableQuantity) : (Number(sel.quantity) || 0);
                return (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(6,95,70,0.15)', background: 'rgba(240,253,244,0.8)', maxWidth: 520 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{sel.name}</div>
                    <div style={{ color: '#475569', fontSize: 13 }}>Availability: <strong style={{ color: sel.availability_status === 'Available' ? '#065f46' : '#b91c1c' }}>{sel.availability_status}{typeof availableQty === 'number' ? ` — ${availableQty} available` : ''}</strong></div>
                    <div style={{ color: '#475569', fontSize: 13 }}>Condition: <strong>{sel.condition_status || 'Unknown'}</strong></div>
                  </div>
                );
              })()}

              {selectedInstrument === 'other' && customInstrumentName && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(6,95,70,0.08)', background: 'rgba(248,250,252,0.8)', maxWidth: 520 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{customInstrumentName}</div>
                  <div style={{ color: '#475569', fontSize: 13 }}>Availability: <strong style={{ color: '#065f46' }}>Request</strong></div>
                  <div style={{ color: '#475569', fontSize: 13 }}>Condition: <strong>Specify on pickup</strong></div>
                </div>
              )}

              {/* Quantity */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <FaInfoCircle />
                  Quantity
                  <span style={styles.required}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  style={styles.input}
                  required
                  max={selectedInstrument && typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-') ? (() => {
                    const id = parseInt(selectedInstrument.replace('db-', ''), 10);
                    const sel = fetchedInstruments.find(i => Number(i.instrument_id) === id);
                    const availableQty = sel ? (typeof sel.availableQuantity !== 'undefined' ? Number(sel.availableQuantity) : (Number(sel.quantity) || 0)) : 999;
                    return availableQty;
                  })() : 999}
                />
              </div>

              {/* Purpose */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <FaInfoCircle />
                  Purpose
                  <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  style={styles.input}
                  placeholder="e.g., Band practice, rehearsal, performance"
                  required
                />
              </div>

              {/* Rental Dates */}
              <div style={styles.gridTwo}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaCalendarAlt />
                    Borrow Start Date
                    <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="date"
                    value={rentalStartDate}
                    onChange={e => setRentalStartDate(e.target.value)}
                    style={styles.input}
                    min={minDate}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaCalendarAlt />
                    Return Date
                    <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="date"
                    value={rentalEndDate}
                    onChange={e => setRentalEndDate(e.target.value)}
                    style={styles.input}
                    min={rentalStartDate || minDate}
                    required
                  />
                </div>
              </div>

              {/* Duration Info */}
              {rentalDays > 0 && (
                <div style={styles.priceInfo}>
                  <FaInfoCircle />
                  <span>Duration: <strong>{rentalDays} day{rentalDays > 1 && 's'}</strong></span>
                </div>
              )}

              {/* Personal Information */}
              <div style={styles.gridTwo}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaUser />
                    Full Name
                    <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={styles.input}
                    placeholder="e.g., Juan Dela Cruz"
                    required
                  />
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaEnvelope />
                    Email Address
                    <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={styles.input}
                    placeholder="e.g., juan.delacruz@email.com"
                    required
                  />
                </div>
              </div>

              <div style={styles.gridTwo}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaPhone />
                    Phone Number
                    <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={styles.input}
                    placeholder="e.g., 09171234567"
                    required
                  />
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaMapMarkerAlt />
                    Address
                    <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    style={styles.input}
                    placeholder="e.g., 123 Rizal St, Metro Manila"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <FaInfoCircle />
                  Notes / Special Requests
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ ...styles.input, ...styles.textarea }}
                  placeholder="e.g., pickup person, additional instructions"
                  rows={4}
                ></textarea>
              </div>

              <button type="submit" disabled={!isFormValid || isSubmitting} style={styles.button}>
                {isSubmitting ? (
                  <>
                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    Submit Borrow Request
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Calendar Section */}
          <div className="calendar-container" style={styles.calendarContainer}>
            <div style={styles.calendarHeader}>
              <div style={styles.calendarTitle}>
                <FaCalendarAlt size={16} />
                Select Borrow Dates
              </div>
            </div>
            <div style={styles.calendarNav}>
              <button className="nav-button" style={styles.navButton} onClick={prevMonth} type="button">
                <FaChevronLeft size={12} />
              </button>
              <div style={styles.monthYear}>
                {new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
              <button className="nav-button" style={styles.navButton} onClick={nextMonth} type="button">
                <FaChevronRight size={12} />
              </button>
            </div>

            <div style={styles.calendarGrid}>
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={styles.dayHeader}>
                  {day}
                </div>
              ))}

              {/* Empty cells for days before the first day of the month */}
              {Array.from({ length: firstWeekday(year, month) }, (_, i) => (
                <div key={`empty-${i}`} style={styles.dayCell}></div>
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth(year, month) }, (_, i) => {
                const day = i + 1;
                const dateStr = ymd(year, month, day);
                const isPast = dateStr < todayStr;
                const isSelected = dateStr >= rentalStartDate && dateStr <= rentalEndDate && rentalStartDate && rentalEndDate;

                let dayStyle = { ...styles.dayCell };

                if (isSelected) {
                  dayStyle = { ...dayStyle, ...styles.daySelected };
                } else if (isPast) {
                  dayStyle = { ...dayStyle, ...styles.dayPast };
                } else {
                  dayStyle = { ...dayStyle, ...styles.dayAvailable };
                }

                return (
                  <div
                    key={day}
                    className={`calendar-day ${isPast ? 'day-past' : ''}`}
                    style={dayStyle}
                    onClick={() => handleDateClick(dateStr)}
                    title={
                      isPast
                        ? 'Past date'
                        : isSelected
                          ? 'Selected'
                          : 'Available'
                    }
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={styles.legend}>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#10b981' }}></div>
                Available
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#065f46' }}></div>
                Selected
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#64748b' }}></div>
                Past Date
              </div>
            </div>

            {/* Show selected range below calendar */}
            {rentalStartDate && rentalEndDate && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'rgba(6, 95, 70, 0.1)',
                borderRadius: '8px',
                color: '#065f46',
                fontWeight: '600',
                fontSize: '0.875rem',
                textAlign: 'center'
              }}>
                Selected: {rentalStartDate} to {rentalEndDate} ({rentalDays} day{rentalDays > 1 ? 's' : ''})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstrumentBorrowing;