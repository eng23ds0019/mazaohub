// MazaoHub Admin CMS Interface Interactivity & API Integration

const tabs = ['overview', 'articles', 'categories', 'sections', 'media', 'submissions', 'settings', 'copilot', 'trash'];
let currentTab = 'overview';
let activeEditSection = { page_slug: 'home', section_id: 'main' };
let isVisualMode = true; // default Visual Editor mode

document.addEventListener('DOMContentLoaded', () => {
  // 1. Session check on startup
  checkSession();

  // 2. Bind login form submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // 3. Bind logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('logout', handleLogout);
    logoutBtn.onclick = handleLogout; // double backup
  }

  // 4. Tab selection routing
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      switchTab(tab);
    });
  });

  // 5. Article search filtration
  const artSearchInput = document.getElementById('article-search');
  if (artSearchInput) {
    artSearchInput.addEventListener('input', () => {
      const q = artSearchInput.value.trim();
      loadArticles(q);
      // Show / hide the "clear search to edit" notice
      const notice = document.getElementById('search-active-notice');
      if (notice) notice.classList.toggle('hide', q.length === 0);
    });
  }

  // 6. Section editor page select handler — also update "View Live" link
  const pageSelect = document.getElementById('section-select-page');
  if (pageSelect) {
    pageSelect.addEventListener('change', (e) => {
      activeEditSection.page_slug = e.target.value;
      loadSectionContent();
      // Update the live link button URL based on slug type
      const liveLink = document.getElementById('section-live-link');
      if (liveLink) {
        const slug = e.target.value;
        // Homepage sub-sections scroll within the homepage itself
        if (slug === 'home' || slug.startsWith('home/')) {
          liveLink.href = '/';
        } else if (slug === 'offer' || slug === 'ai' || slug === 'engines' ||
                   slug === 'global' || slug === 'pricing') {
          // These are also homepage scrolling sections
          liveLink.href = '/';
        } else {
          // All other pages/subpages use hash routing
          liveLink.href = `/#/${slug}`;
        }
      }
      // Also sync live link 2
      const liveLink2 = document.getElementById('section-live-link2');
      if (liveLink2 && liveLink) liveLink2.href = liveLink.href;
    });
  }

  // 6b. Section QUICK CARD click handler
  document.querySelectorAll('.section-quick-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.dataset.slug;
      const label = card.dataset.label;
      // Highlight active card
      document.querySelectorAll('.section-quick-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      // Set dropdown value
      const pageSelect = document.getElementById('section-select-page');
      if (pageSelect) {
        pageSelect.value = slug;
        // Trigger change event so live link updates
        pageSelect.dispatchEvent(new Event('change'));
      } else {
        // Directly load if no dropdown
        activeEditSection.page_slug = slug;
        loadSectionContent();
      }
      // Scroll smoothly to editor card
      const editorCard = document.querySelector('.editor-card');
      if (editorCard) editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 7. Section editor save handler
  const sectionEditorForm = document.getElementById('section-editor-form');
  if (sectionEditorForm) {
    sectionEditorForm.addEventListener('submit', saveSectionContent);
  }

  // 8. Categories form handler
  const catForm = document.getElementById('category-form');
  if (catForm) {
    catForm.addEventListener('submit', createCategory);
  }

  // 9. Media library upload handler
  const mediaForm = document.getElementById('media-upload-form');
  if (mediaForm) {
    mediaForm.addEventListener('submit', uploadMediaFile);
  }

  // 10. Global settings form handler
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', saveSettings);
  }

  // 11. Modal operations
  setupModals();

  // 12. Visual editor tab controls
  bindEditorTabs();

  // 13. Brand presets binding
  bindPresetButtons();

  // 14. Initialize AI Copilot
  initCopilot();

  // 15. Initialize Article Visual Editor
  initArticleEditor();

  // 16. Empty trash bin click handler
  const emptyTrashBtn = document.getElementById('empty-trash-btn');
  if (emptyTrashBtn) {
    emptyTrashBtn.addEventListener('click', emptyTrashBin);
  }

  // 17. Bind live theme mockup updates
  const pickersList = ['canopy', 'forest', 'leaf', 'bright', 'gold', 'orange', 'soil'];
  pickersList.forEach(v => {
    const input = document.getElementById(`theme-${v}`);
    if (input) {
      input.addEventListener('input', syncLiveMockup);
      input.addEventListener('change', syncLiveMockup);
    }
  });

  // 18. Global Clipboard Paste Image handling
  setupGlobalClipboardPaste();
});

// ==================== AUTHENTICATION ACTIONS ====================

async function checkSession() {
  // Directly enter the admin dashboard
  showDashboard({ name: 'MazaoHub Admin', email: 'admin@mazaohub.com', role: 'admin' });
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  errorEl.classList.add('hide');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (data.success) {
      showDashboard(data.user);
    } else {
      errorEl.textContent = data.error || 'Login failed';
      errorEl.classList.remove('hide');
    }
  } catch (err) {
    errorEl.textContent = 'Server error connecting to authentication API';
    errorEl.classList.remove('hide');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  showLogin();
}

function showLogin() {
  showDashboard({ name: 'MazaoHub Admin', email: 'admin@mazaohub.com', role: 'admin' });
}

function showDashboard(user) {
  document.getElementById('login-container').classList.add('hide');
  document.getElementById('dashboard-container').classList.remove('hide');
  
  document.getElementById('user-display-name').textContent = user.name;
  document.getElementById('user-display-email').textContent = user.email;
  
  // Load default tab
  switchTab('overview');
}

// ==================== TAB MANAGEMENT ====================

function switchTab(tabName) {
  currentTab = tabName;
  
  // Highlight active sidebar item
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });

  // Show active tab panel
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
  });

  // Update title
  const formattedTitle = tabName.charAt(0).toUpperCase() + tabName.slice(1);
  document.getElementById('tab-title').textContent = formattedTitle === 'Overview' ? 'Dashboard Overview' : `${formattedTitle} Management`;

  // Trigger loads based on active tab
  if (tabName === 'overview') loadOverviewStats();
  if (tabName === 'articles') loadArticles();
  if (tabName === 'categories') loadCategories();
  if (tabName === 'sections') loadSectionContent();
  if (tabName === 'media') loadMediaGallery();
  if (tabName === 'submissions') loadSubmissions();
  if (tabName === 'settings') loadSettings();
  if (tabName === 'copilot') loadCopilot();
  if (tabName === 'trash') loadTrashBin();
}

// ==================== TAB LOADERS ====================

