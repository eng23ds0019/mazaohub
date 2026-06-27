const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    // ── Direct env-var admin bypass (works even if DB seed failed) ──
    const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@mazaohub.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mazaohub2024';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { id: 1, name: 'MazaoHub Admin', email: ADMIN_EMAIL, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
      });
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: { id: 1, name: 'MazaoHub Admin', email: ADMIN_EMAIL, role: 'admin' }
      });
    }
    // ────────────────────────────────────────────────────────────────

    // Standard DB lookup for any other users
    const users = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully' });
};

exports.getMe = (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

// ── Setup / Reset Admin ──────────────────────────────────────────────────────
// GET /api/auth/setup?key=mazaohub2024
// Safely creates or resets admin user — protected by secret key
exports.setup = async (req, res) => {
  const SETUP_KEY = process.env.SETUP_KEY || 'mazaohub2024';
  const { key } = req.query;

  if (key !== SETUP_KEY) {
    return res.status(403).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0d1a10;color:#fff;">
        <h2 style="color:#ef4444;">❌ Invalid setup key</h2>
        <p>Access denied. Provide the correct ?key= to run setup.</p>
      </body></html>
    `);
  }

  try {
    await db.createTables();

    const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@mazaohub.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Mazao@2024';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.length === 0) {
      await db.run(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['MazaoHub Admin', adminEmail, hashedPassword, 'admin']
      );
    } else {
      await db.run(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, adminEmail]
      );
    }

    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0d1a10;color:#fff;">
        <h2 style="color:#10b981;">✅ Admin setup complete!</h2>
        <p style="font-size:18px;margin:20px 0;">Your admin credentials are now active:</p>
        <table style="margin:0 auto;border-collapse:collapse;font-size:16px;">
          <tr><td style="padding:10px 20px;color:#9ca3af;text-align:right;">📧 Email:</td>
              <td style="padding:10px 20px;color:#fff;font-weight:bold;">${adminEmail}</td></tr>
          <tr><td style="padding:10px 20px;color:#9ca3af;text-align:right;">🔑 Password:</td>
              <td style="padding:10px 20px;color:#fff;font-weight:bold;">${adminPassword}</td></tr>
        </table>
        <a href="/admin" style="display:inline-block;margin-top:30px;padding:14px 36px;background:#10b981;color:#000;font-weight:700;border-radius:10px;text-decoration:none;font-size:16px;">
          🔐 Go to Admin Login →
        </a>
      </body></html>
    `);
  } catch (err) {
    console.error('Setup error:', err);
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0d1a10;color:#fff;">
        <h2 style="color:#ef4444;">❌ Setup failed</h2>
        <pre style="color:#f87171;text-align:left;display:inline-block;">${err.message}</pre>
      </body></html>
    `);
  }
};
