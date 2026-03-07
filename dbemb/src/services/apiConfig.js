// Centralized API configuration for frontend services
const isVercelHost = typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname);
const defaultOrigin = isVercelHost
  ? 'https://dbemb-website-2.onrender.com'
  : 'http://localhost:5000';

const rawBaseUrl = (
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  defaultOrigin
).trim();

const trimmedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
export const API_BASE_URL = /\/api$/i.test(trimmedBaseUrl)
  ? trimmedBaseUrl
  : `${trimmedBaseUrl}/api`;

export default {
  API_BASE_URL
};