async function loadOverviewStats() {
  try {
    const [articles, categories, media, submissions] = await Promise.all([
      fetch('/api/articles').then(r => r.json()),
      fetch('/api/articles/categories').then(r => r.json()),
      fetch('/api/media').then(r => r.json()),
      fetch('/api/submissions').then(r => r.json())
    ]);

    document.getElementById('stat-articles').textContent = articles.articles?.length || 0;
    document.getElementById('stat-categories').textContent = categories.categories?.length || 0;
    document.getElementById('stat-media').textContent = media.media?.length || 0;
    document.getElementById('stat-submissions').textContent = submissions.submissions?.length || 0;

    // Fill recent submissions table
    const recentList = document.getElementById('recent-submissions-list');
    recentList.innerHTML = '';
    const items = (submissions.submissions || []).slice(0, 5);
    
    if (items.length === 0) {
      recentList.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No form submissions yet.</td></tr>`;
      return;
    }

    items.forEach(sub => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(sub.created_at).toLocaleDateString()}</td>
        <td><span class="btn btn-mini btn-secondary">${sub.form_type}</span></td>
        <td>${sub.name || '-'}</td>
        <td>${sub.email || '-'}</td>
        <td>${sub.company || '-'}</td>
      `;
      recentList.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

// ARTICLES
async function loadArticles(searchQuery = '') {
  try {
    const url = searchQuery ? `/api/articles?search=${encodeURIComponent(searchQuery)}` : '/api/articles';
    const res = await fetch(url);
    const data = await res.json();
    
    const body = document.getElementById('articles-list-body');
    body.innerHTML = '';

    if (data.articles.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No articles found.</td></tr>`;
      return;
    }

    const keywords = searchQuery.split(/\s+/).filter(w => w.trim().length > 0);

    data.articles.forEach(art => {
      let titleDisplay = art.title;
      let extraInfo = `<a class="article-live-url" href="/#/news/${art.slug}" target="_blank">🔗 /#/news/${art.slug}</a>`;

      if (keywords.length > 0) {
        titleDisplay = highlightKeywords(art.title, keywords);
        
        const plainText = stripHtml(art.content_html || '');
        const snippetText = getSearchSnippet(plainText, keywords);
        if (snippetText) {
          const highlightedSnippet = highlightKeywords(snippetText, keywords);
          extraInfo = `<span style="font-size:11.5px; color:var(--text-muted); display:block; margin: 4px 0 6px 0; padding:6px 10px; background:rgba(0,0,0,0.18); border-radius:6px; border:1px solid rgba(255,255,255,0.03); line-height:1.4;">🔍 ${highlightedSnippet}</span>` + `<a class="article-live-url" href="/#/news/${art.slug}" target="_blank">🔗 /#/news/${art.slug}</a>`;
        }
      }

      const row = document.createElement('tr');
      // Edit & Delete always enabled regardless of search state
      row.innerHTML = `
        <td><strong>${titleDisplay}</strong><br><span style="font-size:11px; color:var(--text-muted);">${extraInfo}</span></td>
        <td><span class="btn btn-mini btn-secondary">${art.category_name || 'Uncategorized'}</span></td>
        <td>${new Date(art.published_at).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-mini btn-primary" onclick="editArticle(${art.id})">Edit</button>
            <button class="btn btn-mini btn-danger" onclick="deleteArticle(${art.id})">Delete</button>
          </div>
        </td>
      `;
      body.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading articles:', err);
  }
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function getSearchSnippet(text, keywords) {
  if (keywords.length === 0 || !text) return '';
  
  const lowerText = text.toLowerCase();
  let matchIndex = -1;
  let matchKeyword = '';
  
  for (const keyword of keywords) {
    const idx = lowerText.indexOf(keyword.toLowerCase());
    if (idx !== -1) {
      matchIndex = idx;
      matchKeyword = keyword;
      break;
    }
  }
  
  if (matchIndex === -1) {
    return text.substring(0, 80) + (text.length > 80 ? '...' : '');
  }
  
  const start = Math.max(0, matchIndex - 35);
  const end = Math.min(text.length, matchIndex + matchKeyword.length + 45);
  
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  return snippet;
}

function highlightKeywords(text, keywords) {
  if (keywords.length === 0 || !text) return text;
  
  let highlighted = text;
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  
  sortedKeywords.forEach(keyword => {
    if (!keyword.trim()) return;
    const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
  });
  
  return highlighted;
}

async function editArticle(articleId) {
  try {
    // We can pull the full article by loading it directly
    const res = await fetch('/api/articles');
    const data = await res.json();
    const article = data.articles.find(a => a.id === articleId);
    
    if (!article) return;

    // Fill form
    document.getElementById('article-edit-id').value = article.id;
    document.getElementById('art-title').value = article.title;
    document.getElementById('art-slug').value = article.slug;
    document.getElementById('art-summary').value = article.summary || '';
    document.getElementById('art-image').value = article.image_url || '';
    document.getElementById('art-html').value = article.content_html;

    // Fill visual editor
    const artVisualEditor = document.getElementById('art-visual-editor');
    if (artVisualEditor) {
      artVisualEditor.innerHTML = article.content_html || '';
    }
    
    // Load categories dropdown and select category
    await loadCategoriesDropdown(article.category_id);

    // Show modal
    document.getElementById('article-modal-title').textContent = 'Edit Article';
    document.getElementById('article-modal').classList.remove('hide');
  } catch (err) {
    console.error('Error preparing article edit:', err);
  }
}

async function deleteArticle(articleId) {
  if (!confirm('Are you sure you want to delete this article? You can undo or restore it later from the Trash Bin.')) {
    return;
  }

  try {
    const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadArticles();
      loadOverviewStats();
      if (data.trashId) {
        showUndoToast(data.trashId, "Article deleted successfully");
      }
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Failed to connect to backend server');
  }
}

// CATEGORIES
async function loadCategories() {
  try {
    const res = await fetch('/api/articles/categories');
    const data = await res.json();
    
    const body = document.getElementById('categories-list-body');
    body.innerHTML = '';

    if (data.categories.length === 0) {
      body.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">No categories defined yet.</td></tr>`;
      return;
    }

    data.categories.forEach(cat => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${cat.name}</strong></td>
        <td><code>${cat.slug}</code></td>
        <td>
          <button class="btn btn-mini btn-danger" onclick="deleteCategory(${cat.id})">Delete</button>
        </td>
      `;
      body.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

async function createCategory(e) {
  e.preventDefault();
  const name = document.getElementById('cat-name').value;
  const slug = document.getElementById('cat-slug').value;

  try {
    const res = await fetch('/api/articles/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('cat-name').value = '';
      document.getElementById('cat-slug').value = '';
      loadCategories();
    } else {
      alert('Failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to backend server');
  }
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category? Articles under this category will be marked Uncategorized. You can undo or restore it later.')) {
    return;
  }

  try {
    const res = await fetch(`/api/articles/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadCategories();
      loadOverviewStats();
      if (data.trashId) {
        showUndoToast(data.trashId, "Category deleted successfully");
      }
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Failed to connect to backend server');
  }
}

// PAGE SECTIONS
async function loadSectionContent() {
  const { page_slug, section_id } = activeEditSection;
  // Build a friendly title for the editor header
  const selectEl = document.getElementById('section-select-page');
  const selectedOption = selectEl ? selectEl.options[selectEl.selectedIndex] : null;
  const friendlyLabel = selectedOption ? selectedOption.textContent.trim() : page_slug.toUpperCase();
  document.getElementById('editing-section-title').textContent = `Editing: ${friendlyLabel}`;
  
  try {
    const res = await fetch(`/api/content/sections/${page_slug}`);
    const data = await res.json();
    
    const section = (data.sections || []).find(s => s.section_id === section_id);
    if (section) {
      document.getElementById('section-title').value = section.title || '';
      document.getElementById('section-html').value = section.content_html;
      
      // Load into visual iframe — wrap content so it renders with full site styles
      const iframe = document.getElementById('visual-editor-iframe');
      if (iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="/css/style.css">
            <style>
              /* Match the real website background so text colours are visible */
              html, body {
                background: #070b08 !important;
                margin: 0;
                padding: 0;
                font-family: "Outfit", "Inter", sans-serif;
              }
              
              #editor-root {
                outline: none !important;
              }
              
              /* Editable element hover highlight */
              #editor-root *:not(.img-edit-wrapper) {
                transition: outline 0.12s ease, background-color 0.12s ease;
              }
              
              #editor-root *:not(.img-edit-wrapper):not(a):not(.btn):hover {
                outline: 1px dashed rgba(20, 200, 52, 0.6) !important;
                outline-offset: 2px;
                background-color: rgba(20, 200, 52, 0.04);
                cursor: text;
              }
              
              #editor-root *:not(.img-edit-wrapper):not(a):not(.btn):focus {
                outline: 2px solid var(--bright, #14c834) !important;
                outline-offset: 2px;
                background-color: rgba(20, 200, 52, 0.07);
              }

              .img-edit-wrapper {
                position: relative;
                display: inline-block;
                cursor: pointer;
              }

              .img-edit-wrapper:hover::after {
                content: "✏️ Change Image";
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 600;
                border-radius: 6px;
                transition: all 0.2s;
              }

              .link-edit-highlight:hover {
                outline: 1.5px dashed var(--gold, #e8b23a) !important;
                outline-offset: 3px;
                cursor: pointer;
                background-color: rgba(232, 178, 58, 0.05);
              }
            </style>
          </head>
          <body>
            <div id="editor-root">
              ${section.content_html}
            </div>
          </body>
          </html>
        `);
        doc.close();
        
        // Wait for iframe stylesheets to load before binding visual editor
        iframe.onload = () => {
          initVisualEditor();
        };
        // fallback in case onload already fired
        setTimeout(initVisualEditor, 300);
      }

      // Reset mode to visual default
      isVisualMode = true;
      document.getElementById('mode-visual-btn').classList.add('active');
      document.getElementById('mode-code-btn').classList.remove('active');
      document.getElementById('visual-editor-pane').classList.remove('hide');
      document.getElementById('code-editor-pane').classList.add('hide');
    } else {
      // No saved section in DB yet — show friendly empty state
      document.getElementById('section-title').value = '';
      document.getElementById('section-html').value = '';
      const iframe = document.getElementById('visual-editor-iframe');
      if (iframe) {
        const { page_slug } = activeEditSection;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`
          <!DOCTYPE html><html><head>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap" rel="stylesheet">
          <style>
            body { background: #0d1a10; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 300px; font-family: 'Outfit', sans-serif; color: #7cbb85; }
            .empty-state { text-align: center; padding: 48px; }
            .empty-state h3 { font-size: 20px; margin-bottom: 12px; color: #eaf2eb; }
            .empty-state p { font-size: 14px; line-height: 1.7; color: #7cbb85; }
            .empty-state code { background: rgba(20,200,52,0.1); padding: 2px 8px; border-radius: 4px; color: #14c834; font-size: 13px; }
          </style>
          </head><body>
          <div class="empty-state">
            <div style="font-size:48px;margin-bottom:16px;">📄</div>
            <h3>Section not yet customized</h3>
            <p>The section <code>${page_slug}</code> is using its default HTML from the website.<br>
            Switch to <strong>HTML Code Editor</strong>, paste the section HTML, and click <strong>Save Page Changes</strong> to start editing it here.</p>
          </div>
          </body></html>
        `);
        doc.close();
      }
    }

  } catch (err) {
    console.error('Error loading section content:', err);
  }
}

async function saveSectionContent(e) {
  e.preventDefault();
  const { page_slug, section_id } = activeEditSection;
  const title = document.getElementById('section-title').value;
  
  // Get content depending on mode
  const content_html = isVisualMode ? getCleanHtml() : document.getElementById('section-html').value;

  try {
    const res = await fetch(`/api/content/sections/${page_slug}/${section_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content_html })
    });
    const data = await res.json();
    if (data.success) {
      alert('Page section saved successfully!');
      // Reload section content to ensure fresh state
      loadSectionContent();
    } else {
      alert('Save failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to backend server');
  }
}

// MEDIA LIBRARY
async function loadMediaGallery() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();
    
    const grid = document.getElementById('media-gallery-grid');
    grid.innerHTML = '';

    if (data.media.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color: var(--text-muted); padding: 40px 0;">No media files uploaded yet.</div>`;
      return;
    }

    data.media.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';
      
      const isImg = item.file_type && item.file_type.startsWith('image/');
      const preview = isImg 
        ? `<img src="${item.file_url}" alt="${item.file_name}">`
        : `<div class="file-icon">📄</div>`;

      card.innerHTML = `
        <div class="media-preview">${preview}</div>
        <div class="media-info">
          <div class="media-name" title="${item.file_name}">${item.file_name}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 8px;">
            ${(item.file_size / 1024).toFixed(1)} KB
          </div>
          <div class="media-card-actions">
            <button class="btn btn-mini btn-secondary" onclick="copyMediaUrl('${item.file_url}')">Link</button>
            <button class="btn btn-mini btn-danger" onclick="deleteMediaFile(${item.id})">Delete</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading media gallery:', err);
  }
}

function copyMediaUrl(url) {
  const fullUrl = window.location.origin + url;
  navigator.clipboard.writeText(fullUrl).then(() => {
    alert('URL copied to clipboard:\n' + fullUrl);
  }).catch(() => {
    alert('Full URL path:\n' + fullUrl);
  });
}

async function uploadMediaFile(e) {
  e.preventDefault();
  const fileInput = document.getElementById('media-file-input');
  if (fileInput.files.length === 0) return;

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      fileInput.value = '';
      loadMediaGallery();
    } else {
      alert('Upload failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to upload API');
  }
}

async function deleteMediaFile(id) {
  if (!confirm('Are you sure you want to delete this file from the storage?')) {
    return;
  }

  try {
    const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadMediaGallery();
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to backend server');
  }
}

// SUBMISSIONS
async function loadSubmissions() {
  try {
    const res = await fetch('/api/submissions');
    const data = await res.json();
    
    const body = document.getElementById('submissions-list-body');
    body.innerHTML = '';

    if (data.submissions.length === 0) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No form submissions found.</td></tr>`;
      return;
    }

    data.submissions.forEach(sub => {
      const row = document.createElement('tr');
      const details = JSON.parse(sub.details_json || '{}');
      let msgDetails = sub.message || '';
      if (Object.keys(details).length > 0) {
        msgDetails += `<br><span style="font-size:11px; color:var(--text-muted); font-family:var(--mono);">${JSON.stringify(details)}</span>`;
      }

      row.innerHTML = `
        <td>${new Date(sub.created_at).toLocaleDateString()}</td>
        <td><span class="btn btn-mini btn-secondary">${sub.form_type}</span></td>
        <td>${sub.name || '-'}</td>
        <td>${sub.email || '-'}</td>
        <td>${sub.company || '-'}</td>
        <td>${msgDetails}</td>
        <td>
          <button class="btn btn-mini btn-danger" onclick="deleteSubmission(${sub.id})">Delete</button>
        </td>
      `;
      body.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading submissions:', err);
  }
}

async function deleteSubmission(id) {
  if (!confirm('Are you sure you want to delete this submission record?')) {
    return;
  }

  try {
    const res = await fetch(`/api/submissions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadSubmissions();
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to backend server');
  }
}

// SETTINGS
async function loadSettings() {
  try {
    const res = await fetch('/api/content/settings');
    const data = await res.json();
    
    if (data.success && data.settings) {
      const set = data.settings;
      document.getElementById('set-email').value = set.contact_email || '';
      document.getElementById('set-phone').value = set.contact_phone || '';
      document.getElementById('set-address').value = set.contact_address || '';
      document.getElementById('set-title').value = set.site_title || '';
      document.getElementById('set-desc').value = set.site_description || '';
      
      // Load color variables
      const variables = ['canopy', 'forest', 'leaf', 'bright', 'gold', 'orange', 'soil'];
      const defaults = {
        canopy: '#06280c',
        forest: '#084012',
        leaf: '#126c22',
        bright: '#14c834',
        gold: '#e8b23a',
        orange: '#e8732a',
        soil: '#070b08'
      };
      variables.forEach(v => {
        const picker = document.getElementById(`theme-${v}`);
        if (picker) {
          picker.value = set[`theme_${v}`] || defaults[v];
        }
      });
      
      // Update preset highlighting
      updateActivePresetHighlight();

      // Sync the live mockup
      syncLiveMockup();
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  
  const settings = {
    contact_email: document.getElementById('set-email').value,
    contact_phone: document.getElementById('set-phone').value,
    contact_address: document.getElementById('set-address').value,
    site_title: document.getElementById('set-title').value,
    site_description: document.getElementById('set-desc').value,
  };

  // Add colors
  const variables = ['canopy', 'forest', 'leaf', 'bright', 'gold', 'orange', 'soil'];
  variables.forEach(v => {
    const picker = document.getElementById(`theme-${v}`);
    if (picker) {
      settings[`theme_${v}`] = picker.value;
    }
  });

  try {
    const res = await fetch('/api/content/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (data.success) {
      alert('Global settings and brand theme saved successfully!');
    } else {
      alert('Save failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to settings API');
  }
}

// ==================== MODAL HELPERS ====================

function setupModals() {
  const modal = document.getElementById('article-modal');
  const closeSpan = document.querySelector('.close-modal');
  const cancelBtn = document.querySelector('.cancel-modal-btn');
  const newBtn = document.getElementById('new-article-btn');

  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      // Clear form
      document.getElementById('article-edit-id').value = '';
      document.getElementById('art-title').value = '';
      document.getElementById('art-slug').value = '';
      document.getElementById('art-summary').value = '';
      document.getElementById('art-image').value = '';
      document.getElementById('art-html').value = '';

      const artVisualEditor = document.getElementById('art-visual-editor');
      if (artVisualEditor) {
        artVisualEditor.innerHTML = '';
      }
      
      await loadCategoriesDropdown();

      document.getElementById('article-modal-title').textContent = 'Create New Article';
      modal.classList.remove('hide');
    });
  }

  const closeModal = () => modal.classList.add('hide');

  if (closeSpan) closeSpan.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  window.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  // Bind article editor form submit
  const artEditorForm = document.getElementById('article-editor-form');
  if (artEditorForm) {
    artEditorForm.addEventListener('submit', saveArticle);
  }
}

async function loadCategoriesDropdown(selectedId = null) {
  try {
    const res = await fetch('/api/articles/categories');
    const data = await res.json();
    
    const dropdown = document.getElementById('art-category');
    dropdown.innerHTML = '';
    
    data.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (selectedId && cat.id === selectedId) {
        opt.selected = true;
      }
      dropdown.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching categories for selector dropdown:', err);
  }
}

async function saveArticle(e) {
  e.preventDefault();

  // Sync visual editor text if pane is active
  const visualPane = document.getElementById('art-visual-editor-pane');
  const artVisualEditor = document.getElementById('art-visual-editor');
  if (visualPane && !visualPane.classList.contains('hide') && artVisualEditor) {
    document.getElementById('art-html').value = artVisualEditor.innerHTML;
  }

  const id = document.getElementById('article-edit-id').value;
  const articleData = {
    title: document.getElementById('art-title').value,
    slug: document.getElementById('art-slug').value,
    category_id: document.getElementById('art-category').value,
    image_url: document.getElementById('art-image').value,
    summary: document.getElementById('art-summary').value,
    content_html: document.getElementById('art-html').value
  };

  const isEdit = !!id;
  const url = isEdit ? `/api/articles/${id}` : '/api/articles';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(articleData)
    });
    
    const data = await res.json();
    if (data.success) {
      document.getElementById('article-modal').classList.add('hide');
      loadArticles();
    } else {
      alert('Failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to article editing API');
  }
}

// ==================== VISUAL WYSIWYG EDITOR IMPLEMENTATION ====================

function bindEditorTabs() {
  const visualBtn = document.getElementById('mode-visual-btn');
  const codeBtn = document.getElementById('mode-code-btn');
  const visualPane = document.getElementById('visual-editor-pane');
  const codePane = document.getElementById('code-editor-pane');
  const sectionHtml = document.getElementById('section-html');

  if (visualBtn && codeBtn) {
    visualBtn.onclick = () => {
      if (isVisualMode) return;
      isVisualMode = true;
      visualBtn.classList.add('active');
      codeBtn.classList.remove('active');
      visualPane.classList.remove('hide');
      codePane.classList.add('hide');
      
      // Sync HTML from code editor to visual editor iframe root
      const iframe = document.getElementById('visual-editor-iframe');
      if (iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const root = doc.getElementById('editor-root');
        if (root) {
          root.innerHTML = sectionHtml.value;
          initVisualEditor();
        }
      }
    };

    codeBtn.onclick = () => {
      if (!isVisualMode) return;
      isVisualMode = false;
      codeBtn.classList.add('active');
      visualBtn.classList.remove('active');
      codePane.classList.remove('hide');
      visualPane.classList.add('hide');
      
      // Sync HTML from visual editor to code editor
      sectionHtml.value = getCleanHtml();
    };
  }
}

let isArtVisualMode = true;

function initArticleEditor() {
  const visualBtn = document.getElementById('art-mode-visual-btn');
  const codeBtn = document.getElementById('art-mode-code-btn');
  const visualPane = document.getElementById('art-visual-editor-pane');
  const codePane = document.getElementById('art-code-editor-pane');
  const visualEditor = document.getElementById('art-visual-editor');
  const codeEditor = document.getElementById('art-html');

  if (visualBtn && codeBtn) {
    visualBtn.onclick = () => {
      if (isArtVisualMode) return;
      isArtVisualMode = true;
      visualBtn.classList.add('active');
      codeBtn.classList.remove('active');
      visualPane.classList.remove('hide');
      codePane.classList.add('hide');
      
      // Sync HTML from code editor textarea to visual div
      if (visualEditor && codeEditor) {
        visualEditor.innerHTML = codeEditor.value;
      }
    };

    codeBtn.onclick = () => {
      if (!isArtVisualMode) return;
      isArtVisualMode = false;
      codeBtn.classList.add('active');
      visualBtn.classList.remove('active');
      codePane.classList.remove('hide');
      visualPane.classList.add('hide');
      
      // Sync HTML from visual div to code editor textarea
      if (codeEditor && visualEditor) {
        codeEditor.value = visualEditor.innerHTML;
      }
    };
  }

  // Bind Article Editor toolbar commands
  const bindTool = (id, cmd, val = null) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        document.execCommand(cmd, false, val);
        if (visualEditor) visualEditor.focus();
      };
    }
  };

  bindTool('arttool-bold', 'bold');
  bindTool('arttool-italic', 'italic');
  bindTool('arttool-underline', 'underline');
  bindTool('arttool-h3', 'formatBlock', '<h3>');
  bindTool('arttool-h4', 'formatBlock', '<h4>');
  bindTool('arttool-ul', 'insertUnorderedList');
  bindTool('arttool-ol', 'insertOrderedList');

  const linkBtn = document.getElementById('arttool-link');
  if (linkBtn) {
    linkBtn.onclick = (e) => {
      e.preventDefault();
      const url = prompt('Enter destination link URL (e.g. http://google.com):');
      if (url) {
        document.execCommand('createLink', false, url);
      }
      if (visualEditor) visualEditor.focus();
    };
  }
}

function initVisualEditor() {
  const iframe = document.getElementById('visual-editor-iframe');
  if (!iframe) return;
  
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const root = doc.getElementById('editor-root');
  if (!root) return;

  // Append paste-loader styling to iframe doc head
  if (doc && !doc.getElementById('iframe-paste-styles')) {
    const style = doc.createElement('style');
    style.id = 'iframe-paste-styles';
    style.textContent = `
      @keyframes pastePulse {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
      }
      .paste-loader {
        display: inline-block;
        padding: 4px 8px;
        background: rgba(20,200,52,0.1);
        border: 1px dashed #14c834;
        border-radius: 4px;
        color: #14c834;
        font-family: sans-serif;
        font-size: 13px;
        animation: pastePulse 1.5s infinite ease-in-out;
      }
    `;
    doc.head.appendChild(style);
  }

  // Handle paste events inside the visual editor iframe (for rich contenteditables)
  doc.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let hasImage = false;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        hasImage = true;
      }
    }
    
    if (hasImage) {
      e.preventDefault();
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          
          // Find active cursor position inside the iframe
          const sel = iframe.contentWindow.getSelection();
          if (!sel.rangeCount) return;
          const range = sel.getRangeAt(0);
          
          const loadingId = 'iframe-img-upload-' + Date.now();
          const loadingSpan = doc.createElement('span');
          loadingSpan.id = loadingId;
          loadingSpan.className = 'paste-loader';
          loadingSpan.style.color = '#14c834';
          loadingSpan.style.fontStyle = 'italic';
          loadingSpan.textContent = 'Uploading pasted image...';
          range.insertNode(loadingSpan);
          
          try {
            const media = await uploadDirectFile(file);
            const loaderEl = doc.getElementById(loadingId);
            if (loaderEl) {
              const img = doc.createElement('img');
              img.src = media.file_url;
              img.alt = media.file_name;
              img.style.maxWidth = '100%';
              img.style.height = 'auto';
              img.style.borderRadius = '8px';
              img.style.margin = '12px 0';
              img.style.border = '1px solid var(--border)';
              
              // Wrap the new image for click-to-edit
              const wrapper = doc.createElement('div');
              wrapper.className = 'img-edit-wrapper';
              wrapper.appendChild(img);
              wrapper.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const currentSrc = img.getAttribute('src') || '';
                const newUrl = prompt('Enter new Image URL (or upload via Media Library first & copy link):', currentSrc);
                if (newUrl !== null && newUrl.trim() !== '') {
                  img.setAttribute('src', newUrl.trim());
                  img.src = newUrl.trim();
                }
              };
              
              loaderEl.replaceWith(wrapper);
              if (typeof loadMediaGallery === 'function') loadMediaGallery();
            }
          } catch (err) {
            const loaderEl = doc.getElementById(loadingId);
            if (loaderEl) {
              loaderEl.textContent = ` [Upload failed: ${err.message}] `;
              loaderEl.style.color = 'red';
            }
          }
        }
      }
    }
  });

  // Make the entire editor root contenteditable for full webpage editing access
  root.setAttribute('contenteditable', 'true');

  // Make links and buttons interactive and prevent direct typing to preserve button structures
  root.querySelectorAll('a, .btn').forEach(el => {
    el.setAttribute('contenteditable', 'false');
    el.classList.add('link-edit-highlight');
    el.title = "Click to configure link text or destination URL";
    el.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentText = el.textContent.trim();
      const currentHref = el.getAttribute('href') || '#';
      
      const action = prompt(`Visual Link Editor:\n1. Change Button/Link Text (current: "${currentText}")\n2. Change Href Destination Link (current: "${currentHref}")\n\nEnter option (1 or 2):`, "1");
      
      if (action === "1") {
        const newText = prompt("Enter new text:", currentText);
        if (newText !== null && newText.trim() !== "") {
          el.textContent = newText.trim();
        }
      } else if (action === "2") {
        const newHref = prompt("Enter new URL destination:", currentHref);
        if (newHref !== null && newHref.trim() !== "") {
          el.setAttribute('href', newHref.trim());
        }
      }
    };
  });

  // Make images clickable/editable inside the iframe
  root.querySelectorAll('img').forEach(img => {
    if (img.parentNode.classList.contains('img-edit-wrapper')) {
      img.parentNode.setAttribute('contenteditable', 'false');
      return;
    }
    
    const wrapper = doc.createElement('div');
    wrapper.className = 'img-edit-wrapper';
    wrapper.setAttribute('contenteditable', 'false');
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    
    wrapper.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentSrc = img.getAttribute('src') || '';
      const newUrl = prompt('Enter new Image URL (or upload via Media Library first & copy link):', currentSrc);
      if (newUrl !== null && newUrl.trim() !== '') {
        img.setAttribute('src', newUrl.trim());
        img.src = newUrl.trim();
      }
    };
  });

  setupFormattingControls();
}

function setupFormattingControls() {
  const iframe = document.getElementById('visual-editor-iframe');
  if (!iframe) return;
  const doc = iframe.contentDocument || iframe.contentWindow.document;

  // Bold, Italic, Underline
  document.getElementById('vtool-bold').onclick = (e) => {
    e.preventDefault();
    doc.execCommand('bold', false, null);
  };
  
  document.getElementById('vtool-italic').onclick = (e) => {
    e.preventDefault();
    doc.execCommand('italic', false, null);
  };
  
  document.getElementById('vtool-underline').onclick = (e) => {
    e.preventDefault();
    doc.execCommand('underline', false, null);
  };

  // Alignments
  document.getElementById('vtool-align-left').onclick = (e) => {
    e.preventDefault();
    doc.execCommand('justifyLeft', false, null);
  };
  
  document.getElementById('vtool-align-center').onclick = (e) => {
    e.preventDefault();
    doc.execCommand('justifyCenter', false, null);
  };
  
  document.getElementById('vtool-align-right').onclick = (e) => {
    e.preventDefault();
    doc.execCommand('justifyRight', false, null);
  };

  // Text color
  const textColorPicker = document.getElementById('vtool-color');
  textColorPicker.onchange = (e) => {
    doc.execCommand('foreColor', false, e.target.value);
  };
  
  // Background Color
  const bgColorPicker = document.getElementById('vtool-bg');
  bgColorPicker.onchange = (e) => {
    const selection = iframe.contentWindow.getSelection();
    const colorHex = e.target.value;
    
    if (selection.toString().length > 0) {
      doc.execCommand('backColor', false, colorHex);
    } else {
      // Color nearest section container
      let activeNode = selection.anchorNode;
      if (activeNode) {
        if (activeNode.nodeType === Node.TEXT_NODE) {
          activeNode = activeNode.parentNode;
        }
        const root = doc.getElementById('editor-root');
        while (activeNode && activeNode !== root && activeNode.parentNode !== root) {
          activeNode = activeNode.parentNode;
        }
        if (activeNode && activeNode !== root) {
          activeNode.style.backgroundColor = colorHex;
          // Auto text accessibility color adjustment
          const isDark = isDarkColor(colorHex);
          activeNode.style.color = isDark ? '#eaf2eb' : '#0c1a0e';
          // Find paragraphs and adjust as well if needed
          activeNode.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span').forEach(child => {
            child.style.color = isDark ? '#eaf2eb' : '#0c1a0e';
          });
        }
      }
    }
  };
}

function isDarkColor(hex) {
  const c = hex.substring(1);
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma < 128;
}

function getCleanHtml() {
  const iframe = document.getElementById('visual-editor-iframe');
  if (!iframe) return '';
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const root = doc.getElementById('editor-root');
  if (!root) return '';
  
  const clone = root.cloneNode(true);
  
  // Remove contenteditable
  clone.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
  });

  // Remove link highlights
  clone.querySelectorAll('.link-edit-highlight').forEach(el => {
    el.classList.remove('link-edit-highlight');
    el.removeAttribute('title');
  });
  
  // Unwrap images
  clone.querySelectorAll('.img-edit-wrapper').forEach(wrapper => {
    const img = wrapper.querySelector('img');
    if (img) {
      wrapper.parentNode.replaceChild(img, wrapper);
    }
  });
  
  return clone.innerHTML.trim();
}

// ==================== BRAND PRESETS IMPLEMENTATION ====================

const PRESETS = {
  default: {
    canopy: '#06280c',
    forest: '#084012',
    leaf: '#126c22',
    bright: '#14c834',
    gold: '#e8b23a',
    orange: '#e8732a',
    soil: '#070b08'
  },
  harvest: {
    canopy: '#2b1704',
    forest: '#482604',
    leaf: '#7c430c',
    bright: '#e8732a',
    gold: '#e8b23a',
    orange: '#d35400',
    soil: '#130c04'
  },
  ocean: {
    canopy: '#051f2e',
    forest: '#0a3a40',
    leaf: '#14727d',
    bright: '#2ecc71',
    gold: '#e8b23a',
    orange: '#e67e22',
    soil: '#030f14'
  },
  midnight: {
    canopy: '#060b28',
    forest: '#0d1740',
    leaf: '#1c307d',
    bright: '#3498db',
    gold: '#f1c40f',
    orange: '#e67e22',
    soil: '#030513'
  }
};

function bindPresetButtons() {
  document.querySelectorAll('.preset-swatch').forEach(btn => {
    btn.onclick = () => {
      const presetName = btn.dataset.preset;
      const config = PRESETS[presetName];
      if (!config) return;
      
      // Update color picker inputs
      Object.keys(config).forEach(key => {
        const input = document.getElementById(`theme-${key}`);
        if (input) {
          input.value = config[key];
        }
      });
      
      // Highlight preset button
      document.querySelectorAll('.preset-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update live mockup
      setTimeout(syncLiveMockup, 50);
    };
  });
}

function updateActivePresetHighlight() {
  let activePreset = null;
  
  for (const [name, config] of Object.entries(PRESETS)) {
    let match = true;
    for (const [key, val] of Object.entries(config)) {
      const input = document.getElementById(`theme-${key}`);
      if (input && input.value.toLowerCase() !== val.toLowerCase()) {
        match = false;
        break;
      }
    }
    if (match) {
      activePreset = name;
      break;
    }
  }
  
  document.querySelectorAll('.preset-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === activePreset);
  });
}

// ==================== AI COPILOT IMPLEMENTATION ====================

let copilotHistory = [];

function initCopilot() {
  const saveBtn = document.getElementById('save-copilot-config');
  const apiKeyInput = document.getElementById('copilot-api-key');
  const modelInput = document.getElementById('copilot-model');
  const chatInput = document.getElementById('copilot-chat-input');
  const sendBtn = document.getElementById('copilot-send-btn');
  const clearBtn = document.getElementById('clear-chat-btn');
  const modeSelect = document.getElementById('copilot-mode-select');
  const offlineAdvisory = document.getElementById('copilot-offline-advisory');
  const cloudFields = document.getElementById('copilot-cloud-fields');

  // 1. Settings Drawer Toggle
  const toggleSettingsBtn = document.getElementById('toggle-copilot-settings-btn');
  const settingsDrawer = document.getElementById('copilot-settings-drawer');
  if (toggleSettingsBtn && settingsDrawer) {
    toggleSettingsBtn.onclick = () => {
      settingsDrawer.classList.toggle('hide');
    };
  }

  // 2. Preview Toolbar: Page Route Selector
  const previewPageSelect = document.getElementById('preview-select-page');
  const previewIframe = document.getElementById('copilot-preview-iframe');
  if (previewPageSelect && previewIframe) {
    previewPageSelect.onchange = (e) => {
      const page = e.target.value;
      // Change iframe route hash
      previewIframe.src = `/index.staging.html#${page}`;
    };
  }

  // 3. Setup click editing when Staging Iframe loads
  if (previewIframe) {
    previewIframe.onload = () => {
      setupIframeLiveEditing();
    };
  }

  // 4. Preview Toolbar: Publish Button
  const publishBtn = document.getElementById('preview-publish-btn');
  if (publishBtn) {
    publishBtn.onclick = async () => {
      if (!confirm('Are you sure you want to publish all staging playground changes to the live website? This will automatically backup the current live website.')) {
        return;
      }
      
      const overlay = document.getElementById('preview-editor-msg-overlay');
      if (overlay) {
        overlay.textContent = "Publishing staging changes to live website...";
        overlay.classList.remove('hide');
      }

      try {
        const res = await fetch('/api/content/editor/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true })
        });
        const data = await res.json();
        if (data.success) {
          alert('Successfully published staging playground to the live website and synchronized CMS database!');
          if (previewIframe) previewIframe.contentWindow.location.reload();
          loadOverviewStats();
          loadSettings();
          loadSectionContent();
        } else {
          alert('Publish failed: ' + data.error);
        }
      } catch (err) {
        alert('Error connecting to publish API: ' + err.message);
      } finally {
        if (overlay) overlay.classList.add('hide');
      }
    };
  }

  // 5. Preview Toolbar: Discard Button
  const restoreBtn = document.getElementById('preview-restore-btn');
  if (restoreBtn) {
    restoreBtn.onclick = async () => {
      if (!confirm('Are you sure you want to discard all staging changes and revert the playground to the live version?')) {
        return;
      }

      const overlay = document.getElementById('preview-editor-msg-overlay');
      if (overlay) {
        overlay.textContent = "Reverting staging playground to live...";
        overlay.classList.remove('hide');
      }

      try {
        const res = await fetch('/api/content/editor/discard', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('Staging playground successfully reverted to match the live website!');
          if (previewIframe) previewIframe.contentWindow.location.reload();
        } else {
          alert('Revert failed: ' + data.error);
        }
      } catch (err) {
        alert('Error connecting to discard API: ' + err.message);
      } finally {
        if (overlay) overlay.classList.add('hide');
      }
    };
  }

  // Load saved API Key and Model on startup
  const savedKey = localStorage.getItem('mazaohub_gemini_key');
  const savedModel = localStorage.getItem('mazaohub_gemini_model');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }
  if (savedModel && modelInput) {
    modelInput.value = savedModel;
  }

  // Bind mode selector changes
  if (modeSelect) {
    modeSelect.onchange = () => {
      const mode = modeSelect.value;
      if (mode === 'offline') {
        if (offlineAdvisory) offlineAdvisory.classList.remove('hide');
        if (cloudFields) cloudFields.classList.add('hide');
        enableCopilotChat(true);
      } else {
        if (offlineAdvisory) offlineAdvisory.classList.add('hide');
        if (cloudFields) cloudFields.classList.remove('hide');
        checkBackendCopilotStatus();
      }
    };
    
    // Trigger initial state
    setTimeout(() => {
      modeSelect.dispatchEvent(new Event('change'));
    }, 10);
  }

  // Verify if backend server environment contains Gemini config
  checkBackendCopilotStatus();

  // Bind save config
  if (saveBtn) {
    saveBtn.onclick = () => {
      const key = apiKeyInput.value.trim();
      const model = modelInput ? modelInput.value.trim() : 'gemini-1.5-flash';
      if (key) {
        localStorage.setItem('mazaohub_gemini_key', key);
        localStorage.setItem('mazaohub_gemini_model', model);
        alert('Configuration saved successfully!');
        enableCopilotChat(true);
      } else {
        localStorage.removeItem('mazaohub_gemini_key');
        localStorage.removeItem('mazaohub_gemini_model');
        alert('Configuration removed.');
        enableCopilotChat(false);
      }
    };
  }

  // Bind send click & enter key
  if (sendBtn) {
    sendBtn.onclick = submitCopilotChat;
  }
  if (chatInput) {
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitCopilotChat();
      }
    };
  }

  // Bind clear chat
  if (clearBtn) {
    clearBtn.onclick = () => {
      copilotHistory = [];
      const logs = document.getElementById('copilot-chat-logs');
      if (logs) {
        logs.innerHTML = `
          <div class="chat-msg system">
            Welcome to MazaoHub AI Copilot. Enter commands in the input below to edit the website, or click elements in the Live Editor on the right to edit them!
          </div>
        `;
      }
    };
  }

  // Bind Command Guide Modal toggling
  const openGuideBtn = document.getElementById('open-cheat-sheet-btn');
  const closeGuideBtn = document.getElementById('close-cheat-sheet-btn');
  const closeGuideSpan = document.getElementById('close-cheat-sheet-modal');
  const guideModal = document.getElementById('copilot-cheat-sheet-modal');
  
  if (openGuideBtn && guideModal) {
    openGuideBtn.onclick = (e) => {
      e.preventDefault();
      renderCheatSheet('theme');
      guideModal.classList.remove('hide');
    };
  }

  const hideGuide = () => {
    if (guideModal) guideModal.classList.add('hide');
  };

  if (closeGuideBtn) closeGuideBtn.onclick = hideGuide;
  if (closeGuideSpan) closeGuideSpan.onclick = hideGuide;

  // Bind cheat sheet tab clicks
  document.querySelectorAll('.cheat-sheet-tab').forEach(tab => {
    tab.onclick = (e) => {
      document.querySelectorAll('.cheat-sheet-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderCheatSheet(tab.dataset.sheetTab);
    };
  });
}

function enableCopilotChat(enabled) {
  const statusEl = document.getElementById('copilot-status');
  const chatInput = document.getElementById('copilot-chat-input');
  const sendBtn = document.getElementById('copilot-send-btn');
  const modeSelect = document.getElementById('copilot-mode-select');
  const mode = modeSelect ? modeSelect.value : 'offline';

  if (!statusEl || !chatInput || !sendBtn) return;

  if (mode === 'offline') {
    statusEl.textContent = '⚡ Local Compiler Active';
    statusEl.className = 'sub status-ready';
    chatInput.disabled = false;
    chatInput.placeholder = 'Type a command, e.g. "change signal color to lime green"';
    sendBtn.disabled = false;
    return;
  }

  if (enabled) {
    statusEl.textContent = 'Agent Ready';
    statusEl.className = 'sub status-ready';
    chatInput.disabled = false;
    chatInput.placeholder = 'Type a command, e.g. "Change signal color to bright orange"';
    sendBtn.disabled = false;
  } else {
    statusEl.textContent = 'API Key Required';
    statusEl.className = 'sub';
    chatInput.disabled = true;
    chatInput.placeholder = 'Save API Key on the left to enable chat...';
    sendBtn.disabled = true;
  }
}

function loadCopilot() {
  const logs = document.getElementById('copilot-chat-logs');
  if (logs) {
    logs.scrollTop = logs.scrollHeight;
  }
}

async function compileSiteState() {
  try {
    const [settingsRes, sectionsRes, articlesRes, categoriesRes, mediaRes] = await Promise.all([
      fetch('/api/content/settings').then(r => r.json()),
      fetch('/api/content/sections').then(r => r.json()),
      fetch('/api/articles').then(r => r.json()),
      fetch('/api/articles/categories').then(r => r.json()),
      fetch('/api/media').then(r => r.json())
    ]);

    const settings = settingsRes.settings || {};
    
    // Process sections to only include raw HTML if size is within limits to save prompt tokens
    const sections = (sectionsRes.sections || []).map(s => {
      const isLarge = s.content_html.length > 50000;
      
      // Extract structure for large sections
      let headings = [];
      let images = [];
      if (isLarge) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(s.content_html, 'text/html');
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6, .eyebrow, .lead').forEach(el => {
          const text = el.textContent.trim().replace(/\s+/g, ' ');
          if (text) headings.push(text.substring(0, 150));
        });
        doc.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src');
          if (src) images.push(src);
        });
      }

      return {
        page_slug: s.page_slug,
        section_id: s.section_id,
        title: s.title,
        length: s.content_html.length,
        content_html: isLarge ? undefined : s.content_html,
        headings: isLarge ? headings.slice(0, 30) : undefined, // cap headings size
        images: isLarge ? images : undefined
      };
    });

    const articles = (articlesRes.articles || []).map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      image_url: a.image_url,
      category_id: a.category_id,
      category_name: a.category_name
    }));

    const categories = categoriesRes.categories || [];
    const media = (mediaRes.media || []).map(m => ({
      name: m.file_name,
      url: m.file_url
    }));

    return { settings, sections, articles, categories, media };
  } catch (err) {
    console.error('Error compiling site state for AI:', err);
    return null;
  }
}

