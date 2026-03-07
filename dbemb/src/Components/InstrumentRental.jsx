import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AuthService from '../services/authService';
import RequestQueue from '../services/requestQueue';
import { API_BASE_URL } from '../services/apiConfig';
import InstrumentTerms from './InstrumentTerms';
import { FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaCheckCircle, FaSpinner, FaChevronLeft, FaChevronRight, FaInfoCircle, FaGuitar } from 'react-icons/fa';

// Instrument data will be loaded from the backend; no local fallback mapping to force DB-driven options

const InstrumentRental = () => {
  const today = new Date();
  
  // --- Core State ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // For Instrument Rentals
  const [selectedInstrument, setSelectedInstrument] = useState('');
  const [customInstrumentName, setCustomInstrumentName] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // multiple instruments support
  const [fetchedInstruments, setFetchedInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(true);
  const [instrumentsError, setInstrumentsError] = useState(null);
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // current logged-in user (if any)
  const [user, setUser] = useState(null);

  // Terms acceptance (required for rental requests)
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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

  // Effective days for estimation: use the selected rentalDays for all items (totals scale with chosen dates)
  const effectiveDays = rentalDays || 1;

  // --- Effect for Price Calculation ---
  useEffect(() => {
    // Compute estimatedValue based on either selectedItems (multi) or the single selectedInstrument
    let total = 0;

    if (selectedItems && selectedItems.length > 0) {
      for (const it of selectedItems) {
        const instId = (typeof it.id === 'string' && it.id.startsWith('db-')) ? parseInt(it.id.replace('db-',''), 10) : null;
        const match = instId ? fetchedInstruments.find(i => Number(i.instrument_id) === instId) : null;
        const price = match ? (Number(match.price_per_day) || 0) : 0;
        const qty = Number(it.quantity) || 1;
        total += price * effectiveDays * qty;
      }
    } else {
      // single-selection price calculation
      let instrumentPrice = 0;
      if (typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-')) {
        const id = parseInt(selectedInstrument.replace('db-', ''), 10);
        const inst = fetchedInstruments.find(i => Number(i.instrument_id) === id);
        const rawPrice = inst?.price_per_day ?? inst?.pricePerDay ?? 0;
        instrumentPrice = Number(rawPrice) || 0;
      }
      total = instrumentPrice * effectiveDays * (Number(quantity) || 1);
    }

    setEstimatedValue(total);
  }, [selectedInstrument, rentalDays, quantity, fetchedInstruments, selectedItems, effectiveDays]);

  // Load user data
  useEffect(() => {
    try {
      const stored = AuthService.getUser();
      if (stored) {
        setUser(stored);
        const first = stored.firstName || stored.first_name || stored.name || stored.customerName || '';
        const last = stored.lastName || stored.last_name || '';
        const computedName = first ? `${first} ${last}`.trim() : (stored.name || stored.customerName || '');
        if (computedName || stored.email) {
          setName(computedName || (stored.email || ''));
          setEmail(stored.email || '');
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);

  // Fetch available instruments from backend (fallback to localStorage)
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchInstruments = useCallback(async () => {
    setLoadingInstruments(true);
    setInstrumentsError(null);
    try {
      // If dates selected, ask backend for availability in that range
      let url = `${API_BASE_URL}/instruments`;
      if (rentalStartDate && rentalEndDate) {
        url += `?start=${encodeURIComponent(rentalStartDate)}&end=${encodeURIComponent(rentalEndDate)}`;
      }
      console.log('InstrumentRental: Fetching from:', url);
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch instruments');
      const data = await res.json();
      console.log('InstrumentRental: Response data:', data);
      if (!isMounted.current) return;
      if (data && Array.isArray(data.instruments)) {
        console.log('InstrumentRental: Setting instruments (from data.instruments):', data.instruments.length, 'items');
        setFetchedInstruments(data.instruments);
        try { console.debug('InstrumentRental: fetched instruments (instruments):', data.instruments); } catch(e) {}
      } else if (Array.isArray(data)) {
        console.log('InstrumentRental: Setting instruments (from array):', data.length, 'items');
        setFetchedInstruments(data);
        try { console.debug('InstrumentRental: fetched instruments (array):', data); } catch(e) {}
      } else {
        console.warn('InstrumentRental: Unexpected data format, setting empty array');
        setFetchedInstruments([]);
      }
    } catch (err) {
      // fallback: try localStorage dbeInventory
      console.warn('InstrumentRental: fetch instruments failed, falling back to localStorage', err);
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
            quantity: it.locations ? it.locations.reduce((s,l)=>s+(Number(l.quantity)||0),0) : (it.quantity||0),
            location: it.locations && it.locations.length ? (it.locations[0].name || '') : (it.location||''),
            availability_status: it.archived ? 'Unavailable' : (it.status || 'Available'),
            // try to preserve price and condition if present in local saved inventory
            price_per_day: it.price_per_day ?? it.pricePerDay ?? null,
            condition_status: it.condition_status ?? it.conditionStatus ?? it.condition ?? null
          }));
          if (!isMounted.current) return;
          setFetchedInstruments(mapped.filter(i => i.availability_status === 'Available'));
          try { console.debug('InstrumentRental: loaded instruments from localStorage dbeInventory:', mapped); } catch(e) {}
        } else {
          if (!isMounted.current) return;
          setFetchedInstruments([]);
        }
      } catch (e) {
        if (!isMounted.current) return;
        setInstrumentsError(String(err || e));
      }
    } finally {
      if (!isMounted.current) {
        console.log('InstrumentRental: Component unmounted, not setting loading state');
        return;
      }
      console.log('InstrumentRental: Setting loadingInstruments to false');
      setLoadingInstruments(false);
    }
  }, [rentalStartDate, rentalEndDate]);

  useEffect(() => {
    fetchInstruments();
    // Note: customers do not choose a pickup location; server will pick and persist a reservation location.
  }, [fetchInstruments]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('InstrumentRental: State changed - loadingInstruments:', loadingInstruments, 'fetchedInstruments count:', fetchedInstruments.length);
  }, [loadingInstruments, fetchedInstruments]);

  // Refresh available instruments when requests are updated (so returned items reappear)
  useEffect(() => {
    const handler = () => {
      try { fetchInstruments(); } catch (e) { /* best-effort */ }
    };
    window.addEventListener('rentRequestsUpdated', handler);
    window.addEventListener('borrowRequestsUpdated', handler);
    window.addEventListener('notificationsUpdated', handler);
    window.addEventListener('instrumentsUpdated', handler);
    return () => {
      window.removeEventListener('rentRequestsUpdated', handler);
      window.removeEventListener('borrowRequestsUpdated', handler);
      window.removeEventListener('notificationsUpdated', handler);
      window.removeEventListener('instrumentsUpdated', handler);
    };
  }, [fetchInstruments]);

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
  useEffect(() => {
    const handler = (e) => {
      if (user && (e.detail.userEmail === user.email || e.detail.userId === user.id)) {
        setApprovalNotification('Your instrument rental request has been approved! Please proceed with full payment to secure your booking.');
        setTimeout(() => setApprovalNotification(null), 10000);
      }
    };
    window.addEventListener('instrumentRequestApproved', handler);
    return () => window.removeEventListener('instrumentRequestApproved', handler);
  }, [user]);

  const [approvalNotification, setApprovalNotification] = useState(null);
  const [queuedNotice, setQueuedNotice] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Rentals-only: always treat this as a rent request
      const type = 'rent';
      const storageKey = 'rentRequests';

      // Prepare items to submit: either the selectedItems list (multi-add) or the single current selection
      let itemsToSubmit = [];
      if (selectedItems && selectedItems.length > 0) {
        itemsToSubmit = selectedItems.map(it => ({ id: it.id, name: it.name, quantity: Number(it.quantity) || 1 }));
      } else {
        let singleName = '';
        if (selectedInstrument === 'other') {
          singleName = customInstrumentName ? customInstrumentName.trim() : '';
        } else if (typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-')) {
          const sid = parseInt(selectedInstrument.replace('db-', ''), 10);
          const match = fetchedInstruments.find(i => Number(i.instrument_id) === sid);
          singleName = match ? match.name : selectedInstrument;
        } else {
          singleName = selectedInstrument;
        }
        itemsToSubmit = [{ id: selectedInstrument, name: singleName, quantity: Number(quantity) || 1 }];
      }

      const endpoint = '/instruments/rent-requests';

      if (AuthService.isAuthenticated()) {
        // Send a single atomic request with an items array. Backend will reserve inventory and create multiple rows in a transaction.
        const itemsPayload = itemsToSubmit.map(it => {
          const instrumentId = (typeof it.id === 'string' && it.id.startsWith('db-')) ? parseInt(it.id.replace('db-', ''), 10) : null;
          const instMatch = instrumentId ? fetchedInstruments.find(i => Number(i.instrument_id) === instrumentId) : null;
          return {
            instrumentId,
            instrumentName: it.name,
            instrumentType: instMatch ? (instMatch.subcategory || '') : '',
            quantity: Number(it.quantity) || 1
          };
        });

        const payload = {
          items: itemsPayload,
          startDate: rentalStartDate,
          endDate: rentalEndDate,
          purpose: purpose ? purpose.trim() : null,
          notes: notes ? notes.trim() : null,
          phone: phone ? phone.trim() : null,
          // do not include locationId: server will choose reservation location
        };

        try {
          const resp = await AuthService.post(endpoint, payload);
          if (!resp || resp.success !== true) throw new Error(resp && resp.message ? resp.message : 'Failed to submit request');

          // Fire events per created request so UI stays consistent
          if (Array.isArray(resp.requestIds)) {
            resp.requestIds.forEach((rid, idx) => {
              const it = itemsPayload[idx] || itemsPayload[0];
              const qty = Number(it.quantity) || 1;
              const days = rentalDays || 1;
              const instId = it.instrumentId ? Number(it.instrumentId) : null;
              const instMatch = instId ? fetchedInstruments.find(i => Number(i.instrument_id) === instId) : null;
              const perDay = instMatch ? (Number(instMatch.price_per_day) || null) : null;
              const totalAmount = perDay != null ? perDay * days * qty : null;

              const request = {
                id: rid,
                request_id: rid,
                userId: user?.id || null,
                userName: name.trim(),
                userEmail: email.trim().toLowerCase(),
                phone: phone.trim(),
                instrument: it.instrumentName,
                instrumentCondition: null,
                instrumentPricePerDay: perDay,
                rental_fee: perDay,
                rentalFee: perDay,
                startDate: rentalStartDate,
                endDate: rentalEndDate,
                days: days,
                total_amount: totalAmount,
                amount: totalAmount,
                purpose: payload.purpose,
                notes: payload.notes,
                status: 'pending',
                createdAt: new Date().toISOString()
              };
              window.dispatchEvent(new CustomEvent('rentRequestCreated', { detail: request }));
            });
          }

          window.dispatchEvent(new Event(`${type}RequestsUpdated`));
          setShowSuccess(true);
        } catch (err) {
          console.error('Server request failed (atomic), queuing in-memory for retry:', err);
          RequestQueue.addRequest({ endpoint, payload, meta: { type: 'multi-rent-request', payload } });
          setQueuedNotice('Your request was queued and will be sent when connection is restored.');
          setShowSuccess(true);
        }
      } else {
        // Not authenticated: store each item locally (preserve behavior)
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        for (const it of itemsToSubmit) {
          const isDb = (typeof it.id === 'string' && it.id.startsWith('db-'));
          const instMatch = isDb ? fetchedInstruments.find(i => Number(i.instrument_id) === parseInt(it.id.replace('db-',''),10)) : null;
          const qty = Number(it.quantity) || 1;
          const days = rentalDays || 1;
          const perDay = instMatch ? (Number(instMatch.price_per_day) || null) : null;
          const totalAmount = perDay != null ? perDay * days * qty : null;

          const request = {
            id: `local-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            request_id: null,
            localOnly: true,
            userId: user?.id || null,
            userName: name.trim(),
            userEmail: email.trim().toLowerCase(),
            phone: phone.trim(),
            instrument: it.name,
            instrumentCondition: instMatch ? instMatch.condition_status : null,
            instrumentPricePerDay: perDay,
            rental_fee: perDay,
            rentalFee: perDay,
            days: days,
            total_amount: totalAmount,
            amount: totalAmount,
            startDate: rentalStartDate,
            endDate: rentalEndDate,
            purpose: purpose ? purpose.trim() : null,
            notes: notes ? notes.trim() : null,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          existing.unshift(request);
        }
        localStorage.setItem(storageKey, JSON.stringify(existing));
        window.dispatchEvent(new Event(`${type}RequestsUpdated`));
        setShowSuccess(true);
      }

      // Reset form
  setSelectedInstrument('');
  setCustomInstrumentName('');
      setSelectedItems([]);
      setRentalStartDate('');
      setRentalEndDate('');
      setPurpose('');
      setNotes('');
      setLocation('');
      setEstimatedValue(0);
      setAcceptedTerms(false);
      setQuantity(1);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting request:', error);
      alert(error.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Note: localStorage-based sync removed under strict server-only mode.

  const isFormValid = useMemo(() => {
    const hasInstrument = (!!selectedInstrument) || (selectedItems && selectedItems.length > 0);
    const base = hasInstrument && !!rentalStartDate && !!rentalEndDate && !!purpose && !!name && !!email && !!location;
    // For rentals require terms acceptance
    return base && acceptedTerms;
  }, [selectedInstrument, selectedItems, rentalStartDate, rentalEndDate, purpose, name, email, location, acceptedTerms]);

  const minDate = today.toISOString().split('T')[0];

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #dbeafe 100%)',
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
      color: '#0369a1',
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
      border: '1px solid rgba(3, 105, 161, 0.1)',
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
        ? 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)'
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
        ? '0 10px 30px rgba(3, 105, 161, 0.2)'
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
      border: '1px solid rgba(3, 105, 161, 0.1)',
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
      background: 'rgba(3, 105, 161, 0.1)',
      border: '1px solid rgba(3, 105, 161, 0.2)',
      borderRadius: '8px',
      padding: '0.5rem',
      color: '#0369a1',
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
      background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
      color: '#ffffff',
      boxShadow: '0 4px 12px rgba(3, 105, 161, 0.3)'
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
    priceDisplay: {
      background: 'rgba(3, 105, 161, 0.05)',
      border: '1px solid rgba(3, 105, 161, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      textAlign: 'center',
      transition: 'all 0.3s ease',
      marginTop: '1rem',
    },
    priceLabel: {
      color: '#475569',
      fontSize: '1rem',
      fontWeight: '600',
      marginBottom: '0.5rem',
    },
    priceValue: {
      color: '#0369a1',
      fontSize: '2.5rem',
      fontWeight: '800',
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
    ,
    primaryButton: {
      background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      fontWeight: 700,
      padding: '8px 12px'
    }
    ,
    selectionCard: {
      background: '#ffffff',
      borderRadius: 12,
      padding: '12px',
      boxShadow: '0 6px 20px rgba(2,6,23,0.06)',
      border: '1px solid rgba(3,105,161,0.06)',
      marginBottom: '1rem'
    },
    selectionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    },
    selectionItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      borderRadius: 6,
      background: '#ffffff',
      borderBottom: '1px solid #e6eef8',
      marginBottom: 0
    },
    smallBtn: {
      background: 'transparent',
      border: 'none',
      color: '#ef4444',
      cursor: 'pointer',
      fontWeight: 700
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
            border-color: #0369a1 !important;
            box-shadow: 0 0 0 3px rgba(3, 105, 161, 0.1) !important;
          }
          
          select option {
            background: #ffffff;
            color: #0f172a;
          }
          
          .calendar-day:hover:not(.day-past) {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(3, 105, 161, 0.2);
          }
          
          .nav-button:hover {
            background: rgba(3, 105, 161, 0.2) !important;
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
          {'Instrument rental request submitted for approval. We will contact you soon.'}
        </div>
      )}

      <div style={styles.wrapper}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            Instrument Rental
          </h1>
          <p style={styles.subtitle}>
            Rent an instruments for your musical needs.
            Fill out the form below and we'll get back to you within 24 hours.
          </p>
        </div>

        <div className="main-content" style={styles.mainContent}>
          {/* Form Section */}
          <div style={styles.formContainer}>
            <div style={styles.formTitle}>
              <FaGuitar />
              Rental Details
            </div>

            <form onSubmit={handleSubmit} style={styles.formGrid}>
              {/* Instrument Selection */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <FaGuitar />
                  Instrument
                  <span style={styles.required}>*</span>
                </label>
                <select
                  value={selectedInstrument}
                  onChange={e => setSelectedInstrument(e.target.value)}
                  style={styles.input}
                  required={!(selectedItems && selectedItems.length > 0)}
                >
                  <option value="">Select an instrument...</option>
                  {loadingInstruments && (
                    <option value="" disabled>Loading instruments...</option>
                  )}
                  {!loadingInstruments && fetchedInstruments && fetchedInstruments.length > 0 && (() => {
                    console.log('InstrumentRental: Rendering dropdown with', fetchedInstruments.length, 'instruments');
                    const filtered = fetchedInstruments.filter(inst => {
                      // hide explicitly archived/unavailable items
                      const avail = inst.computedAvailabilityStatus || inst.availability_status || '';
                      const availableQty = typeof inst.availableQuantity !== 'undefined' ? Number(inst.availableQuantity) : (Number(inst.quantity) || 0);
                      const isAvailable = (String(avail).toLowerCase().includes('available')) && availableQty >= (Number(quantity) || 1);
                      console.log(`Instrument ${inst.name}: avail="${avail}", qty=${availableQty}, isAvailable=${isAvailable}`);
                      return isAvailable;
                    });
                    console.log('InstrumentRental: After filtering:', filtered.length, 'instruments');
                    return filtered.map(inst => (
                      <option key={`db-${inst.instrument_id}`} value={`db-${inst.instrument_id}`}>
                        {inst.name}
                      </option>
                    ));
                  })()}

                  {/* Fallback to static mapping if user wants non-db options */}
                  <option value="other">Other (specify)</option>
                </select>
                {selectedInstrument === 'other' && (
                  <input
                    type="text"
                    value={customInstrumentName}
                    onChange={e => setCustomInstrumentName(e.target.value)}
                    placeholder="Enter instrument name (e.g., 'Vintage Trumpet')"
                    style={{ ...styles.input, marginTop: 8 }}
                    required
                  />
                )}
              </div>

              {/* Selected instrument summary (show only name, availability, condition, price) */}
              {selectedInstrument && typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-') && (() => {
                const id = parseInt(selectedInstrument.replace('db-', ''), 10);
                const sel = fetchedInstruments.find(i => Number(i.instrument_id) === id);
                if (!sel) return null;
                return (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(3,105,161,0.08)', background: 'rgba(248,250,252,0.8)', maxWidth: 520 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{sel.name}</div>
                    {
                      (() => {
                        const availLabel = sel.computedAvailabilityStatus || sel.availability_status || 'Unknown';
                        const isAvail = String(availLabel).toLowerCase().includes('available');
                        const availableQty = typeof sel.availableQuantity !== 'undefined' ? Number(sel.availableQuantity) : (Number(sel.quantity) || 0);
                        return (
                          <>
                            <div style={{ color: '#475569', fontSize: 13 }}>Availability: <strong style={{ color: isAvail ? '#065f46' : '#b91c1c' }}>{availLabel}{typeof availableQty === 'number' ? ` — ${availableQty} available` : ''}</strong></div>
                            <div style={{ color: '#475569', fontSize: 13 }}>Condition: <strong>{sel.condition_status || 'Unknown'}</strong></div>
                            <div style={{ color: '#0369a1', fontSize: 16, fontWeight: 700, marginTop: 6 }}>{sel.price_per_day !== null && sel.price_per_day !== undefined ? `₱${Number(sel.price_per_day).toLocaleString()}/day` : 'Price N/A'}</div>
                          </>
                        );
                      })()
                    }
                  </div>
                );
              })()}
              {/* Show summary for custom instrument when 'other' is selected */}
              {selectedInstrument === 'other' && customInstrumentName && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(3,105,161,0.08)', background: 'rgba(248,250,252,0.8)', maxWidth: 520 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{customInstrumentName}</div>
                  <div style={{ color: '#475569', fontSize: 13 }}>Availability: <strong style={{ color: '#065f46' }}>Request</strong></div>
                  <div style={{ color: '#475569', fontSize: 13 }}>Condition: <strong>Specify on pickup</strong></div>
                  <div style={{ color: '#0369a1', fontSize: 16, fontWeight: 700, marginTop: 6 }}>Price N/A</div>
                </div>
              )}

              {/* Quantity */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  Quantity
                  <span style={styles.required}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedInstrument && typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-') ? (() => {
                    const id = parseInt(selectedInstrument.replace('db-', ''), 10);
                    const sel = fetchedInstruments.find(i => Number(i.instrument_id) === id);
                    const availableQty = sel ? (typeof sel.availableQuantity !== 'undefined' ? Number(sel.availableQuantity) : (Number(sel.quantity) || 0)) : 1;
                    return availableQty;
                  })() : 999}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.input}
                  required
                />
                {selectedInstrument && typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-') && (() => {
                  const id = parseInt(selectedInstrument.replace('db-', ''), 10);
                  const sel = fetchedInstruments.find(i => Number(i.instrument_id) === id);
                  const availableQty = sel ? (typeof sel.availableQuantity !== 'undefined' ? Number(sel.availableQuantity) : (Number(sel.quantity) || 0)) : 0;
                  return (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Maximum available: {availableQty}
                    </div>
                  );
                })()}
              </div>

              {/* Minimal Add instrument UI */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <button type="button" onClick={() => {
                  if (!selectedInstrument) return alert('Select an instrument');
                  if (selectedInstrument === 'other' && !customInstrumentName.trim()) return alert('Enter the instrument name');
                  const instObj = (typeof selectedInstrument === 'string' && selectedInstrument.startsWith('db-')) ? fetchedInstruments.find(i => Number(i.instrument_id) === parseInt(selectedInstrument.replace('db-',''),10)) : null;
                  const item = {
                    id: selectedInstrument,
                    name: selectedInstrument === 'other' ? customInstrumentName.trim() : (instObj ? instObj.name : selectedInstrument),
                    instrumentType: instObj ? (instObj.subcategory || '') : '',
                    quantity: Number(quantity) || 1
                  };
                  setSelectedItems(prev => [...prev, item]);
                  setSelectedInstrument('');
                  setCustomInstrumentName('');
                  setQuantity(1);
                }} style={{
                  background: '#0369a1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, padding: '7px 16px', fontSize: 15, boxShadow: '0 1px 4px rgba(3,105,161,0.07)', cursor: 'pointer'
                }}>
                  Add
                </button>
              </div>

              {/* Selected items card (inside form) */}
              {selectedItems.length > 0 && (
                <div style={styles.selectionCard}>
                  <div style={styles.selectionHeader}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>Selected items</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}</div>
                  </div>
                  {selectedItems.map((it, idx) => {
                    const instId = (typeof it.id === 'string' && it.id.startsWith('db-')) ? parseInt(it.id.replace('db-',''),10) : null;
                    const match = instId ? fetchedInstruments.find(i => Number(i.instrument_id) === instId) : null;
                    const price = match ? (Number(match.price_per_day) || 0) : null;
                    const subtotal = price ? price * effectiveDays * (Number(it.quantity)||1) : null;
                    return (
                      <div key={idx} style={styles.selectionItem}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{it.instrumentType || 'Instrument'} • Qty: {it.quantity}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <div style={{ fontWeight: 700, color: '#0369a1' }}>{price ? `₱${price.toLocaleString()}/day` : 'Price N/A'}</div>
                          <div style={{ fontSize: 13, color: '#334155', marginTop: 6 }}>{subtotal ? `₱${subtotal.toLocaleString()}` : '₱0'}</div>
                          <button type="button" onClick={() => setSelectedItems(prev => prev.filter((_,i) => i !== idx))} style={styles.smallBtn}>Remove</button>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <div style={{ color: '#475569', fontWeight: 700 }}>Estimated total</div>
                    <div style={{ color: '#0f172a', fontWeight: 800, fontSize: 18 }}>
                      {(() => {
                        const total = selectedItems.reduce((s, it) => {
                          const iid = (typeof it.id === 'string' && it.id.startsWith('db-')) ? parseInt(it.id.replace('db-',''),10) : null;
                          const m = iid ? fetchedInstruments.find(i => Number(i.instrument_id) === iid) : null;
                          const p = m ? (Number(m.price_per_day) || 0) : 0;
                          return s + (p * (Number(it.quantity)||1) * effectiveDays);
                        }, 0);
                        return total > 0 ? `₱${total.toLocaleString()}` : '₱0';
                      })()}
                    </div>
                  </div>
                </div>
              )}

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
                  placeholder="e.g., Wedding performance, rehearsal, practice sessions"
                  required
                />
              </div>

              {/* Rental Dates */}
              <div style={styles.gridTwo}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaCalendarAlt />
                    Rental Start Date
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
                    Rental End Date
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
                  placeholder="e.g., pickup person, ID to present, additional instructions"
                  rows={4}
                ></textarea>
              </div>

              {/* Price Display */}
              {estimatedValue > 0 && (
                <div style={styles.priceDisplay}>
                  <div style={styles.priceLabel}>Estimated Rental Fee</div>
                  <div style={styles.priceValue}>₱{estimatedValue.toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
                    Payment will be processed after admin approval
                  </div>
                </div>
              )}

              {/* Terms and Policy for Rentals (required) - extracted to component for cleanliness */}
              <InstrumentTerms acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} user={user} />

              <button type="submit" disabled={!isFormValid || isSubmitting} style={styles.button}>
                {isSubmitting ? (
                  <>
                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    Submit Request
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
                Select Rental Dates
              </div>
            </div>
            {/* selection summary moved into the form for a more compact layout */}
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
                <div style={{ ...styles.legendDot, background: '#0369a1' }}></div>
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
                background: 'rgba(3, 105, 161, 0.1)',
                borderRadius: '8px',
                color: '#0369a1',
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
      {approvalNotification && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#1e3a8a', color: '#fff', padding: 12, borderRadius: 8, zIndex: 2000 }}>
          {approvalNotification}
        </div>
      )}
    </div>
  );
};

export default InstrumentRental;