import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { API_BASE_URL } from './services/apiConfig';

// Simple hash routing for /#/booking and /#/instrument-booking
const BookStandalone = React.lazy(() => import('./Components/Booking'));
const InstrumentBookStandalone = React.lazy(() => import('./Components/InstrumentRental'));
const InstrumentBorrowStandalone = React.lazy(() => import('./Components/InstrumentBorrowing'));

// Recover automatically from chunk load failures (common in dev after HMR or cache mismatch).
// When a chunk fails to load (Network 404 for a chunk), the app can throw a ChunkLoadError
// which breaks rendering. Listen for these errors and reload the page to fetch the latest
// assets from the dev server.
try {
  window.addEventListener('error', (e) => {
    if (e && e.message && e.message.includes('Loading chunk')) {
      console.warn('ChunkLoadError detected (error event), reloading to recover.');
      window.location.reload();
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e && e.reason;
    const msg = reason && (reason.message || reason.toString());
    if ((reason && reason.name === 'ChunkLoadError') || (msg && msg.includes && msg.includes('Loading chunk'))) {
      console.warn('ChunkLoadError detected (unhandledrejection), reloading to recover.');
      window.location.reload();
    }
  });
} catch (err) {
  // Safe fallback: if window isn't available or adding listeners fails, ignore.
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const HashRouter = () => {
  const [route, setRoute] = React.useState(window.location.hash);
  React.useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (route === '#/booking') {
    return (
      <React.Suspense fallback={<div />}> 
        <BookStandalone />
      </React.Suspense>
    );
  }
  if (route === '#/instrument-booking') {
    return (
      <React.Suspense fallback={<div />}> 
        <InstrumentBookStandalone />
      </React.Suspense>
    );
  }
  if (route === '#/instrument-borrowing') {
    return (
      <React.Suspense fallback={<div />}>
        <InstrumentBorrowStandalone />
      </React.Suspense>
    );
  }
  return <App />;
};

root.render(
  <React.StrictMode>
    <HashRouter />
  </React.StrictMode>
);

// Strict localStorage removal shim
// Clear existing localStorage data and disable writes so the backend (MySQL) is the single source of truth.
try {
  // Clear any previously cached data but preserve auth/session keys so users stay logged in
  if (typeof window !== 'undefined' && window.localStorage) {
    // read preserved keys before we clear
    // Preserve both the new session keys and older legacy keys used throughout the app
    const PRESERVE_KEYS = [
      'authToken',
      'user',
      // legacy keys used by older components - keep these so reload doesn't log users out
      'davaoBlueEaglesUser',
      'davaoBlueEaglesUsers',
      'davaoBlueEaglesCurrentView',
      'davaoBlueEaglesLastView'
    ];

    const _preserved = {};
    PRESERVE_KEYS.forEach((k) => {
      try {
        _preserved[k] = window.localStorage.getItem(k);
      } catch (e) {
        _preserved[k] = null;
      }
    });

  // Informational: we're enforcing server-only persistence but preserving session keys
  console.info('Clearing localStorage to enforce server-only persistence (MySQL). Preserving session keys.');
    window.localStorage.clear();

    // Preserve read access but disable writes — setItem/removeItem/clear become no-ops that log a warning.
    const original = window.localStorage;
    // Silent no-op for blocked writes. We intentionally avoid noisy warnings for every write
    // to reduce console spam; developers can enable debugging if needed.
    const noop = function () { /* write blocked by server-only persistence policy */ };

    // Replace mutating methods with no-ops
      try {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          enumerable: true,
          value: {
            getItem: original.getItem.bind(original),
            key: original.key.bind(original),
            length: original.length,
            setItem: function(key, value) {
              // Allow writes only for preserved/whitelisted keys so we don't unexpectedly
              // break older components that still write legacy user keys.
              if (PRESERVE_KEYS.includes(key)) {
                return original.setItem.call(original, key, value);
              }
              return noop();
            },
            removeItem: function(key) {
              if (PRESERVE_KEYS.includes(key)) {
                return original.removeItem.call(original, key);
              }
              return noop();
            },
            clear: function() {
              // Clear everything but restore preserved keys
              const preserved = {};
              PRESERVE_KEYS.forEach((k) => {
                preserved[k] = original.getItem(k);
              });
              noop();
              PRESERVE_KEYS.forEach((k) => {
                if (preserved[k]) original.setItem(k, preserved[k]);
              });
              return undefined;
            }
          }
        });
        // Restore preserved session keys from before the clear so the user stays logged in across reloads
        try {
          // _preserved contains the snapshot we took earlier; restore any keys we saved.
          Object.keys(_preserved).forEach((k) => {
            const v = _preserved[k];
            if (v !== null && typeof v !== 'undefined') {
              try { original.setItem(k, v); } catch (e) { /* ignore per-key failures */ }
            }
          });
        } catch (e) {
          console.warn('Failed to restore preserved auth keys after localStorage shim:', e);
        }
  console.info('localStorage writers disabled (except preserved keys). Reads still allowed.');

        // Best-effort: if we don't have a UI `user` persisted locally, try to recover it
        // from the server using the HttpOnly session cookie (if present).
        (async () => {
          try {
            const existingUser = (() => {
              try { return original.getItem('user') || original.getItem('davaoBlueEaglesUser'); } catch (e) { return null; }
            })();
            if (!existingUser) {
              const resp = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
              });
              if (resp && resp.ok) {
                const data = await resp.json();
                if (data && data.user) {
                  try { original.setItem('user', JSON.stringify(data.user)); } catch (e) {}
                  try { original.setItem('davaoBlueEaglesUser', JSON.stringify(data.user)); } catch (e) {}
                  console.info('Recovered UI user from server session cookie');
                }
              }
            }
          } catch (e) {
            // Non-fatal — best-effort only
          }
        })();
      } catch (e) {
      // If defineProperty fails (some browsers), fallback to monkey-patch functions
      console.warn('Failed to replace localStorage object, falling back to function patching:', e);
      try {
        window.localStorage.setItem = noop;
        window.localStorage.removeItem = noop;
        window.localStorage.clear = noop;
      } catch (e2) {
        console.error('Failed to patch localStorage writers:', e2);
      }
    }
  }
} catch (err) {
  console.error('Error while applying strict localStorage removal shim:', err);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