async function translateCommandWithGemini(prompt, clientKey, serverConfigured) {
  const translationPrompt = `You are a helper translating user commands for a local website editor agent.
The editor agent only understands the following exact command templates:
1. "list sections"
2. "read section [section_id]"
3. "replace '[findText]' with '[replaceText]'"
4. "preview changes"
5. "publish"
6. "list backups"
7. "restore [backup_filename]"
8. "delete article '[title]'"
9. "change picture of article '[title]' to '[image_name_or_url]'"
10. "replace '[find]' with '[replace]' in article '[title]'"
11. "replace '[find]' with '[replace]' on [page_slug]"
12. "use [preset_name] preset"
13. "set [color_field] color to [color_name_or_hex]"
14. "set [meta_field] to [value]"
15. "create article '[title]' summary '[summary]' category '[category]'"

The user said: "${prompt}"

If the user request maps to one of these actions but has typos, grammar mistakes, spelling issues, or is phrased loosely (e.g. "cgbag canopy colr to forest gren"), correct and rewrite it into the EXACT standard command format.
If it doesn't match any, just return the user's original input.
DO NOT output any thinking, conversational filler, markdown formatting, quotes, or explanation. Only output the corrected command text.`;

  try {
    if (clientKey) {
      const modelName = localStorage.getItem('mazaohub_gemini_model') || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${clientKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: translationPrompt }] }]
        })
      });
      const resData = await response.json();
      return resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt;
    } else if (serverConfigured) {
      const response = await fetch('/api/content/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: translationPrompt,
          history: []
        })
      });
      const resData = await response.json();
      return resData.reply_text?.trim() || prompt;
    }
  } catch (err) {
    console.error('Translation error:', err);
  }
  return prompt;
}

