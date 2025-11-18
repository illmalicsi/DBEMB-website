import React, { useState, useEffect, useRef } from 'react';
import { FaEnvelope, FaLock, FaTimes, FaEye, FaEyeSlash, FaGoogle } from '../icons/fa';
import authService from '../services/authService'; // Use real backend auth service
import loginImg from "./Assets/dbemb_login_signup.jpg"; // <- adjust relative path to match locate result

const sharedStyles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
    padding: 32,                // slightly more breathing room
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  // base font used across form (title & subtitle keep their sizes)
  baseFontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  baseFontSize: 15,
  // card now split into left image panel and right form panel
  card: {
    width: '100%',
    maxWidth: 980,             // a bit bigger than before
    background: '#ffffff',
    borderRadius: 16,
    padding: 0,
    boxShadow: '0 10px 36px rgba(11, 59, 120, 0.09)',
    color: '#1e293b',
    position: 'relative',
    display: 'flex',
    overflow: 'hidden',
    minHeight: 580             // increased height modestly
  },
  imagePanel: {
    width: '49%',
    minWidth: 360,             // ensure image panel scales slightly larger
    backgroundImage: `url(${loginImg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    color: '#ffffff'
  },
  imageOverlayText: {
    background: 'rgba(0,0,0,0.32)',
    padding: '18px',
    borderRadius: 12,
    textAlign: 'center',
    maxWidth: 320
  },
  formPanel: {
    width: '51%',
    padding: '52px 44px',      // slightly larger inner padding
    boxSizing: 'border-box'
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s'
  },
  header: { 
    textAlign: 'center', 
    marginBottom: 32
  },
  title: { 
    fontSize: 40, 
    fontWeight: 700, 
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: '-0.02em'
  },
  subtitle: { 
    color: '#64748b', 
    fontSize: 15,
    fontWeight: 400
  },
  // consistent form typography (except title/subtitle)
  form: { display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, -apple-system, sans-serif', fontSize: 15 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { 
    fontSize: 15, 
    color: '#334155', 
    fontWeight: 600,
    marginBottom: 4,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  icon: { 
    position: 'absolute', 
    left: 14, 
    color: '#94a3b8',
    fontSize: 16
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    color: '#94a3b8',
    fontSize: 16,
    cursor: 'pointer',
    padding: 4,
    transition: 'color 0.2s'
  },
  input: {
    width: '100%',
    padding: '13px 14px 13px 44px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#1e293b',
    fontSize: 15,
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  linkRow: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: -8,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: 15
  },
  rememberMe: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 15,
    color: '#334155',
    cursor: 'pointer',
    userSelect: 'none',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  forgotLink: {
    fontSize: 15,
    color: '#dc2626',
    cursor: 'pointer',
    fontWeight: 500,
    textDecoration: 'none',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  btnPrimary: {
    width: '100%',
    marginTop: 8,
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    border: 'none',
    color: 'white',
    padding: '14px 20px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(11, 59, 120, 0.2)'
  },
  linkText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
    color: '#64748b',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  linkAction: { 
    color: '#dc2626', 
    cursor: 'pointer', 
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: 14,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  error: { 
    color: '#dc2626', 
    textAlign: 'center', 
    marginBottom: 16,
    fontSize: 15,
    fontWeight: 500,
    background: '#fef2f2',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid #fecaca',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
};

const Login = ({ onBack, onLogin, onSwitchToSignup, onSwitchToForgotPassword, error, onClearError }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const googleButtonRef = useRef(null);
  const [gsiAvailable, setGsiAvailable] = useState(false);

  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    let scriptTag;
      const initGSI = () => {
      try {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) return;

        // Initialize once
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp) => {
            try {
              const idToken = resp.credential;
              if (!idToken) throw new Error('Missing Google credential');
              setIsLoading(true);
              const data = await authService.googleSignIn(idToken);
              if (data && data.user && onLogin) onLogin(data.user);
            } catch (e) {
              console.error('Google sign-in callback error:', e);
              setLoginError(e.message || 'Google sign-in failed');
            } finally {
              setIsLoading(false);
            }
          }
        });

        // Render the Google button into our container
        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            width: '100%'
          });
          // Indicate that GIS rendered the button / is available
          setGsiAvailable(true);
        }
      } catch (err) {
        console.error('GSI init error:', err);
      }
    };

    // If client id missing, nothing to load
    if (!GOOGLE_CLIENT_ID) {
      console.warn('REACT_APP_GOOGLE_CLIENT_ID not set; Google Sign-In will be disabled');
      return;
    }

    // If script already present, try init immediately
    if (window.google && window.google.accounts && window.google.accounts.id) {
      initGSI();
      return;
    }

    // Dynamically load the Google Identity Services script
    scriptTag = document.createElement('script');
    scriptTag.src = 'https://accounts.google.com/gsi/client';
    scriptTag.async = true;
    scriptTag.defer = true;
    scriptTag.onload = initGSI;
    scriptTag.onerror = () => console.error('Failed to load Google Identity Services script');
    document.body.appendChild(scriptTag);

    return () => {
      if (scriptTag && scriptTag.parentNode) scriptTag.parentNode.removeChild(scriptTag);
    };
  }, [GOOGLE_CLIENT_ID, onLogin]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear errors when user starts typing
    if (error && onClearError) onClearError();
    if (loginError) setLoginError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');

    try {
      console.log('Login component - Attempting login...');
      const response = await authService.login(formData.email, formData.password);
      console.log('Login component - Response received:', response);
      
      if (response.success && onLogin) {
        console.log('Login component - Calling onLogin with user:', response.user);
        // Pass user data to parent component
        onLogin(response.user);
      } else {
        console.log('Login component - Login not successful or no onLogin callback');
        setLoginError('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login component - Error caught:', error);
      setLoginError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={sharedStyles.page}>
      <div style={sharedStyles.card}>
        {/* Form Panel - LEFT side */}
        <div style={sharedStyles.formPanel}>
          <button
            style={sharedStyles.close}
            onClick={onBack}
            title="Close"
            onMouseEnter={(e) => e.currentTarget.style.color = '#0b4f8a'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <FaTimes size={18} />
          </button>

          <div style={sharedStyles.header}>
            {/* Logo */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
              <img 
                src="/logo.png" 
                alt="Davao Blue Eagles" 
                style={{ 
                  height: '80px', 
                  width: 'auto',
                  objectFit: 'contain'
                }} 
              />
            </div>
            
            <div style={sharedStyles.title}>Login</div>
            <div style={sharedStyles.subtitle}>Welcome back! Please enter your details</div>
          </div>

          {(error || loginError) && (
            <div style={sharedStyles.error}>{error || loginError}</div>
          )}

          <form style={sharedStyles.form} onSubmit={handleSubmit} noValidate>
            <div style={sharedStyles.field}>
              <div style={sharedStyles.inputWrapper}>
                <FaEnvelope style={sharedStyles.icon} />
                <input
                  name="email"
                  type="email"
                  placeholder="Email or Username"
                  aria-label="Email or Username"
                  value={formData.email}
                  onChange={handleInputChange}
                  style={sharedStyles.input}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0b4f8a';
                    e.target.style.background = '#ffffff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                  }}
                  required
                />
              </div>
            </div>

            <div style={sharedStyles.field}>
              <div style={sharedStyles.inputWrapper}>
                <FaLock style={sharedStyles.icon} />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  aria-label="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  style={sharedStyles.input}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0b4f8a';
                    e.target.style.background = '#ffffff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                  }}
                  required
                />
                <div
                  style={sharedStyles.eyeIcon}
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#0b4f8a'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </div>
              </div>
            </div>

            {/* remember checkbox above button */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: -8 }}>
              <label style={sharedStyles.rememberMe}>
                <input type="checkbox" /> Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                ...sharedStyles.btnPrimary,
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            {/* actions below sign-in button */}
            <div style={{ textAlign: 'center', marginTop: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => { 
                  if (onSwitchToForgotPassword) {
                    onSwitchToForgotPassword();
                  } else {
                    window.location.href = '/forgot-password';
                  }
                }}
                style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                Forgot password?
              </button>

              <div style={{ color: '#64748b', fontSize: 14 }}>
                Don't have an account?{' '}
                <span
                  style={sharedStyles.linkAction}
                  onClick={() => { if (onSwitchToSignup) onSwitchToSignup(); else window.location.href = '/signup'; }}
                >
                  Sign up now
                </span>
              </div>
            </div>
          </form>

          <div style={{ marginTop: 18 }}>
            <div ref={googleButtonRef} />
            {!gsiAvailable && (
              <button
                onClick={() => {
                  setLoginError('');
                  if (window.google && window.google.accounts && window.google.accounts.id) {
                    try { window.google.accounts.id.prompt(); } catch (e) { setLoginError('Unable to open Google sign-in.'); }
                  } else { setLoginError('Google sign-in is not available.'); }
                }}
                disabled={isLoading}
                style={{
                  ...sharedStyles.btnPrimary,
                  background: '#ffffff',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  justifyContent: 'center',
                  border: '1px solid #e2e8f0'
                }}
              >
                <FaGoogle style={{ color: '#de5246' }} />
                {isLoading ? 'Please wait...' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>
        
        {/* Image Panel - RIGHT side */}
        <div style={sharedStyles.imagePanel}>
          {/* overlay text removed */}
        </div>
      </div>
    </div>
  );
};

export default Login;