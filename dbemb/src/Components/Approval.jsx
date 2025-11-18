import React, { useEffect, useState } from 'react';
import { FaCheck, FaTimes, FaArrowLeft, FaMusic, FaUserFriends, FaUser, FaFileAlt, FaInfoCircle } from '../icons/fa';
import NotificationService from '../services/notificationService';
import AuthService from '../services/authService';

const Approval = ({ onBackToHome }) => {
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [rentRequests, setRentRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('borrow'); 
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [viewDetailsRequest, setViewDetailsRequest] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [instrumentPriceMap, setInstrumentPriceMap] = useState({});

  const fetchInstrumentRequests = () => {
    const load = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          // Prefer server-side requests when authenticated (admin view)
          try {
            const borrowResp = await AuthService.get('/instruments/borrow-requests');
            const rentResp = await AuthService.get('/instruments/rent-requests');
            console.log('Approval: fetched borrow-requests response:', borrowResp);
            console.log('Approval: fetched rent-requests response:', rentResp);
            const borrow = (borrowResp && borrowResp.requests) ? borrowResp.requests : (Array.isArray(borrowResp) ? borrowResp : []);
            const rent = (rentResp && rentResp.requests) ? rentResp.requests : (Array.isArray(rentResp) ? rentResp : []);

            // Normalize shapes a bit for the UI
            const normalize = (arr, type) => (Array.isArray(arr) ? arr.map(r => ({ ...r, type })) : []);
            setBorrowRequests(normalize(borrow, 'borrow'));
            setRentRequests(normalize(rent, 'rent'));
            setLoading(false);
            return;
          } catch (err) {
            console.warn('Approval: failed to load server-side requests, falling back to localStorage', err);
            // fall through to localStorage fallback
          }
        }

        // Fallback: load from localStorage (for unauthenticated or server-fallback)
        try {
          const borrow = JSON.parse(localStorage.getItem('borrowRequests') || '[]');
          const rent = JSON.parse(localStorage.getItem('rentRequests') || '[]');
          setBorrowRequests(Array.isArray(borrow) ? borrow : []);
          setRentRequests(Array.isArray(rent) ? rent : []);
        } catch (err) {
          console.error('Error loading instrument requests from localStorage:', err);
          setBorrowRequests([]);
          setRentRequests([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  };

  const calcRentalDays = (start, end) => {
    try {
      if (!start || !end) return 0;
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
      // inclusive days
      const diffTime = Math.abs(e.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 0;
    } catch (e) {
      return 0;
    }
  };

  const fetchLocations = async () => {
    try {
      console.log('Fetching locations...');
      const response = await AuthService.get('/locations');
      console.log('Locations response:', response);
      if (response && response.success && Array.isArray(response.locations)) {
        console.log('Setting locations:', response.locations);
        setLocations(response.locations);
        // Set default to first location if available
        if (response.locations.length > 0 && !selectedLocation) {
          setSelectedLocation(response.locations[0].location_id);
        }
      } else {
        console.log('Invalid response format:', response);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  useEffect(() => {
    fetchInstrumentRequests();
    fetchLocations();

    // Listen for new requests
    const handleBorrowUpdate = () => fetchInstrumentRequests();
    const handleRentUpdate = () => fetchInstrumentRequests();

    window.addEventListener('borrowRequestsUpdated', handleBorrowUpdate);
    window.addEventListener('rentRequestsUpdated', handleRentUpdate);
  // Also listen for notification updates to refresh UI if needed
  const notifHandler = () => fetchInstrumentRequests();
  window.addEventListener('notificationsUpdated', notifHandler);
  
  // Listen for navigation events from notifications so admin clicks can open details
  const navigateHandler = async (ev) => {
    try {
      const detail = (ev && ev.detail) ? ev.detail : {};
      if (!detail || detail.type !== 'request') return;
      const targetId = detail.id || detail.requestId || detail.request_id;
      if (!targetId) return;

      // Helper to compare possible id fields
      const matchesId = (r) => {
        if (!r) return false;
        const cand = String(r.request_id || r.requestId || r.id || '');
        return cand === String(targetId);
      };

      // Try to find in current state lists first
      let found = borrowRequests.find(matchesId);
      if (found) {
        setActiveTab('borrow');
        openRequestDetails(found, 'borrow');
        return;
      }
      found = rentRequests.find(matchesId);
      if (found) {
        setActiveTab('rent');
        openRequestDetails(found, 'rent');
        return;
      }

      // If not found locally, fetch from server directly and try to match
      try {
        const borrowResp = await AuthService.get('/instruments/borrow-requests');
        const rentResp = await AuthService.get('/instruments/rent-requests');
        const borrowList = (borrowResp && borrowResp.requests) ? borrowResp.requests : (Array.isArray(borrowResp) ? borrowResp : []);
        const rentList = (rentResp && rentResp.requests) ? rentResp.requests : (Array.isArray(rentResp) ? rentResp : []);

        const foundBorrow = borrowList.find(matchesId);
            if (foundBorrow) {
          setBorrowRequests(Array.isArray(borrowList) ? borrowList : []);
          setActiveTab('borrow');
          openRequestDetails(foundBorrow, 'borrow');
          return;
        }

        const foundRent = rentList.find(matchesId);
        if (foundRent) {
          setRentRequests(Array.isArray(rentList) ? rentList : []);
          setActiveTab('rent');
          openRequestDetails(foundRent, 'rent');
          return;
        }
      } catch (e) {
        console.warn('navigateHandler: failed to fetch server lists', e);
      }
    } catch (err) {
      console.error('navigateHandler error', err);
    }
  };
  window.addEventListener('navigateTo', navigateHandler);
    
    return () => {
      window.removeEventListener('borrowRequestsUpdated', handleBorrowUpdate);
      window.removeEventListener('rentRequestsUpdated', handleRentUpdate);
      window.removeEventListener('notificationsUpdated', notifHandler);
      window.removeEventListener('navigateTo', navigateHandler);
    };
  }, []);

  // Load instrument prices to enrich approval list
  useEffect(() => {
    let mounted = true;
    const loadPrices = async () => {
      try {
        const res = await AuthService.makeAuthenticatedRequest((process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000') + '/api/instruments');
        const data = await res.json();
        const list = Array.isArray(data.instruments) ? data.instruments : (Array.isArray(data) ? data : []);
        const map = {};
        for (const i of list) {
          const id = i.instrument_id || i.id;
          if (id) map[id] = i.price_per_day ?? i.pricePerDay ?? null;
        }
        if (mounted) setInstrumentPriceMap(map);
      } catch (e) {
        console.warn('Approval: failed to load instrument prices', e && e.message);
      }
    };
    loadPrices();
    return () => { mounted = false; };
  }, []);

  // NOTE: Removed automatic/manual local->server sync logic for rent requests.
  // The component will prefer server-side data when authenticated and fall back
  // to localStorage for offline/unauthenticated usage, but will not attempt to
  // automatically create server rows from local placeholders.

  const handleInstrumentRequestAction = async (requestOrId, action, type) => {
    // requestOrId may be either a scalar id (number|string) or the full request object
    let requestId = requestOrId;
    let requestObj = null;
    if (requestOrId && typeof requestOrId === 'object') {
      requestObj = requestOrId;
      requestId = requestOrId.request_id || requestOrId.requestId || requestOrId.id;
    }

    setProcessingId(requestId || (requestObj && (requestObj.request_id || requestObj.requestId || requestObj.id)) || null);
    try {
      const endpointBase = type === 'borrow' ? '/instruments/borrow-request' : '/instruments/rent-requests';
      // backend routes use verbs 'approve' / 'reject' (no trailing 'd')
      const actionPath = action === 'approved' ? 'approve' : (action === 'rejected' ? 'reject' : action);

  // If this is a rent request and the id looks like a local timestamp fallback (Date.now()),
  // attempt to create the server rent-requests first and replace local id with server requestId.
  let effectiveId = requestId;
      try {
  const storageKey = 'rentRequests';
  const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
  // If we were passed a request object, prefer that as the local source of truth
  const localReq = requestObj || local.find(r => (typeof effectiveId !== 'undefined' && effectiveId !== null) && String(r.id) === String(effectiveId));
        // prefer existing server-side request_id if present
        if (localReq && (localReq.request_id || localReq.requestId)) {
          effectiveId = localReq.request_id || localReq.requestId;
        }
        const looksLikeTimestamp = (typeof effectiveId === 'number' && effectiveId > 1000000000000) || (typeof effectiveId === 'string' && effectiveId.length > 12) || (!effectiveId && localReq && (localReq.localOnly === true || (typeof localReq.id === 'string' && localReq.id.startsWith('local-'))));
        if (type === 'rent' && looksLikeTimestamp) {
          if (localReq) {
            // Build payload for server from local request fields
            const payload = {
              instrumentId: localReq.instrumentId || null,
              instrumentName: localReq.instrumentName || localReq.instrument || '',
              instrumentType: localReq.instrumentType || localReq.instrument_type || '',
              quantity: Number(localReq.quantity) || 1,
              startDate: localReq.startDate || localReq.start_date || null,
              endDate: localReq.endDate || localReq.end_date || null,
              purpose: localReq.purpose || localReq.notes || null,
              notes: localReq.notes || null,
              rentalFee: localReq.rentalFee || localReq.rental_fee || localReq.instrumentPricePerDay || null
            };
            try {
              const createResp = await AuthService.post('/instruments/rent-requests', payload);
              if (createResp && createResp.success === true && createResp.requestId) {
                  const realId = createResp.requestId;
                  // update localStorage mapping
                  const updatedLocal = local.map(r => (requestObj && r.id === requestObj.id) || (typeof effectiveId !== 'undefined' && String(r.id) === String(effectiveId)) ? { ...r, id: realId, request_id: realId, localOnly: false } : r);
                  localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
                  setRentRequests(Array.isArray(updatedLocal) ? updatedLocal : []);
                  effectiveId = realId;
                }
            } catch (e) {
              // create failed (possibly unauthenticated) — we'll continue and let later logic handle it
              console.warn('Failed to create server rent-requests for local item before action:', e);
            }
          }
        }
      } catch (e) {
        console.warn('Error while resolving local rent request to server id:', e);
      }

      // Ensure we have a usable server id before calling the backend.
      if (!effectiveId || (typeof effectiveId === 'string' && String(effectiveId).startsWith('local-'))) {
        console.error('No valid server id resolved for request:', requestId, 'resolved->', effectiveId);
        // Note: automatic/manual syncing of local placeholders has been removed.
        // Resolution will rely on earlier heuristics and server-side data only.

        if (!effectiveId || (typeof effectiveId === 'string' && String(effectiveId).startsWith('local-'))) {
          alert('Unable to resolve server request id for this item. Try syncing local requests first or refresh the list.');
          setProcessingId(null);
          return false;
        }
      }

  let serverApplied = false;
  const resp = await AuthService.put(`${endpointBase}/${effectiveId}/${actionPath}`, { locationId: selectedLocation });
  if (resp && resp.success === true) serverApplied = true;

      // If server didn't accept the id (e.g. rent request id from localStorage is a timestamp placeholder),
      // try to resolve the real rent request id by fetching the server's rent requests and matching by other fields.
      if (!resp || resp.success !== true) {
        const msg = (resp && resp.message) ? resp.message : 'Failed to update request';

        // Only attempt resolution for rent requests when server says not found
        if (type === 'rent' && msg && /not found/i.test(msg)) {
          try {
            const serverList = await AuthService.get('/instruments/rent-requests');
            if (serverList && serverList.success && Array.isArray(serverList.requests)) {
              const storageKey = 'rentRequests';
              const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
              const localReq = local.find(r => String(r.id) === String(requestId)) || {};

              // match heuristics: prefer matching userEmail + instrument name; fallback to instrument name alone
              const match = serverList.requests.find(s => {
                const sName = s.instrument_name || s.instrumentName || s.instrument || '';
                const lName = localReq.instrumentName || localReq.instrument || '';
                const sEmail = s.userEmail || s.email || s.user_email || '';
                const lEmail = localReq.userEmail || localReq.email || localReq.userEmail || '';
                const nameMatch = lName && sName && String(sName).trim() === String(lName).trim();
                const emailMatch = lEmail && sEmail && String(sEmail).trim() === String(lEmail).trim();
                return (nameMatch && emailMatch) || nameMatch || emailMatch;
              });

              if (match) {
                const realId = match.request_id || match.requestId || match.id;
                if (realId) {
                  // Retry the approve/reject call using the real id from the server
                  const retry = await AuthService.put(`${endpointBase}/${realId}/${actionPath}`);
                  if (retry && retry.success === true) {
                    serverApplied = true;
                    // Update localStorage mapping so future actions use the server id
                    const updatedLocal = local.map(r => r.id === requestId ? { ...r, id: realId } : r);
                    localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
                    setRentRequests(Array.isArray(updatedLocal) ? updatedLocal : []);

                    // Also update UI/state to reflect the action
                    const requests = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    const updatedRequests = requests.map(r => r.id === realId ? { ...r, status: action } : r);
                    localStorage.setItem(storageKey, JSON.stringify(updatedRequests));
                    setRentRequests(updatedRequests);

                    // Send notifications & events similar to original flow
                    const reqObj = updatedRequests.find(r => String(r.id) === String(realId));
                    if (action === 'approved' && reqObj) {
                      try {
                        // Only create a client-side notification if the server did not already create one
                          if (!serverApplied) {
                          NotificationService.createNotification(reqObj.userEmail, {
                            type: 'success',
                            title: 'Instrument Rental Approved',
                            message: `Your rental request for "${reqObj.instrumentName || reqObj.instrument || 'an instrument'}" has been approved!\n\nAmount Due: ₱${reqObj.amount || reqObj.estimated_value || reqObj.estimatedValue || reqObj.rentalFee || '0.00'}\n\nYour rental is now active.`,
                            data: {
                              requestId: realId,
                              invoiceId: reqObj.invoiceId || reqObj.invoice_id || null,
                              amount: reqObj.amount || reqObj.estimated_value || reqObj.estimatedValue || reqObj.rentalFee || null,
                              paid: false
                            }
                          });
                        }
                      } catch (e) {
                        console.error('Failed to create notification on approval', e);
                      }
                      window.dispatchEvent(new CustomEvent('instrumentRequestApproved', { detail: { userEmail: reqObj.userEmail, userId: reqObj.userId, type } }));
                    }

                    window.dispatchEvent(new Event(`${type}RequestsUpdated`));
                    // Also notify instrument list consumers that inventory may have changed
                    try { window.dispatchEvent(new Event('instrumentsUpdated')); } catch(e) {}
                    return true;
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to resolve rent request id from server:', e);
          }
        }

        // If resolution not attempted or failed, show the server message
        alert(msg);
        return;
      }

      // Update local UI/state (keep localStorage in sync for the embedded UI flows)
      const storageKey = type === 'borrow' ? 'borrowRequests' : 'rentRequests';
      if (!serverApplied) {
        const requests = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedRequests = requests.map(r => r.id === requestId ? { ...r, status: action } : r);
        localStorage.setItem(storageKey, JSON.stringify(updatedRequests));
        if (type === 'borrow') setBorrowRequests(updatedRequests); else setRentRequests(updatedRequests);
      } else {
        // Server already applied the change; refresh authoritative state instead of overwriting it.
        try { window.dispatchEvent(new Event(`${type}RequestsUpdated`)); } catch (e) { /* ignore */ }
      }

      // Determine the request object for notification purposes. It may come from:
      // 1) the passed requestObj (if the caller provided it),
      // 2) the current component state (server-backed list), or
      // 3) the updated localStorage list we just wrote.
      let reqObjForNotif = null;
      if (requestObj) reqObjForNotif = requestObj;
      else {
        const stateList = (type === 'borrow') ? borrowRequests : rentRequests;
        reqObjForNotif = stateList && stateList.find(r => String(r.request_id || r.requestId || r.id) === String(requestId));
      }
      if (!reqObjForNotif) {
        reqObjForNotif = updatedRequests.find(r => String(r.request_id || r.requestId || r.id) === String(requestId));
      }

      // On approval, send notification and emit realtime event
      if (action === 'approved' && reqObjForNotif) {
        try {
          const email = (reqObjForNotif.userEmail || reqObjForNotif.email || '').toLowerCase();
          if (type === 'rent') {
            if (!serverApplied) {
              NotificationService.createNotification(email, {
                type: 'success',
                title: 'Instrument Rental Approved',
                message: `Your rental request for "${reqObjForNotif.instrumentName || reqObjForNotif.instrument || 'an instrument'}" has been approved!\n\nAmount Due: ₱${reqObjForNotif.amount || reqObjForNotif.estimated_value || reqObjForNotif.estimatedValue || reqObjForNotif.rentalFee || '0.00'}\n\nYour rental is now active.`,
                data: {
                  requestId,
                  invoiceId: reqObjForNotif.invoiceId || reqObjForNotif.invoice_id || null,
                  amount: reqObjForNotif.amount || reqObjForNotif.estimated_value || reqObjForNotif.estimatedValue || reqObjForNotif.rentalFee || null,
                  paid: false
                }
              });
            }
          } else {
            if (!serverApplied) {
              NotificationService.createNotification(email, {
                type: 'success',
                title: 'Borrow Request Approved',
                message: `Your borrow request for ${reqObjForNotif.instrumentName || reqObjForNotif.instrument || 'an instrument'} has been approved. Please bring a valid ID during meetup.`,
                data: { requestId }
              });
            }
          }
        } catch (e) {
          console.error('Failed to create notification on approval', e);
        }

        try {
          window.dispatchEvent(new CustomEvent('instrumentRequestApproved', { detail: { userEmail: reqObjForNotif.userEmail || reqObjForNotif.email, userId: reqObjForNotif.userId || reqObjForNotif.user_id, type } }));
        } catch (e) {
          // best-effort
        }
      }

  window.dispatchEvent(new Event(`${type}RequestsUpdated`));
  // Also notify instrument list consumers that inventory may have changed
  try { window.dispatchEvent(new Event('instrumentsUpdated')); } catch(e) {}
  try { window.dispatchEvent(new Event('instrumentItemsUpdated')); } catch(e) {}
      return true;
    } catch (err) {
      console.error('Failed to update request', err);
      const msg = (err && err.message) ? err.message : 'Failed to update request';
      alert(msg);
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  // Open details for a request and pre-select the location where it was taken from when possible
  const openRequestDetails = (req, type) => {
    // prefer explicit server-side location fields commonly used in requests
    const inferredLocation = req && (req.location_id || req.locationId || req.location || req.reserved_location_id || req.reservation_location_id || req.pickup_location || req.pickupLocation || null);
    if (inferredLocation) setSelectedLocation(Number(inferredLocation));
    setViewDetailsRequest({ ...req, type });
  };

  // Handle return action for rent/borrow requests (admin)
  const handleReturnAction = async (requestOrId, type) => {
    let requestId = requestOrId;
    let requestObj = null;
    if (requestOrId && typeof requestOrId === 'object') {
      requestObj = requestOrId;
      requestId = requestOrId.request_id || requestOrId.requestId || requestOrId.id;
    }

    setProcessingId(requestId || (requestObj && (requestObj.request_id || requestObj.requestId || requestObj.id)) || null);
    try {
      const endpointBase = type === 'borrow' ? '/instruments/borrow-request' : '/instruments/rent-requests';
      let effectiveId = requestId;
      // If id looks local-only, try to resolve (reuse logic from above)
      if (!effectiveId && requestObj) effectiveId = requestObj.request_id || requestObj.requestId || requestObj.id;

      // Determine location to return to: prefer location stored on the request, fall back to selectedLocation
      const requestLocation = (requestObj && (requestObj.location_id || requestObj.locationId || requestObj.location || requestObj.reserved_location_id || requestObj.reservation_location_id || requestObj.pickup_location || requestObj.pickupLocation)) || null;
      const returnLocationId = requestLocation ? Number(requestLocation) : selectedLocation;

      // Call return endpoint
      let resp = null;
      try {
        // Include locationId so server knows which location the instrument is being returned to
        resp = await AuthService.put(`${endpointBase}/${effectiveId}/return`, { locationId: returnLocationId });
      } catch (e) {
        // allow fallthrough to resolution attempts
        console.warn('Return request failed, will attempt id resolution:', e && e.message);
        resp = null;
      }

      if (!resp || resp.success !== true) {
        // Attempt to resolve server-side id if return failed (not found)
        const msg = (resp && resp.message) ? resp.message : 'Failed to process return';
        try {
          // Only attempt resolution when authenticated
          if (AuthService.isAuthenticated()) {
            const serverEndpoint = type === 'borrow' ? '/instruments/borrow-requests' : '/instruments/rent-requests';
            const serverListResp = await AuthService.get(serverEndpoint);
            const serverList = (serverListResp && serverListResp.requests) ? serverListResp.requests : (Array.isArray(serverListResp) ? serverListResp : []);

            // Heuristics: match by instrument name + user email, then by instrument name + start/end
            const local = requestObj || (() => {
              const storageKey = type === 'borrow' ? 'borrowRequests' : 'rentRequests';
              try { return JSON.parse(localStorage.getItem(storageKey) || '[]').find(r => String(r.request_id || r.requestId || r.id) === String(requestId) || String(r.id) === String(requestId)); } catch(e) { return null; }
            })();

            let match = null;
            if (Array.isArray(serverList) && serverList.length) {
              for (const s of serverList) {
                const sName = (s.instrument_name || s.instrumentName || s.instrument || '').toString().trim();
                const lName = (local && (local.instrumentName || local.instrument || local.instrument_name) || requestObj && (requestObj.instrumentName || requestObj.instrument) || '').toString().trim();
                const sEmail = (s.userEmail || s.email || s.user_email || '').toString().trim().toLowerCase();
                const lEmail = (local && (local.userEmail || local.email || local.user_email) || requestObj && (requestObj.userEmail || requestObj.email) || '').toString().trim().toLowerCase();
                if (lName && sName && lName === sName && lEmail && sEmail && lEmail === sEmail) { match = s; break; }
              }
              if (!match && local) {
                for (const s of serverList) {
                  const sName = (s.instrument_name || s.instrumentName || s.instrument || '').toString().trim();
                  const lName = (local.instrumentName || local.instrument || local.instrument_name || '').toString().trim();
                  const sStart = s.start_date || s.startDate || s.date || '';
                  const sEnd = s.end_date || s.endDate || s.date || '';
                  const lStart = local.startDate || local.start_date || local.date || '';
                  const lEnd = local.endDate || local.end_date || local.date || '';
                  if (lName && sName && lName === sName && lStart && sStart && String(lStart) === String(sStart) && lEnd && sEnd && String(lEnd) === String(sEnd)) { match = s; break; }
                }
              }
            }

            if (match) {
              const realId = match.request_id || match.requestId || match.id;
              if (realId) {
                // Retry return with resolved id
                  try {
                  const retry = await AuthService.put(`${endpointBase}/${realId}/return`, { locationId: returnLocationId });
                  if (retry && retry.success === true) {
                    // update localStorage mapping to use realId
                    const storageKey = type === 'borrow' ? 'borrowRequests' : 'rentRequests';
                    try {
                      const all = JSON.parse(localStorage.getItem(storageKey) || '[]');
                      const mapped = all.map(r => (String(r.id) === String(requestId) || String(r.request_id) === String(requestId) || (local && String(r.id) === String(local.id))) ? { ...r, id: realId, request_id: realId, requestId: realId, localOnly: false } : r);
                      localStorage.setItem(storageKey, JSON.stringify(mapped));
                      if (type === 'borrow') setBorrowRequests(mapped); else setRentRequests(mapped);
                    } catch (e) {
                      // ignore mapping errors
                    }

                    // proceed as success
                    // Update local state to mark returned
                    const storageKey2 = type === 'borrow' ? 'borrowRequests' : 'rentRequests';
                    const requests = JSON.parse(localStorage.getItem(storageKey2) || '[]');
                    const updatedRequests = requests.map(r => {
                      if (String(r.request_id || r.requestId || r.id) === String(realId) || String(r.id) === String(realId)) {
                        return { ...r, status: 'returned', returned_at: new Date().toISOString() };
                      }
                      return r;
                    });
                    localStorage.setItem(storageKey2, JSON.stringify(updatedRequests));
                    if (type === 'borrow') setBorrowRequests(updatedRequests); else setRentRequests(updatedRequests);

                    // Notify user
                    try {
                      const reqObjFinal = updatedRequests.find(r => String(r.request_id || r.requestId || r.id) === String(realId));
                      if (reqObjFinal) {
                        const email = (reqObjFinal.userEmail || reqObjFinal.email || '').toLowerCase();
                        if (email) {
                          NotificationService.createNotification(email, {
                            type: 'info',
                            title: 'Return Processed',
                            message: `Your ${type === 'rent' ? 'rental' : 'borrow'} for ${reqObjFinal.instrumentName || reqObjFinal.instrument || 'an instrument'} has been processed as returned. Thank you.`,
                            data: { requestId: realId }
                          });
                        }
                      }
                    } catch (e) { console.warn('Failed to notify after resolved return', e); }

                    window.dispatchEvent(new Event(`${type}RequestsUpdated`));
                    return true;
                  }
                } catch (e) {
                  console.warn('Retry return failed with resolved id', e && e.message);
                }
              }
            }
          }
        } catch (resolveErr) {
          console.warn('Error resolving server id for return:', resolveErr);
        }

        // If resolution failed or not possible, alert original message
        alert(msg);
        return false;
      }

      // Update localStorage and state
      const storageKey = type === 'borrow' ? 'borrowRequests' : 'rentRequests';
      const requests = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updatedRequests = requests.map(r => {
        if (String(r.request_id || r.requestId || r.id) === String(requestId) || String(r.id) === String(effectiveId)) {
          return { ...r, status: 'returned', returned_at: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(storageKey, JSON.stringify(updatedRequests));
      if (type === 'borrow') setBorrowRequests(updatedRequests); else setRentRequests(updatedRequests);

      // Notify user
      try {
        const reqObj = requestObj || updatedRequests.find(r => String(r.request_id || r.requestId || r.id) === String(requestId) || String(r.id) === String(effectiveId));
        if (reqObj) {
          const email = (reqObj.userEmail || reqObj.email || '').toLowerCase();
          if (email) {
            NotificationService.createNotification(email, {
              type: 'info',
              title: 'Return Processed',
              message: `Your ${type === 'rent' ? 'rental' : 'borrow'} for ${reqObj.instrumentName || reqObj.instrument || 'an instrument'} has been processed as returned. Thank you.`,
              data: { requestId: reqObj.request_id || reqObj.requestId || reqObj.id, locationId: returnLocationId }
            });
          }
        }
      } catch (e) {
        console.warn('Failed to notify user about return', e);
      }

      window.dispatchEvent(new Event(`${type}RequestsUpdated`));
      return true;
    } catch (err) {
      console.error('Failed to process return', err);
      alert(err && err.message ? err.message : 'Failed to process return');
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkPaid = (requestId, type) => {
    setProcessingId(requestId);
    try {
      const storageKey = type === 'borrow' ? 'borrowRequests' : 'rentRequests';
      const requests = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = requests.map(r => r.id === requestId ? { ...r, status: 'paid' } : r);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      if (type === 'borrow') setBorrowRequests(updated); else setRentRequests(updated);
      // Notify user about payment confirmation
      const paidReq = updated.find(r => r.id === requestId);
      if (paidReq) {
        NotificationService.createNotification(paidReq.userEmail, {
          type: 'success',
          title: 'Payment Received',
          message: `We have recorded full payment for your ${type === 'rent' ? 'rental' : 'borrow'} request (${paidReq.instrument || paidReq.instrumentName}). Thank you!`,
          data: { requestId: paidReq.id }
        });
      }
      window.dispatchEvent(new Event(`${type}RequestsUpdated`));
    } catch (err) {
      console.error('Failed to mark paid', err);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    // Use toLocaleString so date and time formatting options are respected
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(dateString);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      base: {
        padding: '4px 10px',
        borderRadius: 14,
        fontSize: '12px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        display: 'inline-block'
      },
      pending: {
        backgroundColor: '#fff7ed',
        color: '#7a4100',
        border: '1px solid #f59e0b'
      },
      approved: {
        backgroundColor: '#ecfdf5',
        color: '#065f46',
        border: '1px solid #34d399'
      },
      paid: {
        backgroundColor: '#eff6ff',
        color: '#1e3a8a',
        border: '1px solid #60a5fa'
      },
      rejected: {
        backgroundColor: '#fff1f2',
        color: '#7f1d1d',
        border: '1px solid #f87171'
      }
    };

    return (
      <span style={{...styles.base, ...(styles[status] || styles.pending)}}>
        {String(status || '').toUpperCase()}
      </span>
    );
  };

  const styles = {
    // global container + font to match Inventory
    container: {
      padding: '24px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '24px'
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
    closeButton: {
      background: 'transparent',
      border: 'none',
      fontSize: '20px',
      lineHeight: '1',
      cursor: 'pointer',
      color: '#374151'
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '0',
      boxShadow: '0 6px 18px rgba(2,6,23,0.06)',
      border: '1px solid rgba(15,23,42,0.04)',
      overflow: 'hidden'
    },
    cardHeader: {
      padding: '24px 32px',
      borderBottom: '1px solid #f1f5f9',
      backgroundColor: '#fafbfc'
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      margin: 0
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
    // stats (match inventory sizing / alignment)
    statsContainer: {
      display: 'flex',
      flexWrap: 'nowrap',       // keep cards on one line
      gap: '12px',
      margin: '0 0 18px 0',
      alignItems: 'stretch',
      padding: '0 4px',
      boxSizing: 'border-box',
      justifyContent: 'flex-start',
      overflowX: 'auto'
    },
    statCard: {
      flex: '0 0 220px',
      minWidth: 200,
      maxWidth: 260,
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '14px 16px',
      textAlign: 'center',
      transition: 'all 0.18s ease',
      minHeight: 110,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
    },
    statIcon: { marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    statNumber: { fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: 6, textAlign: 'center' },
    statLabel: { fontSize: '13px', color: '#64748b', marginTop: 4, textAlign: 'center' },

    tableHeader: {
      borderBottom: '1px solid #e2e8f0',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: 800,
      color: '#0f172a',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    th: {
      padding: '12px 16px',
      textAlign: 'center',
      fontSize: '13px',
      fontWeight: 600,
      color: '#3b82f6',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      verticalAlign: 'middle'
    },
    td: {
      padding: '12px 16px',
      borderBottom: '1px solid #f1f5f9',
      fontSize: '14px',
      color: '#374151',
      verticalAlign: 'middle',
      textAlign: 'center'
    },
    invoiceRow: {
      transition: 'background-color 0.2s ease'
    },
    invoiceCard: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    requestCard: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: '#fff',
      border: '1px solid rgba(15,23,42,0.04)',
      borderRadius: 12,
      padding: '12px 16px',
      boxShadow: '0 6px 18px rgba(2,6,23,0.03)'
    },
    requestHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    },
    requestBody: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      width: '100%'
    },
    requestMeta: {
      flex: 1,
      minWidth: 200,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    },
    requestActions: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    },
    viewBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      fontSize: 13,
      backgroundColor: '#ffffff',
      color: '#2563eb',
      border: '1.5px solid #2563eb',
      borderRadius: 8,
      cursor: 'pointer',
      fontWeight: 600,
      transition: 'all 0.12s ease'
    },
    secondaryBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '6px 10px',
      minWidth: 100,
      fontSize: 13,
      backgroundColor: '#ffffff',
      color: '#b45309',
      border: '1.5px solid #f59e0b',
      borderRadius: 8,
      cursor: 'pointer',
      fontWeight: 600
    },
    modalProfile: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 12,
      background: '#eef2ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 28,
      color: '#3730a3',
      fontWeight: 700
    },
    modalInfoCol: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    },
    /* Modal specific styles */
    modalCard: {
      width: 'min(780px, 96%)',
      background: '#ffffff',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 16px 48px rgba(2,6,23,0.18)'
    },
    modalHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #eef2f7',
      paddingBottom: 12,
      marginBottom: 12
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 800,
      color: '#0f172a'
    },
    modalSub: {
      fontSize: 13,
      color: '#6b7280'
    },
    closeIcon: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: '#64748b',
      fontSize: 16
    },
    modalBodyGrid: {
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      gap: 20
    },
    profileCard: {
      background: '#fafafa',
      borderRadius: 10,
      padding: 14,
      border: '1px solid #f1f5f9'
    },
    profileAvatar: {
      width: 84,
      height: 84,
      borderRadius: 14,
      background: '#eef2ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 34,
      color: '#3730a3',
      fontWeight: 800,
      marginBottom: 8
    },
    profileName: {
      fontWeight: 800,
      fontSize: 16
    },
    profileContact: {
      color: '#6b7280',
      fontSize: 13
    },
    detailLabel: {
      fontSize: 12,
      color: '#64748b',
      marginBottom: 6
    },
    detailValue: {
      fontWeight: 600,
      color: '#0f172a'
    },
    modalFooter: {
      marginTop: 16,
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    },
    btnBlue: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '6px 10px',
      minWidth: 100,
      fontSize: 13,
      backgroundColor: '#ffffff',
      color: '#2563eb',
      border: '1.5px solid #2563eb',
      borderRadius: 8,
      cursor: 'pointer',
      fontWeight: 600
    },
    primaryBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '6px 10px',
      minWidth: 100,
      fontSize: 13,
      backgroundColor: '#ffffff',
      color: '#059669',
      border: '1.5px solid #059669',
      borderRadius: 8,
      cursor: 'pointer',
      fontWeight: 600
    },
    dangerBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '6px 10px',
      minWidth: 100,
      fontSize: 13,
      backgroundColor: '#ffffff',
      color: '#ef4444',
      border: '1.5px solid #ef4444',
      borderRadius: 8,
      cursor: 'pointer',
      fontWeight: 600
    },
    // Compact icon-only button variants for modal actions
    smallIconPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 38,
      padding: 0,
      fontSize: 16,
      backgroundColor: '#059669',
      color: '#ffffff',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer'
    },
    smallIconDanger: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 38,
      padding: 0,
      fontSize: 16,
      backgroundColor: '#ffffff',
      color: '#dc2626',
      border: '1px solid #dc2626',
      borderRadius: 8,
      cursor: 'pointer'
    },
    disabledBtn: {
      opacity: 0.6,
      cursor: 'not-allowed'
    },
    invoiceId: {
      fontWeight: '600',
      color: '#1f2937'
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      color: '#6b7280'
    },
    amount: {
      fontWeight: '600',
      fontSize: '16px',
      color: '#059669'
    },
    description: {
      color: '#6b7280',
      fontStyle: 'italic',
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    dateInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: '#6b7280'
    },
    actionButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      backgroundColor: '#10b981',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    actionButtonDisabled: {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
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
    spinner: {
      width: '14px',
      height: '14px',
      border: '1.5px solid rgba(15,23,42,0.12)',
      borderTop: '1.5px solid rgba(15,23,42,0.5)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{...styles.card, padding: '64px', textAlign: 'center'}}>
          <div style={{...styles.spinner, margin: '0 auto 16px'}}></div>
          <div>Loading instrument requests...</div>
        </div>
      </div>
    );
  }

  // Show all requests, sorted by status (pending first, then approved, then rejected)
  const sortedBorrowRequests = [...borrowRequests].sort((a, b) => {
    const statusOrder = { pending: 0, approved: 1, rejected: 2, returned: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });
  
  const sortedRentRequests = [...rentRequests].sort((a, b) => {
    const statusOrder = { pending: 0, approved: 1, rejected: 2, paid: 3, returned: 4 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const pendingBorrowCount = borrowRequests.filter(req => req.status === 'pending').length;
  const pendingRentCount = rentRequests.filter(req => req.status === 'pending').length;

  const tabStyle = (isActive) => ({
    padding: '12px 24px',
    backgroundColor: isActive ? '#3b82f6' : 'transparent',
    color: isActive ? '#ffffff' : '#64748b',
    border: 'none',
    borderBottom: isActive ? '3px solid #3b82f6' : '3px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  });

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
          
          .approve-button:hover:not(:disabled) {
            background-color: #059669;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }

          .reject-button:hover:not(:disabled) {
            background-color: #dc2626;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
          }

          .tab-button:hover {
            background-color: #f1f5f9;
          }
        `}
      </style>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: 0, borderBottom: 'none', paddingBottom: 6, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button 
          onClick={() => setActiveTab('borrow')} 
          style={tabStyle(activeTab === 'borrow')}
          className="tab-button"
        >
          <FaUserFriends size={14} />
          Borrow Requests ({borrowRequests.length})
          {pendingBorrowCount > 0 && <span style={{ marginLeft: '4px', padding: '2px 6px', backgroundColor: '#fbbf24', color: '#78350f', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>{pendingBorrowCount} pending</span>}
        </button>
        <button 
          onClick={() => setActiveTab('rent')} 
          style={tabStyle(activeTab === 'rent')}
          className="tab-button"
        >
          <FaMusic size={14} />
          Rent Requests ({rentRequests.length})
          {pendingRentCount > 0 && <span style={{ marginLeft: '4px', padding: '2px 6px', backgroundColor: '#fbbf24', color: '#78350f', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>{pendingRentCount} pending</span>}
        </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Manual sync removed */}
        </div>
      </div>

      {/* Borrow Requests Tab */}
      {activeTab === 'borrow' && (
        <div style={styles.card}>
          <div style={styles.cardBody}>
             {borrowRequests.length === 0 ? (
               <div style={styles.emptyState}>
                 <FaUserFriends style={styles.emptyIcon} />
                 <div style={styles.emptyTitle}>No Borrow Requests</div>
                 <div style={styles.emptyDescription}>No borrow requests have been submitted yet.</div>
               </div>
             ) : (
               <div style={{ padding: '4px 12px 12px 12px', marginTop: 0 }}>
                 <table style={styles.table}>
                   <thead style={styles.tableHeader}>
                     <tr>
                       <th style={styles.th}>ID</th>
                       <th style={styles.th}>User</th>
                       <th style={styles.th}>Instrument</th>
                       <th style={styles.th}>Qty</th>
                       <th style={styles.th}>Requested</th>
                       <th style={styles.th}>Status</th>
                       <th style={styles.th}>Actions</th>
                     </tr>
                   </thead>
                   <tbody>
             {sortedBorrowRequests.map((req, idx) => (
               <tr key={String(req.request_id || req.requestId || req.id || `borrow-${idx}`)} className="invoice-row" style={req.archived ? styles.archivedRow : {}}>
                         <td style={styles.td} title={String(req.id)}>
                           {typeof req.request_id !== 'undefined' ? req.request_id : (typeof req.requestId !== 'undefined' ? req.requestId : (typeof req.id === 'string' && req.id.startsWith('local-') ? `local-${String(req.id).split('-')[1].slice(-6)}` : req.id))}
                         </td>
                         <td style={{...styles.td, textAlign: 'left'}}>
                           <div style={{fontWeight: 700, color: '#0f172a'}}>{req.userName || req.userFullName || req.user || '—'}</div>
                           <div style={{fontSize: 13, color: '#64748b'}}>{req.userEmail || req.email || '—'}</div>
                         </td>
                         <td style={styles.td}>{req.instrumentName || req.instrument || '—'}</td>
                         <td style={styles.td}>{req.quantity || 1}</td>
                         <td style={styles.td}>{formatDate(req.createdAt || req.startDate || req.date || '')}</td>
                         <td style={styles.td}>{getStatusBadge(req.status)}</td>
                         <td style={styles.td}>
                           <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                            <button onClick={() => openRequestDetails(req, 'borrow')} style={styles.viewBtn}><FaInfoCircle /> Details</button>
                              {(() => {
                                const st = String(req.status || '').toLowerCase();
                                if (st === 'approved' || st === 'paid') {
                                  return (
                                    <button
                                      onClick={async () => {
                                        if (!confirm('Mark this borrow request as returned?')) return;
                                        const ok = await handleReturnAction(req, 'borrow');
                                        if (ok) setViewDetailsRequest(null);
                                      }}
                                      disabled={processingId === req.request_id || processingId === req.id}
                                      style={{ ...styles.primaryBtn, ...(processingId === req.request_id || processingId === req.id ? styles.disabledBtn : {}) }}
                                    >Return</button>
                                  );
                                }
                                return null;
                              })()}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        </div>
      )}
 
      {/* Rent Requests Tab */}
      {activeTab === 'rent' && (
        <div style={styles.card}>
          <div style={styles.cardBody}>
           {rentRequests.length === 0 ? (
             <div style={styles.emptyState}>
               <FaMusic style={styles.emptyIcon} />
               <div style={styles.emptyTitle}>No Rent Requests</div>
               <div style={styles.emptyDescription}>No rent requests have been submitted yet.</div>
             </div>
           ) : (
             <div style={{ padding: '4px 12px 12px 12px', marginTop: 0 }}>
               <table style={styles.table}>
                 <thead style={styles.tableHeader}>
                   <tr>
                     <th style={styles.th}>ID</th>
                     <th style={styles.th}>User</th>
                     <th style={styles.th}>Instrument</th>
                     <th style={styles.th}>Qty</th>
                     <th style={styles.th}>Fee/Day</th>
                     <th style={styles.th}>Requested</th>
                     <th style={styles.th}>Status</th>
                     <th style={styles.th}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {sortedRentRequests.map((req, idx) => (
                     <tr key={String(req.request_id || req.requestId || req.id || `rent-${idx}`)} className="invoice-row" style={req.archived ? styles.archivedRow : {}}>
                       <td style={styles.td} title={String(req.id)}>
                         {typeof req.request_id !== 'undefined' ? req.request_id : (typeof req.requestId !== 'undefined' ? req.requestId : (typeof req.id === 'string' && req.id.startsWith('local-') ? `local-${String(req.id).split('-')[1].slice(-6)}` : req.id))}
                       </td>
                       <td style={{...styles.td, textAlign: 'left'}}>
                         <div style={{fontWeight: 700, color: '#0f172a'}}>{req.userName || req.userFullName || req.user || '—'}</div>
                         <div style={{fontSize: 13, color: '#64748b'}}>{req.userEmail || req.email || '—'}</div>
                       </td>
                       <td style={styles.td}>{req.instrumentName || req.instrument || '—'}</td>
                       <td style={styles.td}>{req.quantity || 1}</td>
                       <td style={styles.td}>{
                         (() => {
                          // Prefer explicit per-day price when available. If only a rental_fee (which may be total)
                          // is present and days > 1, treat rental_fee as total and compute per-day = total / days.
                          const perDayField = req.instrumentPricePerDay || req.instrument_price_per_day || req.instrumentPrice || req.price_per_day || req.price || instrumentPriceMap[req.instrument_id || req.instrumentId || req.instrument_id];
                          const rawRental = req.rental_fee || req.rentalFee || null;
                          const days = calcRentalDays(req.startDate || req.start_date || req.date || null, req.endDate || req.end_date || req.date || null);
                          let perDay = perDayField ? Number(perDayField) : null;
                          let total = null;
                          if (!perDay && rawRental != null) {
                            const raw = Number(rawRental);
                            if (days && days > 1) {
                              // assume rawRental is total
                              total = raw;
                              perDay = raw / days;
                            } else {
                              perDay = raw;
                              total = perDay;
                            }
                          }
                          if (perDay == null || isNaN(perDay)) return '—';
                          if (!total) total = (days && days > 0) ? (Number(perDay) * days) : Number(perDay);
                          if (days && days > 0) {
                            return `₱${Number(perDay).toFixed(2)} /day · ${days}d · ₱${Number(total).toFixed(2)}`;
                          }
                          return `₱${Number(perDay).toFixed(2)} /day`;
                         })()
                       }</td>
                       <td style={styles.td}>{formatDate(req.createdAt || req.startDate || req.date || '')}</td>
                       <td style={styles.td}>{getStatusBadge(req.status)}</td>
                       <td style={styles.td}>
                         <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                           <button onClick={() => openRequestDetails(req, 'rent')} style={styles.viewBtn}><FaInfoCircle /> Details</button>
                              {(() => {
                                const st = String(req.status || '').toLowerCase();
                                if (st === 'approved' || st === 'paid') {
                                  return (
                                    <button
                                      onClick={async () => {
                                        if (!confirm('Mark this rent request as returned?')) return;
                                        const ok = await handleReturnAction(req, 'rent');
                                        if (ok) setViewDetailsRequest(null);
                                      }}
                                      disabled={processingId === req.request_id || processingId === req.id}
                                      style={{ ...styles.primaryBtn, ...(processingId === req.request_id || processingId === req.id ? styles.disabledBtn : {}) }}
                                    >Return</button>
                                  );
                                }
                                return null;
                              })()}
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
          </div>
        </div>
      )}
      {/* Details modal (alternate design) */}
      {viewDetailsRequest && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }} onClick={() => setViewDetailsRequest(null)}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            maxWidth: '800px', 
            width: '100%', 
            maxHeight: '90vh', 
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header - Sticky */}
            <div style={{ 
              padding: '24px 28px', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Request Details</h2>
              </div>
              <button 
                onClick={() => setViewDetailsRequest(null)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#6b7280', 
                  fontSize: 24, 
                  cursor: 'pointer',
                  padding: 8,
                  lineHeight: 1
                }}
              >×</button>
            </div>

            {/* Body - Scrollable */}
            <div style={{ 
              padding: '28px', 
              overflowY: 'auto',
              flexGrow: 1
            }}>
              
              {/* User Information */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requester Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Name</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {viewDetailsRequest.fullName || viewDetailsRequest.userFullName || viewDetailsRequest.userName || viewDetailsRequest.user || '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Email</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {viewDetailsRequest.userEmail || viewDetailsRequest.email || '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Phone Number</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {viewDetailsRequest.phone || viewDetailsRequest.userPhone || '—'}
                    </div>
                  </div>
                  {viewDetailsRequest.borrowerIdFileName && (
                    <div>
                      <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Uploaded ID</label>
                      <a 
                        target="_blank" 
                        rel="noreferrer" 
                        href={`/uploads/${viewDetailsRequest.borrowerIdFileName}`}
                        style={{ fontSize: 14, color: '#3b82f6', textDecoration: 'none' }}
                      >
                        View Document →
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ height: 1, background: '#e5e7eb', margin: '24px 0' }}></div>

              {/* Instrument Details */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Instrument Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Instrument Name</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {viewDetailsRequest.instrumentName || viewDetailsRequest.instrument || '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Quantity</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {viewDetailsRequest.quantity || 1} unit(s)
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Start Date</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {viewDetailsRequest.startDate ? formatDate(viewDetailsRequest.startDate) : '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>End Date</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {viewDetailsRequest.endDate ? formatDate(viewDetailsRequest.endDate) : '—'}
                    </div>
                  </div>
                  
                  { (() => {
                      const perDayField = viewDetailsRequest.instrumentPricePerDay || viewDetailsRequest.instrument_price_per_day || viewDetailsRequest.instrumentPrice || viewDetailsRequest.price_per_day || viewDetailsRequest.price;
                      const rawRental = (typeof viewDetailsRequest.rental_fee !== 'undefined') ? viewDetailsRequest.rental_fee : (typeof viewDetailsRequest.rentalFee !== 'undefined' ? viewDetailsRequest.rentalFee : null);
                      const totalField = viewDetailsRequest.total_amount || viewDetailsRequest.totalAmount || viewDetailsRequest.amount || null;
                      const days = calcRentalDays(viewDetailsRequest.startDate || viewDetailsRequest.start_date || viewDetailsRequest.date || null, viewDetailsRequest.endDate || viewDetailsRequest.end_date || viewDetailsRequest.date || null);
                      const qty = Number(viewDetailsRequest.quantity) || 1;

                      // Prefer explicit per-day field from instrument or rental_fee (treat rental_fee as per-day)
                      let perDay = null;
                      if (perDayField != null) perDay = Number(perDayField);
                      else if (rawRental != null) perDay = Number(rawRental);

                      // If we have an explicit total field, use it; otherwise compute from perDay
                      let total = null;
                      if (totalField != null) total = Number(totalField);
                      else if (perDay != null && !isNaN(perDay)) total = perDay * (days && days > 0 ? days : 1) * qty;

                      // If we don't have perDay but have total, derive perDay from total/days/qty
                      if ((perDay == null || isNaN(perDay)) && total != null && days && days > 0) {
                        perDay = total / (days * qty);
                      }

                      if (perDay == null || isNaN(perDay)) return null;

                      return (
                        <>
                          <div>
                            <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Price per Day</label>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#059669' }}>
                              ₱{Number(perDay).toFixed(2)}
                            </div>
                          </div>
                          {days > 0 && (
                            <div>
                              <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Total Amount ({days} day{days > 1 ? 's' : ''})</label>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#059669' }}>
                                ₱{Number(total != null ? total : (perDay * days * qty)).toFixed(2)}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()
                  }
                  
                  {/* Request Status */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Request Status</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: 13,
                        fontWeight: 600,
                        background: 
                          viewDetailsRequest.status === 'approved' ? '#d1fae5' :
                          viewDetailsRequest.status === 'pending' ? '#fef3c7' :
                          viewDetailsRequest.status === 'rejected' ? '#fee2e2' :
                          viewDetailsRequest.status === 'paid' ? '#dbeafe' :
                          viewDetailsRequest.status === 'returned' ? '#e0e7ff' : '#f3f4f6',
                        color:
                          viewDetailsRequest.status === 'approved' ? '#065f46' :
                          viewDetailsRequest.status === 'pending' ? '#92400e' :
                          viewDetailsRequest.status === 'rejected' ? '#991b1b' :
                          viewDetailsRequest.status === 'paid' ? '#1e40af' :
                          viewDetailsRequest.status === 'returned' ? '#3730a3' : '#374151'
                      }}>
                        {(viewDetailsRequest.status || 'pending').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Payment Status - only for rent requests */}
                  {viewDetailsRequest.type === 'rent' && (
                    <div>
                      <label style={{ display: 'block', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Payment Status</label>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: 13,
                          fontWeight: 600,
                          background: 
                            viewDetailsRequest.status === 'paid' || viewDetailsRequest.status === 'returned' ? '#d1fae5' :
                            viewDetailsRequest.status === 'approved' ? '#fef3c7' : '#fee2e2',
                          color:
                            viewDetailsRequest.status === 'paid' || viewDetailsRequest.status === 'returned' ? '#065f46' :
                            viewDetailsRequest.status === 'approved' ? '#92400e' : '#991b1b'
                        }}>
                          {viewDetailsRequest.status === 'paid' || viewDetailsRequest.status === 'returned' ? 'PAID' :
                           viewDetailsRequest.status === 'approved' ? 'PENDING PAYMENT' : 'NOT PAID'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reservation expiry removed from UI (no reserved_until concept) */}
                </div>
              </div>

              {/* Purpose */}
              {(typeof viewDetailsRequest.purpose !== 'undefined' && viewDetailsRequest.purpose !== null) && (
                <>
                  <div style={{ height: 1, background: '#e5e7eb', margin: '24px 0' }}></div>
                  <div style={{ marginBottom: 12 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Purpose</h3>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {viewDetailsRequest.purpose || '—'}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              {(typeof viewDetailsRequest.notes !== 'undefined' && viewDetailsRequest.notes !== null) && (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</h3>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {viewDetailsRequest.notes || '—'}
                    </div>
                  </div>
                </>
              )}

              {/* Location Selector */}
                    {viewDetailsRequest.status === 'pending' && (
                <>
                  <div style={{ height: 1, background: '#e5e7eb', margin: '24px 0' }}></div>
                  <div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location to Deduct From</h3>
                    <select 
                      value={selectedLocation || ''}
                      onChange={(e) => setSelectedLocation(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: 14,
                        color: '#111827',
                        background: 'white',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {locations.length === 0 ? (
                        <option value="">Loading locations...</option>
                      ) : (
                        locations.map(loc => (
                          <option key={loc.location_id} value={loc.location_id}>
                            {loc.location_name} ({loc.location_type || 'Location'})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons - Sticky Footer */}
            {(viewDetailsRequest.status === 'pending' || viewDetailsRequest.status === 'approved' || viewDetailsRequest.status === 'paid') && (
              <div style={{ 
                padding: '16px 28px', 
                borderTop: '1px solid #e5e7eb',
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: 12,
                flexShrink: 0,
                background: 'white',
                borderRadius: '0 0 12px 12px'
              }}>
                
                {viewDetailsRequest.status === 'pending' && (
                      <>
                        <button
                          title="Reject"
                          aria-label="Reject"
                          onClick={async () => {
                            const ok = await handleInstrumentRequestAction(viewDetailsRequest, 'rejected', viewDetailsRequest.type);
                            if (ok) setViewDetailsRequest(null);
                          }}
                          disabled={processingId === viewDetailsRequest.id}
                          style={{ ...styles.smallIconDanger, ...(processingId === viewDetailsRequest.id ? styles.disabledBtn : {}) }}
                        >
                          <FaTimes />
                        </button>

                        <button
                          title="Approve"
                          aria-label="Approve"
                          onClick={async () => {
                            const ok = await handleInstrumentRequestAction(viewDetailsRequest, 'approved', viewDetailsRequest.type);
                            if (ok) setViewDetailsRequest(null);
                          }}
                          disabled={processingId === viewDetailsRequest.id}
                          style={{ ...styles.smallIconPrimary, ...(processingId === viewDetailsRequest.id ? styles.disabledBtn : {}) }}
                        >
                          {processingId === viewDetailsRequest.id ? (
                            <div style={{ 
                              width: 14, 
                              height: 14, 
                              border: '2px solid white', 
                              borderTopColor: 'transparent', 
                              borderRadius: '50%', 
                              animation: 'spin 0.6s linear infinite' 
                            }}></div>
                          ) : (
                            <FaCheck />
                          )}
                        </button>
                      </>
                    )}

                    {/* Remind button for rent requests with remaining balance (admin) */}
                    {viewDetailsRequest.type === 'rent' && (() => {
                      const remaining = Number(viewDetailsRequest.remaining_balance || viewDetailsRequest.remainingBalance || viewDetailsRequest.remaining || 0);
                      const st = String(viewDetailsRequest.status || '').toLowerCase();
                      if (remaining > 0 && (st === 'approved' || st === 'pending')) {
                        return (
                          <button
                            onClick={async () => {
                              const email = (viewDetailsRequest.userEmail || viewDetailsRequest.email || '').toLowerCase();
                              if (!email) { alert('No user email available to send reminder.'); return; }
                              const reqId = viewDetailsRequest.request_id || viewDetailsRequest.id || viewDetailsRequest.requestId || null;
                              const remVal = Number(remaining || 0);
                              const title = 'Payment Reminder: Outstanding Balance';
                              const message = `You have an outstanding balance of ₱${remVal.toFixed(2)} for your rental request${viewDetailsRequest.instrumentName ? ' for "' + viewDetailsRequest.instrumentName + '"' : ''}. Please settle it to complete your booking.`;
                              try {
                                setProcessingId(reqId || ('remind-' + Date.now()));
                                // Persist notification server-side and also create local notification for immediate UI feedback
                                try {
                                  // Include paymentType and forceFull so the customer is reminded to pay the full balance
                                  await AuthService.post('/notifications', { userEmail: email, type: 'warning', title, message: `${message} Partial/down payments are not accepted for this reminder.`, data: { requestId: reqId, remaining: remVal, amount: remVal, paymentType: 'full', forceFull: true } });
                                } catch (e) {
                                  // ignore server failure and fall back to client-side notification
                                  console.warn('Failed to persist reminder via API, falling back to client notification', e && e.message);
                                }
                                try {
                                  NotificationService.createNotification(email, { type: 'warning', title, message: `${message} Partial/down payments are not accepted for this reminder.`, data: { requestId: reqId, remaining: remVal, amount: remVal, paymentType: 'full', forceFull: true } });
                                } catch (e) {
                                  console.warn('Failed to create client-side notification for reminder', e && e.message);
                                }
                                alert('Reminder sent to customer.');
                              } catch (err) {
                                alert('Failed to send reminder: ' + (err && err.message ? err.message : err));
                              } finally {
                                setProcessingId(null);
                              }
                            }}
                            disabled={processingId === viewDetailsRequest.id}
                            style={{
                              padding: '10px 20px',
                              borderRadius: 6,
                              border: '1px solid #f59e0b',
                              background: 'white',
                              color: '#b45309',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: processingId === viewDetailsRequest.id ? 'not-allowed' : 'pointer',
                              opacity: processingId === viewDetailsRequest.id ? 0.5 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            Remind
                          </button>
                        );
                      }
                      return null;
                    })()}

                    {viewDetailsRequest.status === 'approved' && viewDetailsRequest.type === 'rent' && (
                      <button 
                        onClick={() => { 
                          handleMarkPaid(viewDetailsRequest.id, viewDetailsRequest.type); 
                          setViewDetailsRequest(null); 
                        }} 
                        disabled={processingId === viewDetailsRequest.id} 
                        style={{
                          padding: '10px 20px',
                          borderRadius: 6,
                          border: '1px solid #3b82f6',
                          background: 'white',
                          color: '#3b82f6',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: processingId === viewDetailsRequest.id ? 'not-allowed' : 'pointer',
                          opacity: processingId === viewDetailsRequest.id ? 0.5 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        Mark Paid
                      </button>
                    )}

                    {(() => {
                      const st = String(viewDetailsRequest.status || '').toLowerCase();
                      if (st === 'approved' || st === 'paid') {
                        return (
                          <button
                            onClick={async () => {
                              if (!confirm('Mark this request as returned?')) return;
                              const ok = await handleReturnAction(viewDetailsRequest, viewDetailsRequest.type);
                              if (ok) setViewDetailsRequest(null);
                            }}
                            disabled={processingId === viewDetailsRequest.id}
                            style={{
                              padding: '10px 20px',
                              borderRadius: 6,
                              border: 'none',
                              background: '#059669',
                              color: 'white',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: processingId === viewDetailsRequest.id ? 'not-allowed' : 'pointer',
                              opacity: processingId === viewDetailsRequest.id ? 0.5 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            Return
                          </button>
                        );
                      }
                      return null;
                    })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Approval;
