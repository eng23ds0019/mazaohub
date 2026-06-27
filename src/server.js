const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./config/db');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Middleware for parsing requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Mount API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/content', require('./routes/content'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/media', require('./routes/media'));

// Fallback to index.html for frontend routing (if hash router is not used or for clean URLs)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'An internal server error occurred'
  });
});

// Startup logic
async function startServer() {
  try {
    // Connect to database and sync tables
    await db.initDb();
    await db.createTables();

    // ─── Always ensure admin user exists with correct credentials ───
    const bcrypt = require('bcryptjs');
    const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@mazaohub.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'mazaohub2024';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    console.log(`\n🔐 Seeding admin user: ${adminEmail}`);
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.length === 0) {
      await db.run(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['MazaoHub Admin', adminEmail, hashedPassword, 'admin']
      );
      console.log(`✅ Admin user CREATED: ${adminEmail} / ${adminPassword}`);
    } else {
      await db.run(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, adminEmail]
      );
      console.log(`✅ Admin password UPDATED: ${adminEmail} / ${adminPassword}`);
    }
    console.log(`🔐 Admin setup complete.\n`);
    // ────────────────────────────────────────────────────────────────


    // Discover local network IP for LAN sharing
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let lanIP = 'your-local-ip';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
          lanIP = iface.address;
          break;
        }
      }
      if (lanIP !== 'your-local-ip') break;
    }

    // Listen on ALL interfaces (0.0.0.0) so other devices on the same WiFi can connect
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n╔══════════════════════════════════════════════════════╗`);
      console.log(`║           🌿 MazaoHub Server is Running              ║`);
      console.log(`╠══════════════════════════════════════════════════════╣`);
      console.log(`║  💻  Local (this PC):   http://localhost:${PORT}         ║`);
      console.log(`║  📱  Network (WiFi):    http://${lanIP}:${PORT}    ║`);
      console.log(`║  🔑  Admin Panel:       http://${lanIP}:${PORT}/admin║`);
      console.log(`╠══════════════════════════════════════════════════════╣`);
      console.log(`║  Database: ${db.getDbType().toUpperCase().padEnd(42)}║`);
      console.log(`║  Share the Network URL with anyone on your WiFi!     ║`);
      console.log(`╚══════════════════════════════════════════════════════╝\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
