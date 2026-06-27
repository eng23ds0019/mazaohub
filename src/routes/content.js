const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const { verifyToken } = require('../middleware/auth');

// Public endpoints
router.get('/sections', contentController.getAllSections);
router.get('/sections/*', contentController.getPageSections);   // handles slugs with slashes
router.get('/settings', contentController.getSettings);

// Admin endpoints (Protected)
router.put('/sections/*/*', verifyToken, contentController.updatePageSection);  // handles slugs with slashes
router.put('/settings', verifyToken, contentController.updateSettings);
router.post('/copilot', verifyToken, contentController.runCopilotAgent);
router.get('/copilot/status', verifyToken, contentController.getCopilotStatus);

// Offline AI Website Editor endpoints
router.get('/editor/sections', verifyToken, contentController.listEditorSections);
router.get('/editor/read/:id', verifyToken, contentController.readEditorSection);
router.post('/editor/replace', verifyToken, contentController.replaceEditorText);
router.get('/editor/preview', verifyToken, contentController.previewEditorChanges);
router.post('/editor/publish', verifyToken, contentController.publishEditorToLive);
router.post('/editor/discard', verifyToken, contentController.discardEditorChanges);
router.get('/editor/backups', verifyToken, contentController.listEditorBackups);
router.post('/editor/backups/restore', verifyToken, contentController.restoreEditorBackup);

// Trash bin endpoints
router.get('/trash', verifyToken, contentController.getTrashBin);
router.post('/trash/:id/restore', verifyToken, contentController.restoreTrashItem);
router.delete('/trash/:id', verifyToken, contentController.deleteTrashItemPermanently);
router.delete('/trash', verifyToken, contentController.emptyTrashBin);

module.exports = router;
