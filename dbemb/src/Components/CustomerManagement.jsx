import React, { useState, useEffect, useMemo } from "react";
import {
  FaUsers,
  FaUserCheck,
  FaClock,
  FaBookOpen,
  FaChartBar,
  FaEnvelope,
  FaPhone,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUser,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaEye,
  FaTimes,
  FaSearch,
  FaFilter,
  FaThumbsUp,
  FaThumbsDown,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaSortAmountDown,
  FaDownload,
  FaArchive,
  FaUndo,
  FaCheck,
  FaBell
} from "../icons/fa";
import NotificationService from '../services/notificationService';
import AuthService from '../services/authService';
import { API_BASE_URL } from '../services/apiConfig';
import { formatCurrency } from '../utils/formatters';
import StyledSelect from './StyledSelect';

const CustomerManagement = ({ bookingsData = [] }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("lastBooking");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState("cards");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [customerStatusOverrides, setCustomerStatusOverrides] = useState(new Map());
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterMinRevenue, setFilterMinRevenue] = useState('');
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState([]);
  // No board tabs; single unified dataset

  // Static booking data - this will be replaced by props from your booking system
  const defaultBookingsData = [
    {
      id: 1,
      service: 'Band Gigs',
      name: 'Bongbong Marky',
      email: 'magnanakaw@gmail.com',
      phone: '+63 912 345 6789',
      location: 'Ilocos Norte',
      notes: 'Birthday ni BWS',
      date: '2025-09-25',
      startTime: '14:00',
      endTime: '18:00',
      createdAt: '2025-09-17T10:00:00.000Z',
      status: 'approved'
    },
    {
      id: 2,
      service: 'Music Workshops',
      name: 'Justin Nabunturan',
      email: 'justin@gmail.com',
      phone: '+63 917 654 3210',
      location: 'Nabunturan City',
      notes: 'Saxophone practice for idol Justin',
      date: '2025-09-26',
      startTime: '10:00',
      endTime: '12:00',
      createdAt: '2025-09-17T11:00:00.000Z',
      status: 'pending'
    },
    {
      id: 3,
      service: 'Band Gigs',
      name: 'Ivan Louie Malicsi',
      email: 'ilim@gmail.com',
      phone: '+63 920 111 2222',
      location: 'Jollibee Toril', 
      notes: 'Farewell party (yoko na sa Davao)',
      date: '2025-09-26',
      startTime: '15:00',
      endTime: '19:00',
      createdAt: '2025-09-17T12:00:00.000Z',
      status: 'pending'
    }
  ];

  // State to hold all booking data
  const [allBookingsData, setAllBookingsData] = useState([]);

  // Load all bookings from API
  const getStoredBookings = async () => {
    try {
      console.log('CustomerManagement: Fetching bookings from API');
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('CustomerManagement: API Bookings Response:', data);
        if (data.success && Array.isArray(data.bookings)) {
          // Convert database format to frontend format
          const bookings = data.bookings.map(b => ({
            id: b.booking_id,
            customerName: b.customer_name,
            name: b.customer_name,
            email: b.email,
            phone: b.phone,
            service: b.service,
            date: b.date ? (typeof b.date === 'string' ? b.date.split('T')[0] : b.date) : b.date,
            startTime: b.start_time,
            endTime: b.end_time,
            location: b.location,
            estimatedValue: parseFloat(b.estimated_value || 5000),
            status: b.status,
            notes: b.notes,
            createdAt: b.created_at
          }));
          // Sort by date (ASC) and time (NULLs last)
          bookings.sort((a, b) => {
            const da = new Date(a.date);
            const db = new Date(b.date);
            if (da.getTime() !== db.getTime()) return da - db;
            if (!a.startTime && !b.startTime) return a.id - b.id;
            if (!a.startTime) return 1;
            if (!b.startTime) return -1;
            return a.startTime.localeCompare(b.startTime) || (a.id - b.id);
          });
          console.log(`CustomerManagement: Loaded ${bookings.length} bookings from API`);
          return bookings;
        }
      } else {
        console.error('CustomerManagement: API request failed:', response.status);
      }
    } catch (error) {
      console.error('CustomerManagement: Error loading bookings from API:', error);
    }
    return [];
  };

  // Load customer status overrides from memory
  const loadCustomerOverrides = () => {
    // In a real app, this would come from a database or persistent storage
    // For now, we'll keep it in component state
    return new Map();
  };

  // Load and combine all booking data
  useEffect(() => {
    const loadAllBookings = async () => {
      console.log('CustomerManagement: Loading bookings');
      const apiBookings = await getStoredBookings();
      console.log('CustomerManagement: API returned:', apiBookings.length, 'bookings');
      
      // Use API data only (no localStorage, no default data)
      setAllBookingsData(apiBookings);
      console.log('CustomerManagement: Set bookings data:', apiBookings.length, 'bookings');
    };

    // Load data initially
    loadAllBookings();

    const handleStorageChange = () => {
      console.log('CustomerManagement: Storage change detected, reloading from API...');
      loadAllBookings();
    };

    const handleBookingsUpdated = () => {
      console.log('CustomerManagement: Received bookingsUpdated event, reloading from API...');
      loadAllBookings();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bookingsUpdated', handleBookingsUpdated);
    
    // Check for changes more frequently
    const interval = setInterval(() => {
      loadAllBookings();
    }, 5000); // Poll every 5 seconds to reduce load

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingsUpdated', handleBookingsUpdated);
      clearInterval(interval);
    };
  }, [refreshTrigger]);

  // Convert booking data to customer data
  useEffect(() => {
    if (allBookingsData.length === 0) return; // Don't process if no data
    
    const customerMap = new Map();
    
    allBookingsData.forEach(booking => {
      const customerKey = booking.email;
      
      if (customerMap.has(customerKey)) {
        const existing = customerMap.get(customerKey);
        existing.bookings.push(booking);
        existing.totalBookings += 1;
        // Only count revenue from approved bookings
        if (booking.status === 'approved') {
          existing.totalRevenue += booking.estimatedValue || 5000;
        }
        
        if (new Date(booking.date) > new Date(existing.lastBooking)) {
          existing.lastBooking = booking.date;
          existing.lastService = booking.service;
        }
        
        // Only update status from bookings if no manual override exists
        if (!customerStatusOverrides.has(customerKey)) {
          const statusPriority = { approved: 4, pending: 3, rejected: 2, cancelled: 1 };
          const currentPriority = statusPriority[existing.status] || 0;
          const newPriority = statusPriority[booking.status] || 0;
          
          if (newPriority > currentPriority) {
            existing.status = booking.status === 'approved' ? 'active' : booking.status;
          }
        }
      } else {
        const customerEmail = booking.email;
        const overrideStatus = customerStatusOverrides.get(customerEmail);
        const defaultStatus = booking.status === 'approved' ? 'active' : booking.status;
        
        // Generate a unique customer ID based on email hash
        // This ensures the same customer always gets the same ID
        const generateCustomerId = (email) => {
          let hash = 0;
          for (let i = 0; i < email.length; i++) {
            const char = email.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return Math.abs(hash);
        };
        
        customerMap.set(customerKey, {
          id: generateCustomerId(customerEmail),
          name: booking.name.trim(),
          email: booking.email,
          phone: booking.phone || 'N/A',
          service: booking.service,
          status: overrideStatus || defaultStatus,
          totalBookings: 1,
          bookings: [booking],
          address: booking.location,
          lastBooking: booking.date,
          lastService: booking.service,
          joinDate: booking.createdAt.split('T')[0],
          // Only count revenue from approved bookings
          totalRevenue: booking.status === 'approved' ? (booking.estimatedValue || 5000) : 0,
          preferredServices: [booking.service],
          notes: booking.notes || ''
        });
      }
    });
    
    // Apply any existing status overrides
    customerStatusOverrides.forEach((status, email) => {
      const customer = Array.from(customerMap.values()).find(c => c.email === email);
      if (customer) {
        customer.status = status;
      }
    });
    
    customerMap.forEach(customer => {
      const serviceCount = {};
      customer.bookings.forEach(booking => {
        serviceCount[booking.service] = (serviceCount[booking.service] || 0) + 1;
      });
      customer.preferredServices = Object.keys(serviceCount).sort((a, b) => serviceCount[b] - serviceCount[a]);
    });
    
    setCustomers(Array.from(customerMap.values()));
  }, [allBookingsData, customerStatusOverrides]); // Re-run when allBookingsData or overrides change

  // Enhanced filtering and sorting
  useEffect(() => {
    let filtered = customers.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    } else {
      // When showing "all", exclude archived customers by default
      filtered = filtered.filter((c) => c.status !== "archived");
    }
    
    if (serviceFilter !== "all") {
      filtered = filtered.filter((c) => 
        c.bookings.some(booking => booking.service === serviceFilter)
      );
    }

    // Date range filter (based on customer's lastBooking)
    if (filterFromDate) {
      const from = new Date(filterFromDate);
      filtered = filtered.filter(c => {
        const lb = c.lastBooking ? new Date(c.lastBooking) : null;
        return lb && lb >= from;
      });
    }
    if (filterToDate) {
      const to = new Date(filterToDate);
      // include entire day for 'to' by setting time to end of day
      to.setHours(23,59,59,999);
      filtered = filtered.filter(c => {
        const lb = c.lastBooking ? new Date(c.lastBooking) : null;
        return lb && lb <= to;
      });
    }

    // Minimum revenue filter
    if (filterMinRevenue && Number(filterMinRevenue) > 0) {
      const min = Number(filterMinRevenue);
      filtered = filtered.filter(c => Number(c.totalRevenue || 0) >= min);
    }

    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'lastBooking':
          aVal = new Date(a.lastBooking);
          bVal = new Date(b.lastBooking);
          break;
        case 'totalBookings':
          aVal = a.totalBookings;
          bVal = b.totalBookings;
          break;
        case 'totalRevenue':
          aVal = a.totalRevenue;
          bVal = b.totalRevenue;
          break;
        case 'joinDate':
          aVal = new Date(a.joinDate);
          bVal = new Date(b.joinDate);
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    setFilteredCustomers(filtered);
  }, [customers, searchTerm, statusFilter, serviceFilter, sortBy, sortOrder, filterFromDate, filterToDate, filterMinRevenue]);

  const stats = useMemo(
    () => {
      const pendingBookingsCount = allBookingsData.filter(b => b.status === 'pending').length;
      
      return {
        total: customers.length,
        active: customers.filter((c) => c.status === "active").length,
        pending: customers.filter((c) => c.status === "pending").length,
        rejected: customers.filter((c) => c.status === "rejected").length,
        cancelled: customers.filter((c) => c.status === "cancelled").length,
        archived: customers.filter((c) => c.status === "archived").length,
        totalBookings: customers.reduce((a, c) => a + c.totalBookings, 0),
        pendingBookings: pendingBookingsCount,
        totalRevenue: customers.reduce((a, c) => a + c.totalRevenue, 0),
        avgBookingsPerCustomer:
          customers.length > 0
            ? (customers.reduce((a, c) => a + c.totalBookings, 0) / customers.length).toFixed(1)
            : 0,
        avgRevenuePerCustomer:
          customers.length > 0
            ? (customers.reduce((a, c) => a + c.totalRevenue, 0) / customers.length).toFixed(0)
            : 0,
      };
    },
    [customers, allBookingsData]
  );

  const services = [...new Set(allBookingsData.map(b => b.service))];

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleManualRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    showNotification("Data refreshed successfully!", "success");
  };

  const updateCustomerStatus = (email, newStatus) => {
    setCustomerStatusOverrides(prev => {
      const newMap = new Map(prev);
      newMap.set(email, newStatus);
      return newMap;
    });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleApprove = async (customer) => {
    setIsProcessing(true);
    try {
      console.log('🔵 Approving customer and their pending bookings:', customer.name);
      
      // Find all pending bookings for this customer
      const pendingBookings = customer.bookings.filter(b => b.status === 'pending');
      console.log('📋 Found', pendingBookings.length, 'pending bookings to approve');
      
      // Approve each pending booking via API
      for (const booking of pendingBookings) {
        await handleApproveBooking(booking);
      }
      
      // Update customer status
      updateCustomerStatus(customer.email, 'active');
      showNotification(`${customer.name} and ${pendingBookings.length} booking(s) approved!`, "success");
    } catch (error) {
      console.error('❌ Error approving customer:', error);
      showNotification("Failed to approve customer", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (customer) => {
    setIsProcessing(true);
    try {
      console.log('🔵 Rejecting customer and their pending bookings:', customer.name);
      
      // Find all pending bookings for this customer
      const pendingBookings = customer.bookings.filter(b => b.status === 'pending');
      console.log('📋 Found', pendingBookings.length, 'pending bookings to reject');
      
      // Reject each pending booking via API
      for (const booking of pendingBookings) {
        await handleRejectBooking(booking);
      }
      
      // Update customer status
      updateCustomerStatus(customer.email, 'rejected');
      showNotification(`${customer.name} and ${pendingBookings.length} booking(s) rejected.`, "error");
    } catch (error) {
      console.error('❌ Error rejecting customer:', error);
      showNotification("Failed to reject customer", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchive = (customer) => {
    setIsProcessing(true);
    setTimeout(() => {
      updateCustomerStatus(customer.email, 'archived');
      setIsProcessing(false);
      showNotification(`${customer.name} archived successfully!`, "success");
    }, 500);
  };

  const handleUnarchive = (customer) => {
    setIsProcessing(true);
    setTimeout(() => {
      updateCustomerStatus(customer.email, 'active');
      setIsProcessing(false);
      showNotification(`${customer.name} unarchived successfully!`, "success");
    }, 500);
  };

  // Booking approval/rejection handlers
  const handleApproveBooking = async (booking) => {
    setIsProcessing(true);
    try {
      console.log('🔵 CustomerManagement: Approving booking', booking.id, 'Full booking:', booking);
      
      if (!AuthService.isAuthenticated()) throw new Error('Not authenticated');
      
      // Check for overlapping bookings before approving
      const conflictCheckUrl = `${API_BASE_URL}/bookings/check-conflict`;
      const conflictResponse = await fetch(conflictCheckUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          location: booking.location,
          excludeBookingId: booking.id
        })
      });

      const conflictData = await conflictResponse.json();
      
      // If there are approved overlapping bookings, log and show a non-blocking warning,
      // but allow the approver to proceed. Admins can intentionally approve overlapping bookings.
      const approvedConflicts = conflictData.conflicts?.filter(c => c.status === 'approved') || [];
      if (approvedConflicts.length > 0) {
        const conflictMessages = approvedConflicts.map(c => 
          `• ${c.customerName} - ${c.service} (${c.startTime} - ${c.endTime})`
        ).join('\n');
        console.warn('Overlap warning (non-blocking):', conflictMessages);
        showNotification(`Warning: Approving may create a scheduling conflict with ${approvedConflicts.length} approved booking(s).`, 'warning');
        // continue without blocking
      }
      
      const url = `${API_BASE_URL}/bookings/${booking.id}/status`;
      console.log('📡 Making PUT request to:', url);
      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });

      console.log('Response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.status === 409) {
        // Approval blocked by server because an approved overlapping booking exists
        const conflicts = (data && data.conflicts) || [];
        setConflictDetails(conflicts);
        setShowConflictModal(true);
        showNotification(data.message || 'Cannot approve booking due to conflict', 'error');
        setIsProcessing(false);
        return;
      }

      if (response.ok && data.success) {
        console.log('CustomerManagement: Booking approved successfully');
        
        // Use the updated booking data from backend (includes invoice_id)
        const updatedBooking = data.booking || booking;
        console.log('sUpdated booking with invoice:', updatedBooking);
        
        // Send notification to customer with invoice info
        NotificationService.notifyBookingConfirmed(updatedBooking);
        
        // Removed duplicate admin notification - admin already knows they approved it
        // and the showNotification below already provides feedback
        
        // Dispatch event to update other components
        window.dispatchEvent(new CustomEvent('bookingsUpdated', {
          detail: { reload: true }
        }));
        
        setRefreshTrigger(prev => prev + 1);
        
        const invoiceMsg = updatedBooking.invoice_id ? ` (Invoice #${updatedBooking.invoice_id})` : '';
        const customerName = updatedBooking.customer_name || updatedBooking.customerName || booking.customer_name || booking.customerName || booking.email;
        showNotification(`${customerName} booking approved and customer notified${invoiceMsg ? ':' + invoiceMsg : '!'}`, "success");
      } else {
        console.error('❌ Failed to approve:', data);
        throw new Error(data.message || 'Failed to approve booking');
      }
    } catch (error) {
      console.error('❌ Error approving booking:', error);
      showNotification(error.message || "Failed to approve booking", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectBooking = async (booking) => {
    setIsProcessing(true);
    try {
      console.log('🔵 CustomerManagement: Rejecting booking', booking.id, 'Full booking:', booking);
      
      if (!AuthService.isAuthenticated()) throw new Error('Not authenticated');
      const url = `${API_BASE_URL}/bookings/${booking.id}/status`;
      console.log('📡 Making PUT request to:', url);
      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });

      console.log('📥 Response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('📦 Response data:', data);

      if (response.ok && data.success) {
        console.log('✅ CustomerManagement: Booking rejected successfully');
        
        // Send notification to customer
        NotificationService.notifyBookingRejected(booking);
        // Notify admins that a booking was rejected
        NotificationService.createAdminNotification({
          type: 'info',
          title: 'Booking Rejected',
          message: `Booking for ${booking.customerName || booking.email} was rejected.`,
          data: {
            bookingId: booking.id,
            customer: booking.customerName || booking.email,
            email: booking.email,
            service: booking.service,
            date: booking.date,
            status: 'rejected'
          }
        });
        
        // Dispatch event to update other components
        window.dispatchEvent(new CustomEvent('bookingsUpdated', {
          detail: { reload: true }
        }));
        
        setRefreshTrigger(prev => prev + 1);
        showNotification(`Booking rejected and customer notified.`, "info");
      } else {
        console.error('❌ Failed to reject:', data);
        throw new Error(data.message || 'Failed to reject booking');
      }
    } catch (error) {
      console.error('❌ Error rejecting booking:', error);
      showNotification(error.message || "Failed to reject booking", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportData = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Status', 'Total Bookings', 'Last Booking', 'Total Revenue', 'Address'],
      ...filteredCustomers.map(c => [
        c.name, c.email, c.phone, c.status, c.totalBookings, 
        formatDate(c.lastBooking), formatCurrency(c.totalRevenue || 0), c.address
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification("Data exported successfully!", "success");
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: "#22c55e",
      pending: "#f59e0b",
      cancelled: "#ef4444",
      rejected: "#ef4444",
      archived: "#6b7280",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: colors[status] + "33",
          color: colors[status],
          textTransform: "capitalize",
        }}
      >
        {status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // use shared formatCurrency from utils

  const getSortIcon = (field) => {
    if (sortBy !== field) return <FaSort />;
    return sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  const styles = {
    // Make CustomerManagement use the same clean, centered card/table design as Inventory
    container: {
      minHeight: 'auto',
      background: 'transparent',
      padding: 0,
      color: '#0f172a',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
      flexWrap: "wrap",
      gap: "12px",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    title: {
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: '28px',
      fontWeight: '600',
      margin: 0,
      color: '#0f172a'
    },
    button: {
      backgroundColor: 'transparent',
      border: '1px solid #cbd5e1',
      color: '#0f172a',
      padding: '8px 14px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },

    // UPDATED: Stats row - same as inventory (bigger, closer together, centered)
    statsContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px', // Reduced gap to move cards closer together
      margin: '0 auto 26px',
      alignItems: 'stretch',
      padding: '0 20px',
      boxSizing: 'border-box',
      justifyContent: 'space-between',
      maxWidth: '100%'
    },
    // UPDATED: Stat cards - bigger and centered content like inventory
    statCard: {
      flex: '1 1 160px', // Increased minimum width
      minWidth: 140, // Increased minimum width
      maxWidth: 200, // Increased maximum width
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '16px 14px', // Increased padding for bigger appearance
      textAlign: 'center', // Center all content
      transition: 'all 0.18s ease',
      minHeight: 90, // Increased height
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center', // Center horizontally
      justifyContent: 'center', // Center vertically
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
    },
    statIcon: { 
      marginBottom: 8, // Consistent margin
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    statNumber: {
      fontSize: '22px', // Increased font size
      fontWeight: 700,
      color: '#0f172a',
      marginTop: 6,
      textAlign: 'center'
    },
    statLabel: {
      fontSize: '14px', // Slightly increased font size
      color: '#64748b',
      marginTop: 4,
      textAlign: 'center'
    },

    // Filter bar / controls (adapted)
    filterBar: {
      display: "flex",
      gap: "12px",
      marginBottom: "20px",
      alignItems: "center",
      flexWrap: "wrap",
      background: "#ffffff",
      padding: "12px 16px",
      borderRadius: "10px",
      border: "1px solid #e2e8f0",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    input: {
      flex: 1,
      minWidth: "200px",
      padding: "10px 12px",
      borderRadius: "8px",
      border: "1px solid #cbd5e1",
      backgroundColor: "#ffffff",
      color: "#0f172a",
      fontSize: "14px",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    select: {
      padding: "10px",
      borderRadius: "8px",
      border: "1px solid #cbd5e1",
      backgroundColor: "#ffffff",
      color: "#0f172a",
      minWidth: "140px",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },

    // Card list
    cardGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
      gap: "18px",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    customerCard: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '18px',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },

    // Table view (adapted)
    tableWrap: {
      width: '100%',
      overflowX: 'auto',
      background: 'transparent',
      borderRadius: 8,
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: 800,
      color: '#0f172a',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    th: {
      textAlign: 'center', // changed: center table headers
      padding: '12px',
      color: '#3b82f6',
      borderBottom: '1px solid #e2e8f0',
      fontWeight: 600,
      fontSize: 14,
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #f1f5f9',
      color: '#0f172a',
      textAlign: 'center', // changed: center table data
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },

    // Modal / overlays (adapted from inventory)
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    modal: {
      background: "#ffffff",
      padding: "24px",
      borderRadius: "12px",
      width: "680px",
      maxWidth: "95vw",
      color: "#0f172a",
      maxHeight: "85vh",
      overflowY: "auto",
      border: "1px solid #e2e8f0",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },

    // Buttons used in modal/actions
    actionBtn: {
      padding: "8px 14px",
      borderRadius: "8px",
      border: "1px solid",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "#fff",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    approveBtn: {
      background: '#3b82f6',
      color: '#fff',
      borderColor: '#3b82f6'
    },
    rejectBtn: {
      background: '#ef4444',
      color: '#fff',
      borderColor: '#ef4444'
    },
    archiveBtn: {
      background: 'transparent',
      color: '#f59e0b',
      borderColor: '#fbbf24'
    },
    unarchiveBtn: {
      background: 'transparent',
      color: '#22c55e',
      borderColor: '#22c55e'
    },

    // Booking item in modal
    bookingItem: {
      background: '#f8fafc',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '12px',
      border: '1px solid #e2e8f0'
    },

    // View toggles
    viewToggle: {
      display: "flex",
      gap: "6px",
      background: "#ffffff",
      padding: "4px",
      borderRadius: "8px",
      border: "1px solid #e2e8f0"
    },
    toggleBtn: {
      padding: "8px 12px",
      background: "transparent",
      border: "none",
      color: "#64748b",
      cursor: "pointer",
      borderRadius: "6px",
      fontSize: "14px",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    activeToggle: {
      background: '#3b82f6',
      color: '#ffffff',
      fontWeight: 700
    },

    // Notification (kept visible and matching Inventory look)
    notification: {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "14px 18px",
      borderRadius: "8px",
      color: "#fff",
      fontWeight: "600",
      zIndex: 10000,
      minWidth: "260px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }
  };

  return (
    <div className="cm-root" style={styles.container}>
      {/* Notification */}
      {notification && (
        <div
          style={{
            ...styles.notification,
            backgroundColor:
              notification.type === "success"
                ? "rgba(34,197,94,0.9)"
                : "rgba(239,68,68,0.9)",
          }}
        >
          {notification.type === "success" ? (
            <FaCheckCircle size={20} />
          ) : (
            <FaTimesCircle size={20} />
          )}
          {notification.message}
        </div>
      )}

      {/* Conflict modal for approvals blocked by server (409) */}
      {showConflictModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Cannot Approve Booking</h3>
              <button onClick={() => { setShowConflictModal(false); setConflictDetails([]); }} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ color: '#475569' }}>One or more overlapping bookings have already been approved. Review the conflicts below.</p>
            <div>
              {conflictDetails.length === 0 ? (
                <div style={{ color: '#64748b' }}>No conflict details provided.</div>
              ) : (
                conflictDetails.map((c, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8, background: '#f8fafc' }}>
                    <div style={{ fontWeight: 700 }}>{c.customer_name || c.customerName || c.customer}</div>
                    <div style={{ color: '#475569' }}>{c.service || c.title || ''}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>{(c.date || c.bookingDate) ? `${(c.date || c.bookingDate)} ${c.start_time || c.startTime || ''} - ${c.end_time || c.endTime || ''}` : `${c.start_time || c.startTime || ''} - ${c.end_time || c.endTime || ''}`}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>{c.location || ''}</div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => { setShowConflictModal(false); setConflictDetails([]); }} style={{ ...styles.actionBtn, borderColor: '#e2e8f0' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- REPLACED: compact top area with stats + controls (removed large "Customer Management" title) --- */}
      <div style={{ width: '100%', marginBottom: 20 }}>
        {/* UPDATED: Stats row - same as inventory (bigger, closer together, centered) */}
        <div style={styles.statsContainer}>
          <div style={styles.statCard}>
            <FaUsers size={32} color="#60a5fa" style={styles.statIcon} />
            <div style={{ ...styles.statNumber, color: '#60a5fa' }}>{stats.total}</div>
            <div style={styles.statLabel}>Total Customers</div>
          </div>
          
          <div style={styles.statCard}>
            <FaUserCheck size={32} color="#22c55e" style={styles.statIcon} />
            <div style={{ ...styles.statNumber, color: '#22c55e' }}>{stats.active}</div>
            <div style={styles.statLabel}>Active Customers</div>
          </div>
          
          <div style={styles.statCard}>
            <FaClock size={32} color="#f59e0b" style={styles.statIcon} />
            <div style={{ ...styles.statNumber, color: '#f59e0b' }}>{stats.pending}</div>
            <div style={styles.statLabel}>Pending Approval</div>
          </div>
          
          <div style={styles.statCard}>
            <FaArchive size={32} color="#6b7280" style={styles.statIcon} />
            <div style={{ ...styles.statNumber, color: '#6b7280' }}>{stats.archived}</div>
            <div style={styles.statLabel}>Archived</div>
          </div>
          
          <div style={styles.statCard}>
            <FaBookOpen size={32} color="#0369a1" style={styles.statIcon} />
            <div style={{ ...styles.statNumber, color: '#0369a1' }}>{stats.totalBookings}</div>
            <div style={styles.statLabel}>Total Bookings</div>
          </div>

          {stats.pendingBookings > 0 && (
            <div style={{
              ...styles.statCard,
              border: "2px solid #f59e0b",
              position: "relative"
            }}>
              <FaBell size={32} color="#f59e0b" style={styles.statIcon} />
              <div style={{ ...styles.statNumber, color: '#f59e0b' }}>{stats.pendingBookings}</div>
              <div style={styles.statLabel}>Pending Bookings</div>
              <div style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#f59e0b"
              }}></div>
            </div>
          )}
          
          <div style={styles.statCard}>
            <FaChartBar size={32} color="#8b5cf6" style={styles.statIcon} />
            <div style={{ ...styles.statNumber, color: '#8b5cf6' }}>{formatCurrency(stats.totalRevenue)}</div>
            <div style={styles.statLabel}>Total Revenue</div>
          </div>
        </div>

        {/* Controls row: search, filters, sort, view toggle, export */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 480px", minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", flex: 1 }}>
              <FaSearch size={16} style={{ color: "#0369a1" }} />
              <input
                type="text"
                placeholder="Search customers — name, email, phone, or address"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: "none", outline: "none", width: "100%", fontSize: 14, color: "#0f172a", background: "transparent" }}
              />
            </div>

            <StyledSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ ...styles.select, minWidth: 160 }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </StyledSelect>

            <StyledSelect
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              style={{ ...styles.select, minWidth: 160 }}
            >
              <option value="all">All Services</option>
              {services.map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </StyledSelect>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={styles.viewToggle}>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(viewMode === "cards" ? styles.activeToggle : {})
                }}
                onClick={() => setViewMode("cards")}
              >
                Cards
              </button>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(viewMode === "table" ? styles.activeToggle : {})
                }}
                onClick={() => setViewMode("table")}
              >
                Table
              </button>
            </div>

            <StyledSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ ...styles.select, minWidth: 160 }}
            >
              <option value="lastBooking">Last Booking</option>
              <option value="name">Name</option>
              <option value="totalBookings">Total Bookings</option>
              <option value="totalRevenue">Revenue</option>
              <option value="joinDate">Join Date</option>
              <option value="status">Status</option>
            </StyledSelect>

            <button
              style={styles.button}
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title="Toggle sort order"
            >
              {sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
            </button>

            <button
              style={{ ...styles.button, display: "flex", alignItems: "center", gap: 8 }}
              onClick={handleExportData}
            >
              <FaDownload size={14} /> Export
            </button>
            <button
              style={{ ...styles.button, display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => setShowFiltersPanel(prev => !prev)}
              title="Filters"
            >
              <FaFilter size={14} /> Filters
            </button>
          </div>
        </div>
      </div>
      {/* Filters panel */}
      {showFiltersPanel && (
        <div style={{ padding: 12, marginTop: 10, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>From</label>
            <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>To</label>
            <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>Min Revenue</label>
            <input type="number" min={0} step={100} value={filterMinRevenue} onChange={e => setFilterMinRevenue(e.target.value)} placeholder="0" style={{ padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 120 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button style={styles.button} onClick={() => { setShowFiltersPanel(false); }}>Apply</button>
            <button style={styles.button} onClick={() => { setFilterFromDate(''); setFilterToDate(''); setFilterMinRevenue(''); }}>Clear</button>
          </div>
        </div>
      )}
      {/* --- END REPLACED AREA --- */}

      {/* Customer Display: cards OR table depending on viewMode */}
      {viewMode === "cards" ? (
        <div style={styles.cardGrid}>
          {filteredCustomers.map((c) => (
            <div key={c.id} style={styles.customerCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0, color: "#1e293b", fontSize: "18px" }}>
                  <FaUser size={16} color="#0369a1" /> {c.name}
                </h3>
                {getStatusBadge(c.status)}
              </div>
              
              <div style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" }}>
                <p style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                  <FaEnvelope size={12} color="#0369a1" /> {c.email}
                </p>
                <p style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                  <FaPhone size={12} color="#0369a1" /> {c.phone}
                </p>
                <p style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                  <FaMapMarkerAlt size={12} color="#0369a1" /> {c.address}
                </p>
                <p style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                  <FaCalendarAlt size={12} color="#64ffda" /> Last: {formatDate(c.lastBooking)}
                </p>
              </div>
              
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
                padding: "12px",
                background: "rgba(3, 105, 161, 0.05)",
                borderRadius: "8px",
                border: "1px solid rgba(3, 105, 161, 0.1)"
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#0369a1" }}>
                    {c.totalBookings}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Bookings</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#0369a1" }}>
                    {formatCurrency(c.totalRevenue)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Revenue</div>
                </div>
              </div>

              {/* Pending Bookings Alert */}
              {c.bookings.filter(b => b.status === 'pending').length > 0 && (
                <div style={{
                  padding: "8px 12px",
                  marginBottom: "12px",
                  backgroundColor: "#fef3c7",
                  border: "1px solid #f59e0b",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#92400e",
                  fontWeight: "600"
                }}>
                  <FaBell size={14} color="#f59e0b" />
                  {c.bookings.filter(b => b.status === 'pending').length} Pending Booking{c.bookings.filter(b => b.status === 'pending').length > 1 ? 's' : ''}
                </div>
              )}
              
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  style={styles.button}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCustomer(c);
                    setShowCustomerDetails(true);
                  }}
                >
                  <FaEye size={14} /> View Details
                </button>
                
                {c.status !== "archived" && c.status !== "pending" && (
                  <button
                    style={{ ...styles.button, ...styles.archiveBtn }}
                    onClick={(e) => { e.stopPropagation(); handleArchive(c); }}
                  >
                    <FaArchive size={12} /> Archive
                  </button>
                )}
                {c.status === "archived" && (
                  <button
                    style={{ ...styles.button, ...styles.unarchiveBtn }}
                    onClick={(e) => { e.stopPropagation(); handleUnarchive(c); }}
                  >
                    <FaUndo size={12} /> Unarchive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Bookings</th>
                <th style={styles.th}>Last Booking</th>
                <th style={styles.th}>Revenue</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>{c.name}</td>
                  <td style={styles.td}>{c.email}</td>
                  <td style={styles.td}>{c.phone}</td>
                  <td style={styles.td}>{getStatusBadge(c.status)}</td>
                  <td style={styles.td}>{c.totalBookings}</td>
                  <td style={styles.td}>{formatDate(c.lastBooking)}</td>
                  <td style={styles.td}>{formatCurrency(c.totalRevenue)}</td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        style={styles.button}
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); setShowCustomerDetails(true); }}
                      >
                        <FaEye size={14} /> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredCustomers.length === 0 && (
        <div style={{ 
          textAlign: "center", 
          color: "#94a3b8", 
          padding: "60px 40px",
          background: "rgba(255, 255, 255, 0.8)",
          borderRadius: "12px",
          border: "1px solid rgba(3, 105, 161, 0.2)"
        }}>
          <FaUser size={48} style={{ marginBottom: "20px", opacity: 0.5, color: "#0369a1" }} />
          <h3 style={{ color: "#1e293b", marginBottom: "8px" }}>No customers found</h3>
          <p>Try adjusting your search criteria or filters.</p>
        </div>
      )}

      {/* Customer Details Modal */}
      {showCustomerDetails && selectedCustomer && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h2 style={{ margin: "0 0 8px 0", color: "#0369a1", fontSize: "24px" }}>
                  {selectedCustomer.name}
                </h2>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
                  {getStatusBadge(selectedCustomer.status)}
                  <span style={{ color: "#64748b", fontSize: "14px" }}>
                    Customer since {formatDate(selectedCustomer.joinDate)}
                  </span>
                </div>
              </div>
              <button
                style={{ ...styles.button, padding: "8px", minWidth: "auto" }}
                onClick={() => setShowCustomerDetails(false)}
              >
                <FaTimes size={16} />
              </button>
            </div>
            
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
              padding: "16px",
              background: "rgba(3, 105, 161, 0.05)",
              borderRadius: "12px",
              border: "1px solid rgba(3, 105, 161, 0.1)"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "20px", fontWeight: "700", color: "#0369a1" }}>
                  {selectedCustomer.totalBookings}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Total Bookings</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "#f59e0b" }}>
                  {formatCurrency(selectedCustomer.totalRevenue)}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Total Revenue</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#22c55e" }}>
                  {selectedCustomer.preferredServices[0] || 'N/A'}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Preferred Service</div>
              </div>
            </div>
            
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ color: "#0369a1", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaUser /> Contact Information
              </h3>
              <div style={{
                background: "rgba(241, 245, 249, 0.8)",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid rgba(3, 105, 161, 0.15)"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <p style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                      <FaEnvelope size={14} color="#0369a1" /> 
                      <span style={{ color: "#1e293b" }}>{selectedCustomer.email}</span>
                    </p>
                    <p style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                      <FaPhone size={14} color="#0369a1" /> 
                      <span style={{ color: "#1e293b" }}>{selectedCustomer.phone}</span>
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                      <FaMapMarkerAlt size={14} color="#0369a1" /> 
                      <span style={{ color: "#1e293b" }}>{selectedCustomer.address}</span>
                    </p>
                    <p style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                      <FaCalendarAlt size={14} color="#0369a1" /> 
                      <span style={{ color: "#1e293b" }}>Last booking: {formatDate(selectedCustomer.lastBooking)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Booking Summary - Total Count Only */}
            <div style={{
              marginTop: "20px",
              padding: "16px",
              background: "linear-gradient(135deg, rgba(3, 105, 161, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
              borderRadius: "12px",
              border: "1px solid rgba(3, 105, 161, 0.2)"
            }}>
              <h3 style={{ color: "#0369a1", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaBookOpen /> Booking Summary
              </h3>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ 
                  padding: "12px 16px", 
                  background: "white", 
                  borderRadius: "8px",
                  border: "1px solid rgba(3, 105, 161, 0.2)",
                  flex: "1 1 auto"
                }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>Total Bookings</p>
                  <p style={{ margin: 0, fontSize: "24px", color: "#0369a1", fontWeight: "bold" }}>
                    {selectedCustomer.totalBookings}
                  </p>
                </div>
                <div style={{ 
                  padding: "12px 16px", 
                  background: "white", 
                  borderRadius: "8px",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  flex: "1 1 auto"
                }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>Approved</p>
                  <p style={{ margin: 0, fontSize: "24px", color: "#22c55e", fontWeight: "bold" }}>
                    {selectedCustomer.bookings.filter(b => b.status === 'approved').length}
                  </p>
                </div>
                <div style={{ 
                  padding: "12px 16px", 
                  background: "white", 
                  borderRadius: "8px",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  flex: "1 1 auto"
                }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>Pending</p>
                  <p style={{ margin: 0, fontSize: "24px", color: "#f59e0b", fontWeight: "bold" }}>
                    {selectedCustomer.bookings.filter(b => b.status === 'pending').length}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Action buttons in modal */}
            <div style={{
              display: "flex",
              gap: "12px",
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: "1px solid rgba(100, 255, 218, 0.2)",
              flexWrap: "wrap"
            }}>
              {selectedCustomer.status === "pending" && (
                <>
                  <button
                    style={{ ...styles.button, ...styles.approveBtn, flex: 1, justifyContent: "center", padding: "12px" }}
                    onClick={() => {
                      handleApprove(selectedCustomer);
                      setShowCustomerDetails(false);
                    }}
                  >
                    <FaThumbsUp /> Approve
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.rejectBtn, flex: 1, justifyContent: "center", padding: "12px" }}
                    onClick={() => {
                      handleReject(selectedCustomer);
                      setShowCustomerDetails(false);
                    }}
                  >
                    <FaThumbsDown /> Reject
                  </button>
                </>
              )}
              
              {selectedCustomer.status !== "archived" && selectedCustomer.status !== "pending" && (
                <button
                  style={{ ...styles.button, ...styles.archiveBtn, flex: 1, justifyContent: "center", padding: "12px" }}
                  onClick={() => {
                    handleArchive(selectedCustomer);
                    setShowCustomerDetails(false);
                  }}
                >
                  <FaArchive /> Archive Customer
                </button>
              )}
              
              {selectedCustomer.status === "archived" && (
                <button
                  style={{ ...styles.button, ...styles.unarchiveBtn, flex: 1, justifyContent: "center", padding: "12px" }}
                  onClick={() => {
                    handleUnarchive(selectedCustomer);
                    setShowCustomerDetails(false);
                  }}
                >
                  <FaUndo /> Unarchive Customer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div style={styles.modalOverlay}>
          <div style={{
            ...styles.modal,
            width: "300px",
            textAlign: "center",
            padding: "40px"
          }}>
            <FaSpinner size={32} color="#64ffda" style={{ 
              animation: "spin 1s linear infinite",
              marginBottom: "16px"
            }} />
            <p style={{ margin: 0, fontSize: "16px" }}>Processing request...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.cm-root),
        :global(.cm-root *) {
          font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.02);
          }
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        @media (max-width: 768px) {
          .stats-container {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        
        @media (max-width: 480px) {
          .stats-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomerManagement;