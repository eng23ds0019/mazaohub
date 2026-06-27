const db = require('../config/db');

// SECTION ENDPOINTS

exports.getAllSections = async (req, res) => {
  try {
    const sections = await db.query('SELECT * FROM sections');
    res.json({ success: true, sections });
  } catch (err) {
    console.error('Error fetching all sections:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve all sections' });
  }
};

exports.getPageSections = async (req, res) => {
  // Support nested slugs like home/why, service/inputs-dealer (comes from wildcard route)
  const page_slug = req.params[0] || req.params.page_slug;
  try {
    const sections = await db.query(
      'SELECT * FROM sections WHERE page_slug = $1',
      [page_slug]
    );
    res.json({ success: true, page_slug, sections });
  } catch (err) {
    console.error('Error fetching page sections:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve page sections' });
  }
};

exports.updatePageSection = async (req, res) => {
  // Support wildcard routes: sections/home/why/main → params[0] = 'home/why/main'
  const rawParam = req.params[0] || '';
  const lastSlash = rawParam.lastIndexOf('/');
  const page_slug = lastSlash > -1 ? rawParam.substring(0, lastSlash) : (req.params.page_slug || rawParam);
  const section_id = lastSlash > -1 ? rawParam.substring(lastSlash + 1) : (req.params.section_id || 'main');
  const { title, content_html } = req.body;

  if (!content_html) {
    return res.status(400).json({ success: false, error: 'Content HTML is required' });
  }

  try {
    // Check if section exists
    const existing = await db.query(
      'SELECT id FROM sections WHERE page_slug = $1 AND section_id = $2',
      [page_slug, section_id]
    );

    if (existing.length === 0) {
      // Create it
      const sql = 'INSERT INTO sections (page_slug, section_id, title, content_html) VALUES ($1, $2, $3, $4)';
      const params = [page_slug, section_id, title || '', content_html];
      
      if (db.getDbType() === 'postgres') {
        await db.run(sql + ' RETURNING id', params);
      } else {
        await db.run(sql, params);
      }
    } else {
      // Update it
      await db.run(
        `UPDATE sections 
         SET title = $1, content_html = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE page_slug = $3 AND section_id = $4`,
        [title || '', content_html, page_slug, section_id]
      );
    }

    res.json({ success: true, message: 'Section updated successfully' });
  } catch (err) {
    console.error('Error updating section:', err);
    res.status(500).json({ success: false, error: 'Failed to update page section' });
  }
};

// SETTINGS ENDPOINTS

exports.getSettings = async (req, res) => {
  try {
    const settingsRows = await db.query('SELECT * FROM settings');
    // Map array of {key, value} to a single object
    const settings = settingsRows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve settings' });
  }
};

exports.updateSettings = async (req, res) => {
  const newSettings = req.body; // Expect an object with key-value pairs

  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid settings object' });
  }

  try {
    for (const [key, value] of Object.entries(newSettings)) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      const existing = await db.query('SELECT key FROM settings WHERE key = $1', [key]);
      if (existing.length === 0) {
        await db.run('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, valStr]);
      } else {
        await db.run('UPDATE settings SET value = $1 WHERE key = $2', [valStr, key]);
      }
    }
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};