async function submitCopilotChat() {
  const chatInput = document.getElementById('copilot-chat-input');
  const sendBtn = document.getElementById('copilot-send-btn');
  const logsContainer = document.getElementById('copilot-chat-logs');
  const modeSelect = document.getElementById('copilot-mode-select');
  const mode = modeSelect ? modeSelect.value : 'offline';
  
  if (!chatInput) return;

  const prompt = chatInput.value.trim();
  if (!prompt) return;

  // Clear input, disable fields
  chatInput.value = '';
  chatInput.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  // 1. Add User Bubble
  appendChatBubble(logsContainer, 'user', prompt);
  loadCopilot();

  // 2. Add Loading Bot Bubble
  const botBubble = appendChatBubble(logsContainer, 'bot', '<p><i>AI Agent is analyzing site data and formulating update plan...</i></p>');
  const statusEl = document.getElementById('copilot-status');
  if (statusEl) {
    statusEl.textContent = 'Agent Thinking...';
    statusEl.className = 'sub status-working';
  }
  loadCopilot();

  if (mode === 'offline') {
    try {
      // Execute command locally using local parser
      let result = await window.MazaoLocalAgent.executeCommand(prompt);
      
      // If no actions were parsed, try using the online Gemini translation helper
      if (result.actions && result.actions.length === 0) {
        const clientKey = localStorage.getItem('mazaohub_gemini_key') || '';
        let serverConfigured = false;
        try {
          const statusRes = await fetch('/api/content/copilot/status');
          const statusData = await statusRes.json();
          serverConfigured = statusData.configured;
        } catch (e) {}

        if (clientKey || serverConfigured) {
          botBubble.innerHTML = `<p><i>No direct offline match. Invoking hybrid autocorrect agent helper...</i></p>`;
          const correctedCommand = await translateCommandWithGemini(prompt, clientKey, serverConfigured);
          
          if (correctedCommand && correctedCommand.toLowerCase() !== prompt.toLowerCase()) {
            botBubble.innerHTML = `<p><i>Autocorrect translated command to: "${correctedCommand}". Executing...</i></p>`;
            const correctedResult = await window.MazaoLocalAgent.executeCommand(correctedCommand);
            if (correctedResult.actions && correctedResult.actions.length > 0) {
              result = correctedResult;
              result.explanation = `✨ <b>Autocorrected command</b> from <i>"${prompt}"</i> to <i>"${correctedCommand}"</i>.<br><br>${result.explanation}`;
            }
          }
        }
      }
      
      // Render explanation
      botBubble.innerHTML = `<p>${result.explanation || 'Processing mutations...'}</p>`;

      if (result.actions && result.actions.length > 0) {
        // Render execution logs from local agent
        const logWrapper = document.createElement('div');
        logWrapper.className = 'ai-execution-log';
        botBubble.appendChild(logWrapper);

        result.logs.forEach(log => {
          const logItem = document.createElement('div');
          logItem.className = log.success ? 'ai-log-entry success' : 'ai-log-entry error';
          logItem.textContent = log.message;
          if (!log.success) logItem.style.color = 'var(--error)';
          logWrapper.appendChild(logItem);
        });

        botBubble.innerHTML += '<p style="margin-top: 10px; font-weight:600; color:var(--primary-light);">⚡ Operations completed! Local settings synchronized.</p>';
      }
      
      // Reload stats and settings to reflect local updates
      loadOverviewStats();
      loadSettings();
      updateActivePresetHighlight();

      // Reload preview iframe
      const previewIframe = document.getElementById('copilot-preview-iframe');
      if (previewIframe) {
        previewIframe.contentWindow.location.reload();
      }
    } catch (err) {
      console.error('Local Agent processing error:', err);
      botBubble.innerHTML = `<p>⚠️ Fatal error in offline compiler: ${err.message}</p>`;
    } finally {
      resetChatInputs();
      loadCopilot();
    }
    return;
  }

  try {
    const localKey = localStorage.getItem('mazaohub_gemini_key') || '';
    const localModel = localStorage.getItem('mazaohub_gemini_model') || '';

    // Headers support local key client overrides if backend lacks key
    const headers = {
      'Content-Type': 'application/json'
    };
    if (localKey) headers['x-gemini-key'] = localKey;
    if (localModel) headers['x-gemini-model'] = localModel;

    // Call backend copilot endpoint
    const response = await fetch('/api/content/copilot', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        prompt: prompt,
        history: copilotHistory
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errDetail = data.details ? `<br><pre><code>${data.details}</code></pre>` : '';
      botBubble.innerHTML = `<p>⚠️ Error: ${data.error || 'Backend agent execution failed.'}</p>${errDetail}`;
      resetChatInputs();
      return;
    }

    // Add both user turn and model turn to history to keep alternating structure
    copilotHistory.push({
      role: 'user',
      parts: [{ text: `User request: "${prompt}"` }]
    });
    copilotHistory.push({
      role: 'model',
      parts: [{ text: data.reply_text }]
    });

    // Render explanation
    botBubble.innerHTML = `<p>${data.explanation || 'Processing mutations...'}</p>`;

    const actions = data.actions || [];
    if (actions.length === 0) {
      botBubble.innerHTML += '<p><i>No changes were required for this request.</i></p>';
      resetChatInputs();
      return;
    }

    // Render execution logs from backend
    const logWrapper = document.createElement('div');
    logWrapper.className = 'ai-execution-log';
    botBubble.appendChild(logWrapper);

    (data.logs || []).forEach(log => {
      const logItem = document.createElement('div');
      logItem.className = log.success ? 'ai-log-entry success' : 'ai-log-entry error';
      logItem.textContent = log.message;
      if (!log.success) logItem.style.color = 'var(--error)';
      logWrapper.appendChild(logItem);
    });

    botBubble.innerHTML += '<p style="margin-top: 10px; font-weight:600; color:var(--success);">✨ Operations completed! Database updated.</p>';
    
    // Reload dashboard state to reflect changes
    loadOverviewStats();
    loadSettings();

    // Reload preview iframe
    const previewIframe = document.getElementById('copilot-preview-iframe');
    if (previewIframe) {
      previewIframe.contentWindow.location.reload();
    }
  } catch (err) {
    console.error('Copilot processing error:', err);
    botBubble.innerHTML = `<p>⚠️ Fatal error processing command: ${err.message}</p>`;
  } finally {
    resetChatInputs();
  }
}

