import React, { useState, useEffect, useRef } from "react";
import authService from '../services/authService';
import {
  FaUpload,
  FaUser,
  FaEnvelope,
  FaCalendar,
  FaPhone,
  FaMusic,
  FaMapMarkerAlt,
  FaIdCard,
  FaLock,
  FaCheck,
  FaTimes,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import StyledSelect from './StyledSelect';

const Signup = ({ onSignup, onClose, onSwitchToLogin }) => {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    birthday: "",
    phone: "",
    instrument: "",
    address: "",
    identityProof: null,
  });
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [instrumentTypes, setInstrumentTypes] = useState([]);
  const [customInstrument, setCustomInstrument] = useState("");
  const [showCustomInstrument, setShowCustomInstrument] = useState(false);

  // Fetch instrument types on component mount
  useEffect(() => {
    const fetchInstrumentTypes = async () => {
      try {
        console.log('Fetching instrument types...');
  const response = await fetch('http://localhost:5000/api/instruments/types', { credentials: 'include' });
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Instrument types data:', data);
        if (data.success) {
          setInstrumentTypes(data.types);
          console.log('Instrument types set:', data.types);
        }
      } catch (error) {
        console.error('Error fetching instrument types:', error);
      }
    };
    fetchInstrumentTypes();
  }, []);

  const styles = {
    // Use same container / wrapper / formContainer structure as Booking
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    baseFontSize: 16,
    container: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      minHeight: '100vh'
    },
    tableCard: {
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100vw',
      margin: '0',
      padding: '0'
    },
    wrapper: {
      maxWidth: 920,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    },
    formContainer: {
      background: '#ffffff',
      borderRadius: 16,
      padding: '1.75rem',
      border: '1px solid rgba(3, 105, 161, 0.06)',
      boxShadow: '0 8px 24px rgba(2, 6, 23, 0.06)',
      position: 'relative',
      overflow: 'visible',
      fontFamily: 'inherit'
    },

  page: {
    position: "fixed",
    position: "relative",
    display: "block",
    alignItems: "stretch",
    justifyContent: "flex-start",
    background: "linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)",
    padding: "2rem 1rem",
    fontSize: "15px",
    lineHeight: 1.45,
    zIndex: "auto",
    overflow: "auto"
  },
  card: {
      width: "100%",
      maxWidth: 920,
      background: "#ffffff",
      borderRadius: 16,
      padding: "1.75rem", /* match Booking's formContainer padding */
      boxShadow: "0 10px 40px rgba(11, 59, 120, 0.12)",
      color: "#1e293b",
      position: "relative",
      overflow: "visible",
      margin: "40px auto",
      fontFamily: "inherit",
      fontSize: "16px" // match Booking font size
    },
    closeButton: {
      position: "absolute",
      top: 16,
      right: 16,
      background: "transparent",
      border: "none",
      color: "#94a3b8",
      cursor: "pointer",
      padding: 8,
      borderRadius: 8,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "color 0.2s",
      zIndex: 10,
      fontSize: "16px"
    },
    header: {
      textAlign: "center",
      marginBottom: 28,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6
    },
    logoBox: {
      background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
      padding: "18px 32px",
      borderRadius: 12,
      boxShadow: "0 6px 20px rgba(11, 59, 120, 0.25)",
      marginBottom: 4
    },
    logoText: { margin: 0, lineHeight: 1.3 },
    logoTextTop: { fontSize: "20px", fontWeight: 800, color: "#60a5fa", letterSpacing: "0.18em" },
    logoTextBottom: { fontSize: "12px", fontWeight: 700, color: "#ffffff" },

    // title / subtitle (consistent sizes)
    title: {
      fontSize: "40px", // match Booking title size
      fontWeight: 700,
      color: "#0f172a",
      marginBottom: 0,
      letterSpacing: "-0.02em",
      paddingBottom: 8,
      borderBottom: "3px solid #bae6fd",
      display: "block",
      width: "100%",
      textAlign: "center",
      boxSizing: "border-box",
      fontFamily: "inherit"
    },
    subtitle: {
      color: "#475569",
      fontSize: "14px",
      fontWeight: 400,
      lineHeight: 1.25,
      margin: "6px auto 0",         // small top margin so subtitle sits close to the underline
      textAlign: "center",
      fontFamily: "inherit"
    },

    // form fields
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginBottom: 14,
      fontFamily: "inherit",
      fontSize: "15px"
    },
    label: {
      fontSize: "14px",
      color: "#334155",
      fontWeight: 600,
      marginBottom: 4,
      fontFamily: "inherit"
    },
    inputWrapper: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    },
    icon: {
      position: "absolute",
      left: 14,
      color: "#94a3b8",
      fontSize: 16
    },
    iconTop: {
      position: "absolute",
      left: 14,
      top: 12,
      color: "#94a3b8",
      fontSize: 16
    },
    eyeIcon: {
      position: "absolute",
      right: 14,
      color: "#94a3b8",
      fontSize: 16,
      cursor: "pointer",
      padding: 4,
      transition: "color 0.2s"
    },
    input: {
      width: "100%",
      background: "#f8fafc",
      border: "1.5px solid #e2e8f0",
      color: "#1e293b",
      padding: "11px 14px 11px 44px",
      borderRadius: 10,
      fontSize: "16px", // match Booking input baseline
      outline: "none",
      transition: "all 0.2s",
      fontFamily: "inherit"
    },
    textarea: {
      width: "100%",
      background: "#f8fafc",
      border: "1.5px solid #e2e8f0",
      color: "#1e293b",
      padding: "11px 14px 11px 44px",
      borderRadius: 10,
      fontSize: "16px", // match Booking textarea baseline
      outline: "none",
      transition: "all 0.2s",
      fontFamily: "inherit",
      minHeight: "80px",
      resize: "vertical"
    },
    fileInput: {
      width: "100%",
      background: "#f8fafc",
      border: "1.5px solid #e2e8f0",
      color: "#1e293b",
      padding: "11px 14px",
      borderRadius: 10,
      fontSize: "15px",
      outline: "none",
      transition: "all 0.2s",
      fontFamily: "inherit",
      cursor: "pointer"
    },
    err: {
      color: "#dc2626",
      fontSize: "13px",
      marginTop: 6,
      fontWeight: 500,
      fontFamily: "inherit"
    },

    // layout helpers
    grid2: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 16
    },
    grid3: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16
    },

    // buttons / notices
    btnPrimary: {
      width: "100%",
      background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
      color: '#ffffff',
      border: "none",
      padding: "12px 20px",
      borderRadius: 10,
      fontWeight: 600,
      fontSize: "15px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 22,
      transition: "all 0.2s",
      boxShadow: "0 4px 12px rgba(11, 59, 120, 0.2)",
      fontFamily: "inherit"
    },
    linkText: {
      textAlign: "center",
      marginTop: 16,
      fontSize: "14px",
      color: "#64748b",
      fontFamily: "inherit"
    },
    linkButton: {
      background: "transparent",
      border: "none",
      color: "#dc2626",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 600,
      textDecoration: "none",
      padding: 0,
      marginLeft: 4,
      fontFamily: "inherit"
    },
    successBox: {
      marginTop: 16,
      padding: 14,
      borderRadius: 10,
      background: "#f0fdf4",
      border: "1.5px solid #86efac",
      color: "#166534",
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: "15px", // slightly bumped to align with Booking sizing
      fontFamily: "inherit"
    },

    sectionTitle: {
      fontSize: "16px",
      fontWeight: 600,
      color: "#0f172a",
      marginBottom: 12,
      marginTop: 20,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "inherit"
    },
    sectionDivider: {
      height: "1px",
      background: "#e2e8f0",
      margin: "20px 0",
      border: "none"
    },
  };

  

  const validate = (values) => {
    const e = {};
    if (!values.firstName.trim()) e.firstName = "First name required";
    if (!values.lastName.trim()) e.lastName = "Last name required";
    if (!values.email) e.email = "Email required";
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) e.email = "Invalid email";
    if (!values.password) e.password = "Password required";
    else if (values.password.length < 6) e.password = "Password must be at least 6 characters";
    if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!values.birthday) e.birthday = "Date of birth required";
    if (!values.phone.trim()) e.phone = "Contact number required";
    if (!values.instrument.trim()) e.instrument = "Primary instrument/section required";
    if (!values.address.trim()) e.address = "  address required";
    if (!values.identityProof) e.identityProof = "Government ID required for membership verification";
    return e;
  };

  const handleChange = (k, v) => {
    setForm((s) => ({ ...s, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: null }));
    
    // Handle instrument selection
    if (k === 'instrument') {
      if (v === 'Others') {
        setShowCustomInstrument(true);
        setForm((s) => ({ ...s, instrument: customInstrument }));
      } else {
        setShowCustomInstrument(false);
        setCustomInstrument("");
      }
    }
  };

  const handleCustomInstrumentChange = (value) => {
    setCustomInstrument(value);
    setForm((s) => ({ ...s, instrument: value }));
    setErrors((prev) => ({ ...prev, instrument: null }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm((s) => ({ ...s, identityProof: file }));
      setFileName(file.name);
      setErrors((prev) => ({ ...prev, identityProof: null }));
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSuccess(null);
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('firstName', form.firstName);
      formData.append('lastName', form.lastName);
      formData.append('email', form.email);
      formData.append('password', form.password);
      formData.append('birthday', form.birthday);
      formData.append('phone', form.phone);
      formData.append('instrument', form.instrument);
      formData.append('address', form.address);
      if (form.identityProof) {
        formData.append('identityProof', form.identityProof);
      }

      // Debug: Log FormData contents
      console.log('Form data being sent:');
      for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + pair[1]);
      }

      const registerResponse = await authService.register(formData);
      setSuccess("Membership application submitted successfully! We will review your application and contact you via email.");
      
      // Auto-login: The backend already set the JWT cookie and returned user data
      try {
        if (registerResponse && registerResponse.user) {
          // Store user data in localStorage
          const userData = {
            id: registerResponse.user.id,
            email: registerResponse.user.email,
            firstName: registerResponse.user.firstName,
            lastName: registerResponse.user.lastName,
            role: registerResponse.user.role || 'user'
          };
          
          localStorage.setItem('user', JSON.stringify(userData));
          
          // Call onSignup callback to redirect to home
          if (onSignup) {
            onSignup(userData);
          }
        }
      } catch (loginErr) {
        console.warn('Auto-login failed after registration:', loginErr);
      }

      setForm({ 
        firstName: "", 
        lastName: "", 
        email: "", 
        password: "", 
        confirmPassword: "",
        birthday: "",
        phone: "",
        instrument: "",
        address: "",
        identityProof: null
      });
      setFileName("");
    } catch (err) {
      console.error('Registration error:', err);
      setErrors({ submit: err.message || 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <div className="form-container" style={styles.formContainer}>
          <form onSubmit={handleSubmit} noValidate style={{ width: '100%' }}>
             <button 
               type="button" 
               aria-label="Close" 
               onClick={onClose} 
               style={styles.closeButton}
               onMouseEnter={(e) => e.currentTarget.style.color = '#0b4f8a'}
               onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
             >
               <FaTimes size={18} />
             </button>

            
            <div style={styles.header}>
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
              
              <div style={styles.title}>Membership Application</div>
              <div style={styles.subtitle}>Apply to join the Davao Blue Eagles Marching Band</div>
            </div>

            {/* Personal Information */}
            <div style={styles.sectionTitle}>
              Personal Information
            </div>

            <div style={styles.grid2}>
              <div style={styles.field}>
                <label style={styles.label}>First name</label>
                <div style={styles.inputWrapper}>
                  <FaUser style={styles.icon} />
                  <input
                    style={styles.input}
                    value={form.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    placeholder="First name"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0b4f8a';
                      e.target.style.background = '#ffffff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                  />
                </div>
                {errors.firstName && <div style={styles.err}>{errors.firstName}</div>}
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Last name</label>
                <div style={styles.inputWrapper}>
                  <FaUser style={styles.icon} />
                  <input
                    style={styles.input}
                    value={form.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    placeholder="Last name"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0b4f8a';
                      e.target.style.background = '#ffffff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                  />
                </div>
                {errors.lastName && <div style={styles.err}>{errors.lastName}</div>}
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Email address</label>
              <div style={styles.inputWrapper}>
                <FaEnvelope style={styles.icon} />
                <input
                  type="email"
                  style={styles.input}
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter your email address"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0b4f8a';
                    e.target.style.background = '#ffffff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                  }}
                />
              </div>
              {errors.email && <div style={styles.err}>{errors.email}</div>}
            </div>

            <div style={styles.grid2}>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <div style={styles.inputWrapper}>
                  <FaLock style={styles.icon} />
                  <input
                    type={showPassword ? "text" : "password"}
                    style={styles.input}
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="Create a password"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0b4f8a';
                      e.target.style.background = '#ffffff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                  />
                  <div
                    style={styles.eyeIcon}
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#0b4f8a'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </div>
                </div>
                {errors.password && <div style={styles.err}>{errors.password}</div>}
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirm password</label>
                <div style={styles.inputWrapper}>
                  <FaLock style={styles.icon} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    style={styles.input}
                    value={form.confirmPassword}
                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                    placeholder="Confirm your password"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0b4f8a';
                      e.target.style.background = '#ffffff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                  />
                  <div
                    style={styles.eyeIcon}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#0b4f8a'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </div>
                </div>
                {errors.confirmPassword && <div style={styles.err}>{errors.confirmPassword}</div>}
              </div>
            </div>

            <div style={styles.grid3}>
              <div style={styles.field}>
                <label style={styles.label}>Date of Birth</label>
                <div style={styles.inputWrapper}>
                  <FaCalendar style={styles.icon} />
                  <input
                    type="date"
                    style={styles.input}
                    value={form.birthday}
                    onChange={(e) => handleChange("birthday", e.target.value)}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0b4f8a';
                      e.target.style.background = '#ffffff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                  />
                </div>
                {errors.birthday && <div style={styles.err}>{errors.birthday}</div>}
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Contact Number</label>
                <div style={styles.inputWrapper}>
                  <FaPhone style={styles.icon} />
                  <input
                    type="tel"
                    style={styles.input}
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="e.g., 09123456789"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0b4f8a';
                      e.target.style.background = '#ffffff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                  />
                </div>
                {errors.phone && <div style={styles.err}>{errors.phone}</div>}
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Primary Instrument/Section</label>
                <div style={styles.inputWrapper}>
                  <FaMusic style={styles.icon} />
                  <StyledSelect
                    value={showCustomInstrument ? 'Others' : form.instrument}
                    onChange={(e) => handleChange('instrument', e.target.value)}
                    style={{ width: '100%' }}
                    containerStyle={{ width: '100%' }}
                  >
                    <option value="">Select instrument type</option>
                    {instrumentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    <option value="Others">Others</option>
                  </StyledSelect>
                </div>
                {errors.instrument && <div style={styles.err}>{errors.instrument}</div>}
              </div>
            </div>

            {showCustomInstrument && (
              <div style={styles.field}>
                <label style={styles.label}>Specify Instrument Type</label>
                <div style={styles.inputWrapper}>
                  <FaMusic style={styles.icon} />
                  <input
                    style={styles.input}
                    value={customInstrument}
                    onChange={(e) => handleCustomInstrumentChange(e.target.value)}
                    placeholder="e.g., Trumpet, Flute, Drums, Color Guard"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0b4f8a';
                      e.target.style.background = '#ffffff';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.background = '#f8fafc';
                    }}
                  />
                </div>
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Complete Address</label>
              <div style={{ ...styles.inputWrapper, alignItems: "flex-start" }}>
                <FaMapMarkerAlt style={styles.iconTop} />
                <textarea
                  style={styles.textarea}
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Street, Barangay, City, Province"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0b4f8a';
                    e.target.style.background = '#ffffff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                  }}
                />
              </div>
              {errors.address && <div style={styles.err}>{errors.address}</div>}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Valid Government ID (Required for Membership)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                style={styles.fileInput}
              />
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                Upload a clear photo or scan of your government-issued ID (Driver's License, SSS ID, Passport, etc.)
              </div>
              {fileName && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Selected: {fileName}
                </div>
              )}
              {errors.identityProof && <div style={styles.err}>{errors.identityProof}</div>}
            </div>

            <div style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 10,
              padding: 16,
              marginTop: 20,
              fontSize: 12,
              color: "#0c4a6e",
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <FaIdCard />
                Membership Application Notice
              </div>
              <div>
                By submitting this application, you agree to provide accurate information and understand that:
                <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                  <li>All information will be verified during the review process</li>
                  <li>Your application will be reviewed by the band management</li>
                  <li>You may be contacted for an audition or interview</li>
                  <li>Membership is subject to availability and band requirements</li>
                </ul>
              </div>
            </div>

            <button 
              type="submit" 
              style={styles.btnPrimary} 
              disabled={submitting}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(11, 59, 120, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!submitting) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 59, 120, 0.2)';
                }
              }}
            >
              {submitting ? "Submitting Application..." : "Submit Membership Application"}
            </button>

            <div style={styles.linkText}>
              Already a member?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={styles.linkButton}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Sign in to your account
              </button>
            </div>

            {success && (
              <div style={styles.successBox}>
                <FaCheck color="#16a34a" />
                <div>{success}</div>
              </div>
            )}
            {errors.submit && <div style={{ ...styles.err, marginTop: 12, textAlign: 'center' }}>{errors.submit}</div>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;

