const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { verifyToken } = require('../middleware/auth');

// Public route to submit forms
router.post('/', submissionController.submitForm);

// Admin routes to view/manage submissions (Protected)
router.get('/', verifyToken, submissionController.getAllSubmissions);
router.delete('/:id', verifyToken, submissionController.deleteSubmission);

module.exports = router;
