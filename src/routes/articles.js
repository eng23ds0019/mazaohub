const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { verifyToken } = require('../middleware/auth');

// Public Article endpoints
router.get('/', articleController.getAllArticles);
router.get('/categories', articleController.getAllCategories);
router.get('/:slug', articleController.getArticleBySlug);

// Admin Article CRUD endpoints (Protected)
router.post('/', verifyToken, articleController.createArticle);
router.put('/:id', verifyToken, articleController.updateArticle);
router.delete('/:id', verifyToken, articleController.deleteArticle);

// Admin Category CRUD endpoints (Protected)
router.post('/categories', verifyToken, articleController.createCategory);
router.delete('/categories/:id', verifyToken, articleController.deleteCategory);

module.exports = router;
