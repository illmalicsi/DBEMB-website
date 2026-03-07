import React, { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/formatters';
import { useLocation } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { FaCreditCard, FaArrowLeft, FaDollarSign, FaUser, FaClock, FaCheck, FaTimes, FaSpinner, FaReceipt, FaEye } from '../icons/fa';
import AuthService from '../services/authService';
import { API_BASE_URL } from '../services/apiConfig';

const Payment = ({ onBackToHome }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentType, setPaymentType] = useState('full'); // 'full' or 'down' (50%)
  const [receipt, setReceipt] = useState(null);
  const [userDetails, setUserDetails] = useState({});
  // Detect if page was opened with forceFull in the query string (e.g., from a reminder link)
  const location = useLocation ? useLocation() : null;
  const params = location ? new URLSearchParams(location.search) : null;
  const initialForceFull = params && (params.get('forceFull') === '1' || params.get('forceFull') === 'true');
  const [forceFull, setForceFull] = useState(!!initialForceFull);

  // Transactions are persisted server-side by the billing API when payments are created
  // (POST /api/billing/payments creates both a payment and a transactions row).
  // No localStorage persistence is used here to keep the server as the source of truth.

  // Helper to coerce numeric fields safely to a finite number (fallback 0)
  const safe = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const fetchInvoices = async () => {
    try {
      const res = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/billing/invoices`
      );
      const data = await res.json();
      if (res.ok) {
        // Fetch payment totals for each invoice
        const invoicesWithPayments = await Promise.all(
          data.invoices.map(async (inv) => {
            try {
              // Get all payments for this invoice
              const paymentsRes = await AuthService.makeAuthenticatedRequest(
                `${API_BASE_URL}/billing/invoices/${inv.invoice_id}/payments`
              );
              const paymentsData = await paymentsRes.json();

              if (paymentsRes.ok && paymentsData.payments) {
                const totalPaid = paymentsData.payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || p.amount || 0), 0);
                // payments are returned ordered by processed_at DESC (most recent first)
                const mostRecent = paymentsData.payments[0];
                const lastPaymentMethod = mostRecent ? String((mostRecent.payment_method || mostRecent.method || '')).toLowerCase() : null;
                // Compute a client-side payment_status so UI updates immediately even if backend hasn't propagated the change yet
                let computedStatus = 'unpaid';
                const invAmount = safe(inv.amount);
                if (invAmount > 0 && totalPaid >= invAmount) computedStatus = 'paid';
                else if (totalPaid > 0) computedStatus = 'partial';
                return { ...inv, totalPaid, lastPaymentMethod, payment_status: computedStatus };
              }
            } catch (err) {
              console.error('Error fetching payments for invoice', inv.invoice_id, err);
            }
            return { ...inv, totalPaid: 0 };
          })
        );

        setInvoices(invoicesWithPayments);
        // Fetch user details for each invoice
        const userIds = [...new Set(invoicesWithPayments.map(inv => inv.user_id))];
        const details = {};
        for (const uid of userIds) {
          try {
            const resUser = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/users/${uid}`);
            const userData = await resUser.json();
            if (userData.success && userData.user) {
              details[uid] = userData.user;
            }
          } catch { }
        }
        setUserDetails(details);
      } else {
        setErrorMsg(data.message || 'Failed to load invoices');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePayment = async () => {
    if (!selectedInvoice) return;
    setErrorMsg('');
    setSuccessMsg('');
    setProcessingId(selectedInvoice.invoice_id);
    try {
      // Calculate payment amount based on payment type and outstanding balance
      const totalAmount = safe(selectedInvoice.amount);
      const alreadyPaid = safe(selectedInvoice.totalPaid || 0);
      const outstandingBalance = totalAmount - alreadyPaid;
      const paymentAmount = paymentType === 'down' ? outstandingBalance * 0.5 : outstandingBalance;
      const newRemainingBalance = outstandingBalance - paymentAmount;

      const res = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/billing/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            invoiceId: selectedInvoice.invoice_id,
            amountPaid: paymentAmount,
            paymentMethod,
            paymentType,
            totalAmount,
            remainingBalance: newRemainingBalance,
            forceFull: !!forceFull
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        // Prefer using invoice description (if present) for a clearer message
        const invoiceLabel = selectedInvoice.description ? selectedInvoice.description : `Invoice ${selectedInvoice.invoice_id}`;
        const paymentStatusMsg = paymentType === 'down' ? 'Partial payment' : 'Full payment';
        setSuccessMsg(`${paymentStatusMsg} of ${formatCurrency(paymentAmount)} recorded successfully for ${invoiceLabel}`);
        setReceipt({
          invoice: selectedInvoice,
          user: userDetails[selectedInvoice.user_id],
          paymentMethod,
          paymentType,
          paymentAmount,
          totalAmount,
          alreadyPaid,
          remainingBalance: newRemainingBalance,
          payment: data.payment
        });
        // Refresh invoices to show updated payment status
        // Determine and update payment status on the invoice
        const newStatus = newRemainingBalance > 0 ? 'partial' : 'paid';
        try {
          await updatePaymentStatus(selectedInvoice.invoice_id, newStatus);
        } catch (e) {
          // ignore - updatePaymentStatus handles its own errors and messages
        }
        await fetchInvoices();
        // Notify other views (e.g., TransactionHistory) to refresh
        try { window.dispatchEvent(new Event('transactionsUpdated')); } catch (e) {}
        setShowModal(false);
      } else {
        setErrorMsg(data.message || 'Failed to process payment');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const updatePaymentStatus = async (invoiceId, newStatus) => {
    setErrorMsg('');
    setSuccessMsg('');
    setProcessingId(invoiceId);
    try {
      const res = await AuthService.makeAuthenticatedRequest(
        `${API_BASE_URL}/billing/invoices/${invoiceId}/payment-status`,
        {
          method: 'PUT',
          body: JSON.stringify({ payment_status: newStatus }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Invoice #${invoiceId} marked as ${newStatus}`);
        // Refresh invoices
        await fetchInvoices();
      } else {
        setErrorMsg(data.message || 'Failed to update payment status');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const [actionMenuInvoice, setActionMenuInvoice] = useState(null);
  const [actionMenuStyle, setActionMenuStyle] = useState({ left: 0, top: 0 });
  const [manualModal, setManualModal] = useState({ open: false, invoice: null, mode: null, amount: 0 });

  // Close action menu when clicking outside or pressing Escape
  React.useEffect(() => {
    const onDocClick = (e) => {
      if (!actionMenuInvoice) return;
      const selector = `[data-action-menu-id="${actionMenuInvoice}"], [data-action-button-id="${actionMenuInvoice}"]`;
      if (!e.target.closest || !e.target.closest(selector)) {
        setActionMenuInvoice(null);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setActionMenuInvoice(null);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [actionMenuInvoice]);

  const sendReminder = async (inv) => {
    try {
      const balance = (parseFloat(inv.amount) || 0) - (parseFloat(inv.totalPaid || 0) || 0);
      const instrumentName = inv.instrument_name || inv.instrumentName || inv.description || null;
      const paymentLink = `${window.location.origin}/pay-exact?invoiceId=${inv.invoice_id}&amount=${balance.toFixed(2)}&forceFull=1`;
      // Professional reminder message and structured payload (polished format)
      const bookingDetails = inv.description || instrumentName || `Invoice ${inv.invoice_number || inv.invoice_id}`;
      const formattedAmount = formatCurrency(balance);
      const supportEmail = 'dbemb.service@gmail.com';

      const u = (userDetails && userDetails[inv.user_id]) || {};
      const recipientName = (u.firstName || u.first_name || u.name)
        ? `${u.firstName || u.first_name || u.name}${(u.lastName || u.last_name) ? ' ' + (u.lastName || u.last_name) : ''}`
        : 'Customer';

      const message = `Dear ${recipientName},\n\nThis is a gentle reminder regarding your outstanding balance of ${formattedAmount} for your booking: ${bookingDetails}.\n\nShould you have any questions or need further assistance, please feel free to contact us at ${supportEmail} or send us a message through our Facebook page.\n\nThank you for choosing our services.`;

      const payload = {
        userEmail: inv.user_email || (userDetails[inv.user_id] && userDetails[inv.user_id].email),
        type: 'reminder',
        title: 'Payment Reminder',
        message,
        data: { invoiceId: inv.invoice_id, balance, instrumentName, amount: balance, paymentType: 'full', forceFull: true, paymentLink, exact: true }
      };
      const res = await fetch(`${API_BASE_URL}/notifications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Reminder sent to customer');
      } else {
        setErrorMsg(data.message || 'Failed to send reminder');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send reminder');
    } finally {
      setActionMenuInvoice(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      base: {
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'inline-block'
      },
      approved: {
        backgroundColor: '#d1fae5',
        color: '#065f46',
        border: '1px solid #34d399'
      }
    };

    return (
      <span style={{ ...styles.base, ...styles[status] || styles.approved }}>
        {status}
      </span>
    );
  };

  const styles = {
    container: {
      padding: '20px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px'
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      color: '#64748b',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      textDecoration: 'none'
    },
    title: {
      fontSize: '22px',
      fontWeight: '700',
      color: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    titleIcon: {
      color: '#059669',
      fontSize: '20px'
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '0',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    },
    cardHeader: {
      padding: '16px 20px',
      borderBottom: '1px solid #f1f5f9',
      backgroundColor: '#fafbfc'
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#374151',
      margin: 0
    },
    cardBody: {
      padding: '0',
      overflowX: 'auto',
      maxHeight: 'calc(100vh - 200px)'
    },
    alert: {
      padding: '12px 20px',
      borderBottom: '1px solid',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '13px',
      fontWeight: '500'
    },
    alertSuccess: {
      backgroundColor: '#f0fdf4',
      color: '#166534',
      borderColor: '#bbf7d0'
    },
    alertError: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      borderColor: '#fecaca'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '13px'
    },
    tableHeader: {
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 10
    },
    th: {
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: '600',
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      whiteSpace: 'nowrap'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #f1f5f9',
      fontSize: '13px',
      color: '#374151',
      verticalAlign: 'middle'
    },
    invoiceRow: {
      transition: 'background-color 0.2s ease'
    },
    invoiceCard: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    invoiceId: {
      fontWeight: '600',
      color: '#1f2937',
      fontSize: '13px'
    },
    userInfo: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      color: '#374151',
      fontSize: '12px'
    },
    amount: {
      fontWeight: '600',
      fontSize: '14px',
      color: '#059669'
    },
    description: {
      color: '#6b7280',
      fontSize: '12px',
      maxWidth: '150px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    dateInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '11px',
      color: '#6b7280'
    },
    payButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      backgroundColor: '#059669',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap'
    },
    payButtonDisabled: {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
    },
    emptyState: {
      padding: '48px 24px',
      textAlign: 'center',
      color: '#6b7280'
    },
    emptyIcon: {
      fontSize: '40px',
      color: '#d1d5db',
      marginBottom: '12px'
    },
    emptyTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '6px'
    },
    emptyDescription: {
      fontSize: '13px',
      color: '#6b7280'
    },
    spinner: {
      width: '14px',
      height: '14px',
      border: '2px solid #ffffff',
      borderTop: '2px solid transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, padding: '64px', textAlign: 'center' }}>
          <div style={{ ...styles.spinner, margin: '0 auto 16px' }}></div>
          <div>Loading approved invoices...</div>
        </div>
      </div>
    );
  }

  const approvedInvoices = invoices.filter(inv => inv.status === 'approved' || inv.status === 'pending' || inv.status === 'paid');

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .back-button:hover {
            background-color: #f8fafc;
            border-color: #3b82f6;
            color: #3b82f6;
          }
          
          .invoice-row:hover {
            background-color: #f8fafc;
          }
          
          .pay-button:hover:not(:disabled) {
            background-color: #047857;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
          }
          .btn { 
            display: inline-flex; 
            align-items: center; 
            gap: 6px; 
            padding: 6px 10px; 
            border-radius: 6px; 
            cursor: pointer; 
            border: none; 
            font-weight: 600; 
            font-size: 13px; 
            transition: all 0.15s ease;
          }
          .btn-primary { background: #0ea5e9; color: #fff; }
          .btn-primary:hover { background: #0284c7; }
          .btn-outline { background: transparent; border: 1px solid #cbd5e1; color: #475569; }
          .btn-outline:hover { background: #f1f5f9; }

          /* Action menu styles */
          .action-menu {
            position: fixed;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.08);
            z-index: 1000;
            min-width: 200px;
            max-width: 280px;
          }
          .action-menu button {
            width: 100%;
            padding: 8px 12px;
            border-radius: 6px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            text-align: left;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .action-menu button:hover {
            background: #f8fafc;
          }
          .action-menu button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .action-menu .mark-partial {
            background: #f59e0b;
            color: #fff;
          }
          .action-menu .mark-partial:hover {
            background: #d97706;
          }
          .action-menu .mark-paid {
            background: #0ea5e9;
            color: #fff;
          }
          .action-menu .mark-paid:hover {
            background: #0284c7;
          }
          .action-menu .remind {
            border: 1px solid #e5e7eb;
            background: #fff;
            color: #374151;
          }
          .action-menu .remind:hover {
            background: #f8fafc;
            border-color: #d1d5db;
          }
        `}
      </style>

      <div style={styles.header}>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>
            Customer Payments ({approvedInvoices.length})
          </h2>
        </div>

        <div style={styles.cardBody}>
          {successMsg && (
            <div style={{ ...styles.alert, ...styles.alertSuccess }}>
              <FaCheck />
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div style={{ ...styles.alert, ...styles.alertError }}>
              <FaTimes />
              {errorMsg}
            </div>
          )}

          {approvedInvoices.length === 0 ? (
            <div style={styles.emptyState}>
              <FaReceipt style={styles.emptyIcon} />
              <div style={styles.emptyTitle}>No Customer Payments</div>
              <div style={styles.emptyDescription}>
                There are no customer payments to process at this time.
              </div>
            </div>
          ) : (
            <table style={styles.table}>
              <thead style={styles.tableHeader}>
                <tr>
                  <th style={styles.th}>User</th>
                  <th style={{...styles.th, textAlign: 'center'}}>Amount Required</th>
                  <th style={{...styles.th, textAlign: 'center'}}>Amount Paid</th>
                  <th style={{...styles.th, textAlign: 'center'}}>Balance</th>
                  <th style={styles.th}>Description</th>
                  <th style={{...styles.th, textAlign: 'center'}}>Payment Status</th>
                  <th style={styles.th}>Invoice Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedInvoices.map(inv => {
                  const amountRequired = parseFloat(inv.amount);
                  const amountPaid = parseFloat(inv.totalPaid || 0);
                  const balance = amountRequired - amountPaid;
                  const isPartiallyPaid = amountPaid > 0 && amountPaid < amountRequired;
                  const isFullyPaid = amountPaid >= amountRequired;

                  return (
                    <tr key={inv.invoice_id} style={styles.invoiceRow} className="invoice-row">
                      <td style={styles.td}>
                        <div style={styles.userInfo}>
                          <div style={{ fontWeight: '500' }}>
                            {userDetails[inv.user_id]?.firstName || ''} {userDetails[inv.user_id]?.lastName || ''}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {userDetails[inv.user_id]?.email || `ID: ${inv.user_id}`}
                          </div>
                        </div>
                      </td>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <div style={{fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                          {formatCurrency(amountRequired)}
                        </div>
                      </td>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <div style={{
                          fontWeight: '600',
                          fontSize: '13px',
                          color: isFullyPaid ? '#059669' : isPartiallyPaid ? '#f59e0b' : '#6b7280'
                        }}>
                          {formatCurrency(amountPaid)}
                        </div>
                      </td>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <div style={{
                          fontWeight: '600',
                          fontSize: '13px',
                          color: balance > 0 ? '#dc2626' : '#059669'
                        }}>
                          {formatCurrency(balance)}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.description} title={inv.description}>
                          {inv.description || 'No description'}
                        </div>
                      </td>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          backgroundColor: inv.payment_status === 'paid' ? '#d1fae5' : inv.payment_status === 'partial' ? '#fef3c7' : '#fef2f2',
                          color: inv.payment_status === 'paid' ? '#065f46' : inv.payment_status === 'partial' ? '#92400e' : '#b91c1c',
                          border: `1px solid ${inv.payment_status === 'paid' ? '#34d399' : inv.payment_status === 'partial' ? '#fcd34d' : '#fecaca'}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {inv.payment_status || 'unpaid'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {getStatusBadge(inv.status)}
                      </td>
                      <td style={{ ...styles.td, position: 'relative' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-start', alignItems: 'center' }}>
                          <button
                            title="Actions"
                            onClick={(e) => {
                              const id = inv.invoice_id;
                              const willClose = actionMenuInvoice === id;
                              if (willClose) {
                                setActionMenuInvoice(null);
                                return;
                              }
                              
                              // Calculate optimal position for the dropdown
                              const btn = e.currentTarget;
                              const btnRect = btn.getBoundingClientRect();
                              const menuWidth = 220;
                              const menuHeight = 160; // Approximate height
                              const gap = 0; // flush against the button (no gap)

                              // Default: position below and aligned to left of button (closer gap)
                              let left = btnRect.left;
                              let top = btnRect.bottom + gap;

                              // If menu would overflow right edge, prefer placing it to the LEFT of the button
                              if (left + menuWidth > window.innerWidth - gap) {
                                const leftOfButton = Math.round(btnRect.right - menuWidth - gap); // align menu right edge near button
                                if (leftOfButton >= gap) {
                                  left = leftOfButton;
                                } else {
                                  // fallback: clamp to viewport right edge
                                  left = Math.max(gap, window.innerWidth - menuWidth - gap);
                                }
                              }

                              // If menu would overflow bottom edge, place it above the button
                              if (top + menuHeight > window.innerHeight - gap) {
                                top = Math.max(gap, btnRect.top - menuHeight - gap);
                              }
                              
                              setActionMenuStyle({ left, top });
                              setActionMenuInvoice(id);
                            }}
                            className="btn btn-primary"
                            data-action-button-id={inv.invoice_id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 13 }}
                          >
                            <FaEye size={12} />
                            <span>View</span>
                          </button>

                          {/* Action menu */}
                          {actionMenuInvoice === inv.invoice_id && (
                            ReactDOM.createPortal(
                              <div 
                                className="action-menu"
                                data-action-menu-id={inv.invoice_id} 
                                style={{
                                  left: `${actionMenuStyle.left}px`,
                                  top: `${actionMenuStyle.top}px`
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {
                                    (() => {
                                      const lastMethod = (inv.lastPaymentMethod || inv.payment_method || '').toString().toLowerCase();
                                      const canMark = lastMethod === 'cash';
                                      return (
                                        <>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const id = inv.invoice_id;
                                              setProcessingId(id);
                                              setErrorMsg('');
                                              try {
                                                const outstanding = Math.max(0, parseFloat(inv.amount || 0) - parseFloat(inv.totalPaid || 0));
                                                const partialAmount = Math.round((outstanding * 0.5) * 100) / 100;
                                                if (partialAmount <= 0) {
                                                  setErrorMsg('No outstanding balance to record a partial payment');
                                                  return;
                                                }
                                                const payload = { invoiceId: id, amountPaid: Number(partialAmount), paymentMethod: 'cash', paymentType: 'down', forceFull: false };
                                                const res = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/billing/payments`, { method: 'POST', body: JSON.stringify(payload) });
                                                const data = await res.json();
                                                if (res.ok) {
                                                  setSuccessMsg(`Partial payment of ${formatCurrency(partialAmount)} recorded`);
                                                  // Update payment_status depending on remaining balance (compute locally)
                                                  try {
                                                    const newRemaining = Math.max(0, outstanding - partialAmount);
                                                    const newStatus = newRemaining > 0 ? 'partial' : 'paid';
                                                    await updatePaymentStatus(id, newStatus);
                                                  } catch (e) {
                                                    // ignore
                                                  }
                                                  // attempt to mark approved if fully paid
                                                  try {
                                                    if ((parseFloat(inv.totalPaid || 0) + partialAmount) >= parseFloat(inv.amount || 0)) {
                                                      await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/billing/invoices/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
                                                    }
                                                  } catch (e) {}
                                                  await fetchInvoices();
                                                  try { window.dispatchEvent(new Event('transactionsUpdated')); } catch (e) {}
                                                } else {
                                                  setErrorMsg(data.message || 'Failed to record partial payment');
                                                }
                                              } catch (err) {
                                                setErrorMsg(err.message || 'Failed to record partial payment');
                                              } finally {
                                                setProcessingId(null);
                                                setActionMenuInvoice(null);
                                              }
                                            }}
                                            disabled={processingId === inv.invoice_id || inv.payment_status === 'paid' || forceFull}
                                            title={'Record a manual partial cash payment for this invoice'}
                                            className="mark-partial"
                                          >
                                            Mark Partial
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const id = inv.invoice_id;
                                              setProcessingId(id);
                                              setErrorMsg('');
                                              try {
                                                const outstanding = Math.max(0, parseFloat(inv.amount || 0) - parseFloat(inv.totalPaid || 0));
                                                if (outstanding <= 0) {
                                                  setErrorMsg('Invoice already fully paid');
                                                  return;
                                                }
                                                const payload = { invoiceId: id, amountPaid: Number(outstanding), paymentMethod: 'cash', paymentType: 'full', forceFull: false };
                                                const res = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/billing/payments`, { method: 'POST', body: JSON.stringify(payload) });
                                                const data = await res.json();
                                                if (res.ok) {
                                                  setSuccessMsg('Payment recorded — invoice marked fully paid');
                                                  // Update payment_status to 'paid' via helper (updates UI)
                                                  try {
                                                    await updatePaymentStatus(id, 'paid');
                                                  } catch (e) {
                                                    // ignore - we'll still attempt to set invoice status
                                                  }
                                                  // Attempt to set invoice status to 'approved' on server (best-effort)
                                                  try {
                                                    const statusRes = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/billing/invoices/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
                                                    const statusData = await statusRes.json();
                                                    if (!statusRes.ok) {
                                                      // not fatal - log to console
                                                      console.warn('Failed to set invoice status to approved', statusData);
                                                    }
                                                  } catch (e) {
                                                    // ignore
                                                  }
                                                  // Refresh invoices (in case backend changed other fields)
                                                  await fetchInvoices();
                                                    try { window.dispatchEvent(new Event('transactionsUpdated')); } catch (e) {}
                                                } else {
                                                  setErrorMsg(data.message || 'Failed to record payment');
                                                }
                                              } catch (err) {
                                                setErrorMsg(err.message || 'Failed to record payment');
                                              } finally {
                                                setProcessingId(null);
                                                setActionMenuInvoice(null);
                                              }
                                            }}
                                            disabled={processingId === inv.invoice_id || inv.payment_status === 'paid'}
                                            title={'Record a manual full cash payment for this invoice'}
                                            className="mark-paid"
                                          >
                                            Mark Fully Paid
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { 
                                              setActionMenuInvoice(null); 
                                              sendReminder(inv); 
                                            }}
                                            className="remind"
                                          >
                                            Remind Customer
                                          </button>
                                        </>
                                      );
                                    })()
                                  }
                                </div>
                              </div>,
                              document.body
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rest of your existing modal and receipt code remains the same */}
      {/* Payment Modal */}
      {showModal && selectedInvoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* ... existing payment modal code ... */}
        </div>
      )}

      {/* Manual admin cash-record modal */}
      {manualModal.open && manualModal.invoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* ... existing manual modal code ... */}
        </div>
      )}

      {/* Receipt Dialog */}
      {receipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.18)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* ... existing receipt code ... */}
        </div>
      )}
    </div>
  );
};

export default Payment;