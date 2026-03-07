import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaCreditCard, FaLock, FaCheckCircle, FaTimes, FaDollarSign, FaMobileAlt, FaUniversity, FaUserShield } from '../icons/fa';
import AuthService from '../services/authService';
import NotificationService from '../services/notificationService';
import { API_BASE_URL } from '../services/apiConfig';
import { formatCurrency } from '../utils/formatters';

const TestPaymentGateway = ({ open, onClose, amount, bookingDetails, onSuccess }) => {
  // Animation keyframes injection
  useEffect(() => {
    if (typeof window !== 'undefined' && window.document) {
      if (!document.head.querySelector('#test-payment-gateway-animations')) {
        const style = document.createElement('style');
        style.id = 'test-payment-gateway-animations';
        style.innerHTML = `
          @keyframes fadeInBg {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(40px) scale(0.98); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          @keyframes checkmark {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  // Detect if used as a route or modal
  const location = useLocation();
  const navigate = useNavigate();
  const isRoute = typeof open === 'undefined';

  // Control background scroll for modal
  useEffect(() => {
    if (!isRoute && open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, isRoute]);

  // If modal usage and not open, don't render
  if (!isRoute && !open) return null;

  // Parse query params if used as a route
  let routeAmount = 100;
  let routeInvoiceId = undefined;
  let routeBookingDetails = undefined;
  let routeExact = false;
  if (isRoute) {
    const params = new URLSearchParams(location.search);
    const amt = params.get('amount');
    const invId = params.get('invoiceId');
    if (amt && !isNaN(Number(amt))) routeAmount = Number(amt);
    if (invId) routeInvoiceId = invId;
    routeBookingDetails = routeInvoiceId ? { invoiceId: routeInvoiceId } : undefined;
    routeExact = params.get('exact') === '1' || params.get('exact') === 'true';
  }

  const finalAmount = isRoute ? routeAmount : (amount || 100);
  const invoiceId = isRoute ? routeInvoiceId : bookingDetails?.invoiceId;
  const finalBookingDetails = isRoute ? routeBookingDetails : bookingDetails;
  const handleCancel = isRoute
    ? (() => { navigate('/'); })
    : (onClose || (() => {}));
  
  // State management
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMode, setPaymentMode] = useState('credit-card');
  const [paymentType, setPaymentType] = useState('full');
  // Determine if we should force an "exact-only" flow (route param or notification data)
  let initialExactMode = !!routeExact;
  // bookingDetails may come from a notification payload (home.jsx passes notification.data)
  if (!initialExactMode && !isRoute) {
    const data = bookingDetails || {};
    let parsedData = data;
    if (typeof data === 'string') {
      try { parsedData = JSON.parse(data); } catch (e) { parsedData = { message: data }; }
    }
    if (parsedData && (parsedData.exact === true || parsedData.exact === '1' || parsedData.exact === 'true' || parsedData.exactOnly === true)) {
      initialExactMode = true;
    }
  }

  const [activeStep, setActiveStep] = useState(initialExactMode ? 2 : 1); // 1: Payment Type, 2: Payment Details
  // Determine if forceFull was requested. Support route query param OR bookingDetails (notification.data)
  let initialForceFull = false;
  if (isRoute) {
    const params = new URLSearchParams(location.search);
    initialForceFull = (params.get('forceFull') === '1' || params.get('forceFull') === 'true');
  } else {
    // bookingDetails may come from a notification payload (home.jsx passes notification.data)
    const data = bookingDetails || {};
    // If data is a JSON string, try to parse it
    let parsed = data;
    if (typeof data === 'string') {
      try { parsed = JSON.parse(data); } catch (e) { parsed = { message: data }; }
    }
    // Direct flags
    initialForceFull = !!(parsed && (parsed.forceFull === true || parsed.forceFull === 'true' || parsed.forceFull === '1' || parsed.paymentType === 'full' || parsed.payment_type === 'full'));
    // Fallback: detect phrases in message/text indicating partials are not accepted
    if (!initialForceFull) {
      const msg = (parsed && (parsed.message || parsed.note || parsed.text)) || '';
      if (typeof msg === 'string' && /partial|down[- ]?payment|partial\/down/i.test(msg) && /(not accepted|not allowed|are not accepted|please settle the full|must pay the full)/i.test(msg)) {
        initialForceFull = true;
      }
    }
  }
  const [forceFull, setForceFull] = useState(!!initialForceFull);

  // Payment methods configuration
  const paymentMethods = [
    {
      id: 'credit-card',
      name: 'Credit Card',
      icon: FaCreditCard,
      color: '#3b82f6',
      description: 'Pay with Visa, Mastercard, or Amex'
    },
    {
      id: 'debit-card',
      name: 'Debit Card',
      icon: FaCreditCard,
      color: '#8b5cf6',
      description: 'Pay with your debit card'
    },
    {
      id: 'gcash',
      name: 'GCash',
      icon: FaMobileAlt,
      color: '#0070ba',
      description: 'Pay using GCash mobile wallet'
    },
    {
      id: 'bank-transfer',
      name: 'Bank Transfer',
      icon: FaUniversity,
      color: '#059669',
      description: 'Transfer from your bank account'
    },
    {
      id: 'cash',
      name: 'Cash',
      icon: FaDollarSign,
      color: '#16a34a',
      description: 'Pay with cash on delivery'
    }
  ];

  // Calculate payment amounts
  const totalAmount = finalAmount;
  const paymentAmount = paymentType === 'down' ? totalAmount * 0.5 : totalAmount;
  const remainingBalance = paymentType === 'down' ? totalAmount - paymentAmount : 0;

  // Formatting functions
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

  // Handle payment success
  const handleSuccess = onSuccess || (async (data) => {
    // Send payment confirmation notification
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
          data: {
            transactionId: data.transactionId,
            amount: data.amount,
            method: data.method,
            timestamp: data.timestamp,
            paid: true
          }
        });
      } catch (e) {
        console.error('Failed to send payment confirmation notification:', e);
      }
    }
    
    // Handle invoice and payment record creation
    try {
      let finalInvoiceId = invoiceId;
      
      if (!finalInvoiceId || finalInvoiceId === '' || finalInvoiceId === 'undefined') {
        const description = finalBookingDetails 
          ? `Payment for ${finalBookingDetails.service || ''}`
          : `Payment - ${data.method}`;
        
        const invoiceResponse = await fetch(`${API_BASE_URL}/billing/invoices`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: data.totalAmount,
            description: description
          })
        });
        
        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json();
          finalInvoiceId = invoiceData.invoice.invoice_id;
          
          // Approve the invoice
          await fetch(`${API_BASE_URL}/billing/invoices/${finalInvoiceId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' })
          });
        }
      }
      
      // Create payment record
      if (finalInvoiceId) {
        const paymentMethodMap = {
          'cash': 'cash',
          'credit-card': 'card',
          'debit-card': 'card',
          'gcash': 'online',
          'bank-transfer': 'bank_transfer'
        };
        
        const paymentData = {
          invoiceId: finalInvoiceId,
          amountPaid: data.amount,
          paymentMethod: paymentMethodMap[data.paymentMode] || 'cash',
          notes: `Transaction ID: ${data.transactionId}`,
          paymentType: paymentType,
          forceFull: !!forceFull
        };
        
        await fetch(`${API_BASE_URL}/billing/payments/customer`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        });
      }
    } catch (e) {
      console.error('Error creating invoice/payment:', e);
    }
    
    setPaymentSuccess(true);
  });

  // Handle payment submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Handle different payment modes
    if (['cash', 'gcash', 'bank-transfer'].includes(paymentMode)) {
      const methodNames = {
        'cash': 'Cash',
        'gcash': 'GCash',
        'bank-transfer': 'Bank Transfer'
      };
      
      handleSuccess({
        transactionId: `${paymentMode.toUpperCase()}-${Date.now()}`,
        amount: paymentAmount,
        totalAmount: totalAmount,
        paymentType: paymentType,
        paymentMode: paymentMode,
        remainingBalance: remainingBalance,
        method: methodNames[paymentMode],
        timestamp: new Date().toISOString(),
        status: 'completed'
      });
      return;
    }

    // Credit/Debit card validation
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber === '4111111111111111' || cleanCardNumber === '4242424242424242') {
      handleSuccess({
        transactionId: `CARD-${Date.now()}`,
        amount: paymentAmount,
        totalAmount: totalAmount,
        paymentType: paymentType,
        paymentMode: paymentMode,
        remainingBalance: remainingBalance,
        method: paymentMode === 'credit-card' ? 'Credit Card' : 'Debit Card',
        cardLast4: cleanCardNumber.slice(-4),
        timestamp: new Date().toISOString(),
        status: 'completed'
      });
    } else if (cleanCardNumber === '4000000000000002') {
      setProcessing(false);
      setError('Card declined. Please try another card.');
    } else if (cleanCardNumber === '4000000000009995') {
      setProcessing(false);
      setError('Insufficient funds. Please try another card.');
    } else {
      setProcessing(false);
      setError('Invalid card number. Use test cards: 4111111111111111 or 4242424242424242');
    }
  };

  // Success modal
  if (paymentSuccess) {
    return (
      <div style={styles.overlay}>
        <div style={styles.successModal}>
          <div style={styles.successIcon}>
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="white" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ animation: 'checkmark 0.6s ease-out' }}
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 style={styles.successTitle}>Payment Successful!</h2>
          <p style={styles.successMessage}>
            Your payment of <span style={styles.amountHighlight}>{formatCurrency(paymentAmount)}</span> has been processed.
          </p>
          {paymentType === 'down' && (
            <div style={styles.balanceNotice}>
              Remaining balance: {formatCurrency(remainingBalance)}
            </div>
          )}
          <button
            onClick={handleCancel}
            style={styles.successButton}
            onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <FaLock style={styles.lockIcon} />
            <div>
              <h2 style={styles.title}>Secure Payment</h2>
              <div style={styles.testBadge}>TEST MODE</div>
            </div>
          </div>
          <button
            onClick={handleCancel}
            style={styles.closeButton}
            aria-label="Close payment modal"
          >
            ×
          </button>
        </div>

        {/* Progress Steps */}
        <div style={styles.progressContainer}>
          <div style={styles.progressSteps}>
            <div style={{...styles.progressStep, ...(activeStep >= 1 ? styles.progressStepActive : {})}}>
              <div style={styles.stepNumber}>1</div>
              <span>Payment Type</span>
            </div>
            <div style={styles.progressLine}></div>
            <div style={{...styles.progressStep, ...(activeStep >= 2 ? styles.progressStepActive : {})}}>
              <div style={styles.stepNumber}>2</div>
              <span>Payment Details</span>
            </div>
          </div>
        </div>

        {/* Amount Display */}
        <div style={styles.amountSection}>
          <div style={styles.amountCard}>
            <div style={styles.amountLabel}>Total Amount</div>
            <div style={styles.totalAmount}>{formatCurrency(totalAmount)}</div>
            <div style={styles.paymentAmount}>
              {paymentType === 'down' ? (
                <>
                  <div>Down Payment (50%)</div>
                  <div style={styles.downPaymentAmount}>{formatCurrency(paymentAmount)}</div>
                  <div style={styles.remainingBalance}>Remaining: {formatCurrency(remainingBalance)}</div>
                </>
              ) : (
                <>
                  <div>Amount to Pay</div>
                  <div style={styles.fullPaymentAmount}>{formatCurrency(paymentAmount)}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={styles.errorAlert}>
            <FaTimes />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Step 1: Payment Type Selection */}
          {activeStep === 1 && (
            <div style={styles.stepContent}>
              <div style={styles.section}>
                <label style={styles.label}>Payment Type</label>
                <div style={styles.paymentTypeGrid}>
                  <button
                    type="button"
                    onClick={() => setPaymentType('full')}
                    style={{
                      ...styles.paymentTypeButton,
                      ...(paymentType === 'full' ? styles.paymentTypeButtonActive : {})
                    }}
                  >
                    <div style={styles.paymentTypeContent}>
                      <div style={styles.paymentTypeTitle}>Full Payment</div>
                      <div style={styles.paymentTypeAmount}>{formatCurrency(totalAmount)}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('down')}
                    disabled={forceFull}
                    title={forceFull ? 'Full payment required for this invoice' : ''}
                    style={{
                      ...styles.paymentTypeButton,
                      ...(paymentType === 'down' ? styles.paymentTypeButtonActive : {}),
                      ...(forceFull ? { opacity: 0.6, cursor: 'not-allowed' } : {})
                    }}
                  >
                    <div style={styles.paymentTypeContent}>
                      <div style={styles.paymentTypeTitle}>Down Payment</div>
                      <div style={styles.paymentTypeAmount}>{formatCurrency(paymentAmount)}</div>
                      <div style={styles.paymentTypeSubtitle}>50% now, 50% later</div>
                    </div>
                  </button>
                </div>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>Payment Method</label>
                <div style={styles.paymentMethodsGrid}>
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMode(method.id);
                          setActiveStep(2);
                        }}
                        style={{
                          ...styles.paymentMethodButton,
                          ...(paymentMode === method.id ? styles.paymentMethodButtonActive : {})
                        }}
                      >
                        <Icon
                          style={{
                            fontSize: 24,
                            color: paymentMode === method.id ? '#fff' : method.color,
                            marginBottom: 8
                          }}
                        />
                        <div style={styles.paymentMethodName}>{method.name}</div>
                        <div style={styles.paymentMethodDescription}>{method.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Payment Details */}
          {activeStep === 2 && (
            <div style={styles.stepContent}>
              <div style={styles.section}>
                <div style={styles.selectedMethod}>
                  <div style={styles.selectedMethodIcon}>
                    {React.createElement(paymentMethods.find(m => m.id === paymentMode)?.icon, {
                      style: { fontSize: 20, color: '#fff' }
                    })}
                  </div>
                  <div>
                    <div style={styles.selectedMethodName}>
                      {paymentMethods.find(m => m.id === paymentMode)?.name}
                    </div>
                    <div style={styles.selectedMethodType}>
                      {paymentType === 'full' ? 'Full Payment' : 'Down Payment'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    style={styles.changeMethodButton}
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Card Details for Credit/Debit Cards */}
              {(paymentMode === 'credit-card' || paymentMode === 'debit-card') && (
                <div style={styles.cardForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Card Number</label>
                    <div style={styles.inputWithIcon}>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => {
                          const formatted = formatCardNumber(e.target.value);
                          if (formatted.replace(/\s/g, '').length <= 16) {
                            setCardNumber(formatted);
                          }
                        }}
                        placeholder="4111 1111 1111 1111"
                        required
                        style={styles.input}
                      />
                      <FaCreditCard style={styles.inputIcon} />
                    </div>
                    <div style={styles.inputHint}>
                      Test cards: 4111111111111111 (Success) | 4000000000000002 (Declined)
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Cardholder Name</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      required
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Expiry Date</label>
                      <input
                        type="text"
                        value={expiry}
                        onChange={(e) => {
                          const formatted = formatExpiry(e.target.value);
                          if (formatted.replace(/\D/g, '').length <= 4) {
                            setExpiry(formatted);
                          }
                        }}
                        placeholder="MM/YY"
                        required
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>CVV</label>
                      <input
                        type="text"
                        value={cvv}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 3) {
                            setCvv(value);
                          }
                        }}
                        placeholder="123"
                        required
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Simplified form for other payment methods */}
              {!['credit-card', 'debit-card'].includes(paymentMode) && (
                <div style={styles.simplePayment}>
                  <div style={styles.simplePaymentIcon}>
                    {React.createElement(paymentMethods.find(m => m.id === paymentMode)?.icon, {
                      style: { fontSize: 48, color: paymentMethods.find(m => m.id === paymentMode)?.color }
                    })}
                  </div>
                  <p style={styles.simplePaymentText}>
                    {paymentMode === 'cash' 
                      ? 'Please prepare cash payment upon delivery or pickup.'
                      : `You will be redirected to complete your ${paymentMethods.find(m => m.id === paymentMode)?.name} payment.`}
                  </p>
                </div>
              )}

              <div style={styles.actionButtons}>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  disabled={processing}
                  style={styles.backButton}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  style={{
                    ...styles.submitButton,
                    ...(processing ? styles.submitButtonProcessing : {})
                  }}
                >
                  {processing ? (
                    <>
                      <div style={styles.spinner}></div>
                      Processing...
                    </>
                  ) : (
                    `Pay ${formatCurrency(paymentAmount)}`
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Security Notice */}
        <div style={styles.securityNotice}>
          <FaUserShield />
          <span>This is a TEST payment gateway. No real transactions will be processed.</span>
        </div>
      </div>
    </div>
  );
};

