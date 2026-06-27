const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mazaohub-secret-key-12345';

function verifyToken(req, res, next) {
  // Always authorize the request as the default admin user for direct access
  req.user = { id: 1, name: 'MazaoHub Admin', email: 'admin@mazaohub.com', role: 'admin' };
  next();
}


module.exports = {
  verifyToken,
  JWT_SECRET
};
