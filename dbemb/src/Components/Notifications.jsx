import React, { useEffect, useState } from 'react';
import { BsBell, BsX, BsTrash, BsCheckAll, BsInfoCircle, BsCheckCircle, BsExclamationTriangle, BsReceipt, BsPersonPlus } from 'react-icons/bs';
import NotificationService from '../services/notificationService';

const Notifications = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  const loadNotifications = async () => {
    try {
      // If the current user is an admin, show notifications addressed to admin recipients
      const isAdmin = user && user.role && user.role !== 'user';
      if (isAdmin) {
        const all = await NotificationService.getAllNotifications();
        const arr = Array.isArray(all) ? all : (all && all.notifications) ? all.notifications : [];
        const adminRecipients = NotificationService.getAdminRecipients().map(e => (e || '').toLowerCase().trim());
        const filtered = arr.filter(n => {
          const target = (n.userEmail || '').toLowerCase().trim();
          return target === (user.email || '').toLowerCase().trim() || adminRecipients.includes(target) || target === '';
        });
        setNotifications(filtered);
        return;
      }

      if (user && user.email) {
        const resp = await NotificationService.getUserNotifications(user.email);
        const arr = Array.isArray(resp) ? resp : (resp && resp.notifications) ? resp.notifications : [];
        setNotifications(arr);
        return;
      }

      setNotifications([]);
    } catch (err) {
      console.error('Notifications: Failed to load notifications:', err);
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
    const h = () => loadNotifications();
    window.addEventListener('notificationsUpdated', h);
    return () => window.removeEventListener('notificationsUpdated', h);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (open && !event.target.closest('[data-notif-toggle]') && !event.target.closest('#notification-menu')) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const isAdmin = user && user.role && user.role !== 'user';

  const timeAgo = (inputDate) => {
    if (!inputDate) return 'Recently';
    const date = new Date(inputDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Recently';
    
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (diff < 0) return 'Just now'; // Handle future dates
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const markAllRead = async () => {
    if (!user || !user.email) return;
    try {
      await Promise.all(notifications.filter(n => !n.read).map(n => NotificationService.markAsRead(n.id)));
    } catch (e) {
      console.warn('markAllRead: some marks failed', e);
    }
    await loadNotifications();
  };

  const clearAllNotifications = async () => {
    if (!user || !user.email) return;
    try {
      await Promise.all(notifications.map(n => NotificationService.deleteNotification(n.id).catch(() => null)));
    } catch (e) {
      console.warn('clearAllNotifications failed', e);
    }
    await loadNotifications();
  };

  const handleOpenNotification = async (n) => {
    if (!n) return;
    try { await NotificationService.markAsRead(n.id); } catch (e) {}
    // Prefer structured payment data when available (invoiceId or amount)
    const hasPaymentData = n.data && (n.data.invoiceId || n.data.invoice_id || n.data.amount);
    if (hasPaymentData) {
      const amount = n.data && (n.data.amount || n.data.totalAmount || 100);
      const invoiceId = n.data && (n.data.invoiceId || n.data.invoice_id || '');
      window.location.href = `/payment?amount=${amount}&invoiceId=${invoiceId}`;
    } else if (n.message && n.message.toLowerCase().includes('payment')) {
      // Fallback: if message text mentions payment, navigate to payment route with best-effort params
      window.location.href = `/payment?amount=${n.data && n.data.amount ? n.data.amount : 100}&invoiceId=${n.data && n.data.invoiceId ? n.data.invoiceId : ''}`;
    } else {
      setOpen(false);
    }
    await loadNotifications();
  };

  const handleDelete = async (n) => {
    if (!n) return;
    try { await NotificationService.deleteNotification(n.id); } catch (e) { console.warn(e); }
    await loadNotifications();
  };

  const renderNotificationMessage = (notification) => {
    const message = notification.message || '';
    const paragraphs = String(message).split(/\n\s*\n/);
    const data = notification.data || {};
    const hasPayment = data.paymentLink || data.invoiceId || data.invoice_id || data.amount || notification.type === 'reminder';
    const origin = window.location && window.location.origin ? window.location.origin : '';
    const link = data.paymentLink || (data.exact ? `${origin}/pay-exact?invoiceId=${data.invoiceId || data.invoice_id || ''}${data.amount ? `&amount=${encodeURIComponent(data.amount)}` : ''}${data.forceFull ? '&forceFull=1' : ''}` : `${origin}/payment?invoiceId=${data.invoiceId || data.invoice_id || ''}${data.amount ? `&amount=${encodeURIComponent(data.amount)}` : ''}`);

    // Determine whether this notification already represents a completed payment.
    // If so, do not show the "Please proceed to payment" link.
    const alreadyPaid = Boolean(
      (data && (data.paid === true || data.paid === 'true' || data.paid === '1')) ||
      (notification && typeof notification.title === 'string' && /payment (received|confirmed)/i.test(notification.title))
    );

    return (
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ margin: i === paragraphs.length - 1 ? 0 : '0 0 8px 0' }}>{p}</p>
        ))}
        {data && data.receiptUrl ? (
          <p style={{ marginTop: 8 }}>
            <a href={data.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
              Download receipt
            </a>
          </p>
        ) : (hasPayment && !alreadyPaid) ? (
          <p style={{ marginTop: 8 }}><a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Please proceed to payment.</a></p>
        ) : null}
      </div>
    );
  };

  const renderAdminNotification = (notification) => {
    const data = notification.data || {};
    const amount = data.amount_formatted || (data.amount ? `₱${Number(data.amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}` : null);
    const invoiceRef = data.invoiceNumber || data.invoice_number || data.invoiceId || data.invoice_id || null;
    const receiptUrl = data.receiptUrl || data.receipt_url || null;
    const customer = data.userName || data.name || data.customer || data.customerName || null;

    const invoiceLink = invoiceRef ? (data.invoiceId || data.invoice_id ? `/invoices?invoiceId=${data.invoiceId || data.invoice_id}` : `/invoices?invoiceNumber=${encodeURIComponent(invoiceRef)}`) : null;

    return (
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {amount && (
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '4px 8px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
              {amount}
            </div>
          )}
          {invoiceRef && (
            <a href={invoiceLink} style={{ color: '#0ea5e9', fontWeight: 700 }} onClick={(e) => { e.preventDefault(); window.location.href = invoiceLink; }}>{invoiceRef}</a>
          )}
          {customer && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>{customer}</div>
          )}
        </div>

        <div style={{ marginTop: 8 }}>{renderNotificationMessage(notification)}</div>

        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          {receiptUrl && (
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #e6edf3', color: '#2563eb', fontWeight: 700 }}>Download Receipt</a>
          )}
          {invoiceLink && (
            <button onClick={() => { window.location.href = invoiceLink; }} style={{ padding: '8px 10px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontWeight: 700 }}>Open Invoice</button>
          )}
          <button onClick={async () => { await NotificationService.markAsRead(notification.id); await loadNotifications(); }} style={{ padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #e6edf3', color: '#065f46', fontWeight: 700 }}>Mark Read</button>
        </div>
      </div>
    );
  };

  const getNotificationIcon = (type) => {
    // Prefer an explicit icon specified in the notification (n.data.icon or n.icon)
    // Accept icon hints like: 'check-circle', 'exclamation-triangle', 'receipt', 'person-plus', 'info-circle'
    const iconHint = (type || '').toString().toLowerCase();
    switch (iconHint) {
      case 'check-circle':
      case 'payment_received':
      case 'success':
        return <BsCheckCircle style={{ color: '#10b981' }} />;
      case 'exclamation-triangle':
      case 'warning':
      case 'booking_request':
      case 'rental_request':
        return <BsExclamationTriangle style={{ color: '#f59e0b' }} />;
      case 'receipt':
      case 'receipt_ready':
        return <BsReceipt style={{ color: '#2563eb' }} />;
      case 'person-plus':
      case 'new_customer':
        return <BsPersonPlus style={{ color: '#7c3aed' }} />;
      default:
        return <BsInfoCircle style={{ color: '#3b82f6' }} />;
    }
  };

  // Helper: get the best icon for a notification object (prefers data.icon or top-level icon)
  const resolveIconForNotification = (n) => {
    if (!n) return getNotificationIcon('info');
    const dataIcon = n.data && (n.data.icon || n.data.iconName || n.data.icon_name);
    if (dataIcon) return getNotificationIcon(String(dataIcon).toLowerCase());
    if (n.icon) return getNotificationIcon(String(n.icon).toLowerCase());
    return getNotificationIcon(n.type || 'info');
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        aria-label="Notifications"
        aria-expanded={open}
        data-notif-toggle="true"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#374151',
          cursor: 'pointer',
          padding: '8px',
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '10px'
        }}
        title="Open notifications"
      >
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <BsBell size={20} color="#ffffff" />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: '#ef4444',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 999,
              minWidth: 18,
              textAlign: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div
          id="notification-menu"
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: 0,
            minWidth: '340px',
            maxWidth: '420px',
            boxShadow: '0 10px 30px rgba(2,6,23,0.2)',
            zIndex: 1200,
            maxHeight: '520px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eef2f7' }}>
            <div>
              <div style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>Notifications</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{unreadCount} unread</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button title="Mark all as read" onClick={markAllRead} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 6 }}>
                  <BsCheckAll size={16} />
                </button>
              )}
              <button title="Close" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 6 }}>
                <BsX size={16} />
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '380px', padding: '12px 12px' }}>
            {(() => {
              const list = showOnlyUnread ? notifications.filter(n => !n.read) : notifications;
              if (!list || list.length === 0) {
                return (
                  <div style={{ color: '#6b7280', padding: '36px 12px', textAlign: 'center', fontSize: '14px' }}>
                    You're all caught up
                  </div>
                );
              }

              return list.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '10px',
                    borderRadius: 10,
                    background: n.read ? '#ffffff' : '#f8fdff',
                    border: `1px solid ${n.read ? '#f8fafc' : '#e0f2fe'}`,
                    marginBottom: 10,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    cursor: 'default'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{resolveIconForNotification(n)}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#374151', lineHeight: 1.4, overflow: 'hidden' }}>
                      {isAdmin ? renderAdminNotification(n) : renderNotificationMessage(n)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {!n.read && (
                      <div style={{ width: 8, height: 8, background: '#2563eb', borderRadius: '50%' }} />
                    )}
                    <button title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(n); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                      <BsTrash size={12} />
                    </button>
                  </div>
                  {/* No inline CTA buttons — payment link will be rendered in the message body as a text link */}
                </div>
              ));
            })()}
          </div>

          <div style={{ padding: '10px 12px', borderTop: '1px solid #eef2f7', display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowOnlyUnread(!showOnlyUnread); }} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e6edf3', background: showOnlyUnread ? '#f1f5f9' : '#ffffff', cursor: 'pointer' }}>{showOnlyUnread ? 'Showing unread' : 'Show unread only'}</button>
            <button onClick={clearAllNotifications} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6edf3', background: '#ffffff', cursor: 'pointer', color: '#ef4444' }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
