import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AuthService from '../services/authService';
import theme from '../theme';
import { FaSearch, FaPlus, FaBox, FaEye, FaChevronDown, FaEllipsisV, FaEdit, FaArchive } from '../icons/fa';

const InstrumentItemsManager = ({ user, onBackToHome }) => {
  // State
  const [instrumentItems, setInstrumentItems] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPrefill, setAddPrefill] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  // viewDetails removed per UI simplification (Details view disabled)
  const [stats, setStats] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [portalPos, setPortalPos] = useState({ top: 0, left: 0 });
  const wrapperRefs = React.useRef({});
  const [portalMeta, setPortalMeta] = useState({ openLeft: false, openAbove: false });
  const [activeTab, setActiveTab] = useState('Snare Drums');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState(null);
  // Square menu size (px). Adjust to taste.
  const MENU_SIZE = 180;
  // Gap between button and menu (px). Smaller value moves menu closer to the button.
  const MENU_GAP = 6;
  
  // Filters
  const [filters, setFilters] = useState({
    instrumentId: '',
    // default: no location filter (show all allowed locations)
    locationId: '',
    status: '',
    condition: '',
    search: ''
  });

  // Fetch data on mount
  useEffect(() => {
    fetchInstrumentItems();
    fetchInstruments();
    fetchLocations();
    fetchStats();
  }, [filters]);

  // Refresh instrument items when related events occur (approvals, inventory changes, notifications)
  useEffect(() => {
    const handler = () => {
      try { fetchInstrumentItems(); } catch (e) { console.warn('Failed to refresh instrument items on event', e); }
    };
    const events = ['rentRequestsUpdated', 'borrowRequestsUpdated', 'instrumentsUpdated', 'notificationsUpdated'];
    events.forEach(ev => window.addEventListener(ev, handler));
    return () => events.forEach(ev => window.removeEventListener(ev, handler));
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId !== null) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // When user switches status filter to Archived, show the All tab
  useEffect(() => {
    if (filters.status === 'Archived') {
      setActiveTab('All');
    }
  }, [filters.status]);

  // Wrapper for AddEditModal save to avoid referencing handlers inline (prevents HMR timing issues)
  const handleModalSave = (data) => {
    try {
      if (editingItem) {
        if (typeof handleUpdateItem === 'function') {
          handleUpdateItem(editingItem.item_id, data);
          return;
        }
        // fallback: call API directly if helper missing
        alert('Update handler not available');
      } else {
        handleAddItem(data);
      }
    } catch (err) {
      console.error('handleModalSave error', err);
    }
  };

  const fetchInstrumentItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      // If user requested Archived, ignore other filters and fetch all archived items
      if (filters.status === 'Archived') {
        queryParams.append('status', 'Archived');
      } else {
        if (filters.instrumentId) queryParams.append('instrumentId', filters.instrumentId);
        if (filters.locationId) queryParams.append('locationId', filters.locationId);
        if (filters.status) queryParams.append('status', filters.status);
        if (filters.condition) queryParams.append('condition', filters.condition);
        if (filters.search) queryParams.append('serialNumber', filters.search);
      }

      const response = await AuthService.get(`/instrument-items?${queryParams.toString()}`);
      console.log('fetchInstrumentItems: response ->', response);
      console.log('fetchInstrumentItems: items count ->', (response.items || []).length);
      setInstrumentItems(response.items || []);
    } catch (err) {
      setError('Failed to fetch instrument items');
    } finally {
      setLoading(false);
    }
  };

  const fetchInstruments = async () => {
    try {
      const response = await AuthService.get('/instruments');
      setInstruments(response.instruments || []);
    } catch (err) {
      console.error('Failed to fetch instruments:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      // Fetch locations from server and keep only explicitly allowed names
      const response = await AuthService.get('/locations');
      console.log('fetchLocations: raw response ->', response);
      const all = response && (response.locations || response) ? (response.locations || response) : [];

      // allowlist (case-insensitive, substring match) — update these names if you want different ones
      const allowedKeys = ['sunrise', 'matina', 'aplaya'];
      const filtered = all.filter(l => {
        const name = (l.location_name || l.name || '').toString().trim().toLowerCase();
        return allowedKeys.some(k => name.includes(k));
      });

      if (!filtered || filtered.length === 0) {
        console.warn('fetchLocations: no allowlisted locations matched; returning all locations as fallback', { all });
        setLocations(all);
      } else {
        setLocations(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err && err.message ? err.message : err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await AuthService.get('/instrument-items/stats/dashboard');
      setStats(response.stats || {});
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleAddItem = async (itemData) => {
    try {
      let finalData = { ...itemData };
      
      // If "Others" is selected, create a new instrument first
      if (itemData.instrument_id === 'others' && itemData.custom_instrument_name) {
        const newInstrument = {
          name: itemData.custom_instrument_name,
          // preserve the category the user selected (fall back to 'Other' if not provided)
          category: itemData.category || 'Other',
          subcategory: 'Custom',
          brand: itemData.brand || 'N/A',
          description: 'Custom instrument added via inventory'
        };
        
        const response = await AuthService.post('/instruments', newInstrument);
        const createdId = response && (response.instrument_id || response.instrumentId || response.instrument_id);
        if (createdId) {
          finalData.instrument_id = createdId;
          delete finalData.custom_instrument_name;
        } else {
          throw new Error('Failed to create custom instrument');
        }
      } else {
        delete finalData.custom_instrument_name;
      }
      
      await AuthService.post('/instrument-items', finalData);
      setShowAddModal(false);
      fetchInstrumentItems();
      fetchInstruments(); // Refresh instruments list
      fetchStats();
    } catch (err) {
      alert('Failed to add item: ' + (err.message || 'Unknown error'));
    }
  };

  // Bulk add handler: try a single bulk POST, fallback to sequential adds
  const handleBulkAdd = async (items) => {
    try {
      const prepared = [];
      for (const it of items) {
        const copy = { ...it };
        if (!copy.instrument_id && copy.custom_instrument_name) {
          const newInstrument = {
            name: copy.custom_instrument_name,
            category: copy.category || 'Other',
            subcategory: 'Custom',
            brand: copy.brand || 'N/A',
            description: 'Custom instrument added via inventory'
          };
          try {
            const resp = await AuthService.post('/instruments', newInstrument);
            const created = resp && (resp.instrument_id || resp.instrumentId || resp.id || resp.instrument_id);
            if (created) {
              copy.instrument_id = created;
              delete copy.custom_instrument_name;
            }
          } catch (err) {
            // create failed, continue without instrument id
            console.warn('Failed to create custom instrument', err);
          }
        }
        prepared.push(copy);
      }

      try {
        await AuthService.post('/instrument-items/bulk', { items: prepared });
      } catch (err) {
        // fallback: post sequentially
        for (const p of prepared) {
          try { await AuthService.post('/instrument-items', p); } catch (e) { /* continue */ }
        }
      }

      // refresh lists
      fetchInstrumentItems();
      fetchInstruments();
      fetchStats();
    } catch (err) {
      alert('Failed to bulk add items: ' + (err.message || 'Unknown error'));
    }
  };

  // Update an existing instrument item
  const handleUpdateItem = async (itemId, itemData) => {
    try {
      let finalData = { ...itemData };

      // If user selected 'Others' and provided a custom instrument name, create that instrument first
      if (itemData.instrument_id === 'others' && itemData.custom_instrument_name) {
        const newInstrument = {
          name: itemData.custom_instrument_name,
          category: itemData.category || 'Other',
          subcategory: 'Custom',
          brand: itemData.brand || 'N/A',
          description: 'Custom instrument added via inventory'
        };
        const response = await AuthService.post('/instruments', newInstrument);
        const createdId = response && (response.instrument_id || response.instrumentId || response.id);
        if (createdId) {
          finalData.instrument_id = createdId;
          delete finalData.custom_instrument_name;
        }
      } else {
        delete finalData.custom_instrument_name;
      }

      await AuthService.put(`/instrument-items/${itemId}`, finalData);
      setEditingItem(null);
      fetchInstrumentItems();
      fetchInstruments();
      fetchStats();
    } catch (err) {
      alert('Failed to update item: ' + (err.message || 'Unknown error'));
    }
  };

  // Archive (soft-delete) an item by setting its `archived` flag
  const handleArchiveItem = async (item) => {
    try {
      if (!item || !item.item_id) return;
      // Backend uses DELETE (soft-delete -> is_active = FALSE) to archive items
      await AuthService.delete(`/instrument-items/${item.item_id}`);
      setOpenMenuId(null);
      // refresh lists
      fetchInstrumentItems();
      fetchStats();
    } catch (err) {
      alert('Failed to archive item: ' + (err && err.message ? err.message : 'Unknown error'));
    }
  };

  const handleUnarchiveItem = async (item) => {
    try {
      if (!item || !item.item_id) return;
      // Call new backend route to restore the item
      await AuthService.post(`/instrument-items/${item.item_id}/unarchive`);
      setOpenMenuId(null);
      // refresh lists
      fetchInstrumentItems();
      fetchStats();
    } catch (err) {
      alert('Failed to restore item: ' + (err && err.message ? err.message : 'Unknown error'));
    }
  };

  // viewItemDetails removed (Details view disabled)

  const getStatusStyle = (status) => {
    const baseStyle = { ...styles.badge };
    if (status === 'Available') return { ...baseStyle, ...styles.statusAvailable };
    if (status === 'Rented') return { ...baseStyle, ...styles.statusRented };
    if (status === 'Under Maintenance' || status === 'In Maintenance') return { ...baseStyle, ...styles.statusMaintenance };
    if (status === 'Archived') return { ...baseStyle, ...styles.statusArchived };
    return baseStyle;
  };

  const getConditionStyle = (condition) => {
    const baseStyle = { ...styles.badge };
    if (condition === 'Excellent') return { ...baseStyle, ...styles.conditionExcellent };
    if (condition === 'Good') return { ...baseStyle, ...styles.conditionGood };
    if (condition === 'Fair') return { ...baseStyle, ...styles.conditionFair };
    if (condition === 'Poor') return { ...baseStyle, ...styles.conditionPoor };
    return baseStyle;
  };

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '40px',
      backgroundColor: '#f1f5f9',
      minHeight: '100vh'
    },
    header: {
      marginBottom: '36px'
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12px'
    },
    title: {
      fontSize: '32px',
      fontWeight: '800',
      color: '#0f172a',
      letterSpacing: '-0.5px',
      margin: 0
    },
    subtitle: {
      fontSize: '16px',
      color: '#64748b',
      fontWeight: '400'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px',
      marginBottom: '18px'
    },
    statCard: {
      background: '#ffffff',
      padding: '12px 14px',
      borderRadius: '12px',
      color: '#0f172a',
      boxShadow: '0 6px 16px rgba(15, 23, 42, 0.04)',
      transition: 'transform 0.18s, box-shadow 0.18s',
      cursor: 'default',
      position: 'relative',
      overflow: 'visible',
      border: '1px solid rgba(15,23,42,0.06)'
    },
    statCardBg: {
      display: 'none'
    },
    accent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '6px',
      borderTopLeftRadius: '12px',
      borderBottomLeftRadius: '12px'
    },
    statContent: {
      position: 'relative',
      zIndex: 1
    },
    statValue: {
      fontSize: 'clamp(18px, 2.4vw, 28px)',
      fontWeight: '700',
      marginBottom: '4px',
      letterSpacing: '-0.6px',
      lineHeight: 1.05,
      color: '#0f172a'
    },
    // slightly smaller variant for long numeric values (currency/5+ digits)
    statValueSmall: {
      fontSize: 'clamp(16px, 2.2vw, 20px)',
      fontWeight: '700',
      marginBottom: '4px',
      letterSpacing: '-0.4px',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      lineHeight: 1.05,
      color: '#0f172a'
    },
    statLabel: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.6px'
    },
    filtersCard: {
      backgroundColor: '#ffffff',
      padding: '20px',
      borderRadius: '16px',
      marginBottom: '20px',
      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
      border: '1px solid #eef2ff'
    },
    filtersHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '24px'
    },
    filtersTitle: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    filtersGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px',
      alignItems: 'end'
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: '180px'
    },
    inputLabel: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#475569',
      letterSpacing: '0.3px',
      textTransform: 'uppercase'
    },
    input: {
      padding: '8px 10px',
      borderRadius: '8px',
      border: '1px solid #e6eefc',
      fontSize: '13px',
      fontFamily: 'inherit',
      transition: 'all 0.15s',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box'
    },
    select: {
      padding: '8px 10px',
      borderRadius: '8px',
      border: '1px solid #e6eefc',
      fontSize: '13px',
      fontFamily: 'inherit',
      transition: 'all 0.15s',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      cursor: 'pointer',
      outline: 'none',
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
    // reserve space on the right for custom chevron
      paddingRight: '44px',
      width: '100%',
      boxSizing: 'border-box'
    },
    btnPrimary: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#ffffff',
      border: 'none',
      padding: '14px 28px',
      borderRadius: '12px',
      fontSize: '15px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'all 0.3s',
      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
      letterSpacing: '0.3px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    },
    btnAddOutline: {
      background: 'transparent',
      color: '#334155',
      border: '2px solid #c7d2fe',
      padding: '10px 16px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'all 0.15s',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    },
    btnSecondary: {
      backgroundColor: '#f1f5f9',
      color: '#475569',
      border: '2px solid #e2e8f0',
      padding: '12px 24px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    tableCard: {
      backgroundColor: '#fff',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      border: '1px solid #e2e8f0',
      overflow: 'visible',
      width: '100%',
      maxWidth: '100vw',
      margin: '0',
      padding: '0',
    },
    tableHeader: {
      padding: '12px 16px',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#fafbfc',
      flexWrap: 'wrap',
    },
    tableTitle: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
    },
    tableWrapper: {
      overflowX: 'auto',
      overflowY: 'visible',
      width: '100%',
      minWidth: 0,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'auto',
      fontSize: '13px',
      background: 'transparent',
      minWidth: '600px',
      maxWidth: '100vw',
    },
    th: {
      backgroundColor: '#f8fafc',
      color: '#475569',
      fontWeight: '600',
      fontSize: '11px',
      padding: '8px 6px',
      textAlign: 'left',
      borderBottom: '2px solid #e2e8f0',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
      minWidth: '80px',
      maxWidth: '180px',
    },
    td: {
      padding: '8px 6px',
      borderBottom: '1px solid #f1f5f9',
      fontSize: '13px',
      color: '#0f172a',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: '80px',
      maxWidth: '180px',
    },
    badge: {
      display: 'inline-block',
      padding: '6px 14px',
      borderRadius: '25px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.3px'
    },
    statusAvailable: {
      backgroundColor: '#d1fae5',
      color: '#065f46',
      border: '2px solid #a7f3d0'
    },
    statusRented: {
      backgroundColor: '#fed7aa',
      color: '#92400e',
      border: '2px solid #fcd34d'
    },
    statusReserved: {
      backgroundColor: '#fff7ed',
      color: '#b45309',
      border: '2px solid #fcd34d'
    },
    statusMaintenance: {
      backgroundColor: '#fecaca',
      color: '#991b1b',
      border: '2px solid #fca5a5'
    },
    statusArchived: {
      backgroundColor: '#f1f5f9',
      color: '#475569',
      border: '2px solid #e2e8f0'
    },
    conditionExcellent: {
      backgroundColor: '#d1fae5',
      color: '#065f46',
      border: '2px solid #a7f3d0'
    },
    conditionGood: {
      backgroundColor: '#dbeafe',
      color: '#1e40af',
      border: '2px solid #93c5fd'
    },
    conditionFair: {
      backgroundColor: '#fed7aa',
      color: '#92400e',
      border: '2px solid #fcd34d'
    },
    conditionPoor: {
      backgroundColor: '#fecaca',
      color: '#991b1b',
      border: '2px solid #fca5a5'
    },
    actionIcon: {
      cursor: 'pointer',
      color: '#64748b',
      fontSize: '16px',
      padding: '6px',
      transition: 'all 0.2s',
      borderRadius: '8px'
    },
    actionMenu: {
      position: 'absolute',
      right: '0',
      top: '100%',
      marginTop: '8px',
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      width: `${MENU_SIZE}px`,
      height: `${MENU_SIZE}px`,
      zIndex: 9999,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      padding: '8px'
    },
    actionMenuItem: {
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: '13px',
      color: '#0f172a',
      borderBottom: '1px solid rgba(241,245,249,0.6)',
      transition: 'background-color 0.12s',
      fontWeight: '600',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    selectIcon: {
      position: 'absolute',
      right: '18px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: '#334155',
      fontSize: '14px'
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(8px)'
    },
    modal: {
      backgroundColor: '#ffffff',
      borderRadius: '24px',
      width: '90%',
      maxWidth: '700px',
      maxHeight: '90vh',
      overflow: 'visible',
      boxShadow: '0 30px 60px rgba(0,0,0,0.3)'
    },
    modalHeader: {
      padding: '32px 36px',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#ffffff',
      borderTopLeftRadius: '24px',
      borderTopRightRadius: '24px'
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: '800',
      margin : 0,
      letterSpacing: '-0.5px'
    },
    closeButton: {
      background: 'rgba(255,255,255,0.2)',
      border: 'none',
      fontSize: '28px',
      cursor: 'pointer',
      color: '#ffffff',
      lineHeight: '1',
      padding: '0',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      transition: 'all 0.2s'
    },
    modalBody: {
      padding: '36px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '24px',
      marginBottom: '28px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    formGroupFull: {
      gridColumn: '1 / -1'
    },
    label: {
      fontSize: '13px',
      fontWeight: '700',
      color: '#475569',
      letterSpacing: '0.3px',
      textTransform: 'uppercase'
    },
    textarea: {
      padding: '14px 16px',
      borderRadius: '12px',
      border: '2px solid #e2e8f0',
      fontSize: '14px',
      fontFamily: 'inherit',
      minHeight: '120px',
      resize: 'vertical',
      transition: 'all 0.2s',
      outline: 'none'
    },
    modalFooter: {
      padding: '24px 36px',
      borderTop: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '14px',
      backgroundColor: '#fafbfc',
      borderBottomLeftRadius: '24px',
      borderBottomRightRadius: '24px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '80px 20px',
      color: '#94a3b8'
    },
    emptyIcon: {
      fontSize: '64px',
      marginBottom: '20px',
      opacity: '0.4'
    },
    emptyText: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#64748b'
    }
    ,
    // Category card styles
    categoryCard: {
      backgroundColor: '#ffffff',
      border: '1px solid #e6eefc',
      borderRadius: '12px',
      padding: '12px',
      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
      overflow: 'visible'
    },
    categoryHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid #f1f5f9',
      marginBottom: '10px'
    },
    categoryBody: {
      // Let the category body expand to fit content and allow the page to scroll
      // instead of using an internal scrollbar.
      paddingRight: '8px'
    }
    ,
    // Tabs
    tabBar: {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px',
      flexWrap: 'wrap'
    },
    tabButton: {
      background: 'transparent',
      border: '1px solid transparent',
      padding: '8px 12px',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: '700',
      color: '#334155'
    },
    tabActive: {
      background: '#ffffff',
      border: '1px solid #e6eefc',
      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)'
    },
    tabBadge: {
      background: '#eef2ff',
      color: '#334155',
      padding: '4px 8px',
      borderRadius: '999px',
      marginLeft: '8px',
      fontSize: '12px',
      fontWeight: '700'
    }
  };

  // Format total value with comma separators and two decimals (fallback to 0)
  const formattedTotal = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(stats.total_value) || 0);

  // Group instrument items into the user's requested tabs (Snare, Bass, Percussion, Woodwind & Brass)
  let groupedByCategory = {};
  if (filters.status === 'Archived') {
    // When viewing Archived items, show them in a single 'All' group so the tab selection doesn't hide results.
    groupedByCategory = { All: instrumentItems.slice() };
  } else {
    groupedByCategory = instrumentItems.reduce((acc, item) => {
      const inst = instruments.find(i => String(i.instrument_id) === String(item.instrument_id));
      const rawCat = (inst && (inst.category || '')) || item.category || item.instrument_category || '';
      const rawSub = (inst && (inst.subcategory || '')) || item.subcategory || item.instrument_subcategory || '';
      const catLower = (rawCat || '').toString().toLowerCase();
      const subLower = (rawSub || '').toString().toLowerCase();

      // Map into the simplified tabs requested by user.
      // Priority: explicit subcategory keywords (snare/bass), then percussion, then wood/brass combined.
      let key = 'Other';
      if (subLower.includes('snare')) key = 'Snare Drums';
      else if (subLower.includes('bass')) key = 'Bass Drums';
      else if (catLower.includes('percussion')) key = 'Percussion';
      else if (catLower.includes('wood') || catLower.includes('woodwind') || catLower.includes('brass')) key = 'Woodwind & Brass';

      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  // Preferred tab order as requested by the user
  const preferred = ['Snare Drums', 'Bass Drums', 'Percussion', 'Woodwind & Brass'];
  // Ensure we include preferred tabs even when empty
  const otherKeys = Object.keys(groupedByCategory).filter(k => !preferred.includes(k)).sort();
  let categoryKeys = [...preferred, ...otherKeys];

  // If viewing archived items, show only the 'All' group
  if (filters.status === 'Archived') {
    categoryKeys = ['All'];
  }

  // Prepare portal-rendered actions menu (computed outside JSX to avoid parser issues)
  const portalMenu = (() => {
    if (!openMenuId) return null;
    const current = instrumentItems.find(i => String(i.item_id) === String(openMenuId));
    if (!current) return null;
    const menu = (
      <div id="instrument-items-action-menu" style={{ ...styles.actionMenu, position: 'fixed', top: portalPos.top, left: portalPos.left, zIndex: 20000 }} onClick={(e) => e.stopPropagation()}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setViewItem(current); setOpenMenuId(null); }}
          style={{ ...styles.actionMenuItem, display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <FaEye size={14} color="#4c51bf" />
          <span>View</span>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setEditingItem(current); setOpenMenuId(null); }}
          style={{ ...styles.actionMenuItem, display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <FaEdit size={14} color="#0f172a" />
          <span>Edit</span>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            // Open Add modal prefilled as a replacement for this item
            const pre = {
              category: current.category || current.instrument_category || undefined,
              instrument_id: current.instrument_id || undefined,
              location_id: current.location_id ? String(current.location_id) : undefined,
              notes: `Replacement for item ${current.item_id} (serial ${current.serial_number || 'unknown'})`
            };
            setAddPrefill(pre);
            setShowAddModal(true);
            setOpenMenuId(null);
          }}
          style={{ ...styles.actionMenuItem, display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <FaPlus size={14} color="#0f9d58" />
          <span>Create Replacement</span>
        </div>
        {((current.is_active === 0 || current.is_active === false)) ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setUnarchiveTarget(current); setOpenMenuId(null); }}
            style={{ ...styles.actionMenuItem, display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            <FaArchive size={14} color="#065f46" />
            <span>Unarchive</span>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setArchiveTarget(current); setOpenMenuId(null); }}
            style={{ ...styles.actionMenuItem, display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            <FaArchive size={14} color="#92400e" />
            <span>Archived</span>
          </div>
        )}
        {/* arrow pointer */}
        {portalMeta && (
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: portalMeta.openAbove ? 'none' : '8px solid rgba(15,23,42,0.06)',
              borderBottom: portalMeta.openAbove ? '8px solid rgba(15,23,42,0.06)' : 'none',
              left: portalPos.anchorX ? Math.max(MENU_GAP, Math.min(portalPos.anchorX - portalPos.left - MENU_GAP, (MENU_SIZE - (MENU_GAP * 2)))) : (MENU_GAP * 2),
              top: portalMeta.openAbove ? 'auto' : -MENU_GAP,
              bottom: portalMeta.openAbove ? -MENU_GAP : 'auto',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
    );

    try { return createPortal(menu, document.body); } catch (err) { return menu; }
  })();

  // Recompute portal position when scrolling or resizing so the fixed menu follows the button
  useEffect(() => {
    if (!openMenuId) return;
    const updatePos = () => {
      try {
        const el = wrapperRefs.current[openMenuId];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const menuWidth = MENU_SIZE;
        const estimatedMenuHeight = MENU_SIZE; // menu is square
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const spaceRight = vw - rect.right;
        const spaceLeft = rect.left;

        // prefer opening to the left if there's room (avoid overlapping card)
        const openLeft = spaceLeft >= (menuWidth + MENU_GAP);
        let left;
        if (openLeft) {
          left = Math.max(MENU_GAP, rect.left - menuWidth - MENU_GAP);
        } else {
          const leftRaw = rect.right - menuWidth + MENU_GAP;
          left = Math.max(MENU_GAP, Math.min(leftRaw, vw - menuWidth - MENU_GAP));
        }

        // prefer opening below; flip above if not enough space below
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;
        let openAbove = false;
        if (spaceBelow < (estimatedMenuHeight + MENU_GAP) && spaceAbove >= (estimatedMenuHeight + MENU_GAP)) {
          openAbove = true;
        }

        const top = openAbove ? (rect.top - estimatedMenuHeight - MENU_GAP) : (rect.bottom + MENU_GAP);
        const anchorX = rect.left + rect.width / 2;

        setPortalMeta({ openLeft, openAbove });
        setPortalPos({ top, left, anchorX });

        // After menu renders, measure its actual height and correct if needed
        requestAnimationFrame(() => {
          try {
            const menuEl = document.getElementById('instrument-items-action-menu');
            if (!menuEl) return;
            const mh = menuEl.getBoundingClientRect().height;
            // If measurement significantly differs from estimate, recompute top
            if (Math.abs(mh - estimatedMenuHeight) > 8) {
              const correctedOpenAbove = spaceBelow < (mh + 8) && spaceAbove >= (mh + 8);
              const correctedTop = correctedOpenAbove ? (rect.top - mh - 8) : (rect.bottom + 8);
              setPortalMeta({ openLeft, openAbove: correctedOpenAbove });
              setPortalPos({ top: correctedTop, left, anchorX });
            }
          } catch (err) { /* ignore */ }
        });

      } catch (e) { /* ignore */ }
    };

    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    // keep position in sync immediately
    updatePos();
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [openMenuId]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          {/* Title removed: dashboard already provides section labels */}
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{...styles.accent, background: 'linear-gradient(180deg, #667eea, #764ba2)'}}></div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{(stats.total_items || 0).toLocaleString()}</div>
            <div style={styles.statLabel}>Total Items</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{...styles.accent, background: 'linear-gradient(180deg,#f093fb,#f5576c)'}}></div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{(stats.available_items || 0).toLocaleString()}</div>
            <div style={styles.statLabel}>Available</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{...styles.accent, background: 'linear-gradient(180deg,#4facfe,#00f2fe)'}}></div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{(stats.rented_items || 0).toLocaleString()}</div>
            <div style={styles.statLabel}>Rented</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{...styles.accent, background: 'linear-gradient(180deg,#fa709a,#fee140)'}}></div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{(stats.borrowed_items || 0).toLocaleString()}</div>
            <div style={styles.statLabel}>Borrowed</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{...styles.accent, background: 'linear-gradient(180deg,#43e97b,#38f9d7)'}}></div>
          <div style={styles.statContent}>
            <div style={styles.statValue}>{(stats.maintenance_items || 0).toLocaleString()}</div>
            <div style={styles.statLabel}>Maintenance</div>
          </div>
        </div>

        <div style={{...styles.statCard, gridColumn: 'span 2', minWidth: '260px'}}>
          <div style={{...styles.accent, background: 'linear-gradient(180deg,#6b7280,#4338ca)'}}></div>
          <div style={styles.statContent}>
            <div style={styles.statValueSmall}>₱{formattedTotal}</div>
            <div style={styles.statLabel}>Total Value</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersCard}>
        <div style={styles.filtersHeader}>
          <div style={styles.filtersTitle}>
            <FaSearch /> Filter Items
          </div>
        </div>
        <div style={styles.filtersGrid}>
          <div style={styles.inputGroup}>
            <input
              aria-label="Search"
              style={styles.input}
              type="text"
              placeholder="Search serial or keyword"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div style={styles.inputGroup}>
            <div style={{ position: 'relative' }}>
              <select
                aria-label="Instrument"
                style={styles.select}
                value={filters.instrumentId}
                onChange={(e) => setFilters({ ...filters, instrumentId: e.target.value })}
              >
               <option value="">All instruments</option>
               {instruments.map(inst => (
                 <option key={inst.instrument_id} value={inst.instrument_id}>
                   {inst.name}
                 </option>
               ))}
              </select>
              <FaChevronDown style={styles.selectIcon} />
            </div>
          </div>
          <div style={styles.inputGroup}>
            <div style={{ position: 'relative' }}>
              <select
                aria-label="Location"
                style={styles.select}
                value={filters.locationId}
                onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}
              >
               <option value="">All locations</option>
               {locations && locations.length > 0 ? (
                 locations.map(loc => (
                   <option key={loc.location_id} value={String(loc.location_id)}>
                     {loc.location_name}
                   </option>
                 ))
               ) : (
                 <option value="">No locations</option>
               )}
              </select>
              <FaChevronDown style={styles.selectIcon} />
            </div>
          </div>
          <div style={styles.inputGroup}>
            <div style={{ position: 'relative' }}>
              <select
                aria-label="Status"
                style={styles.select}
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
               <option value="">All status</option>
               <option value="Available">Available</option>
               <option value="Rented">Rented</option>
               <option value="Borrowed">Borrowed</option>
               <option value="Under Maintenance">In Maintenance</option>
                 <option value="Archived">Archived</option>
              </select>
              <FaChevronDown style={styles.selectIcon} />
            </div>
          </div>
          <div style={styles.inputGroup}>
            <div style={{ position: 'relative' }}>
              <select
                aria-label="Condition"
                style={styles.select}
                value={filters.condition}
                onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
              >
               <option value="">All condition</option>
               <option value="Excellent">Excellent</option>
               <option value="Good">Good</option>
               <option value="Fair">Fair</option>
               <option value="Poor">Poor</option>
              </select>
              <FaChevronDown style={styles.selectIcon} />
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>
              <FaBox /> Instrument Items ({instrumentItems.length})
            </div>
            <div>
              <button
                style={styles.btnAddOutline}
                onClick={() => setShowAddModal(true)}
                aria-label="Add New Item"
              >
                <FaPlus /> Add New Item
              </button>
            </div>
        </div>
        <div style={styles.tableWrapper}>
          {loading ? (
            <div style={styles.emptyState}>
              <div>Loading...</div>
            </div>
          ) : error ? (
            <div style={styles.emptyState}>
              <div style={{ color: '#ef4444' }}>{error}</div>
            </div>
          ) : instrumentItems.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📦</div>
              <div style={styles.emptyText}>No instrument items found</div>
            </div>
          ) : (
            <div style={{ padding: '8px' }}>
              <div style={styles.tabBar}>
                {categoryKeys.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === tab ? styles.tabActive : {})
                    }}
                  >
                    {tab}
                    <span style={styles.tabBadge}>{(groupedByCategory[tab] || []).length}</span>
                  </button>
                ))}
              </div>

              <div>
                <div style={styles.categoryCard}>
                  <div style={styles.categoryHeader}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{activeTab}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{(groupedByCategory[activeTab] || []).length} item{(groupedByCategory[activeTab] || []).length !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={styles.categoryBody}>
                    {((groupedByCategory[activeTab] || []).length === 0) ? (
                      <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📦</div>
                        <div style={styles.emptyText}>No items in {activeTab}</div>
                      </div>
                    ) : (
                      <table style={styles.table}>
                            <thead>
                          <tr>
                            {/* Balanced widths that sum to 100% */}
                            <th style={{ ...styles.th, width: '15%' }}>Serial</th>
                            <th style={{ ...styles.th, width: '35%' }}>Instrument</th>
                            <th style={{ ...styles.th, width: '25%' }}>Location</th>
                            <th style={{ ...styles.th, width: '15%' }}>Acquired</th>
                            <th style={{ ...styles.th, width: '15%', textAlign: 'center' }}>Status</th>
                            <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(groupedByCategory[activeTab] || []).map(item => (
                            <tr key={item.item_id} style={{ transition: 'background-color 0.12s' }}>
                              <td style={styles.td} title={item.serial_number}><strong>{item.serial_number}</strong></td>
                              <td style={{ ...styles.td, whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.instrument_name}</td>
                              <td style={{ ...styles.td, whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.location_name || 'N/A'}</td>
                              <td style={{ ...styles.td }}>{item.acquisition_date ? (new Date(item.acquisition_date)).toLocaleDateString() : '—'}</td>
                              {
                                (() => {
                                  const displayStatus = (item.is_active === 0 || item.is_active === false) ? 'Archived' : (item.status || '—');
                                  return (
                                    <td style={{ ...styles.td, textAlign: 'center' }}><span style={getStatusStyle(displayStatus)}>{displayStatus}</span></td>
                                  );
                                })()
                              }
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <div style={{ position: 'relative', display: 'inline-flex', justifyContent: 'center', gap: '8px', alignItems: 'center', overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    ref={el => wrapperRefs.current[item.item_id] = el}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const id = item.item_id;
                                      if (openMenuId === id) {
                                        setOpenMenuId(null);
                                        return;
                                      }
                                      // compute portal coordinates relative to viewport (fixed positioning)
                                      try {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const menuWidth = MENU_SIZE; // approximate menu width
                                        const menuHeight = MENU_SIZE; // estimated menu height for flipping (square)
                                        const vw = document.documentElement.clientWidth;
                                        const vh = document.documentElement.clientHeight;
                                        const spaceRight = vw - rect.right;
                                        const spaceLeft = rect.left;
                                        const spaceBelow = vh - rect.bottom;
                                        const spaceAbove = rect.top;
                                        let left;
                                        let openLeft = false;
                                        // prefer opening to the left when there's room
                                        if (spaceLeft >= menuWidth + MENU_GAP) {
                                          left = Math.max(MENU_GAP, rect.left - menuWidth - MENU_GAP);
                                          openLeft = true;
                                        } else {
                                          const leftRaw = rect.right - menuWidth + MENU_GAP;
                                          left = Math.max(MENU_GAP, Math.min(leftRaw, vw - menuWidth - MENU_GAP));
                                          openLeft = false;
                                        }
                                        // decide above/below
                                        let top;
                                        let openAbove = false;
                                        if (spaceBelow >= menuHeight + MENU_GAP) {
                                          top = rect.bottom + MENU_GAP;
                                          openAbove = false;
                                        } else if (spaceAbove >= menuHeight + MENU_GAP) {
                                          top = rect.top - menuHeight - MENU_GAP;
                                          openAbove = true;
                                        } else {
                                          if (spaceBelow >= spaceAbove) {
                                            top = Math.min(vh - menuHeight - MENU_GAP, rect.bottom + MENU_GAP);
                                            openAbove = false;
                                          } else {
                                            top = Math.max(MENU_GAP, rect.top - menuHeight - MENU_GAP);
                                            openAbove = true;
                                          }
                                        }
                                        setPortalPos({ top, left, anchorX: rect.left + rect.width / 2 });
                                        setPortalMeta({ openLeft, openAbove });
                                      } catch (err) {
                                        setPortalPos({ top: 8, left: 8 });
                                        setPortalMeta({ openLeft: false, openAbove: false });
                                      }
                                      setOpenMenuId(id);
                                    }}
                                    title="Actions"
                                    aria-label="Open actions menu"
                                    style={{
                                      ...styles.actionIcon,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '6px',
                                      borderRadius: '8px',
                                      border: '1px solid #e2e8f0',
                                      background: '#ffffff'
                                    }}
                                  >
                                    <FaEllipsisV size={14} color="#475569" />
                                  </button>

                                  {/* placeholder removed; button holds the ref now */}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <AddEditModal
          item={editingItem}
          instruments={instruments}
          locations={locations}
          prefill={addPrefill}
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
            setAddPrefill(null);
          }}
          onSave={handleModalSave}
          onBulkSave={(items) => handleBulkAdd(items)}
          styles={styles}
        />
      )}
      {viewItem && (
        <ViewModal
          item={viewItem}
          onClose={() => setViewItem(null)}
          styles={styles}
        />
      )}
      {/* Archive confirmation modal */}
      {archiveTarget && (
        <div style={styles.modalOverlay} onClick={() => setArchiveTarget(null)}>
          <div style={{ ...styles.modal, width: '420px', maxWidth: '92%', padding: '12px', borderRadius: '8px', boxShadow: '0 8px 20px rgba(2,6,23,0.08)', border: '1px solid rgba(15,23,42,0.06)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px 10px', borderRadius: '6px', background: 'transparent' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Archive Item</h4>
              <button style={{ ...styles.closeButton, width: '34px', height: '34px', fontSize: '20px' }} onClick={() => setArchiveTarget(null)} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '6px 6px 12px 6px' }}>
              <p style={{ margin: 0, color: '#0f172a', fontSize: '13px' }}>Move this item to Archived?</p>
              <div style={{ marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setArchiveTarget(null)} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '13px' }}>Cancel</button>
                <button onClick={async () => { await handleArchiveItem(archiveTarget); setArchiveTarget(null); }} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px' }}>Archive</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {unarchiveTarget && (
        <div style={styles.modalOverlay} onClick={() => setUnarchiveTarget(null)}>
          <div style={{ ...styles.modal, width: '420px', maxWidth: '92%', padding: '12px', borderRadius: '8px', boxShadow: '0 8px 20px rgba(2,6,23,0.08)', border: '1px solid rgba(15,23,42,0.06)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px 10px', borderRadius: '6px', background: 'transparent' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Restore Item</h4>
              <button style={{ ...styles.closeButton, width: '34px', height: '34px', fontSize: '20px' }} onClick={() => setUnarchiveTarget(null)} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '6px 6px 12px 6px' }}>
              <p style={{ margin: 0, color: '#0f172a', fontSize: '13px' }}>Restore this item to Active inventory?</p>
              <div style={{ marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setUnarchiveTarget(null)} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '13px' }}>Cancel</button>
                <button onClick={async () => { await handleUnarchiveItem(unarchiveTarget); setUnarchiveTarget(null); }} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '13px' }}>Restore</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {portalMenu}
    </div>
  );
};

