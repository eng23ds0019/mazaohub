const db = require('../config/db');

// Helper to generate slugs
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

// PUBLIC ENDPOINTS

exports.getAllArticles = async (req, res) => {
  const { category, search, limit = 20, offset = 0 } = req.query;
  let sql = `
    SELECT a.*, c.name as category_name, c.slug as category_slug 
    FROM articles a 
    LEFT JOIN categories c ON a.category_id = c.id
  `;
  const params = [];
  let whereClauses = [];

  if (category) {
    params.push(category);
    whereClauses.push(`c.slug = $${params.length}`);
  }

  if (search) {
    const keywords = search.split(/\s+/).filter(w => w.trim().length > 0);
    if (keywords.length > 0) {
      const likeOp = db.getDbType() === 'postgres' ? 'ILIKE' : 'LIKE';
      const keywordClauses = [];
      keywords.forEach(keyword => {
        params.push(`%${keyword}%`);
        const pIdx = params.length;
        keywordClauses.push(`(a.title ${likeOp} $${pIdx} OR a.summary ${likeOp} $${pIdx} OR a.content_html ${likeOp} $${pIdx} OR a.slug ${likeOp} $${pIdx})`);
      });
      whereClauses.push(`(${keywordClauses.join(' AND ')})`);
    }
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY a.published_at DESC';

  // Add pagination limits
  params.push(parseInt(limit));
  sql += ` LIMIT $${params.length}`;
  
  params.push(parseInt(offset));
  sql += ` OFFSET $${params.length}`;

  try {
    const articles = await db.query(sql, params);
    res.json({ success: true, count: articles.length, articles });
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve articles' });
  }
};

exports.getArticleBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const articles = await db.query(
      `SELECT a.*, c.name as category_name, c.slug as category_slug 
       FROM articles a 
       LEFT JOIN categories c ON a.category_id = c.id 
       WHERE a.slug = $1`,
      [slug]
    );

    if (articles.length === 0) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    res.json({ success: true, article: articles[0] });
  } catch (err) {
    console.error('Error fetching article:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve article' });
  }
};

// ADMIN ENDPOINTS

exports.createArticle = async (req, res) => {
  let { title, slug, summary, content_html, image_url, category_id, seo_title, seo_desc } = req.body;

  if (!title || !content_html) {
    return res.status(400).json({ success: false, error: 'Title and content are required' });
  }

  if (!slug) {
    slug = slugify(title);
  } else {
    slug = slugify(slug);
  }

  // Ensure unique slug
  try {
    const existing = await db.query('SELECT id FROM articles WHERE slug = $1', [slug]);
    if (existing.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const sql = `
      INSERT INTO articles (title, slug, summary, content_html, image_url, category_id, seo_title, seo_desc)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const params = [
      title,
      slug,
      summary || '',
      content_html,
      image_url || '',
      category_id ? parseInt(category_id) : null,
      seo_title || title,
      seo_desc || (summary ? summary.substring(0, 160) : '')
    ];

    if (db.getDbType() === 'postgres') {
      const result = await db.run(sql + ' RETURNING id', params);
      res.status(201).json({ success: true, message: 'Article created', id: result.rows[0].id, slug });
    } else {
      const result = await db.run(sql, params);
      res.status(201).json({ success: true, message: 'Article created', id: result.lastID, slug });
    }
  } catch (err) {
    console.error('Error creating article:', err);
    res.status(500).json({ success: false, error: 'Failed to create article' });
  }
};

exports.updateArticle = async (req, res) => {
  const { id } = req.params;
  let { title, slug, summary, content_html, image_url, category_id, seo_title, seo_desc } = req.body;

  if (!title || !content_html) {
    return res.status(400).json({ success: false, error: 'Title and content are required' });
  }

  slug = slugify(slug || title);

  try {
    // Check if another article has this slug
    const existing = await db.query('SELECT id FROM articles WHERE slug = $1 AND id != $2', [slug, id]);
    if (existing.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    await db.run(
      `UPDATE articles 
       SET title = $1, slug = $2, summary = $3, content_html = $4, image_url = $5, 
           category_id = $6, seo_title = $7, seo_desc = $8
       WHERE id = $9`,
      [
        title,
        slug,
        summary || '',
        content_html,
        image_url || '',
        category_id ? parseInt(category_id) : null,
        seo_title || title,
        seo_desc || '',
        parseInt(id)
      ]
    );

    res.json({ success: true, message: 'Article updated successfully', slug });
  } catch (err) {
    console.error('Error updating article:', err);
    res.status(500).json({ success: false, error: 'Failed to update article' });
  }
};

exports.deleteArticle = async (req, res) => {
  const { id } = req.params;
  try {
    const articles = await db.query('SELECT * FROM articles WHERE id = $1', [parseInt(id)]);
    let trashId = null;
    if (articles.length > 0) {
      const art = articles[0];
      const sql = "INSERT INTO trash_bin (item_type, original_id, title, data_json) VALUES ('article', $1, $2, $3)";
      const params = [art.id, art.title, JSON.stringify(art)];
      if (db.getDbType() === 'postgres') {
        const result = await db.run(sql + ' RETURNING id', params);
        trashId = result.rows[0].id;
      } else {
        const result = await db.run(sql, params);
        trashId = result.lastID;
      }
    }
    await db.run('DELETE FROM articles WHERE id = $1', [parseInt(id)]);
    res.json({ success: true, message: 'Article archived to trash bin', trashId });
  } catch (err) {
    console.error('Error deleting article:', err);
    res.status(500).json({ success: false, error: 'Failed to delete article' });
  }
};

// CATEGORY ENDPOINTS

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json({ success: true, categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve categories' });
  }
};

exports.createCategory = async (req, res) => {
  const { name, slug } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }

  const catSlug = slugify(slug || name);

  try {
    const existing = await db.query('SELECT id FROM categories WHERE slug = $1', [catSlug]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Category slug already exists' });
    }

    const sql = 'INSERT INTO categories (name, slug) VALUES ($1, $2)';
    const params = [name, catSlug];

    if (db.getDbType() === 'postgres') {
      const result = await db.run(sql + ' RETURNING id', params);
      res.status(201).json({ success: true, message: 'Category created', id: result.rows[0].id, slug: catSlug });
    } else {
      const result = await db.run(sql, params);
      res.status(201).json({ success: true, message: 'Category created', id: result.lastID, slug: catSlug });
    }
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const categories = await db.query('SELECT * FROM categories WHERE id = $1', [parseInt(id)]);
    let trashId = null;
    if (categories.length > 0) {
      const cat = categories[0];
      const sql = "INSERT INTO trash_bin (item_type, original_id, title, data_json) VALUES ('category', $1, $2, $3)";
      const params = [cat.id, cat.name, JSON.stringify(cat)];
      if (db.getDbType() === 'postgres') {
        const result = await db.run(sql + ' RETURNING id', params);
        trashId = result.rows[0].id;
      } else {
        const result = await db.run(sql, params);
        trashId = result.lastID;
      }
    }
    await db.run('DELETE FROM categories WHERE id = $1', [parseInt(id)]);
    res.json({ success: true, message: 'Category archived to trash bin', trashId });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
};