// RUN AI COPILOT AGENT (BACKEND REASONING ENGINE)
exports.runCopilotAgent = async (req, res) => {
  const apiKey = req.headers['x-gemini-key'] || req.body.apiKey || process.env.GEMINI_API_KEY;
  const modelName = req.headers['x-gemini-model'] || req.body.modelName || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'GEMINI_API_KEY is not configured on the backend server (.env file) and no key was supplied by the client. Please provide a key.'
    });
  }

  const { prompt, history } = req.body;
  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  try {
    // 1. Gather site state
    const settingsRows = await db.query('SELECT * FROM settings');
    const settings = settingsRows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const sectionsRows = await db.query('SELECT * FROM sections');
    const sections = sectionsRows.map(s => {
      const isLarge = s.content_html.length > 50000;
      let headings = [];
      let images = [];
      if (isLarge) {
        // Regex extraction of headings and image paths to keep context token-efficient
        const headingMatches = s.content_html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || [];
        headings = headingMatches.map(h => h.replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 30);
        
        const imgMatches = s.content_html.match(/<img\s+[^>]*src=["']([^"']+)["']/gi) || [];
        images = imgMatches.map(img => {
          const match = img.match(/src=["']([^"']+)["']/i);
          return match ? match[1] : null;
        }).filter(Boolean);
      }

      return {
        page_slug: s.page_slug,
        section_id: s.section_id,
        title: s.title,
        length: s.content_html.length,
        content_html: isLarge ? undefined : s.content_html,
        headings: isLarge ? headings : undefined,
        images: isLarge ? images : undefined
      };
    });

    const articlesRows = await db.query('SELECT * FROM articles');
    const articles = articlesRows.map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      image_url: a.image_url,
      category_id: a.category_id
    }));

    const categories = await db.query('SELECT * FROM categories');
    const mediaRows = await db.query('SELECT * FROM media');
    const media = mediaRows.map(m => ({
      name: m.file_name,
      url: m.file_url
    }));

    const siteState = { settings, sections, articles, categories, media };

    // 2. Prepare system instruction
    const systemInstruction = `You are the MazaoHub AI Copilot, a professional database-connected site editor.
You receive natural language commands to update page content, brand theme colors, contact settings, and write or edit blog articles.
You MUST analyze the user command, compare it against the current site state, and respond with a strict JSON output representing the necessary database mutations.

REPLACE_TEXT RULES:
- For modifying text on large sections (like page_slug "home" and "offer" which have no content_html in state), use the "replace_text" action.
- The "target" string MUST match a unique text sequence exactly, including capitalization and symbols. Ensure it is unique to prevent unwanted replacements.
- If you edit text on small sections that DO have "content_html" in state, you can either use "replace_text" OR replace the entire section markup using "update_section_html".

THEME COLORS MAP:
If the user requests brand color edits, update the settings keys:
* theme_canopy: primary background (dark green, e.g. #06280c)
* theme_forest: secondary background (forest, e.g. #084012)
* theme_leaf: brand primary (green, e.g. #126c22)
* theme_bright: brand accent (signal/lime green, e.g. #14c834)
* theme_gold: gold accent (e.g. #e8b23a)
* theme_orange: orange accent (e.g. #e8732a)
* theme_soil: main background color (dark soil, e.g. #070b08)

OUTPUT SCHEMA:
You must output a single JSON object (with no markdown wrapping, just raw JSON text) matching this format:
{
  "explanation": "Human readable summary of what actions will be executed.",
  "actions": [
    {
      "type": "update_setting",
      "key": "site_title",
      "value": "New Site Title"
    },
    {
      "type": "replace_text",
      "page_slug": "home",
      "section_id": "main",
      "target": "Smallholders feed the world.",
      "replacement": "Farming Re-imagined!"
    },
    {
      "type": "replace_image",
      "page_slug": "home",
      "section_id": "main",
      "old_src": "/uploads/old_pic.png",
      "new_src": "/uploads/new_pic.png"
    },
    {
      "type": "update_section_html",
      "page_slug": "pricing",
      "section_id": "main",
      "title": "Pricing Options",
      "content_html": "<section>New HTML here...</section>"
    },
    {
      "type": "create_article",
      "title": "New Blog Title",
      "slug": "new-blog-title",
      "summary": "SEO summary...",
      "content_html": "<p>Article body content here</p>",
      "category_id": 1,
      "image_url": "/uploads/image.png"
    },
    {
      "type": "update_article_image",
      "title": "Existing Blog Title",
      "image_url": "/uploads/new-featured-image.png"
    },
    {
      "type": "replace_text_in_article",
      "title": "Existing Blog Title",
      "target": "text to replace inside article body",
      "replacement": "replacement text inside article body"
    },
    {
      "type": "delete_article",
      "title": "Blog Post Title to Delete"
    }
  ]
}

CURRENT SITE STATE:
- Settings keys & values: ${JSON.stringify(siteState.settings)}
- Categories: ${JSON.stringify(siteState.categories)}
- Media uploaded files: ${JSON.stringify(siteState.media)}
- Page sections info: ${JSON.stringify(siteState.sections)}
- Articles in system (use titles to match for updates/deletions): ${JSON.stringify(siteState.articles)}

IMPORTANT:
- Output only valid JSON inside the response.
- Do not output code block wrappers like \`\`\`json. Return the JSON object directly.
- Verify that every target string exists in the section's text.`;

    const contents = history || [];
    contents.push({
      role: 'user',
      parts: [{ text: `User request: "${prompt}"` }]
    });

    // 3. Sequential Fallback calls to Gemini, prioritizing modern supported models like gemini-2.5-flash
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`
    ];

    let geminiRes = null;
    let errText = '';

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              responseMimeType: 'application/json'
            }
          })
        });

        if (response.ok) {
          geminiRes = response;
          console.log(`[Copilot] API call succeeded on: ${url.split('?')[0]}`);
          break;
        } else {
          errText = await response.text();
          console.warn(`[Copilot] API call failed on: ${url.split('?')[0]} with status ${response.status}. Details: ${errText}`);
        }
      } catch (fetchErr) {
        errText = fetchErr.message;
        console.error(`[Copilot] API call network error on: ${url.split('?')[0]}. Error: ${errText}`);
      }
    }

    if (!geminiRes) {
      // Diagnostic ListModels call
      let diagDetails = `Last connection error:\n${errText}`;
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          const activeModels = (listData.models || []).map(m => m.name.replace('models/', ''));
          diagDetails += `\n\nDiagnostic: Your API Key currently supports the following models:\n${activeModels.join(', ') || 'No active models found.'}`;
        }
      } catch (dErr) {}

      return res.status(500).json({
        success: false,
        error: 'Failed to communicate with the Gemini API. Verify Key or billing status.',
        details: diagDetails
      });
    }

    const resData = await geminiRes.json();
    const replyText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      return res.status(500).json({ success: false, error: 'Empty response returned by AI agent.' });
    }

    // 4. Parse JSON actions
    let resObj;
    try {
      resObj = JSON.parse(replyText.trim());
    } catch (pe) {
      let cleanText = replyText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json/i, '').replace(/```$/, '').trim();
      }
      resObj = JSON.parse(cleanText);
    }

    const actions = resObj.actions || [];
    const executionLogs = [];

    // 5. Execute DB Mutations sequentially on backend
    for (const action of actions) {
      try {
        if (action.type === 'update_setting') {
          const existing = await db.query('SELECT key FROM settings WHERE key = $1', [action.key]);
          if (existing.length === 0) {
            await db.run('INSERT INTO settings (key, value) VALUES ($1, $2)', [action.key, action.value]);
          } else {
            await db.run('UPDATE settings SET value = $1 WHERE key = $2', [action.value, action.key]);
          }
          executionLogs.push({ success: true, message: `Updated setting [${action.key}] to "${action.value}"` });
        }
        else if (action.type === 'replace_text' || action.type === 'replace_image') {
          const pageSlug = action.page_slug;
          const sectionId = action.section_id || 'main';
          const rows = await db.query('SELECT * FROM sections WHERE page_slug = $1 AND section_id = $2', [pageSlug, sectionId]);
          const section = rows[0];

          if (!section) {
            throw new Error(`Section [${pageSlug}/${sectionId}] not found in database`);
          }

          const targetStr = action.type === 'replace_text' ? action.target : action.old_src;
          const replacementStr = action.type === 'replace_text' ? action.replacement : action.new_src;

          if (!section.content_html.includes(targetStr)) {
            throw new Error(`Target text/image source block not found inside section HTML`);
          }

          const newHtml = section.content_html.replaceAll(targetStr, replacementStr);
          await db.run(
            'UPDATE sections SET content_html = $1, updated_at = CURRENT_TIMESTAMP WHERE page_slug = $2 AND section_id = $3',
            [newHtml, pageSlug, sectionId]
          );
          executionLogs.push({ success: true, message: `Replaced content in section [${pageSlug}]` });
        }
        else if (action.type === 'update_section_html') {
          const pageSlug = action.page_slug;
          const sectionId = action.section_id || 'main';
          const title = action.title || '';

          const existing = await db.query('SELECT id FROM sections WHERE page_slug = $1 AND section_id = $2', [pageSlug, sectionId]);
          if (existing.length === 0) {
            await db.run('INSERT INTO sections (page_slug, section_id, title, content_html) VALUES ($1, $2, $3, $4)', [pageSlug, sectionId, title, action.content_html]);
          } else {
            await db.run(
              'UPDATE sections SET title = $1, content_html = $2, updated_at = CURRENT_TIMESTAMP WHERE page_slug = $3 AND section_id = $4',
              [title, action.content_html, pageSlug, sectionId]
            );
          }
          executionLogs.push({ success: true, message: `Overwrote section HTML content for [${pageSlug}]` });
        }
        else if (action.type === 'create_article') {
          await db.run(
            'INSERT INTO articles (title, slug, summary, content_html, category_id, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
            [action.title, action.slug || '', action.summary || '', action.content_html, action.category_id || 1, action.image_url || '']
          );
          executionLogs.push({ success: true, message: `Published article: "${action.title}"` });
        }
        else if (action.type === 'update_article') {
          await db.run(
            'UPDATE articles SET title = $1, slug = $2, summary = $3, content_html = $4, category_id = $5, image_url = $6 WHERE id = $7',
            [action.title, action.slug || '', action.summary || '', action.content_html, action.category_id || 1, action.image_url || '', action.id]
          );
          executionLogs.push({ success: true, message: `Updated article details: "${action.title}"` });
        }
        else if (action.type === 'update_article_image') {
          const title = action.title;
          const imageUrl = action.image_url;
          let articleId = action.article_id;
          if (!articleId && title) {
            const rows = await db.query('SELECT id FROM articles WHERE title = $1', [title]);
            if (rows.length > 0) articleId = rows[0].id;
          }
          if (articleId) {
            await db.run('UPDATE articles SET image_url = $1 WHERE id = $2', [imageUrl, articleId]);
            executionLogs.push({ success: true, message: `Updated image URL for article ID ${articleId}` });
          } else {
            throw new Error(`Article titled "${title}" not found`);
          }
        }
        else if (action.type === 'delete_article') {
          const title = action.title;
          let articleId = action.article_id;
          if (!articleId && title) {
            const rows = await db.query('SELECT id, title, slug, summary, content_html, image_url, category_id, published_at, seo_title, seo_desc FROM articles WHERE title = $1', [title]);
            if (rows.length > 0) {
              const art = rows[0];
              articleId = art.id;
              // Soft delete: Insert into trash bin prior to deleting
              const dataJson = JSON.stringify(art);
              await db.run(
                'INSERT INTO trash_bin (item_type, original_id, title, data_json) VALUES ($1, $2, $3, $4)',
                ['article', art.id, art.title, dataJson]
              );
            }
          }
          if (articleId) {
            await db.run('DELETE FROM articles WHERE id = $1', [articleId]);
            executionLogs.push({ success: true, message: `Soft-deleted article ID ${articleId}` });
          } else {
            throw new Error(`Article titled "${title}" not found`);
          }
        }
        else if (action.type === 'replace_text_in_article') {
          const title = action.title;
          let articleId = action.article_id;
          if (!articleId && title) {
            const rows = await db.query('SELECT id, content_html FROM articles WHERE title = $1', [title]);
            if (rows.length > 0) {
              const art = rows[0];
              articleId = art.id;
              const newHtml = art.content_html.replaceAll(action.target, action.replacement);
              await db.run('UPDATE articles SET content_html = $1 WHERE id = $2', [newHtml, articleId]);
              executionLogs.push({ success: true, message: `Replaced text inside article ID ${articleId}` });
            }
          }
          if (!articleId) {
            throw new Error(`Article titled "${title}" not found`);
          }
        }
      } catch (actionErr) {
        executionLogs.push({ success: false, message: `Failed executing action: ${actionErr.message}` });
      }
    }

    res.json({
      success: true,
      reply_text: replyText,
      explanation: resObj.explanation,
      actions: actions,
      logs: executionLogs
    });

  } catch (err) {
    console.error('Error running backend copilot agent:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error running AI agent' });
  }
};

