  import React, { useState, useEffect } from 'react';
  import { 
    FaUsers, 
    FaUser, 
    FaUserShield, 
    FaUserSlash, 
    FaUserPlus, 
    FaEdit, 
    FaBan, 
    FaCheckCircle, 
    FaSearch, 
    FaFilter,
    FaEye,
    FaEyeSlash
  } from "../icons/fa";
  import AuthService from '../services/authService';

  const UserManagement = ({ user }) => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [roles, setRoles] = useState([]);
  const [authMissing, setAuthMissing] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // Password visibility toggle
    const [newUser, setNewUser] = useState({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: '',
      isBlocked: false
    });

    // No sample users: user list will come from the backend API

    // Move fetchUsersFromApi outside useEffect so it can be reused
  // Use centralized AuthService to ensure auth headers and error handling are consistent

    const fetchUsersFromApi = async () => {
      try {
        console.log('UserManagement: Fetching users via AuthService...');
        const data = await AuthService.get('/users');
        console.log('UserManagement: Fetched users data:', data);

        // Handle common response shapes and errors
        if (!data) {
          console.warn('UserManagement: Empty response from /users');
          setUsers([]);
          return;
        }

        if (data.success === false) {
          console.error('UserManagement: API returned error for /users:', data.message || data);
          setUsers([]);
          return;
        }

        if (data.users && Array.isArray(data.users)) {
          console.log('UserManagement: Loaded', data.users.length, 'users');
          setUsers(data.users);
          return;
        }

        // Unexpected shape — print full object for debugging
        console.warn('UserManagement: No users property in response, setting empty array. Raw response:');
        console.dir(data);
        setUsers([]);
      } catch (error) {
        console.error('UserManagement: Error fetching users from API:', error);
        // If there's no auth token or session expired, surface banner and stop further attempts
        const msg = (error && error.message) ? error.message : '';
        if (msg.includes('No authentication token') || msg.includes('Session expired') || msg.includes('Invalid or expired token')) {
          setAuthMissing(true);
        }
        setUsers([]);
      }
    };

    useEffect(() => {
        // Try to load users from backend API (requires auth token)
        fetchUsersFromApi();

        // Fetch roles from backend (not protected)
        const fetchRoles = async () => {
          try {
            const res = await fetch('http://localhost:5000/api/roles', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch roles');
            const data = await res.json();
            if (data && data.roles) {
              setRoles(data.roles);
              // set default newUser.role to first role if not set
              if (!newUser.role && data.roles.length > 0) {
                setNewUser(prev => ({ ...prev, role: data.roles[0].role_name }));
              }
            }
          } catch (err) {
            console.error('Error fetching roles:', err);
            setRoles([]);
          }
        };
        fetchRoles();
    }, []);

    // Helper function to format date
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    useEffect(() => {
      // Filter users based on search term and role filter
      console.log('Filtering effect running. Users count:', users.length, 'Search:', searchTerm, 'Role filter:', roleFilter);
      let filtered = users;
      
      if (searchTerm) {
        filtered = filtered.filter(user => 
          (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
      
      if (roleFilter !== 'all') {
        filtered = filtered.filter(user => user.role === roleFilter);
      }
      
      console.log('Filtered users count:', filtered.length);
      setFilteredUsers(filtered);
    }, [searchTerm, roleFilter, users]);

    const handleSearchChange = (e) => {
      setSearchTerm(e.target.value);
    };

    const handleRoleFilterChange = (e) => {
      setRoleFilter(e.target.value);
    };

    const toggleBlockUser = async (userId) => {
      try {
        console.log(`🔄 Toggling block status for user ${userId}...`);
        
        // Find the user to get current status
        const user = users.find(u => u.id === userId);
        if (!user) {
          console.error('❌ User not found:', userId);
          return;
        }
        
        const newBlockedStatus = !user.isBlocked;
        console.log(`📝 Setting isBlocked to: ${newBlockedStatus} for user:`, user.email);
        
        // Send only the required fields to backend (no avatar - column doesn't exist)
        const updatePayload = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isActive: user.isActive !== undefined ? user.isActive : true,
          isBlocked: newBlockedStatus
        };
        
        console.log('📤 Sending update payload:', updatePayload);
        
        // Update on backend
        const response = await AuthService.put(`/users/${userId}`, updatePayload);
        
        console.log('📥 Toggle block response:', response);
        
        if (response.success) {
          console.log(`✅ User ${userId} ${newBlockedStatus ? 'blocked' : 'unblocked'} successfully`);
          // Refresh user list from API to ensure sync
          await fetchUsersFromApi();
        } else {
          console.error('❌ Failed to toggle block:', response.message);
          alert(`Failed to ${newBlockedStatus ? 'block' : 'unblock'} user: ${response.message}`);
        }
      } catch (error) {
        console.error('❌ Error toggling block status:', error);
        const action = user?.isBlocked ? 'unblocking' : 'blocking';
        alert(`Error ${action} user: ${error.message}`);
      }
    };

    const handleCreateUser = async () => {
      try {
        console.log('🔵 Creating user:', newUser.email);
        const data = await AuthService.post('/users', newUser);
        console.log('📥 Create user response:', data);

        if (data.success) {
          console.log('✅ User created successfully, refreshing list...');
          await fetchUsersFromApi(); // Refresh the list
          setShowCreateModal(false);
          setNewUser({
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            role: 'user',
            isBlocked: false
          });
        } else {
          console.error('❌ Failed to create user:', data.message);
          alert(`Failed to create user: ${data.message}`);
        }
      } catch (error) {
        console.error('❌ Error creating user:', error);
        alert('Failed to create user. Please try again.');
      }
    };

    const handleEditUser = (userToEdit) => {
      setEditingUser({ ...userToEdit });
      setShowEditModal(true);
    };

    const handleUpdateUser = async () => {
      try {
        console.log('🔵 Updating user:', editingUser.id);
        const data = await AuthService.put(`/users/${editingUser.id}`, editingUser);
        console.log('📥 Update user response:', data);

        if (data.success) {
          console.log('✅ User updated successfully, refreshing list...');
          await fetchUsersFromApi(); // Refresh the list
          setShowEditModal(false);
          setEditingUser(null);
        } else {
          console.error('❌ Failed to update user:', data.message);
          alert(`Failed to update user: ${data.message}`);
        }
      } catch (error) {
        console.error('❌ Error updating user:', error);
        alert('Failed to update user. Please try again.');
      }
    };

    const handleEditInputChange = (e) => {
      const { name, value } = e.target;
      setEditingUser(prev => ({ ...prev, [name]: value }));
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setNewUser(prev => ({ ...prev, [name]: value }));
    };

    // Calculate counts
    const totalUsers = users.length;
    const totalUserRole = users.filter(user => user.role === 'user').length;
    const totalAdmins = users.filter(user => user.role === 'admin').length;
    const totalBlocked = users.filter(user => user.isBlocked).length;

    // Styles consistent with your design
    const styles = {
      container: {
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '2.5rem',
        color: '#0f172a',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      },
      title: {
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: '2.25rem',
        fontWeight: '700',
        margin: 0,
        color: '#0f172a',
        letterSpacing: '-0.02em'
      },
      backButton: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        color: '#475569',
        padding: '0.625rem 1.25rem',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500',
        transition: 'all 0.2s ease'
      },
      buttonContainer: {
        display: 'flex',
        alignItems: 'center'
      },
      statsContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2.5rem'
      },
      statCard: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '2rem',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      },
      statNumber: {
        fontSize: '2rem',
        fontWeight: '700',
        fontFamily: "'Inter', -apple-system, sans-serif",
        margin: '0 0 0.5rem 0',
        color: '#0f172a',
        letterSpacing: '-0.02em'
      },
      statLabel: {
        fontSize: '0.875rem',
        color: '#64748b',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      },
      controls: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        gap: '1rem',
        flexWrap: 'wrap'
      },
      filterSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap'
      },
      searchInput: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '0.625rem 1rem',
        color: '#0f172a',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'all 0.2s ease',
        minWidth: '200px'
      },
      filterSelect: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '0.625rem 1rem',
        color: '#0f172a',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'all 0.2s ease',
        minWidth: '150px',
        fontWeight: '500'
      },
      createButton: {
        backgroundColor: '#3b82f6',
        border: '1px solid #3b82f6',
        color: 'white',
        padding: '0.625rem 1.25rem',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      },
      table: {
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        tableLayout: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      },
      tableHeader: {
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
      tableCell: {
        padding: '1rem 1.25rem',
        borderBottom: '1px solid #f1f5f9',
        textAlign: 'center',
        verticalAlign: 'middle',
        color: '#334155',
        fontSize: '0.875rem'
      },
      nameCell: {
        textAlign: 'left',
        whiteSpace: 'normal',
        wordWrap: 'break-word',
        minWidth: '140px',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#0f172a'
      },
      emailCell: {
        textAlign: 'left',
        whiteSpace: 'normal',
        wordWrap: 'break-word',
        minWidth: '180px',
        fontSize: '0.8125rem',
        color: '#64748b'
      },
      statusBadge: {
        padding: '0.375rem 0.75rem',
        borderRadius: '100px',
        fontSize: '0.6875rem',
        fontWeight: '600',
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
        display: 'inline-block',
        whiteSpace: 'nowrap'
      },
      actionButton: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        color: '#475569',
        padding: '0.5rem 0.875rem',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: '500',
        transition: 'all 0.2s ease',
        marginRight: '0.5rem',
        minWidth: '60px'
      },
      editButton: {
        backgroundColor: 'white',
        border: '1px solid #3b82f6',
        color: '#3b82f6',
        padding: '0.375rem 0.5rem',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: '500',
        transition: 'all 0.2s ease',
        marginRight: '0',
        minWidth: '48px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap'
      },
      blockButton: {
        backgroundColor: 'white',
        border: '1px solid #f59e0b',
        color: '#f59e0b',
        padding: '0.375rem 0.5rem',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: '500',
        transition: 'all 0.2s ease',
        marginRight: '0',
        minWidth: '48px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap'
      },
      actionsCell: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '0.25rem',
        flexWrap: 'nowrap'
      },
      modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      },
      modalContent: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '2rem',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)'
      },
      emptyState: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '4rem 2rem',
        textAlign: 'center',
        color: '#64748b',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      },
      modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e2e8f0'
      },
      modalTitle: {
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: '1.25rem',
        fontWeight: '600',
        margin: 0,
        color: '#0f172a'
      },
      closeButton: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#64748b',
        fontSize: '1.5rem',
        cursor: 'pointer',
        transition: 'color 0.2s'
      },
      form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      },
      formRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem'
      },
      formField: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      },
      formLabel: {
        color: '#334155',
        fontSize: '0.875rem',
        fontWeight: '600'
      },
      formInput: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '0.625rem 0.875rem',
        color: '#0f172a',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'all 0.2s ease'
      },
      formSelect: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '0.625rem 0.875rem',
        color: '#0f172a',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'all 0.2s ease'
      },
      submitButton: {
        backgroundColor: '#3b82f6',
        border: '1px solid #3b82f6',
        color: 'white',
        padding: '0.75rem 1.25rem',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginTop: '0.5rem'
      }
    };

    // Add specific hover effects for different button types
    const handleEditButtonHover = (e) => {
      e.target.style.backgroundColor = '#eff6ff';
      e.target.style.borderColor = '#3b82f6';
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
    };

    const handleEditButtonLeave = (e) => {
      e.target.style.backgroundColor = 'white';
      e.target.style.borderColor = '#3b82f6';
      e.target.style.transform = 'translateY(0)';
      e.target.style.boxShadow = 'none';
    };

    const handleBlockButtonHover = (e) => {
      e.target.style.backgroundColor = '#fef3c7';
      e.target.style.borderColor = '#f59e0b';
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.2)';
    };

    const handleBlockButtonLeave = (e) => {
      e.target.style.backgroundColor = 'white';
      e.target.style.borderColor = '#f59e0b';
      e.target.style.transform = 'translateY(0)';
      e.target.style.boxShadow = 'none';
    };

    const handleButtonHover = (e) => {
      e.target.style.backgroundColor = '#f8fafc';
      e.target.style.borderColor = '#cbd5e1';
      e.target.style.transform = 'translateY(-1px)';
    };

    const handleButtonLeave = (e) => {
      e.target.style.backgroundColor = 'white';
      e.target.style.borderColor = '#e2e8f0';
      e.target.style.transform = 'translateY(0)';
    };

    const handleCreateButtonHover = (e) => {
      e.target.style.backgroundColor = '#2563eb';
      e.target.style.borderColor = '#2563eb';
      e.target.style.transform = 'translateY(-1px)';
      e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
    };

    const handleCreateButtonLeave = (e) => {
      e.target.style.backgroundColor = '#3b82f6';
      e.target.style.borderColor = '#3b82f6';
      e.target.style.transform = 'translateY(0)';
      e.target.style.boxShadow = 'none';
    };

    const handleInputFocus = (e) => {
      e.target.style.borderColor = '#3b82f6';
      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
    };

    const handleInputBlur = (e) => {
      e.target.style.borderColor = '#e2e8f0';
      e.target.style.boxShadow = 'none';
    };

    const handleStatCardHover = (e) => {
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
    };

    const handleStatCardLeave = (e) => {
      e.target.style.transform = 'translateY(0)';
      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    };

    return (
      <div style={styles.container}>
        {authMissing && (
          <div style={{ backgroundColor: '#fff3f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: 8, marginBottom: '1rem', color: '#7f1d1d' }}>
            <strong>Session required:</strong> You must be logged in to view users. Please log in again.
            <div style={{ marginTop: '0.5rem' }}>
              <button
                onClick={() => { AuthService.logout(); window.location.href = '/login'; }}
                style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 0.75rem', borderRadius: 6, cursor: 'pointer' }}
              >
                Go to Login
              </button>
            </div>
          </div>
        )}
        <div style={styles.header}>
          <div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div style={styles.statsContainer}>
          <div 
            style={styles.statCard}
            onMouseEnter={handleStatCardHover}
            onMouseLeave={handleStatCardLeave}
          >
            <FaUsers size={24} style={{ marginBottom: '10px', color: '#3b82f6' }} />
            <div style={{...styles.statNumber, color: '#3b82f6'}}>{totalUsers}</div>
            <div style={styles.statLabel}>Total Users</div>
          </div>
          <div 
            style={styles.statCard}
            onMouseEnter={handleStatCardHover}
            onMouseLeave={handleStatCardLeave}
          >
            <FaUser size={24} style={{ marginBottom: '10px', color: '#10b981' }} />
            <div style={{...styles.statNumber, color: '#10b981'}}>{totalUserRole}</div>
            <div style={styles.statLabel}>Regular Users</div>
          </div>
          <div 
            style={styles.statCard}
            onMouseEnter={handleStatCardHover}
            onMouseLeave={handleStatCardLeave}
          >
            <FaUserShield size={24} style={{ marginBottom: '10px', color: '#f59e0b' }} />
            <div style={{...styles.statNumber, color: '#f59e0b'}}>{totalAdmins}</div>
            <div style={styles.statLabel}>Administrators</div>
          </div>
          <div 
            style={styles.statCard}
            onMouseEnter={handleStatCardHover}
            onMouseLeave={handleStatCardLeave}
          >
            <FaUserSlash size={24} style={{ marginBottom: '10px', color: '#ef4444' }} />
            <div style={{...styles.statNumber, color: '#ef4444'}}>{totalBlocked}</div>
            <div style={styles.statLabel}>Blocked Users</div>
          </div>
        </div>

        <div style={styles.controls}>
          <div style={styles.filterSection}>
            <FaSearch size={16} style={{marginRight: 8, color: '#64748b'}} />
            <input
              type="text"
              placeholder="Search users..."
              style={styles.searchInput}
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
            <FaFilter size={16} style={{marginRight: 8, color: '#64748b'}} />
            <select
              style={styles.filterSelect}
              value={roleFilter}
              onChange={handleRoleFilterChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            >
              <option value="all">All Roles</option>
              {roles.map(r => (
                <option key={r.role_id} value={r.role_name}>{r.role_name}</option>
              ))}
            </select>
          </div>
          <button
            style={styles.createButton}
            onClick={() => setShowCreateModal(true)}
            onMouseEnter={handleCreateButtonHover}
            onMouseLeave={handleCreateButtonLeave}
          >
            <FaUserPlus style={{marginRight: 8}} /> Create User
          </button>
        </div>

        {filteredUsers.length > 0 ? (
          <div style={{ overflowX: 'auto', borderRadius: '16px' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.tableHeader, ...styles.nameCell, minWidth: '140px'}}>Name</th>
                  <th style={{...styles.tableHeader, ...styles.emailCell, minWidth: '180px'}}>Email</th>
                  <th style={{...styles.tableHeader, width: 'auto', minWidth: '80px'}}>Role</th>
                  <th style={{...styles.tableHeader, width: 'auto', minWidth: '80px'}}>Status</th>
                  <th style={{...styles.tableHeader, width: 'auto', minWidth: '100px'}}>Created</th>
                  <th style={{...styles.tableHeader, width: 'auto', minWidth: '200px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td style={{...styles.tableCell, ...styles.nameCell}}>{user.firstName} {user.lastName}</td>
                    <td style={{...styles.tableCell, ...styles.emailCell}}>{user.email}</td>
                    <td style={styles.tableCell}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: user.role === 'admin' ? '#dbeafe' : '#d1fae5',
                        color: user.role === 'admin' ? '#1e40af' : '#065f46'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: user.isBlocked ? '#fee2e2' : '#d1fae5',
                        color: user.isBlocked ? '#991b1b' : '#065f46'
                      }}>
                        {user.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td style={styles.tableCell}>{formatDate(user.createdAt)}</td>
                    <td style={styles.tableCell}>
                      <div style={styles.actionsCell}>
                        <button
                          style={styles.editButton}
                          onClick={() => handleEditUser(user)}
                          onMouseEnter={handleEditButtonHover}
                          onMouseLeave={handleEditButtonLeave}
                        >
                          <FaEdit size={11} style={{marginRight: 4}} /> Edit
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            style={styles.blockButton}
                            onClick={() => toggleBlockUser(user.id)}
                            onMouseEnter={handleBlockButtonHover}
                            onMouseLeave={handleBlockButtonLeave}
                          >
                            {user.isBlocked ? (
                              <><FaCheckCircle size={11} style={{marginRight: 4}} /> Unblock</>
                            ) : (
                              <><FaBan size={11} style={{marginRight: 4}} /> Block</> 
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p>No users found{searchTerm || roleFilter !== 'all' ? ` with current filters` : ''}.</p>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editingUser && (
          <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Edit User</h2>
                <button 
                  style={styles.closeButton}
                  onClick={() => setShowEditModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div style={styles.form}>
                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      style={styles.formInput}
                      value={editingUser.firstName}
                      onChange={handleEditInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      required
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      style={styles.formInput}
                      value={editingUser.lastName}
                      onChange={handleEditInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      required
                    />
                  </div>
                </div>
                
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Email</label>
                  <input
                    type="email"
                    name="email"
                    style={styles.formInput}
                    value={editingUser.email}
                    onChange={handleEditInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    required
                  />
                </div>
                
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Role</label>
                  <select
                    name="role"
                    style={styles.formSelect}
                    value={editingUser.role}
                    onChange={handleEditInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  >
                    {roles.map(r => (
                      <option key={r.role_id} value={r.role_name}>{r.role_name}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  type="button"
                  style={styles.submitButton}
                  onClick={handleUpdateUser}
                  onMouseEnter={handleCreateButtonHover}
                  onMouseLeave={handleCreateButtonLeave}
                >
                  Update User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateModal && (
          <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Create New User</h2>
                <button 
                  style={styles.closeButton}
                  onClick={() => setShowCreateModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div style={styles.form}>
                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      style={styles.formInput}
                      value={newUser.firstName}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      required
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      style={styles.formInput}
                      value={newUser.lastName}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      required
                    />
                  </div>
                </div>
                
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Email</label>
                  <input
                    type="email"
                    name="email"
                    style={styles.formInput}
                    value={newUser.email}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    required
                  />
                </div>
                
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Password</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      style={{
                        ...styles.formInput,
                        paddingRight: '45px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      value={newUser.password}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        height: '24px',
                        width: '24px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0ea5e9'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                    >
                      {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                    </button>
                  </div>
                </div>
                
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Role</label>
                  <select
                    name="role"
                    style={styles.formSelect}
                    value={newUser.role}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  >
                    {roles.map(r => (
                      <option key={r.role_id} value={r.role_name}>{r.role_name}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  type="button"
                  style={styles.submitButton}
                  onClick={handleCreateUser}
                  onMouseEnter={handleCreateButtonHover}
                  onMouseLeave={handleCreateButtonLeave}
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export default UserManagement;  