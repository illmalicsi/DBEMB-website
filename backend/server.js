const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const billingRoutes = require('./routes/billing');
const rolesRoutes = require('./routes/roles');
const instrumentsRoutes = require('./routes/instruments');
const instrumentItemsRoutes = require('./routes/instrumentItems');
// maintenanceRoutes removed per request
const membershipRoutes = require('./routes/membership');
const bookingsRoutes = require('./routes/bookings');
const servicesRoutes = require('./routes/services');
const notificationsRoutes = require('./routes/notifications');
const locationsRoutes = require('./routes/locations');
const bandPackagesRoutes = require('./routes/bandPackages');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Parse cookies so we can read HttpOnly session cookies
app.use(cookieParser());

// Serve uploads directory for identity documents
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
// Billing routes (invoices, payments, transactions)
app.use('/api/billing', billingRoutes);
// Payments route (simulated payment processing)
const paymentsRoutes = require('./routes/payments');
app.use('/api/payments', paymentsRoutes);
// Stripe payment route
const stripeRoutes = require('./routes/stripe');
app.use('/api/payments/stripe', stripeRoutes);
// Instrument requests routes (borrow, rent, instruments)
app.use('/api/instruments', instrumentsRoutes);
// Individual instrument items with serial numbers
app.use('/api/instrument-items', instrumentItemsRoutes);
// Maintenance routes removed
// Locations - simple listing of known locations
app.use('/api/locations', locationsRoutes);
// Membership approval routes
app.use('/api/membership', membershipRoutes);
// Bookings routes
app.use('/api/bookings', bookingsRoutes);
// Services catalog
app.use('/api/services', servicesRoutes);
// Band packages (pricing for band gigs)
app.use('/api/band-packages', bandPackagesRoutes);
// Notifications (persisted)
app.use('/api/notifications', notificationsRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Blue Eagles Music Band API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const startListening = (port) => {
  const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`🔐 Auth endpoint: http://localhost:${port}/api/auth`);
  });

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`⚠️ Port ${port} is already in use. Retrying on port ${nextPort}...`);
      setTimeout(() => startListening(nextPort), 150);
      return;
    }

    console.error('❌ Server listen error:', error);
    process.exit(1);
  });
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Cannot start server: Database connection failed');
      process.exit(1);
    }

    startListening(PORT);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();