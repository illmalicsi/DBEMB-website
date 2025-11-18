import React, { useState, Suspense } from 'react';
import { FaHome, FaBell, FaBoxOpen, FaBoxes, FaTools, FaUsers, FaClipboardList, FaChartLine, FaUser, FaQuestionCircle, FaBars, FaSignOutAlt, FaChevronLeft, FaChevronRight, FaSearch, FaCog, FaCheckCircle, FaDollarSign, FaHistory, FaUserCircle, FaLock, FaClipboard, FaMusic, FaMapMarkerAlt, FaCrown, FaUserPlus, FaTimes, FaCalendarAlt, FaClock, FaConciergeBell, FaInfoCircle } from '../icons/fa';
import AuthService from '../services/authService';

// Import components
const UserManagement = React.lazy(() => import('./usermanagement'));
const InstrumentItemsManager = React.lazy(() => import('./InstrumentItemsManager'));
// MaintenanceManager removed
const CustomerManagement = React.lazy(() => import('./CustomerManagement'));
const Invoice = React.lazy(() => import('./Invoice'));
const TransactionHistory = React.lazy(() => import('./TransactionHistory'));
const Approval = React.lazy(() => import('./Approval'));
const MembershipApproval = React.lazy(() => import('./MembershipApproval'));
const InventoryReport = React.lazy(() => import('./InventoryReport'));
const SalesReport = React.lazy(() => import('./SalesReport'));
const PendingBookings = React.lazy(() => import('./PendingBookings'));
const ServiceManagement = React.lazy(() => import('./ServiceManagement'));
const BookingCalendar = React.lazy(() => import('./BookingCalendar'));
import Payment from './Payment';
import NotificationService from '../services/notificationService';
import { formatCurrency } from '../utils/formatters';
import RequestQueue from '../services/requestQueue';

