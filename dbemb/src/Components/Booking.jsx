import React, { useState, useEffect, useMemo } from 'react';
import { FaCalendarAlt, FaClock, FaUser, FaUsers, FaEnvelope, FaPhone, FaMapMarkerAlt, FaMusic, FaCheckCircle, FaSpinner, FaChevronLeft, FaChevronRight, FaInfoCircle, FaGuitar, FaDrum, FaKeyboard, FaPlus, FaCreditCard, FaTimes } from '../icons/fa';
import NotificationService from '../services/notificationService';
import mysqlService from '../services/mysqlService';
import { API_BASE_URL } from '../services/apiConfig';
import StyledSelect from './StyledSelect';
import { formatCurrency } from '../utils/formatters';

// --- Data for Dynamic Form ---

// Services list will be loaded from backend /api/services
// Band packages will be loaded from backend /api/band-packages

const bandPackagesHardcoded = {
  '20-players-with': { label: '20 Players (with Food & Transport)', price: 15000 },
  '20-players-without': { label: '20 Players (without Food & Transport)', price: 20000 },
  '30-players-with': { label: '30 Players (with Food & Transport)', price: 25000 },
  '30-players-without': { label: '30 Players (without Food & Transport)', price: 30000 },
  'full-band': { label: 'Full Band', price: 35000 },
};

const instruments = {
  'trumpet': { label: 'Trumpet', pricePerDay: 500 },
  'trombone': { label: 'Trombone', pricePerDay: 500 },
  'french-horn': { label: 'French Horn', pricePerDay: 500 },
  'tuba': { label: 'Tuba', pricePerDay: 500 },
  'flute': { label: 'Flute', pricePerDay: 500 },
  'clarinet': { label: 'Clarinet', pricePerDay: 500 },
  'saxophone': { label: 'Saxophone', pricePerDay: 500 },
  'yamaha-snare': { label: 'Yamaha Snare Drum', pricePerDay: 1000 },
  'pearl-snare': { label: 'Pearl Snare Drum', pricePerDay: 1000 },
  'bass-drum': { label: 'Bass Drum', pricePerDay: 500 },
  'cymbals': { label: 'Cymbals', pricePerDay: 500 },
};

const musicArrangementBasePrice = 3000;

const modalStyles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  modal: {
    background: '#fff', borderRadius: '12px', padding: '32px', minWidth: '340px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center'
  },
  input: { width: '100%', padding: '10px', margin: '8px 0', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' },
  button: { marginTop: '18px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#0b62d6', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '16px' }
};

