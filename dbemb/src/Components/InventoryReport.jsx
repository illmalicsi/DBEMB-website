import React, { useEffect, useState } from 'react';
import { FaDownload, FaDrum, FaMusic, FaChartBar, FaBoxes, FaMapMarkerAlt, FaExclamationTriangle, FaCheckCircle, FaFilter, FaPrint, FaGuitar } from '../icons/fa';
import AuthService from '../services/authService';
import StyledSelect from './StyledSelect';

const InventoryReport = () => {
  const [instruments, setInstruments] = useState([]);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchData();

    // Refresh report when inventory or request updates occur elsewhere in the app
    const handler = () => {
      try { fetchData(); } catch (e) { console.warn('Failed to refresh inventory report on event', e); }
    };
    const events = ['instrumentsUpdated', 'rentRequestsUpdated', 'borrowRequestsUpdated', 'notificationsUpdated', 'instrumentItemsUpdated'];
    events.forEach(ev => window.addEventListener(ev, handler));
    return () => events.forEach(ev => window.removeEventListener(ev, handler));
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [instrumentsRes, itemsRes, locationsRes] = await Promise.all([
        AuthService.get('/instruments'),
        AuthService.get('/instrument-items'),
        AuthService.get('/locations')
      ]);
      
      setInstruments(instrumentsRes.instruments || []);
      setItems(itemsRes.items || []);
      setLocations(locationsRes.locations || []);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = {
    totalInstrumentTypes: instruments.length,
    totalItems: items.length,
    availableItems: items.filter(i => i.status === 'Available').length,
    rentedItems: items.filter(i => i.status === 'Rented').length,
    borrowedItems: items.filter(i => i.status === 'Borrowed').length,
    maintenanceItems: items.filter(i => i.status === 'Under Maintenance' || i.status === 'In Maintenance').length,
    excellentCondition: items.filter(i => i.condition_status === 'Excellent').length,
    goodCondition: items.filter(i => i.condition_status === 'Good').length,
    fairCondition: items.filter(i => i.condition_status === 'Fair').length,
    poorCondition: items.filter(i => i.condition_status === 'Poor').length,
    totalValue: items.reduce((sum, item) => sum + (parseFloat(item.purchase_cost) || 0), 0)
  };

  // Group items by category
  const categories = instruments.reduce((acc, inst) => {
    const category = inst.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    const itemsForInst = items.filter(item => item.instrument_id === inst.instrument_id);
    acc[category].push({
      ...inst,
      itemCount: itemsForInst.length,
      available: itemsForInst.filter(i => i.status === 'Available').length,
      rented: itemsForInst.filter(i => i.status === 'Rented').length,
      borrowed: itemsForInst.filter(i => i.status === 'Borrowed').length,
      maintenance: itemsForInst.filter(i => i.status === 'Under Maintenance' || i.status === 'In Maintenance').length,
      items: itemsForInst
    });
    return acc;
  }, {});

  // Mirror the InstrumentItemsManager grouping: map instrument category/subcategory into
  // four tabs: Snare Drums, Bass Drums, Percussion, Woodwind & Brass (fallback Other).
  const [activeTab, setActiveTab] = useState('Snare Drums');

  const groupedInstruments = instruments.reduce((acc, inst) => {
    const itemsForInst = items.filter(item => item.instrument_id === inst.instrument_id);
    const rawCat = (inst && (inst.category || '')) || '';
    const rawSub = (inst && (inst.subcategory || '')) || '';
    const catLower = (rawCat || '').toString().toLowerCase();
    const subLower = (rawSub || '').toString().toLowerCase();

    let key = 'Other';
    if (subLower.includes('snare')) key = 'Snare Drums';
    else if (subLower.includes('bass')) key = 'Bass Drums';
    else if (catLower.includes('percussion')) key = 'Percussion';
    else if (catLower.includes('wood') || catLower.includes('woodwind') || catLower.includes('brass')) key = 'Woodwind & Brass';

    if (!acc[key]) acc[key] = [];
    acc[key].push({
      ...inst,
      itemCount: itemsForInst.length,
      available: itemsForInst.filter(i => i.status === 'Available').length,
      rented: itemsForInst.filter(i => i.status === 'Rented').length,
      borrowed: itemsForInst.filter(i => i.status === 'Borrowed').length,
      maintenance: itemsForInst.filter(i => i.status === 'Under Maintenance' || i.status === 'In Maintenance').length,
      items: itemsForInst
    });
    return acc;
  }, {});

  const preferred = ['Snare Drums', 'Bass Drums', 'Percussion', 'Woodwind & Brass'];
  const otherKeys = Object.keys(groupedInstruments).filter(k => !preferred.includes(k)).sort();
  const categoryKeys = [...preferred, ...otherKeys];

  // Group items by location
  const itemsByLocation = locations.map(loc => ({
    ...loc,
    items: items.filter(item => item.location_id === loc.location_id),
    count: items.filter(item => item.location_id === loc.location_id).length
  }));

  // Show specific locations in the Equipment by Location section (fallback to all locations)
  const visibleLocationNames = ['Shrine Hills, Matina Crossing', 'Sunrise Village, Matina Aplaya'];
  let displayedLocations = itemsByLocation.filter(l => visibleLocationNames.includes(l.location_name));
  // Preserve order: Shrine Hills first, then Sunrise Village
  displayedLocations = visibleLocationNames.map(name => displayedLocations.find(l => l.location_name === name)).filter(Boolean);
  if (displayedLocations.length === 0) {
    displayedLocations = itemsByLocation;
  }

  // Apply filters
  const getFilteredItems = () => {
    return items.filter(item => {
      const matchCategory = !filterCategory || instruments.find(i => i.instrument_id === item.instrument_id)?.category === filterCategory;
      const matchCondition = !filterCondition || item.condition_status === filterCondition;
      const matchStatus = !filterStatus || item.status === filterStatus;
      return matchCategory && matchCondition && matchStatus;
    });
  };

  const filteredItems = getFilteredItems();

  const exportCSV = () => {
    const rows = [['Serial Number', 'Instrument', 'Category', 'Brand', 'Location', 'Status', 'Condition', 'Purchase Cost', 'Acquisition Date']];
    filteredItems.forEach(item => {
      const instrument = instruments.find(i => i.instrument_id === item.instrument_id);
      const location = locations.find(l => l.location_id === item.location_id);
      rows.push([
        item.serial_number,
        instrument?.name || 'N/A',
        instrument?.category || 'N/A',
        instrument?.brand || 'N/A',
        location?.location_name || 'N/A',
        item.status,
        item.condition_status,
        item.purchase_cost || '0',
        item.acquisition_date ? new Date(item.acquisition_date).toLocaleDateString() : 'N/A'
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marching-band-inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '16px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      fontSize: '0.92rem'
    },
    header: {
      marginBottom: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    title: {
      fontSize: '1.3rem',
      fontWeight: '900',
      color: '#0f172a',
      margin: '0 0 8px 0',
      letterSpacing: '-0.5px'
    },
    subtitle: {
      fontSize: '1rem',
      color: '#475569',
      fontWeight: '500',
      marginBottom: '16px'
    },
    actionBar: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'flex-end',
      alignItems: 'center'
    },
    btn: {
      background: '#2563eb',
      color: '#ffffff',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '0.95rem',
      fontWeight: '700',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s'
    },
    btnSecondary: {
      background: '#ffffff',
      color: '#0f172a',
      border: '1px solid #e2e8f0'
    },
    statsGrid: {
      display: 'none'
    },
    statCard: {
      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.2)',
      padding: '10px',
      borderRadius: '10px',
      color: '#ffffff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.13)',
      position: 'relative',
      overflow: 'hidden'
    },
    statIcon: {
      fontSize: '1.2rem',
      marginBottom: '6px',
      opacity: '0.9'
    },
    statValue: {
      fontSize: '1.2rem',
      fontWeight: '800',
      marginBottom: '4px',
      letterSpacing: '-0.5px'
    },
    statLabel: {
      fontSize: '0.8rem',
      fontWeight: '600',
      opacity: '0.8',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    filterCard: {
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(10px)',
      padding: '12px',
      borderRadius: '10px',
      marginBottom: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    filterGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '10px'
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },
    filterLabel: {
      fontSize: '0.85rem',
      fontWeight: '700',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    select: {
      padding: '6px 10px',
      borderRadius: '7px',
      border: '2px solid #e2e8f0',
      fontSize: '0.95rem',
      fontFamily: 'inherit',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s',
      minWidth: '120px',
      width: '100%',
      boxSizing: 'border-box',
      maxWidth: '220px',
    },
    sectionCard: {
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '10px',
      padding: '12px',
      marginBottom: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    sectionTitle: {
      fontSize: '1.1rem',
      fontWeight: '800',
      color: '#0f172a',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    categorySection: {
      marginBottom: '14px',
      paddingBottom: '14px',
      borderBottom: '1px solid #e2e8f0'
    },
    categoryHeader: {
      fontSize: '1rem',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '7px',
      background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      borderRadius: '7px'
    },
    instrumentRow: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
      gap: '6px',
      padding: '7px',
      borderBottom: '1px solid #f1f5f9',
      alignItems: 'center',
      fontSize: '0.92rem'
    },
    instrumentName: {
      fontSize: '0.95rem',
      fontWeight: '600',
      color: '#0f172a'
    },
    instrumentBrand: {
      fontSize: '0.8rem',
      color: '#64748b',
      marginTop: '2px'
    },
    countBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 7px',
      borderRadius: '5px',
      fontSize: '0.85rem',
      fontWeight: '700'
    },
    available: {
      backgroundColor: '#d1fae5',
      color: '#065f46'
    },
    rented: {
      backgroundColor: '#fed7aa',
      color: '#92400e'
    },
    borrowed: {
      backgroundColor: '#fce7f3',
      color: '#9f1239'
    },
    maintenance: {
      backgroundColor: '#fecaca',
      color: '#991b1b'
    },
    locationGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '10px'
    },
    locationCard: {
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      padding: '10px',
      borderRadius: '7px',
      border: '1px solid #e2e8f0'
    },
    locationName: {
      fontSize: '1rem',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    },
    locationCount: {
      fontSize: '1.2rem',
      fontWeight: '800',
      color: '#667eea',
      marginBottom: '4px'
    },
    locationLabel: {
      fontSize: '0.7rem',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '20px 8px',
      color: '#64748b'
    },
    emptyIcon: {
      fontSize: '2rem',
      marginBottom: '6px',
      opacity: '0.3'
    },
    emptyText: {
      fontSize: '1rem',
      fontWeight: '600'
    }
  };

  if (loading) {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#0f172a' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎺</div>
          <div style={{ fontSize: '20px', fontWeight: '600' }}>Loading Inventory Report...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div />
        <div style={styles.actionBar}>
          <button style={styles.btn} onClick={exportCSV}>
            <FaDownload /> Export CSV
          </button>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={printReport}>
            <FaPrint /> Print
          </button>
        </div>
      </div>

      

      {/* Filters */}
      <div style={styles.filterCard}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaFilter /> Filter Inventory
        </div>
        <div style={styles.filterGrid}>
          <div style={{ ...styles.filterGroup, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
            <label style={styles.filterLabel}>Category</label>
            <div style={{ marginTop: 6 }}>
              <StyledSelect style={styles.select} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {Object.keys(categories).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </StyledSelect>
            </div>
          </div>
          <div style={{ ...styles.filterGroup, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
            <label style={styles.filterLabel}>Status</label>
            <div style={{ marginTop: 6 }}>
              <StyledSelect style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="Available">Available</option>
                <option value="Rented">Rented</option>
                <option value="Borrowed">Borrowed</option>
                <option value="Under Maintenance">In Maintenance</option>
              </StyledSelect>
            </div>
          </div>
          <div style={{ ...styles.filterGroup, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
            <label style={styles.filterLabel}>Condition</label>
            <div style={{ marginTop: 6 }}>
              <StyledSelect style={styles.select} value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
                <option value="">All Conditions</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </StyledSelect>
            </div>
          </div>
        </div>
        {(filterCategory || filterStatus || filterCondition) && (
          <div style={{ marginTop: '16px', padding: '12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '14px', color: '#475569' }}>
            Showing {filteredItems.length} of {items.length} items
          </div>
        )}
      </div>

      {/* Equipment by Category */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionTitle}>
          <FaChartBar /> Equipment by Category
        </div>
        {Object.keys(groupedInstruments).length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🎺</div>
            <div style={styles.emptyText}>No instruments found</div>
          </div>
        ) : (
          <div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {categoryKeys.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? '#ffffff' : 'transparent',
                    border: activeTab === tab ? '1px solid #e2e8f0' : '1px solid transparent',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    color: '#334155'
                  }}
                >
                  {tab}
                  <span style={{ background: '#eef2ff', color: '#334155', padding: '4px 8px', borderRadius: 999, marginLeft: 8, fontSize: 12, fontWeight: 700 }}>
                    {(groupedInstruments[tab] || []).reduce((s, inst) => s + (inst.itemCount || 0), 0)}
                  </span>
                </button>
              ))}
            </div>

            {/* Active tab content */}
            {(!groupedInstruments[activeTab] || groupedInstruments[activeTab].length === 0) ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📦</div>
                <div style={styles.emptyText}>No items in {activeTab}</div>
              </div>
            ) : (
              <div style={styles.categorySection}>
                <div style={styles.categoryHeader}>
                  <FaMusic /> {activeTab} ({groupedInstruments[activeTab].reduce((sum, i) => sum + i.itemCount, 0)} items)
                </div>
                <div>
                  <div style={{ ...styles.instrumentRow, fontWeight: '700', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>
                    <div>Instrument</div>
                    <div style={{ textAlign: 'center' }}>Total</div>
                    <div style={{ textAlign: 'center' }}>Available</div>
                    <div style={{ textAlign: 'center' }}>Rented</div>
                    <div style={{ textAlign: 'center' }}>Borrowed</div>
                    <div style={{ textAlign: 'center' }}>Maintenance</div>
                  </div>
                  {groupedInstruments[activeTab].map(inst => (
                    <div key={inst.instrument_id} style={styles.instrumentRow}>
                      <div>
                        <div style={styles.instrumentName}>{inst.name}</div>
                        <div style={styles.instrumentBrand}>{inst.brand || 'N/A'}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ ...styles.countBadge, backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                          {inst.itemCount}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ ...styles.countBadge, ...styles.available }}>
                          {inst.available}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ ...styles.countBadge, ...styles.rented }}>
                          {inst.rented}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ ...styles.countBadge, ...styles.borrowed }}>
                          {inst.borrowed}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ ...styles.countBadge, ...styles.maintenance }}>
                          {inst.maintenance}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Equipment by Location */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionTitle}>
          <FaMapMarkerAlt /> Equipment by Location
        </div>
        {itemsByLocation.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📍</div>
            <div style={styles.emptyText}>No locations configured</div>
          </div>
        ) : (
          <div style={styles.locationGrid}>
            {displayedLocations.map(loc => (
              <div key={loc.location_id} style={styles.locationCard}>
                <div style={styles.locationName}>
                  <FaMapMarkerAlt /> {loc.location_name}
                </div>
                <div style={styles.locationCount}>{loc.count}</div>
                <div style={styles.locationLabel}>Items at this location</div>
                {loc.address && (
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
                    {loc.address}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Condition Overview */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionTitle}>
          <FaCheckCircle /> Equipment Condition Overview
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderRadius: '16px', border: '2px solid #6ee7b7' }}>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#065f46', marginBottom: '8px' }}>{stats.excellentCondition}</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#047857', textTransform: 'uppercase' }}>Excellent</div>
          </div>
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', borderRadius: '16px', border: '2px solid #60a5fa' }}>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#1e40af', marginBottom: '8px' }}>{stats.goodCondition}</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase' }}>Good</div>
          </div>
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)', borderRadius: '16px', border: '2px solid #fb923c' }}>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#92400e', marginBottom: '8px' }}>{stats.fairCondition}</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#9a3412', textTransform: 'uppercase' }}>Fair</div>
          </div>
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)', borderRadius: '16px', border: '2px solid #f87171' }}>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#991b1b', marginBottom: '8px' }}>{stats.poorCondition}</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase' }}>Poor</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryReport;