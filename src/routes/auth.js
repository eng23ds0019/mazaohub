const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.getMe);

// ── Setup / Reset Admin ──────────────────────────────────────────────────────
// Visit: /api/auth/setup?key=mazaohub2024
// Creates or resets the admin user with credentials from env vars
router.get('/setup', authController.setup);

module.exports = router;