const Booking = ({ bookings: propBookings = [], setBookings: propSetBookings }) => {
  const today = new Date();
  
  // --- Core State ---
  const [service, setService] = useState('');
  const [services, setServices] = useState([]);
  const [bandPackages, setBandPackages] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSubmissionType, setLastSubmissionType] = useState('booking');
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  
  // --- Dynamic State based on Service ---
  const [estimatedValue, setEstimatedValue] = useState(0);
  
  // For Band Gigs / Parade Events
  const [bandPackage, setBandPackage] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  
  // For Instrument Rentals
  const [selectedInstrument, setSelectedInstrument] = useState('');
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [availableInstruments, setAvailableInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(true);

  // current logged-in user (if any)
  const [user, setUser] = useState(null);

  // For Music Arrangement
  const [numPieces, setNumPieces] = useState(1);

  // --- Calendar State ---
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // --- Derived State ---
  const rentalDays = useMemo(() => {
    if (service === 'Instrument Rentals' && rentalStartDate && rentalEndDate) {
      const start = new Date(rentalStartDate);
      const end = new Date(rentalEndDate);
      if (end < start) return 0;
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive of start and end date
      return diffDays;
    }
    return 0;
  }, [service, rentalStartDate, rentalEndDate]);

  // --- Effect for Price Calculation ---
  useEffect(() => {
    let value = 0;
    if (service === 'Band Gigs' || service === 'Parade Events') {
      const selectedPackage = bandPackages.find(pkg => pkg.package_key === bandPackage);
      value = selectedPackage?.price || bandPackagesHardcoded[bandPackage]?.price || 0;
    } else if (service === 'Instrument Rentals') {
      const selectedInst = availableInstruments.find(inst => String(inst.id) === String(selectedInstrument));
      const instrumentPrice = selectedInst?.pricePerDay || instruments[selectedInstrument]?.pricePerDay || 0;
      value = instrumentPrice * rentalDays;
    } else if (service === 'Music Arrangement') {
      value = musicArrangementBasePrice * numPieces;
    } else if (service === 'Music Workshops') {
        value = 5000; // Default value for workshops
    }
    setEstimatedValue(value);
  }, [service, bandPackage, selectedInstrument, rentalDays, numPieces, availableInstruments, bandPackages]);

  // Load services from backend and set service from URL param when applicable
  useEffect(() => {
    const loadServices = async () => {
      try {
        const resp = await mysqlService.get('/services');
        // resp is expected to be { success: true, services: [...] }
        const list = (resp && resp.services) ? resp.services.map(s => s.name) : (Array.isArray(resp) ? resp.map(s => s.name || s) : []);
        setServices(list);

        // If ?service= was provided in URL and matches a service name, preselect it
        const params = new URLSearchParams(window.location.search);
        const serviceFromUrl = params.get('service');
        if (serviceFromUrl && list.includes(serviceFromUrl)) {
          setService(serviceFromUrl);
        }
      } catch (err) {
        console.error('Failed to load services:', err);
      }
    };
    loadServices();
  }, []);

  // Load band packages from backend
  useEffect(() => {
    const loadBandPackages = async () => {
      try {
        const resp = await mysqlService.get('/band-packages');
        if (resp && resp.success && Array.isArray(resp.packages)) {
          setBandPackages(resp.packages);
        }
      } catch (err) {
        console.error('Failed to load band packages:', err);
        // Fallback to hardcoded packages
        const fallbackPackages = Object.entries(bandPackagesHardcoded).map(([key, value]) => ({
          package_key: key,
          package_name: value.label,
          price: value.price,
          is_active: true
        }));
        setBandPackages(fallbackPackages);
      }
    };
    loadBandPackages();
  }, []);

  // Load available instruments from backend
  useEffect(() => {
    const loadInstruments = async () => {
      setLoadingInstruments(true);
      try {
        console.log('Fetching instruments from:', `${API_BASE_URL}/instruments`);
        const resp = await mysqlService.get('/instruments');
        console.log('Instruments response:', resp); // Debug log
        console.log('Response type:', typeof resp, 'Is array:', Array.isArray(resp)); // Debug log
        
        // Handle different response formats
        let instrumentsList = [];
        if (resp && resp.instruments && Array.isArray(resp.instruments)) {
          instrumentsList = resp.instruments;
          console.log('Using resp.instruments, count:', instrumentsList.length);
        } else if (Array.isArray(resp)) {
          instrumentsList = resp;
          console.log('Using resp directly, count:', instrumentsList.length);
        } else {
          console.error('Unexpected response format:', resp);
        }
        
        // Filter only available instruments
        const available = instrumentsList
          .filter(inst => {
            const isArchived = inst.is_archived;
            const qty = inst.quantity || inst.availableQuantity || 0;
            console.log(`Instrument ${inst.name}: archived=${isArchived}, qty=${qty}`);
            return !isArchived && qty > 0;
          })
          .map(inst => ({
            id: inst.instrument_id || inst.id,
            name: inst.name,
            category: inst.category,
            subcategory: inst.subcategory,
            brand: inst.brand,
            quantity: inst.quantity || inst.availableQuantity || 0,
            pricePerDay: inst.price_per_day || inst.pricePerDay || 500,
            condition: inst.condition_status || inst.condition,
            status: inst.availability_status || inst.computedAvailabilityStatus
          }));
        
        console.log('Available instruments after filtering:', available); // Debug log
        console.log('Total available count:', available.length);
        setAvailableInstruments(available);
      } catch (err) {
        console.error('Failed to load instruments:', err);
        console.error('Error details:', err.message, err.stack);
      } finally {
        setLoadingInstruments(false);
      }
    };
    loadInstruments();
  }, []);

  // --- Data Fetching and State Management (largely unchanged) ---
  const [localBookings, setLocalBookings] = useState([]);

  const getStoredBookings = async () => {
    try {
      // If this is an instrument rental/borrow request, route it to the Approval queue
      if (service === 'Instrument Rentals') {
        try {
          const type = (user && user.role && user.role !== 'user') ? 'borrow' : 'rent';
          const storageKey = type === 'borrow' ? 'borrowRequests' : 'rentRequests';
          const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const selectedInst = availableInstruments.find(inst => String(inst.id) === String(selectedInstrument));
          const request = {
            id: Date.now(),
            userId: user?.id || null,
            userName: name.trim(),
            userEmail: email.trim().toLowerCase(),
            phone: phone.trim(),
            instrument: selectedInst?.name || instruments[selectedInstrument]?.label || selectedInstrument,
            instrumentId: selectedInst?.id || null,
            startDate: rentalStartDate,
            endDate: rentalEndDate,
            purpose: purpose ? purpose.trim() : null,
            notes: notes ? notes.trim() : null,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          existing.unshift(request);
          localStorage.setItem(storageKey, JSON.stringify(existing));
          // Notify approval UI
          window.dispatchEvent(new Event(`${type}RequestsUpdated`));
          setLastSubmissionType(type === 'borrow' ? 'borrow' : 'rent');
        } catch (e) {
          console.error('Failed to save instrument request to localStorage', e);
        }

        // Show success and reset form locally (do not create a booking record)
  setShowSuccess(true);
        setService('');
        setName('');
        setEmail('');
        setPhone('');
        setLocation('');
        setNotes('');
        setPurpose('');
        setBandPackage('');
        setSelectedInstrument('');
        setRentalStartDate('');
        setRentalEndDate('');
        setEventDate('');
        setEventStartTime('');
        setEventEndTime('');
        setNumPieces(1);
        setEstimatedValue(0);
        setTimeout(() => setShowSuccess(false), 5000);
        return;
      }
  const response = await fetch(`${API_BASE_URL}/bookings`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        console.log('API /api/bookings response:', data);
        if (data.success && Array.isArray(data.bookings)) {
          return data.bookings.map(b => {
            // Prefer requested/reschedule values when present so calendar shows the requested date/time
            const displayDate = b.requested_date || b.requestedDate || b.date || null;
            const dateOnly = displayDate ? String(displayDate).split('T')[0] : displayDate;
            const displayStart = b.requested_start || b.requestedStart || b.start_time || b.startTime || null;
            const displayEnd = b.requested_end || b.requestedEnd || b.end_time || b.endTime || null;
            return {
              id: b.booking_id,
              customerName: b.customer_name,
              email: b.email,
              phone: b.phone,
              service: b.service,
              date: dateOnly,
              startTime: displayStart,
              endTime: displayEnd,
              location: b.location,
              estimatedValue: parseFloat(b.estimated_value || 0),
              status: b.status,
              notes: b.notes,
              createdAt: b.created_at,
              // keep original server fields in case other UI needs them
              _raw: b
            };
          });
        }
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
    return [];
  };

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('davaoBlueEaglesUser') || 'null');
      if (stored) {
        setUser(stored);
        // Prefill name and email for logged-in users
        if (stored.firstName || stored.email) {
          setName(stored.firstName ? `${stored.firstName} ${stored.lastName || ''}`.trim() : (stored.email || ''));
          setEmail(stored.email || '');
        }
      }
    } catch (e) {
      // ignore parse errors
    }
    const loadBookings = async () => {
      const stored = await getStoredBookings();
      setLocalBookings(stored);
    };
    loadBookings();
    const handleBookingsUpdate = async () => {
      const updated = await getStoredBookings();
      setLocalBookings(updated);
    };
    window.addEventListener('bookingsUpdated', handleBookingsUpdate);
    return () => window.removeEventListener('bookingsUpdated', handleBookingsUpdate);
  }, []);

  const updateBookings = (newBookingsOrFunction) => {
    const newBookings = typeof newBookingsOrFunction === 'function' 
      ? newBookingsOrFunction(bookings) 
      : newBookingsOrFunction;

    if (propSetBookings) {
      propSetBookings(newBookings);
    } else {
      setLocalBookings(newBookings);
    }
    window.dispatchEvent(new CustomEvent('bookingsUpdated'));
  };

  const bookings = propBookings.length > 0 ? propBookings : localBookings;
  const setBookings = updateBookings;

  const isDateBlocked = (dateStr) => {
    return bookings.some(b => b.date === dateStr && b.status === 'approved');
  };

  // --- Calendar Utils ---
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstWeekday = (y, m) => new Date(y, m, 1).getDay();
  const pad2 = n => (n < 10 ? `0${n}` : `${n}`);
  const ymd = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  const getDateStatus = (dateStr) => {
    const dayBookings = bookings.filter(b => b.date === dateStr);
    if (dayBookings.some(b => b.status === 'approved')) return 'approved';
    if (dayBookings.some(b => b.status === 'pending')) return 'pending';
    return 'available';
  };

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
    if (dateStr >= todayStr && getDateStatus(dateStr) !== 'approved') {
      if (service === 'Instrument Rentals') {
        if (!rentalStartDate || rentalEndDate) {
          setRentalStartDate(dateStr);
          setRentalEndDate('');
        } else if (dateStr >= rentalStartDate) {
          setRentalEndDate(dateStr);
        } else {
          setRentalStartDate(dateStr);
        }
      } else if (service === 'Band Gigs' || service === 'Parade Events') {
        setEventDate(dateStr);
      }
    }
  };

  // --- Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    let bookingNotes = notes;
    let bookingDate = todayStr; // Default date
    let startTime = '09:00';
    let endTime = '17:00';
    let packageTypeValue = null;
    let rentalInstrumentValue = null;
    let rentalStartDateValue = null;
    let rentalEndDateValue = null;
    let numPiecesValue = null;

    if (service === 'Band Gigs' || service === 'Parade Events') {
        // Store package separately, not in notes
        packageTypeValue = bandPackage;
        bookingDate = eventDate;
        startTime = eventStartTime;
        endTime = eventEndTime;
  } else if (service === 'Instrument Rentals') {
    // Store instrument rental details separately
    rentalInstrumentValue = selectedInstrument;
    rentalStartDateValue = rentalStartDate;
    rentalEndDateValue = rentalEndDate;
    bookingDate = rentalStartDate;
    } else if (service === 'Music Arrangement') {
        // Store number of pieces separately
        numPiecesValue = numPieces;
    }

    try {
      // No pre-check for conflicts: bookings are allowed and will be marked pending by server if needed.

      // Proceed with booking creation
      const newBooking = {
        userId: null,
        customerName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        service: service,
        date: bookingDate,
        startTime,
        endTime,
        location: location.trim(),
        estimatedValue: estimatedValue,
        notes: bookingNotes.trim() || null,
        purpose: purpose ? purpose.trim() : null,
        packageType: packageTypeValue,
        rentalInstrument: rentalInstrumentValue,
        rentalStartDate: rentalStartDateValue,
        rentalEndDate: rentalEndDateValue,
        numPieces: numPiecesValue
      };

      const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBooking)
      });

      const data = await response.json();

        if (response.ok && data.success) {
        // When server returns the created booking, prefer requested fields if present
        const db = data.booking || {};
        const displayDate = db.requested_date || db.requestedDate || db.date || null;
        const dateOnly = displayDate ? String(displayDate).split('T')[0] : displayDate;
        const displayStart = db.requested_start || db.requestedStart || db.start_time || db.startTime || null;
        const displayEnd = db.requested_end || db.requestedEnd || db.end_time || db.endTime || null;
        const formattedBooking = {
          ...db,
          id: db.booking_id,
          date: dateOnly,
          startTime: displayStart,
          endTime: displayEnd
        };
        setBookings(prev => [...prev, formattedBooking]);
        setShowSuccess(true);

        // Notify admins and customer about new booking request
        try {
          NotificationService.notifyNewBooking(data.booking);
        } catch (e) {
          console.error('Notification error (new booking):', e);
        }
        
        // Reset form
        setService('');
        setName('');
        setEmail('');
        setPhone('');
        setLocation('');
  setNotes('');
  setPurpose('');
        setBandPackage('');
        setSelectedInstrument('');
        setRentalStartDate('');
        setRentalEndDate('');
        setEventDate(''); // Reset event date
        setEventStartTime(''); // Reset event start time
        setEventEndTime(''); // Reset event end time
        setNumPieces(1);
        setEstimatedValue(0);

        setTimeout(() => setShowSuccess(false), 5000);
      } else {
        alert(data.message || 'Failed to submit booking.');
      }
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert('An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = useMemo(() => {
    if (!service || !name || !email || !location) return false;
    if (service === 'Band Gigs' || service === 'Parade Events') {
      return !!bandPackage && !!eventDate && !!eventStartTime && !!eventEndTime;
    }
    if (service === 'Instrument Rentals') {
      return !!selectedInstrument && !!rentalStartDate && !!rentalEndDate && !!purpose;
    }
    if (service === 'Music Arrangement') {
      return numPieces > 0;
    }
    if (service === 'Music Workshops') {
        return true; // Or add specific validation
    }
    return false;
  }, [service, name, email, location, bandPackage, eventDate, eventStartTime, eventEndTime, selectedInstrument, rentalStartDate, rentalEndDate, numPieces]);

  const minDate = today.toISOString().split('T')[0];

  // --- Render Methods for Dynamic Fields ---

  const renderServiceSpecificFields = () => {
    switch (service) {
      case 'Band Gigs':
      case 'Parade Events':
        return (
          <>
            <div style={styles.inputGroup}>
              <label style={styles.label}><FaUsers /> Package Options <span style={styles.required}>*</span></label>
              <StyledSelect value={bandPackage} onChange={e => setBandPackage(e.target.value)} style={styles.input} required>
                <option value="">Select a package...</option>
                {bandPackages.filter(pkg => pkg.is_active).map((pkg) => (
                  <option key={pkg.package_key} value={pkg.package_key}>
                    {pkg.package_name} - {formatCurrency(parseFloat(pkg.price))}
                  </option>
                ))}
              </StyledSelect>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}><FaCalendarAlt /> Event Date <span style={styles.required}>*</span></label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={styles.input} min={minDate} required />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}><FaCalendarAlt /> Event Start Time <span style={styles.required}>*</span></label>
              <input type="time" value={eventStartTime} onChange={e => setEventStartTime(e.target.value)} style={styles.input} required />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}><FaCalendarAlt /> Event End Time <span style={styles.required}>*</span></label>
              <input type="time" value={eventEndTime} onChange={e => setEventEndTime(e.target.value)} style={styles.input} required />
            </div>
          </>
        );
        
      case 'Music Arrangement':
        return (
            <>
                <div style={styles.inputGroup}>
                    <label style={styles.label}><FaPlus /> Number of Pieces <span style={styles.required}>*</span></label>
                    <input type="number" value={numPieces} onChange={e => setNumPieces(Math.max(1, parseInt(e.target.value)))} style={styles.input} min="1" required />
                </div>
                <div style={styles.priceInfo}>
                    <FaInfoCircle />
                    <span>Base price is {formatCurrency(musicArrangementBasePrice)} per piece. Final price depends on complexity and instrumentation.</span>
                </div>
            </>
        );
      default:
        return null;
    }
  };

  const styles = {
    // global font baseline
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    baseFontSize: 16,
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #dbeafe 100%)',
      padding: '2rem 1rem',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      fontSize: '16px',
      lineHeight: 1.45,
      color: '#0f172a'
    },
    wrapper: {
      maxWidth: '1400px',
      margin: '0 auto'
    },
    // close button for top-right of the card
    closeButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      background: 'transparent',
      border: 'none',
      color: '#475569',
      cursor: 'pointer',
      padding: 8,
      borderRadius: 8,
      fontSize: 18,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem',
      padding: '0'
    },
    // heading / title
    title: {
      fontSize: '40px',
      fontWeight: 700,
      color: "#0f172a",
      /* extend underline to the full inner card width by compensating for card padding:
         formContainer has padding: '1.75rem' so we use negative horizontal margins of the same amount */
      margin: '0 -1.75rem 0 -1.75rem',
      padding: '0 1.75rem 12px 1.75rem',   // preserve visual spacing for the text
      borderBottom: "3px solid #bae6fd",
      display: "block",
      width: "auto",
      textAlign: "center",
      boxSizing: "border-box",
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
    },
    // subtitle centered under title
    subtitle: {
      color: "#475569",
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.4,
      margin: '8px auto 0',
      textAlign: 'center',
      maxWidth: '820px',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
    },
    mainContent: {
      display: 'block',
      gap: '2rem'
    },
    formContainer: {
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(6px)',
      borderRadius: '20px',
      padding: '1.75rem',
      border: '1px solid rgba(3, 105, 161, 0.08)',
      boxShadow: '0 8px 24px rgba(2, 6, 23, 0.06)',
      display: 'grid',
      gridTemplateColumns: 'minmax(420px, 1fr) 480px',
      gridTemplateRows: 'auto 1fr',
      gap: '1.25rem',
      alignItems: 'start',
      width: '100%',
      boxSizing: 'border-box'
    },
    formTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '1.25rem',
      color: '#0f172a',
      fontSize: '18px',
      fontWeight: 700,
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
    },
    formGrid: {
      display: 'grid',
      gap: '1.25rem'
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    },
    label: {
      color: '#334155',
      fontSize: '14px',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
    },
    required: {
      color: '#ef4444',
      fontSize: '13px'
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      background: 'rgba(248, 250, 252, 0.9)',
      border: '1.5px solid rgba(203, 213, 225, 0.8)',
      borderRadius: '10px',
      color: '#0f172a',
      fontSize: '15px',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      transition: 'all 0.18s ease',
      outline: 'none',
      boxSizing: 'border-box'
    },
    inputFocus: {
      borderColor: '#0369a1',
      boxShadow: '0 0 0 3px rgba(3, 105, 161, 0.08)'
    },
    textarea: {
      minHeight: '120px',
      resize: 'vertical',
      fontSize: '15px',
      padding: '12px 14px',
      borderRadius: '10px',
      border: '1.5px solid rgba(203, 213, 225, 0.8)',
      background: 'rgba(248,250,252,0.9)',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
    },
    button: {
      width: '100%',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      boxShadow: '0 8px 22px rgba(3,105,161,0.14)',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
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
      animation: 'slideIn 0.3s ease-out',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      fontSize: '15px'
    },
    
    gridTwo: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1rem'
    },
    gridThree: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem'
    },
    calendarContainer: {
      background: 'transparent',
      borderRadius: '12px',
      padding: '0.75rem',
      border: 'none',
      boxShadow: 'none',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    },
    calendarHeader: {
      marginBottom: '0.75rem',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    calendarTitle: {
      color: '#0f172a',
      fontSize: '18px',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      marginBottom: '0.5rem',
      width: '100%',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
    },
    calendarNav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      marginBottom: '0.75rem'
    },
    navButton: {
      background: 'rgba(3, 105, 161, 0.1)',
      border: '1px solid rgba(3, 105, 161, 0.2)',
      borderRadius: '8px',
      padding: '0.5rem',
      color: '#0369a1',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    monthYear: {
      color: '#334155',
      fontSize: '14px',
      fontWeight: '600',
      minWidth: '100px',
      textAlign: 'center'
    },
    calendarGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '0.35rem'
    },
    dayHeader: {
      color: '#64748b',
      fontSize: '12px',
      fontWeight: '600',
      textAlign: 'center',
      padding: '0.35rem 0.25rem'
    },
    dayCell: {
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      fontSize: '14px',
      fontWeight: 700,
      position: 'relative',
      boxSizing: 'border-box',
      padding: '6px'
    },
    dayAvailable: {
      background: 'rgba(16, 185, 129, 0.08)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.18)'
    },
    dayPending: {
      background: 'rgba(245, 158, 11, 0.08)',
      color: '#f59e0b',
      border: '1px solid rgba(245, 158, 11, 0.18)'
    },
    dayApproved: {
      background: 'rgba(239, 68, 68, 0.08)',
      color: '#ef4444',
      border: '1px solid rgba(239, 68, 68, 0.18)',
      cursor: 'not-allowed'
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
      borderRadius: '12px',
      fontSize: '13px',
      color: '#475569'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      fontSize: '13px',
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
        padding: '1.25rem',
        textAlign: 'center',
        transition: 'all 0.3s ease',
        marginTop: '1rem',
        fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
    },
    priceLabel: {
        color: '#475569',
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '0.5rem',
    },
    priceValue: {
        color: '#0369a1',
        fontSize: '24px',
        fontWeight: '800',
    },
    priceInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'rgba(248, 250, 252, 0.8)',
        padding: '0.75rem 1rem',
        borderRadius: '12px',
        fontSize: '14px',
        color: '#475569',
    },
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
          
          .calendar-day:hover:not(.day-past):not(.day-approved) {
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
        `}
      </style>

      {showSuccess && (
        <div style={styles.successMessage}>
          <FaCheckCircle />
          {lastSubmissionType === 'rent' && 'Instrument rental request submitted for approval. We will contact you soon.'}
          {lastSubmissionType === 'borrow' && 'Borrow request submitted for approval. We will contact you soon.'}
          {lastSubmissionType === 'booking' && 'Booking submitted successfully! We will contact you soon.'}
        </div>
      )}

      <div style={styles.wrapper}>
        <div className="main-content" style={styles.mainContent}>
          {/* One card contains title/subtitle, form (left) and calendar (right) */}
          <div style={styles.formContainer}>
           <button
             type="button"
             aria-label="Close and return home"
             title="Return home"
             style={styles.closeButton}
             onClick={() => { window.location.href = '/'; }}
           >
             <FaTimes />
           </button>
            {/* title/subtitle span both columns */}
            <div style={{ gridColumn: '1 / 3', marginBottom: 12 }}>
              <p style={styles.subtitle}>Schedule your music service with our professional team. Fill out the form below and we'll get back to you within 24 hours.</p>
            </div>

            {/* left column: booking details + form (row 2, col 1) */}
            <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3' }}>
              <div style={styles.formTitle}>
                <FaCalendarAlt />
                Booking Details
              </div>

              <form onSubmit={handleSubmit} style={styles.formGrid}>
                {/* Service Selection */}
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <FaMusic />
                    Service Type
                    <span style={styles.required}>*</span>
                  </label>
                  <StyledSelect
                    value={service}
                    onChange={e => setService(e.target.value)}
                    style={styles.input}
                    required
                  >
                    <option value="">Choose your service</option>
                    {services.filter(s => s !== 'Instrument Rentals').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                  </StyledSelect>
                </div>

                {/* Render fields. Band/Parade require a specific order requested by user. */}
                {service && (
                  <>
                    {(service === 'Band Gigs' || service === 'Parade Events') ? (
                      /* Order: package, full name, email, event date, event start, event end, phone, address, notes */
                      <>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}><FaUsers /> Package Options <span style={styles.required}>*</span></label>
                          <StyledSelect value={bandPackage} onChange={e => setBandPackage(e.target.value)} style={styles.input} required>
                            <option value="">Select a package...</option>
                            {bandPackages.filter(pkg => pkg.is_active).map((pkg) => (
                              <option key={pkg.package_key} value={pkg.package_key}>
                                {pkg.package_name} - {formatCurrency(parseFloat(pkg.price))}
                              </option>
                            ))}
                          </StyledSelect>
                        </div>

                        <div style={styles.gridTwo}>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaUser /> Full Name <span style={styles.required}>*</span></label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} style={styles.input} placeholder="e.g., Juan Dela Cruz" required readOnly={isUserLoggedIn} />
                          </div>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaEnvelope /> Email Address <span style={styles.required}>*</span></label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} placeholder="e.g., juan.delacruz@email.com" required readOnly={isUserLoggedIn} />
                          </div>
                        </div>

                        <div style={styles.inputGroup}>
                          <label style={styles.label}><FaCalendarAlt /> Event Date <span style={styles.required}>*</span></label>
                          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={styles.input} min={minDate} required />
                        </div>

                        <div style={styles.gridTwo}>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaCalendarAlt /> Event Start Time <span style={styles.required}>*</span></label>
                            <input type="time" value={eventStartTime} onChange={e => setEventStartTime(e.target.value)} style={styles.input} required />
                          </div>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaCalendarAlt /> Event End Time <span style={styles.required}>*</span></label>
                            <input type="time" value={eventEndTime} onChange={e => setEventEndTime(e.target.value)} style={styles.input} required />
                          </div>
                        </div>

                        <div style={styles.gridTwo}>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaPhone /> Phone Number <span style={styles.required}>*</span></label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={styles.input} placeholder="e.g., 09171234567" required readOnly={isUserLoggedIn} />
                          </div>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaMapMarkerAlt /> Address <span style={styles.required}>*</span></label>
                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} style={styles.input} placeholder="e.g., 123 Rizal St, Metro Manila" required />
                          </div>
                        </div>

                        <div style={styles.inputGroup}>
                          <label style={styles.label}><FaInfoCircle /> Notes / Special Requests</label>
                          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={styles.textarea} placeholder="e.g., specific song requests, setup details, etc." rows={4}></textarea>
                        </div>

                        {/* Price Display */}
                        {estimatedValue > 0 && (
                          <div style={styles.priceDisplay}>
                            <div style={styles.priceLabel}>Estimated Price</div>
                            <div style={styles.priceValue}>{formatCurrency(estimatedValue)}</div>
                          </div>
                        )}

                        <button type="submit" disabled={!isFormValid || isSubmitting} style={styles.button}>
                          {isSubmitting ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : <>Submit Booking Request</>}
                        </button>
                      </>
                    ) : (
                      /* Default order for other services */
                      <>
                        <div style={styles.gridTwo}>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaUser /> Full Name <span style={styles.required}>*</span></label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} style={styles.input} placeholder="e.g., Juan Dela Cruz" required readOnly={isUserLoggedIn} />
                          </div>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaEnvelope /> Email Address <span style={styles.required}>*</span></label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} placeholder="e.g., juan.delacruz@email.com" required readOnly={isUserLoggedIn} />
                          </div>
                        </div>

                        <div style={styles.gridTwo}>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaPhone /> Phone Number <span style={styles.required}>*</span></label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={styles.input} placeholder="e.g., 09171234567" required readOnly={isUserLoggedIn} />
                          </div>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}><FaMapMarkerAlt /> Address <span style={styles.required}>*</span></label>
                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} style={styles.input} placeholder="e.g., 123 Rizal St, Metro Manila" required />
                          </div>
                        </div>

                        <div style={styles.inputGroup}>
                          <label style={styles.label}><FaInfoCircle /> Notes / Special Requests</label>
                          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={styles.textarea} placeholder="e.g., specific song requests, setup details, etc." rows={4}></textarea>
                        </div>

                        {/* Service-specific fields (e.g., Music Arrangement) */}
                        {renderServiceSpecificFields()}

                        {/* Price Display */}
                        {estimatedValue > 0 && (
                          <div style={styles.priceDisplay}>
                            <div style={styles.priceLabel}>Estimated Price</div>
                            <div style={styles.priceValue}>{formatCurrency(estimatedValue)}</div>
                          </div>
                        )}

                        <button type="submit" disabled={!isFormValid || isSubmitting} style={styles.button}>
                          {isSubmitting ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : <>Submit Booking Request</>}
                        </button>
                      </>
                    )}
                  </>
                )}
              </form>
            </div>

            {/* right column: calendar (row 2, col 2) */}
            <div style={{ gridColumn: '2 / 3', gridRow: '2 / 3' }}>
              <div className="calendar-container" style={styles.calendarContainer}>
                <div style={styles.calendarHeader}>
                  <div style={styles.calendarTitle}><FaCalendarAlt size={16} /> Select Booking Dates</div>
                </div>
                <div style={styles.calendarNav}>
                  <button className="nav-button" style={styles.navButton} onClick={prevMonth} type="button"><FaChevronLeft size={12} /></button>
                  <div style={styles.monthYear}>{new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                  <button className="nav-button" style={styles.navButton} onClick={nextMonth} type="button"><FaChevronRight size={12} /></button>
                </div>
                <div style={styles.calendarGrid}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} style={styles.dayHeader}>{day}</div>
                  ))}
                  {Array.from({ length: daysInMonth(year, month) }, (_, i) => {
                    const day = i + 1;
                    const dateStr = ymd(year, month, day);
                    const status = getDateStatus(dateStr);
                    const isPast = dateStr < todayStr;
                    let isSelected = false;
                    if (service === 'Instrument Rentals') {
                      isSelected = dateStr >= rentalStartDate && dateStr <= rentalEndDate && rentalStartDate && rentalEndDate;
                    } else if (service === 'Band Gigs' || service === 'Parade Events') {
                      isSelected = dateStr === eventDate;
                    }
                    let dayStyle = { ...styles.dayCell };
                    if (isSelected) dayStyle = { ...dayStyle, ...styles.daySelected };
                    else if (isPast) dayStyle = { ...dayStyle, ...styles.dayPast };
                    else {
                      switch (status) {
                        case 'available': dayStyle = { ...dayStyle, ...styles.dayAvailable }; break;
                        case 'pending': dayStyle = { ...dayStyle, ...styles.dayPending }; break;
                        case 'approved': dayStyle = { ...dayStyle, ...styles.dayApproved }; break;
                        default: dayStyle = { ...dayStyle, ...styles.dayAvailable };
                      }
                    }
                    return (
                      <div key={day} className={`calendar-day ${isPast ? 'day-past' : ''} ${status === 'approved' ? 'day-approved' : ''}`} style={dayStyle} onClick={() => handleDateClick(dateStr)} title={isPast ? 'Past date' : status === 'approved' ? 'Booked' : status === 'pending' ? 'Pending booking' : 'Available'}>
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div style={styles.legend}>
                  <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: '#10b981' }}></div>Available</div>
                  <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: '#f59e0b' }}></div>Pending</div>
                  <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: '#ef4444' }}></div>Booked</div>
                  <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: '#64748b' }}></div>Past Date</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Booking;