// Add/Edit Modal Component
const AddEditModal = ({ item, instruments, locations, prefill, onClose, onSave, onBulkSave, styles }) => {
  // derive category list from instruments prop
  const categories = React.useMemo(() => {
    try {
      const cats = instruments && instruments.length ? instruments.map(i => (i.category || 'Uncategorized').toString().trim()) : [];
      return Array.from(new Set(cats)).sort();
    } catch (e) { return []; }
  }, [instruments]);

  const [formData, setFormData] = useState({
    category: item?.category || (categories[0] || ''),
    instrument_id: item?.instrument_id || '',
    serial_number: item?.serial_number || '',
    location_id: item?.location_id || '',
    status: (item && (item.status === 'In Maintenance' ? 'Under Maintenance' : item.status)) || 'Available',
    condition_status: item?.condition_status || 'Good',
    purchase_cost: item?.purchase_cost || '',
    acquisition_date: item?.acquisition_date ? new Date(item.acquisition_date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
    brand: item?.brand || '',
    notes: item?.notes || '',
    // bulk-add helpers
    bulkMode: false,
    serials: [],
    custom_instrument_name: ''
  });

  // Apply prefill when opening Add modal as a replacement
  useEffect(() => {
    if (!item && prefill) {
      const norm = { ...prefill };
      if (norm.status === 'In Maintenance') norm.status = 'Under Maintenance';
      setFormData(prev => ({ ...prev, ...Object.fromEntries(Object.entries(norm).filter(([k,v]) => v !== undefined)) }));
    }
  }, [prefill, item]);

  // When category changes, clear instrument selection so user actively picks one
  useEffect(() => {
    if (formData.category && (!formData.instrument_id || formData.instrument_id === '')) {
      // try to preselect first instrument in category if editing not provided
      const first = (instruments || []).find(i => (i.category || 'Uncategorized') === formData.category);
      if (first) setFormData(prev => ({ ...prev, instrument_id: prev.instrument_id || first.instrument_id }));
    }
    // if no category set, and categories exist, set default
    if ((!formData.category || formData.category === '') && categories && categories.length > 0) {
      setFormData(prev => ({ ...prev, category: categories[0] }));
    }
  }, [formData.category, categories, instruments]);

  // If locations list contains only one entry, preselect it for convenience
  useEffect(() => {
    if ((!formData.location_id || formData.location_id === '') && Array.isArray(locations) && locations.length === 1) {
      setFormData(prev => ({ ...prev, location_id: String(locations[0].location_id) }));
    }
  }, [locations]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // If editing existing item, fall back to single-update behavior
    if (item) {
      onSave(formData);
      return;
    }

    // Bulk-add mode: create multiple payloads and call onSave for each (use inline serial rows)
    if (formData.bulkMode) {
      const serialsFromRows = (formData.serials || []).map(s => (s || '').toString().trim()).filter(Boolean);

      // trim empty, dedupe and validate
      const unique = [];
      const seen = new Set();
      const duplicates = new Set();
      for (const s of serialsFromRows) {
        const t = s;
        if (seen.has(t)) duplicates.add(t);
        else { seen.add(t); unique.push(t); }
      }

      if (duplicates.size > 0) {
        setValidationErrors([`Duplicate serials detected: ${Array.from(duplicates).join(', ')}`]);
        return;
      }

      if (unique.length === 0 && formData.serial_number) unique.push(formData.serial_number);
      if (unique.length === 0) unique.push(`AUTO-${Date.now()}-1`);

      const items = unique.map(s => ({
        category: formData.category,
        instrument_id: formData.instrument_id === 'others' ? null : formData.instrument_id,
        custom_instrument_name: formData.instrument_id === 'others' ? formData.custom_instrument_name : undefined,
        brand: formData.brand || undefined,
        serial_number: s,
        location_id: formData.location_id || null,
        status: formData.status === 'In Maintenance' ? 'Under Maintenance' : formData.status,
        condition_status: formData.condition_status,
        purchase_cost: formData.purchase_cost || null,
        acquisition_date: formData.acquisition_date || null,
        notes: formData.notes || ''
      }));

      // call bulk save if provided, otherwise fallback to per-item saves
      if (typeof onBulkSave === 'function') {
        try {
          // auto-close modal immediately after starting bulk add
          onClose();
          onBulkSave(items);
        } catch (err) {
          setValidationErrors([`Bulk save failed: ${err.message || err}`]);
        }
      } else {
        for (const payload of items) {
          try { onSave(payload); } catch (err) { /* continue on error */ }
        }
        onClose();
      }

      return;
    }

    // Single add
    onSave(formData);
  };

  // filter instruments by selected category
  const filteredInstruments = React.useMemo(() => {
    if (!formData.category) return instruments || [];
    return (instruments || []).filter(i => (i.category || 'Uncategorized') === formData.category);
  }, [instruments, formData.category]);

  // bulk UI helpers
  const [validationErrors, setValidationErrors] = useState([]);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const serialRefs = React.useRef([]);

  // compact, professional form layout (single-column on narrow, two columns on wide)
  const localFormGrid = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px'
  };

  const twoColRow = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' };

  const labelSmall = { ...styles.label, fontSize: '12px', color: '#475569' };

  // local visual tweaks for a compact, modern modal
  const modalLocal = {
    modal: {
      backgroundColor: '#ffffff',
      borderRadius: '10px',
      width: '92%',
      maxWidth: '560px',
      boxShadow: '0 12px 28px rgba(12, 20, 40, 0.08)'
    },
    modalHeader: {
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'linear-gradient(90deg, rgba(102,126,234,0.08), rgba(118,75,162,0.04))',
      borderTopLeftRadius: '10px',
      borderTopRightRadius: '10px'
    },
    modalTitle: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#0f172a',
      margin: 0
    },
    headerIconWrap: {
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      background: 'linear-gradient(135deg,#667eea,#764ba2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      flexShrink: 0
    },
    modalBody: {
      padding: '10px 12px'
    },
    input: {
      ...styles.input,
      padding: '6px 8px',
      borderRadius: '8px',
      border: '1px solid #e6eefc'
    },
    select: {
      ...styles.select,
      padding: '6px 8px',
      borderRadius: '8px',
      border: '1px solid #e6eefc'
    },
    textarea: {
      ...styles.textarea,
      padding: '8px 10px',
      borderRadius: '8px',
      border: '1px solid #e6eefc'
    },
    modalFooter: {
      padding: '10px 12px',
      borderTop: '1px solid #f1f5f9',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      backgroundColor: '#ffffff',
      borderBottomLeftRadius: '10px',
      borderBottomRightRadius: '10px'
    },
    primaryButton: {
      background: 'linear-gradient(90deg,#6d28d9,#4f46e5)',
      color: '#fff',
      boxShadow: '0 6px 18px rgba(77, 46, 185, 0.12)'
    }
  };

  const inputStyle = modalLocal.input;
  const selectStyle = modalLocal.select;
  const textareaStyle = modalLocal.textarea;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, ...modalLocal.modal }} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...styles.modalHeader, ...modalLocal.modalHeader }}>
          <div style={modalLocal.headerIconWrap}><FaBox style={{ fontSize: '20px' }} /></div>
          <h2 style={{ ...styles.modalTitle, ...modalLocal.modalTitle }}>{item ? 'Edit Inventory Item' : 'Add Inventory Item'}</h2>
          <div style={{ flex: 1 }} />
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ ...styles.modalBody, ...modalLocal.modalBody }}>
            <div style={localFormGrid}>
              {/* Category -> Instrument flow */}
              <div>
                <div style={labelSmall}>Category</div>
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  <select
                    aria-label="Category"
                    style={selectStyle}
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, instrument_id: '' })}
                  >
                    {categories.length === 0 && <option value="">No categories</option>}
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <FaChevronDown style={styles.selectIcon} />
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Choose a category to narrow instrument choices</div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <div style={labelSmall}>Instrument</div>
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  {formData.instrument_id === 'others' ? (
                    <input
                      aria-label="Instrument (custom)"
                      style={{ ...inputStyle, width: '100%' }}
                      type="text"
                      value={formData.custom_instrument_name}
                      onChange={(e) => setFormData({ ...formData, custom_instrument_name: e.target.value })}
                      placeholder="Type instrument name..."
                      required
                    />
                  ) : (
                    <>
                      <select
                        aria-label="Instrument"
                        style={selectStyle}
                        value={formData.instrument_id}
                        onChange={(e) => setFormData({ ...formData, instrument_id: e.target.value })}
                        required
                      >
                        <option value="">Select Instrument</option>
                        {filteredInstruments.map(inst => (
                          <option key={inst.instrument_id} value={inst.instrument_id}>{inst.name}</option>
                        ))}
                        <option value="others">Others (type custom name)</option>
                      </select>
                      <FaChevronDown style={styles.selectIcon} />
                    </>
                  )}
                </div>
                {formData.instrument_id === 'others' && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={labelSmall}>Brand</div>
                    <input
                      aria-label="Brand"
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Optional brand (e.g., Yamaha)"
                      style={{ ...inputStyle, marginTop: '6px', width: '100%' }}
                    />
                  </div>
                )}
              </div>

              <div style={twoColRow}>
                <div>
                  <div style={labelSmall}>Serial Number</div>
                  <input
                    style={{ ...inputStyle, marginTop: '6px' }}
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <div style={labelSmall}>Location</div>
                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <select
                      aria-label="Location"
                      style={selectStyle}
                      value={formData.location_id}
                      onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    >
                      <option value="">Select location</option>
                      {locations.map(loc => (
                        <option key={loc.location_id} value={String(loc.location_id)}>{loc.location_name}</option>
                      ))}
                    </select>
                    <FaChevronDown style={styles.selectIcon} />
                  </div>
                </div>
              </div>

              {/* Add-more bulk UI: user can add inline serial rows - only when creating a new item */}
              {!item && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-link" style={{ padding: 0, color: '#4f46e5', fontWeight: 700 }} onClick={() => {
                    // enable bulk mode and initialize serials with current base serial
                    setFormData(prev => ({ ...prev, bulkMode: true, serials: (prev.serials && prev.serials.length) ? prev.serials : [prev.serial_number || ''] }));
                  }}>+ Add more</button>
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>Add multiple items using inline serial rows (same acquisition date).</div>
                </div>
              )}

              {formData.bulkMode && (
                <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                  {validationErrors.length > 0 && (
                    <div style={{ background: '#fff7ed', border: '1px solid #fcd34d', padding: '8px 12px', borderRadius: '8px', color: '#92400e' }}>
                      <strong style={{ display: 'block', marginBottom: '6px' }}>Validation errors</strong>
                      <ul style={{ margin: 0, paddingLeft: '18px' }}>{validationErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                    </div>
                  )}

                  {(formData.serials || []).map((s, idx) => (
                    <div key={`serial-row-${idx}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input ref={el => serialRefs.current[idx] = el} type="text" placeholder={`Serial #${idx + 1}`} value={s} onChange={(e) => {
                        const copy = Array.isArray(formData.serials) ? [...formData.serials] : [];
                        copy[idx] = e.target.value;
                        setFormData(prev => ({ ...prev, serials: copy }));
                      }} style={{ ...inputStyle, flex: 1 }} />
                      <button type="button" className="btn btn-link" style={{ color: '#ef4444' }} onClick={() => {
                        const copy = Array.isArray(formData.serials) ? [...formData.serials] : [];
                        copy.splice(idx, 1);
                        setFormData(prev => ({ ...prev, serials: copy }));
                        // shift refs
                        serialRefs.current.splice(idx, 1);
                      }}>Remove</button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-outline" style={{ padding: '6px 10px' }} onClick={() => {
                      setFormData(prev => ({ ...prev, serials: [ ...(prev.serials || []), '' ] }));
                      // focus on the newly added row shortly after state updates
                      setTimeout(() => {
                        const idx = (formData.serials || []).length;
                        const el = serialRefs.current[idx];
                        if (el) el.focus();
                      }, 50);
                    }}>Add another</button>

                    <button type="button" className="btn btn-outline" style={{ padding: '6px 10px' }} onClick={() => setShowPasteArea(!showPasteArea)}>Paste</button>

                    <button type="button" className="btn btn-link" style={{ padding: '6px 10px', color: '#64748b' }} onClick={() => setFormData(prev => ({ ...prev, bulkMode: false }))}>Done</button>
                  </div>

                  {showPasteArea && (
                    <div>
                      <textarea placeholder="Paste serials, one per line" value={pasteText} onChange={(e) => setPasteText(e.target.value)} style={{ ...textareaStyle, marginTop: '6px', minHeight: '80px', width: '100%' }} />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button type="button" className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={() => {
                          const lines = (pasteText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                          if (lines.length === 0) return;
                          setFormData(prev => ({ ...prev, serials: [ ...(prev.serials || []), ...lines ] }));
                          setPasteText('');
                          setShowPasteArea(false);
                        }}>Import</button>
                        <button type="button" className="btn btn-link" style={{ padding: '6px 10px' }} onClick={() => { setPasteText(''); setShowPasteArea(false); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={twoColRow}>
                <div>
                  <div style={labelSmall}>Status</div>
                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <select
                      style={selectStyle}
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Available">Available</option>
                      <option value="Rented">Rented</option>
                      <option value="Borrowed">Borrowed</option>
                      <option value="Under Maintenance">In Maintenance</option>
                    </select>
                    <FaChevronDown style={styles.selectIcon} />
                  </div>
                </div>

                <div>
                  <div style={labelSmall}>Condition</div>
                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <select
                      style={selectStyle}
                      value={formData.condition_status}
                      onChange={(e) => setFormData({ ...formData, condition_status: e.target.value })}
                    >
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                    <FaChevronDown style={styles.selectIcon} />
                  </div>
                </div>
              </div>

              <div style={twoColRow}>
                <div>
                  <div style={labelSmall}>Acquisition Date</div>
                  <input
                    style={{ ...inputStyle, marginTop: '6px' }}
                    type="date"
                    value={formData.acquisition_date}
                    onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                <div>
                  <div style={labelSmall}>Purchase Cost (₱)</div>
                  <input
                    style={{ ...inputStyle, marginTop: '6px' }}
                    type="number"
                    step="0.01"
                    value={formData.purchase_cost}
                    onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <div style={labelSmall}>Notes</div>
                <textarea
                  style={{ ...textareaStyle, marginTop: '6px', minHeight: '120px', width: '100%', resize: 'vertical' }}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </div>

          <div style={{ ...styles.modalFooter, gap: '12px' }}>
            <button
              type="button"
              style={{ ...styles.btnSecondary, padding: '8px 12px', fontSize: '13px', borderRadius: '10px' }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ ...styles.btnPrimary, padding: '10px 16px', fontSize: '14px', borderRadius: '10px' }}
            >
              {item ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>

  );
};

// Details view removed per request

// Read-only View Modal to show all fields including price
const ViewModal = ({ item, onClose, styles }) => {
  if (!item) return null;

  const formatCurrency = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(v));
  };

  const getStatusStyleLocal = (status) => {
    const baseStyle = { ...styles.badge };
    if (status === 'Available') return { ...baseStyle, ...styles.statusAvailable };
    if (status === 'Rented') return { ...baseStyle, ...styles.statusRented };
    if (status === 'Under Maintenance' || status === 'In Maintenance') return { ...baseStyle, ...styles.statusMaintenance };
    return baseStyle;
  };

  const getConditionStyleLocal = (condition) => {
    const baseStyle = { ...styles.badge };
    if (condition === 'Excellent') return { ...baseStyle, ...styles.conditionExcellent };
    if (condition === 'Good') return { ...baseStyle, ...styles.conditionGood };
    if (condition === 'Fair') return { ...baseStyle, ...styles.conditionFair };
    if (condition === 'Poor') return { ...baseStyle, ...styles.conditionPoor };
    return baseStyle;
  };

  const row = (label, value) => (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', padding: '10px 0', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ color: '#475569', fontSize: '12px', background: 'rgba(99,102,241,0.06)', padding: '6px 8px', borderRadius: '6px', display: 'inline-block' }}>{label}</div>
      <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>{value}</div>
    </div>
  );

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, width: '420px', maxWidth: '92%', padding: '10px', borderRadius: '8px', boxShadow: '0 10px 30px rgba(2,6,23,0.06)', border: '1px solid rgba(15,23,42,0.06)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '8px 8px', borderRadius: '6px', background: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaBox size={16} color="#6d28d9" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Item Details</span>
            </div>
            <button style={{ ...styles.closeButton, width: '34px', height: '34px', fontSize: '20px' }} onClick={onClose}>×</button>
          </div>

          <div style={{ background: '#fff', borderRadius: '6px', padding: '6px 8px', borderLeft: '3px solid rgba(99,102,241,0.06)' }}>
          {row('Serial', item.serial_number || '—')}
          {row('Instrument', item.instrument_name || '—')}
          {row('Location', item.location_name || '—')}
          {row('Acquired', item.acquisition_date ? (new Date(item.acquisition_date)).toLocaleDateString() : '—')}
          {row('Status', item.status || '—')}
          {row('Condition', item.condition_status || '—')}
          {row('Purchase', formatCurrency(item.purchase_cost))}

          <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', background: 'rgba(99,102,241,0.02)', borderRadius: '6px' }}>
            <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>Notes</div>
            <div style={{ fontSize: '14px', color: '#0f172a', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.notes || '—'}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
            <button style={styles.btnSecondary} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstrumentItemsManager;