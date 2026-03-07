import React, { useEffect, useState } from 'react';
import { FaHistory, FaArrowLeft, FaDollarSign, FaReceipt, FaClock, FaFilter, FaDownload, FaSearch } from '../icons/fa';
import AuthService from '../services/authService';
import { API_BASE_URL } from '../services/apiConfig';

const TransactionHistory = ({ onBackToHome }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin
    const user = AuthService.getUser();
    setIsAdmin(user?.role === 'admin');
  }, []);

  const fetchTransactions = async () => {
    try {
      console.log('📋 Fetching transaction history...');
      const res = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/billing/transactions`);
      const data = await res.json();
      console.log('📋 Response received:', data);
      if (res.ok) {
        console.log(`✅ Setting ${data.transactions?.length || 0} transactions`);
        let txns = data.transactions || [];

        // Also fetch legacy payments (some older payments may not have corresponding transactions)
        try {
          const user = AuthService.getUser();
          const email = user?.email;
          if (email) {
            const payRes = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/payments/user/${encodeURIComponent(email)}`);
            // Note: payments route lives under /api/payments
            if (payRes && payRes.ok) {
              const payData = await payRes.json();
              const payments = payData.payments || [];
              // Map payments into transaction-like records and merge (avoid ID collisions)
              const mapped = payments.map(p => ({
                transaction_id: `payment-${p.payment_id}`,
                amount: p.amount_paid || p.amount || 0,
                invoice_id: p.invoice_id,
                invoice_number: p.invoice_number || p.invoice_id,
                transaction_type: 'payment',
                status: 'completed',
                created_at: p.processed_at || p.created_at || p.processed_at,
                payment_method: p.payment_method || p.method || null,
                source: 'payment'
              }));
              // Merge and dedupe by composite key (invoice + amount + created_at)
              const existingKeys = new Set(txns.map(t => `${(t.invoice_number || t.invoice_id)}::${(t.amount||t.amount_paid||t.total||0)}::${t.created_at || t.processed_at || t.issued_at}`));
              for (const m of mapped) {
                const key = `${(m.invoice_number || m.invoice_id)}::${m.amount}::${m.created_at}`;
                if (!existingKeys.has(key)) {
                  txns.push(m);
                  existingKeys.add(key);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Could not fetch legacy payments:', e && e.message);
        }

        // Sort by date desc
        txns = txns.sort((a,b) => new Date(b.created_at || b.processed_at || b.issued_at) - new Date(a.created_at || a.processed_at || a.issued_at));
        setTransactions(txns || []);
      } else {
        console.error('❌ Failed to fetch transactions:', data.message);
        setErrorMsg(data.message || 'Failed to load transactions');
      }
    } catch (err) {
      console.error('❌ Error fetching transactions:', err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    const onUpdate = () => { setLoading(true); fetchTransactions(); };
    window.addEventListener('transactionsUpdated', onUpdate);
    return () => window.removeEventListener('transactionsUpdated', onUpdate);
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      completed: {
        backgroundColor: '#d1fae5',
        color: '#065f46',
        border: '1px solid #34d399'
      },
      pending: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fbbf24'
      },
      failed: {
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        border: '1px solid #fca5a5'
      }
    };

    return (
      <span style={{...styles.base, ...(status === 'completed' ? styles.completed : status === 'pending' ? styles.pending : styles.failed)}}>
        {String(status || '').toUpperCase()}
      </span>
    );
  };

  const getMethodBadge = (method) => {
    const m = (method || '').toString().toLowerCase();
    // Return plain text with a tooltip/title and a small visual indicator.
    const baseStyle = { fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' };
    const getDisplay = (text) => text.charAt(0).toUpperCase() + text.slice(1);
    // Render plain colored text (no padding) to indicate method.
    const textStyle = (color) => ({ color, fontSize: '13px', fontWeight: 700, textTransform: 'none' });

    switch(m) {
      case 'gcash': return <span title={`Method: GCash`} aria-label={`GCash`} style={textStyle('#7c3aed')}>GCash</span>;
      case 'credit': return <span title={`Method: Credit/Card`} aria-label={`Credit`} style={textStyle('#0369a1')}>Credit</span>;
      case 'debit': return <span title={`Method: Debit/Card`} aria-label={`Debit`} style={textStyle('#0ea5e9')}>Debit</span>;
      case 'cash': return <span title={`Method: Cash`} aria-label={`Cash`} style={textStyle('#f97316')}>Cash</span>;
      case 'banktransfer': return <span title={`Method: Bank Transfer`} aria-label={`Bank Transfer`} style={textStyle('#64748b')}>Bank Transfer</span>;
      case 'online': return <span title={`Method: Online`} aria-label={`Online`} style={textStyle('#2563eb')}>Online</span>;
      default:
        const disp = method ? getDisplay(String(method)) : 'Other';
        return <span title={`Method: ${disp}`} aria-label={disp} style={textStyle('#6b7280')}>{disp}</span>;
    }
  };

  // Infer payment method from available fields or transaction description
  const inferMethod = (tx) => {
    if (!tx) return 'other';
    // Prefer explicit fields
    const explicit = tx.payment_method || tx.method || tx.paymentMethod || tx.method_name;
    if (explicit) return String(explicit).toLowerCase();

    // Try to extract from description using capture groups
    const desc = tx.description || tx.note || tx.notes || '';
    if (desc && typeof desc === 'string') {
      const m1 = desc.match(/payment via\s*([a-z0-9_ -]+)/i);
      if (m1 && m1[1]) return m1[1].trim().toLowerCase().replace(/\s+/g, '_');
      const m2 = desc.match(/method[:\s]*([a-z0-9_ -]+)/i);
      if (m2 && m2[1]) return m2[1].trim().toLowerCase().replace(/\s+/g, '_');
      // Look for common keywords
      if (/gcash/i.test(desc)) return 'gcash';
      if (/credit/i.test(desc) || /card/i.test(desc)) return 'credit';
      if (/debit/i.test(desc)) return 'debit';
      if (/bank/i.test(desc) || /transfer/i.test(desc)) return 'banktransfer';
      if (/cash/i.test(desc)) return 'cash';
    }

    // Legacy: if this is a payment-type transaction and no method found, leave as 'cash' only if explicitly marked; otherwise 'other'
    if ((tx.transaction_type || '').toString().toLowerCase() === 'payment') return 'cash';
    return (tx.transaction_type || 'other').toString().toLowerCase();
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'payment':
        return <FaDollarSign style={{color: '#059669'}} />;
      default:
        return <FaReceipt style={{color: '#6b7280'}} />;
    }
  };

  // Render method badge + optional text (avoid duplicate text when badge already shows same method)
  const renderMethodDisplay = (tx) => {
    const raw = (tx && (tx.payment_method || tx.method)) || inferMethod(tx) || 'other';
    const rawNorm = raw.toString().toLowerCase().replace(/\s+/g, '');
    const inferredNorm = inferMethod(tx).toString().toLowerCase().replace(/\s+/g, '');
    return (
      <>
        {getMethodBadge(inferMethod(tx))}
        {rawNorm !== inferredNorm && (
          <span style={{ textTransform: 'capitalize' }}>{raw.toString()}</span>
        )}
      </>
    );
  };

  // Format fallback invoice number as INV-YYYYMMDD-000NNN
  const formatInvoiceNumber = (id, dateString) => {
    try {
      const n = parseInt(id, 10) || 0;
      const d = dateString ? new Date(dateString) : new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const seq = String(n).padStart(6, '0');
      return `INV-${yyyy}${mm}${dd}-${seq}`;
    } catch (e) {
      return id ? `INV-00000000-${String(id).padStart(6,'0')}` : '';
    }
  };

  const getInvoiceDisplay = (tx) => {
    if (!tx) return '';
    if (tx.invoice_number) return tx.invoice_number;
    if (tx.invoice_id) return formatInvoiceNumber(tx.invoice_id, tx.created_at || tx.processed_at || tx.issued_at);
    return '';
  };

  const handleViewReceipt = (tx) => {
    setSelectedTransaction(tx);
    setShowReceipt(true);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const filteredTransactions = transactions.filter(tx => {
    const idOrRef = (tx.transaction_id || tx.transaction_reference || tx.id || '').toString().toLowerCase();
    const matchesSearch = idOrRef.includes(searchTerm.toLowerCase()) ||
               ((tx.invoice_number || tx.invoice_id) || '').toString().includes(searchTerm) ||
                         (tx.transaction_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tx.user_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || (tx.status === filterStatus);
    return matchesSearch && matchesFilter;
  });

  const styles = {
    container: {
      padding: '24px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '32px'
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 20px',
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      color: '#64748b',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      textDecoration: 'none'
    },
    title: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    titleIcon: {
      color: '#8b5cf6',
      fontSize: '24px'
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '0',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    },
    cardHeader: {
      padding: '24px 32px',
      borderBottom: '1px solid #f1f5f9',
      backgroundColor: '#fafbfc'
    },
    cardHeaderTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      margin: 0
    },
    filters: {
      display: 'flex',
      gap: '16px',
      alignItems: 'center'
    },
    searchBox: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      backgroundColor: '#fff'
    },
    searchInput: {
      border: 'none',
      outline: 'none',
      fontSize: '14px',
      width: '200px'
    },
    filterSelect: {
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      backgroundColor: '#fff',
      fontSize: '14px',
      cursor: 'pointer'
    },
    cardBody: {
      padding: '0'
    },
    alert: {
      padding: '16px 32px',
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      border: 'none',
      borderBottom: '1px solid #fecaca',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
      fontWeight: '500'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    tableHeader: {
      backgroundColor: '#f1f5f9',
      borderBottom: '2px solid #e2e8f0'
    },
    th: {
      padding: '10px 16px',
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: '700',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    td: {
      padding: '12px 16px',
      borderBottom: '1px solid #f1f5f9',
      fontSize: '13px',
      color: '#334155',
      verticalAlign: 'middle'
    },
    transactionRow: {
      transition: 'background-color 0.15s ease',
      cursor: 'pointer'
    },
    transactionId: {
      fontWeight: '600',
      color: '#1f2937'
    },
    invoiceLink: {
      color: '#3b82f6',
      fontWeight: '500',
      textDecoration: 'none'
    },
    amount: {
      fontWeight: '600',
      fontSize: '16px',
      color: '#059669'
    },
    typeInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    dateInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: '#6b7280'
    },
    emptyState: {
      padding: '64px 32px',
      textAlign: 'center',
      color: '#6b7280'
    },
    emptyIcon: {
      fontSize: '48px',
      color: '#d1d5db',
      marginBottom: '16px'
    },
    emptyTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '8px'
    },
    emptyDescription: {
      fontSize: '14px',
      color: '#6b7280'
    },
    summaryCards: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    summaryCard: {
      padding: '20px',
      backgroundColor: '#fff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      textAlign: 'center'
    },
    summaryValue: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '4px'
    },
    summaryLabel: {
      fontSize: '12px',
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{...styles.card, padding: '64px', textAlign: 'center'}}>
          <div>Loading transaction history...</div>
        </div>
      </div>
    );
  }

  const totalTransactions = transactions.length;
  const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || tx.amount_paid || 0), 0);
  const completedTransactions = transactions.filter(t => t.status === 'completed' || t.transaction_type === 'payment').length || transactions.length;

  return (
    <div style={styles.container}>
      <style>
        {`
          .back-button:hover {
            background-color: #f8fafc;
            border-color: #3b82f6;
            color: #3b82f6;
          }
          
          .transaction-row:hover {
            background-color: #f8fafc;
          }
          
          .invoice-link:hover {
            text-decoration: underline;
          }
        `}
      </style>
      
      <div style={styles.header}>
      </div>

      <div style={styles.summaryCards}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{totalTransactions}</div>
          <div style={styles.summaryLabel}>Total Transactions</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>₱{formatCurrency(totalAmount)}</div>
          <div style={styles.summaryLabel}>Total Amount</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{completedTransactions}</div>
          <div style={styles.summaryLabel}>Completed</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardHeaderTop}>
            <h2 style={styles.cardTitle}>
              All Transactions ({filteredTransactions.length})
            </h2>
            <div style={styles.filters}>
              <div style={styles.searchBox}>
                <FaSearch size={14} style={{color: '#6b7280'}} />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        <div style={styles.cardBody}>
          {errorMsg && (
            <div style={styles.alert}>
              {errorMsg}
            </div>
          )}

          {filteredTransactions.length === 0 ? (
            <div style={styles.emptyState}>
              <FaHistory style={styles.emptyIcon} />
              <div style={styles.emptyTitle}>No Transactions Found</div>
              <div style={styles.emptyDescription}>
                {searchTerm || filterStatus !== 'all' 
                  ? 'No transactions match your current filters.' 
                  : 'You haven\'t made any transactions yet.'}
              </div>
            </div>
          ) : (
            <table style={styles.table}>
              <thead style={styles.tableHeader}>
                  <tr>
                    {isAdmin && <th style={styles.th}>USER</th>}
                    <th style={styles.th}>TXN #</th>
                    <th style={styles.th}>METHOD</th>
                    <th style={styles.th}>AMOUNT</th>
                    <th style={styles.th}>TOTAL</th>
                    <th style={styles.th}>STATUS</th>
                    <th style={styles.th}>DATE</th>
                    <th style={styles.th}>ACTIONS</th>
                  </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(tx => (
                  <tr key={tx.transaction_id || tx.id} style={styles.transactionRow} className="transaction-row">
                    {isAdmin && (
                      <td style={styles.td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{tx.user_name || 'N/A'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{tx.user_email || ''}</div>
                        </div>
                      </td>
                    )}
                    <td style={styles.td}>
                      <div style={{ fontWeight: '600', color: '#3b82f6', fontSize: '13px' }}>{tx.transaction_id || tx.transaction_reference || tx.id}</div>
                    </td>
                    <td style={styles.td}>{renderMethodDisplay(tx)}</td>
                    <td style={styles.td}><div style={{ fontWeight: '700', color: '#059669', fontSize: '14px' }}>₱{formatCurrency(tx.amount || tx.amount_paid || 0)}</div></td>
                    <td style={styles.td}><div>₱{formatCurrency(tx.invoice_amount || 0)}</div></td>
                    <td style={styles.td}>{getStatusBadge(tx.status || tx.invoice_status || '-')}</td>
                    <td style={styles.td}><div style={{ fontSize: '11px', color: '#64748b' }}>{formatDate(tx.created_at || tx.issued_at || tx.processed_at)}</div></td>
                    <td style={styles.td}>
                      <button onClick={() => handleViewReceipt(tx)} style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaReceipt /> Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && selectedTransaction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            padding: '0',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Receipt Header */}
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <FaReceipt size={40} style={{ color: '#059669', marginBottom: '8px' }} />
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', margin: '0 0 4px 0' }}>
                  Payment Receipt
                </h2>
                {/* Transaction number intentionally removed to keep header clean */}
              </div>
            </div>

            {/* Receipt Body */}
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Transaction ID:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>#{selectedTransaction.transaction_id || selectedTransaction.id}</span>
                  </div>

                  {getInvoiceDisplay(selectedTransaction) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#6b7280', fontWeight: '500' }}>Invoice #:</span>
                      <span style={{ fontWeight: '600', color: '#3b82f6' }}>#{getInvoiceDisplay(selectedTransaction)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Method:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {renderMethodDisplay(selectedTransaction)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Date:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>{formatDate(selectedTransaction.created_at || selectedTransaction.processed_at || selectedTransaction.issued_at)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Customer:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>{selectedTransaction.user_name || selectedTransaction.user_id}</span>
                  </div>
                </div>
                </div>

              {/* Amount Section */}
              <div style={{
                backgroundColor: '#f0fdf4',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #86efac',
                marginBottom: '24px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Amount Paid
                  </div>
                    <div style={{ fontSize: '36px', fontWeight: '700', color: '#059669' }}>
                    ₱{formatCurrency(selectedTransaction.amount || selectedTransaction.amount_paid || 0)}
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px'
              }}>
                <p style={{ margin: '0 0 8px 0' }}>Thank you for your payment!</p>
                <p style={{ margin: 0, fontStyle: 'italic' }}>
                  This is a computer-generated receipt.
                </p>
              </div>
            </div>

            {/* Receipt Actions */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handlePrintReceipt}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FaDownload size={14} />
                Print
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#fff',
                  color: '#374151',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
