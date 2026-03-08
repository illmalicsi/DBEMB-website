import { API_BASE_URL } from './apiConfig';

class AuthService {
  // Login user
  async login(email, password, loginType = 'any') {
    try {
      // Use cookie-based session; server sets HttpOnly cookie on successful login
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, loginType })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');

      // Server returns user object; persist locally for UI only (no tokens)
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        try { localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(data.user)); } catch (e) {}
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Google Sign-In using ID token
  async googleSignIn(idToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Google sign-in failed');

      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        try { localStorage.setItem('davaoBlueEaglesUser', JSON.stringify(data.user)); } catch (e) {}
      }

      return data;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  // Register new user
  async register(userData) {
    try {
      // Check if userData is FormData
      const isFormData = userData instanceof FormData;
      
      console.log('AuthService register called');
      console.log('userData type:', userData.constructor.name);
      console.log('isFormData:', isFormData);
      
      const options = {
        method: 'POST',
        body: isFormData ? userData : JSON.stringify(userData),
      };

      // Only set Content-Type for JSON, not for FormData
      if (!isFormData) {
        options.headers = {
          'Content-Type': 'application/json',
        };
      }

      console.log('Request options:', options);

  // Ensure the request includes credentials so server can set HttpOnly cookie on register
  const response = await fetch(`${API_BASE_URL}/auth/register`, { ...options, credentials: 'include' });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Get current user profile
  async getProfile() {
    try {
      // Server reads session from HttpOnly cookie; include credentials
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to get profile');
      return data;
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  // Logout user
  logout() {
    // Call server to clear HttpOnly cookie, then clear local UI-only keys
    try {
      fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    } catch (e) {}
    localStorage.removeItem('user');
    try {
      localStorage.removeItem('davaoBlueEaglesUser');
      localStorage.removeItem('davaoBlueEaglesCurrentView');
      localStorage.removeItem('davaoBlueEaglesLastView');
    } catch (e) {}
  }

  // Get stored token
  getToken() {
    // Tokens are now stored in HttpOnly cookies; client should not access them.
    return null;
  }

  // Get stored user data
  getUser() {
    // Prefer canonical `user` key; fall back to legacy `davaoBlueEaglesUser` for older components.
    let userStr = null;
    try {
      userStr = localStorage.getItem('user');
      if (!userStr) userStr = localStorage.getItem('davaoBlueEaglesUser');
    } catch (e) {
      // Access may fail if localStorage is shimmed — ignore and return null
      return null;
    }
    return userStr ? JSON.parse(userStr) : null;
  }

  // Check if user is authenticated
  isAuthenticated() {
    // If a user object exists locally (set after login/profile), consider authenticated.
    const user = this.getUser();
    return !!user;
  }

  // Check if user has specific role
  hasRole(role) {
    const user = this.getUser();
    return user && user.role === role;
  }

  // Check if user is admin
  isAdmin() {
    return this.hasRole('admin');
  }

  // Check if user is member or admin
  isMember() {
    const user = this.getUser();
    return user && ['admin', 'member'].includes(user.role);
  }

  // Make authenticated API request
  async makeAuthenticatedRequest(url, options = {}) {
    console.log('📡 Making authenticated request to:', url);
    // Use cookie-based auth: include credentials. The server will read HttpOnly cookie.
    const opts = {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    };

    try {
      const response = await fetch(url, opts);
      console.log(`📥 Response status from ${url}:`, response.status);

      // Check if user is blocked or unauthorized
      if (response.status === 403 || response.status === 401) {
        console.log('⚠️ Received 403/401, checking if user is blocked...');
        let data;
        try {
          data = await response.json();
          console.log('📋 Response data:', data);
        } catch (e) {
          data = { message: 'Unauthorized' };
        }
        
        if (data.blocked || response.status === 403) {
          // User is blocked, force logout and redirect
          console.log('🚫 User is blocked, logging out...');
          this.logout();
          console.log('🔄 Redirecting to home...');
          window.location.href = '/';
          throw new Error(data.message || 'Account is blocked');
        }
        
        // Session invalid/expired: clear UI state and surface error
        console.log('🔓 Session expired, logging out...');
        this.logout();
        throw new Error('Session expired. Please login again.');
      }
      
      // For other non-OK responses, surface a helpful error with server message (so callers can catch)
      if (!response.ok) {
        let errData = null;
        try {
          errData = await response.json();
        } catch (e) {
          // ignore parse errors
        }
        const errMsg = (errData && (errData.message || errData.error || errData.msg)) || `Request failed with status ${response.status}`;
        console.error(`HTTP error ${response.status} from ${url}:`, errData || errMsg);
        throw new Error(errMsg);
      }

      console.log('✅ Request successful');
      return response;
    } catch (fetchErr) {
      // Network-level errors (DNS, connection refused, CORS) surface here as a TypeError
      // Log helpful debug info for the developer and rethrow a clear error for callers
      try {
        console.error('Network/Fetch error calling', url, 'opts:', opts, 'error:', fetchErr);
      } catch (e) {
        // ensure logging doesn't crash in restricted environments
        console.error('Network/Fetch error:', fetchErr && fetchErr.message);
      }
      // Wrap and rethrow so callers receive a helpful message
      const msg = fetchErr && fetchErr.message ? fetchErr.message : 'Network request failed';
      throw new Error(`Network request failed: ${msg}`);
    }
  }

  // HTTP helper methods
  async get(endpoint) {
    try {
      const response = await this.makeAuthenticatedRequest(`${API_BASE_URL}${endpoint}`, {
        method: 'GET'
      });
      return await response.json();
    } catch (error) {
      console.error('GET request error:', error);
      throw error;
    }
  }

  async post(endpoint, data) {
    try {
      const response = await this.makeAuthenticatedRequest(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('POST request error:', error);
      throw error;
    }
  }

  async put(endpoint, data) {
    try {
      const response = await this.makeAuthenticatedRequest(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
      });
      return await response.json();
    } catch (error) {
      console.error('PUT request error:', error);
      throw error;
    }
  }

  async delete(endpoint) {
    try {
      const response = await this.makeAuthenticatedRequest(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('DELETE request error:', error);
      throw error;
    }
  }

  // Forgot password - Request password reset
  async forgotPassword(email) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      return data;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  // Reset password - Update password with reset token
  async resetPassword(token, newPassword) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      return data;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }
}

export default new AuthService();