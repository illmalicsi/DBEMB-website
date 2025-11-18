import React, { useState, useEffect } from 'react';
import { FaMusic, FaEdit, FaSave, FaTimes, FaPlus, FaToggleOn, FaToggleOff, FaUsers, FaTruck, FaUtensils, FaChevronDown, FaChevronUp, FaConciergeBell } from '../icons/fa';

const ServiceManagement = () => {
  const [services, setServices] = useState([]);
  const [bandPackages, setBandPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedServiceId, setExpandedServiceId] = useState(null);
  const [expandedPackageId, setExpandedPackageId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [packageEditForm, setPackageEditForm] = useState({});
  const [showAddPackageForm, setShowAddPackageForm] = useState(false);
  const [showPackageSuccessModal, setShowPackageSuccessModal] = useState(false);
  const [packageSuccessMessage, setPackageSuccessMessage] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  
  // Generic success modal reused for operations (archive/unarchive)
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    default_price: '',
    duration_minutes: '',
    is_active: 1
  });
  const [newPackage, setNewPackage] = useState({
    package_key: '',
    package_name: '',
    description: '',
    price: '',
    num_players: '',
    includes_food: false,
    includes_transport: false,
    display_order: 0
  });

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      minHeight: '100vh'
    },
    statsGrid: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0',
      margin: '0 auto 24px',
      alignItems: 'stretch',
      padding: '0',
      boxSizing: 'border-box',
      justifyContent: 'space-between',
      maxWidth: '100%',
      backgroundColor: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
    },
    statCard: {
      flex: '1 1 200px',
      minWidth: 180,
      maxWidth: 250,
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: 0,
      padding: '28px 24px',
      textAlign: 'center',
      transition: 'all 0.18s ease',
      minHeight: 110,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'none',
      position: 'relative'
    },
    statValue: {
      fontSize: '22px',
      fontWeight: 700,
      color: '#0f172a',
      marginTop: 6,
      textAlign: 'center',
      lineHeight: 1.05
    },
    statLabel: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#64748b',
      marginTop: 4,
      textAlign: 'center'
    },
    tableCard: {
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100vw',
      margin: '0 0 24px 0',
      padding: '0'
    },
    tableHeader: {
      padding: '20px 18px',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'transparent',
      flexWrap: 'wrap'
    },
    tableTitle: {
      fontWeight: '700',
      color: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '25px',
      flexWrap: 'wrap',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    tableWrapper: {
      overflowX: 'auto',
      width: '100%',
      minWidth: 0,
      backgroundColor: '#ffffff'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'auto',
      fontSize: '13px',
      background: '#ffffff',
      minWidth: '600px',
      maxWidth: '100vw'
    },
    th: {
      backgroundColor: '#dbeafe',
      color: '#1e40af',
      fontWeight: '600',
      fontSize: '11px',
      padding: '12px 12px',
      textAlign: 'left',
      borderBottom: '2px solid #e2e8f0',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      letterSpacing: '0.3px',
      textTransform: 'uppercase'
    },
    td: {
      padding: '12px 12px',
      borderBottom: '1px solid #f1f5f9',
      fontSize: '13px',
      color: '#0f172a',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    trEven: {
      backgroundColor: '#f9fafb'
    },
    trOdd: {
      backgroundColor: '#f3f4f6'
    },
    expandedRow: {
      backgroundColor: '#ffffff'
    },
    detailsCell: {
      padding: '0',
      backgroundColor: '#f8fafc',
      borderBottom: '2px solid #e2e8f0'
    },
    detailsContainer: {
      padding: '20px 28px',
      maxWidth: '1200px'
    },
    detailsHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px',
      paddingBottom: '10px',
      borderBottom: '2px solid #e2e8f0'
    },
    detailsHeaderTitle: {
      fontSize: '15px',
      fontWeight: 700,
      color: '#0f172a',
      letterSpacing: '0.2px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      marginBottom: '16px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    formGroupFull: {
      gridColumn: '1 / -1'
    },
    label: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#475569',
      letterSpacing: '0.01em',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    input: {
      padding: '10px 14px',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      fontSize: '14px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'all 0.2s',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box'
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.3px'
    },
    statusActive: {
      backgroundColor: '#d1fae5',
      color: '#065f46',
      border: '2px solid #a7f3d0'
    },
    statusInactive: {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
      border: '2px solid #fca5a5'
    },
    expandButton: {
      background: '#f1f5f9',
      border: '1px solid #e2e8f0',
      cursor: 'pointer',
      padding: '6px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '6px',
      transition: 'all 0.2s',
      color: '#64748b'
    },
    btnPrimary: {
      background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
      border: 'none',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '10px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 600,
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    },
    btnSecondary: {
      backgroundColor: '#ffffff',
      color: '#475569',
      border: '1px solid #e2e8f0',
      padding: '10px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    },
    btnSuccess: {
      background: '#10b981',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    },
    btnDanger: {
      background: '#ef4444',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    },
    actionBar: {
      marginTop: '18px',
      paddingTop: '18px',
      borderTop: '2px solid #e2e8f0',
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end',
      backgroundColor: '#f8fafc',
      margin: '18px -28px -20px -28px',
      padding: '16px 28px',
      borderRadius: '0 0 8px 8px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '80px 20px',
      color: '#94a3b8',
      backgroundColor: '#ffffff'
    },
    emptyIcon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 80,
      height: 80,
      borderRadius: '50%',
      background: '#f1f5f9',
      marginBottom: 24
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: 600,
      color: '#0f172a',
      marginBottom: 8
    },
    emptyText: {
      color: '#475569',
      fontSize: '16px'
    }
    ,
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    },
    modalSmall: {
      background: 'white',
      borderRadius: 12,
      padding: '18px',
      width: '420px',
      maxWidth: '92%',
      boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: '#0f172a',
      marginBottom: 8
    },
    modalBody: {
      fontSize: 14,
      color: '#374151',
      marginBottom: 12
    }
  };

  const fetchServices = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/services/all', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setServices(data.services);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBandPackages = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/band-packages/all', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setBandPackages(data.packages);
      }
    } catch (error) {
      console.error('Error fetching band packages:', error);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchBandPackages();
  }, []);

  const handleEdit = (service) => {
    setEditingId(service.service_id);
    setExpandedServiceId(service.service_id);
    setEditForm({ ...service });
  };

  const handleSave = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/services/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const data = await response.json();
      if (data.success) {
        alert('Service updated successfully!');
        setEditingId(null);
        fetchServices();
      } else {
        alert(data.message || 'Failed to update service');
      }
    } catch (error) {
      console.error('Error updating service:', error);
      alert('An error occurred');
    }
  };

  const handleArchiveService = async (id) => {
    // Open confirmation modal before archiving
    setConfirmModal({
      open: true,
      title: 'Archive Service',
      message: 'Archive this service? This will remove it from active lists.',
      onConfirm: async () => {
        try {
          // fetch current service so we can send a full update payload (backend requires name & default_price)
          const getRes = await fetch(`http://localhost:5000/api/services/${id}`);
          if (!getRes.ok) {
            const err = await getRes.json().catch(() => ({}));
            alert(err.message || 'Failed to load service');
            return;
          }
          const { service } = await getRes.json();
          const payload = {
            name: service.name,
            description: service.description || null,
            default_price: service.default_price,
            duration_minutes: service.duration_minutes || null,
            is_active: 0
          };

          const resp = await fetch(`http://localhost:5000/api/services/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await resp.json();
          if (resp.ok && data.success) {
            setPackageSuccessMessage('Service archived');
            setShowPackageSuccessModal(true);
            fetchServices();
          } else {
            alert(data.message || 'Failed to archive service');
          }
        } catch (err) {
          console.error('Error archiving service:', err);
          alert('An error occurred');
        }
      }
    });
    return;
    try {
      // fetch current service so we can send a full update payload (backend requires name & default_price)
      const getRes = await fetch(`http://localhost:5000/api/services/${id}`);
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        alert(err.message || 'Failed to load service');
        return;
      }
      const { service } = await getRes.json();
      const payload = {
        name: service.name,
        description: service.description || null,
        default_price: service.default_price,
        duration_minutes: service.duration_minutes || null,
        is_active: 0
      };

      const resp = await fetch(`http://localhost:5000/api/services/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        setPackageSuccessMessage('Service archived');
        setShowPackageSuccessModal(true);
        fetchServices();
      } else {
        alert(data.message || 'Failed to archive service');
      }
    } catch (err) {
      console.error('Error archiving service:', err);
      alert('An error occurred');
    }
  };

  const handleUnarchiveService = async (id) => {
    try {
      const getRes = await fetch(`http://localhost:5000/api/services/${id}`);
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        alert(err.message || 'Failed to load service');
        return;
      }
      const { service } = await getRes.json();
      const payload = {
        name: service.name,
        description: service.description || null,
        default_price: service.default_price,
        duration_minutes: service.duration_minutes || null,
        is_active: 1
      };

      const resp = await fetch(`http://localhost:5000/api/services/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setPackageSuccessMessage('Service restored');
        setShowPackageSuccessModal(true);
        fetchServices();
      } else {
        alert(data.message || 'Failed to restore service');
      }
    } catch (err) {
      console.error('Error restoring service:', err);
      alert('An error occurred');
    }
  };

  const handleAddService = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/services', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService)
      });

      const data = await response.json();
      if (data.success) {
        alert('Service created successfully!');
        setShowAddForm(false);
        setNewService({
          name: '',
          description: '',
          default_price: '',
          duration_minutes: '',
          is_active: 1
        });
        fetchServices();
      } else {
        alert(data.message || 'Failed to create service');
      }
    } catch (error) {
      console.error('Error creating service:', error);
      alert('An error occurred');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setExpandedServiceId(null);
    setEditForm({});
  };

  const handleEditPackage = (pkg) => {
    setEditingPackageId(pkg.package_id);
    setExpandedPackageId(pkg.package_id);
    setPackageEditForm({ ...pkg });
  };

  const handleSavePackage = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/band-packages/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packageEditForm)
      });

      const data = await response.json();
      if (data.success) {
        // show success modal instead of alert
        setPackageSuccessMessage('Band package updated successfully!');
        setShowPackageSuccessModal(true);
        setEditingPackageId(null);
        fetchBandPackages();
      } else {
        alert(data.message || 'Failed to update package');
      }
    } catch (error) {
      console.error('Error updating package:', error);
      alert('An error occurred');
    }
  };

  const handleArchivePackage = async (id) => {
    setConfirmModal({
      open: true,
      title: 'Archive Band Package',
      message: 'Archive this band package? This will remove it from active lists.',
      onConfirm: async () => {
        try {
          // fetch current package to build a full update payload (backend requires name & price)
          const getRes = await fetch(`http://localhost:5000/api/band-packages/${id}`);
          if (!getRes.ok) {
            const err = await getRes.json().catch(() => ({}));
            alert(err.message || 'Failed to load band package');
            return;
          }
          const payloadObj = await getRes.json();
          const pkg = payloadObj.package;
          const payload = {
            package_key: pkg.package_key,
            package_name: pkg.package_name,
            description: pkg.description || null,
            price: pkg.price,
            num_players: pkg.num_players || null,
            includes_food: pkg.includes_food || false,
            includes_transport: pkg.includes_transport || false,
            display_order: pkg.display_order || 0,
            is_active: 0
          };

          const resp = await fetch(`http://localhost:5000/api/band-packages/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await resp.json();
          if (resp.ok && data.success) {
            setPackageSuccessMessage('Band package archived');
            setShowPackageSuccessModal(true);
            fetchBandPackages();
          } else {
            alert(data.message || 'Failed to archive package');
          }
        } catch (err) {
          console.error('Error archiving package:', err);
          alert('An error occurred');
        }
      }
    });
    return;
    try {
      // fetch current package to build a full update payload (backend requires name & price)
      const getRes = await fetch(`http://localhost:5000/api/band-packages/${id}`);
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        alert(err.message || 'Failed to load band package');
        return;
      }
      const payloadObj = await getRes.json();
      const pkg = payloadObj.package;
      const payload = {
        package_key: pkg.package_key,
        package_name: pkg.package_name,
        description: pkg.description || null,
        price: pkg.price,
        num_players: pkg.num_players || null,
        includes_food: pkg.includes_food || false,
        includes_transport: pkg.includes_transport || false,
        display_order: pkg.display_order || 0,
        is_active: 0
      };

      const resp = await fetch(`http://localhost:5000/api/band-packages/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setPackageSuccessMessage('Band package archived');
        setShowPackageSuccessModal(true);
        fetchBandPackages();
      } else {
        alert(data.message || 'Failed to archive package');
      }
    } catch (err) {
      console.error('Error archiving package:', err);
      alert('An error occurred');
    }
  };

  const handleUnarchivePackage = async (id) => {
    try {
      const getRes = await fetch(`http://localhost:5000/api/band-packages/${id}`);
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        alert(err.message || 'Failed to load band package');
        return;
      }
      const payloadObj = await getRes.json();
      const pkg = payloadObj.package;
      const payload = {
        package_key: pkg.package_key,
        package_name: pkg.package_name,
        description: pkg.description || null,
        price: pkg.price,
        num_players: pkg.num_players || null,
        includes_food: pkg.includes_food || false,
        includes_transport: pkg.includes_transport || false,
        display_order: pkg.display_order || 0,
        is_active: 1
      };

      const resp = await fetch(`http://localhost:5000/api/band-packages/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setPackageSuccessMessage('Band package restored');
        setShowPackageSuccessModal(true);
        fetchBandPackages();
      } else {
        alert(data.message || 'Failed to restore package');
      }
    } catch (err) {
      console.error('Error restoring package:', err);
      alert('An error occurred');
    }
  };

  const handleAddPackage = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/band-packages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPackage)
      });

      const data = await response.json();
      if (data.success) {
        alert('Band package created successfully!');
        setShowAddPackageForm(false);
        setNewPackage({
          package_key: '',
          package_name: '',
          description: '',
          price: '',
          num_players: '',
          includes_food: false,
          includes_transport: false,
          display_order: 0
        });
        fetchBandPackages();
      } else {
        alert(data.message || 'Failed to create package');
      }
    } catch (error) {
      console.error('Error creating package:', error);
      alert('An error occurred');
    }
  };

  const handleCancelPackage = () => {
    setEditingPackageId(null);
    setExpandedPackageId(null);
    setPackageEditForm({});
  };

  const toggleServiceExpand = (serviceId) => {
    if (expandedServiceId === serviceId) {
      setExpandedServiceId(null);
      setEditingId(null);
    } else {
      setExpandedServiceId(serviceId);
    }
  };

  const togglePackageExpand = (packageId) => {
    if (expandedPackageId === packageId) {
      setExpandedPackageId(null);
      setEditingPackageId(null);
    } else {
      setExpandedPackageId(packageId);
    }
  };

  // Calculate stats
  const activeServices = services.filter(s => s.is_active).length;
  const activePackages = bandPackages.filter(p => p.is_active).length;
  const avgServicePrice = services.length > 0 
    ? services.reduce((sum, s) => sum + parseFloat(s.default_price || 0), 0) / services.length 
    : 0;
  const avgPackagePrice = bandPackages.length > 0
    ? bandPackages.reduce((sum, p) => sum + parseFloat(p.price || 0), 0) / bandPackages.length
    : 0;

  return (
    <div style={styles.container}>
      {/* Statistics Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{services.length}</div>
          <div style={styles.statLabel}>Total Services</div>
          <div style={{
            position: 'absolute',
            right: 0,
            top: '25%',
            height: '50%',
            width: '1px',
            backgroundColor: '#e2e8f0'
          }}></div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>{activeServices}</div>
          <div style={styles.statLabel}>Active Services</div>
          <div style={{
            position: 'absolute',
            right: 0,
            top: '25%',
            height: '50%',
            width: '1px',
            backgroundColor: '#e2e8f0'
          }}></div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>{bandPackages.length}</div>
          <div style={styles.statLabel}>Band Packages</div>
          <div style={{
            position: 'absolute',
            right: 0,
            top: '25%',
            height: '50%',
            width: '1px',
            backgroundColor: '#e2e8f0'
          }}></div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>{activePackages}</div>
          <div style={styles.statLabel}>Active Packages</div>
          <div style={{
            position: 'absolute',
            right: 0,
            top: '25%',
            height: '50%',
            width: '1px',
            backgroundColor: '#e2e8f0'
          }}></div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>₱{avgServicePrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          <div style={styles.statLabel}>Avg Service Price</div>
        </div>
      </div>

      {/* Services Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div style={styles.tableTitle}>Services ({services.length})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
            <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={showAddForm ? styles.btnDanger : styles.btnPrimary}
            onMouseEnter={(e) => {
              if (showAddForm) {
                e.currentTarget.style.background = '#dc2626';
              } else {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (showAddForm) {
                e.currentTarget.style.background = '#ef4444';
              } else {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
              }
            }}
          >
            {showAddForm ? <>Cancel</> : <>Add Service</>}
          </button>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div style={styles.detailsCell}>
            <div style={styles.detailsContainer}>
              <div style={styles.detailsHeader}>
                <span style={styles.detailsHeaderTitle}>Add New Service</span>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Service Name *</label>
                  <input
                    type="text"
                    value={newService.name}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    style={styles.input}
                    placeholder="e.g., Band Gigs"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Default Price (₱) *</label>
                  <input
                    type="number"
                    value={newService.default_price}
                    onChange={(e) => setNewService({ ...newService, default_price: e.target.value })}
                    style={styles.input}
                    placeholder="5000"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Duration (minutes)</label>
                  <input
                    type="number"
                    value={newService.duration_minutes}
                    onChange={(e) => setNewService({ ...newService, duration_minutes: e.target.value })}
                    style={styles.input}
                    placeholder="120"
                  />
                </div>

                <div style={{ ...styles.formGroup, ...styles.formGroupFull }}>
                  <label style={styles.label}>Description</label>
                  <input
                    type="text"
                    value={newService.description}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    style={styles.input}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              <div style={styles.actionBar}>
                <button
                  onClick={handleAddService}
                  style={styles.btnSuccess}
                  disabled={!newService.name || !newService.default_price}
                  onMouseEnter={(e) => !e.target.disabled && (e.target.style.background = '#059669')}
                  onMouseLeave={(e) => !e.target.disabled && (e.target.style.background = '#10b981')}
                >Create Service
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={styles.emptyState}>
            <div>Loading...</div>
          </div>
        ) : services.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <FaConciergeBell style={{ width: 40, height: 40, color: '#94a3b8' }} />
            </div>
            <h3 style={styles.emptyTitle}>No Services Found</h3>
            <p style={styles.emptyText}>Get started by adding your first service.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Service Name</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>Duration</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {(showArchived ? services : services.filter(s => s.is_active)).map((service, index) => (
                  <React.Fragment key={service.service_id}>
                    <tr
                      style={{
                        transition: 'background-color 0.12s',
                        cursor: 'pointer',
                        ...(expandedServiceId === service.service_id ? styles.expandedRow : {}),
                        ...(expandedServiceId === service.service_id ? {} : (index % 2 === 0 ? styles.trEven : styles.trOdd))
                      }}
                      onMouseEnter={(e) => {
                        if (expandedServiceId !== service.service_id) {
                          e.currentTarget.style.backgroundColor = '#e0f2fe';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (expandedServiceId !== service.service_id) {
                          e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#f9fafb' : '#f3f4f6';
                        }
                      }}
                    >
                      <td style={{ ...styles.td, fontWeight: 600 }}>{service.name}</td>
                      <td style={{ ...styles.td, fontWeight: 700, color: '#2563eb' }}>
                        ₱{parseFloat(service.default_price).toLocaleString()}
                      </td>
                      <td style={styles.td}>{service.duration_minutes || '—'} min</td>
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span style={{
                          ...styles.badge,
                          ...(service.is_active ? styles.statusActive : styles.statusInactive)
                        }}>
                          {service.is_active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleServiceExpand(service.service_id);
                          }}
                          style={{
                            ...styles.expandButton,
                            transform: expandedServiceId === service.service_id ? 'rotate(180deg)' : 'rotate(0deg)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e2e8f0';
                            e.currentTarget.style.color = '#0f172a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                            e.currentTarget.style.color = '#64748b';
                          }}
                        >
                          <FaChevronDown size={14} />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedServiceId === service.service_id && (
                      <tr>
                        <td colSpan="5" style={styles.detailsCell}>
                          <div style={styles.detailsContainer}>
                            {editingId === service.service_id ? (
                              <>
                                <div style={styles.detailsHeader}>
                                  <FaEdit style={{ width: 18, height: 18, color: '#3b82f6' }} />
                                  <span style={styles.detailsHeaderTitle}>Edit Service</span>
                                </div>

                                <div style={styles.formGrid}>
                                  <div style={styles.formGroup}>
                                    <label style={styles.label}>Service Name</label>
                                    <input
                                      type="text"
                                      value={editForm.name}
                                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={styles.formGroup}>
                                    <label style={styles.label}>Default Price (₱)</label>
                                    <input
                                      type="number"
                                      value={editForm.default_price}
                                      onChange={(e) => setEditForm({ ...editForm, default_price: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={styles.formGroup}>
                                    <label style={styles.label}>Duration (minutes)</label>
                                    <input
                                      type="number"
                                      value={editForm.duration_minutes || ''}
                                      onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={{ ...styles.formGroup, ...styles.formGroupFull }}>
                                    <label style={styles.label}>Description</label>
                                    <input
                                      type="text"
                                      value={editForm.description || ''}
                                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>
                                </div>

                                <div style={styles.actionBar}>
                                  <button
                                    onClick={() => handleSave(service.service_id)}
                                    style={styles.btnSuccess}
                                    onMouseEnter={(e) => e.target.style.background = '#059669'}
                                    onMouseLeave={(e) => e.target.style.background = '#10b981'}
                                  >
                                    <FaSave /> Save Changes
                                  </button>
                                  <button
                                    onClick={handleCancel}
                                    style={styles.btnSecondary}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f8fafc';
                                      e.currentTarget.style.borderColor = '#cbd5e1';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#ffffff';
                                      e.currentTarget.style.borderColor = '#e2e8f0';
                                    }}
                                  >
                                    <FaTimes /> Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                {service.description && (
                                  <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0' }}>
                                    {service.description}
                                  </p>
                                )}
                                <div style={styles.actionBar}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      onClick={() => handleEdit(service)}
                                      style={styles.btnPrimary}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
                                      }}
                                    >
                                      <FaEdit /> Edit Service
                                    </button>
                                    {service.is_active ? (
                                      <button
                                        onClick={() => handleArchiveService(service.service_id)}
                                        style={styles.btnDanger}
                                      >
                                        Archive
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleUnarchiveService(service.service_id)}
                                        style={styles.btnSuccess}
                                      >
                                        Restore
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
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

      {/* Band Packages Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div style={styles.tableTitle}>Band Packages ({bandPackages.length})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
            <button
            onClick={() => setShowAddPackageForm(!showAddPackageForm)}
            style={showAddPackageForm ? styles.btnDanger : styles.btnPrimary}
            onMouseEnter={(e) => {
              if (showAddPackageForm) {
                e.currentTarget.style.background = '#dc2626';
              } else {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (showAddPackageForm) {
                e.currentTarget.style.background = '#ef4444';
              } else {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
              }
            }}
          >
            {showAddPackageForm ? <>Cancel</> : <>Add Package</>}
          </button>
          </div>
        </div>

        {/* Add Package Form */}
        {showAddPackageForm && (
          <div style={styles.detailsCell}>
            <div style={styles.detailsContainer}>
              <div style={styles.detailsHeader}>
                <span style={styles.detailsHeaderTitle}>Add New Band Package</span>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Package Key *</label>
                  <input
                    type="text"
                    value={newPackage.package_key}
                    onChange={(e) => setNewPackage({ ...newPackage, package_key: e.target.value })}
                    style={styles.input}
                    placeholder="e.g., 20-players-with"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Package Name *</label>
                  <input
                    type="text"
                    value={newPackage.package_name}
                    onChange={(e) => setNewPackage({ ...newPackage, package_name: e.target.value })}
                    style={styles.input}
                    placeholder="e.g., 20 Players Package"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Price (₱) *</label>
                  <input
                    type="number"
                    value={newPackage.price}
                    onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                    style={styles.input}
                    placeholder="15000"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of Players</label>
                  <input
                    type="number"
                    value={newPackage.num_players}
                    onChange={(e) => setNewPackage({ ...newPackage, num_players: e.target.value })}
                    style={styles.input}
                    placeholder="20"
                  />
                </div>

                <div style={{ ...styles.formGroup, ...styles.formGroupFull }}>
                  <label style={styles.label}>Description</label>
                  <input
                    type="text"
                    value={newPackage.description}
                    onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                    style={styles.input}
                    placeholder="Optional description"
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={newPackage.includes_food}
                      onChange={(e) => setNewPackage({ ...newPackage, includes_food: e.target.checked })}
                    />
                    <FaUtensils /> Includes Food
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={newPackage.includes_transport}
                      onChange={(e) => setNewPackage({ ...newPackage, includes_transport: e.target.checked })}
                    />
                    <FaTruck /> Includes Transport
                  </label>
                </div>
              </div>

              <div style={styles.actionBar}>
                <button
                  onClick={handleAddPackage}
                  style={styles.btnSuccess}
                  disabled={!newPackage.package_key || !newPackage.package_name || !newPackage.price}
                  onMouseEnter={(e) => !e.target.disabled && (e.target.style.background = '#059669')}
                  onMouseLeave={(e) => !e.target.disabled && (e.target.style.background = '#10b981')}
                > Create Package
                </button>
              </div>
            </div>
          </div>
        )}

        {bandPackages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <FaUsers style={{ width: 40, height: 40, color: '#94a3b8' }} />
            </div>
            <h3 style={styles.emptyTitle}>No Band Packages Found</h3>
            <p style={styles.emptyText}>Create your first band package to get started.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Package Name</th>
                  <th style={styles.th}>Players</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>Includes</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {(showArchived ? bandPackages : bandPackages.filter(p => p.is_active)).map((pkg, index) => (
                  <React.Fragment key={pkg.package_id}>
                    <tr
                      style={{
                        transition: 'background-color 0.12s',
                        cursor: 'pointer',
                        ...(expandedPackageId === pkg.package_id ? styles.expandedRow : {}),
                        ...(expandedPackageId === pkg.package_id ? {} : (index % 2 === 0 ? styles.trEven : styles.trOdd))
                      }}
                      onMouseEnter={(e) => {
                        if (expandedPackageId !== pkg.package_id) {
                          e.currentTarget.style.backgroundColor = '#e0f2fe';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (expandedPackageId !== pkg.package_id) {
                          e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#f9fafb' : '#f3f4f6';
                        }
                      }}
                    >
                      <td style={{ ...styles.td, fontWeight: 600 }}>{pkg.package_name}</td>
                      <td style={styles.td}>{pkg.num_players || '—'}</td>
                      <td style={{ ...styles.td, fontWeight: 700, color: '#7c3aed' }}>
                        ₱{parseFloat(pkg.price).toLocaleString()}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {pkg.includes_food && <span style={{ fontSize: '12px' }}>🍽️</span>}
                          {pkg.includes_transport && <span style={{ fontSize: '12px' }}>🚚</span>}
                          {!pkg.includes_food && !pkg.includes_transport && '—'}
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span style={{
                          ...styles.badge,
                          ...(pkg.is_active ? styles.statusActive : styles.statusInactive)
                        }}>
                          {pkg.is_active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePackageExpand(pkg.package_id);
                          }}
                          style={{
                            ...styles.expandButton,
                            transform: expandedPackageId === pkg.package_id ? 'rotate(180deg)' : 'rotate(0deg)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e2e8f0';
                            e.currentTarget.style.color = '#0f172a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                            e.currentTarget.style.color = '#64748b';
                          }}
                        >
                          <FaChevronDown size={14} />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Package Details */}
                    {expandedPackageId === pkg.package_id && (
                      <tr>
                        <td colSpan="6" style={styles.detailsCell}>
                          <div style={styles.detailsContainer}>
                            {editingPackageId === pkg.package_id ? (
                              <>
                                <div style={styles.detailsHeader}>
                                  <FaEdit style={{ width: 18, height: 18, color: '#3b82f6' }} />
                                  <span style={styles.detailsHeaderTitle}>Edit Band Package</span>
                                </div>

                                <div style={styles.formGrid}>
                                  <div style={styles.formGroup}>
                                    <label style={styles.label}>Package Key</label>
                                    <input
                                      type="text"
                                      value={packageEditForm.package_key}
                                      onChange={(e) => setPackageEditForm({ ...packageEditForm, package_key: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={styles.formGroup}>
                                    <label style={styles.label}>Package Name</label>
                                    <input
                                      type="text"
                                      value={packageEditForm.package_name}
                                      onChange={(e) => setPackageEditForm({ ...packageEditForm, package_name: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={styles.formGroup}>
                                    <label style={styles.label}>Price (₱)</label>
                                    <input
                                      type="number"
                                      value={packageEditForm.price}
                                      onChange={(e) => setPackageEditForm({ ...packageEditForm, price: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={styles.formGroup}>
                                    <label style={styles.label}>Number of Players</label>
                                    <input
                                      type="number"
                                      value={packageEditForm.num_players || ''}
                                      onChange={(e) => setPackageEditForm({ ...packageEditForm, num_players: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={{ ...styles.formGroup, ...styles.formGroupFull }}>
                                    <label style={styles.label}>Description</label>
                                    <input
                                      type="text"
                                      value={packageEditForm.description || ''}
                                      onChange={(e) => setPackageEditForm({ ...packageEditForm, description: e.target.value })}
                                      style={styles.input}
                                    />
                                  </div>

                                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                      <input
                                        type="checkbox"
                                        checked={packageEditForm.includes_food}
                                        onChange={(e) => setPackageEditForm({ ...packageEditForm, includes_food: e.target.checked })}
                                      />
                                      <FaUtensils /> Includes Food
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                      <input
                                        type="checkbox"
                                        checked={packageEditForm.includes_transport}
                                        onChange={(e) => setPackageEditForm({ ...packageEditForm, includes_transport: e.target.checked })}
                                      />
                                      <FaTruck /> Includes Transport
                                    </label>
                                  </div>
                                </div>

                                <div style={styles.actionBar}>
                                  <button
                                    onClick={() => handleSavePackage(pkg.package_id)}
                                    style={styles.btnSuccess}
                                    onMouseEnter={(e) => e.target.style.background = '#059669'}
                                    onMouseLeave={(e) => e.target.style.background = '#10b981'}
                                  >Save Changes
                                  </button>
                                  <button
                                    onClick={handleCancelPackage}
                                    style={styles.btnSecondary}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f8fafc';
                                      e.currentTarget.style.borderColor = '#cbd5e1';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#ffffff';
                                      e.currentTarget.style.borderColor = '#e2e8f0';
                                    }}
                                  >
                                    <FaTimes /> Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                {pkg.description && (
                                  <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0' }}>
                                    {pkg.description}
                                  </p>
                                )}
                                <div style={styles.actionBar}>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button
                                        onClick={() => handleEditPackage(pkg)}
                                        style={styles.btnPrimary}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'translateY(0)';
                                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
                                        }}
                                      >
                                        <FaEdit /> Edit Package
                                      </button>
                                      {pkg.is_active ? (
                                        <button
                                          onClick={() => handleArchivePackage(pkg.package_id)}
                                          style={styles.btnDanger}
                                        >
                                          Archive
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleUnarchivePackage(pkg.package_id)}
                                          style={styles.btnSuccess}
                                        >
                                          Restore
                                        </button>
                                      )}
                                    </div>
                                </div>
                              </>
                            )}
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
      {/* Success modal for package updates */}
      {showPackageSuccessModal && (
        <div style={styles.modalOverlay} onClick={() => setShowPackageSuccessModal(false)}>
          <div style={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Success</div>
            <div style={styles.modalBody}>{packageSuccessMessage}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowPackageSuccessModal(false)}
                style={{ ...styles.btnPrimary, padding: '8px 14px', fontSize: '13px' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation modal (replaces window.confirm) */}
      {confirmModal.open && (
        <div style={styles.modalOverlay} onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: null })}>
          <div style={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>{confirmModal.title}</div>
            <div style={styles.modalBody}>{confirmModal.message}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: null })}
                style={{ ...styles.btnSecondary, padding: '8px 14px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    if (confirmModal.onConfirm) await confirmModal.onConfirm();
                  } finally {
                    setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
                  }
                }}
                style={{ ...styles.btnPrimary, padding: '8px 14px', fontSize: '13px' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceManagement;