async function checkBackendCopilotStatus() {
  const statusEl = document.getElementById('copilot-status');
  const apiKeyInput = document.getElementById('copilot-api-key');
  const modelInput = document.getElementById('copilot-model');
  const chatInput = document.getElementById('copilot-chat-input');
  const sendBtn = document.getElementById('copilot-send-btn');
  const modeSelect = document.getElementById('copilot-mode-select');
  const mode = modeSelect ? modeSelect.value : 'offline';

  if (!statusEl || !chatInput || !sendBtn) return;

  if (mode === 'offline') {
    enableCopilotChat(true);
    return;
  }
  
  try {
    const res = await fetch('/api/content/copilot/status');
    const data = await res.json();
    
    if (data.success && data.configured) {
      statusEl.textContent = 'Agent Ready (Server Configured)';
      statusEl.className = 'sub status-ready';
      chatInput.disabled = false;
      chatInput.placeholder = 'Type a command, e.g. "Change signal color to bright orange"';
      sendBtn.disabled = false;
      if (apiKeyInput) apiKeyInput.placeholder = 'Configured on Server (.env)';
      if (modelInput) {
        modelInput.placeholder = data.model || 'gemini-1.5-flash';
      }
      return;
    }
  } catch (e) {
    console.warn('Could not verify backend copilot status:', e);
  }

  // Fallback to local storage key if server is not pre-configured
  const savedKey = localStorage.getItem('mazaohub_gemini_key');
  if (savedKey) {
    enableCopilotChat(true);
  } else {
    enableCopilotChat(false);
  }
}

