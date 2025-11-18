import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaCalendarAlt, 
  FaChevronLeft, 
  FaChevronRight, 
  FaClock,
  FaMapMarkerAlt,
  FaUser,
  FaMusic,
  FaGuitar,
  FaCompactDisc,
  FaSearch,
  FaPlus,
  FaChevronDown,
  FaSpinner,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaTimes,
  FaEllipsisV,
  FaBars,
  FaList,
  FaCalendarDay
} from 'react-icons/fa';
import mysqlService from '../services/mysqlService';

const BookingCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('calendar');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await mysqlService.get('/bookings');
      let list = [];
      if (response) {
        if (response.success && Array.isArray(response.bookings)) {
          list = response.bookings;
        } else if (Array.isArray(response)) {
          list = response;
        } else if (Array.isArray(response.bookings)) {
          list = response.bookings;
        }
      }

      const normalized = (list || []).map(b => {
        const raw = b?.date || '';
        const dateOnly = String(raw).split('T')[0];
        const customer_name = b.customer_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || b.customerName || '';
        return { ...b, date: dateOnly, customer_name };
      });

      setBookings(normalized);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const toYMD = (d) => {
    if (!d) return '';
    if (typeof d === 'string') return String(d).split('T')[0];
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const getBookingsForDate = (date) => {
    if (!date) return [];
    const dateStr = toYMD(date);
    return bookings.filter(booking => toYMD(booking.date) === dateStr);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return '#0b8043';
      case 'pending': return '#f9ab00';
      case 'upcoming': return '#1a73e8';
      case 'rejected': return '#d93025';
      default: return '#5f6368';
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const formatTime = (time) => {
    if (!time) return '';
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return String(time);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getFilteredBookings = () => {
    return bookings
      .filter(b => {
        const matchesSearch = !searchTerm || 
          b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.service?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || b.status?.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.start_time || '00:00'}`);
        const dateB = new Date(`${b.date}T${b.start_time || '00:00'}`);
        return dateB - dateA; // Most recent first
      });
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      minHeight: '100vh',
      background: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      boxSizing: 'border-box'
    },
    mainWrapper: {
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(60,64,67,0.3)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      flex: 1
    },
    header: {
      height: '64px',
      borderBottom: '1px solid #dadce0',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '24px',
      background: '#fff',
      position: 'sticky',
      top: 0,
      zIndex: 100
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '25px',
      fontWeight: '700',
      color: '#0f172a',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    searchBar: {
      flex: 1,
      maxWidth: '720px',
      position: 'relative'
    },
    searchInput: {
      width: '100%',
      padding: '10px 48px 10px 16px',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
      background: '#f1f3f4',
      outline: 'none',
      transition: 'all 0.2s'
    },
    searchIcon: {
      position: 'absolute',
      right: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#5f6368'
    },
    viewToggle: {
      display: 'flex',
      gap: '0', // Changed from '8px' to '0'
      marginLeft: 'auto',
      border: '1px solid #dadce0',
      borderRadius: '8px', // Added border radius to container
      overflow: 'hidden' // Added to ensure proper border radius
    },
    viewButton: {
      background: 'transparent',
      border: 'none', // Changed from '1px solid #dadce0'
      borderRight: '1px solid #dadce0', // Add divider between buttons
      padding: '8px 12px',
      borderRadius: '0', // Changed from '4px'
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: '#3c4043',
      transition: 'all 0.2s'
    },
    mainContent: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden'
    },
    sidebar: {
      width: showSidebar ? '256px' : '0',
      borderRight: showSidebar ? '1px solid #dadce0' : 'none',
      padding: showSidebar ? '8px' : '0',
      overflow: 'hidden',
      transition: 'all 0.2s',
      background: '#fff'
    },
    createButton: {
      background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
      border: 'none',
      color: 'white',
      borderRadius: '24px',
      padding: '12px 24px',
      fontSize: '18px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      marginBottom: '16px',
      width: '100%',
      boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      letterSpacing: '0.01em',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    },
    miniCalendar: {
      padding: '8px',
      marginBottom: '16px'
    },
    calendarHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px',
      padding: '8px 4px'
    },
    navButton: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#3c4043',
      transition: 'background 0.2s'
    },
    monthYear: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#3c4043'
    },
    weekDays: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '2px',
      marginBottom: '4px'
    },
    weekDay: {
      fontSize: '13px',
      color: '#70757a',
      textAlign: 'center',
      padding: '6px',
      fontWeight: '600'
    },
    miniCalendarGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '2px'
    },
    miniCalendarDay: {
      aspectRatio: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      cursor: 'pointer',
      borderRadius: '50%',
      color: '#3c4043',
      position: 'relative',
      transition: 'background 0.2s',
      fontWeight: '500'
    },
    calendarContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    calendarToolbar: {
      height: '60px',
      borderBottom: '1px solid #dadce0',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '16px',
      background: '#fff'
    },
    todayButton: {
      background: 'transparent',
      border: '1px solid #dadce0',
      borderRadius: '4px',
      padding: '8px 16px',
      fontSize: '14px',
      color: '#3c4043',
      cursor: 'pointer',
      fontWeight: '500',
      transition: 'all 0.2s'
    },
    calendarGrid: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gridTemplateRows: 'auto repeat(6, 1fr)',
      border: '1px solid #dadce0',
      borderTop: 'none',
      overflow: 'auto'
    },
    calendarHeaderCell: {
      borderBottom: '1px solid #dadce0',
      borderRight: '1px solid #dadce0',
      padding: '10px',
      fontSize: '14px',
      fontWeight: '600',
      textAlign: 'center',
      textTransform: 'uppercase',
      background: '#fff',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      letterSpacing: '0.5px',
      minWidth: '80px',
      maxWidth: '180px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    calendarDay: {
      borderRight: '1px solid #dadce0',
      borderBottom: '1px solid #dadce0',
      padding: '4px',
      background: '#fff',
      position: 'relative',
      minHeight: '120px',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    dayNumber: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#3c4043',
      padding: '4px 8px',
      width: 'fit-content',
      margin: '2px'
    },
    eventItem: {
      fontSize: '13px',
      padding: '4px 8px',
      marginBottom: '2px',
      borderRadius: '4px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontWeight: '500'
    },
    moreEvents: {
      fontSize: '12px',
      color: '#5f6368',
      padding: '4px 8px',
      cursor: 'pointer',
      fontWeight: '600'
    },
    timelineContainer: {
      flex: 1,
      overflowY: 'auto',
      padding: '24px',
      background: '#f8f9fa'
    },
    timelineList: {
      maxWidth: '1200px',
      margin: '0 auto'
    },
    timelineItem: {
      background: '#fff',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid #dadce0',
      boxShadow: '0 1px 2px rgba(60,64,67,0.1)',
      transition: 'all 0.2s',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden'
    },
    timelineDate: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#5f6368',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    timelineContent: {
      display: 'flex',
      gap: '16px',
      alignItems: 'flex-start'
    },
    timelineIcon: {
      width: '48px',
      height: '48px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      flexShrink: 0
    },
    timelineDetails: {
      flex: 1
    },
    timelineTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#3c4043',
      marginBottom: '8px'
    },
    timelineInfo: {
      fontSize: '14px',
      color: '#5f6368',
      marginBottom: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    timelineStatus: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#fff',
      marginTop: '8px'
    },
    timelineBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '4px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.mainWrapper}>
        {/* Header */}
        <div style={styles.header}>
          <button 
            style={styles.navButton}
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <FaBars size={20} />
          </button>
          <div style={styles.logo}>
            <span>Calendar</span>
          </div>
          <div style={styles.searchBar}>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search for bookings"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={(e) => {
                e.target.style.background = '#fff';
                e.target.style.boxShadow = '0 1px 6px rgba(32,33,36,0.28)';
              }}
              onBlur={(e) => {
                e.target.style.background = '#f1f3f4';
                e.target.style.boxShadow = 'none';
              }}
            />
            <FaSearch style={styles.searchIcon} size={16} />
          </div>
          <div style={styles.viewToggle}>
            <button
              style={{
                ...styles.viewButton,
                background: viewMode === 'calendar' ? '#e8f0fe' : 'transparent',
                color: viewMode === 'calendar' ? '#1a73e8' : '#3c4043',
                borderRadius: '7px 0 0 7px' // Left button rounded on left side
              }}
              onClick={() => setViewMode('calendar')}
              onMouseEnter={(e) => {
                if (viewMode !== 'calendar') e.currentTarget.style.background = '#f1f3f4';
              }}
              onMouseLeave={(e) => {
                if (viewMode !== 'calendar') e.currentTarget.style.background = 'transparent';
              }}
            >
              <FaCalendarDay size={16} />
              Calendar
            </button>
            <button
              style={{
                ...styles.viewButton,
                background: viewMode === 'timeline' ? '#e8f0fe' : 'transparent',
                color: viewMode === 'timeline' ? '#1a73e8' : '#3c4043',
                borderRight: 'none', // Remove border on last button
                borderRadius: '0 7px 7px 0' // Right button rounded on right side
              }}
              onClick={() => setViewMode('timeline')}
              onMouseEnter={(e) => {
                if (viewMode !== 'timeline') e.currentTarget.style.background = '#f1f3f4';
              }}
              onMouseLeave={(e) => {
                if (viewMode !== 'timeline') e.currentTarget.style.background = 'transparent';
              }}
            >
              <FaList size={16} />
              Timeline
            </button>
          </div>
        </div>

        <div style={styles.mainContent}>
          {/* Sidebar */}
          <div style={styles.sidebar}>
            {/* Create button removed */}
            {/* Mini Calendar */}
            <div style={styles.miniCalendar}>
              <div style={styles.calendarHeader}>
                <button 
                  style={styles.navButton}
                  onClick={prevMonth}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <FaChevronLeft size={14} />
                </button>
                <span style={styles.monthYear}>{monthName}</span>
                <button 
                  style={styles.navButton}
                  onClick={nextMonth}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <FaChevronRight size={14} />
                </button>
              </div>

              <div style={styles.weekDays}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} style={styles.weekDay}>{day}</div>
                ))}
              </div>

              <div style={styles.miniCalendarGrid}>
                {days.map((date, idx) => {
                  if (!date) return <div key={`empty-${idx}`} />;
                  const isToday = new Date().toDateString() === date.toDateString();
                  const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                  const hasBookings = getBookingsForDate(date).length > 0;
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        ...styles.miniCalendarDay,
                        background: isSelected ? '#1a73e8' : isToday ? '#e8f0fe' : 'transparent',
                        color: isSelected ? '#fff' : isToday ? '#1a73e8' : '#3c4043',
                        fontWeight: isToday || isSelected ? '700' : '500'
                      }}
                      onClick={() => setSelectedDate(date)}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f1f3f4';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = isToday ? '#e8f0fe' : 'transparent';
                      }}
                    >
                      {date.getDate()}
                      {hasBookings && (
                        <div style={{
                          position: 'absolute',
                          bottom: '2px',
                          width: '4px',
                          height: '4px',
                          background: isSelected ? '#fff' : '#1a73e8',
                          borderRadius: '50%'
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filter Section */}
            <div style={{ padding: '8px', borderTop: '1px solid #dadce0' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#3c4043', marginBottom: '8px' }}>
                My calendars
              </div>
              {['All', 'Approved', 'Pending', 'Upcoming', 'Rejected'].map(status => {
                const count = status === 'All' 
                  ? bookings.length 
                  : bookings.filter(b => b.status?.toLowerCase() === status.toLowerCase()).length;
                
                return (
                  <div
                    key={status}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      color: '#3c4043',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: statusFilter === status.toLowerCase() || (statusFilter === 'all' && status === 'All') ? '#e8f0fe' : 'transparent'
                    }}
                    onClick={() => setStatusFilter(status === 'All' ? 'all' : status.toLowerCase())}
                    onMouseEnter={(e) => {
                      if (statusFilter !== status.toLowerCase() && !(statusFilter === 'all' && status === 'All')) {
                        e.currentTarget.style.background = '#f1f3f4';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (statusFilter !== status.toLowerCase() && !(statusFilter === 'all' && status === 'All')) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      background: status === 'All' ? '#3c4043' : getStatusColor(status)
                    }} />
                    <span style={{ flex: 1 }}>{status}</span>
                    <span style={{ fontSize: '12px', color: '#5f6368' }}>({count})</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content - Calendar or Timeline */}
          {viewMode === 'calendar' ? (
            <div style={styles.calendarContainer}>
              <div style={styles.calendarToolbar}>
                <button 
                  style={styles.todayButton}
                  onClick={goToToday}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Today
                </button>
                <button 
                  style={styles.navButton}
                  onClick={prevMonth}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <FaChevronLeft size={16} />
                </button>
                <button 
                  style={styles.navButton}
                  onClick={nextMonth}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <FaChevronRight size={16} />
                </button>
                <h2 style={{ fontSize: '22px', fontWeight: '400', color: '#3c4043', margin: 0 }}>
                  {monthName}
                </h2>
              </div>

              {/* Calendar Grid */}
              <div style={styles.calendarGrid}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                  <div 
                    key={day} 
                    style={{
                      ...styles.calendarHeaderCell,
                      backgroundColor: i === 0 || i === 6 ? '#ef4444' : '#3b82f6', // Red background for weekends, blue for weekdays
                      color: '#ffffff', // White text color for all days
                      borderRight: i === 6 ? 'none' : '1px solid #dadce0'
                    }}
                  >
                    {day}
                  </div>
                ))}
                
                {days.map((date, idx) => {
                  if (!date) return (
                    <div 
                      key={`empty-${idx}`} 
                      style={{
                        ...styles.calendarDay,
                        background: '#fff', // Changed from '#f8f9fa' to '#fff'
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #dadce0'
                      }} 
                    />
                  );
                  
                  const dayBookings = getBookingsForDate(date)
                    .filter(b => {
                      const matchesSearch = !searchTerm || 
                        b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        b.service?.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesStatus = statusFilter === 'all' || b.status?.toLowerCase() === statusFilter.toLowerCase();
                      return matchesSearch && matchesStatus;
                    });
                  
                  const isToday = new Date().toDateString() === date.toDateString();
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        ...styles.calendarDay,
                        background: isWeekend ? '#fafafa' : '#fff',
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #dadce0'
                      }}
                      onClick={() => setSelectedDate(date)}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isWeekend ? '#fafafa' : '#fff'}
                    >
                      <div 
                        style={{
                          ...styles.dayNumber,
                          background: isToday ? '#1a73e8' : 'transparent',
                          color: isToday ? '#fff' : '#3c4043',
                          borderRadius: isToday ? '50%' : '0',
                          width: isToday ? '28px' : 'auto',
                          height: isToday ? '28px' : 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: isToday ? '600' : '500'
                        }}
                      >
                        {date.getDate()}
                      </div>
                      
                      {dayBookings.slice(0, 3).map((booking, i) => (
                        <div
                          key={i}
                          style={{
                            ...styles.eventItem,
                            background: getStatusColor(booking.status),
                            color: '#fff',
                            borderLeft: `3px solid ${getStatusColor(booking.status)}`
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                            e.currentTarget.style.transform = 'translateX(2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
                          <FaClock size={11} />
                          <span>{formatTime(booking.start_time)}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {booking.service}
                          </span>
                        </div>
                      ))}
                      
                      {dayBookings.length > 3 && (
                        <div 
                          style={styles.moreEvents}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#1a73e8'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#5f6368'}
                        >
                          +{dayBookings.length - 3} more
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Timeline View */
            <div style={styles.timelineContainer}>
              <div style={styles.timelineList}>
                {getFilteredBookings().length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#5f6368'
                  }}>
                    <FaCalendarAlt size={64} color="#dadce0" style={{ marginBottom: '20px' }} />
                    <h3 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '8px' }}>No bookings found</h3>
                    <p style={{ fontSize: '14px' }}>Try adjusting your filters or search terms</p>
                  </div>
                ) : (
                  getFilteredBookings().map((booking, idx) => (
                    <div
                      key={idx}
                      style={styles.timelineItem}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(60,64,67,0.2)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{
                        ...styles.timelineBar,
                        background: getStatusColor(booking.status)
                      }} />
                      
                      <div style={styles.timelineDate}>
                        <FaCalendarAlt size={14} />
                        {formatDate(booking.date)}
                      </div>
                      
                      <div style={styles.timelineContent}>
                        <div style={{
                          ...styles.timelineIcon,
                          background: `${getStatusColor(booking.status)}20`,
                          color: getStatusColor(booking.status)
                        }}>
                          <FaMusic />
                        </div>
                        
                        <div style={styles.timelineDetails}>
                          <div style={styles.timelineTitle}>
                            {booking.service}
                          </div>
                          
                          <div style={styles.timelineInfo}>
                            <FaUser size={12} />
                            {booking.customer_name}
                          </div>
                          
                          <div style={styles.timelineInfo}>
                            <FaClock size={12} />
                            {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                          </div>
                          
                          {booking.location && (
                            <div style={styles.timelineInfo}>
                              <FaMapMarkerAlt size={12} />
                              {booking.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingCalendar;