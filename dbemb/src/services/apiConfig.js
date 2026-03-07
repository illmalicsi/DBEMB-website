// Centralized API configuration for frontend services
const rawBaseUrl = (
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:5000'
).trim();

const trimmedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
export const API_BASE_URL = /\/api$/i.test(trimmedBaseUrl)
  ? trimmedBaseUrl
  : `${trimmedBaseUrl}/api`;

export default {
  API_BASE_URL
};