const Dashboard = ({ user, onBackToHome, onLogout }) => {
  const [currentView, setCurrentView] = useState('main');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [myInstrumentRequests, setMyInstrumentRequests] = useState([]);
  const [userNotifications, setUserNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalEquipments, setTotalEquipments] = useState(0);
  const [activeCustomersCount, setActiveCustomersCount] = useState(0);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState(0);
  const [instrumentPriceMap, setInstrumentPriceMap] = useState({});
  const [viewRequest, setViewRequest] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], bookings: [], instruments: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = React.useRef(null);

  // Add loading spinner animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* spinner animation */
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      /* global font */
      body, html, #root, input, textarea, select, button {
        font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Load user's instrument requests
  React.useEffect(() => {
    const loadMyRequests = async () => {
      try {
        const response = await AuthService.makeAuthenticatedRequest(
          'http://localhost:5000/api/instruments/my-requests'
        );
        const data = await response.json();
        
        if (data.success) {
          // Merge server-side requests with any queued in-memory requests so the user
          // sees their pending submissions immediately while they await sync.
          const serverRequests = data.allRequests || [];
          try {
            const queued = RequestQueue.getQueue();
            const userQueued = queued
              .map(q => q.meta)
              .filter(m => m && m.userId === user?.id)
              .map(m => ({
                // normalize shape similar to server rows
                ...m,
                type: m.rentalFee !== undefined || m.rental_fee !== undefined ? 'rent' : 'borrow',
                request_date: m.createdAt || new Date().toISOString(),
                status: m.status || 'pending'
              }));

            const merged = [...userQueued, ...serverRequests].sort((a, b) => new Date(b.request_date || b.createdAt) - new Date(a.request_date || a.createdAt));
            setMyInstrumentRequests(merged);
          } catch (err) {
            // if queue inspection fails, fall back to server list
            setMyInstrumentRequests(serverRequests);
          }
        } else {
          // Fallback to localStorage if API fails
          const borrowRequests = JSON.parse(localStorage.getItem('borrowRequests') || '[]');
          const rentRequests = JSON.parse(localStorage.getItem('rentRequests') || '[]');
          
          let myRequests = [
            ...borrowRequests.filter(req => req.userId === user?.id).map(req => ({ ...req, type: 'borrow' })),
            ...rentRequests.filter(req => req.userId === user?.id).map(req => ({ ...req, type: 'rent' }))
          ].sort((a, b) => new Date(b.requestDate || b.request_date) - new Date(a.requestDate || a.request_date));

          // Also include any queued in-memory requests for this user
          try {
            const queued = RequestQueue.getQueue();
            const userQueued = queued
              .map(q => q.meta)
              .filter(m => m && m.userId === user?.id)
              .map(m => ({
                ...m,
                type: m.rentalFee !== undefined || m.rental_fee !== undefined ? 'rent' : 'borrow',
                request_date: m.createdAt || new Date().toISOString(),
                status: m.status || 'pending'
              }));
            myRequests = [...userQueued, ...myRequests].sort((a, b) => new Date(b.request_date || b.createdAt) - new Date(a.request_date || a.createdAt));
          } catch (e) {
            // ignore queue errors and keep myRequests as-is
          }

          setMyInstrumentRequests(myRequests);
        }
      } catch (error) {
        console.error('Error loading requests:', error);
        // Fallback to localStorage
        const borrowRequests = JSON.parse(localStorage.getItem('borrowRequests') || '[]');
        const rentRequests = JSON.parse(localStorage.getItem('rentRequests') || '[]');
        
        let myRequests = [
          ...borrowRequests.filter(req => req.userId === user?.id).map(req => ({ ...req, type: 'borrow' })),
          ...rentRequests.filter(req => req.userId === user?.id).map(req => ({ ...req, type: 'rent' }))
        ].sort((a, b) => new Date(b.requestDate || b.request_date) - new Date(a.requestDate || a.request_date));

        try {
          const queued = RequestQueue.getQueue();
          const userQueued = queued
            .map(q => q.meta)
            .filter(m => m && m.userId === user?.id)
            .map(m => ({
              ...m,
              type: m.rentalFee !== undefined || m.rental_fee !== undefined ? 'rent' : 'borrow',
              request_date: m.createdAt || new Date().toISOString(),
              status: m.status || 'pending'
            }));
          myRequests = [...userQueued, ...myRequests].sort((a, b) => new Date(b.request_date || b.createdAt) - new Date(a.request_date || a.createdAt));
        } catch (e) {}

        setMyInstrumentRequests(myRequests);
      }
    };

    if (user) {
      loadMyRequests();
    }

    // Listen for updates
    const handleBorrowUpdate = () => loadMyRequests();
    const handleRentUpdate = () => loadMyRequests();
    
    window.addEventListener('borrowRequestsUpdated', handleBorrowUpdate);
    window.addEventListener('rentRequestsUpdated', handleRentUpdate);
    
    return () => {
      window.removeEventListener('borrowRequestsUpdated', handleBorrowUpdate);
      window.removeEventListener('rentRequestsUpdated', handleRentUpdate);
    };
  }, [user]);

  // Load instrument prices to enrich request cards (so fee/day can be shown even if rent_requests.row has no rental_fee)
  React.useEffect(() => {
    let mounted = true;
    const loadPrices = async () => {
      try {
        const res = await fetch((process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000') + '/api/instruments', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.instruments) ? data.instruments : (Array.isArray(data) ? data : []);
        const map = {};
        for (const i of list) {
          const id = i.instrument_id || i.id;
          if (id) map[id] = i.price_per_day ?? i.pricePerDay ?? null;
        }
        if (mounted) setInstrumentPriceMap(map);
      } catch (e) {
        console.warn('Dashboard: failed to load instrument prices', e && e.message);
      }
    };
    loadPrices();
    return () => { mounted = false; };
  }, []);

  // Ensure admin notifications target the logged-in admin's email
  React.useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'member')) {
      NotificationService.setAdminRecipients([user.email]);
    }
  }, [user]);

  // Perform a lightweight global search by fetching lists and filtering locally
  async function performGlobalSearch(q) {
    try {
      const term = String(q).toLowerCase();
      // Fetch small sets in parallel
      const base = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const [usersResp, bookingsResp, instrResp] = await Promise.all([
        fetch(base + '/api/users'),
        fetch(base + '/api/bookings'),
        fetch(base + '/api/instruments')
      ]);

      const usersJson = usersResp.ok ? await usersResp.json() : null;
      const bookingsJson = bookingsResp.ok ? await bookingsResp.json() : null;
      const instrJson = instrResp.ok ? await instrResp.json() : null;

      const usersList = Array.isArray(usersJson?.users) ? usersJson.users : (Array.isArray(usersJson) ? usersJson : []);
      const bookingsList = Array.isArray(bookingsJson?.bookings) ? bookingsJson.bookings : (Array.isArray(bookingsJson) ? bookingsJson : []);
      const instrList = Array.isArray(instrJson?.instruments) ? instrJson.instruments : (Array.isArray(instrJson) ? instrJson : []);

      const usersMatches = usersList.filter(u => {
        const hay = `${u.first_name||u.name||''} ${u.last_name||''} ${u.email||''} ${u.phone||''}`.toLowerCase();
        return hay.indexOf(term) !== -1;
      }).slice(0,6);

      const bookingsMatches = bookingsList.filter(b => {
        const hay = `${b.customer_name||b.name||''} ${b.email||''} ${b.service||''} ${b.location||''} ${b.date||''}`.toLowerCase();
        return hay.indexOf(term) !== -1;
      }).slice(0,6);

      const instrMatches = instrList.filter(i => {
        const hay = `${i.name||i.title||''} ${i.description||''} ${i.category||''}`.toLowerCase();
        return hay.indexOf(term) !== -1;
      }).slice(0,6);

      setSearchResults({ users: usersMatches, bookings: bookingsMatches, instruments: instrMatches });
    } catch (e) {
      console.warn('Global search failed', e && e.message);
      setSearchResults({ users: [], bookings: [], instruments: [] });
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearchSelect(type, payload) {
    // Dispatch a global event so specific pages can react (and navigate to the view)
    window.dispatchEvent(new CustomEvent('globalSearch:selected', { detail: { type, payload } }));
    // Navigate to an appropriate view
    if (type === 'user') setCurrentView('user-management');
    if (type === 'booking') setCurrentView('upcoming-schedule');
    if (type === 'instrument') setCurrentView('instrument-items');
    // clear search
    setSearchTerm('');
    setSearchResults({ users: [], bookings: [], instruments: [] });
  }

  // Load user notifications
  React.useEffect(() => {
    const loadNotifications = async () => {
      if (user && user.email) {
        try {
          const notifications = await NotificationService.getUserNotifications(user.email);
          const arr = Array.isArray(notifications) ? notifications : (notifications && notifications.notifications) ? notifications.notifications : [];
          setUserNotifications(arr);
          const unread = arr.filter(n => !n.read).length;
          setUnreadCount(unread);
        } catch (err) {
          console.error('Dashboard: Failed to load notifications:', err);
          setUserNotifications([]);
          setUnreadCount(0);
        }
      }
    };

    loadNotifications();

    // Listen for notification updates
    const handleNotificationsUpdate = () => loadNotifications();
    window.addEventListener('notificationsUpdated', handleNotificationsUpdate);

    // Poll for updates every 10 seconds
    const interval = setInterval(() => loadNotifications(), 10000);

    return () => {
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
      clearInterval(interval);
    };
  }, [user]);

  // Load dashboard counts (equipments, active customers, upcoming events)
  React.useEffect(() => {
    let mounted = true;

    const loadCounts = async () => {
      try {
        // Total equipments: sum of quantity from /api/instruments
        try {
          const res = await fetch((process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000') + '/api/instruments');
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data.instruments) ? data.instruments : (Array.isArray(data) ? data : []);
            const total = list.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
            if (mounted) setTotalEquipments(total);
          }
        } catch (e) {
          console.warn('Dashboard: failed to load instruments for count', e && e.message);
        }

        // Active customers: count users where isActive is true (requires auth)
        try {
          const usersResp = await AuthService.get('/users');
          if (usersResp && Array.isArray(usersResp.users)) {
            const active = usersResp.users.filter(u => u.isActive || u.is_active || false).length;
            if (mounted) setActiveCustomersCount(active);
          }
        } catch (e) {
          console.warn('Dashboard: failed to load users for count', e && e.message);
        }

        // Upcoming events: fetch bookings and count future-dated bookings
        try {
          const bRes = await fetch((process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000') + '/api/bookings');
          if (bRes.ok) {
            const bData = await bRes.json();
            const bookings = Array.isArray(bData.bookings) ? bData.bookings : [];
            const today = new Date();
            const upcoming = bookings.filter(b => {
              if (!b.date) return false;
              const d = new Date(String(b.date));
              // If date string contains only YYYY-MM-DD, new Date treats as UTC — compare using date-only
              return d >= new Date(today.toISOString().split('T')[0]);
            }).length;
            if (mounted) setUpcomingEventsCount(upcoming);
          }
        } catch (e) {
          console.warn('Dashboard: failed to load bookings for upcoming events', e && e.message);
        }
      } catch (err) {
        console.error('Dashboard: failed to load counts', err);
      }
    };

    loadCounts();

    const events = ['instrumentsUpdated', 'bookingsUpdated', 'notificationsUpdated', 'rentRequestsUpdated', 'borrowRequestsUpdated'];
    const handler = () => loadCounts();
    events.forEach(ev => window.addEventListener(ev, handler));

    return () => {
      mounted = false;
      events.forEach(ev => window.removeEventListener(ev, handler));
    };
  }, [user]);

  const navigationGroups = [
    {
      title: 'Main',
      items: [
  { id: 'main', icon: <FaHome size={14} color="currentColor" />, text: 'Dashboard', view: 'main', adminOnly: false },
  { id: 'notifications', icon: <FaBell size={14} color="currentColor" />, text: 'Notifications', view: 'notifications', adminOnly: false }
      ]
    },
    {
      title: 'Management',
      items: [
  { id: 'approval', icon: <FaCheckCircle size={14} color="currentColor" />, text: 'Approval', view: 'approval', adminOnly: false },
  { id: 'instrument-items', icon: <FaBoxes size={14} color="currentColor" />, text: 'Instrument Management', view: 'instrument-items', adminOnly: true },
  { id: 'inventory-report', icon: <FaClipboardList size={14} color="currentColor" />, text: 'Instrument Report', view: 'inventory-report', adminOnly: false },
  { id: 'customers', icon: <FaUsers size={14} color="currentColor" />, text: 'Customers', view: 'customer-management', adminOnly: false },
  { id: 'booking-calendar', icon: <FaCalendarAlt size={14} color="currentColor" />, text: 'Booking Calendar', view: 'booking-calendar', adminOnly: false },
  { id: 'upcoming-schedule', icon: <FaHistory size={14} color="currentColor" />, text: 'Pending Bookings', view: 'upcoming-schedule', adminOnly: false },
  { id: 'sales-report', icon: <FaChartLine size={14} color="currentColor" />, text: 'Sales Report', view: 'sales-report', adminOnly: true }
      ]
    },
    {
      title: 'Administration',
      items: [
  { id: 'users', icon: <FaUsers size={14} color="currentColor" />, text: 'Users', view: 'user-management', adminOnly: true },
  { id: 'services', icon: <FaConciergeBell size={14} color="currentColor" />, text: 'Services & Rates', view: 'service-management', adminOnly: true },
  { id: 'membership', icon: <FaUserPlus size={14} color="currentColor" />, text: 'Membership Approval', view: 'membership-approval', adminOnly: true }
      ]
    },
    {
      title: 'Finance',
      items: [
        // Removed My Invoices from sidebar
  { id: 'invoice', icon: <FaClipboardList size={14} color="currentColor" />, text: 'Invoice', view: 'invoice', adminOnly: true },
  { id: 'payment', icon: <FaDollarSign size={14} color="currentColor" />, text: 'Process Payments', view: 'payment', adminOnly: true },
  { id: 'transactions', icon: <FaHistory size={14} color="currentColor" />, text: 'Transactions', view: 'transactions', adminOnly: false }
      ]
    }
  ];

  const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f8fafc',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    sidebar: {
      width: sidebarCollapsed ? '80px' : '280px',
      backgroundColor: '#ffffff',
      width: sidebarCollapsed ? '80px' : '280px',
      backgroundColor: '#f8fafc',
       borderRight: '1px solid #e2e8f0',
       transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
       position: 'relative',
       display: 'flex',
       flexDirection: 'column',
       zIndex: 1000,
       flexShrink: 0,
       boxShadow: '2px 0 8px rgba(0, 0, 0, 0.04)'
     },
    sidebarHeader: {
      height: '70px',
      padding: sidebarCollapsed ? '0 20px' : '0 24px',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#ffffff',
      flexShrink: 0
    },
    logo: {
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: sidebarCollapsed ? '0px' : '20px',
      fontWeight: '700',
      color: '#0f172a',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      letterSpacing: '-0.5px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    logoIcon: {
      fontSize: '24px',
      minWidth: '24px'
    },
    collapseButton: {
      width: '36px',
      height: '36px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      color: '#64748b',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      fontSize: '14px'
    },
    userSection: {
      padding: sidebarCollapsed ? '20px 16px' : '0 24px',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      backgroundColor: '#fafbfc'
    },
    userAvatar: {
      width: sidebarCollapsed ? '40px' : '56px',
      height: sidebarCollapsed ? '40px' : '56px',
      borderRadius: '50px',
      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: '600',
      fontSize: sidebarCollapsed ? '16px' : '20px',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
      flexShrink: 0
    },
    userName: {
      fontSize: sidebarCollapsed ? '0px' : '15px',
      fontWeight: '600',
      color: '#0f172a',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      height: sidebarCollapsed ? '0px' : 'auto',
      lineHeight: '1.4'
    },
    userEmail: {
      fontSize: sidebarCollapsed ? '0px' : '13px',
      color: '#64748b',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      height: sidebarCollapsed ? '0px' : 'auto',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      maxWidth: '100%'
    },
    userRole: {
      display: sidebarCollapsed ? 'none' : 'inline-flex',
      padding: '4px 12px',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: '600',
      background: user?.role === 'admin' 
        ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' 
        : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      color: 'white',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      border: 'none',
      boxShadow: user?.role === 'admin'
        ? '0 2px 8px rgba(139, 92, 246, 0.3)'
        : '0 2px 8px rgba(59, 130, 246, 0.3)'
    },
    navigation: {
      flex: 1,
      padding: '16px 0',
      overflowY: 'auto',
      overflowX: 'hidden'
    },
    navGroup: {
      marginBottom: '28px'
    },
    navGroupTitle: {
      fontSize: sidebarCollapsed ? '0px' : '15px',
      fontWeight: '700',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      marginBottom: '8px',
      padding: sidebarCollapsed ? '0' : '0 24px',
      transition: 'all 0.3s ease',
      overflow: 'hidden'
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      height: '44px',
      padding: sidebarCollapsed ? '0' : '0 24px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      color: '#64748b',
      position: 'relative',
      margin: sidebarCollapsed ? '4px 16px' : '2px 12px',
      borderRadius: '10px',
      fontWeight: '500',
      fontSize: '14px',
      justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
    },
    navItemActive: {
      backgroundColor: '#eff6ff',
      color: '#2563eb',
      fontWeight: '600',
      boxShadow: '0 1px 3px rgba(37, 99, 235, 0.1)'
    },
    navIcon: {
      width: '18px',
      height: '18px',
      marginRight: sidebarCollapsed ? '0' : '12px',
      fontSize: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'margin-right 0.3s ease',
      color: 'inherit',
      flexShrink: 0
    },
    navText: {
      fontSize: sidebarCollapsed ? '0px' : '14px',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      whiteSpace: 'nowrap'
    },
    sidebarFooter: {
      padding: sidebarCollapsed ? '16px 16px' : '16px 12px',
      borderTop: '1px solid #f1f5f9',
      display: 'flex',
      flexDirection: sidebarCollapsed ? 'column' : 'row',
      gap: '8px',
      backgroundColor: '#ffffff',
      flexShrink: 0
    },
    footerButton: {
      height: '40px',
      width: sidebarCollapsed ? '40px' : 'auto',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      color: '#64748b',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: sidebarCollapsed ? 'none' : 1,
      gap: '6px'
    },
    logoutButton: {
      height: '40px',
      width: sidebarCollapsed ? '40px' : 'auto',
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '10px',
      color: '#dc2626',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: sidebarCollapsed ? 'none' : 1,
      gap: '6px'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f8fafc',
      overflow: 'hidden'
    },
    mainHeader: {
      minHeight: '70px',
      padding: '0 32px',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#ffffff',
      flexShrink: 0,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
    },
    headerLeft: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },
    mainTitle: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#0f172a',
      margin: 0,
      letterSpacing: '-0.5px'
    },
    breadcrumbs: {
      fontSize: '13px',
      color: '#64748b',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontWeight: '500'
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    searchBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      width: '280px',
      position: 'relative',
      transition: 'all 0.2s ease'
    },
    searchInput: {
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: '14px',
      color: '#0f172a',
      width: '100%',
      fontFamily: 'inherit'
    },
    headerButton: {
      width: '40px',
      height: '40px',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      color: '#64748b',
    searchDropdown: {
      position: 'absolute',
      top: 'calc(100% + 8px)',
      left: 0,
      width: 'min(520px, 80vw)',
      maxHeight: 320,
      overflowY: 'auto',
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(2,6,23,0.08)',
      zIndex: 1200,
      padding: 8
    },
    searchGroup: {
      marginBottom: 6
    },
    searchGroupTitle: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 700 },
    searchRow: { padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column' },
    searchMeta: { fontSize: 12, color: '#94a3b8' },
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      position: 'relative'
    },
    notificationBadge: {
      position: 'absolute',
      top: '-4px',
      right: '-4px',
      width: '18px',
      height: '18px',
      backgroundColor: '#ef4444',
      borderRadius: '50%',
      fontSize: '10px',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '600',
      border: '2px solid white'
    },
    contentArea: {
      flex: 1,
      padding: '32px',
      overflowY: 'auto',
      overflowX: 'hidden'
    },
    // outer border wrapper with gradient so only edges are colored
    welcomeCardBorder: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '22px',
      padding: '2px',
      maxWidth: '704px',
      margin: '40px auto 24px'
    },
    welcomeCard: {
      background: 'white',
      borderRadius: '20px',
      padding: '32px',
      textAlign: 'center',
      maxWidth: '700px',
      margin: 0,
      boxShadow: '0 6px 20px rgba(2,6,23,0.06)',
      color: '#0f172a',
      position: 'relative',
      overflow: 'hidden'
    },
    welcomeCardOverlay: {
      display: 'none'
    },
    welcomeIcon: {
      fontSize: '64px',
      marginBottom: '20px',
      position: 'relative',
      zIndex: 1
    },
    welcomeTitle: {
      fontSize: '36px',
      fontWeight: '700',
      margin: '0 0 16px 0',
      letterSpacing: '-0.5px',
      position: 'relative',
      zIndex: 1
    },
    welcomeSubtitle: {
      fontSize: '18px',
      lineHeight: '1.6',
      margin: 0,
      fontWeight: '400',
      opacity: 0.95,
      position: 'relative',
      zIndex: 1
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '16px',
      marginBottom: '32px'
    },
    statCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      border: '1px solid #f1f5f9',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '12px',
      width: '100%',
      minWidth: 0
    },
    statIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      flexShrink: 0
    },
    statContent: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    },
    statValue: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#0f172a',
      marginBottom: '2px',
      letterSpacing: '-0.5px'
    },
    statLabel: {
      fontSize: '13px',
      color: '#64748b',
      fontWeight: '500'
    },
    statTrend: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '12px',
      fontWeight: '600',
      padding: '4px 8px',
      borderRadius: '6px',
      marginTop: '8px'
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#64748b',
      fontSize: '16px',
      fontWeight: '500',
      gap: '16px'
    },
    loadingSpinner: {
      width: '40px',
      height: '40px',
      border: '4px solid #f1f5f9',
      borderTop: '4px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    blockedContainer: {
      backgroundColor: 'white',
      border: '1px solid #fecaca',
      borderRadius: '20px',
      padding: '48px',
      textAlign: 'center',
      maxWidth: '500px',
      margin: '60px auto 0',
      boxShadow: '0 10px 40px rgba(239, 68, 68, 0.1)'
    },
    blockedIcon: {
      fontSize: '64px',
      marginBottom: '24px'
    },
    blockedTitle: {
      fontSize: '28px',
      fontWeight: '700',
      margin: '0 0 12px 0',
      color: '#dc2626',
      letterSpacing: '-0.5px'
    },
    blockedText: {
      fontSize: '16px',
      color: '#64748b',
      lineHeight: '1.6',
      margin: 0
    },