function resetChatInputs() {
  checkBackendCopilotStatus();
}

function appendChatBubble(container, sender, contentText) {
  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${sender}`;
  
  bubble.innerHTML = contentText;
  
  const time = document.createElement('span');
  time.className = 'chat-msg-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(time);

  container.appendChild(bubble);
  return bubble;
}

// ==================== TRASH BIN & UNDO SYSTEM IMPLEMENTATION ====================

let currentUndoTimeout = null;

function showUndoToast(trashId, message) {
  const existingToast = document.getElementById('undo-toast-element');
  if (existingToast) {
    existingToast.remove();
  }
  if (currentUndoTimeout) {
    clearTimeout(currentUndoTimeout);
  }

  const toast = document.createElement('div');
  toast.id = 'undo-toast-element';
  toast.className = 'undo-toast';
  
  toast.innerHTML = `
    <span class="undo-toast-message">🗑️ ${message}</span>
    <button class="undo-toast-action-btn" id="undo-toast-btn">Undo</button>
    <button class="undo-toast-close-btn" id="undo-toast-close-btn">&times;</button>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 50);

  const undoBtn = toast.querySelector('#undo-toast-btn');
  undoBtn.onclick = async () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
    if (currentUndoTimeout) clearTimeout(currentUndoTimeout);
    
    try {
      const res = await fetch(`/api/content/trash/${trashId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadOverviewStats();
        loadArticles();
        loadCategories();
        if (currentTab === 'trash') {
          loadTrashBin();
        }
        alert('Item successfully restored!');
      } else {
        alert('Restore failed: ' + data.error);
      }
    } catch (e) {
      alert('Failed to connect to backend server');
    }
  };

  const closeBtn = toast.querySelector('#undo-toast-close-btn');
  closeBtn.onclick = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
    if (currentUndoTimeout) clearTimeout(currentUndoTimeout);
  };

  currentUndoTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 8000);
}

async function loadTrashBin() {
  try {
    const res = await fetch('/api/content/trash');
    const data = await res.json();
    
    const body = document.getElementById('trash-list-body');
    if (!body) return;
    
    body.innerHTML = '';

    if (!data.trash || data.trash.length === 0) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Trash bin is empty.</td></tr>`;
      return;
    }

    data.trash.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="btn btn-mini btn-secondary">${item.item_type}</span></td>
        <td><code>${item.original_id}</code></td>
        <td><strong>${item.title}</strong></td>
        <td>${new Date(item.deleted_at).toLocaleString()}</td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-mini btn-primary" onclick="restoreTrashItem(${item.id})">Restore</button>
            <button class="btn btn-mini btn-danger" onclick="deleteTrashItemPermanently(${item.id})">Delete Permanently</button>
          </div>
        </td>
      `;
      body.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading trash bin:', err);
  }
}

async function restoreTrashItem(trashId) {
  try {
    const res = await fetch(`/api/content/trash/${trashId}/restore`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      loadTrashBin();
      loadOverviewStats();
      alert('Item successfully restored!');
    } else {
      alert('Restore failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to backend server');
  }
}

async function deleteTrashItemPermanently(trashId) {
  if (!confirm('Are you sure you want to permanently delete this item? This action is final and CANNOT be undone.')) {
    return;
  }

  try {
    const res = await fetch(`/api/content/trash/${trashId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadTrashBin();
      loadOverviewStats();
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to backend server');
  }
}

async function emptyTrashBin() {
  if (!confirm('Are you sure you want to permanently empty the entire Trash Bin? This action is final and CANNOT be undone.')) {
    return;
  }

  try {
    const res = await fetch('/api/content/trash', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadTrashBin();
      loadOverviewStats();
      alert('Trash bin successfully emptied!');
    } else {
      alert('Failed to empty trash bin: ' + data.error);
    }
  } catch (err) {
    alert('Error connecting to backend server');
  }
}

function syncLiveMockup() {
  const canopy = document.getElementById('theme-canopy')?.value || '#06280c';
  const forest = document.getElementById('theme-forest')?.value || '#084012';
  const leaf = document.getElementById('theme-leaf')?.value || '#126c22';
  const bright = document.getElementById('theme-bright')?.value || '#14c834';
  const gold = document.getElementById('theme-gold')?.value || '#e8b23a';
  const orange = document.getElementById('theme-orange')?.value || '#e8732a';
  const soil = document.getElementById('theme-soil')?.value || '#070b08';

  const frame = document.getElementById('theme-mockup-frame');
  const navbar = document.getElementById('mockup-navbar');
  const leafText = document.getElementById('mockup-leaf');
  const panel = document.getElementById('mockup-panel');
  const goldText = document.getElementById('mockup-gold');
  const btn = document.getElementById('mockup-btn');
  const badge = document.getElementById('mockup-badge');

  if (frame) frame.style.backgroundColor = soil;
  if (navbar) navbar.style.backgroundColor = canopy;
  if (leafText) leafText.style.color = leaf;
  if (panel) panel.style.backgroundColor = forest;
  if (goldText) goldText.style.color = gold;
  
  if (btn) {
    btn.style.backgroundColor = bright;
    // Auto adjust text color for accessibility inside the mockup button
    const r = parseInt(bright.substring(1,3), 16);
    const g = parseInt(bright.substring(3,5), 16);
    const b = parseInt(bright.substring(5,7), 16);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    btn.style.color = luma < 128 ? '#fff' : '#020503';
  }
  
  if (badge) badge.style.backgroundColor = orange;
}

// ==================== CO-PILOT IFRAME LIVE EDITING INTERACTIONS ====================