exports.getCopilotStatus = (req, res) => {
  res.json({
    success: true,
    configured: !!process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  });
};

// TRASH BIN CONTROLLERS

exports.getTrashBin = async (req, res) => {
  try {
    const trash = await db.query('SELECT * FROM trash_bin ORDER BY deleted_at DESC');
    res.json({ success: true, trash });
  } catch (err) {
    console.error('Error fetching trash bin:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve trash bin items' });
  }
};

exports.restoreTrashItem = async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db.query('SELECT * FROM trash_bin WHERE id = $1', [parseInt(id)]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trash item not found' });
    }

    const item = rows[0];
    const data = JSON.parse(item.data_json);

    if (item.item_type === 'article') {
      // Re-insert article
      const sql = `
        INSERT INTO articles (id, title, slug, summary, content_html, image_url, category_id, published_at, seo_title, seo_desc)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      const params = [
        data.id,
        data.title,
        data.slug,
        data.summary || '',
        data.content_html,
        data.image_url || '',
        data.category_id || null,
        data.published_at || new Date().toISOString(),
        data.seo_title || data.title,
        data.seo_desc || ''
      ];
      await db.run(sql, params);
    } else if (item.item_type === 'category') {
      // Re-insert category
      const sql = `
        INSERT INTO categories (id, name, slug)
        VALUES ($1, $2, $3)
      `;
      const params = [
        data.id,
        data.name,
        data.slug
      ];
      await db.run(sql, params);
    }

    // Remove from trash bin
    await db.run('DELETE FROM trash_bin WHERE id = $1', [parseInt(id)]);
    res.json({ success: true, message: 'Item successfully restored' });
  } catch (err) {
    console.error('Error restoring trash item:', err);
    res.status(500).json({ success: false, error: 'Failed to restore item: ' + err.message });
  }
};

exports.deleteTrashItemPermanently = async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM trash_bin WHERE id = $1', [parseInt(id)]);
    res.json({ success: true, message: 'Item deleted permanently' });
  } catch (err) {
    console.error('Error permanently deleting trash item:', err);
    res.status(500).json({ success: false, error: 'Failed to permanently delete item' });
  }
};

exports.emptyTrashBin = async (req, res) => {
  try {
    await db.run('DELETE FROM trash_bin');
    res.json({ success: true, message: 'Trash bin successfully emptied' });
  } catch (err) {
    console.error('Error emptying trash bin:', err);
    res.status(500).json({ success: false, error: 'Failed to empty trash bin' });
  }
};

// ==================== OFFLINE AI WEBSITE EDITOR API CONTROLLERS ====================

const fs = require('fs');
const path = require('path');

const LIVE_FILE = path.join(__dirname, '../../public/index.html');
const STAGING_FILE = path.join(__dirname, '../../public/index.staging.html');
const BACKUP_DIR = path.join(__dirname, '../../public/backups');

// Helper to make sure staging copy exists
function _ensureStagingExists() {
  if (!fs.existsSync(STAGING_FILE)) {
    if (!fs.existsSync(LIVE_FILE)) {
      throw new Error(`Live file not found at ${LIVE_FILE}`);
    }
    fs.copyFileSync(LIVE_FILE, STAGING_FILE);
  }
}

// Helper to omit large base64 image data so token consumption is minimized
function _stripImagesForDisplay(html) {
  return html.replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE_DATA_OMITTED_FOR_EDITING]');
}

// Utility escaping regexp
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Unified diff algorithm implementation
function getDiff(oldStr, newStr) {
  const oldLines = oldStr.split(/\r?\n/);
  const newLines = newStr.split(/\r?\n/);
  let i = 0, j = 0;
  const result = [];
  
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++;
      j++;
    } else {
      let foundSync = false;
      for (let offset = 1; offset <= 15; offset++) {
        if (i + offset < oldLines.length && oldLines[i + offset] === newLines[j]) {
          for (let k = 0; k < offset; k++) {
            result.push(`- ${oldLines[i + k]}`);
          }
          i += offset;
          foundSync = true;
          break;
        }
        if (j + offset < newLines.length && oldLines[i] === newLines[j + offset]) {
          for (let k = 0; k < offset; k++) {
            result.push(`+ ${newLines[j + k]}`);
          }
          j += offset;
          foundSync = true;
          break;
        }
      }
      if (!foundSync) {
        if (i < oldLines.length) {
          result.push(`- ${oldLines[i]}`);
          i++;
        }
        if (j < newLines.length) {
          result.push(`+ ${newLines[j]}`);
          j++;
        }
      }
    }
  }
  return result.join('\n');
}

// Extract view sections from index.html
function syncDatabaseFromHtml(htmlContent) {
  const viewRegex = /<div\s+[^>]*class=["']view["'][^>]*data-route=["']([^"']+)["'][^>]*>/gi;
  let match;
  const updates = [];
  
  while ((match = viewRegex.exec(htmlContent)) !== null) {
    const pageSlug = match[1];
    const startIdx = match.index;
    const tagEndIdx = startIdx + match[0].length;
    
    let depth = 0;
    let idx = tagEndIdx;
    let endIdx = null;
    
    const openRe = /<div(\s|>)/gi;
    const closeRe = /<\/div>/gi;
    
    while (true) {
      openRe.lastIndex = idx;
      closeRe.lastIndex = idx;
      
      const o = openRe.exec(htmlContent);
      const c = closeRe.exec(htmlContent);
      
      if (!c) break;
      
      if (o && o.index < c.index) {
        depth++;
        idx = o.index + o[0].length;
      } else {
        if (depth === 0) {
          endIdx = c.index;
          break;
        } else {
          depth--;
          idx = c.index + c[0].length;
        }
      }
    }
    
    if (endIdx !== null) {
      const innerHtml = htmlContent.substring(tagEndIdx, endIdx);
      updates.push({ pageSlug, contentHtml: innerHtml.trim() });
    }
  }
  return updates;
}

// 1. List editable sections (ids)
exports.listEditorSections = async (req, res) => {
  try {
    _ensureStagingExists();
    const html = fs.readFileSync(STAGING_FILE, 'utf8');
    const ids = [];
    const regex = /\bid="([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    res.json({ success: true, sections: ids });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 2. Read specific HTML section by ID
exports.readEditorSection = async (req, res) => {
  const { id } = req.params;
  try {
    _ensureStagingExists();
    const html = fs.readFileSync(STAGING_FILE, 'utf8');
    
    const match = html.match(new RegExp('<([a-zA-Z0-9]+)[^>]*\\bid="' + escapeRegExp(id) + '"[^>]*>', 'i'));
    if (!match) {
      return res.status(404).json({ success: false, error: `No section with id='${id}' was found.` });
    }
    
    const tagName = match[1];
    const start = match.index;
    const tagEnd = start + match[0].length;
    
    let depth = 0;
    const openRe = new RegExp('<' + tagName + '(\\s|>)', 'gi');
    const closeRe = new RegExp('</' + tagName + '>', 'gi');
    
    let idx = tagEnd;
    let end = null;
    
    while (true) {
      openRe.lastIndex = idx;
      closeRe.lastIndex = idx;
      
      const o = openRe.exec(html);
      const c = closeRe.exec(html);
      
      if (!c) break;
      
      if (o && o.index < c.index) {
        depth++;
        idx = o.index + o[0].length;
      } else {
        if (depth === 0) {
          end = c.index + c[0].length;
          break;
        } else {
          depth--;
          idx = c.index + c[0].length;
        }
      }
    }
    
    if (end === null) {
      return res.status(500).json({ success: false, error: `Found start of section '${id}' but could not locate its closing tag.` });
    }
    
    const sectionHtml = html.substring(start, end);
    const displayHtml = _stripImagesForDisplay(sectionHtml);
    
    res.json({ success: true, html: displayHtml, fullLength: sectionHtml.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 3. Propose find-and-replace text in staging
exports.replaceEditorText = async (req, res) => {
  const { findText, replaceText } = req.body;
  if (!findText) {
    return res.status(400).json({ success: false, error: 'findText is required.' });
  }
  try {
    _ensureStagingExists();
    let html = fs.readFileSync(STAGING_FILE, 'utf8');
    
    const occurrences = (html.split(findText).length - 1);
    if (occurrences === 0) {
      return res.status(400).json({ success: false, error: 'No exact match found for that search text.' });
    }
    if (occurrences > 1) {
      return res.status(400).json({ success: false, error: `That text matches ${occurrences} times. Include more context to make it unique.` });
    }
    
    const updatedHtml = html.replace(findText, replaceText || '');
    fs.writeFileSync(STAGING_FILE, updatedHtml, 'utf8');
    
    res.json({ success: true, message: 'Done. Replaced text in STAGING.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 4. Preview changes staging vs live
exports.previewEditorChanges = async (req, res) => {
  try {
    _ensureStagingExists();
    if (!fs.existsSync(LIVE_FILE)) {
      return res.status(400).json({ success: false, error: 'Live index.html file not found.' });
    }
    const live = _stripImagesForDisplay(fs.readFileSync(LIVE_FILE, 'utf8'));
    const staging = _stripImagesForDisplay(fs.readFileSync(STAGING_FILE, 'utf8'));
    
    const diff = getDiff(live, staging);
    res.json({ success: true, diff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 5. Publish staging copy to live website (backs up first and syncs DB)
exports.publishEditorToLive = async (req, res) => {
  const { confirm } = req.body;
  if (!confirm) {
    return res.status(400).json({ success: false, error: 'Confirmation required to publish.' });
  }
  try {
    _ensureStagingExists();
    
    // Ensure backups dir exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14);
    const backupPath = path.join(BACKUP_DIR, `index_backup_${timestamp}.html`);
    
    if (fs.existsSync(LIVE_FILE)) {
      fs.copyFileSync(LIVE_FILE, backupPath);
    }
    
    // Sync staging file to live path
    fs.copyFileSync(STAGING_FILE, LIVE_FILE);
    
    // DB sync
    const liveHtmlContent = fs.readFileSync(LIVE_FILE, 'utf8');
    const views = syncDatabaseFromHtml(liveHtmlContent);
    
    for (const v of views) {
      await db.run(
        `UPDATE sections 
         SET content_html = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE page_slug = $2 AND section_id = 'main'`,
        [v.contentHtml, v.pageSlug]
      );
    }
    
    // Also sync title and description settings
    const titleMatch = liveHtmlContent.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const siteTitle = titleMatch[1].trim();
      const existing = await db.query('SELECT key FROM settings WHERE key = $1', ['site_title']);
      if (existing.length === 0) {
        await db.run('INSERT INTO settings (key, value) VALUES ($1, $2)', ['site_title', siteTitle]);
      } else {
        await db.run('UPDATE settings SET value = $1 WHERE key = $2', [siteTitle, 'site_title']);
      }
    }
    
    const descMatch = liveHtmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || 
                      liveHtmlContent.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    if (descMatch) {
      const siteDesc = descMatch[1].trim();
      const existing = await db.query('SELECT key FROM settings WHERE key = $1', ['site_description']);
      if (existing.length === 0) {
        await db.run('INSERT INTO settings (key, value) VALUES ($1, $2)', ['site_description', siteDesc]);
      } else {
        await db.run('UPDATE settings SET value = $1 WHERE key = $2', [siteDesc, 'site_description']);
      }
    }
    
    res.json({ success: true, message: 'Published successfully and updated dynamic CMS.', backupFile: path.basename(backupPath) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 6. List backups
exports.listEditorBackups = async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('index_backup_') && f.endsWith('.html'))
      .sort()
      .reverse();
    res.json({ success: true, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 7. Restore backup
exports.restoreEditorBackup = async (req, res) => {
  const { backupFilename, confirm } = req.body;
  if (!backupFilename) {
    return res.status(400).json({ success: false, error: 'backupFilename is required.' });
  }
  if (!confirm) {
    return res.status(400).json({ success: false, error: 'confirm parameter is required.' });
  }
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Backup file '${backupFilename}' not found.` });
    }
    
    fs.copyFileSync(backupPath, LIVE_FILE);
    fs.copyFileSync(backupPath, STAGING_FILE);
    
    // Sync database
    const restoredContent = fs.readFileSync(LIVE_FILE, 'utf8');
    const views = syncDatabaseFromHtml(restoredContent);
    
    for (const v of views) {
      await db.run(
        `UPDATE sections 
         SET content_html = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE page_slug = $2 AND section_id = 'main'`,
        [v.contentHtml, v.pageSlug]
      );
    }
    
    res.json({ success: true, message: `Successfully restored live site and database from backup: ${backupFilename}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 8. Discard staging copy changes and overwrite with live copy
exports.discardEditorChanges = async (req, res) => {
  try {
    if (fs.existsSync(LIVE_FILE)) {
      fs.copyFileSync(LIVE_FILE, STAGING_FILE);
      res.json({ success: true, message: 'Discarded all staging changes and synchronized staging copy with live homepage.' });
    } else {
      res.status(404).json({ success: false, error: 'Live website index.html file not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

