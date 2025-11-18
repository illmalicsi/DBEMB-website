const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/database');
const { notifyAllAdmins } = require('./notificationService');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let googleClient = null;
if (GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
}

class AuthService {
  // Login user
  async login(email, password) {
    try {
      // Get user with role information
      const [rows] = await pool.execute(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, 
               u.is_active, u.is_blocked, r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.email = ?
      `, [email]);

      if (rows.length === 0) {
        // No user found for this email
        console.warn(`AuthService.login: no user found for email=${email}`);
        throw new Error('Invalid email or password');
      }

      const user = rows[0];

      // Check if user is active and not blocked
      if (!user.is_active) {
        throw new Error('Account is deactivated');
      }

      if (user.is_blocked) {
        throw new Error('Account is blocked');
      }

      // Verify password - support both bcrypt hash and plaintext
      const stored = user.password_hash || '';
      let passwordValid = false;
      
      // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
      if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
        passwordValid = await bcrypt.compare(password, stored);
      } else {
        // Plaintext comparison for school project
        passwordValid = (password === stored);
      }
      
      if (!passwordValid) {
        // Password mismatch - log for diagnostics (do not log the password)
        console.warn(`AuthService.login: password mismatch for userId=${user.id} email=${email}`);
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role_name: user.role_name
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // Return user data (without password, but with avatar)
      return {
        token,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role_name,
          avatar: user.avatar
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Google login/register using ID token
  async googleLoginOrRegister(idToken) {
    try {
      if (!GOOGLE_CLIENT_ID) {
        throw new Error('Server missing GOOGLE_CLIENT_ID');
      }
      if (!googleClient) {
        googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
      }

      // Verify the token with Google
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid Google token payload');
      }

      const email = payload.email;
      const emailVerified = payload.email_verified;
      const givenName = payload.given_name || '';
      const familyName = payload.family_name || '';
      const fullName = payload.name || '';

      if (!email || !emailVerified) {
        throw new Error('Email not verified by Google');
      }

      // Try to find existing user
      const [existingUserRows] = await pool.execute(
        'SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.is_blocked, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.email = ?',
        [email]
      );

      let userRecord;
      if (existingUserRows.length > 0) {
        userRecord = existingUserRows[0];
        if (!userRecord.is_active) throw new Error('Account is deactivated');
        if (userRecord.is_blocked) throw new Error('Account is blocked');
      } else {
        // Create new user with role 'user'
        const [roleRows] = await pool.execute('SELECT role_id FROM roles WHERE role_name = ?', ['user']);
        const roleId = (roleRows && roleRows.length > 0) ? roleRows[0].role_id : 3;
        const randPassword = crypto.randomBytes(16).toString('hex');
        const firstName = givenName || (fullName.split(' ')[0] || '');
        const lastName = familyName || (fullName.split(' ').slice(1).join(' ') || '');

        const [insertResult] = await pool.execute(`
          INSERT INTO users (first_name, last_name, email, password_hash, role_id)
          VALUES (?, ?, ?, ?, ?)
        `, [firstName || 'Google', lastName || 'User', email, randPassword, roleId]);

        userRecord = {
          id: insertResult.insertId,
          first_name: firstName || 'Google',
          last_name: lastName || 'User',
          email,
          role_name: 'user',
          is_active: 1,
          is_blocked: 0
        };

        // Notify admins about new registration via Google sign-in
        try {
          await notifyAllAdmins(
            'new_customer',
            'New Customer Registration',
            `${userRecord.first_name} ${userRecord.last_name} (${userRecord.email}) has registered via Google Sign-In`,
            { userId: userRecord.id, email: userRecord.email, name: `${userRecord.first_name} ${userRecord.last_name}` }
          );
        } catch (notifyErr) {
          console.error('Failed to notify admins for Google signup:', notifyErr);
        }
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: userRecord.id,
          email: userRecord.email,
          role_name: userRecord.role_name || 'user'
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      return {
        token,
        user: {
          id: userRecord.id,
          firstName: userRecord.first_name,
          lastName: userRecord.last_name,
          email: userRecord.email,
          role: userRecord.role_name || 'user'
        }
      };
    } catch (error) {
      throw error;
    }
  }
 
  // Register new user
  async register(userData) {
    try {
      const { firstName, lastName, email, password, birthday, phone, instrument, address, identityProof } = userData;

      // Check if user already exists
      const [existingUser] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUser.length > 0) {
        throw new Error('User already exists with this email');
      }

      // Hash password using bcrypt (10 rounds is a good balance of security and performance)
      const passwordHash = await bcrypt.hash(password, 10);

      // Find role_id for 'user' role in DB
      const [roleRows] = await pool.execute('SELECT role_id FROM roles WHERE role_name = ?', ['user']);
      const roleId = (roleRows && roleRows.length > 0) ? roleRows[0].role_id : 3; // fallback to 3

      // Insert new user with all membership fields
      const [result] = await pool.execute(`
        INSERT INTO users (first_name, last_name, email, password_hash, role_id, birthday, phone, instrument, address, identity_proof)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        firstName, 
        lastName, 
        email, 
        passwordHash, 
        roleId,
        birthday || null,
        phone || null,
        instrument || null,
        address || null,
        identityProof || null
      ]);

      return {
        id: result.insertId,
        firstName,
        lastName,
        email,
        role: 'user'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, 
               u.is_blocked, r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.id = ?
      `, [userId]);

      if (rows.length === 0) {
        throw new Error('User not found');
      }

      const user = rows[0];
      return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role_name,
        isActive: user.is_active,
        isBlocked: user.is_blocked
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();