function setupIframeLiveEditing() {
  const iframe = document.getElementById('copilot-preview-iframe');
  if (!iframe) return;

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  if (!doc) return;

  // Inject styles inside iframe to show hover borders on interactive live editor targets
  const style = doc.createElement('style');
  style.innerHTML = `
    [data-live-edit-target] {
      outline: none;
      transition: all 0.15s ease;
    }
    [data-live-edit-target]:hover {
      outline: 1.5px dashed var(--bright, #14c834) !important;
      outline-offset: 3px;
      cursor: pointer;
      background-color: rgba(20, 200, 52, 0.05);
    }
    a[data-live-edit-target]:hover, .btn[data-live-edit-target]:hover {
      outline: 1.5px dashed var(--gold, #e8b23a) !important;
      outline-offset: 3px;
      background-color: rgba(232, 178, 58, 0.05);
    }
  `;
  doc.head.appendChild(style);

  // Select all text elements in preview iframe
  const selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'b', 'i', 'li', 'td', 'th', 'a', '.eyebrow', '.lead'];
  selectors.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => {
      // Don't mark link tags that contain images
      if (el.tagName === 'A' && el.querySelector('img')) return;
      el.setAttribute('data-live-edit-target', 'true');

      // Bind click listener for direct staging text updates
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const oldText = el.textContent.trim();
        if (!oldText) return;

        let promptMsg = `Visual Live Editor:\nEnter new text for this element:`;
        if (el.tagName === 'A' || el.classList.contains('btn')) {
          promptMsg = `Visual Link Text Editor:\nEnter new link/button text:`;
        }

        const newText = prompt(`${promptMsg}\n(Matches must be unique in staging file)\n\nOriginal text: "${oldText}"`, oldText);
        if (newText && newText.trim() !== "" && newText.trim() !== oldText) {
          await applyStagingTextReplacement(oldText, newText.trim());
        }
      });
    });
  });

  // Images click-to-replace inside preview iframe
  doc.querySelectorAll('img').forEach(img => {
    img.setAttribute('data-live-edit-target', 'true');
    img.style.cursor = 'pointer';
    img.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentSrc = img.getAttribute('src') || '';
      const newSrc = prompt('Staging Image URL Editor:\nEnter new Image source URL (e.g. /uploads/image.png):', currentSrc);
      if (newSrc && newSrc.trim() !== "" && newSrc.trim() !== currentSrc) {
        await applyStagingTextReplacement(currentSrc, newSrc.trim());
      }
    });
  });
}

async function applyStagingTextReplacement(findText, replaceText) {
  const overlay = document.getElementById('preview-editor-msg-overlay');
  if (overlay) {
    overlay.textContent = "Saving visual edits to staging playground...";
    overlay.classList.remove('hide');
  }

  try {
    const res = await fetch('/api/content/editor/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findText, replaceText })
    });
    const data = await res.json();
    if (data.success) {
      if (overlay) overlay.textContent = "Success! Updating preview frame...";
      
      // Reload iframe to show updated text
      const iframe = document.getElementById('copilot-preview-iframe');
      if (iframe) {
        iframe.contentWindow.location.reload();
      }
      
      // Log visual edit completion in Copilot Logs
      const logs = document.getElementById('copilot-chat-logs');
      if (logs) {
        appendChatBubble(logs, 'bot', `
          <p>⚡ <b>Visual Live Editor Action:</b> Successfully updated element content.</p>
          <div style="padding: 8px 12px; background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.15); border-radius: 8px; font-size:12px; font-family: monospace;">
            <b>WAS:</b> "${findText}"<br>
            <b>NOW:</b> "${replaceText}"
          </div>
          <p style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">This is saved in staging. Click "Publish Live" above to update the live website.</p>
        `);
        logs.scrollTop = logs.scrollHeight;
      }
    } else {
      alert(`Could not complete replacement: ${data.error}`);
    }
  } catch (err) {
    alert(`Server connection failed: ${err.message}`);
  } finally {
    if (overlay) {
      setTimeout(() => overlay.classList.add('hide'), 800);
    }
  }
}

// ==================== 100+ WORKABLE PROMPT EXAMPLES GUIDE DATA ====================
const GUIDE_PROMPTS = {
  theme: [
    { cmd: "use default preset", desc: "Revert website styles back to default dark forest theme" },
    { cmd: "use harvest preset", desc: "Apply organic earthy harvest theme with orange buttons" },
    { cmd: "use ocean preset", desc: "Apply marine preset theme with teal and light-green colors" },
    { cmd: "use midnight preset", desc: "Apply neon blue theme preset for dark theme styles" },
    { cmd: "change canopy color to forest green", desc: "Set the brand header overlay to forest green" },
    { cmd: "change signal color to green", desc: "Set the active buttons & signals to neon green" },
    { cmd: "change signal color into green", desc: "Change active buttons to neon green color code" },
    { cmd: "change button color to lime green", desc: "Set all standard primary action button colors" },
    { cmd: "change bright color to neon green", desc: "Set bright highlight color to custom neon green" },
    { cmd: "set leaf color to emerald green", desc: "Set leaf highlight colors in website grids" },
    { cmd: "set canopy color to #0a5f1a", desc: "Use custom hex code #0a5f1a for header styles" },
    { cmd: "set leaf color to #10b981", desc: "Apply emerald green #10b981 theme to leaf details" },
    { cmd: "set bright color to #059669", desc: "Update buttons theme to emerald primary color" },
    { cmd: "set gold color to yellow", desc: "Change gold accent highlights to bright yellow" },
    { cmd: "change gold to amber", desc: "Set gold color styling variables to amber" },
    { cmd: "set gold color to #f59e0b", desc: "Use custom amber hex code for ratings/icons" },
    { cmd: "set orange color to orange", desc: "Set default orange color variable" },
    { cmd: "set orange color to #f97316", desc: "Use orange hex code for active category badges" },
    { cmd: "set background color to soil", desc: "Set general website background color" },
    { cmd: "set background color to midnight", desc: "Change page background to midnight black" },
    { cmd: "set soil color to black", desc: "Change background color to solid pitch black" },
    { cmd: "change background color to #090e0b", desc: "Use custom hex code for dark soil theme" }
  ],
  articles: [
    { cmd: "create article 'Sustainable Farming' summary 'Field guide to agronomy'", desc: "Create a blog article in Category: Soil Advisory" },
    { cmd: "create article 'Drone Scanner Telemetry' summary 'IoT and drones'", desc: "Publish new tech article in default categories" },
    { cmd: "create article 'Soil pH Diagnostic Guide' summary 'Measuring acidity'", desc: "Add pH testing notes article" },
    { cmd: "create article 'Watering index'", desc: "Quick-publish article with default summary text" },
    { cmd: "create article 'Carbon sequestration'", desc: "Quick-publish climate-smart farming notes" },
    { cmd: "delete article 'Sustainable Farming'", desc: "Move article to trash bin dynamically" },
    { cmd: "delete article 'Watering index'", desc: "Soft-delete watering article from database" },
    { cmd: "delete article 'Carbon sequestration'", desc: "Soft-delete climate article from listings" },
    { cmd: "change picture of article 'Smart Irrigation' to 'irrigation.png'", desc: "Swap featured image to irrigation picture" },
    { cmd: "change featured image of article 'pH Testing' to '/uploads/ph.png'", desc: "Set featured image to local uploaded URL path" },
    { cmd: "change picture of article 'Organic Advisory' to 'compost.png'", desc: "Update compost featured image path" },
    { cmd: "replace 'pH level' with 'acidity index' in article 'Soil pH Testing'", desc: "Search and swap text inside article body content" },
    { cmd: "replace 'soil moisture' with 'hydration ratio' in article 'Irrigation'", desc: "Swap irrigation vocabulary inside blog post text" },
    { cmd: "replace 'drones' with 'autonomous telemetry' in article 'Drones'", desc: "Modify drone references inside article" },
    { cmd: "replace 'fertilizers' with 'organic bio-nutrients' in article 'Soil'", desc: "Update agricultural vocabulary inside article body" },
    { cmd: "replace 'NPK values' with 'nitrogen ratios' in article 'Soil'", desc: "Replace soil composition metrics inside post content" },
    { cmd: "replace 'crop yield' with 'harvest output' in article 'Smart Irrigation'", desc: "Edit text match inside smart irrigation article body" },
    { cmd: "replace 'smallholders' with 'family farms' in article 'Smart Irrigation'", desc: "Update text inside article body" },
    { cmd: "replace 'IoT sensors' with 'telemetry probes' in article 'Smart Irrigation'", desc: "Swap IoT sensor terms in article body content" },
    { cmd: "replace 'sustainability' with 'regenerative practices' in article 'Smart Irrigation'", desc: "Update sustainability terms inside article" }
  ],
  content: [
    { cmd: "replace 'Farming Re-imagined' with 'Precision Agronomy' on homepage", desc: "Update main hero tagline on homepage staging" },
    { cmd: "replace 'Empowering Smallholders' with 'Boosting Farm Yields' on home", desc: "Replace sub-heading text inside home section" },
    { cmd: "replace 'soil parameters' with 'micro-nutrients' on homepage", desc: "Update text inside homepage features column" },
    { cmd: "replace 'Start Free Trial' with 'Get Started Today' on homepage", desc: "Visual button text replacement on home route" },
    { cmd: "replace 'Book Demo' with 'Schedule Call' on homepage", desc: "Update homepage primary action button text" },
    { cmd: "replace '200 USD' with '150 USD' on pricing", desc: "Modify pricing metrics inside pricing page staging" },
    { cmd: "replace 'Unlimited fields' with 'Up to 50 active fields' on pricing", desc: "Edit pricing detail text" },
    { cmd: "replace 'Email Support' with '24/7 Priority Support' on pricing", desc: "Update pricing plan benefits description" },
    { cmd: "replace 'Agronomic Engine' with 'AI Telemetry Core' on ai", desc: "Update headings in AI engine details page" },
    { cmd: "replace 'predictive analysis' with 'autonomous diagnostics' on ai", desc: "Update description inside AI page section" },
    { cmd: "replace 'global network' with 'worldwide agritech network' on global", desc: "Update text inside Global details page" },
    { cmd: "replace 'our services' with 'what we deliver' on offer", desc: "Change section text on Offerings page" },
    { cmd: "replace 'precision tools' with 'digital soil diagnostic tools' on products", desc: "Change product section text" },
    { cmd: "replace 'About MazaoHub' with 'Our Agriculture Mission' on about", desc: "Change headers on About page" },
    { cmd: "replace '10 years experience' with 'A Decade of Innovation' on about", desc: "Update timeline text in About section" },
    { cmd: "replace 'support@mazaohub.com' with 'info@mazaohub.com' on website", desc: "Perform a global scan and replace contact email text" },
    { cmd: "replace '+255 123 456' with '+255 765 432' on website", desc: "Global replacement of office contact phone" },
    { cmd: "replace 'Dar es Salaam' with 'Dodoma, Tanzania' on website", desc: "Global replacement of city location text" },
    { cmd: "replace 'MazaoHub ERP' with 'MazaoHub Precision ERP' on website", desc: "Global replacement of product names across site" },
    { cmd: "replace 'Privacy Policy' with 'Data & Privacy Terms' on website", desc: "Global footer link text replacement" }
  ],
  seo: [
    { cmd: "set site_title to 'MazaoHub - Climate Smart Agronomy'", desc: "Set global browser tab title for index page" },
    { cmd: "set site_title to 'MazaoHub Advanced Crop Diagnostic System'", desc: "Update website header meta title" },
    { cmd: "set site_title to 'MazaoHub - Precision Soil Advisory Platform'", desc: "Update index HTML tab title" },
    { cmd: "set site_description to 'Dynamic offline agritech compiler'", desc: "Update global SEO meta description tags" },
    { cmd: "set site_description to 'Empowering family farms with telemetry'", desc: "Set SEO search snippet description" },
    { cmd: "set contact_email to 'support@mazaohub.com'", desc: "Update dynamic customer inquiry destination email" },
    { cmd: "set contact_email to 'info@mazaohub.com'", desc: "Change general contact email address in database" },
    { cmd: "set contact_email to 'advisory@mazaohub.com'", desc: "Set expert advisory contact email link" },
    { cmd: "set contact_phone to '+255 700 000 000'", desc: "Change primary corporate helpline phone number" },
    { cmd: "set contact_phone to '+254 711 222 333'", desc: "Update regional office contact phone info" },
    { cmd: "set contact_phone to '0800-FARM-SUPPORT'", desc: "Set customer helpline number" },
    { cmd: "set contact_address to 'Dodoma City Plaza, Tanzania'", desc: "Update dynamic footer corporate headquarters address" },
    { cmd: "set contact_address to 'Morogoro Road, Dar es Salaam'", desc: "Change corporate physical headquarters location" },
    { cmd: "change email to support@mazaohub.com", desc: "Alias command to update contact email info" },
    { cmd: "change phone to +255 123 456", desc: "Alias command to update contact phone number" },
    { cmd: "change title to MazaoHub Precision", desc: "Alias command to update website tab meta title" },
    { cmd: "change description to Smart agronomy", desc: "Alias command to update website SEO description" },
    { cmd: "change address to Ifakara, Tanzania", desc: "Alias command to update physical office address info" },
    { cmd: "set site_title to 'MazaoHub - AI Telemetry ERP'", desc: "Update index tab title" },
    { cmd: "set site_description to 'Soil health, moisture, and crop diagnostic'", desc: "Update SEO description tags" }
  ],
  admin: [
    { cmd: "list sections", desc: "Scan active homepage and list all editable section IDs" },
    { cmd: "show sections", desc: "Alias: List all available editable webpage section tags" },
    { cmd: "view sections", desc: "Alias: Display all editable index sections in log" },
    { cmd: "read section main", desc: "Fetch staging HTML source code for section: main" },
    { cmd: "read section pricing", desc: "Retrieve staging HTML code for section: pricing" },
    { cmd: "read section features", desc: "Retrieve staging HTML code for section: features" },
    { cmd: "read section about", desc: "Retrieve staging HTML code for section: about" },
    { cmd: "preview changes", desc: "Compare current playground staging edits vs live site" },
    { cmd: "show diff", desc: "Alias: Compute and display staging file visual code diff" },
    { cmd: "what changed", desc: "Alias: Scan pending editor changes in unified diff format" },
    { cmd: "publish", desc: "Commit staging changes to live index and sync database" },
    { cmd: "go live", desc: "Alias: Publish staging copies to live site production" },
    { cmd: "apply changes", desc: "Alias: Save staging playground copies to live server" },
    { cmd: "list backups", desc: "Query server filesystem and list all live backup files" },
    { cmd: "show backups", desc: "Alias: Retrieve timestamps of saved backup site copies" },
    { cmd: "restore index_backup_2026_06_26.html", desc: "Revert live website files to specific backup" },
    { cmd: "revert index_backup_recent.html", desc: "Alias: Revert live site and database to backup file" },
    { cmd: "read section hero", desc: "Retrieve staging HTML code for section: hero" },
    { cmd: "read section footer", desc: "Retrieve staging HTML code for section: footer" },
    { cmd: "preview diff", desc: "Alias: Preview code diff before publishing live" }
  ]
};

