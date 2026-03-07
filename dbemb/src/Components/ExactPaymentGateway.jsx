import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaCreditCard, FaLock, FaCheckCircle, FaTimes, FaDollarSign, FaMobileAlt, FaUniversity, FaUserShield } from '../icons/fa';
import AuthService from '../services/authService';
import NotificationService from '../services/notificationService';
import { API_BASE_URL } from '../services/apiConfig';
import { formatCurrency } from '../utils/formatters';

// ExactPaymentGateway: Minimal payment gateway that enforces paying the exact amount provided
const ExactPaymentGateway = ({ open, onClose, amount, bookingDetails, onSuccess }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRoute = typeof open === 'undefined';

  // Parse route params if used as a route
  let routeAmount = 100;
  let routeInvoiceId = undefined;
  if (isRoute) {
    const params = new URLSearchParams(location.search);
    const amt = params.get('amount');
    const invId = params.get('invoiceId');
    if (amt && !isNaN(Number(amt))) routeAmount = Number(amt);
    if (invId) routeInvoiceId = invId;
  }

  const finalAmount = isRoute ? routeAmount : (amount || 100);
  const invoiceId = isRoute ? routeInvoiceId : bookingDetails?.invoiceId;
  const finalBookingDetails = isRoute ? (routeInvoiceId ? { invoiceId: routeInvoiceId } : undefined) : bookingDetails;

  const handleCancel = isRoute
    ? (() => { navigate('/'); })
    : (onClose || (() => {}));

  // State
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMode, setPaymentMode] = useState('credit-card');

  // Force exact/full payments only in this gateway
  const paymentType = 'full';
  const forceFull = true;

  const paymentMethods = [
    { id: 'credit-card', name: 'Credit Card', icon: FaCreditCard, color: '#3b82f6', description: 'Pay with Visa, Mastercard, or Amex' },
    { id: 'debit-card', name: 'Debit Card', icon: FaCreditCard, color: '#8b5cf6', description: 'Pay with your debit card' },
    { id: 'gcash', name: 'GCash', icon: FaMobileAlt, color: '#0070ba', description: 'Pay using GCash mobile wallet' },
    { id: 'bank-transfer', name: 'Bank Transfer', icon: FaUniversity, color: '#059669', description: 'Transfer from your bank account' },
    { id: 'cash', name: 'Cash', icon: FaDollarSign, color: '#16a34a', description: 'Pay with cash on delivery' }
  ];

  const totalAmount = finalAmount;
  const paymentAmount = totalAmount; // exact amount only

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleSuccess = onSuccess || (async (data) => {
    const user = AuthService.getUser();
    if (user && user.email) {
      try {
        const recipientName = (user && (user.firstName || user.first_name || user.name))
          ? `${user.firstName || user.first_name || user.name}${(user.lastName || user.last_name) ? ' ' + (user.lastName || user.last_name) : ''}`
          : 'Customer';

        await NotificationService.createNotification(user.email, {
          type: 'success',
          title: 'Payment Received',
          message: `Dear ${recipientName},\n\nWe're delighted to confirm that your payment of ${formatCurrency(data.amount)} has been successfully received!`,
          data: { transactionId: data.transactionId, amount: data.amount, method: data.method, timestamp: data.timestamp, paid: true }
        });
      } catch (e) {}
    }

    try {
      let finalInvoiceId = invoiceId;
      if (!finalInvoiceId || finalInvoiceId === '' || finalInvoiceId === 'undefined') {
        const description = finalBookingDetails ? `Payment for ${finalBookingDetails.service || ''}` : `Payment - ${data.method}`;
        const invoiceResponse = await fetch(`${API_BASE_URL}/billing/invoices`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: data.totalAmount, description })
        });
        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json();
          finalInvoiceId = invoiceData.invoice.invoice_id;
          await fetch(`${API_BASE_URL}/billing/invoices/${finalInvoiceId}/status`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) });
        }
      }

      if (finalInvoiceId) {
        const paymentMethodMap = { 'cash': 'cash', 'credit-card': 'card', 'debit-card': 'card', 'gcash': 'online', 'bank-transfer': 'bank_transfer' };
        const paymentData = { invoiceId: finalInvoiceId, amountPaid: data.amount, paymentMethod: paymentMethodMap[data.paymentMode] || 'cash', notes: `Transaction ID: ${data.transactionId}`, paymentType: paymentType, forceFull: true };
        await fetch(`${API_BASE_URL}/billing/payments/customer`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paymentData) });
      }
    } catch (e) {}

    setPaymentSuccess(true);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1400));

    if (['cash', 'gcash', 'bank-transfer'].includes(paymentMode)) {
      const methodNames = { 'cash': 'Cash', 'gcash': 'GCash', 'bank-transfer': 'Bank Transfer' };
      handleSuccess({ transactionId: `${paymentMode.toUpperCase()}-${Date.now()}`, amount: paymentAmount, totalAmount: totalAmount, paymentType, paymentMode, remainingBalance: 0, method: methodNames[paymentMode], timestamp: new Date().toISOString(), status: 'completed' });
      return;
    }

    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber === '4111111111111111' || cleanCardNumber === '4242424242424242') {
      handleSuccess({ transactionId: `CARD-${Date.now()}`, amount: paymentAmount, totalAmount: totalAmount, paymentType, paymentMode, remainingBalance: 0, method: paymentMode === 'credit-card' ? 'Credit Card' : 'Debit Card', cardLast4: cleanCardNumber.slice(-4), timestamp: new Date().toISOString(), status: 'completed' });
    } else if (cleanCardNumber === '4000000000000002') {
      setProcessing(false); setError('Card declined. Please try another card.');
    } else if (cleanCardNumber === '4000000000009995') {
      setProcessing(false); setError('Insufficient funds. Please try another card.');
    } else {
      setProcessing(false); setError('Invalid card number. Use test cards: 4111111111111111 or 4242424242424242');
    }
  };

  if (paymentSuccess) {
    return (
      <div style={styles.overlay}>
        <div style={styles.successModal}>
          <div style={styles.successIcon}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'checkmark 0.6s ease-out' }}><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          <h2 style={styles.successTitle}>Payment Successful!</h2>
          <p style={styles.successMessage}>Your payment of <span style={styles.amountHighlight}>{formatCurrency(paymentAmount)}</span> has been processed.</p>
          <button onClick={handleCancel} style={styles.successButton}>Continue</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerContent}><FaLock style={styles.lockIcon} /><div><h2 style={styles.title}>Secure Payment</h2><div style={styles.testBadge}>TEST MODE</div></div></div>
          <button onClick={handleCancel} style={styles.closeButton} aria-label="Close payment modal">×</button>
        </div>

        <div style={styles.amountSection}>
          <div style={styles.amountCard}>
            <div style={styles.amountLabel}>Total Amount</div>
            <div style={styles.totalAmount}>{formatCurrency(totalAmount)}</div>
            <div style={styles.paymentAmount}><div>Amount to Pay</div><div style={styles.fullPaymentAmount}>{formatCurrency(paymentAmount)}</div></div>
          </div>
        </div>

        {error && (<div style={styles.errorAlert}><FaTimes />{error}</div>)}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.stepContent}>
            <div style={styles.section}>
              <label style={styles.label}>Payment Method</label>
              <div style={styles.paymentMethodsGrid}>
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button key={method.id} type="button" onClick={() => setPaymentMode(method.id)} style={{ ...styles.paymentMethodButton, ...(paymentMode === method.id ? styles.paymentMethodButtonActive : {}) }}>
                      <Icon style={{ fontSize: 24, color: paymentMode === method.id ? '#fff' : method.color, marginBottom: 8 }} />
                      <div style={styles.paymentMethodName}>{method.name}</div>
                      <div style={styles.paymentMethodDescription}>{method.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {(paymentMode === 'credit-card' || paymentMode === 'debit-card') && (
              <div style={styles.cardForm}>
                <div style={styles.formGroup}><label style={styles.label}>Card Number</label><div style={styles.inputWithIcon}><input type="text" value={cardNumber} onChange={(e) => { const formatted = formatCardNumber(e.target.value); if (formatted.replace(/\s/g, '').length <= 16) setCardNumber(formatted); }} placeholder="4111 1111 1111 1111" required style={styles.input} /><FaCreditCard style={styles.inputIcon} /></div><div style={styles.inputHint}>Test cards: 4111111111111111 (Success) | 4000000000000002 (Declined)</div></div>
                <div style={styles.formGroup}><label style={styles.label}>Cardholder Name</label><input type="text" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} required style={styles.input} /></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label style={styles.label}>Expiry Date</label><input type="text" value={expiry} onChange={(e) => { const formatted = formatExpiry(e.target.value); if (formatted.replace(/\D/g, '').length <= 4) setExpiry(formatted); }} placeholder="MM/YY" required style={styles.input} /></div><div style={styles.formGroup}><label style={styles.label}>CVV</label><input type="text" value={cvv} onChange={(e) => { const value = e.target.value.replace(/\D/g, ''); if (value.length <= 3) setCvv(value); }} placeholder="123" required style={styles.input} /></div></div>
              </div>
            )}

            {!['credit-card', 'debit-card'].includes(paymentMode) && (
              <div style={styles.simplePayment}><div style={styles.simplePaymentIcon}>{React.createElement(paymentMethods.find(m => m.id === paymentMode)?.icon, { style: { fontSize: 48, color: paymentMethods.find(m => m.id === paymentMode)?.color } })}</div><p style={styles.simplePaymentText}>{paymentMode === 'cash' ? 'Please prepare cash payment upon delivery or pickup.' : `You will be redirected to complete your ${paymentMethods.find(m => m.id === paymentMode)?.name} payment.`}</p></div>
            )}

            <div style={styles.actionButtons}><button type="button" onClick={handleCancel} disabled={processing} style={styles.backButton}>Back</button><button type="submit" disabled={processing} style={{ ...styles.submitButton, ...(processing ? styles.submitButtonProcessing : {}) }}>{processing ? (<><div style={styles.spinner}></div>Processing...</>) : (`Pay ${formatCurrency(paymentAmount)}`)}</button></div>
          </div>
        </form>

        <div style={styles.securityNotice}><FaUserShield /><span>This is a TEST payment gateway. No real transactions will be processed.</span></div>
      </div>
    </div>
  );
};