// Styles object
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(16, 24, 40, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 20,
    animation: 'fadeInBg 0.3s ease'
  },
  modal: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)',
    borderRadius: 24,
    maxWidth: 500,
    width: '100%',
    maxHeight: '92vh',
    overflow: 'auto',
    position: 'relative',
    boxShadow: '0 8px 32px rgba(16, 24, 40, 0.18)',
    animation: 'slideUp 0.4s cubic-bezier(.4,1.4,.6,1)',
    border: '1.5px solid #e2e8f0'
  },
  header: {
    background: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '24px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(2,132,199,0.07)'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  lockIcon: {
    fontSize: 32,
    color: '#fff'
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: '#fff',
    fontWeight: 800,
    letterSpacing: '-0.5px'
  },
  testBadge: {
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.85)',
    border: '1.5px solid #fde68a',
    borderRadius: 6,
    fontSize: 12,
    color: '#92400e',
    fontWeight: 700,
    marginTop: 4
  },
  closeButton: {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    fontSize: 24,
    borderRadius: '50%',
    width: 36,
    height: 36,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s'
  },
  progressContainer: {
    padding: '20px 32px 0'
  },
  progressSteps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  progressStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 600
  },
  progressStepActive: {
    color: '#0ea5e9'
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700
  },
  progressLine: {
    flex: 1,
    height: 2,
    background: '#e2e8f0',
    maxWidth: 60
  },
  amountSection: {
    padding: '20px 32px 0'
  },
  amountCard: {
    background: '#fff',
    borderRadius: 16,
    padding: 20,
    textAlign: 'center',
    border: '2px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(2,132,199,0.05)'
  },
  amountLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0369a1',
    marginBottom: 12
  },
  paymentAmount: {
    fontSize: 14,
    color: '#64748b'
  },
  downPaymentAmount: {
    fontSize: 20,
    fontWeight: 800,
    color: '#059669',
    margin: '4px 0'
  },
  fullPaymentAmount: {
    fontSize: 20,
    fontWeight: 800,
    color: '#059669',
    margin: '4px 0'
  },
  remainingBalance: {
    fontSize: 13,
    color: '#dc2626',
    marginTop: 4
  },
  errorAlert: {
    margin: '16px 32px',
    padding: 12,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#dc2626',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  form: {
    padding: '20px 32px'
  },
  stepContent: {
    animation: 'slideUp 0.3s ease'
  },
  section: {
    marginBottom: 24
  },
  label: {
    display: 'block',
    marginBottom: 12,
    fontSize: 14,
    fontWeight: 600,
    color: '#374151'
  },
  paymentTypeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },
  paymentTypeButton: {
    background: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: 12,
    padding: 16,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left'
  },
  paymentTypeButtonActive: {
    borderColor: '#0ea5e9',
    background: '#f0f9ff',
    boxShadow: '0 2px 8px rgba(2,132,199,0.1)'
  },
  paymentTypeContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  paymentTypeTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#374151'
  },
  paymentTypeAmount: {
    fontSize: 18,
    fontWeight: 800,
    color: '#059669'
  },
  paymentTypeSubtitle: {
    fontSize: 12,
    color: '#64748b'
  },
  paymentMethodsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },
  paymentMethodButton: {
    background: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: 12,
    padding: 16,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  paymentMethodButtonActive: {
    borderColor: '#0ea5e9',
    background: '#0ea5e9',
    color: '#fff',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(2,132,199,0.15)'
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4
  },
  paymentMethodDescription: {
    fontSize: 12,
    opacity: 0.8
  },
  selectedMethod: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    border: '2px solid #e2e8f0'
  },
  selectedMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#0ea5e9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedMethodName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#374151'
  },
  selectedMethodType: {
    fontSize: 14,
    color: '#64748b'
  },
  changeMethodButton: {
    marginLeft: 'auto',
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  cardForm: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    border: '2px solid #e2e8f0'
  },
  formGroup: {
    marginBottom: 16
  },
  inputWithIcon: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: 12,
    border: '2px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 16,
    outline: 'none',
    background: '#fff',
    fontWeight: 500,
    transition: 'border 0.2s'
  },
  inputIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    fontSize: 18
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16
  },
  simplePayment: {
    background: '#fff',
    borderRadius: 12,
    padding: 32,
    border: '2px solid #e2e8f0',
    textAlign: 'center'
  },
  simplePaymentIcon: {
    marginBottom: 16
  },
  simplePaymentText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0
  },
  actionButtons: {
    display: 'flex',
    gap: 12,
    marginTop: 24
  },
  backButton: {
    flex: 1,
    padding: 14,
    border: '2px solid #e2e8f0',
    background: '#fff',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  submitButton: {
    flex: 2,
    padding: 14,
    border: 'none',
    background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s'
  },
  submitButtonProcessing: {
    background: '#94a3b8'
  },
  spinner: {
    width: 16,
    height: 16,
    border: '2px solid transparent',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  securityNotice: {
    padding: '16px 32px 24px',
    background: '#f0fdf4',
    borderTop: '1.5px solid #bbf7d0',
    fontSize: 13,
    color: '#166534',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 600
  },
  successModal: {
    background: 'white',
    borderRadius: 20,
    maxWidth: 400,
    width: '100%',
    padding: 40,
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(16, 24, 40, 0.18)',
    animation: 'slideUp 0.4s cubic-bezier(.4,1.4,.6,1)'
  },
  successIcon: {
    width: 80,
    height: 80,
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    animation: 'pulse 2s infinite'
  },
  successTitle: {
    margin: '0 0 10px 0',
    fontSize: 28,
    color: '#166534',
    fontWeight: 800,
    letterSpacing: '-0.5px',
    lineHeight: 1.1
  },
  successMessage: {
    margin: '0 0 28px 0',
    fontSize: 16,
    color: '#334155',
    lineHeight: 1.7
  },
  amountHighlight: {
    color: '#059669',
    fontWeight: 700
  },
  balanceNotice: {
    margin: '16px 0',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    fontSize: 14,
    color: '#92400e',
    fontWeight: 600
  },
  successButton: {
    width: '100%',
    padding: 15,
    border: 'none',
    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default TestPaymentGateway;  