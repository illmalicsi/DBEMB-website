import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaCheck, FaTimes, FaExclamationCircle, FaUsers, FaClock, FaChevronDown, FaChevronUp, FaPhone, FaBirthdayCake, FaMusic, FaMapMarkerAlt, FaFileAlt, FaEnvelope, FaCalendarAlt } from '../icons/fa';
import AuthService from '../services/authService';
import { API_BASE_URL } from '../services/apiConfig';

const MembershipApproval = ({ user, onBackToHome, onLogout, embedded = false }) => {
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [expandedMemberId, setExpandedMemberId] = useState(null);

  useEffect(() => {
    fetchPendingMembers();
  }, []);

  const fetchPendingMembers = async () => {
    try {
      setLoading(true);
      console.log('MembershipApproval: Fetching pending members...');
      const response = await AuthService.get('/membership/pending');
      console.log('MembershipApproval: API Response:', response);
      
      if (response.success && Array.isArray(response.data)) {
        console.log('MembershipApproval: Loaded', response.data.length, 'pending members');
        setPendingMembers(response.data);
      } else {
        console.error('MembershipApproval: Invalid response format:', response);
        setPendingMembers([]);
        showNotification(response.message || 'Failed to load pending members', 'error');
      }
    } catch (error) {
      console.error('MembershipApproval: Error fetching pending members:', error);
      setPendingMembers([]);
      showNotification(error.message || 'Failed to load pending members', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      setProcessingId(userId);
      console.log('MembershipApproval: Approving user', userId);
      const response = await AuthService.put(`/membership/approve/${userId}`);
      console.log('MembershipApproval: Approve response:', response);
      
      if (response.success) {
        showNotification('Member approved successfully!', 'success');
        fetchPendingMembers();
      } else {
        showNotification(response.message || 'Failed to approve member', 'error');
      }
    } catch (error) {
      console.error('MembershipApproval: Error approving member:', error);
      showNotification(error.message || 'Failed to approve member', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId) => {
    try {
      setProcessingId(userId);
      console.log('MembershipApproval: Rejecting user', userId);
      const response = await AuthService.put(`/membership/reject/${userId}`);
      console.log('MembershipApproval: Reject response:', response);
      
      if (response.success) {
        showNotification('Member rejected', 'info');
        fetchPendingMembers();
      } else {
        showNotification(response.message || 'Failed to reject member', 'error');
      }
    } catch (error) {
      console.error('MembershipApproval: Error rejecting member:', error);
      showNotification(error.message || 'Failed to reject member', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toggleMemberDetails = (memberId) => {
    setExpandedMemberId(expandedMemberId === memberId ? null : memberId);
  };

  const calculateAge = (birthday) => {
    if (!birthday) return 'N/A';
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2.5rem',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    },
    header: {
      marginBottom: '2.5rem'
    },
    title: {
      fontSize: '2.25rem',
      fontWeight: '700',
      color: '#0f172a',
      marginBottom: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      letterSpacing: '-0.02em'
    },
    subtitle: {
      color: '#64748b',
      fontSize: '1rem',
      fontWeight: '400'
    },
    statsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2.5rem'
    },
    statCard: {
      background: 'white',
      borderRadius: '16px',
      padding: '2rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '1.25rem',
      transition: 'all 0.3s ease'
    },
    statIconWrapper: {
      width: '60px',
      height: '60px',
      borderRadius: '14px',
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '1.75rem',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
    },
    statContent: {
      flex: 1
    },
    statLabel: {
      fontSize: '0.875rem',
      color: '#64748b',
      marginBottom: '0.5rem',
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    statValue: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#0f172a',
      letterSpacing: '-0.02em'
    },
    tableContainer: {
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    },
    tableHeader: {
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      padding: '1.75rem 2rem',
      color: '#0f172a',
      fontSize: '1.125rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: 'white',
      tableLayout: 'auto'
    },
    tableHead: {
      background: '#f8fafc',
      borderBottom: '1px solid #e2e8f0'
    },
    th: {
      backgroundColor: '#f8fafc',
      padding: '0.75rem 1rem',
      textAlign: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
      fontSize: '0.6875rem',
      fontWeight: '600',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      borderBottom: '1px solid #e2e8f0'
    },
    tr: {
      borderBottom: '1px solid #f1f5f9',
      transition: 'all 0.2s ease'
    },
    td: {
      padding: '1rem 1.25rem',
      borderBottom: '1px solid #f1f5f9',
      textAlign: 'center',
      verticalAlign: 'middle',
      color: '#334155',
      fontSize: '0.875rem'
    },
    tdName: {
      textAlign: 'left',
      whiteSpace: 'normal',
      wordWrap: 'break-word',
      minWidth: '140px',
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#0f172a'
    },
    tdEmail: {
      textAlign: 'left',
      whiteSpace: 'normal',
      wordWrap: 'break-word',
      minWidth: '180px',
      fontSize: '0.8125rem',
      color: '#64748b'
    },
    tdDate: {
      color: '#64748b',
      fontSize: '0.875rem',
      whiteSpace: 'nowrap'
    },
    roleBadge: {
      padding: '0.375rem 0.75rem',
      borderRadius: '100px',
      fontSize: '0.6875rem',
      fontWeight: '600',
      letterSpacing: '0.025em',
      textTransform: 'uppercase',
      display: 'inline-block',
      whiteSpace: 'nowrap',
      backgroundColor: '#dbeafe',
      color: '#1e40af'
    },
    actionButtons: {
      display: 'flex',
      gap: '0.25rem',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'nowrap'
    },
    approveButton: {
      backgroundColor: 'white',
      border: '1px solid #10b981',
      color: '#10b981',
      padding: '0.375rem 0.5rem',
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.25rem',
      fontSize: '0.75rem',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
      minWidth: '68px'
    },
    rejectButton: {
      backgroundColor: 'white',
      border: '1px solid #ef4444',
      color: '#ef4444',
      padding: '0.375rem 0.5rem',
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.25rem',
      fontSize: '0.75rem',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
      minWidth: '68px'
    },
    disabledButton: {
      opacity: 0.6,
      cursor: 'not-allowed'
    },
    emptyState: {
      padding: '4rem 2rem',
      textAlign: 'center',
      color: '#64748b'
    },
    emptyIcon: {
      fontSize: '4rem',
      color: '#cbd5e1',
      marginBottom: '1.5rem'
    },
    emptyText: {
      fontSize: '1.125rem',
      fontWeight: '600',
      marginBottom: '0.5rem',
      color: '#475569'
    },
    emptySubtext: {
      fontSize: '0.9375rem',
      color: '#94a3b8'
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      gap: '1rem'
    },
    loadingSpinner: {
      width: '40px',
      height: '40px',
      border: '4px solid #e0f2fe',
      borderTop: '4px solid #0ea5e9',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    notification: {
      position: 'fixed',
      top: '2rem',
      right: '2rem',
      padding: '1rem 1.5rem',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      zIndex: 1000,
      animation: 'slideIn 0.3s ease-out',
      maxWidth: '400px',
      backdropFilter: 'blur(10px)'
    },
    notificationSuccess: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    notificationError: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    notificationInfo: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    }
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          tr:hover {
            background-color: #f8fafc !important;
          }
          button:hover:not(:disabled) {
            transform: translateY(-1px);
            opacity: 0.9;
          }
          button:active:not(:disabled) {
            transform: translateY(0);
          }
          .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          }
        `}
      </style>

      {notification && (
        <div style={{
          ...styles.notification,
          ...(notification.type === 'success' ? styles.notificationSuccess : {}),
          ...(notification.type === 'error' ? styles.notificationError : {}),
          ...(notification.type === 'info' ? styles.notificationInfo : {})
        }}>
          {notification.type === 'success' && <FaCheck />}
          {notification.type === 'error' && <FaTimes />}
          {notification.type === 'info' && <FaExclamationCircle />}
          <span>{notification.message}</span>
        </div>
      )}

      <div style={styles.header}>
        <p style={styles.subtitle}>Review and approve pending membership requests</p>
      </div>

      <div style={styles.statsContainer}>
        <div style={styles.statCard} className="stat-card">
          <div style={styles.statIconWrapper}>
            <FaClock />
          </div>
          <div style={styles.statContent}>
            <div style={styles.statLabel}>Pending Requests</div>
            <div style={styles.statValue}>{pendingMembers.length}</div>
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <div style={styles.tableHeader}>
          <FaUsers />
          Pending Members
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingSpinner}></div>
            <div style={{ color: '#64748b' }}>Loading pending members...</div>
          </div>
        ) : pendingMembers.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <FaUserPlus />
            </div>
            <div style={styles.emptyText}>No pending membership requests</div>
            <div style={styles.emptySubtext}>All membership requests have been processed</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead style={styles.tableHead}>
                <tr>
                  <th style={{...styles.th, textAlign: 'left', minWidth: '50px'}}>Details</th>
                  <th style={{...styles.th, textAlign: 'left', minWidth: '140px'}}>Name</th>
                  <th style={{...styles.th, textAlign: 'left', minWidth: '180px'}}>Email Address</th>
                  <th style={{...styles.th, width: 'auto', minWidth: '120px'}}>Phone</th>
                  <th style={{...styles.th, width: 'auto', minWidth: '100px'}}>Instrument</th>
                  <th style={{...styles.th, width: 'auto', minWidth: '100px'}}>Registration Date</th>
                  <th style={{...styles.th, width: 'auto', minWidth: '160px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingMembers.map((member) => (
                  <React.Fragment key={member.id}>
                    <tr style={styles.tr}>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <button
                          onClick={() => toggleMemberDetails(member.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#3b82f6',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {expandedMemberId === member.id ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                        </button>
                      </td>
                      <td style={{...styles.td, ...styles.tdName}}>
                        {member.first_name} {member.last_name}
                      </td>
                      <td style={{...styles.td, ...styles.tdEmail}}>
                        {member.email}
                      </td>
                      <td style={{...styles.td}}>
                        {member.phone || 'N/A'}
                      </td>
                      <td style={{...styles.td}}>
                        {member.instrument || 'N/A'}
                      </td>
                      <td style={{...styles.td, ...styles.tdDate}}>
                        {formatDate(member.created_at)}
                      </td>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <div style={styles.actionButtons}>
                          <button
                            onClick={() => handleApprove(member.id)}
                            disabled={processingId === member.id}
                            style={{
                              ...styles.approveButton,
                              ...(processingId === member.id ? styles.disabledButton : {})
                            }}
                          >
                            <FaCheck size={11} />
                            {processingId === member.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(member.id)}
                            disabled={processingId === member.id}
                            style={{
                              ...styles.rejectButton,
                              ...(processingId === member.id ? styles.disabledButton : {})
                            }}
                          >
                            <FaTimes size={11} />
                            {processingId === member.id ? 'Processing...' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedMemberId === member.id && (
                      <tr>
                        <td colSpan="7" style={{ padding: 0, background: '#f8fafc' }}>
                          <div style={{
                            padding: '1.5rem 2rem',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
                            borderTop: '2px solid #bae6fd',
                            borderBottom: '2px solid #bae6fd'
                          }}>
                            <h3 style={{
                              margin: '0 0 1.5rem 0',
                              color: '#0f172a',
                              fontSize: '1.125rem',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <FaUserPlus style={{ color: '#3b82f6' }} />
                              Complete Member Information
                            </h3>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(5, 1fr)',
                              gap: '1.25rem'
                            }}>
                              {/* Personal Information */}
                              <div style={{
                                background: 'white',
                                padding: '1.25rem',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                border: '2px solid #222'
                              }}>
                                <h4 style={{
                                  margin: '0 0 1rem 0',
                                  color: '#3b82f6',
                                  fontSize: '0.875rem',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>Personal Details</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <FaEnvelope style={{ color: '#64748b', fontSize: '0.875rem' }} />
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Email</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>{member.email}</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <FaPhone style={{ color: '#64748b', fontSize: '0.875rem' }} />
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Phone Number</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>{member.phone || 'Not provided'}</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <FaBirthdayCake style={{ color: '#64748b', fontSize: '0.875rem' }} />
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Birthday & Age</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                                        {member.birthday ? `${formatDate(member.birthday)} (${calculateAge(member.birthday)} years old)` : 'Not provided'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Musical Information */}
                              <div style={{
                                background: 'white',
                                padding: '1.25rem',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                border: '2px solid #222'
                              }}>
                                <h4 style={{
                                  margin: '0 0 1rem 0',
                                  color: '#3b82f6',
                                  fontSize: '0.875rem',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>Musical Background</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <FaMusic style={{ color: '#64748b', fontSize: '0.875rem' }} />
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Instrument</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: '600' }}>
                                        {member.instrument || 'Not specified'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Location Information */}
                              <div style={{
                                background: 'white',
                                padding: '1.25rem',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                border: '2px solid #222'
                              }}>
                                <h4 style={{
                                  margin: '0 0 1rem 0',
                                  color: '#3b82f6',
                                  fontSize: '0.875rem',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>Address</h4>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                  <FaMapMarkerAlt style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }} />
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Location</div>
                                    <div style={{ fontSize: '0.875rem', color: '#1e293b', lineHeight: '1.5' }}>
                                      {member.address || 'Not provided'}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Identity Proof */}
                              <div style={{
                                background: 'white',
                                padding: '1.25rem',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                border: '2px solid #222'
                              }}>
                                <h4 style={{
                                  margin: '0 0 1rem 0',
                                  color: '#3b82f6',
                                  fontSize: '0.875rem',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>Identity Verification</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <FaFileAlt style={{ color: '#64748b', fontSize: '0.875rem' }} />
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Identity Proof</div>
                                    {member.identity_proof ? (
                                      <a 
                                        href={`${API_BASE_URL.replace(/\/api$/i, '')}/${member.identity_proof}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: '0.875rem',
                                          color: '#3b82f6',
                                          textDecoration: 'none',
                                          fontWeight: '600',
                                          display: 'inline-block',
                                          marginTop: '0.25rem'
                                        }}
                                      >
                                        View Document
                                      </a>
                                    ) : (
                                      <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Not uploaded</div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Registration Information */}
                              <div style={{
                                background: 'white',
                                padding: '1.25rem',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                border: '1px solid #222'
                              }}>
                                <h4 style={{
                                  margin: '0 0 1rem 0',
                                  color: '#3b82f6',
                                  fontSize: '0.875rem',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>Registration Info</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <FaCalendarAlt style={{ color: '#64748b', fontSize: '0.875rem' }} />
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Applied On</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>{formatDate(member.created_at)}</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <FaUserPlus style={{ color: '#64748b', fontSize: '0.875rem' }} />
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Current Status</div>
                                      <div>
                                        <span style={{
                                          ...styles.roleBadge,
                                          backgroundColor: '#fef3c7',
                                          color: '#92400e'
                                        }}>
                                          {member.role_name || 'PENDING'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MembershipApproval;