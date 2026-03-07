const express = require('express');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { notifyAllAdmins } = require('../services/notificationService');
const { authenticateToken } = require('../middleware/auth');

const isProd = process.env.NODE_ENV === 'production';
const authCookieBaseOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax'
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'identityProof-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
    }
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    console.log(`Auth route: login attempt for email=${email}`);

    const result = await authService.login(email, password);

    // Set HttpOnly cookie with JWT token
    const token = result.token;
    const cookieOptions = {
      ...authCookieBaseOptions,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    };
    res.cookie('session', token, cookieOptions);

    // Return user only (don't expose token in JSON)
    res.json({ success: true, message: 'Login successful', user: result.user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
});

// Register route
router.post('/register', upload.single('identityProof'), async (req, res) => {
  try {
    const { firstName, lastName, email, password, birthday, phone, instrument, address } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: 'All fields are required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please enter a valid email address'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    // Prepare user data
    const userData = {
      firstName,
      lastName,
      email,
      password
    };

    // Add optional fields if provided
    if (birthday) userData.birthday = birthday;
    if (phone) userData.phone = phone;
    if (instrument) userData.instrument = instrument;
    if (address) userData.address = address;
    if (req.file) userData.identityProof = req.file.path;

    const user = await authService.register(userData);

    // Notify all admins about new customer registration
    await notifyAllAdmins(
      'new_customer',
      'New Customer Registration',
      `${firstName} ${lastName} (${email}) has registered as a new customer`,
      { userId: user.id, email, name: `${firstName} ${lastName}` }
    );

    // Optionally auto-login newly registered user by issuing JWT cookie
    const token = jwt.sign({ userId: user.id, email: user.email, role_name: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
    const cookieOptions = {
      ...authCookieBaseOptions,
      maxAge: 24 * 60 * 60 * 1000
    };
    res.cookie('session', token, cookieOptions);

    res.status(201).json({ success: true, message: 'User registered successfully', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Google OAuth login/register
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Missing Google ID token' });
    }

    const result = await authService.googleLoginOrRegister(idToken);

    const token = result.token;
    const cookieOptions = {
      ...authCookieBaseOptions,
      maxAge: 24 * 60 * 60 * 1000
    };
    res.cookie('session', token, cookieOptions);

    res.json({ success: true, message: 'Google authentication successful', user: result.user });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ success: false, message: error.message || 'Google authentication failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // User data is already available from authenticateToken middleware in req.user
    const user = await authService.getUserById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
});

// Logout (clear cookie)
router.post('/logout', (req, res) => {
  const cookieOptions = {
    ...authCookieBaseOptions
  };
  res.clearCookie('session', cookieOptions);
  res.json({ success: true, message: 'Logged out' });
});

// Forgot password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists
    const [users] = await pool.execute('SELECT id, email, first_name FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      // Don't reveal if user exists or not (security best practice)
      return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const user = users[0];

    // Generate reset token (32 bytes = 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token before storing (security best practice)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed token and expiry in database (use MySQL NOW() to avoid timezone issues)
    await pool.execute(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
      [hashedToken, user.id]
    );

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    // Get the actual expiry time from database for logging
    const [tokenInfo] = await pool.execute(
      'SELECT password_reset_expires FROM users WHERE id = ?',
      [user.id]
    );
    const expiresAt = tokenInfo[0].password_reset_expires;
    
    console.log('\n=====================================');
    console.log('PASSWORD RESET REQUEST');
    console.log('=====================================');
    console.log(`User: ${user.first_name} (${user.email})`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`Token expires at: ${expiresAt}`);
    console.log('=====================================\n');

    // Send email with reset link
    try {
      await emailService.sendPasswordResetEmail(user.email, resetUrl, user.first_name);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Failed to send email:', emailError.message);
      // Still return success to user (don't reveal if email failed)
      // But log the error for debugging
    }

    res.json({ 
      success: true, 
      message: 'If an account with that email exists, a password reset link has been sent.',
      // In development, include the reset URL for testing
      ...(process.env.NODE_ENV === 'development' && { resetUrl })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process password reset request' });
  }
});

// Reset password - Verify token and update password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    // Hash the token to match what's stored in database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    console.log('🔍 Reset Password Debug:');
    console.log('  Token from URL:', token.substring(0, 20) + '...');
    console.log('  Hashed token:', hashedToken);

    // Find user with valid token
    const [users] = await pool.execute(
      'SELECT id, email, first_name FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [hashedToken]
    );
    
    console.log('  Users found:', users.length);
    if (users.length === 0) {
      // Check if token exists but expired
      const [expiredUsers] = await pool.execute(
        'SELECT email, password_reset_expires FROM users WHERE password_reset_token = ?',
        [hashedToken]
      );
      if (expiredUsers.length > 0) {
        console.log('  ❌ Token found but expired:', expiredUsers[0].password_reset_expires);
        return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new password reset.' });
      }
      console.log('  ❌ Token not found in database');
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const user = users[0];
    console.log('  ✅ Valid token for user:', user.email);

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    console.log(`✅ Password reset successful for user: ${user.email}`);

    res.json({ 
      success: true, 
      message: 'Password has been reset successfully. You can now login with your new password.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

module.exports = router;