// Reuse same styles as TestPaymentGateway for consistency
const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(16, 24, 40, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 },
  modal: { background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)', borderRadius: 24, maxWidth: 500, width: '100%', maxHeight: '92vh', overflow: 'auto', position: 'relative', boxShadow: '0 8px 32px rgba(16, 24, 40, 0.18)', border: '1.5px solid #e2e8f0' },
  header: { background: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerContent: { display: 'flex', alignItems: 'center', gap: 12 },
  lockIcon: { fontSize: 32, color: '#fff' },
  title: { margin: 0, fontSize: 20, color: '#fff', fontWeight: 800 },
  testBadge: { padding: '4px 12px', background: 'rgba(255,255,255,0.85)', border: '1.5px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e', fontWeight: 700, marginTop: 4 },
  closeButton: { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, borderRadius: '50%', width: 36, height: 36, cursor: 'pointer' },
  amountSection: { padding: '20px 32px 0' },
  amountCard: { background: '#fff', borderRadius: 16, padding: 20, textAlign: 'center', border: '2px solid #e2e8f0' },
  amountLabel: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  totalAmount: { fontSize: 24, fontWeight: 800, color: '#0369a1', marginBottom: 12 },
  paymentAmount: { fontSize: 14, color: '#64748b' },
  fullPaymentAmount: { fontSize: 20, fontWeight: 800, color: '#059669', margin: '4px 0' },
  errorAlert: { margin: '16px 32px', padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 },
  form: { padding: '20px 32px' },
  stepContent: { },
  section: { marginBottom: 24 },
  label: { display: 'block', marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#374151' },
  paymentMethodsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  paymentMethodButton: { background: '#fff', border: '2px solid #e2e8f0', borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center' },
  paymentMethodButtonActive: { borderColor: '#0ea5e9', background: '#0ea5e9', color: '#fff' },
  paymentMethodName: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  paymentMethodDescription: { fontSize: 12, opacity: 0.8 },
  cardForm: { background: '#fff', borderRadius: 12, padding: 20, border: '2px solid #e2e8f0' },
  formGroup: { marginBottom: 16 },
  inputWithIcon: { position: 'relative' },
  input: { width: '100%', padding: 12, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 16, outline: 'none', background: '#fff', fontWeight: 500 },
  inputIcon: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 18 },
  inputHint: { fontSize: 12, color: '#64748b', marginTop: 4 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  simplePayment: { background: '#fff', borderRadius: 12, padding: 32, border: '2px solid #e2e8f0', textAlign: 'center' },
  simplePaymentIcon: { marginBottom: 16 },
  simplePaymentText: { fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 },
  actionButtons: { display: 'flex', gap: 12, marginTop: 24 },
  backButton: { flex: 1, padding: 14, border: '2px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 16, fontWeight: 600, color: '#64748b', cursor: 'pointer' },
  submitButton: { flex: 2, padding: 14, border: 'none', background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)', borderRadius: 8, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitButtonProcessing: { background: '#94a3b8' },
  spinner: { width: 16, height: 16, border: '2px solid transparent', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  securityNotice: { padding: '16px 32px 24px', background: '#f0fdf4', borderTop: '1.5px solid #bbf7d0', fontSize: 13, color: '#166534', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 },
  successModal: { background: 'white', borderRadius: 20, maxWidth: 400, width: '100%', padding: 40, textAlign: 'center', boxShadow: '0 8px 32px rgba(16, 24, 40, 0.18)' },
  successIcon: { width: 80, height: 80, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' },
  successTitle: { margin: '0 0 10px 0', fontSize: 28, color: '#166534', fontWeight: 800 },
  successMessage: { margin: '0 0 28px 0', fontSize: 16, color: '#334155' },
  amountHighlight: { color: '#059669', fontWeight: 700 },
  successButton: { width: '100%', padding: 15, border: 'none', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', borderRadius: 10, fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer' }
};

export default ExactPaymentGateway;
