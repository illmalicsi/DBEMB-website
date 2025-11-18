import React, { useState, useEffect, useRef } from "react";
import { FaFacebookF, FaInstagram, FaYoutube, FaEnvelope, FaMapMarkerAlt, FaPhoneAlt, FaClock, FaUser, FaMusic, FaCreditCard, FaMobileAlt, FaUniversity, FaStore, FaWallet, FaFileInvoiceDollar, FaCheckCircle, FaSpinner, FaCalendarAlt, FaFileAlt, FaFlag, FaChalkboardTeacher, FaGuitar, FaArrowUp, FaChevronDown, FaBars, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import bg2 from "./Assets/bg2.jpg";
import background1 from "./Assets/background1.jpg";
import background2 from "./Assets/background2jpg.jpg";
import background3 from "./Assets/background3.jpg";
import bandGigs from "./Assets/bandGigs.jpg";
import musicArrangement from "./Assets/music-arrangement.jpg";
import paradeEvents from "./Assets/paradeEvents.jpg";
import musicWorkshop from "./Assets/musicWorkshop.jpg";
import instrumentRentals from "./Assets/instrumentRentals.jpg";
import Login from './login'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'
import MemberSignup from './MemberSignup'
import UserSignup from './UserSignup'
import Dashboard from './dashboard'
import InstrumentRental from './InstrumentRental'
import PendingBookings from './PendingBookings'
import NotificationService from '../services/notificationService'
import Notifications from './Notifications'
import AuthService from '../services/authService'
import TestPaymentGateway from './TestPaymentGateway'
import CustomerService from './CustomerService'

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  position: 'relative',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
};

const Home = () => {
  const navigate = useNavigate();

  // Mobile responsiveness - track window width
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Hero background images array
  const heroBackgrounds = [bg2, background1, background2, background3];
  
  // Hero background slider state
  const [heroBackgroundIndex, setHeroBackgroundIndex] = useState(0);

  const navStyle = {
    background: 'linear-gradient(180deg, #0b3b78 0%, #0b4f8a 100%)',
    color: '#fff',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    padding: windowWidth <= 768 ? '12px 20px' : '14px 30px',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'grid',
    gridTemplateColumns: windowWidth <= 768 ? '1fr auto' : 'auto 1fr auto',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 6px 18px rgba(7, 24, 48, 0.14)',
    transition: 'background 220ms ease, box-shadow 220ms ease'
  };

  const logoStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginLeft: windowWidth <= 768 ? '0' : '8px'
  };

  const logoMainStyle = {
    fontFamily: 'Georgia, Times, "Times New Roman", serif',
    fontSize: windowWidth <= 768 ? '20px' : '28px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '0.02em'
  };

  const logoSubStyle = {
    fontSize: windowWidth <= 768 ? '10px' : '12px',
    color: '#ffffff',
    margin: 0,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  };

  const ulStyle = {
    display: windowWidth <= 768 ? 'none' : 'flex',
    alignItems: 'center',
    gap: '32px',
    margin: 0,
    padding: 0,
    listStyle: 'none'
  };

  const linkStyle = {
    color: 'rgba(240, 248, 255, 0.95)',
    fontWeight: '600',
    fontSize: '15px',
    textDecoration: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    position: 'relative',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
  };

  const buttonContainerStyle = {
    display: windowWidth <= 768 ? 'none' : 'flex',
    gap: '12px'
  };

  const loginButtonStyle = {
    background: 'transparent',
    border: '2px solid rgba(255,255,255,0.14)',
    color: 'rgba(240,248,255,0.95)',
    padding: '10px 24px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    textDecoration: 'none',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    letterSpacing: '0.01em'
  };

  const signUpButtonStyle = {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.95) 0%, rgba(29,78,216,0.95) 100%)',
    border: 'none',
    color: 'white',
    padding: '12px 28px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '14px',
    letterSpacing: '0.01em',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    textDecoration: 'none',
    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.2)',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    position: 'relative',
    overflow: 'hidden'
  };

  const handleMouseEnter = (e) => {
    const t = e.currentTarget || e.target;
    t.style.color = '#60a5fa';
  };

  const handleMouseLeave = (e) => {
    const t = e.currentTarget || e.target;
    const hash = t.getAttribute('href');
    if (hash === activeHash) {
      t.style.color = '#60a5fa';
    } else {
      t.style.color = 'rgba(240, 248, 255, 0.95)';
    }
  };

  const handleLoginHover = (e) => {
    e.target.style.background = '#3b82f6';
    e.target.style.color = 'white';
    e.target.style.transform = 'translateY(-2px)';
    e.target.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.3)';
  };

  const handleLoginLeave = (e) => {
    e.target.style.background = 'transparent';
    e.target.style.color = '#3b82f6';
    e.target.style.transform = 'translateY(0)';
    e.target.style.boxShadow = 'none';
  };

  const handleSignupHover = (e) => {
    e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)';
    e.target.style.transform = 'translateY(-2px) scale(1.02)';
    e.target.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.3)';
  };

  const handleSignupLeave = (e) => {
    e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    e.target.style.transform = 'translateY(0) scale(1)';
    e.target.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.2)';
  };

  // Hero styles
  const heroSectionStyle = {
    flex: '1 0 auto',
    minHeight: windowWidth <= 768 ? '80vh' : '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    scrollMarginTop: '80px',
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1
  };

  const heroContentStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    maxWidth: windowWidth <= 768 ? '100%' : '1000px',
    width: '100%',
    padding: windowWidth <= 768 ? '40px 20px' : '60px 40px',
    position: 'relative',
    zIndex: 10,
    minHeight: windowWidth <= 768 ? '60vh' : '80vh',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
  };

  const taglineStyle = {
    fontFamily: 'Georgia, Times, "Times New Roman", serif',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    fontSize: windowWidth <= 768 ? 'clamp(24px, 8vw, 36px)' : 'clamp(28px, 5vw, 56px)',
    lineHeight: 1.1,
    margin: '0 0 24px 0',
    textTransform: 'none',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 20%, #e2e8f0 40%, #cbd5e1 60%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textShadow: '0 0 40px rgba(255, 255, 255, 0.1)',
    animation: 'heroTextReveal 2s ease-out forwards',
    position: 'relative',
    whiteSpace: windowWidth <= 768 ? 'normal' : 'nowrap'
  };

  const translationStyle = {
    fontFamily: 'Georgia, Times, "Times New Roman", serif',
    color: '#fbbf24',
    fontSize: windowWidth <= 768 ? 'clamp(16px, 5vw, 24px)' : 'clamp(20px, 3vw, 32px)',
    fontWeight: 400,
    marginBottom: windowWidth <= 768 ? '32px' : '48px',
    lineHeight: '1.3',
    letterSpacing: '0.01em',
    opacity: 0,
    animation: 'fadeInUp 1.4s ease-out 0.8s forwards',
    fontStyle: 'italic'
  };

  const heroButtonContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: windowWidth <= 768 ? '20px' : '30px',
    opacity: 0,
    animation: 'fadeInScale 1.5s ease-out 1.2s forwards'
  };

  const heroFeatureGridStyle = {
    display: 'grid',
    gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
    gap: windowWidth <= 768 ? '20px' : '40px',
    marginTop: windowWidth <= 768 ? '40px' : '60px',
    maxWidth: windowWidth <= 768 ? '100%' : '600px',
    width: '100%',
    opacity: 0,
    animation: 'slideInFromBottom 1.5s ease-out 1.5s forwards'
  };

  // Services styles
  const servicesSectionStyle = {
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    padding: windowWidth <= 768 ? '60px 16px' : '80px 24px 88px',
    minHeight: windowWidth <= 768 ? 'auto' : 'calc(100vh - 64px)',
    scrollMarginTop: '80px',
    position: 'relative',
    zIndex: 2
  };

  // About/Contact styles
  const aboutSectionStyle = {
    background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
    padding: windowWidth <= 768 ? '60px 16px' : '80px 24px',
    scrollMarginTop: '80px',
    position: 'relative',
    zIndex: 2
  };

const aboutHeaderStyle = {
  background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 700,
  fontSize: windowWidth <= 768 ? '36px' : '67px',
  lineHeight: 1.0,
  margin: '0 0 16px 0',
  letterSpacing: '-0.02em',
  textAlign: 'center'
};

  const aboutSubtextStyle = {
    color: '#6b7280',
    fontSize: windowWidth <= 768 ? '14px' : '16px',
    fontWeight: '500',
    maxWidth: '780px',
    textAlign: 'center',
    margin: '0 auto',
    lineHeight: '1.6'
  };

  // About side-by-side layout
const aboutWrapStyle = {
  display: 'grid',
  gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)',
  gap: windowWidth <= 768 ? '20px' : '24px',
  alignItems: 'stretch',
  marginBottom: windowWidth <= 768 ? '20px' : '28px'
};

  const aboutTextCardStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '24px',
    padding: windowWidth <= 768 ? '20px' : '32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
  };

  const aboutStoryParagraphStyle = {
    color: '#374151',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    textAlign: 'justify',
    lineHeight: 1.8,
    margin: '0 0 16px 0',
    fontSize: windowWidth <= 768 ? '15px' : '18px',
    fontWeight: '400'
  };

  // Carousel styles
const carouselWrapperStyle = {
  position: 'relative',
  width: '100%',
  maxWidth: '980px',
  margin: '0 auto 32px',
  borderRadius: '24px',
  overflow: 'hidden',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2) inset',
  height: '100%'
};

const carouselImageStyle = {
  height: '100%',
  minHeight: '400px',
  backgroundSize: 'cover',
  backgroundPosition: 'center'
};

  const carouselControlsStyle = {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 8px',
    transform: 'translateY(-50%)'
  };

  const navButtonStyle = {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    color: '#1e40af',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
  };

  const dotsStyle = {
    position: 'absolute',
    bottom: '10px',
    left: 0,
    right: 0,
    display: 'flex',
    gap: '8px',
    justifyContent: 'center'
  };

  const dotStyle = (active) => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: active ? '#1e40af' : 'rgba(255, 255, 255, 0.6)',
    border: active ? '2px solid #06b6d4' : '2px solid rgba(255, 255, 255, 0.8)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer'
  });

  // Story styles
  const storyCardStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '24px',
    padding: '32px',
    color: '#374151',
    margin: '0 auto 32px',
    maxWidth: '980px',
    lineHeight: 1.8,
    fontSize: '18px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
  };

  const contactSectionStyle = {
    background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
    padding: '80px 24px',
    scrollMarginTop: '80px',
    position: 'relative'
  };

  // Contact section styles

  const contactHeaderStyle = {
  background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  fontWeight: 700,
  fontSize: windowWidth <= 768 ? '36px' : '67px',
  lineHeight: 1.0,
  margin: '0 0 16px 0',
  letterSpacing: '-0.02em',
  textAlign: 'center'
};

  const contactGridStyle = {
    display: 'grid',
    gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'minmax(0, 2fr) minmax(0, 3fr)',
    gap: windowWidth <= 768 ? '20px' : '32px',
    marginBottom: windowWidth <= 768 ? '32px' : '48px'
  };

  const contactInfoCardStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '24px',
    padding: windowWidth <= 768 ? '24px' : '40px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
  };

  const contactFormCardStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '24px',
    padding: windowWidth <= 768 ? '24px' : '40px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
  };

  const contactCardTitleStyle = {
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: windowWidth <= 768 ? '20px' : '24px',
    fontWeight: 600,
    margin: '0 0 32px 0',
    letterSpacing: '0.04em',
    textAlign: 'center'
  };

  const contactInfoListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const contactInfoItemStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px'
  };

  const contactIconStyle = {
    fontSize: windowWidth <= 768 ? '20px' : '24px',
    width: windowWidth <= 768 ? '40px' : '48px',
    height: windowWidth <= 768 ? '40px' : '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    borderRadius: '12px',
    flexShrink: 0,
    color: 'white',
    boxShadow: '0 4px 16px rgba(30, 64, 175, 0.3)'
  };

  const contactLabelStyle = {
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 4px 0',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textAlign: 'left'
  };

  const contactValueStyle = {
    color: '#374151',
    fontSize: windowWidth <= 768 ? '14px' : '16px',
    fontWeight: '500',
    margin: 0,
    lineHeight: 1.5
  };

  const contactFormStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const formRowStyle = {
    display: 'grid',
    gridTemplateColumns: windowWidth <= 768 ? '1fr' : '1fr 1fr',
    gap: '16px'
  };

  const formFieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  const formLabelStyle = {
    background: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.04em'
  };

  const formInputStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '12px',
    padding: windowWidth <= 768 ? '12px 16px' : '14px 18px',
    color: '#374151',
    fontSize: windowWidth <= 768 ? '14px' : '16px',
    fontWeight: '500',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
    ':focus': {
      borderColor: '#1e40af',
      boxShadow: '0 0 0 4px rgba(30, 64, 175, 0.1)'
    },
    ':hover': {
      borderColor: 'rgba(30, 64, 175, 0.5)'
    }
  };

  const formTextareaStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '12px',
    padding: '14px 18px',
    color: '#374151',
    fontSize: '16px',
    fontWeight: '500',
    resize: 'vertical',
    minHeight: '140px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    fontFamily: 'inherit',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
    ':focus': {
      borderColor: '#1e40af',
      boxShadow: '0 0 0 4px rgba(30, 64, 175, 0.1)'
    },
    ':hover': {
      borderColor: 'rgba(30, 64, 175, 0.5)'
    }
  };

  const submitButtonStyle = {
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    border: 'none',
    color: 'white',
    padding: '16px 32px',
    borderRadius: '12px',
    fontWeight: 600,
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    marginTop: '12px',
    boxShadow: '0 4px 16px rgba(30, 64, 175, 0.3)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 24px rgba(30, 64, 175, 0.4)'
    }
  };

  const additionalInfoStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '24px'
  };

  const infoCardStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '20px',
    padding: '32px',
    textAlign: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    ':hover': {
      transform: 'translateY(-8px)',
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.3) inset'
    }
  };

  const infoCardTitleStyle = {
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 16px 0',
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  };

  const infoCardTextStyle = {
    color: '#6b7280',
    fontSize: '15px',
    fontWeight: '500',
    lineHeight: 1.6,
    margin: 0
  };

  // Footer styles
  const footerStyle = {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.3)',
    padding: '0'
  };

  const footerContainerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: windowWidth <= 768 ? '0 16px' : '0 24px'
  };

const footerMainStyle = {
  display: 'grid',
  gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'minmax(0, 2fr) minmax(0, 3fr)',
  gap: windowWidth <= 768 ? '32px' : '48px',
  padding: windowWidth <= 768 ? '48px 0 32px 0' : '64px 0 48px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
  alignItems: 'start'
};

  const rightColumnsStyle = {
  display: 'grid',
  gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: windowWidth <= 768 ? '24px' : '32px'
};

  const footerBrandStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const footerLogoStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  };

  const footerLogoTitleStyle = {
    fontFamily: 'Marcellus, serif',
    fontSize: '28px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0
  };

  const footerLogoSubtitleStyle = {
    fontSize: '16px',
    background: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '0.1em'
  };

  const footerDescriptionStyle = {
    color: '#6b7280',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '16px',
    fontWeight: '500',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: '300px',
    textAlign: 'left',
    textAlignLast: 'left'
  };

  const footerSocialStyle = {
    display: 'flex',
    gap: '16px'
  };

  const socialLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    backgroundColor: 'rgba(100, 255, 218, 0.1)',
    border: '1px solid rgba(100, 255, 218, 0.2)',
    borderRadius: '8px',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'rgba(100, 255, 218, 0.2)',
      borderColor: 'rgba(100, 255, 218, 0.4)',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(100, 255, 218, 0.2)'
    }
  };

  const socialIconStyle = {
    fontSize: '20px',
    color: '#60a5fa'
  };

  const footerSectionStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const footerSectionTitleStyle = {
    background: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    letterSpacing: '0.04em'
  };

  const footerLinkListStyle = {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };

  const footerLinkStyle = {
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    ':hover': {
      color: '#1e40af',
      transform: 'translateX(4px)'
    }
  };

  const footerContactListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  };

  const footerContactItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  };

  const footerContactIconStyle = {
    fontSize: '18px',
    width: '20px',
    flexShrink: 0,
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  };

  const footerContactTextStyle = {
    color: '#6b7280',
    fontSize: '15px',
    fontWeight: '500',
    lineHeight: 1.4
  };

  const footerBottomStyle = {         
    padding: windowWidth <= 768 ? '12px 0' : '10px 0',
    marginTop: '0',
     borderTop: '1px solid #9ca3af'
  };

  const footerBottomContentStyle = {
    display: windowWidth <= 768 ? 'flex' : 'grid',
    gridTemplateColumns: windowWidth <= 768 ? '1fr' : 'repeat(5, minmax(0, 1fr))',
    gap: windowWidth <= 768 ? '8px' : '16px',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: windowWidth <= 768 ? '8px 16px' : '12px 24px',
    color: '#6b7280',
  };

  const footerCopyrightStyle = {
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: 500,
    margin: 0,
    letterSpacing: '0.025em'
  };

  const footerBottomLinksStyle = {
    display: 'flex',
    gap: '20px',
    alignItems: 'center'
  };

  const footerBottomLinkStyle = {
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.025em',
    transition: 'all 0.18s ease',
    cursor: 'pointer'
  };

  const servicesContainerStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: windowWidth <= 768 ? '0 16px' : '0 24px'
  };

const sectionEyebrowStyle = {
  background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  textTransform: 'uppercase',
  letterSpacing: '0.25em',
  fontSize: windowWidth <= 768 ? '12px' : '15px',
  marginBottom: '16px',
  textAlign: 'center',
  fontWeight: 700,
};

const servicesHeaderWrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  marginBottom: windowWidth <= 768 ? '20px' : '28px'
};


  const servicesHeaderStyle = {
    background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 50%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 800,
    fontSize: windowWidth <= 768 ? '36px' : '67px',
    lineHeight: 1.1,
    margin: '0 0 8px 0',
    letterSpacing: '-0.025em',
    textAlign: 'center'
  };

  const servicesHeaderActionsStyle = {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  };

  const linkButtonStyle = {
    background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '14px',
    letterSpacing: '0.02em',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  // Updated 5-column grid layout
  const servicesGridStyle = {
    display: 'grid',
    gridTemplateColumns: windowWidth <= 768 ? '1fr' : 
                         windowWidth <= 992 ? 'repeat(2, minmax(0, 1fr))' :
                         windowWidth <= 1200 ? 'repeat(3, minmax(0, 1fr))' :
                         windowWidth <= 1400 ? 'repeat(4, minmax(0, 1fr))' : 
                         'repeat(5, minmax(0, 1fr))',
    gap: windowWidth <= 768 ? '16px' : '24px',
    alignItems: 'stretch'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '20px',
    overflow: 'hidden',
    color: '#1f2937',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '340px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-8px)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }
  };

  const cardImageStyle = {
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'grayscale(0.3) contrast(1.05)'
  };

  const cardBodyStyle = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '12px'
  };

  const cardTitleStyle = {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '16px',
    fontWeight: 700,
    letterSpacing: '0.025em',
    textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #1e40af, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: 0
  };

  const cardBottomPillStyle = {
    alignSelf: 'flex-start',
    marginTop: '12px',
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: '#1f2937',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.025em'
  };

  const cardArrowButtonStyle = {
    position: 'absolute',
    right: '12px',
    bottom: '12px',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    color: 'white',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3)',
    ':hover': {
      transform: 'scale(1.1)',
      boxShadow: '0 8px 20px rgba(107, 114, 128, 0.4)'
    }
  };

  const readMoreStyle = {
    background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
    marginTop: 'auto',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    letterSpacing: '0.025em'
  };

  const readMoreTextStyle = {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: 500,
    letterSpacing: '0.025em'
  };

  const responsiveGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '20px'
  };

  // Modal styles
  const modalOverlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  };

  const modalContentStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '20px',
    width: 'min(720px, 92vw)',
    maxHeight: '80vh',
    overflowY: 'auto',
    color: '#1f2937',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
  };

  const modalHeaderStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(100,255,218,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const modalTitleStyle = {
    margin: 0,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    background: 'linear-gradient(135deg, #1e40af, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  };

  const modalBodyStyle = {
    padding: '20px'
  };

  const modalActionsStyle = {
    display: 'flex',
    gap: '12px',
    padding: '0 20px 20px 20px'
  };

  const closeButtonStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#6b7280',
    padding: '10px 18px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': {
      background: 'rgba(255, 255, 255, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }
  };

  const bookButtonStyle = {
    background: 'linear-gradient(135deg, #1e40af, #06b6d4)',
    border: 'none',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    letterSpacing: '0.025em',
    textDecoration: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 20px rgba(30, 64, 175, 0.4)'
    }
  };

  // Booking UI helpers
  const sectionTitleStyle = {
    background: 'linear-gradient(135deg, #1e40af, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '18px',
    fontWeight: 700,
    margin: '8px 0 6px 0',
    letterSpacing: '-0.025em'
  };

  const helperTextStyle = {
    color: '#6b7280',
    fontSize: '14px',
    margin: '2px 0 8px 0',
    lineHeight: 1.5
  };

  const labelSmallStyle = {
    color: '#374151',
    fontSize: '14px',
    fontWeight: 600,
    display: 'block',
    marginBottom: '6px',
    letterSpacing: '0.025em'
  };

  const statusBadgeStyle = (status) => {
    const palette = {
      pending: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' },
      confirmed: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.35)', color: '#22c55e' },
      cancelled: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', color: '#ef4444' }
    };
    const p = palette[status] || palette.pending;
    return {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '999px',
      backgroundColor: p.bg,
      border: `1px solid ${p.border}`,
      color: p.color,
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    };
  };

  const timeChipStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 500
  };

  // Dark theme booking modal (matching site theme)
  const darkLabelStyle = {
    color: '#374151',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '8px',
    display: 'block',
    letterSpacing: '0.025em'
  };

  const darkInputStyle = {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#1f2937',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    ':focus': {
      border: '1px solid rgba(6, 182, 212, 0.5)',
      background: 'rgba(255, 255, 255, 0.15)'
    }
  };

  const darkTextareaStyle = {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#1f2937',
    fontSize: '15px',
    outline: 'none',
    minHeight: '120px',
    resize: 'vertical',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    ':focus': {
      border: '1px solid rgba(6, 182, 212, 0.5)',
      background: 'rgba(255, 255, 255, 0.15)'
    }
  };

  const bookingModalContentStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '24px',
    width: 'min(1100px, 94vw)',
    maxHeight: '92vh',
    overflowY: 'auto',
    color: '#1f2937',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
  };

  const bookingHeaderStyle = {
    padding: '18px 22px',
    borderBottom: '1px solid rgba(100,255,218,0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 1
  };

  const bookingTitleStyle = {
    margin: 0,
    fontSize: '24px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    letterSpacing: '-0.025em',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #1e40af, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  };

  const bookingBodyStyle = {
    padding: '22px',
    display: 'grid',
    gap: '18px'
  };

  const bookingSectionStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '16px',
    padding: '20px'
  };

  const bookingSectionTitleStyle = {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #374151, #1f2937)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '12px',
    letterSpacing: '0.025em'
  };

  const gridTwoStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px'
  };

  const gridThreeStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '14px'
  };

  const primaryButtonDarkStyle = {
    background: 'linear-gradient(135deg, #1e40af, #06b6d4)',
    border: 'none',
    color: 'white',
    padding: '14px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '15px',
    letterSpacing: '0.025em',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 20px rgba(30, 64, 175, 0.4)'
    }
  };

  // Services data
  const [modalService, setModalService] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [servicesSlide, setServicesSlide] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const cardWidthPercent = 100 / (visibleCount || 1);
  const carouselRef = useRef(null);
  // Helpers for infinite carousel scrolling (uses duplicated items in the DOM)
  const scrollStep = 300;
  const scrollNext = () => {
    const el = carouselRef.current;
    if (!el) return;
    const half = el.scrollWidth / 2;
    // smooth scroll then wrap if we've passed the half point
    try {
      el.scrollBy({ left: scrollStep, behavior: 'smooth' });
    } catch (err) {
      el.scrollLeft += scrollStep;
    }
    // after the smooth scroll completes (approx), correct position if needed
    setTimeout(() => {
      if (el.scrollLeft >= half) {
        el.scrollLeft = el.scrollLeft - half;
      }
    }, 320);
  };

  const scrollPrev = () => {
    const el = carouselRef.current;
    if (!el) return;
    const half = el.scrollWidth / 2;
    try {
      el.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    } catch (err) {
      el.scrollLeft -= scrollStep;
    }
    setTimeout(() => {
      if (el.scrollLeft <= 0) {
        el.scrollLeft = el.scrollLeft + half;
      }
    }, 320);
  };
  // Auto-scroll control for continuous scrolling while mouse/touch is held
  const autoScrollRef = useRef(null);
  const startAutoScroll = (dir) => {
    // dir: 'next' | 'prev'
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    // trigger immediately then repeat
    if (dir === 'next') scrollNext(); else scrollPrev();
    autoScrollRef.current = setInterval(() => {
      if (dir === 'next') scrollNext(); else scrollPrev();
    }, 150);
  };
  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };
  // Ensure auto-scroll stops when pointer/touch ends anywhere on the page
  useEffect(() => {
    const endHandler = () => stopAutoScroll();
    window.addEventListener('mouseup', endHandler);
    window.addEventListener('touchend', endHandler);
    return () => {
      window.removeEventListener('mouseup', endHandler);
      window.removeEventListener('touchend', endHandler);
    };
  }, []);
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeHash, setActiveHash] = useState('#home');

  // Mobile menu styles (must be after mobileOpen state)
  const mobileMenuOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: 999,
    display: windowWidth <= 768 && mobileOpen ? 'block' : 'none'
  };

  const mobileMenuStyle = {
    position: 'fixed',
    top: 0,
    right: mobileOpen ? 0 : '-100%',
    width: '80%',
    maxWidth: '350px',
    height: '100vh',
    background: 'linear-gradient(180deg, #0b3b78 0%, #0b4f8a 100%)',
    zIndex: 1001,
    padding: '60px 20px 20px',
    transition: 'right 0.3s ease-in-out',
    overflowY: 'auto',
    boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)'
  };

  const mobileMenuLinksStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    listStyle: 'none',
    margin: 0,
    padding: 0
  };

  const mobileLinkStyle = {
    color: 'rgba(240, 248, 255, 0.95)',
    fontWeight: '600',
    fontSize: '16px',
    textDecoration: 'none',
    padding: '12px 16px',
    borderRadius: '8px',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
  };

  const hamburgerButtonStyle = {
    display: windowWidth <= 768 ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '8px',
    zIndex: 1002
  };

  const mobileCloseButtonStyle = {
    position: 'absolute',
    top: '15px',
    right: '15px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '28px',
    cursor: 'pointer',
    padding: '8px'
  };

  const [currentView, setCurrentView] = useState(() => {
    // Check if user was previously on dashboard
    const savedView = localStorage.getItem('davaoBlueEaglesCurrentView');
    const savedUser = localStorage.getItem('davaoBlueEaglesUser');
    
    // Only restore dashboard view if user is logged in and is admin
    if (savedView === 'dashboard' && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.role === 'admin') {
          return 'dashboard';
        }
      } catch (error) {
        // If there's an error parsing, fallback to home
      }
    }
    
    return 'home';
  });
  const [loginError, setLoginError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingService, setBookingService] = useState(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    service: '',
    name: '',
    email: '',
    phone: '',
    date: '',
    startTime: '',
    endTime: '',
    notes: ''
  });
  const [toast, setToast] = useState(null);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [openNotificationMenu, setOpenNotificationMenu] = useState(null);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Load notifications helper (shared so multiple handlers can call it)
  const loadNotifications = async () => {
    if (user && user.email) {
      console.log('Home: Loading notifications for user (shared loader):', user.email);
      try {
        const userNotifications = await NotificationService.getUserNotifications(user.email);
        const arr = Array.isArray(userNotifications) ? userNotifications : (userNotifications && userNotifications.notifications) ? userNotifications.notifications : [];
        console.log('Home: Shared loader loaded', arr.length, 'notifications');
        setNotifications(arr);
      } catch (err) {
        console.error('Home: Shared loader failed to load notifications:', err);
        setNotifications([]);
      }
    } else {
      setNotifications([]);
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false); // Payment modal
  const [selectedPaymentNotification, setSelectedPaymentNotification] = useState(null); // Notification with payment data
  const [paymentMethod, setPaymentMethod] = useState('gcash'); // Selected payment method
  const [paymentForm, setPaymentForm] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    gcashNumber: '',
    referenceNumber: '',
    paymentOption: 'fullpayment', // 'downpayment' or 'fullpayment'
    selectedAmount: 0
  });
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth()); // 0-11
  const [serviceCols, setServiceCols] = useState(5);
  const [serviceCardH, setServiceCardH] = useState(240);
  const aboutImages = [bandGigs, paradeEvents, musicWorkshop, musicArrangement, instrumentRentals];
  
  // Date formatting utility
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      // Handle ISO format (2025-10-25T00:00:00.000Z)
      let dateStr = dateValue;
      if (typeof dateValue === 'string') {
        dateStr = dateValue.split('T')[0]; // Get YYYY-MM-DD part
      }
      const dateObj = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      return dateValue;
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateValue;
    }
  };
  
  // Instrument Request state and form removed — instrument requests now go to the full InstrumentRental view

  // ABOUT CAROUSEL FUNCTIONS
  const goPrev = () => {
    setCurrentSlide((prev) => (prev === 0 ? aboutImages.length - 1 : prev - 1));
  };

  const goNext = () => {
    setCurrentSlide((prev) => (prev === aboutImages.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev === aboutImages.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Handle window resize for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hero background auto-slider (changes every 8 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroBackgroundIndex((prev) => (prev === heroBackgrounds.length - 1 ? 0 : prev + 1));
    }, 8000);
    return () => clearInterval(interval);
  }, [heroBackgrounds.length]);

  // Verify user status on mount and periodically (skip for admins)
  useEffect(() => {
    const verifyUserStatus = async () => {
      // Skip verification for admin users
      if (user && user.role !== 'admin') {
        console.log('🔍 Verifying user status for:', user.email);
        try {
          // Make a simple API call to verify user status
          const response = await AuthService.makeAuthenticatedRequest('http://localhost:5000/api/auth/profile');
          console.log('✅ User verification response:', response.status);
          if (!response.ok) {
            // User is blocked or deactivated
            console.log('❌ User verification failed, logging out');
            handleLogout();
          }
        } catch (error) {
          console.error('❌ User verification error:', error);
          // Don't logout on network errors, only on auth errors
          if (error.message.includes('blocked') || error.message.includes('deactivated')) {
            console.log('🚫 User is blocked/deactivated, logging out');
            handleLogout();
          }
        }
      }
    };

    // Check on mount
    verifyUserStatus();

    // Check every 30 seconds
    const interval = setInterval(verifyUserStatus, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // SERVICES CAROUSEL FUNCTIONS
  const goServicesPrev = () => {
    setServicesSlide((prev) => (prev - 1 + services.length) % services.length);
  };

  const goServicesNext = () => {
    setServicesSlide((prev) => (prev + 1) % 5);
  };

  // SCROLL REVEAL ANIMATION
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        } else {
          entry.target.classList.remove('revealed');
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [currentView]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Previously there was a local inventory and instrument request modal here.
  // Instrument requests are now handled via the dedicated InstrumentRental view.

  // Load bookings from API ONLY (no localStorage)
  useEffect(() => {
    const loadBookingsFromAPI = async () => {
      try {
        console.log('Home: Fetching bookings from API...');
  const response = await fetch('http://localhost:5000/api/bookings', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.bookings)) {
            const formatted = data.bookings.map(b => ({
              id: b.booking_id,
              customerName: b.customer_name,
              email: b.email,
              phone: b.phone,
              service: b.service,
              date: b.date ? b.date.split('T')[0] : b.date,
              startTime: b.start_time,
              endTime: b.end_time,
              location: b.location,
              estimatedValue: parseFloat(b.estimated_value || 5000),
              status: b.status,
              notes: b.notes,
              createdAt: b.created_at
            }));
            console.log('Home: Loaded', formatted.length, 'bookings from API');
            setBookings(formatted);
          }
        }
      } catch (error) {
        console.error('Home: Error loading bookings:', error);
        setBookings([]);
      }
    };
    
    loadBookingsFromAPI();
    
    // If opened in a new tab with a requested service, auto-open booking
    const svc = localStorage.getItem('dbeOpenBookingForService');
    if (svc) {
      setTimeout(() => {
        openBooking(svc);
        localStorage.removeItem('dbeOpenBookingForService');
      }, 200);
    }
    // Responsive services grid
    const setResponsive = () => {
      const w = window.innerWidth;
      if (w >= 1400) { setVisibleCount(5); setServiceCols(5); setServiceCardH(240); }
      else if (w >= 1200) { setVisibleCount(4); setServiceCols(4); setServiceCardH(220); }
      else if (w >= 992) { setVisibleCount(3); setServiceCols(3); setServiceCardH(200); }
      else if (w >= 768) { setVisibleCount(2); setServiceCols(2); setServiceCardH(190); }
      else { setVisibleCount(1); setServiceCols(1); setServiceCardH(180); }
    };
    setResponsive();
    window.addEventListener('resize', setResponsive);
    return () => window.removeEventListener('resize', setResponsive);
  }, []);

  // Navbar scroll effect: change translucency and shadow on scroll
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      setScrolled(y > 8);
      const root = document.documentElement;
      if (y > 8) {
        root.style.setProperty('--nav-bg', 'linear-gradient(180deg, rgba(6,38,83,0.36), rgba(3,105,161,0.18))');
        root.style.setProperty('--nav-shadow', '0 12px 40px rgba(2,6,23,0.45)');
      } else {
        root.style.setProperty('--nav-bg', 'linear-gradient(180deg, rgba(6,38,83,0.24), rgba(3,105,161,0.12))');
        root.style.setProperty('--nav-shadow', '0 4px 20px rgba(0, 0, 0, 0.08)');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // close menus on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Handle reset password link from email
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token && window.location.pathname.includes('reset-password')) {
      console.log('🔑 Reset password token detected, switching to reset view');
      setCurrentView('resetPassword');
    }
  }, []);

  // detect mobile width for hamburger
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 860);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // active link based on hash
  useEffect(() => {
    const setFromHash = () => setActiveHash(window.location.hash || '#home');
    setFromHash();
    window.addEventListener('hashchange', setFromHash);
    return () => window.removeEventListener('hashchange', setFromHash);
  }, []);

  const handleNavClick = (e, hash) => {
    e.preventDefault();
    if (hash) {
      setActiveHash(hash);
      // Scroll to the element smoothly
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Update URL hash
      try { window.location.hash = hash; } catch (err) {}
    }
    if (isMobile) setMobileOpen(false);
  };

  const saveBookings = (next) => {
    // Just update state - API is source of truth (no localStorage)
    setBookings(next);
    // Dispatch event to notify other components to reload from API
    window.dispatchEvent(new CustomEvent('bookingsUpdated', {
      detail: { reload: true }
    }));
  };

  const openBooking = (serviceTitle) => {
    // Open the Booking page in a new tab using hash route
    window.open('/#/booking', '_blank');
  };

  const closeBooking = () => {
    setShowBookingModal(false);
    setBookingService(null);
  };

  const overlap = (aStart, aEnd, bStart, bEnd) => {
    return aStart < bEnd && bStart < aEnd; // strict overlap
  };

  const hasConflict = (service, date, startTime, endTime) => {
    if (!service || !date || !startTime || !endTime) return false;
    const start = `${date}T${startTime}`;
    const end = `${date}T${endTime}`;
    return bookings.some(b => b.service === service && b.date === date && b.status !== 'cancelled' && overlap(start, end, `${b.date}T${b.startTime}`, `${b.date}T${b.endTime}`));
  };

  const confirmBooking = (e) => {
    e.preventDefault();
    const { service, name, email, phone, date, startTime, endTime, notes } = bookingForm;
    if (!service || !name || !email || !date || !startTime || !endTime) {
      alert('Please fill in all required fields.');
      return;
    }
    if (endTime <= startTime) {
      alert('End time must be after start time.');
      return;
    }
    if (hasConflict(service, date, startTime, endTime)) {
      alert('Selected time conflicts with an existing booking. Please choose a different time.');
      return;
    }
    const newBooking = {
      id: Date.now(),
      service,
      name,
      email,
      phone,
      date,
      startTime,
      endTime,
      notes,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    const next = [...bookings, newBooking];
    saveBookings(next);
    setToast({ type: 'success', message: 'Booking submitted! We will confirm via email.' });
    setShowBookingModal(false);
  };

  const cancelBooking = (id) => {
    const next = bookings.map(b => b.id === id ? { ...b, status: 'cancelled' } : b);
    saveBookings(next);
    setToast({ type: 'info', message: 'Booking cancelled.' });
  };

  // Auto-hide toasts
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Calendar helpers
  const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
  const ymd = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstWeekday = (y, m) => new Date(y, m, 1).getDay(); // 0 Sun - 6 Sat
  const isDayTaken = (service, y, m, d) => {
    if (!service) return false;
    const dateStr = ymd(y, m, d);
    return bookings.some(b => b.service === service && b.date === dateStr && b.status !== 'cancelled');
  };
  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 0) { setCalendarYear((y) => y - 1); return 11; }
      return prev - 1;
    });
  };
  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 11) { setCalendarYear((y) => y + 1); return 0; }
      return prev + 1;
    });
  };
  const services = [
    {
      title: 'Band Gigs',
      img: bandGigs,
      icon: <FaMusic />,
      description:
        'High-energy band performances tailored for corporate events, festivals, inaugurations, and community gatherings. Includes full marching setup, choreography, and segment programming.'
    },
    {
      title: 'Music Arrangement',
      img: musicArrangement,
      icon: <FaFileAlt />,
      description:
        'Custom musical arrangements for parades, field shows, and ceremonial pieces. We adapt to your theme and instrumentation to deliver a polished performance.'
    },
    {
     
      title: 'Parade Events',
      img: paradeEvents,
      icon: <FaFlag />,
      description:
        'Signature marching band sets with precision marching, drumline features, and dynamic brass/woodwind sections designed to elevate any occasion.'
    },
    {
      title: 'Music Workshops',
      img: musicWorkshop,
      icon: <FaChalkboardTeacher />,
      description:
        'Formal musical accompaniment for openings, dignitary arrivals, awardings, and commemorations with tasteful repertoire and disciplined presentation.'
    },
    {
      title: 'Instrument Rentals',
      img: instrumentRentals,
      icon: <FaGuitar />,
      description:
        'Rent high-quality instruments for your performances, practice sessions, or events. Members can borrow instruments for free, while customers can rent at affordable rates. Browse our collection of percussion, brass, and woodwind instruments.'
    }
  ];

  useEffect(() => {
    const savedUser = localStorage.getItem('davaoBlueEaglesUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem('davaoBlueEaglesUser');
      }
    }
    // Listen for external updates to the user (e.g., avatar changes in dashboard)
    const onUserUpdated = (e) => {
      try {
        const updated = e?.detail || JSON.parse(localStorage.getItem('davaoBlueEaglesUser') || 'null');
        if (updated) setUser(updated);
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('davaoUserUpdated', onUserUpdated);

    return () => {
      window.removeEventListener('davaoUserUpdated', onUserUpdated);
    };
  }, []);

  // Save current view to localStorage to persist dashboard state on refresh
  useEffect(() => {
    localStorage.setItem('davaoBlueEaglesCurrentView', currentView);
    
    // Update URL hash when view changes to maintain consistency
    if (currentView === 'dashboard') {
      window.history.replaceState(null, null, '#dashboard');
    } else if (currentView === 'home') {
      window.history.replaceState(null, null, '#home');
    }
  }, [currentView]);

  // Initialize payment form when modal opens
  useEffect(() => {
    if (showPaymentModal && selectedPaymentNotification?.data) {
      console.log('🟡 PAYMENT MODAL OPENED - Initializing payment form');
      console.log('Selected notification data:', selectedPaymentNotification.data);
      
      // Reset success state to show form, not success screen
      setPaymentSuccess(false);
      setPaymentProcessing(false);
      
      const totalAmount = selectedPaymentNotification.data.amount || 0;
      setPaymentForm({
        cardholderName: '',
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        gcashNumber: '',
        referenceNumber: '',
        paymentOption: 'fullpayment',
        selectedAmount: totalAmount
      });
      console.log('✅ Payment form initialized - Waiting for user to fill and submit');
    }
  }, [showPaymentModal, selectedPaymentNotification]);

  // Load notifications for current user from NotificationService (run when user changes)
  useEffect(() => {
    loadNotifications();

    // Listen for notification updates
    const handleNotificationsUpdate = () => {
      console.log('Home: Notifications updated, reloading...');
      loadNotifications();
    };

    window.addEventListener('notificationsUpdated', handleNotificationsUpdate);
    
    return () => {
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
    };
  }, [user]);

  // Infinite scroll loop for services carousel
  useEffect(() => {
    const handleScroll = () => {
      const el = carouselRef.current;
      if (!el) return;
      const half = el.scrollWidth / 2;
      if (el.scrollLeft >= half) {
        el.scrollLeft = 0;
      } else if (el.scrollLeft <= 0) {
        el.scrollLeft = half;
      }
    };

    const el = carouselRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const saveNotifications = (next) => {
    setNotifications(next);
    // Notifications are now managed by NotificationService
    // The service handles localStorage internally
  };

  const unreadCount = () => notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    if (user && user.email) {
      NotificationService.markAllAsRead(user.email);
      // Event listener will reload notifications
    }
  };

  const clearAllNotifications = () => {
    if (user && user.email) {
      NotificationService.clearUserNotifications(user.email);
      // Event listener will reload notifications
    }
  };

  const handleOpenNotification = (index) => {
    // mark as read and open notifications view focused on the clicked item
    const notification = notifications[index];
    if (notification) {
      NotificationService.markAsRead(notification.id);
      setSelectedNotification(notification);
      setShowNotifications(false);
      setCurrentView('notifications');
    }
  };

  const deleteNotification = (index) => {
    const notification = notifications[index];
    if (notification) {
      NotificationService.deleteNotification(notification.id);
      // if the deleted was selected, clear selection
      if (selectedNotification && selectedNotification.id === notification.id) {
        setSelectedNotification(null);
      }
    }
  };

  const toggleNotificationRead = (index) => {
    const notification = notifications[index];
    if (notification) {
      if (notification.read) {
        // Mark as unread
        NotificationService.markAsUnread(notification.id);
      } else {
        // Mark as read
        NotificationService.markAsRead(notification.id);
      }
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async (e) => {
    console.log('🔵 PAYMENT FORM SUBMITTED - handlePaymentSubmit called');
    console.log('Event type:', e.type);
    console.log('Event target:', e.target);
    e.preventDefault();
    setPaymentProcessing(true);

    try {
      // Get booking ID from notification with multiple fallbacks
      console.log('=== PAYMENT SUBMIT DEBUG ===');
      console.log('Full selectedPaymentNotification:', JSON.stringify(selectedPaymentNotification, null, 2));
      console.log('selectedPaymentNotification?.data:', selectedPaymentNotification?.data);
      
      // Try multiple paths to find booking ID
      const bookingId = selectedPaymentNotification?.data?.bookingId 
                     || selectedPaymentNotification?.bookingId
                     || selectedPaymentNotification?.data?.booking_id;
                     
      const amount = selectedPaymentNotification?.data?.amount 
                  || selectedPaymentNotification?.amount
                  || selectedPaymentNotification?.data?.paymentDetails?.totalAmount
                  || selectedPaymentNotification?.data?.estimated_value;

      console.log('Extracted bookingId:', bookingId);
      console.log('Extracted amount:', amount);

      if (!bookingId) {
        console.error('❌ Booking ID not found!');
        console.error('Available keys in data:', Object.keys(selectedPaymentNotification?.data || {}));
        console.error('Full notification structure:', selectedPaymentNotification);
        alert('Booking information not found. Please use "My Bookings" to make payment instead.');
        setPaymentProcessing(false);
        return;
      }

      // Use selected amount (down payment or full payment)
      const paymentAmount = paymentForm.selectedAmount || amount;
      const paymentType = paymentForm.paymentOption || 'fullpayment';
      
      console.log('Payment details:', { paymentAmount, paymentType, originalAmount: amount });

      // Process payment via backend API (/api/billing/pay-booking)
      console.log('💳 Processing payment via server...');
      // Determine email to use: logged-in user or notification-provided email
      const payerEmail = (user && user.email) || selectedPaymentNotification?.data?.email || selectedPaymentNotification?.email;
      if (!payerEmail) {
        // Prompt for email if none available
        const entered = window.prompt('Please enter the email used for the booking to process payment:');
        if (!entered) {
          alert('Email is required to process the payment.');
          setPaymentProcessing(false);
          return;
        }
        payerEmail = entered;
      }

      // Build payload expected by backend pay-booking endpoint
      const payload = {
        bookingId,
        email: payerEmail,
        paymentOption: paymentType,
        paymentMethod: paymentMethod
      };

      const resp = await fetch('http://localhost:5000/api/billing/pay-booking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      if (!resp.ok || !data || !data.success) {
        const msg = (data && data.message) ? data.message : `Payment failed (status ${resp.status})`;
        throw new Error(msg);
      }

      console.log('✅ Server payment response:', data);
      
      console.log('✅ Payment successful - Creating success notification');
      
      // Create success notification (only if user is logged in)
  if (data.booking && (user && user.email)) {
        try {
          // Format date safely
          const formattedDate = data.booking.date || 'your booking date';

          // Prepare readable amounts with thousands separator
          const paidFormatted = `₱${Number(paymentAmount).toLocaleString()}`;
          const totalFormatted = `₱${Number(amount).toLocaleString()}`;

          // Build message body depending on payment type (downpayment vs full)
          let messageBody = '';
          if (paymentType === 'downpayment' || paymentType === 'partial') {
            const remaining = Number(amount) - Number(paymentAmount);
            const remainingFormatted = `₱${Number(remaining).toLocaleString()}`;
            messageBody = `We received your downpayment of ${paidFormatted} for "${data.booking.service}" on ${formattedDate}. Remaining balance: ${remainingFormatted}.`;
          } else {
            messageBody = `We received your full payment of ${paidFormatted} for "${data.booking.service}" on ${formattedDate}. Thank you!`;
          }

          // Create user notification (do not include transaction IDs)
          NotificationService.createNotification(user.email, {
            type: 'success',
            title: paymentType === 'downpayment' || paymentType === 'partial' ? 'Downpayment Received' : 'Payment Confirmed',
            message: messageBody,
            data: {
              bookingId: data.bookingId,
              invoiceId: data.invoiceId,
              amountPaid: Number(paymentAmount),
              totalAmount: Number(amount),
              paymentType: paymentType,
              paymentMethod: paymentMethod,
              service: data.booking.service,
              date: data.booking.date
            }
          });
          
          console.log('✅ Notification created successfully');
          
          // Trigger notification refresh
          loadNotifications();
        } catch (notifError) {
          console.error('⚠️ Failed to create notification, but payment was successful:', notifError);
          // Don't throw - payment was successful, just notification failed
        }
      }
      
      // Set success state AFTER notification is created (or skipped)
      setPaymentSuccess(true);
      
      // Wait 2 seconds then close modal
      setTimeout(() => {
        setShowPaymentModal(false);
        setPaymentSuccess(false);
        setPaymentForm({
          cardholderName: '',
          cardNumber: '',
          expiryDate: '',
          cvv: '',
          gcashNumber: '',
          referenceNumber: ''
        });
        
        // Reload bookings to show updated status
        window.dispatchEvent(new CustomEvent('bookingsUpdated', {
          detail: { reload: true }
        }));
      }, 2000);
    } catch (error) {
      console.error('❌ Payment error caught:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      alert(`Payment processing failed: ${error.message}. Please try again later.`);
    } finally {
      console.log('🔵 Payment processing completed, setting paymentProcessing to false');
      setPaymentProcessing(false);
    }
  };

  // Render notification message with clickable payment link
  const renderNotificationMessage = (notification) => {
    const message = notification.message || '';
    const hasPaymentLink = message.includes('<payment-link>');
    
    console.log('Rendering notification:', { message, hasPaymentLink, notification });
    
    if (!hasPaymentLink) {
      return <div style={{ color: '#4b5563' }}>{message}</div>;
    }
    
    // Split message by payment link tags
    const parts = message.split(/<payment-link>|<\/payment-link>/);
    
    return (
      <div style={{ color: '#4b5563' }}>
        {parts.map((part, index) => {
          // Every odd index is the clickable "payment" text
          if (index % 2 === 1) {
            return (
              <span
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Payment link clicked!');
                  console.log('Full notification object:', notification);
                  console.log('Notification.data:', notification.data);
                  console.log('Notification.data.bookingId:', notification.data?.bookingId);
                  console.log('Notification.data.amount:', notification.data?.amount);
                  setSelectedPaymentNotification(notification);
                  setShowPaymentModal(true);
                  console.log('Payment modal opened. Waiting for user to submit form...');
                }}
                style={{
                  color: '#0ea5e9',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  // Helper to add a test notification (useful while developing)
  const addTestNotification = (title = 'Test Notification', body = 'This is a test') => {
    const n = { title, body, ts: Date.now(), read: false };
    const next = [...notifications, n];
    saveNotifications(next);
  };

  // close dropdowns when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      // close notifications and user menu if click is outside their areas or toggle buttons
      const path = e.composedPath ? e.composedPath() : (e.path || []);
      const isNotif = path.some(p => p && (p.id === 'notification-menu' || (p.dataset && p.dataset.notifToggle)));
      const isUser = path.some(p => p && (p.id === 'user-menu' || (p.dataset && p.dataset.userToggle)));
      if (!isNotif) setShowNotifications(false);
      if (!isUser) setShowUserMenu(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [notifications]);

  const handleLogin = (userData) => {
    console.log('Home - handleLogin called with:', userData);
    
    // New authentication flow: userData is already an authenticated user object
    // (not raw email/password like the old flow)
    if (userData && userData.id) {
      const authenticatedUser = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        isLoggedIn: true,
        isBlocked: false
      };
      
      console.log('Home - Setting authenticated user:', authenticatedUser);
      setUser(authenticatedUser);
      localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(authenticatedUser));
      setLoginError(''); // Clear any previous errors

      // Only admins can access the dashboard
      if (authenticatedUser.role === 'admin') {
        setCurrentView('dashboard');
      } else {
        // If user was trying to access invoices, restore that view
        const lastView = localStorage.getItem('davaoBlueEaglesLastView');
        if (lastView === 'invoices') {
          setCurrentView('invoices');
        } else {
          setCurrentView('home');
        }
      }
      return;
    }
    
    // Fallback: if for some reason we get old-style credentials, handle them
    console.warn('Home - Received unexpected userData format:', userData);
    setLoginError('Authentication failed. Please try again.');
    setCurrentView('login');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('davaoBlueEaglesUser');
    localStorage.removeItem('davaoBlueEaglesCurrentView'); // Clear saved view on logout
    setCurrentView('home'); // Reset to home view
    setShowUserMenu(false);
  };

  const openProfile = () => {
    // Prefill form from current user
    setProfileFirstName(user?.firstName || '');
    setProfileLastName(user?.lastName || '');
    setShowUserMenu(false);
    setCurrentView('profile');
  };

  const handleSaveProfile = async (e) => {
    e && e.preventDefault();
    try {
      const stored = JSON.parse(localStorage.getItem('davaoBlueEaglesUser') || 'null') || user || {};
      
      // Update database
      const response = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          firstName: profileFirstName,
          lastName: profileLastName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const result = await response.json();
      console.log('✅ Profile updated in database:', result);

      // Update localStorage
      const updated = { ...stored, firstName: profileFirstName, lastName: profileLastName };
      localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(updated));

      // update users array if present
      const users = JSON.parse(localStorage.getItem('davaoBlueEaglesUsers') || '[]');
      if (users && users.length) {
        const updatedUsers = users.map(u => u.id === updated.id ? { ...u, firstName: profileFirstName, lastName: profileLastName } : u);
        localStorage.setItem('davaoBlueEaglesUsers', JSON.stringify(updatedUsers));
      }

      // update local state and notify
      setUser(updated);
      window.dispatchEvent(new CustomEvent('davaoUserUpdated', { detail: updated }));
      setToast({ type: 'success', message: 'Profile updated.' });
      // return to home after save
      setCurrentView('home');
    } catch (err) {
      console.error('Saving profile failed', err);
      setToast({ type: 'error', message: 'Failed to save profile.' });
    }
  };

  const handleShowLogin = () => {
    setCurrentView('login');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
  };

  const handleShowSignup = () => {
    setCurrentView('signup'); // This is for membership applications
  };

  const handleShowUserSignup = () => {
    setCurrentView('userSignup'); // This is for regular user account creation
  };

  const handleSignup = async (userData) => {
    // If userData already looks like a server user (e.g. contains id), don't re-register — just persist locally and navigate.
    if (userData && (userData.id || userData.userId)) {
      const existing = {
        id: userData.id || userData.userId,
        firstName: userData.firstName || userData.first_name || '',
        lastName: userData.lastName || userData.last_name || '',
        email: userData.email || '',
        role: userData.role || 'user',
        isBlocked: false,
        createdAt: new Date().toISOString().split('T')[0]
      };

      // Server now uses HttpOnly cookie for session; do not store token in localStorage here.

      const storedUsers = JSON.parse(localStorage.getItem('davaoBlueEaglesUsers') || '[]');
      const updatedUsers = [...storedUsers, existing];
      localStorage.setItem('davaoBlueEaglesUsers', JSON.stringify(updatedUsers));
      setUser(existing);
      localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(existing));
      setCurrentView(existing.role === 'admin' ? 'dashboard' : 'home');
      return existing;
    }

    // Try to register on the server first. If server call fails, fall back to localStorage.
    try {
  const resp = await AuthService.register(userData);

      // Server returns { success: true, message, user }
      const serverUser = resp && resp.user ? resp.user : null;

      const newUser = {
        id: serverUser?.id || Date.now(),
        firstName: serverUser?.firstName || userData.firstName || userData.first_name || '',
        lastName: serverUser?.lastName || userData.lastName || userData.last_name || '',
        email: serverUser?.email || userData.email || '',
        role: serverUser?.role || 'user',
        isBlocked: false,
        createdAt: new Date().toISOString().split('T')[0]
      };

      // Merge into local users list (keep local copy so UI works offline)
      const storedUsers2 = JSON.parse(localStorage.getItem('davaoBlueEaglesUsers') || '[]');
      const updatedUsers2 = [...storedUsers2, newUser];
      localStorage.setItem('davaoBlueEaglesUsers', JSON.stringify(updatedUsers2));

      setUser(newUser);
      // Keep the same local key used by the app for the currently-logged-in user
      localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(newUser));

      // After successful server registration, navigate appropriately
      if (newUser.role === 'admin') {
        setCurrentView('dashboard');
      } else {
        setCurrentView('home');
      }

      return newUser;
    } catch (err) {
      // Server unavailable or registration failed — fall back to local-only signup
      console.warn('Server registration failed, falling back to localStorage signup:', err?.message || err);

      const storedUsers3 = JSON.parse(localStorage.getItem('davaoBlueEaglesUsers') || '[]');
      const newUser = {
        ...userData,
        id: `local-${Date.now()}`,
        role: 'user',
        isBlocked: false,
        createdAt: new Date().toISOString().split('T')[0]
      };

      const updatedUsers3 = [...storedUsers3, newUser];
      localStorage.setItem('davaoBlueEaglesUsers', JSON.stringify(updatedUsers3));

      setUser(newUser);
      localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(newUser));
      setCurrentView('home');

      return newUser;
    }
  };

  const handleSwitchToLogin = () => {
    setCurrentView('login');
  };

  const handleSwitchToSignup = () => {
    setCurrentView('userSignup'); // When switching from login, show user signup
  };

  const handleClearLoginError = () => {
    setLoginError('');
  };

  // Instrument Request Handlers
  const handleOpenInstrumentRequest = () => {
    // Open the InstrumentRental view in a new tab (standalone route)
    if (!user) {
      setToast({ type: 'error', message: 'Please login to request instruments' });
      return;
    }
    // Close any open modal in the current tab
    setModalService(null);
    // Build full URL to hash route used by the SPA
    // If the logged-in role is a regular 'user', open instrument booking (rental).
    // Otherwise (members/admins), open instrument borrowing.
    const routeHash = (user && user.role === 'user') ? '#/instrument-booking' : '#/instrument-borrowing';
    const url = `${window.location.origin}${window.location.pathname}${routeHash}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleServiceClick = (service) => {
    // Redirect to booking page with service pre-selected
    const serviceParam = encodeURIComponent(service.title);
    window.location.href = `/booking?service=${serviceParam}`;
  };

  const closeModal = () => {
    setModalService(null);
  };

  return (
    <>
      {/* Login view */}
      {currentView === 'login' && (
        <Login 
          onBack={handleBackToHome} 
          onLogin={handleLogin} 
          onSwitchToSignup={handleSwitchToSignup} 
          onSwitchToForgotPassword={() => setCurrentView('forgotPassword')}
          error={loginError} 
          onClearError={handleClearLoginError} 
        />
      )}

      {/* Forgot Password view */}
      {currentView === 'forgotPassword' && (
        <ForgotPassword 
          onBack={handleBackToHome}
          onSwitchToLogin={() => setCurrentView('login')}
        />
      )}

      {/* Reset Password view */}
      {currentView === 'resetPassword' && (
        <ResetPassword 
          onBack={handleBackToHome}
          onSwitchToLogin={() => setCurrentView('login')}
        />
      )}

      {/* User Signup (for booking accounts) */}
      {currentView === 'userSignup' && (
        <UserSignup
          onClose={handleBackToHome}
          onSignup={handleSignup}
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}

      {/* Membership Application */}
      {currentView === 'signup' && (
        <MemberSignup
          onClose={handleBackToHome}
          onSignup={handleSignup}
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          user={user}
          onBackToHome={() => setCurrentView('home')}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'instrumentRental' && (
        <InstrumentRental onBackToHome={() => setCurrentView('home')} />
      )}

      {currentView === 'upcomingSchedule' && (
        <PendingBookings />
      )}

      {currentView === 'profile' && (
        <div style={{ padding: '28px', maxWidth: '720px', margin: '28px auto' }}>
          <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Edit Profile</h2>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Manage your account details</div>
          </div>

          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', padding: 22, borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
            <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden', background: '#e6f2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {user?.avatar ? (
                      <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (user?.firstName || user?.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="profile-avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = String(reader.result);
                        try {
                          // Update localStorage immediately for UI responsiveness
                          const stored = JSON.parse(localStorage.getItem('davaoBlueEaglesUser') || 'null');
                          const updated = { ...(stored || {}), avatar: base64 };
                          localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(updated));
                          const users = JSON.parse(localStorage.getItem('davaoBlueEaglesUsers') || '[]');
                          const updatedUsers = users.map(u => u.id === updated.id ? { ...u, avatar: base64 } : u);
                          if (users.length) localStorage.setItem('davaoBlueEaglesUsers', JSON.stringify(updatedUsers));
                          setUser(updated);
                          window.dispatchEvent(new CustomEvent('davaoUserUpdated', { detail: updated }));

                          // Sync with backend database
                          if (stored?.id) {
                            try {
                              const response = await fetch(`http://localhost:5000/api/users/${stored.id}/avatar`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ avatar: base64 })
                              });
                              const result = await response.json();
                              if (result.success) {
                                console.log('✅ Avatar saved to database');
                              } else {
                                console.warn('⚠️ Avatar saved locally but failed to sync with database:', result.message);
                              }
                            } catch (apiError) {
                              console.error('⚠️ Avatar saved locally but backend API error:', apiError);
                            }
                          }
                        } catch (err) {
                          console.error('Saving avatar failed', err);
                        }
                      };
                      reader.readAsDataURL(file);
                    }} />
                    <label htmlFor="profile-avatar-input" style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: '#eef2ff', color: '#0b3b78', fontWeight: 700, fontSize: 13 }}>Upload</label>
                    <button type="button" onClick={async () => {
                      try {
                        const stored = JSON.parse(localStorage.getItem('davaoBlueEaglesUser') || 'null');
                        if (!stored) return;
                        
                        // Update localStorage immediately for UI responsiveness
                        const updated = { ...(stored || {}) };
                        delete updated.avatar;
                        localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(updated));
                        const users = JSON.parse(localStorage.getItem('davaoBlueEaglesUsers') || '[]');
                        const updatedUsers = users.map(u => u.id === updated.id ? (function(){ const o = { ...u }; delete o.avatar; return o; })() : u);
                        if (users.length) localStorage.setItem('davaoBlueEaglesUsers', JSON.stringify(updatedUsers));
                        setUser(updated);
                        window.dispatchEvent(new CustomEvent('davaoUserUpdated', { detail: updated }));

                        // Sync with backend database (remove avatar)
                        if (stored?.id) {
                          try {
                            const response = await fetch(`http://localhost:5000/api/users/${stored.id}/avatar`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ avatar: null })
                            });
                            const result = await response.json();
                            if (result.success) {
                              console.log('✅ Avatar removed from database');
                            } else {
                              console.warn('⚠️ Avatar removed locally but failed to sync with database:', result.message);
                            }
                          } catch (apiError) {
                            console.error('⚠️ Avatar removed locally but backend API error:', apiError);
                          }
                        }
                      } catch (err) {
                        console.error('Removing avatar failed', err);
                      }
                    }} style={{ padding: '8px 10px', borderRadius: 8, background: '#fff1f2', color: '#7f1d1d', border: 'none', fontWeight: 700, fontSize: 13 }}>Remove</button>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ width: 140, fontWeight: 700, color: '#0b3b78' }}>First Name</label>
                    <input type="text" value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)} placeholder="First name" style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(11,59,120,0.08)', background: '#fff', color: '#06264a' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ width: 140, fontWeight: 700, color: '#0b3b78' }}>Last Name</label>
                    <input type="text" value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} placeholder="Last name" style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(11,59,120,0.08)', background: '#fff', color: '#06264a' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                    <button type="button" onClick={() => setCurrentView('home')} style={{ padding: '10px 16px', borderRadius: 8, background: 'transparent', color: '#0b62d6', border: '1px solid rgba(11,98,214,0.12)', fontWeight: 700 }}>Cancel</button>
                    <button type="submit" style={{ padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(90deg,#06b6d4,#3b82f6)', color: 'white', border: 'none', fontWeight: 800 }}>Save changes</button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {currentView === 'notifications' && (
        <div style={{ padding: '28px', maxWidth: '920px', margin: '28px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>Notifications</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={markAllRead} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(11,98,214,0.12)', color: '#0b62d6', fontWeight: 700 }}>Mark all read</button>
              <button onClick={clearAllNotifications} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff1f2', border: 'none', color: '#7f1d1d', fontWeight: 700 }}>Clear all</button>
              <button onClick={() => setCurrentView('home')} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(11,98,214,0.06)', color: '#0b62d6', fontWeight: 700 }}>Close</button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 18, borderRadius: 12, background: '#f8fafc', color: '#6b7280' }}>No notifications</div>
            ) : notifications.slice().reverse().map((n, idx) => {
              const origIndex = notifications.length - 1 - idx;
              const menuOpen = openNotificationMenu === n.id;
              
              return (
                <div key={n.id || idx} style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(11,59,120,0.06)', background: n.read ? '#ffffff' : '#eef6ff', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: '#06264a' }}>{n.title}</div>
                      <div style={{ marginTop: 6 }}>{renderNotificationMessage(n)}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button 
                        onClick={() => setOpenNotificationMenu(menuOpen ? null : n.id)}
                        style={{ 
                          padding: '8px', 
                          borderRadius: 8, 
                          background: 'transparent', 
                          border: 'none', 
                          color: '#64748b', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <BsThreeDotsVertical size={18} />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {menuOpen && (
                        <>
                          {/* Backdrop to close menu when clicking outside */}
                          <div 
                            onClick={() => setOpenNotificationMenu(null)}
                            style={{ 
                              position: 'fixed', 
                              top: 0, 
                              left: 0, 
                              right: 0, 
                              bottom: 0, 
                              zIndex: 999 
                            }}
                          />
                          
                          {/* Menu */}
                          <div style={{ 
                            position: 'absolute', 
                            top: '100%', 
                            right: 0, 
                            marginTop: 4,
                            background: 'white', 
                            borderRadius: '8px', 
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            zIndex: 1000,
                            minWidth: 140,
                            overflow: 'hidden'
                          }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNotificationRead(origIndex);
                                setOpenNotificationMenu(null);
                              }}
                              style={{ 
                                width: '100%',
                                padding: '10px 16px', 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#0b62d6', 
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              {n.read ? 'Mark as Unread' : 'Mark as Read'}
                            </button>
                            <div style={{ height: 1, background: '#e2e8f0' }} />
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(origIndex);
                                setOpenNotificationMenu(null);
                              }}
                              style={{ 
                                width: '100%',
                                padding: '10px 16px', 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#dc2626', 
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Home view */}
      {currentView === 'home' && (
        <div style={containerStyle}>
          {/* small local styles for navbar animations and focus */}
          <style>{`
            .nav-fade { transition: opacity 220ms ease, transform 220ms ease; }
            .nav-link:focus { outline: 3px solid rgba(99,102,241,0.18); outline-offset: 4px; }
            .dropdown-enter { transform: translateY(-6px); opacity: 0; }
            .dropdown-enter-active { transform: translateY(0); opacity: 1; transition: all 220ms ease; }

            .scroll-reveal {
              opacity: 0;
              transform: translateY(40px);
              transition: opacity 0.8s ease, transform 0.8s ease;
            }
            
            .scroll-reveal.revealed {
              opacity: 1;
              transform: translateY(0);
            }
            
            .scroll-reveal-left {
              opacity: 0;
              transform: translateX(-40px);
              transition: opacity 0.8s ease, transform 0.8s ease;
            }
            
            .scroll-reveal-left.revealed {
              opacity: 1;
              transform: translateX(0);
            }
            
            .scroll-reveal-right {
              opacity: 0;
              transform: translateX(40px);
              transition: opacity 0.8s ease, transform 0.8s ease;
            }
            
            .scroll-reveal-right.revealed {
              opacity: 1;
              transform: translateX(0);
            }
            
            .scroll-reveal-scale {
              opacity: 0;
              transform: scale(0.9);
              transition: opacity 0.8s ease, transform 0.8s ease;
            }
            
            .scroll-reveal-scale.revealed {
              opacity: 1;
              transform: scale(1);
            }

            .footer-link:hover {
              color: #fbbf24 !important;
              transform: translateX(4px);
            }
            
            .footer-bottom-link:hover {
              background: linear-gradient(135deg, #fbbf24, #f59e0b) !important;
              -webkit-background-clip: text !important;
              -webkit-text-fill-color: transparent !important;
              background-clip: text !important;
              transform: translateY(-1px);
            }
          `}</style>
          <nav style={{ ...navStyle, alignItems: 'center' }} aria-label="Main navigation">
            {/* Left: Logo with extra left spacing */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '50px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}></div>
              <a href="#home" onClick={(e) => handleNavClick(e, '#home')} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src="/logo.png" 
                  alt="Davao Blue Eagles Marching Band" 
                  style={{ 
                    height: '70px', 
                    width: 'auto',
                    objectFit: 'contain',
                    cursor: 'pointer'
                  }} 
                />
                <div style={logoStyle}>
                  <h1 style={logoMainStyle}>DAVAO</h1>
                  <p style={logoSubStyle}>BLUE EAGLES</p>
                </div>
              </a>
            </div>

            {/* Center: empty space for logo to be prominent */}
            <div style={{ flex: 1 }}></div>

            {/* Right: menu links + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              {/* Navigation links (hidden on mobile) */}
              <ul style={{ ...ulStyle, display: isMobile ? 'none' : 'flex' }} role="menubar">
                {['#home','#services','#about','#contact'].map((hash, i) => {
                  const labels = ['Home','Services','About Us','Contact'];
                  return (
                    <li key={hash} style={{ listStyle: 'none' }}>
                      <a
                        href={hash}
                        onClick={(e) => handleNavClick(e, hash)}
                        style={{ ...linkStyle, ...(activeHash === hash ? { color: '#60a5fa' } : {}) }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        role="menuitem"
                      >
                        {labels[i]}
                      </a>
                    </li>
                  );
                })}
              </ul>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Mobile toggle - shown on mobile */}
              <button
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-controls="mobile-menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(!mobileOpen)}
                style={hamburgerButtonStyle}
              >
                {mobileOpen ? <FaTimes /> : <FaBars />}
              </button>

              <div style={buttonContainerStyle}>
                <Notifications user={user} />
                {user ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      style={{
                        ...((buttonContainerStyle && {}) || {}),
                        background: 'transparent',
                        border: 'none',
                        color: '#e6eef8',
                        padding: '0',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }}
                      data-user-toggle="true"
                      aria-controls="user-menu"
                      aria-expanded={showUserMenu}
                    >
                      <div style={{ width: '34px', height: '34px', borderRadius: '999px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: user?.avatar ? 'transparent' : 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>
                          {user?.avatar ? (
                            <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <FaUser style={{ color: 'white' }} />
                          )}
                        </div>
                    </button>

                    {showUserMenu && (
                      <div id="user-menu" role="menu" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: '#ffffff', border: '1px solid rgba(15, 76, 129, 0.08)', borderRadius: '12px', padding: '14px', minWidth: '240px', boxShadow: '0 12px 28px rgba(2,6,23,0.18)', zIndex: 1200 }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid rgba(11,59,120,0.04)' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', background: '#e6f2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b3b78', fontWeight: 800, fontSize: '18px' }}>
                            {user?.avatar ? (
                              <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (user.firstName || user.email || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: '#06264a' }}>{user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.email || '').split('@')[0]}</div>
                            <div style={{ fontSize: '12px', color: '#1e4f8a', marginTop: '3px' }}>{user.email}</div>
                          </div>
                        </div>

                        <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                          {/* Avatar controls for all users */}
                          {/* Avatar editing moved to profile page. Preview only shown above. */}
                          <a href="#profile" onClick={(e) => { e.preventDefault(); openProfile(); }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#0b3b78', fontWeight: 600 }}>
                            <FaUser style={{ color: '#0b62d6', minWidth: '18px' }} />
                            <span>View Profile</span>
                          </a>

                          <a href="#bookings" onClick={(e) => { e.preventDefault(); navigate('/bookings'); setShowUserMenu(false); }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#0b3b78', fontWeight: 600 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px' }}>
                              <path d="M3 12h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M3 6h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M3 18h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Bookings</span>
                          </a>

                          <a href="#instruments" onClick={(e) => { e.preventDefault(); handleOpenInstrumentRequest(); setShowUserMenu(false); }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#0b3b78', fontWeight: 600 }}>
                            <FaMusic style={{ color: '#0b62d6', minWidth: '18px' }} />
                            <span>{user.role === 'user' ? 'Rent Instrument' : 'Borrow Instrument'}</span>
                          </a>

                          {user.role === 'admin' && (
                            <a href="#dashboard" onClick={(e) => { e.preventDefault(); if (user?.role === 'admin') { setCurrentView('dashboard'); } else { alert('Dashboard access is restricted to administrators.'); } setShowUserMenu(false); }} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#0b3b78', fontWeight: 600 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px' }}>
                                <path d="M3 12h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M3 6h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M3 18h18" stroke="#0b62d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <span>Admin Dashboard</span>
                            </a>
                          )}

                          <div style={{ height: '1px', background: 'rgba(11,59,120,0.06)', margin: '6px 0' }} />

                          <button onClick={() => { handleLogout(); setShowUserMenu(false); }} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#0b62d6', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Sign Out</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowAuthMenu(!showAuthMenu); }}
                      style={{
                        background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
                        border: 'none',
                        color: 'white',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      Get Started
                      <FaChevronDown style={{ fontSize: '12px' }} />
                    </button>
                    
                    {showAuthMenu && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: '8px',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                        padding: '8px',
                        minWidth: '200px',
                        zIndex: 1000,
                        textAlign: 'center'
                      }}>
                        <button
                          onClick={() => { handleShowLogin(); setShowAuthMenu(false); }}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#0b3b78',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#f0f9ff'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          Login
                        </button>
                        
                        <button
                          onClick={() => { handleShowUserSignup(); setShowAuthMenu(false); }}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#0b3b78',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#f0f9ff'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          Customer Signup
                        </button>
                        
                        <button
                          onClick={() => { handleShowSignup(); setShowAuthMenu(false); }}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#0b3b78',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#f0f9ff'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          Membership Signup
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
          </nav>

          {/* Mobile menu overlay */}
          {mobileOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'linear-gradient(180deg, rgba(2,6,23,0.92), rgba(2,6,23,0.98))', display: 'flex', flexDirection: 'column', padding: '32px' }} onClick={() => setMobileOpen(false)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: 0, color: '#c7ddff', fontFamily: 'Marcellus, serif' }}>DAVAO</h3>
                  <small style={{ color: '#9fb6d9' }}>BLUE EAGLES</small>
                </div>
                <button onClick={() => setMobileOpen(false)} style={{ background: 'transparent', border: 'none', color: '#c7ddff', fontSize: '22px' }}>×</button>
              </div>

              <nav style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', gap: '18px' }} onClick={(e) => e.stopPropagation()}>
                <a href="#home" onClick={(e) => handleNavClick(e, '#home')} style={{ color: '#e6eef8', fontSize: '20px', textDecoration: 'none' }}>Home</a>
                <a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={{ color: '#e6eef8', fontSize: '20px', textDecoration: 'none' }}>Services</a>
                <a href="#about" onClick={(e) => handleNavClick(e, '#about')} style={{ color: '#e6eef8', fontSize: '20px', textDecoration: 'none' }}>About Us</a>
                <a href="#contact" onClick={(e) => handleNavClick(e, '#contact')} style={{ color: '#e6eef8', fontSize: '20px', textDecoration: 'none' }}>Contact</a>

                <div style={{ marginTop: '18px', display: 'flex', gap: '12px' }}>
                  {user ? (
                    <button onClick={() => { setMobileOpen(false); setShowUserMenu(true); }} style={{ padding: '12px', borderRadius: '10px', background: '#0b62d6', border: 'none', color: 'white', fontWeight: 700 }}>Account</button>
                  ) : (
                    <>
                      <button onClick={() => { setMobileOpen(false); handleShowLogin(); }} style={{ padding: '12px', borderRadius: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#e6eef8' }}>Login</button>
                      <button onClick={() => { setMobileOpen(false); handleShowSignup(); }} style={{ padding: '12px', borderRadius: '10px', background: 'linear-gradient(90deg,#06b6d4,#3b82f6)', border: 'none', color: 'white', fontWeight: 700 }}>Customer Signup</button>
                    </>
                  )}
                </div>
              </nav>
            </div>
          )}

          {/* Hero Section */}
          <section id="home" style={heroSectionStyle}>
            {/* Background Images with smooth crossfade */}
            {heroBackgrounds.map((bg, index) => (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${bg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center center',
                  backgroundRepeat: 'no-repeat',
                  opacity: index === heroBackgroundIndex ? 1 : 0,
                  transition: 'opacity 3s ease-in-out',
                  zIndex: -2
                }}
              />
            ))}
            
            {/* Gradient Overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(15, 23, 42, 0.6) 50%, rgba(30, 41, 59, 0.4) 100%)',
              zIndex: -1
            }} />
            
            {/* Ambient Light Effects */}
            <div style={{
              position: 'absolute',
              top: '20%',
              left: '10%',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(100px)',
              animation: 'ambientGlow 8s ease-in-out infinite'
            }}></div>
            
            <div style={{
              position: 'absolute',
              bottom: '20%',
              right: '15%',
              width: '300px',
              height: '300px',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(80px)',
              animation: 'ambientGlow 6s ease-in-out infinite 2s'
            }}></div>

            <div style={heroContentStyle}>
              {/* Main Tagline */}
              <h1 style={taglineStyle} className="scroll-reveal">
                Cirva a la gente por la música
              </h1>

              {/* Translation */}
              <p style={translationStyle} className="scroll-reveal">
                "Serve the people through music"
              </p>

              {/* Call to Action Question */}
              <p style={{
                fontSize: '20px',
                fontWeight: 500,
                color: 'white',
                marginTop: '32px',
                marginBottom: '16px',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                letterSpacing: '0.02em'
              }} className="scroll-reveal">
                Do you want to become a member?
              </p>

              {/* Call to Action */}
              <button
                onClick={handleShowSignup}
                className="scroll-reveal-scale"
                style={{
                  background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '16px 40px',
                  borderRadius: '12px',
                  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial", 
                  fontWeight: 600,
                  fontSize: '16px',
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  textDecoration: 'none',
                  boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-4px) scale(1.05)';
                  e.target.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.4)';
                  e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0) scale(1)';
                  e.target.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.3)';
                  e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                }}
              >
                Register Now
              </button>
            </div>
          </section>

          {/* Services Section */}
          <section id="services" style={servicesSectionStyle}>
            <div style={servicesContainerStyle}>
              <div style={servicesHeaderWrapStyle} className="scroll-reveal">
                <div>
                  <h3 style={servicesHeaderStyle}>Our Services</h3>
                  <div style={sectionEyebrowStyle}>What we offer</div>
                </div>
              </div>

              {/* Services Intro */}
              <div style={{ textAlign: 'center', maxWidth: '600px', margin: windowWidth <= 768 ? '0 auto 24px' : '0 auto 40px', padding: windowWidth <= 768 ? '0 16px' : '0 24px' }} className="scroll-reveal">
                <p style={{ fontSize: windowWidth <= 768 ? '15px' : '18px', lineHeight: 1.6, color: '#64748b', margin: 0 }}>
                  From energetic performances to custom arrangements, we bring the spirit of music to every occasion. Explore our range of services designed to make your events unforgettable.
                </p>
              </div>

              {/* Services Grid - 5 columns */}
              <div style={{ position: 'relative', maxWidth: '1400px', margin: '0 auto', padding: windowWidth <= 768 ? '0 16px' : '0 24px' }}>
                <div style={servicesGridStyle}>
                  {services.map((service, index) => (
                    <article 
                      key={service.title}
                      className="scroll-reveal" 
                      style={{ 
                        ...cardStyle,
                        height: '380px'
                      }} 
                      onClick={() => setModalService(service)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.boxShadow = '0 20px 60px rgba(2,6,23,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 40px rgba(2,6,23,0.08)';
                      }}
                    >
                      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                        <img 
                          src={service.img} 
                          alt={service.title} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            display: 'block', 
                            transition: 'transform 0.3s ease' 
                          }} 
                        />
                        <div style={{ 
                          position: 'absolute', 
                          inset: 0, 
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(2,6,23,0.3) 100%)' 
                        }} />
                        <div style={{ 
                          position: 'absolute', 
                          top: 12, 
                          left: 12, 
                          background: 'rgba(255,255,255,0.9)', 
                          borderRadius: '50%', 
                          width: 40, 
                          height: 40, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#1e40af', 
                          fontSize: '18px' 
                        }}>
                          {service.icon}
                        </div>
                        <div style={{ 
                          position: 'absolute', 
                          left: 12, 
                          bottom: 12, 
                          color: '#fff', 
                          fontWeight: 700, 
                          fontSize: 16,
                          textShadow: '0 2px 8px rgba(2,6,23,0.5)', 
                          lineHeight: 1.2 
                        }}>
                          {service.title}
                        </div>
                      </div>
                      <div style={{ 
                        padding: '16px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 12, 
                        flex: 1 
                      }}>
                        <p style={{ 
                          margin: 0, 
                          color: '#475569', 
                          fontSize: '13px',
                          lineHeight: 1.5, 
                          flex: 1 
                        }}>
                          {service.description && service.description.length > 100 ? 
                            `${service.description.slice(0, 97)}...` : service.description}
                        </p>
                        <div style={{ 
                          display: 'flex', 
                          gap: 8,
                          marginTop: 'auto' 
                        }}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (service.title === 'Instrument Rentals') { 
                                handleOpenInstrumentRequest(); 
                              } else { 
                                openBooking(service.title); 
                              } 
                            }} 
                            style={{ 
                              flex: 1, 
                              padding: '8px 12px',
                              borderRadius: '8px', 
                              border: 'none', 
                              background: 'linear-gradient(135deg, #1e40af 0%, #06b6d4 100%)', 
                              color: '#fff', 
                              fontWeight: 600, 
                              cursor: 'pointer', 
                              fontSize: '12px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
                              e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.4)';
                              e.currentTarget.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0) scale(1)';
                              e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.3)';
                              e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                            }}
                          >
                            {service.title === 'Instrument Rentals' ? 'Request Now' : 'Book Now'}
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setModalService(service); }} 
                            style={{ 
                              padding: '8px 12px',
                              borderRadius: '8px', 
                              border: '2px solid #e2e8f0', 
                              background: 'transparent', 
                              color: '#475569', 
                              fontWeight: 600, 
                              cursor: 'pointer', 
                              fontSize: '12px',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.borderColor = '#cbd5e1';
                              e.target.style.background = '#f8fafc';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.borderColor = '#e2e8f0';
                              e.target.style.background = 'transparent';
                            }}
                          >
                            Learn More
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section id="about" style={aboutSectionStyle}>
            <div style={servicesContainerStyle}>
              <div style={servicesHeaderWrapStyle} className="scroll-reveal">
                <div>
                  <h3 style={aboutHeaderStyle}>About Us</h3>
                  <div style={sectionEyebrowStyle}>Who we are</div>
                </div>
              </div>
              <div style={aboutWrapStyle}>
                <div style={aboutTextCardStyle} className="scroll-reveal-left">
                  <div>
                    <p style={aboutStoryParagraphStyle}>
                      The Davao Blue Eagles Marching Band (DBEMB) was founded in 2012, with November 24, 2012, as its official anniversary date. This marks the band's first-ever competition in Bohol, where it made history by sweeping all four major awards and breaking the 15-year championship streak of Bohol Island State University (BISU).
                    </p>
                    <p style={aboutStoryParagraphStyle}>
                      Since then, DBEMB has expanded its reach, competing across the Visayas (Bohol), Mindanao (Davao, Tagum, Kidapawan), and Luzon (Pasay, Pasig, Bacoor).
                    </p>
                    <p style={aboutStoryParagraphStyle}>
                      The band has secured five major championship titles—two from the Alturas Drum and Bugle competition in Tagbilaran City, Bohol, and three in Davao City.
                    </p>
                    <p style={aboutStoryParagraphStyle}>
                      However, the band's strength has gradually declined after the pandemic lockdown, particularly from early 2022 onward. Challenges such as reduced membership, financial struggles, and operational difficulties have affected its performance and stability. Despite these setbacks, DBEMB remains committed to its legacy of excellence, striving to rebuild and continue serving the people through music.
                    </p>
                  </div>
                </div>

                {/* Carousel */}
                <div style={carouselWrapperStyle} className="scroll-reveal-right">
                  <div
                    style={{
                      ...carouselImageStyle,
                      backgroundImage: `url(${aboutImages[currentSlide]})`
                    }}
                  />
                  <div style={carouselControlsStyle}>
                    <button style={navButtonStyle} onClick={goPrev} aria-label="Previous slide">‹</button>
                    <button style={navButtonStyle} onClick={goNext} aria-label="Next slide">›</button>
                  </div>
                  <div style={dotsStyle}>
                    {aboutImages.map((_, idx) => (
                      <span key={idx} style={dotStyle(idx === currentSlide)} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section id="contact" style={contactSectionStyle}>
            <div style={servicesContainerStyle}>
              <div style={servicesHeaderWrapStyle} className="scroll-reveal">
                <div>
                  <h3 style={contactHeaderStyle}>Contact Us</h3>
                  <div style={sectionEyebrowStyle}>Get in touch</div>
                </div>
              </div>

              <div style={contactGridStyle}>
                {/* Contact Information */}
                <div style={contactInfoCardStyle} className="scroll-reveal-left">
                  <h4 style={contactCardTitleStyle}>Get In Touch</h4>
                  <div style={contactInfoListStyle}>
                    <div style={contactInfoItemStyle}>
                      <div style={contactIconStyle}><FaEnvelope /></div>
                      <div>
                        <h5 style={contactLabelStyle}>Email</h5>
                        <p style={contactValueStyle}>service.dbemb@gmail.com</p>
                      </div>
                    </div>
                    <div style={contactInfoItemStyle}>
                      <div style={contactIconStyle}><FaPhoneAlt /></div>
                      <div>
                        <h5 style={contactLabelStyle}>Phone</h5>
                        <p style={contactValueStyle}>0968 668 1502</p>
                      </div>
                    </div>
                    <div style={contactInfoItemStyle}>
                      <div style={contactIconStyle}><FaMapMarkerAlt /></div>
                      <div>
                        <h5 style={contactLabelStyle}>Location</h5>
                        <p style={contactValueStyle}>Davao City, Philippines</p>
                      </div>
                    </div>
                    <div style={contactInfoItemStyle}>
                      <div style={contactIconStyle}><FaClock /></div>
                      <div>
                        <h5 style={contactLabelStyle}>Response Time</h5>
                        <p style={contactValueStyle}>Within 24 hours</p>
                      </div>
                    </div>
                  </div>

                  {/* Booking Process, Service Areas, and Payment Terms */}
                  <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ 
                      border: '1px solid rgba(255, 255, 255, 0.2)', 
                      borderRadius: '15px', 
                      padding: '20px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h5 style={infoCardTitleStyle}>Booking Process</h5>
                      <p style={infoCardTextStyle}>
                        We'll review your request and get back to you within 24 hours with availability and pricing details.
                      </p>
                    </div>
                    <div style={{ 
                      border: '1px solid rgba(255, 255, 255, 0.2)', 
                      borderRadius: '15px', 
                      padding: '20px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h5 style={infoCardTitleStyle}>Service Areas</h5>
                      <p style={infoCardTextStyle}>
                        We serve Davao City and surrounding areas. For events outside our immediate area, please contact us for special arrangements.
                      </p>
                    </div>
                    <div style={{ 
                      border: '1px solid rgba(255, 255, 255, 0.2)', 
                      borderRadius: '15px', 
                      padding: '20px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h5 style={infoCardTitleStyle}>Payment Terms</h5>
                      <p style={infoCardTextStyle}>
                        We require a 50% deposit upon booking confirmation, with the remaining balance due on the event date.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contact Form */}
                <div style={contactFormCardStyle} className="scroll-reveal-right">
                  <h4 style={contactCardTitleStyle}>Send Us a Message</h4>
                  <form style={contactFormStyle}>
                    <div style={formRowStyle}>
                      <div style={formFieldStyle}>
                        <label style={formLabelStyle}>First Name *</label>
                        <input
                          type="text"
                          style={formInputStyle}
                          placeholder="Enter your first name"
                          required
                        />
                      </div>
                      <div style={formFieldStyle}>
                        <label style={formLabelStyle}>Last Name *</label>
                        <input
                          type="text"
                          style={formInputStyle}
                          placeholder="Enter your last name"
                          required
                        />
                      </div>
                    </div>
                    <div style={formFieldStyle}>
                      <label style={formLabelStyle}>Email Address *</label>
                      <input
                        type="email"
                        style={formInputStyle}
                        placeholder="Enter your email address"
                        required
                      />
                    </div>
                    <div style={formFieldStyle}>
                      <label style={formLabelStyle}>Phone Number</label>
                      <input
                        type="tel"
                        style={formInputStyle}
                        placeholder="Enter your phone number"
                      />
                    </div>
                    <div style={formFieldStyle}>
                      <label style={formLabelStyle}>Event Type *</label>
                      <select style={formInputStyle} required>
                        <option value="">Select an event type</option>
                        <option value="corporate">Corporate Event</option>
                        <option value="festival">Festival</option>
                        <option value="parade">Parade</option>
                        <option value="ceremony">Ceremony</option>
                        <option value="workshop">Music Workshop</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div style={formFieldStyle}>
                      <label style={formLabelStyle}>Event Date</label>
                      <input
                        type="date"
                        style={formInputStyle}
                      />
                    </div>
                    <div style={formFieldStyle}>
                      <label style={formLabelStyle}>Message *</label>
                      <textarea
                        style={formTextareaStyle}
                        placeholder="Tell us about your event and requirements..."
                        rows="4"
                        required
                      ></textarea>
                    </div>
                    <button type="submit" style={submitButtonStyle}>
                      Send Message
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>

            {/* Modal - service details only (for Learn More) */}
            {modalService && (
              <div style={modalOverlayStyle} onClick={closeModal}>
                <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                  <div style={modalHeaderStyle}>
                    <h3 style={modalTitleStyle}>{modalService.title}</h3>
                    <button onClick={closeModal} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                  </div>
                  <div style={modalBodyStyle}>
                    <p style={{ color: '#374151', lineHeight: 1.6, margin: 0 }}>{modalService.description}</p>
                  </div>
                </div>
              </div>
            )}

          {/* Instrument Request modal removed — instrument requests now handled in InstrumentRental view */}

          {/* Toast */}
          {toast && (
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 3000 }}>
              <div style={{
                backgroundColor: toast.type === 'success' ? 'rgba(34,197,94,0.1)' : toast.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(96,165,250,0.1)',
                border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.4)' : toast.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(96,165,250,0.4)'}`,
                color: toast.type === 'success' ? '#22c55e' : toast.type === 'error' ? '#ef4444' : '#60a5fa',
                padding: '12px 16px',
                borderRadius: '10px',
                backdropFilter: 'blur(8px)'
              }}>
                {toast.message}
              </div>
            </div>
          )}

          {/* Footer */}
          <footer style={footerStyle}>
            <div style={footerContainerStyle}>
              {/* Main Footer Content */}
              <div style={footerMainStyle}>
                {/* Brand (left 2/5) */}
                <div style={footerBrandStyle}>
                  <div style={footerLogoStyle}>
                    <a 
                      href="#home" 
                      onClick={(e) => handleNavClick(e, '#home')}
                      style={{ textDecoration: 'none' }}
                    >
                      <h3 style={footerLogoTitleStyle}>DAVAO</h3>
                      <p style={footerLogoSubtitleStyle}>BLUE EAGLES</p>
                    </a>
                  </div>
                  <p style={footerDescriptionStyle}>
                    Serving the people through music since 2012. We bring excellence, passion, and unforgettable performances to every event.
                  </p>
                  <div style={footerSocialStyle}>
                    <a href="#" style={socialLinkStyle} aria-label="Facebook">
                      <FaFacebookF style={socialIconStyle} />
                    </a>
                    <a href="#" style={socialLinkStyle} aria-label="Instagram">
                      <FaInstagram style={socialIconStyle} />
                    </a>
                    <a href="#" style={socialLinkStyle} aria-label="YouTube">
                      <FaYoutube style={socialIconStyle} />
                    </a>
                    <a href="#" style={socialLinkStyle} aria-label="Email">
                      <FaEnvelope style={socialIconStyle} />
                    </a>
                  </div>
                </div>

                {/* Right side (3/5) - wrap the three columns */}
                <div style={rightColumnsStyle}>
                  {/* Quick Links */}
                  <div style={footerSectionStyle}>
                    <h4 style={footerSectionTitleStyle}>Quick Links</h4>
                    <ul style={footerLinkListStyle}>
                      <li><a href="#home" onClick={(e) => handleNavClick(e, '#home')} style={footerLinkStyle} className="footer-link">Home</a></li>
                      <li><a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={footerLinkStyle} className="footer-link">Services</a></li>
                      <li><a href="#about" onClick={(e) => handleNavClick(e, '#about')} style={footerLinkStyle} className="footer-link">About Us</a></li>
                      <li><a href="#contact" onClick={(e) => handleNavClick(e, '#contact')} style={footerLinkStyle} className="footer-link">Contact</a></li>
                      <li><a href="#" style={footerLinkStyle} className="footer-link">Gallery</a></li>
                      <li><a href="#" style={footerLinkStyle} className="footer-link">News & Events</a></li>
                    </ul>
                  </div>

                  {/* Our Services */}
                  <div style={footerSectionStyle}>
                    <h4 style={footerSectionTitleStyle}>Our Services</h4>
                    <ul style={footerLinkListStyle}>
                      <li><a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={footerLinkStyle} className="footer-link">Band Gigs</a></li>
                      <li><a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={footerLinkStyle} className="footer-link">Music Arrangement</a></li>
                      <li><a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={footerLinkStyle} className="footer-link">Parade Events</a></li>
                      <li><a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={footerLinkStyle} className="footer-link">Music Workshops</a></li>
                      <li><a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={footerLinkStyle} className="footer-link">Instrument Rentals</a></li>
                      <li><a href="#services" onClick={(e) => handleNavClick(e, '#services')} style={footerLinkStyle} className="footer-link">Custom Performances</a></li>
                    </ul>
                  </div>

                  {/* Contact Info */}
                  <div style={footerSectionStyle}>
                    <h4 style={footerSectionTitleStyle}>Contact Info</h4>
                    <div style={footerContactListStyle}>
                      <div style={footerContactItemStyle}>
                        <span style={footerContactIconStyle}><FaMapMarkerAlt /></span>
                        <span style={footerContactTextStyle}>Davao City, Philippines</span>
                      </div>
                      <div style={footerContactItemStyle}>
                        <span style={footerContactIconStyle}><FaEnvelope /></span>
                        <span style={footerContactTextStyle}>service.dbemb@gmail.com</span>
                      </div>
                      <div style={footerContactItemStyle}>
                        <span style={footerContactIconStyle}><FaPhoneAlt /></span>
                        <span style={footerContactTextStyle}>0968 668 1502</span>
                      </div>
                      <div style={footerContactItemStyle}>
                        <span style={footerContactIconStyle}><FaClock /></span>
                        <span style={footerContactTextStyle}>Mon-Fri: 9AM-6PM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>

              {/* Footer Bottom */}
            <div style={{ ...footerBottomStyle, width: '100%' }}>
              <div style={footerBottomContentStyle}>
                {/* copyright — span 2 of 5 on wide screens */}
                <div style={{ gridColumn: windowWidth <= 768 ? 'auto' : 'span 2' }}>
                  <p style={footerCopyrightStyle}>
                    © 2025 Davao Blue Eagles Marching Band. All rights reserved.
                  </p>
                </div>

                {/* three link columns (each occupies 1 column of the remaining 3) */}
                <div style={{ textAlign: 'center' }}>
                  <a href="#" style={footerBottomLinkStyle} className="footer-bottom-link">Privacy Policy</a>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <a href="#" style={footerBottomLinkStyle} className="footer-bottom-link">Terms of Service</a>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <a href="#" style={footerBottomLinkStyle} className="footer-bottom-link">Cookie Policy</a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* My Bookings Modal */}
      {showMyBookings && (
        <div 
          onClick={() => setShowMyBookings(false)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.7)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: 'white', 
              borderRadius: '16px', 
              maxWidth: '900px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: '24px', 
              borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              borderRadius: '16px 16px 0 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 800 }}>My Bookings</h2>
                <button 
                  onClick={() => setShowMyBookings(false)}
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.2)', 
                    border: 'none', 
                    color: 'white', 
                    fontSize: 24, 
                    width: 36, 
                    height: 36, 
                    borderRadius: '50%', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Bookings List */}
            <div style={{ padding: '24px' }}>
              {bookings.filter(b => b.email === user?.email).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                  <FaCalendarAlt style={{ fontSize: 48, marginBottom: 16, color: '#cbd5e1' }} />
                  <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>No Bookings Yet</h3>
                  <p style={{ margin: 0 }}>You haven't made any bookings yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {bookings.filter(b => b.email === user?.email).map(booking => (
                    <div 
                      key={booking.id} 
                      style={{ 
                        background: booking.status === 'approved' ? '#f0f9ff' : '#f8fafc',
                        border: `2px solid ${booking.status === 'approved' ? '#bae6fd' : '#e2e8f0'}`, 
                        borderRadius: 12, 
                        padding: 20,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                            Booking #{booking.id} - {booking.service}
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
                            <div>
                              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Date</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>
                                {formatDate(booking.date)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Time</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>
                                {booking.startTime} - {booking.endTime}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Location</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>{booking.location}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Amount</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#0369a1' }}>
                                ₱{booking.estimatedValue?.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {booking.notes && (
                            <div style={{ marginTop: 12, padding: 12, background: '#f1f5f9', borderRadius: 8 }}>
                              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Notes</div>
                              <div style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>{booking.notes}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 600,
                            background: booking.status === 'approved' ? '#d1fae5' : booking.status === 'pending' ? '#fef3c7' : booking.status === 'paid' ? '#dbeafe' : '#fee2e2',
                            color: booking.status === 'approved' ? '#065f46' : booking.status === 'pending' ? '#92400e' : booking.status === 'paid' ? '#1e40af' : '#991b1b'
                          }}>
                            {booking.status === 'approved' ? '✓ Approved' : booking.status === 'pending' ? '⏳ Pending' : booking.status === 'paid' ? '💳 Paid' : booking.status === 'rejected' ? '✕ Rejected' : booking.status}
                          </span>
                        </div>

                        {booking.status === 'approved' && (
                          <button 
                            onClick={() => {
                              setSelectedPaymentNotification({
                                data: {
                                  bookingId: booking.id,
                                  amount: booking.estimatedValue,
                                  service: booking.service,
                                  date: booking.date
                                }
                              });
                              setShowPaymentModal(true);
                              setShowMyBookings(false);
                            }}
                            style={{
                              padding: '10px 20px',
                              borderRadius: 8,
                              background: '#059669',
                              border: 'none',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: 14,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                          >
                            <FaCreditCard />
                            Proceed to Payment
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPaymentNotification && (
        <div 
          onClick={() => !paymentProcessing && setShowPaymentModal(false)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.7)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: 'white', 
              borderRadius: '16px', 
              maxWidth: '600px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            {paymentSuccess ? (
              <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                <FaCheckCircle style={{ fontSize: 80, color: '#10b981', marginBottom: 20 }} />
                <h2 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: 28, fontWeight: 800 }}>Payment Successful!</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: 16 }}>Your payment has been processed successfully.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ 
                  padding: '24px', 
                  borderBottom: '1px solid #e2e8f0',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  borderRadius: '16px 16px 0 0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 800 }}>
                        <FaCreditCard style={{ marginRight: 8 }} />
                        Complete Payment
                      </h2>
                      <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: 14 }}>
                        {selectedPaymentNotification.data?.service || 'Booking Service'}
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowPaymentModal(false)}
                      disabled={paymentProcessing}
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.2)', 
                        border: 'none', 
                        color: 'white', 
                        fontSize: 24, 
                        width: 36, 
                        height: 36, 
                        borderRadius: '50%', 
                        cursor: paymentProcessing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: paymentProcessing ? 0.5 : 1
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Payment Amount */}
                <div style={{ padding: '24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Total Booking Amount</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#0c4a6e' }}>
                      ₱{(selectedPaymentNotification.data?.amount || selectedPaymentNotification.data?.paymentDetails?.totalAmount || 0).toLocaleString()}
                    </div>
                  </div>
                  
                  {/* Payment Option Selection */}
                  <div style={{ display: 'flex', gap: 12, maxWidth: 500, margin: '0 auto' }}>
                    <div 
                      onClick={() => {
                        const totalAmount = selectedPaymentNotification.data?.amount || 0;
                        setPaymentForm({...paymentForm, paymentOption: 'downpayment', selectedAmount: totalAmount * 0.5});
                      }}
                      style={{ 
                        flex: 1,
                        padding: '16px', 
                        border: `3px solid ${paymentForm.paymentOption === 'downpayment' ? '#10b981' : '#e2e8f0'}`, 
                        borderRadius: 12, 
                        cursor: 'pointer',
                        background: paymentForm.paymentOption === 'downpayment' ? '#ecfdf5' : 'white',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Down Payment (50%)</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                        ₱{((selectedPaymentNotification.data?.amount || 0) * 0.5).toLocaleString()}
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => {
                        const totalAmount = selectedPaymentNotification.data?.amount || 0;
                        setPaymentForm({...paymentForm, paymentOption: 'fullpayment', selectedAmount: totalAmount});
                      }}
                      style={{ 
                        flex: 1,
                        padding: '16px', 
                        border: `3px solid ${paymentForm.paymentOption === 'fullpayment' ? '#0ea5e9' : '#e2e8f0'}`, 
                        borderRadius: 12, 
                        cursor: 'pointer',
                        background: paymentForm.paymentOption === 'fullpayment' ? '#f0f9ff' : 'white',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Full Payment (100%)</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#0ea5e9' }}>
                        ₱{(selectedPaymentNotification.data?.amount || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Form */}
                <form onSubmit={handlePaymentSubmit} style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Choose Payment Method</h3>
                  
                  {/* Payment Method Selection */}
                  <div style={{ marginBottom: 20 }}>
                    {['gcash', 'card', 'bank'].map(method => (
                      <div 
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        style={{ 
                          padding: 16, 
                          border: `2px solid ${paymentMethod === method ? '#0ea5e9' : '#e2e8f0'}`, 
                          borderRadius: 12, 
                          cursor: 'pointer', 
                          marginBottom: 12,
                          background: paymentMethod === method ? '#f0f9ff' : 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {method === 'gcash' && <FaMobileAlt style={{ fontSize: 24, color: '#0284c7' }} />}
                          {method === 'card' && <FaCreditCard style={{ fontSize: 24, color: '#0ea5e9' }} />}
                          {method === 'bank' && <FaUniversity style={{ fontSize: 24, color: '#d97706' }} />}
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {method === 'gcash' && 'GCash'}
                              {method === 'card' && 'Credit / Debit Card'}
                              {method === 'bank' && 'Bank Transfer'}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              {method === 'gcash' && 'Instant mobile payment'}
                              {method === 'card' && 'Visa, Mastercard, American Express'}
                              {method === 'bank' && 'Direct bank deposit'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Fields */}
                  <div style={{ marginTop: 20 }}>
                    {paymentMethod === 'card' && (
                      <>
                        <input
                          type="text"
                          placeholder="Cardholder Name"
                          value={paymentForm.cardholderName}
                          onChange={(e) => setPaymentForm({...paymentForm, cardholderName: e.target.value})}
                          required
                          style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                        />
                        <input
                          type="text"
                          placeholder="Card Number"
                          value={paymentForm.cardNumber}
                          onChange={(e) => setPaymentForm({...paymentForm, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 16)})}
                          required
                          maxLength={16}
                          style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={paymentForm.expiryDate}
                            onChange={(e) => setPaymentForm({...paymentForm, expiryDate: e.target.value})}
                            required
                            maxLength={5}
                            style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                          />
                          <input
                            type="text"
                            placeholder="CVV"
                            value={paymentForm.cvv}
                            onChange={(e) => setPaymentForm({...paymentForm, cvv: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                            required
                            maxLength={4}
                            style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                          />
                        </div>
                      </>
                    )}

                    {paymentMethod === 'gcash' && (
                      <>
                        <input
                          type="text"
                          placeholder="GCash Number (09XXXXXXXXX)"
                          value={paymentForm.gcashNumber}
                          onChange={(e) => setPaymentForm({...paymentForm, gcashNumber: e.target.value})}
                          required
                          maxLength={11}
                          style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                        />
                        <input
                          type="text"
                          placeholder="Reference Number"
                          value={paymentForm.referenceNumber}
                          onChange={(e) => setPaymentForm({...paymentForm, referenceNumber: e.target.value})}
                          required
                          style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                        />
                      </>
                    )}

                    {paymentMethod === 'bank' && (
                      <>
                        <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8, color: '#78350f' }}>Bank Details:</div>
                          <div style={{ color: '#92400e' }}>Bank: BDO</div>
                          <div style={{ color: '#92400e' }}>Account Name: Davao Blue Eagles</div>
                          <div style={{ color: '#92400e' }}>Account Number: 1234-5678-9012</div>
                        </div>
                        <input
                          type="text"
                          placeholder="Reference Number"
                          value={paymentForm.referenceNumber}
                          onChange={(e) => setPaymentForm({...paymentForm, referenceNumber: e.target.value})}
                          required
                          style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                        />
                      </>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit"
                    disabled={paymentProcessing}
                    style={{ 
                      width: '100%',
                      padding: 14, 
                      borderRadius: 8, 
                      background: paymentProcessing ? '#94a3b8' : '#0ea5e9', 
                      border: 'none', 
                      color: 'white', 
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: paymentProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    {paymentProcessing ? (
                      <>
                        <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                        Processing...
                      </>
                    ) : (
                      <>Pay ₱{(selectedPaymentNotification.data?.amount || selectedPaymentNotification.data?.paymentDetails?.totalAmount || 0).toLocaleString()}</>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Customer Service Chatbot - Only show on home view */}
      {currentView === 'home' && <CustomerService />}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '30px',
            left: currentView === 'home' ? '30px' : '30px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#0ea5e9',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
            zIndex: 9999,
            transition: 'all 0.3s ease',
            animation: 'fadeIn 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0284c7';
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(14, 165, 233, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0ea5e9';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.4)';
          }}
          title="Scroll to top"
        >
          <FaArrowUp />
        </button>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
export default Home;
