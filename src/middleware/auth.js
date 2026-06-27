const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mazaohub-secret-key-12345';

function verifyToken(req, res, next) {
  // Check authorization header first, then check cookie
  let token = null;
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    // Basic parser for cookies
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const parts = cookie.split('=');
      acc[parts[0].trim()] = (parts[1] || '').trim();
      return acc;
    }, {});
    token = cookies['admin_token'];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid or expired token' });
  }
}

module.exports = {
  verifyToken,
  JWT_SECRET
};