// ...existing code...
    panelContainer: {
      backgroundColor: 'white',
      border: '1px solid #f1f5f9',
      borderRadius: '16px',
      height: 'auto',                // allow container to size to content and sit at the top
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',  // keep content anchored to top
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      overflow: 'hidden'
    },
    panelBody: {
      flex: 1,
      padding: '32px',
      overflowY: 'auto',
      backgroundColor: 'white'
    },
    comingSoonContent: {
      textAlign: 'center',
      color: '#64748b',
      padding: '80px 20px'
    },
    comingSoonIcon: {
      fontSize: '80px',
      marginBottom: '24px',
      opacity: 0.6
    },
    comingSoonTitle: {
      fontSize: '28px',
      fontWeight: '700',
      margin: '0 0 16px 0',
      color: '#0f172a',
      letterSpacing: '-0.5px'
    },
    comingSoonText: {
      fontSize: '16px',
      lineHeight: '1.6',
      color: '#64748b',
      maxWidth: '500px',
      margin: '0 auto'
    },
    notificationItem: {
      backgroundColor: 'white',
      border: '1px solid #f1f5f9',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    },
    notificationIcon: {
      fontSize: '24px',
      marginTop: '2px',
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    },
    notificationContent: {
      flex: 1,
      minWidth: 0
    },
    notificationTitle: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#0f172a',
      margin: '0 0 4px 0'
    },
    notificationText: {
      fontSize: '14px',
      color: '#64748b',
      margin: '0 0 8px 0',
      lineHeight: '1.5'
    },
    notificationTime: {
      fontSize: '12px',
      color: '#94a3b8',
      fontWeight: '500'
    }
  };

  // Allow non-admin users in, but default their initial view to user-management
  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setCurrentView('main');
      } else {
        setCurrentView('user-management');
      }
    }
  }, [user]);


  const handleNavItemHover = (e) => {
    if (!e.currentTarget.classList.contains('active')) {
      e.currentTarget.style.backgroundColor = '#f8fafc';
      e.currentTarget.style.color = '#0f172a';
    }
  };

  const handleNavItemLeave = (e) => {
    if (!e.currentTarget.classList.contains('active')) {
      e.currentTarget.style.backgroundColor = 'transparent';
      e.currentTarget.style.color = '#64748b';
    }
  };

  const handleButtonHover = (e, isLogout = false) => {
    if (isLogout) {
      e.target.style.backgroundColor = '#dc2626';
      e.target.style.color = '#ffffff';
      e.target.style.borderColor = '#dc2626';
    } else {
      e.target.style.backgroundColor = '#3b82f6';
      e.target.style.color = '#ffffff';
      e.target.style.borderColor = '#3b82f6';
    }
  };

  const handleButtonLeave = (e, isLogout = false) => {
    if (isLogout) {
      e.target.style.backgroundColor = '#fef2f2';
      e.target.style.color = '#dc2626';
      e.target.style.borderColor = '#fecaca';
    } else {
      e.target.style.backgroundColor = '#f8fafc';
      e.target.style.color = '#64748b';
      e.target.style.borderColor = '#e2e8f0';
    }
  };

  const handleCollapseHover = (e) => {
    e.target.style.backgroundColor = '#3b82f6';
    e.target.style.color = '#ffffff';
    e.target.style.borderColor = '#3b82f6';
  };

  const handleCollapseLeave = (e) => {
    e.target.style.backgroundColor = '#f8fafc';
    e.target.style.color = '#64748b';
    e.target.style.borderColor = '#e2e8f0';
  };

  const handleNavItemClick = (view) => {
    // Check if user is trying to access admin features without permission
    if (view === 'user-management' && user?.role !== 'admin') {
      alert('You do not have permission to access User Management');
      return;
    }
    setCurrentView(view);
  };

  // Handle clicking a notification: mark read, update local state, and navigate to target
  const handleNotificationClick = async (e, notification) => {
    try {
      if (e && e.stopPropagation) e.stopPropagation();

      // Mark as read server/local
      if (!notification.read) {
        await NotificationService.markAsRead(notification.id);
        // update local state quickly
        setUserNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true, read_at: new Date().toISOString() } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      // Determine navigation target from payload
      const data = notification.data || {};

      // Booking -> go to pending bookings / booking calendar
      if (data.bookingId || data.booking_id) {
        // Dispatch a navigate event so booking views can react and optionally open details
        window.dispatchEvent(new CustomEvent('navigateTo', { detail: { type: 'booking', id: data.bookingId || data.booking_id } }));
        // Prefer pending bookings view for new/awaiting bookings
        setCurrentView('upcoming-schedule');
        return;
      }

      // Instrument request (rent/borrow) -> go to approval queue
      if (data.requestId || data.request_id || data.rentRequestId || data.rent_request_id || data.borrowRequestId || data.borrow_request_id) {
        const id = data.requestId || data.request_id || data.rentRequestId || data.rent_request_id || data.borrowRequestId || data.borrow_request_id;
        window.dispatchEvent(new CustomEvent('navigateTo', { detail: { type: 'request', id } }));
        setCurrentView('approval');
        return;
      }

      // Invoice -> open invoice editor/view
      if (data.invoiceId || data.invoice_id) {
        window.dispatchEvent(new CustomEvent('navigateTo', { detail: { type: 'invoice', id: data.invoiceId || data.invoice_id } }));
        setCurrentView('invoice');
        return;
      }

      // Reminder / payment link -> open exact-payment flow
      if (data.paymentLink || data.exact || (notification && notification.type === 'reminder' && (data.invoiceId || data.invoice_id))) {
        try {
          const invId = data.invoiceId || data.invoice_id;
          const amt = data.amount || data.balance || '';
          const link = data.paymentLink || `${window.location.origin}/pay-exact?invoiceId=${invId || ''}${amt ? `&amount=${encodeURIComponent(amt)}` : ''}${data.forceFull ? '&forceFull=1' : ''}`;
          // Navigate to exact payment page (same tab)
          window.location.href = link;
          return;
        } catch (e) {
          console.error('Failed to navigate to exact payment link', e);
        }
      }

      // Generic path/url handler: if the notification contains an internal path, try to map it
      if (data.path || data.url) {
        const path = String(data.path || data.url);
        // if path contains keywords, map to a view
        if (path.includes('/bookings') || path.includes('booking')) {
          window.dispatchEvent(new CustomEvent('navigateTo', { detail: { type: 'booking', path } }));
          setCurrentView('booking-calendar');
          return;
        }
        if (path.includes('/requests') || path.includes('request')) {
          window.dispatchEvent(new CustomEvent('navigateTo', { detail: { type: 'request', path } }));
          setCurrentView('approval');
          return;
        }
        if (path.includes('/invoices') || path.includes('invoice')) {
          window.dispatchEvent(new CustomEvent('navigateTo', { detail: { type: 'invoice', path } }));
          setCurrentView('invoice');
          return;
        }
      }

      // Fallback: just open main dashboard
      setCurrentView('main');
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  // Check if user is blocked
  if (user?.isBlocked) {
    return (
      <div style={styles.container}>
        <div style={styles.mainContent}>
          <div style={styles.mainHeader}>
            <h1 style={styles.mainTitle}>Access Denied</h1>
            <button
              style={styles.footerButton}
              onClick={onBackToHome}
              onMouseEnter={(e) => handleButtonHover(e)}
              onMouseLeave={(e) => handleButtonLeave(e)}
            >
            </button>
          </div>

          <div style={styles.contentArea}>
            <div style={styles.blockedContainer}>
              <div style={styles.blockedIcon}>🚫</div>
              <h2 style={styles.blockedTitle}>Account Blocked</h2>
              <p style={styles.blockedText}>
                Your account has been temporarily suspended. Please contact the administrator at
                <strong> dbe.official@example.com</strong> to restore access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getMainTitle = () => {
    for (const group of navigationGroups) {
      const item = group.items.find(item => item.view === currentView);
      if (item) return item.text;
    }
    return 'Dashboard';
  };

  const getBreadcrumbs = () => {
    if (currentView === 'main') return 'Home';
    for (const group of navigationGroups) {
      const item = group.items.find(item => item.view === currentView);
      if (item) return `${group.title} / ${item.text}`;
    }
    return 'Dashboard';
  };

  const getWelcomeContent = () => {
    const statCards = [
      {
        icon: <FaBoxOpen />,
        value: String(totalEquipments),
        label: 'Total Equipments',
        trend: '↑ 12% this month',
        iconBg: '#eff6ff',
        iconColor: '#3b82f6',
        trendBg: '#dcfce7',
        trendColor: '#16a34a'
      },
      {
        icon: <FaUsers />,
        value: String(activeCustomersCount),
        label: 'Active Customers',
        trend: '↑ 8% this month',
        iconBg: '#fef3c7',
        iconColor: '#f59e0b',
        trendBg: '#dcfce7',
        trendColor: '#16a34a'
      },
      {
        icon: <FaChartLine />,
        value: String(upcomingEventsCount),
        label: 'Upcoming Events',
        trend: '→ 3 this week',
        iconBg: '#fce7f3',
        iconColor: '#ec4899',
        trendBg: '#dbeafe',
        trendColor: '#3b82f6'
      },
      {
        icon: <FaBell />,
        value: String(unreadCount || 0),
        label: 'New Notifications',
        trend: '⚠ 3 urgent',
        iconBg: '#e0e7ff',
        iconColor: '#6366f1',
        trendBg: '#fee2e2',
        trendColor: '#dc2626'
      }
    ];

    return (
      <>
        {/* swapped: statsGrid first, welcomeCard below */}
        <div style={styles.statsGrid}>
          {statCards.map((card, index) => (
            <div 
              key={index} 
              style={styles.statCard} 
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
              }}
            >
              <div style={{ ...styles.statIcon, backgroundColor: card.iconBg, color: card.iconColor }}>
                {card.icon}
              </div>
              <div style={styles.statContent}>
                <div style={styles.statValue}>{card.value}</div>
                <div style={styles.statLabel}>{card.label}</div>
              </div>
            </div>
          ))}
        </div>


        <div style={styles.welcomeCardBorder}>
          <div style={styles.welcomeCard}>
          <h2 style={styles.welcomeTitle}>
            <span style={{ display: 'inline-block', marginRight: 12, fontSize: 48, lineHeight: 1, verticalAlign: 'middle' }}></span>
            <span style={{ verticalAlign: 'middle' }}>{getGreeting()}, {user?.firstName || 'there'}! 👋</span>
          </h2>
          <p style={styles.welcomeSubtitle}>
            Manage your marching band operations with ease. Select an option from the sidebar to get started.
          </p>
          </div>
        </div>


        {/* My Instrument Requests Section */}
        {myInstrumentRequests.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaMusic style={{ color: '#3b82f6' }} />
              My Instrument Requests
            </h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              {myInstrumentRequests.map((request) => (
                <div 
                  key={request.id || request.request_id} 
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>
                        {request.instrumentName || request.instrument_name}
                      </h4>
                      <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                        {(request.instrumentType || request.instrument_type).charAt(0).toUpperCase() + (request.instrumentType || request.instrument_type).slice(1)}
                      </p>
                    </div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: 
                        request.status === 'approved' ? '#dcfce7' :
                        request.status === 'rejected' ? '#fee2e2' :
                        '#fef3c7',
                      color:
                        request.status === 'approved' ? '#16a34a' :
                        request.status === 'rejected' ? '#dc2626' :
                        '#f59e0b'
                    }}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Type</p>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>
                        {request.type === 'borrow' ? '🆓 Borrow' : '💰 Rent'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Quantity</p>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>{request.quantity}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Start Date</p>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>
                        {new Date(request.startDate || request.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>End Date</p>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>
                        {new Date(request.endDate || request.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Purpose</p>
                    <p style={{ fontSize: '14px', color: '#0f172a' }}>{request.purpose}</p>
                  </div>
                  
                  {request.notes && (
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Notes</p>
                      <p style={{ fontSize: '14px', color: '#0f172a' }}>{request.notes}</p>
                    </div>
                  )}

                  {/* Fee / Days / Total summary */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, marginBottom: 8 }}>
                    {(() => {
                      // compute days (inclusive)
                      let days = 1;
                      try {
                        const s = new Date(request.startDate || request.start_date);
                        const e = new Date(request.endDate || request.end_date);
                        if (!isNaN(s) && !isNaN(e)) {
                          const diff = Math.abs(e - s);
                          days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
                        }
                      } catch (e) { days = 1; }

                      let perDay = request.rentalFee || request.rental_fee || request.instrumentPricePerDay || request.price_per_day || instrumentPriceMap[request.instrument_id || request.instrumentId] || null;
                      let total = request.total_amount || request.totalAmount || request.amount || null;
                      const qtyReq = Number(request.quantity) || 1;
                      // If we have total but no per-day, derive per-day from total
                      if ((perDay == null || perDay === '') && total != null && !isNaN(total) && days > 0) {
                        perDay = Number(total) / (days * qtyReq);
                      }
                      // If we have per-day but no total, compute total
                      if ((total == null || total === '') && perDay != null) {
                        total = Number(perDay) * days * qtyReq;
                      }

                      return (
                        <>
                          <div style={{ background: '#f8fafc', padding: '8px', borderRadius: 8, flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Days</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{days}</div>
                          </div>
                          <div style={{ background: '#fff7ed', padding: '8px', borderRadius: 8, flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#947a3b' }}>Fee / day</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>{perDay != null ? formatCurrency(Number(perDay)) : 'N/A'}</div>
                          </div>
                          <div style={{ background: '#eef2ff', padding: '8px', borderRadius: 8, flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#475569' }}>Total</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#3730a3' }}>{total != null ? formatCurrency(Number(total)) : 'N/A'}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Requested on {new Date(request.requestDate || request.request_date).toLocaleString()}
                    </p>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setViewRequest(request)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          background: 'white',
                          color: '#374151',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <FaInfoCircle /> Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

      {/* Request Details Modal */}
      {viewRequest && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }} onClick={() => setViewRequest(null)}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 720, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Request Details</h3>
              <button onClick={() => setViewRequest(null)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: 24, overflowY: 'auto', flexGrow: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Instrument</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{viewRequest.instrumentName || viewRequest.instrument_name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Quantity</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{viewRequest.quantity || 1}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Start Date</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{viewRequest.startDate ? new Date(viewRequest.startDate).toLocaleDateString() : (viewRequest.start_date ? new Date(viewRequest.start_date).toLocaleDateString() : '—')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>End Date</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{viewRequest.endDate ? new Date(viewRequest.endDate).toLocaleDateString() : (viewRequest.end_date ? new Date(viewRequest.end_date).toLocaleDateString() : '—')}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                {(() => {
                  let days = 1;
                  try {
                    const s = new Date(viewRequest.startDate || viewRequest.start_date);
                    const e = new Date(viewRequest.endDate || viewRequest.end_date);
                    if (!isNaN(s) && !isNaN(e)) {
                      const diff = Math.abs(e - s);
                      days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
                    }
                  } catch (e) { days = 1; }

                  let perDay = viewRequest.rentalFee || viewRequest.rental_fee || viewRequest.instrumentPricePerDay || viewRequest.price_per_day || instrumentPriceMap[viewRequest.instrument_id || viewRequest.instrumentId] || null;
                  let total = viewRequest.total_amount || viewRequest.totalAmount || viewRequest.amount || null;
                  const qty = Number(viewRequest.quantity) || 1;
                  if ((perDay == null || perDay === '') && total != null && !isNaN(total) && days > 0) {
                    perDay = Number(total) / (days * qty);
                  }
                  if ((total == null || total === '') && perDay != null) {
                    total = Number(perDay) * days * qty;
                  }

                  return (
                    <>
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Days</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{days}</div>
                      </div>
                      <div style={{ background: '#fff7ed', padding: 12, borderRadius: 8, flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#947a3b' }}>Fee / day</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#b45309' }}>{perDay != null ? formatCurrency(Number(perDay)) : 'N/A'}</div>
                      </div>
                      <div style={{ background: '#eef2ff', padding: 12, borderRadius: 8, flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#475569' }}>Total</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#3730a3' }}>{total != null ? formatCurrency(Number(total)) : 'N/A'}</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {(viewRequest.purpose || viewRequest.notes) && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Purpose / Notes</div>
                  <div style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap' }}>{viewRequest.purpose || viewRequest.notes}</div>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>Status: <span style={{ fontWeight: 700, color: '#0f172a' }}>{(viewRequest.status || 'pending').toUpperCase()}</span></div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setViewRequest(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      </>
    );
  };

  const getNotificationsContent = () => {
    const handleMarkAsRead = (notificationId) => {
      NotificationService.markAsRead(notificationId);
    };

    const handleMarkAllAsRead = () => {
      if (user && user.email) {
        NotificationService.markAllAsRead(user.email);
      }
    };

    const handleDeleteNotification = (notificationId) => {
      NotificationService.deleteNotification(notificationId);
    };

    const getTimeAgo = (dateString) => {
      if (!dateString) return 'Recently';
      const now = new Date();
      const created = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(created.getTime())) return 'Recently';
      
      const diffMs = now - created;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    const getNotificationIcon = (type) => {
      switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        default: return 'ℹ️';
      }
    };

    const getNotificationColor = (type) => {
      switch (type) {
        case 'success': return { bg: '#dcfce7', color: '#16a34a' };
        case 'error': return { bg: '#fee2e2', color: '#dc2626' };
        case 'warning': return { bg: '#fef3c7', color: '#f59e0b' };
        default: return { bg: '#dbeafe', color: '#3b82f6' };
      }
    };

    if (userNotifications.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <FaBell size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
          <p style={{ color: '#64748b', fontSize: '16px', marginBottom: '8px' }}>No notifications yet</p>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>When you receive notifications, they'll appear here</p>
        </div>
      );
    }

    return (
      <div>
        {unreadCount > 0 && (
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </p>
            <button
              onClick={handleMarkAllAsRead}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#0369a1',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#0369a1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              Mark all as read
            </button>
          </div>
        )}
        
        {userNotifications
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(notification => {
            const colors = getNotificationColor(notification.type);
            return (
              <div 
                key={notification.id} 
                style={{
                  ...styles.notificationItem,
                  backgroundColor: notification.read ? '#ffffff' : '#f8fafc',
                  opacity: notification.read ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
                onClick={(e) => handleNotificationClick(e, notification)}
              >
                <div style={{ 
                  ...styles.notificationIcon, 
                  backgroundColor: colors.bg,
                  color: colors.color
                }}>
                  {(() => {
                    const ic = getNotificationIcon(notification.type);
                    const IconComp = ic && ic.Icon ? ic.Icon : null;
                    return IconComp ? <IconComp size={18} color={ic.color} /> : null;
                  })()}
                </div>
                <div style={{ ...styles.notificationContent, flex: 1 }}>
                  <div style={styles.notificationTitle}>{notification.title}</div>
                  <div style={styles.notificationText}>{notification.message}</div>
                  
                  {/* Payment Details Section */}
                  {notification.data?.paymentDetails && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      border: '1px solid #bae6fd'
                    }}>
                      <div style={{ 
                        fontWeight: '600', 
                        color: '#0369a1', 
                        marginBottom: '8px',
                        fontSize: '14px'
                      }}>
                        💳 Payment Information
                      </div>
                      
                      {/* Payment Options */}
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                          Payment Options:
                        </div>
                        {notification.data.paymentDetails.paymentOptions.map((option, idx) => (
                          <div key={idx} style={{ 
                            fontSize: '13px', 
                            color: '#475569',
                            marginBottom: '4px',
                            paddingLeft: '8px'
                          }}>
                            • {option.type}: <strong>{formatCurrency(option.amount)}</strong>
                          </div>
                        ))}
                      </div>

                      {/* Bank Transfer Details */}
                      <div style={{ 
                        marginBottom: '10px',
                        paddingBottom: '10px',
                        borderBottom: '1px solid #e0f2fe'
                      }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                          🏦 Bank Transfer:
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                          <div><strong>Bank:</strong> {notification.data.paymentDetails.bankName}</div>
                          <div><strong>Account Name:</strong> {notification.data.paymentDetails.accountName}</div>
                          <div><strong>Account #:</strong> {notification.data.paymentDetails.accountNumber}</div>
                        </div>
                      </div>

                      {/* GCash Details */}
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                          📱 GCash:
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                          <div><strong>Name:</strong> {notification.data.paymentDetails.gcashName}</div>
                          <div><strong>Number:</strong> {notification.data.paymentDetails.gcashNumber}</div>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div style={{
                        fontSize: '12px',
                        color: '#0369a1',
                        fontStyle: 'italic',
                        backgroundColor: '#ffffff',
                        padding: '8px',
                        borderRadius: '6px',
                        marginTop: '8px'
                      }}>
                        📝 {notification.data.paymentDetails.instructions}
                      </div>
                    </div>
                  )}
                  
                  <div style={styles.notificationTime}>{getTimeAgo(notification.createdAt)}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotification(notification.id);
                  }}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fee2e2';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                  title="Delete notification"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            );
          })
        }
      </div>
    );
  };

  const getComingSoonContent = (title, icon = '🚧') => {
    return (
      <div style={styles.comingSoonContent}>
        <div style={styles.comingSoonIcon}>{icon}</div>
        <h2 style={styles.comingSoonTitle}>{title}</h2>
        <p style={styles.comingSoonText}>
          This feature is currently under development and will be available soon.
          <br />Stay tuned for updates!
        </p>
      </div>
    );
  };

  const getPanelContent = () => {
    switch (currentView) {
      case 'main':
        return getWelcomeContent();

      case 'notifications':
        return (
          <div style={styles.panelContainer}>
            <div style={styles.panelBody}>
              {getNotificationsContent()}
            </div>
          </div>
        );

      case 'user-management':
        if (user?.role === 'admin') {
          return (
            <Suspense fallback={
              <div style={styles.loadingContainer}>
                <div style={styles.loadingSpinner}></div>
                <div>Loading User Management...</div>
              </div>
            }>
              <UserManagement
                user={user}
                onBackToHome={() => setCurrentView('main')}
                onLogout={onLogout}
                embedded={true}
              />
            </Suspense>
          );
        }
        break;

      case 'membership-approval':
        if (user?.role === 'admin') {
          return (
            <Suspense fallback={
              <div style={styles.loadingContainer}>
                <div style={styles.loadingSpinner}></div>
                <div>Loading Membership Approval...</div>
              </div>
            }>
              <MembershipApproval
                user={user}
                onBackToHome={() => setCurrentView('main')}
                onLogout={onLogout}
                embedded={true}
              />
            </Suspense>
          );
        }
        break;

      case 'instrument-items':
        return (
          <Suspense fallback={
            <div style={styles.loadingContainer}>
              <div style={styles.loadingSpinner}></div>
              <div>Loading Instrument Items...</div>
            </div>
          }>
            <InstrumentItemsManager
              user={user}
              onBackToHome={() => setCurrentView('main')}
            />
          </Suspense>
        );

      // maintenance view removed

        case 'inventory-report':
          return (
            <Suspense fallback={<div style={styles.loadingContainer}><div style={styles.loadingSpinner}></div><div>Loading Inventory Report...</div></div>}>
              <InventoryReport />
            </Suspense>
          );

        case 'sales-report':
          return (
            <Suspense fallback={<div style={styles.loadingContainer}><div style={styles.loadingSpinner}></div><div>Loading Sales Report...</div></div>}>
              <SalesReport />
            </Suspense>
          );

      case 'customer-management':
        return (
          <Suspense fallback={
            <div style={styles.loadingContainer}>
              <div style={styles.loadingSpinner}></div>
              <div>Loading Customer Management...</div>
            </div>
          }>
            <CustomerManagement
              user={user}
              onBackToHome={() => setCurrentView('main')}
              onLogout={onLogout}
              embedded={true}
            />
          </Suspense>
        );

      case 'booking-calendar':
        return (
          <Suspense fallback={
            <div style={styles.loadingContainer}>
              <div style={styles.loadingSpinner}></div>
              <div>Loading Bookings Calendar...</div>
            </div>
          }>
            <BookingCalendar />
          </Suspense>
        );

      // Removed my-invoices view

      case 'upcoming-schedule':
        return (
          <Suspense fallback={<div>Loading Pending Bookings...</div>}>
            <PendingBookings />
          </Suspense>
        );

      case 'service-management':
        return (
          <Suspense fallback={<div>Loading Service Management...</div>}>
            <ServiceManagement />
          </Suspense>
        );

      case 'invoice':
        return (
          <Suspense fallback={<div>Loading Invoices...</div>}>
            <Invoice user={user} onBackToHome={() => setCurrentView('main')} />
          </Suspense>
        );

      case 'approval':
        return (
          <Suspense fallback={<div>Loading Approvals...</div>}>
            <Approval onBackToHome={() => setCurrentView('main')} />
          </Suspense>
        );

      case 'payment':
        return (
          <Suspense fallback={<div>Loading Payments...</div>}>
            <Payment onBackToHome={() => setCurrentView('main')} />
          </Suspense>
        );
      case 'transactions':
        return (
          <Suspense fallback={<div>Loading Transactions...</div>}>
            <TransactionHistory onBackToHome={() => setCurrentView('main')} />
          </Suspense>
        );

      
      case 'my-profile':
        return (
          <div style={styles.panelContainer}>
            <div style={styles.panelBody}>
              {/* Profile Content */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32, alignItems: 'start' }}>
                
                {/* Left Column - Profile Picture */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ 
                    width: 160, 
                    height: 160, 
                    borderRadius: 20, 
                    overflow: 'hidden', 
                    background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 48, 
                    color: '#0b3b78',
                    border: '4px solid #ffffff',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                  }}>
                    {user?.avatar ? (
                      <img src={user.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ fontWeight: 800, letterSpacing: '2px' }}>{getUserInitials()}</div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <label style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 20px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #0b62d6 0%, #0b3b78 100%)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(11, 98, 214, 0.3)'
                    }}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) return;
                          
                          // Check file size (limit to 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File size too large. Please choose an image under 5MB.');
                            return;
                          }

                          const reader = new FileReader();
                          reader.onload = () => {
                            const base64 = String(reader.result);
                            // Update current user in localStorage
                            try {
                              const stored = JSON.parse(localStorage.getItem('davaoBlueEaglesUser') || 'null');
                              const updated = { ...(stored || {}), avatar: base64 };
                              localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(updated));
                              
                              // Update users list if exists (for admin/user management)
                              const users = JSON.parse(localStorage.getItem('davaoBlueEaglesUsers') || '[]');
                              const updatedUsers = users.map(u => u.id === updated.id ? { ...u, avatar: base64 } : u);
                              if (users.length) localStorage.setItem('davaoBlueEaglesUsers', JSON.stringify(updatedUsers));

                              // Notify parent/app that user changed (so nav/menu updates)
                              window.dispatchEvent(new CustomEvent('davaoUserUpdated', { detail: updated }));
                            } catch (err) {
                              console.error('Saving avatar failed', err);
                              alert('Failed to save profile picture. Please try again.');
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      📷 Change Photo
                    </label>
                    <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '12px' }}>
                      JPG, PNG or GIF (max 5MB)
                    </p>
                  </div>
                </div>

                {/* Right Column - User Information */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Basic Information Card */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
                  }}>
                    <h3 style={{ 
                      margin: '0 0 20px 0', 
                      color: '#0f172a', 
                      fontSize: '18px', 
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <FaUserCircle /> Basic Information
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          First Name
                        </label>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500 }}>
                          {user?.firstName || 'Not provided'}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Last Name
                        </label>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500 }}>
                          {user?.lastName || 'Not provided'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Email Address
                      </label>
                      <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500 }}>
                        {user?.email || 'Not provided'}
                      </div>
                    </div>
                  </div>

                  {/* Account Information Card */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
                  }}>
                    <h3 style={{ 
                      margin: '0 0 20px 0', 
                      color: '#0f172a', 
                      fontSize: '18px', 
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <FaLock /> Account Details
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Role
                        </label>
                        <div style={{ 
                          padding: '12px 16px', 
                          background: user?.role === 'admin' ? '#fef3c7' : '#e0f2fe', 
                          borderRadius: 8, 
                          border: user?.role === 'admin' ? '1px solid #fbbf24' : '1px solid #0ea5e9', 
                          color: user?.role === 'admin' ? '#92400e' : '#0c4a6e', 
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          {user?.role === 'admin' ? <FaCrown /> : <FaUserCircle />} {user?.role || 'user'}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          User ID
                        </label>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#64748b', fontFamily: 'monospace', fontSize: '14px' }}>
                          #{user?.id || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Member Since
                      </label>
                      <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500 }}>
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Not available'}
                      </div>
                    </div>
                  </div>

                  {/* Additional Information Card (if available) */}
                  {(user?.phone || user?.birthday || user?.instrument || user?.address) && (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: 16,
                      padding: 24,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
                    }}>
                      <h3 style={{ 
                        margin: '0 0 20px 0', 
                        color: '#0f172a', 
                        fontSize: '18px', 
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <FaClipboard /> Additional Information
                      </h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {user?.phone && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Phone Number
                            </label>
                            <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500 }}>
                              {user.phone}
                            </div>
                          </div>
                        )}
                        
                        {user?.birthday && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Date of Birth
                            </label>
                            <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500 }}>
                              {new Date(user.birthday).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {user?.instrument && (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Primary Instrument
                          </label>
                          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaMusic /> {user.instrument}
                          </div>
                        </div>
                      )}

                      {user?.address && (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Address
                          </label>
                          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaMapMarkerAlt /> {user.address}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Account Status */}
                  <div style={{
                    background: user?.isBlocked ? '#fef2f2' : '#f0fdf4',
                    borderRadius: 16,
                    padding: 20,
                    border: user?.isBlocked ? '1px solid #fecaca' : '1px solid #bbf7d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <div style={{ 
                      fontSize: '24px',
                      filter: user?.isBlocked ? 'grayscale(1)' : 'none'
                    }}>
                      {user?.isBlocked ? '🚫' : '✅'}
                    </div>
                    <div>
                      <div style={{ 
                        fontWeight: 600, 
                        color: user?.isBlocked ? '#dc2626' : '#16a34a',
                        marginBottom: 4
                      }}>
                        Account Status: {user?.isBlocked ? 'Blocked' : 'Active'}
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: user?.isBlocked ? '#991b1b' : '#15803d'
                      }}>
                        {user?.isBlocked 
                          ? 'Your account has been restricted. Please contact support for assistance.'
                          : 'Your account is active and in good standing.'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'help-support':
        return (
          <div style={styles.panelContainer}>
            <div style={styles.panelBody}>
              {getComingSoonContent('Help & Support', '❓')}
            </div>
          </div>
        );

      default:
        return getWelcomeContent();
    }
  };

  const getUserInitials = () => {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
       return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
  };

  // Returns time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  
  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
               {/* Sidebar Header */}
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>
            {!sidebarCollapsed && <span>Admin Dashboard</span>}
          </div>
          <button
            style={styles.collapseButton}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            onMouseEnter={handleCollapseHover}
            onMouseLeave={handleCollapseLeave}
            aria-label="Toggle sidebar"
          >
            <FaBars size={14} />
          </button>
        </div>

        {/* User Section */}
        <div style={styles.userSection}>
          <div style={styles.userAvatar}>
            {getUserInitials()}
          </div>
          {!sidebarCollapsed && (
            <>
              <div style={styles.userName}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={styles.userEmail}>
                {user?.email}
              </div>
              <div style={styles.userRole}>
                {user?.role || 'user'}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div style={styles.navigation}>
          {navigationGroups.map((group) => (
            <div key={group.title} style={styles.navGroup}>
              <div style={styles.navGroupTitle}>{group.title}</div>
              {group.items.map((item) => {
                // Hide admin-only items for non-admin users
                if (item.adminOnly && user?.role !== 'admin') {
                  return null;
                }

                const isActive = currentView === item.view;
                return (
                  <div
                    key={item.id}
                    className={isActive ? 'active' : ''}
                    style={{
                      ...styles.navItem,
                      ...(isActive ? styles.navItemActive : {})
                    }}
                    onClick={() => handleNavItemClick(item.view)}
                    onMouseEnter={handleNavItemHover}
                    onMouseLeave={handleNavItemLeave}
                  >
                    <div style={styles.navIcon}>{item.icon}</div>
                    <span style={styles.navText}>{item.text}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div style={styles.sidebarFooter}>
          <button
            style={styles.footerButton}
            onClick={onBackToHome}
            onMouseEnter={(e) => handleButtonHover(e)}
            onMouseLeave={(e) => handleButtonLeave(e)}
            title="Back to Home"
            aria-label="Home"
          >
            <FaHome size={16} />
            {!sidebarCollapsed && <span>Home</span>}
          </button>
          <button
            style={styles.logoutButton}
            onClick={() => {
              onLogout();
              onBackToHome();
            }}
            onMouseEnter={(e) => handleButtonHover(e, true)}
            onMouseLeave={(e) => handleButtonLeave(e, true)}
            title="Logout"
            aria-label="Logout"
          >
            <FaSignOutAlt size={16} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <div style={styles.mainHeader}>
          <div style={styles.headerLeft}>
            <h1 style={styles.mainTitle}>{getMainTitle()}</h1>
            <div style={styles.breadcrumbs}>{getBreadcrumbs()}</div>
          </div>
          <div style={styles.headerRight}>
          
            <button 
              style={styles.headerButton}
              onClick={() => setCurrentView('notifications')}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.color = '#3b82f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.color = '#64748b';
              }}
              title="Notifications"
            >
              <FaBell size={18} />
              {unreadCount > 0 && <span style={styles.notificationBadge}>{unreadCount}</span>}
            </button>
            <button 
              style={styles.headerButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.color = '#3b82f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.color = '#64748b';
              }}
              title="Settings"
            >
              <FaCog size={18} />
            </button>
          </div>
        </div>

        <div style={styles.contentArea}>
          {getPanelContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