function renderCheatSheet(category) {
  const container = document.getElementById('cheat-sheet-grid-container');
  if (!container) return;
  
  container.innerHTML = '';
  const list = GUIDE_PROMPTS[category] || [];
  
  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cheat-sheet-item';
    el.innerHTML = `
      <code>${item.cmd}</code>
      <span>${item.desc}</span>
    `;
    el.onclick = () => {
      const chatInput = document.getElementById('copilot-chat-input');
      if (chatInput) {
        chatInput.value = item.cmd;
        chatInput.focus();
      }
      const guideModal = document.getElementById('copilot-cheat-sheet-modal');
      if (guideModal) guideModal.classList.add('hide');
    };
    container.appendChild(el);
  });
}

// Helper to upload a File object directly
async function uploadDirectFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    throw new Error(`Server returned HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Upload failed');
  }
  return data.media; // returns { id, file_name, file_url, file_type, file_size }
}

// Helper to insert HTML/text at textarea cursor position
function insertTextAtCursor(textarea, text) {
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const oldVal = textarea.value;
  textarea.value = oldVal.substring(0, startPos) + text + oldVal.substring(endPos);
  textarea.selectionStart = textarea.selectionEnd = startPos + text.length;
}

// Global initialization of clipboard paste handlers
function setupGlobalClipboardPaste() {
  // Add pulse animation keyframe if not already present
  if (!document.getElementById('paste-styles')) {
    const style = document.createElement('style');
    style.id = 'paste-styles';
    style.textContent = `
      @keyframes pastePulse {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
      }
      .paste-loader {
        display: inline-block;
        padding: 4px 8px;
        background: rgba(20,200,52,0.1);
        border: 1px dashed var(--accent, #14c834);
        border-radius: 4px;
        color: var(--accent, #14c834);
        font-family: var(--sans);
        font-size: 13px;
        animation: pastePulse 1.5s infinite ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }

  // 1. Listen for global document paste events for the Media Library tab
  document.addEventListener('paste', async (e) => {
    // Only intercept if we are on the media tab
    if (currentTab !== 'media') return;

    // Do not intercept if user is typing in a text field or editable div
    const active = document.activeElement;
    if (active && (
      active.tagName === 'INPUT' || 
      active.tagName === 'TEXTAREA' || 
      active.hasAttribute('contenteditable') ||
      active.closest('[contenteditable]')
    )) {
      return;
    }

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        
        // Show status toast
        const toast = document.createElement('div');
        toast.className = 'card';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = 'rgba(10,25,15,0.95)';
        toast.style.border = '1px solid var(--accent, #14c834)';
        toast.style.color = '#fff';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '8px';
        toast.style.zIndex = '99999';
        toast.style.boxShadow = '0 0 15px rgba(20,200,52,0.4)';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '10px';
        toast.innerHTML = `<span class="paste-loader" style="border:none;background:none;padding:0;">⚡</span> Uploading pasted image to gallery...`;
        document.body.appendChild(toast);

        try {
          const media = await uploadDirectFile(file);
          toast.innerHTML = `<span style="color:var(--accent, #14c834)">✔</span> Uploaded: ${media.file_name}`;
          toast.style.borderColor = 'var(--accent, #14c834)';
          if (typeof loadMediaGallery === 'function') loadMediaGallery();
          setTimeout(() => toast.remove(), 2500);
        } catch (err) {
          toast.innerHTML = `<span style="color:var(--error, #f43f5e)">✖</span> Upload failed: ${err.message}`;
          toast.style.borderColor = 'var(--error, #f43f5e)';
          setTimeout(() => toast.remove(), 4000);
        }
      }
    }
  });

  // 2. Listen for paste events on the article Featured Image URL input (#art-image)
  const artImage = document.getElementById('art-image');
  if (artImage) {
    artImage.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const file = item.getAsFile();
          const origVal = artImage.value;
          artImage.value = 'Uploading pasted file...';
          artImage.disabled = true;
          try {
            const media = await uploadDirectFile(file);
            artImage.value = media.file_url;
            if (typeof loadMediaGallery === 'function') loadMediaGallery();
          } catch (err) {
            artImage.value = origVal;
            alert('Upload failed: ' + err.message);
          } finally {
            artImage.disabled = false;
            artImage.focus();
          }
        }
      }
    });
  }

  // 3. Listen for paste events on the Article Code editor textarea (#art-html)
  const artHtml = document.getElementById('art-html');
  if (artHtml) {
    artHtml.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const file = item.getAsFile();
          insertTextAtCursor(artHtml, '<!-- Uploading pasted image... -->');
          try {
            const media = await uploadDirectFile(file);
            // Replace the placeholder comment
            artHtml.value = artHtml.value.replace('<!-- Uploading pasted image... -->', `<img src="${media.file_url}" alt="${media.file_name}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0;">`);
            if (typeof loadMediaGallery === 'function') loadMediaGallery();
          } catch (err) {
            artHtml.value = artHtml.value.replace('<!-- Uploading pasted image... -->', `<!-- Upload failed: ${err.message} -->`);
          }
        }
      }
    });
  }

  // 4. Listen for paste events on the Article Visual Editor contenteditable (#art-visual-editor)
  const artVisualEditor = document.getElementById('art-visual-editor');
  if (artVisualEditor) {
    artVisualEditor.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      let hasImage = false;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          hasImage = true;
        }
      }

      if (hasImage) {
        e.preventDefault();
        for (const item of items) {
          if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            const loadingId = 'img-upload-' + Date.now();
            
            // Insert loading placeholder at cursor
            const loaderHtml = `<span id="${loadingId}" class="paste-loader">⏳ Uploading pasted image...</span>`;
            document.execCommand('insertHTML', false, loaderHtml);

            try {
              const media = await uploadDirectFile(file);
              const loaderEl = document.getElementById(loadingId);
              if (loaderEl) {
                const img = document.createElement('img');
                img.src = media.file_url;
                img.alt = media.file_name;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.borderRadius = '8px';
                img.style.margin = '12px 0';
                img.style.border = '1px solid var(--border)';
                loaderEl.replaceWith(img);
                if (typeof loadMediaGallery === 'function') loadMediaGallery();
              }
            } catch (err) {
              const loaderEl = document.getElementById(loadingId);
              if (loaderEl) {
                loaderEl.textContent = ` [Upload failed: ${err.message}] `;
                loaderEl.style.color = 'var(--error)';
                loaderEl.style.borderStyle = 'solid';
              }
            }
          }
        }
      }
    });
  }

  // 5. Listen for paste events on the Copilot chat input (#copilot-chat-input)
  const copilotChatInput = document.getElementById('copilot-chat-input');
  if (copilotChatInput) {
    copilotChatInput.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const file = item.getAsFile();
          const origVal = copilotChatInput.value;
          copilotChatInput.value = origVal + ' (Uploading pasted image...)';
          copilotChatInput.disabled = true;
          try {
            const media = await uploadDirectFile(file);
            copilotChatInput.value = origVal + (origVal ? ' ' : '') + media.file_url;
            if (typeof loadMediaGallery === 'function') loadMediaGallery();
          } catch (err) {
            copilotChatInput.value = origVal;
            alert('Upload failed: ' + err.message);
          } finally {
            copilotChatInput.disabled = false;
            copilotChatInput.focus();
          }
        }
      }
    });
  }

  // 6. Listen for paste events on Section Code Editor textarea (#section-html)
  const sectionHtml = document.getElementById('section-html');
  if (sectionHtml) {
    sectionHtml.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const file = item.getAsFile();
          insertTextAtCursor(sectionHtml, '<!-- Uploading pasted image... -->');
          try {
            const media = await uploadDirectFile(file);
            sectionHtml.value = sectionHtml.value.replace('<!-- Uploading pasted image... -->', `<img src="${media.file_url}" alt="${media.file_name}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0;">`);
            if (typeof loadMediaGallery === 'function') loadMediaGallery();
          } catch (err) {
            sectionHtml.value = sectionHtml.value.replace('<!-- Uploading pasted image... -->', `<!-- Upload failed: ${err.message} -->`);
          }
        }
      }
    });
  }
}

