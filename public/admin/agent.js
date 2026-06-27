/**
 * MazaoHub Advanced Offline AI Compiler Agent Engine
 * Features zero-limitation heuristic NLP tokenization. Matches conversational English 
 * commands to direct database updates, section scans, article image swaps, 
 * article text replacements, soft deletions, presets, and SEO mutations.
 */

window.MazaoLocalAgent = (function() {
  const PRESETS = {
    default: {
      theme_canopy: '#06280c',
      theme_forest: '#084012',
      theme_leaf: '#126c22',
      theme_bright: '#14c834',
      theme_gold: '#e8b23a',
      theme_orange: '#e8732a',
      theme_soil: '#070b08'
    },
    harvest: {
      theme_canopy: '#2b1704',
      theme_forest: '#482604',
      theme_leaf: '#7c430c',
      theme_bright: '#e8732a',
      theme_gold: '#e8b23a',
      theme_orange: '#d35400',
      theme_soil: '#130c04'
    },
    ocean: {
      theme_canopy: '#051f2e',
      theme_forest: '#0a3a40',
      theme_leaf: '#14727d',
      theme_bright: '#2ecc71',
      theme_gold: '#e8b23a',
      theme_orange: '#e67e22',
      theme_soil: '#030f14'
    },
    midnight: {
      theme_canopy: '#060b28',
      theme_forest: '#0d1740',
      theme_leaf: '#1c307d',
      theme_bright: '#3498db',
      theme_gold: '#f1c40f',
      theme_orange: '#e67e22',
      theme_soil: '#030513'
    }
  };

  const COLOR_NAME_MAP = {
    'green': '#14c834',
    'forest green': '#084012',
    'emerald green': '#064e3b',
    'lime green': '#32cd32',
    'neon green': '#14c834',
    'bright green': '#14c834',
    'dark green': '#06280c',
    'harvest earth': '#e8732a',
    'orange': '#e8732a',
    'bright orange': '#e8732a',
    'gold': '#e8b23a',
    'amber': '#fbbf24',
    'yellow': '#f1c40f',
    'blue': '#3498db',
    'royal blue': '#1c307d',
    'deep blue': '#060b28',
    'red': '#ef4444',
    'crimson': '#dc2626',
    'white': '#ffffff',
    'black': '#000000',
    'soil': '#070b08',
    'dark soil': '#030513',
    'midnight': '#030513'
  };

  function parseColor(val) {
    const clean = val.trim().toLowerCase();
    if (clean.startsWith('#')) return clean;
    if (COLOR_NAME_MAP[clean]) return COLOR_NAME_MAP[clean];
    if (/^[0-9a-f]{3,8}$/.test(clean)) return '#' + clean;
    return null;
  }

  function extractQuotedStrings(text) {
    const matches = [];
    const regex = /['"`](.*?)['"`]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  function extractFindReplace(text) {
    const quoted = extractQuotedStrings(text);
    if (quoted.length >= 2) {
      return { findText: quoted[0], replaceText: quoted[1] };
    }
    
    // Fuzzy matching for: (replace|change|update|swap) (from)? [find] (with|to) [replace]
    const regex = /(?:replace|change|update|swap)\s+(?:from\s+)?['"`]?(.*?)(?:['"`]?\s+(?:with|to)\s+['"`]?)(.*?)(?:['"`]?)$/i;
    const match = text.match(regex);
    if (match) {
      return { findText: match[1].trim(), replaceText: match[2].trim() };
    }
    return null;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function renderDiff(diffText) {
    return diffText.split('\n').map(line => {
      if (line.startsWith('+ ')) {
        return `<span style="color:#a7f3d0; background:rgba(16,185,129,0.15); display:block; padding:1px 4px; font-family:var(--mono);">${escapeHtml(line)}</span>`;
      } else if (line.startsWith('- ')) {
        return `<span style="color:#fca5a5; background:rgba(239,68,68,0.15); display:block; padding:1px 4px; font-family:var(--mono);">${escapeHtml(line)}</span>`;
      }
      return escapeHtml(line);
    }).join('\n');
  }

  return {
    async executeCommand(prompt) {
      const logs = [];
      const actions = [];
      let explanation = "";
      
      logs.push({ success: true, message: `[Compiler Init]: Commencing semantic NLP compiling...` });
      
      const text = prompt.trim();
      const lowerText = text.toLowerCase();
      const quoted = extractQuotedStrings(text);

      // 0. OFFLINE WEBSITE EDITOR CAPABILITIES
      // list sections
      if (lowerText.includes('list sections') || lowerText.includes('show sections') || lowerText.includes('view sections') || lowerText.includes('what sections') || lowerText.includes('available sections')) {
        logs.push({ success: true, message: `[Lexer]: Match found. Intention: List HTML Sections` });
        actions.push({ type: 'editor_list_sections' });
        explanation = `Resolved instruction: Scan HTML file and list all editable section IDs.`;
      }
      
      // read section
      else if (lowerText.includes('read section') || lowerText.includes('show section') || lowerText.includes('view section') || lowerText.includes('display section')) {
        const idMatch = text.match(/(?:read|show|view|display)\s+section\s+['"`]?([a-zA-Z0-9_-]+)['"`]?/i);
        const sectionId = idMatch ? idMatch[1] : (quoted[0] || '');
        if (sectionId) {
          logs.push({ success: true, message: `[Lexer]: Match found. Intention: Read HTML Section content` });
          actions.push({ type: 'editor_read_section', section_id: sectionId });
          explanation = `Resolved instruction: Retrieve HTML code for section <b>"${sectionId}"</b>.`;
        }
      }
      
      // replace text in HTML staging
      else if ((lowerText.includes('replace') || lowerText.includes('change') || lowerText.includes('update') || lowerText.includes('swap')) && 
               (lowerText.includes('with') || lowerText.includes('to')) &&
               !(lowerText.includes('in article') || lowerText.includes('inside article') || lowerText.includes('in blog') || lowerText.includes('inside blog')) &&
               !(lowerText.includes('color') || lowerText.includes('colour') || lowerText.includes('preset') || lowerText.includes('email') || lowerText.includes('phone') || lowerText.includes('address') || lowerText.includes('title to') || lowerText.includes('description to'))) {
        
        const parsed = extractFindReplace(text);
        if (parsed) {
          logs.push({ success: true, message: `[Lexer]: Match found. Intention: Replace text in HTML staging copy` });
          actions.push({ type: 'editor_replace_text', findText: parsed.findText, replaceText: parsed.replaceText });
          explanation = `Resolved instruction: Search for <i>"${parsed.findText}"</i> in HTML staging file and replace it with <i>"${parsed.replaceText}"</i>.`;
        }
      }
      
      // preview changes / diff
      else if (lowerText.includes('preview changes') || lowerText.includes('show diff') || lowerText.includes('what changed') || lowerText.includes('view changes') || lowerText.includes('preview diff')) {
        logs.push({ success: true, message: `[Lexer]: Match found. Intention: Preview pending HTML changes` });
        actions.push({ type: 'editor_preview_changes' });
        explanation = `Resolved instruction: Compute unified diff of staging changes vs live website file.`;
      }
      
      // publish changes
      else if (lowerText.includes('publish') || lowerText.includes('go live') || lowerText.includes('apply changes') || lowerText.includes('save to live')) {
        logs.push({ success: true, message: `[Lexer]: Match found. Intention: Publish HTML changes to live website` });
        actions.push({ type: 'editor_publish_to_live' });
        explanation = `Resolved instruction: Copy staging edits to live index.html and trigger a CMS database synchronization.`;
      }
      
      // list backups
      else if (lowerText.includes('list backups') || lowerText.includes('show backups') || lowerText.includes('view backups')) {
        logs.push({ success: true, message: `[Lexer]: Match found. Intention: List timestamped backups` });
        actions.push({ type: 'editor_list_backups' });
        explanation = `Resolved instruction: Query list of previous live site backups.`;
      }
      
      // restore backup
      else if (lowerText.includes('restore') || lowerText.includes('revert')) {
        const filenameMatch = text.match(/(index_backup_[0-9_]+\.html)/i);
        const filename = filenameMatch ? filenameMatch[1] : (quoted[0] || '');
        if (filename) {
          logs.push({ success: true, message: `[Lexer]: Match found. Intention: Restore website backup` });
          actions.push({ type: 'editor_restore_backup', filename });
          explanation = `Resolved instruction: Restore live site and database to backup version <b>"${filename}"</b>.`;
        }
      }

      // 1. DELETE ARTICLE
      // e.g. "delete article titled 'Spam Blog'", "remove article 'Hello World'", "delete article pH testing"
      if (actions.length === 0 && (lowerText.includes('delete') || lowerText.includes('remove') || lowerText.includes('discard'))) {
        if (lowerText.includes('article') || lowerText.includes('blog') || lowerText.includes('post')) {
          let title = quoted[0];
          if (!title) {
            // Try extracting using keyword split
            const parts = text.split(/(?:article|blog|post)(?:\s+titled|\s+named)?\s+/i);
            if (parts.length > 1) title = parts[1].trim();
          }
          if (title) {
            logs.push({ success: true, message: `[Lexer]: Match found. Intention: Delete Article` });
            actions.push({
              type: 'delete_article',
              title: title
            });
            explanation = `Resolved instruction: Soft-delete article titled <b>"${title}"</b> and move to trash.`;
          }
        }
      }

      // 2. CHANGE PICTURE IN ARTICLE
      // e.g. "change featured image of article 'pH Testing' to '/uploads/ph.png'"
      // e.g. "change picture of article titled 'Watering' to 'water.jpg'"
      if (actions.length === 0 && (lowerText.includes('image') || lowerText.includes('picture') || lowerText.includes('pic') || lowerText.includes('photo') || lowerText.includes('img'))) {
        if (lowerText.includes('article') || lowerText.includes('blog') || lowerText.includes('post')) {
          let title = quoted[0];
          let imageUrl = quoted[1];
          if (!imageUrl) {
            const imgMatch = text.match(/to\s+['"`]?([^\s'"`]+)['"`]?/i);
            if (imgMatch) imageUrl = imgMatch[1];
          }
          
          if (!title) {
            const titleMatch = text.match(/(?:article|blog|post)(?:\s+titled|\s+named)?\s+['"`]?(.*?)(?:['"`]?\s+to\s+)/i);
            if (titleMatch) title = titleMatch[1].trim();
          }

          if (title && imageUrl) {
            logs.push({ success: true, message: `[Lexer]: Match found. Intention: Update Article Image URL` });
            actions.push({
              type: 'update_article_image',
              title: title,
              image_url: imageUrl
            });
            explanation = `Resolved instruction: Update featured image for article <b>"${title}"</b> to <b>"${imageUrl}"</b>.`;
          }
        }
      }

      // 3. REPLACE TEXT INSIDE ARTICLE
      // e.g. "replace 'soil water' with 'irrigation index' in article 'Smart Advisory'"
      // e.g. "change 'original text' to 'new text' inside article 'pH Testing'"
      if (actions.length === 0 && (lowerText.includes('replace') || lowerText.includes('change') || lowerText.includes('update') || lowerText.includes('swap')) && 
          (lowerText.includes('in article') || lowerText.includes('inside article') || lowerText.includes('in blog') || lowerText.includes('inside blog'))) {
        
        let title = quoted[2];
        if (!title) {
          const titleMatch = text.match(/(?:in|inside)\s+(?:article|blog|post)\s+['"`]?(.*?)['"`]?$/i);
          if (titleMatch) title = titleMatch[1].trim();
        }

        const cleanTextForFindReplace = text.replace(/(?:in|inside)\s+(?:article|blog|post)\s+.*$/i, '').trim();
        const parsed = extractFindReplace(cleanTextForFindReplace);

        if (parsed && title) {
          logs.push({ success: true, message: `[Lexer]: Match found. Intention: Replace Text inside Article` });
          actions.push({
            type: 'replace_text_in_article',
            title: title,
            target: parsed.findText,
            replacement: parsed.replaceText
          });
          explanation = `Resolved instruction: Search for text match <i>"${parsed.findText}"</i> and replace with <i>"${parsed.replaceText}"</i> inside article <b>"${title}"</b>.`;
        }
      }

      // 4. GENERAL PAGE SECTION REPLACEMENT (SPECIFIC OR ALL PAGES SCAN)
      // e.g. "replace 'smallholders feed' with 'Farming Re-imagined' on homepage"
      // e.g. "replace 'old words' with 'new words' on about"
      // e.g. "replace 'carbon farming' with 'climate agronomy' on website"
      if (actions.length === 0 && (lowerText.includes('replace') || lowerText.includes('change') || lowerText.includes('swap')) && quoted.length >= 2) {
        const searchText = quoted[0];
        const replaceText = quoted[1];
        
        // Find if page slug is specified
        let page = null;
        const pageList = ['home', 'about', 'offer', 'ai', 'engines', 'global', 'products', 'pricing'];
        for (const p of pageList) {
          if (lowerText.includes(p)) {
            page = p;
            break;
          }
        }
        if (lowerText.includes('homepage')) page = 'home';
        
        logs.push({ success: true, message: `[Lexer]: Match found. Intention: Section Text Replacement` });
        actions.push({
          type: 'replace_text',
          page_slug: page, // if null, compiler will scan all pages/sections
          search: searchText,
          replacement: replaceText
        });
        
        explanation = page 
          ? `Resolved instruction: Search for <i>"${searchText}"</i> and replace with <i>"${replaceText}"</i> on page/view <b>${page.toUpperCase()}</b>.`
          : `Resolved instruction: Global scan across all pages/views for <i>"${searchText}"</i> and replace with <i>"${replaceText}"</i>.`;
      }

      // 5. THEME PRESETS
      if (actions.length === 0 && (lowerText.includes('preset') || lowerText.includes('theme preset') || lowerText.includes('swatch'))) {
        let presetName = null;
        for (const key of Object.keys(PRESETS)) {
          if (lowerText.includes(key)) {
            presetName = key;
            break;
          }
        }
        
        if (presetName) {
          logs.push({ success: true, message: `[Lexer]: Match found. Intention: Preset Theme Trigger (${presetName})` });
          actions.push({
            type: 'preset',
            preset: presetName,
            colors: PRESETS[presetName]
          });
          explanation = `Resolved preset target to <b>${presetName.toUpperCase()}</b> preset. Initiating system color override.`;
        }
      }

      // 6. INDIVIDUAL COLOR CUSTOMIZATION
      // e.g. "set canopy color to lime green", "change bright to #14c834"
      if (actions.length === 0 && (lowerText.includes('color') || lowerText.includes('colour') || lowerText.includes('set') || lowerText.includes('change'))) {
        const colorLabels = ['canopy', 'forest', 'leaf', 'bright', 'signal', 'button', 'gold', 'accent', 'orange', 'badge', 'soil', 'background'];
        let matchedLabel = null;
        for (const label of colorLabels) {
          if (lowerText.includes(label)) {
            matchedLabel = label;
            break;
          }
        }

        if (matchedLabel) {
          // Parse hex or color name
          // regex look for hex or word after "to" or "into"
          let colorVal = null;
          const toMatch = text.match(/(?:to|into)\s+([#\w\s]+)$/i);
          if (toMatch) {
            colorVal = toMatch[1].trim();
          } else {
            const colorMatch = text.match(/(?:color|colour)\s+([#\w\s]+)$/i);
            if (colorMatch) {
              colorVal = colorMatch[1].trim();
              if (colorVal.startsWith('into ')) {
                colorVal = colorVal.substring(5).trim();
              }
            }
          }

          if (colorVal) {
            const hex = parseColor(colorVal);
            if (hex) {
              let key = matchedLabel;
              if (key === 'signal' || key === 'button') key = 'bright';
              if (key === 'accent') key = 'gold';
              if (key === 'badge') key = 'orange';
              if (key === 'background') key = 'soil';

              logs.push({ success: true, message: `[Lexer]: Match found. Intention: Color Mutation (${key} -> ${hex})` });
              actions.push({
                type: 'color',
                field: `theme_${key}`,
                value: hex
              });
              explanation = `Resolved Color mutation: set <b>theme_${key}</b> to color code <b>${hex}</b>.`;
            }
          }
        }
      }

      // 7. SEO & HQ CONTACT UPDATES
      // e.g. "set email to support@mazao.com", "change meta description to smart agronomy"
      if (actions.length === 0 && (lowerText.includes('email') || lowerText.includes('phone') || lowerText.includes('title') || lowerText.includes('description') || lowerText.includes('address'))) {
        const fields = ['title', 'description', 'email', 'phone', 'address'];
        let matchedField = null;
        for (const f of fields) {
          if (lowerText.includes(f)) {
            matchedField = f;
            break;
          }
        }

        if (matchedField) {
          const valMatch = text.match(/to\s+(.+)$/i);
          if (valMatch) {
            const val = valMatch[1].trim().replace(/^['"`]|['"`]$/g, '');
            const fieldMap = {
              'title': 'site_title',
              'description': 'site_description',
              'email': 'contact_email',
              'phone': 'contact_phone',
              'address': 'contact_address'
            };
            const dbField = fieldMap[matchedField];

            logs.push({ success: true, message: `[Lexer]: Match found. Intention: Metadata Sync` });
            actions.push({
              type: 'metadata',
              field: dbField,
              value: val
            });
            explanation = `Resolved HQ Metadata change: set <b>${dbField}</b> to <b>"${val}"</b>.`;
          }
        }
      }

      // 8. POST ARTICLE
      if (actions.length === 0 && (lowerText.includes('create article') || lowerText.includes('post article') || lowerText.includes('new blog') || lowerText.includes('post a blog'))) {
        let title = quoted[0];
        let summary = quoted[1] || `Field notes and precision advisory regarding ${title || 'soil diagnostic health'}.`;
        let category = quoted[2] || 'Soil Advisory';

        if (!title) {
          const titleMatch = text.match(/(?:article|blog|post|titled|named)\s+['"`]?(.*?)['"`]?$/i);
          if (titleMatch) title = titleMatch[1].trim();
        }

        if (title) {
          logs.push({ success: true, message: `[Lexer]: Match found. Intention: Create Article` });
          actions.push({
            type: 'article',
            title: title,
            summary: summary,
            category_name: category
          });
          explanation = `Resolved Article Publication: creating new article titled <b>"${title}"</b> in category <b>"${category}"</b>.`;
        }
      }

      // 9. IF NO MATCHING ACTION FOUND
      if (actions.length === 0) {
        logs.push({ success: true, message: `[Lexer]: No direct mutations compiled. Handing over to Read Advisory.` });
        let reply = `I parsed your command but did not detect a valid database mutation action. I can compile and execute commands like:<br>
        • <b>Article image updates</b> (e.g. <i>"change picture of article 'Sustainable Farming' to '/uploads/new.png'"</i>)<br>
        • <b>Article text edits</b> (e.g. <i>"replace 'pH level' with 'acidity index' in article 'Soil pH Testing'"</i>)<br>
        • <b>Article soft deletions</b> (e.g. <i>"delete article 'Spam Post'"</i>)<br>
        • <b>Global text swaps</b> (e.g. <i>"replace 'Original Text' with 'New Text' on website"</i>)<br>
        • <b>Presets and theme colors</b> (e.g. <i>"use midnight preset"</i> or <i>"change canopy color to forest green"</i>)<br>
        • <b>SEO / contact updates</b> (e.g. <i>"set contact email to info@mazaohub.com"</i>)`;

        return {
          success: true,
          explanation: reply,
          actions: [],
          logs: logs
        };
      }

      // EXECUTE THE COMPILED ACTIONS
      logs.push({ success: true, message: `[Executor]: Initiating transaction block execution...` });

      try {
        for (const action of actions) {
          // 0. OFFLINE WEBSITE HTML EDITOR EXECUTORS
          if (action.type === 'editor_list_sections') {
            logs.push({ success: true, message: `[Executor]: GET /api/content/editor/sections` });
            const res = await fetch('/api/content/editor/sections');
            const data = await res.json();
            if (data.success) {
              logs.push({ success: true, message: `[Executor]: Sections listed.` });
              explanation = `<b>Available HTML section IDs found:</b><br><ul style="list-style:disc; margin-left:20px; margin-top:8px;">` + 
                data.sections.map(id => `<li><code>${id}</code></li>`).join('') + `</ul>`;
            } else {
              throw new Error(data.error);
            }
          }
          
          else if (action.type === 'editor_read_section') {
            logs.push({ success: true, message: `[Executor]: GET /api/content/editor/read/${action.section_id}` });
            const res = await fetch(`/api/content/editor/read/${action.section_id}`);
            const data = await res.json();
            if (data.success) {
              logs.push({ success: true, message: `[Executor]: Read section successfully.` });
              explanation = `<b>HTML Section "${action.section_id}" Content (omitting base64 images):</b><br><pre style="background:rgba(0,0,0,0.5); border:1px solid var(--border); border-radius:8px; padding:14px; overflow-x:auto; margin-top:8px; font-family:var(--mono); font-size:12.5px; color:#6ee7b7; white-space:pre-wrap;"><code>${escapeHtml(data.html)}</code></pre>`;
            } else {
              throw new Error(data.error);
            }
          }
          
          else if (action.type === 'editor_replace_text') {
            logs.push({ success: true, message: `[Executor]: POST /api/content/editor/replace` });
            const res = await fetch('/api/content/editor/replace', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ findText: action.findText, replaceText: action.replaceText })
            });
            const data = await res.json();
            if (data.success) {
              logs.push({ success: true, message: `[Executor]: Replaced text successfully.` });
              explanation = `<b>Staging replacement successful!</b><br>
                <div style="margin-top:8px; padding:10px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.15); border-radius:8px;">
                  <b>FIND:</b> <code style="color:#fca5a5;">${escapeHtml(action.findText)}</code><br>
                  <b>REPLACE WITH:</b> <code style="color:#a7f3d0;">${escapeHtml(action.replaceText)}</code>
                </div><br>
                Run <code>preview changes</code> or <code>publish</code> to save this live.`;
            } else {
              throw new Error(data.error);
            }
          }
          
          else if (action.type === 'editor_preview_changes') {
            logs.push({ success: true, message: `[Executor]: GET /api/content/editor/preview` });
            const res = await fetch('/api/content/editor/preview');
            const data = await res.json();
            if (data.success) {
              logs.push({ success: true, message: `[Executor]: Computed diff preview.` });
              if (!data.diff) {
                explanation = `No changes currently pending between staging copy and live homepage file.`;
              } else {
                explanation = `<b>Pending Staging HTML Changes (Staging vs Live Diff):</b><br><pre style="background:rgba(0,0,0,0.5); border:1px solid var(--border); border-radius:8px; padding:14px; overflow-x:auto; margin-top:8px; font-family:var(--mono); font-size:12px; color:var(--text-main); white-space:pre-wrap;"><code>${renderDiff(data.diff)}</code></pre>`;
              }
            } else {
              throw new Error(data.error);
            }
          }
          
          else if (action.type === 'editor_publish_to_live') {
            logs.push({ success: true, message: `[Executor]: POST /api/content/editor/publish` });
            const res = await fetch('/api/content/editor/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ confirm: true })
            });
            const data = await res.json();
            if (data.success) {
              logs.push({ success: true, message: `[Executor]: Published to live website and database synchronized.` });
              explanation = `<b>Successfully published staging copy to live homepage!</b><br>
                <ul style="list-style:disc; margin-left:20px; margin-top:8px; display:flex; flex-direction:column; gap:4px;">
                  <li>Active homepage (<code>public/index.html</code>) updated.</li>
                  <li>Backup saved: <code>public/backups/${data.backupFile}</code></li>
                  <li>CMS dynamic database synchronized with updated sections.</li>
                </ul>`;
            } else {
              throw new Error(data.error);
            }
          }
          
          else if (action.type === 'editor_list_backups') {
            logs.push({ success: true, message: `[Executor]: GET /api/content/editor/backups` });
            const res = await fetch('/api/content/editor/backups');
            const data = await res.json();
            if (data.success) {
              logs.push({ success: true, message: `[Executor]: Backups listed.` });
              if (data.backups.length === 0) {
                explanation = `No previous backups found in the system.`;
              } else {
                explanation = `<b>Available index.html backups:</b><br><ul style="list-style:disc; margin-left:20px; margin-top:8px;">` +
                  data.backups.map(f => `<li><code>${f}</code></li>`).join('') + `</ul><br>Run <code>restore backup [filename]</code> to revert.`;
              }
            } else {
              throw new Error(data.error);
            }
          }
          
          else if (action.type === 'editor_restore_backup') {
            logs.push({ success: true, message: `[Executor]: POST /api/content/editor/backups/restore` });
            const res = await fetch('/api/content/editor/backups/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ backupFilename: action.filename, confirm: true })
            });
            const data = await res.json();
            if (data.success) {
              logs.push({ success: true, message: `[Executor]: Reverted to backup successfully.` });
              explanation = `<b>Successfully restored website from backup file "${action.filename}"!</b><br>Live homepage and dynamic database records were successfully rolled back.`;
            } else {
              throw new Error(data.error);
            }
          }

          // Preset / Color / SEO Metadata
          else if (action.type === 'preset' || action.type === 'color' || action.type === 'metadata') {
            logs.push({ success: true, message: `[Executor]: GET /api/content/settings (Fetching system state)` });
            const getRes = await fetch('/api/content/settings');
            const getData = await getRes.json();
            const currentSettings = getData.settings || {};

            let mergedSettings = { ...currentSettings };
            
            if (action.type === 'preset') {
              mergedSettings = { ...mergedSettings, ...action.colors };
              logs.push({ success: true, message: `[Executor]: Preset merging completed.` });
            } else if (action.type === 'color') {
              mergedSettings[action.field] = action.value;
              logs.push({ success: true, message: `[Executor]: Color mutation merged.` });
            } else if (action.type === 'metadata') {
              mergedSettings[action.field] = action.value;
              logs.push({ success: true, message: `[Executor]: Metadata field merged.` });
            }

            logs.push({ success: true, message: `[Executor]: PUT /api/content/settings (Updating settings table)` });
            const putRes = await fetch('/api/content/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mergedSettings)
            });
            const putData = await putRes.json();
            if (putData.success) {
              logs.push({ success: true, message: `[Executor]: Settings synced successfully.` });
            } else {
              throw new Error(putData.error || 'Failed to update settings database.');
            }
          }

          // Section Text Replacement (Scan specific or all pages)
          else if (action.type === 'replace_text') {
            const pagesToScan = action.page_slug 
              ? [action.page_slug] 
              : ['home', 'about', 'offer', 'ai', 'engines', 'global', 'products', 'pricing'];

            let replacedAny = false;
            for (const pageSlug of pagesToScan) {
              logs.push({ success: true, message: `[Executor]: Scanning sections on page "${pageSlug}"` });
              const getRes = await fetch(`/api/content/sections/${pageSlug}`);
              const getData = await getRes.json();
              const sections = getData.sections || [];

              for (const section of sections) {
                if (section.content_html.includes(action.search)) {
                  logs.push({ success: true, message: `[Executor]: Match found in section "${section.section_id}". Swapping...` });
                  const newHtml = section.content_html.replaceAll(action.search, action.replacement);
                  
                  // PUT update
                  const putRes = await fetch(`/api/content/sections/${pageSlug}/${section.section_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: section.title, content_html: newHtml })
                  });
                  const putData = await putRes.json();
                  if (putData.success) {
                    logs.push({ success: true, message: `[Executor]: Updated section "${section.section_id}".` });
                    replacedAny = true;
                  }
                }
              }
            }
            if (!replacedAny) {
              logs.push({ success: false, message: `[Executor Warning]: Search phrase "${action.search}" not matched on pages scanned.` });
            }
          }

          // Article Publication
          else if (action.type === 'article') {
            logs.push({ success: true, message: `[Executor]: GET /api/articles/categories` });
            const catRes = await fetch('/api/articles/categories');
            const catData = await catRes.json();
            const categories = catData.categories || [];
            
            let matchedCat = categories.find(c => c.name.toLowerCase().includes(action.category_name.toLowerCase()));
            let categoryId = matchedCat ? matchedCat.id : (categories[0]?.id || 1);

            const slug = action.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
            const articleData = {
              title: action.title,
              slug: slug,
              category_id: categoryId,
              image_url: '/uploads/admin_bg_farm.png',
              summary: action.summary,
              content_html: `
                <div class="field-advisory-article">
                  <h3>Precision Advisory: ${action.title}</h3>
                  <p>${action.summary}</p>
                  <p>Automatically published by the MazaoHub Local Agent. Sustainable and climate-smart agronomy coordinates parameters to boost yield.</p>
                </div>
              `
            };

            logs.push({ success: true, message: `[Executor]: POST /api/articles` });
            const postRes = await fetch('/api/articles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(articleData)
            });
            const postData = await postRes.json();
            if (postData.success) {
              logs.push({ success: true, message: `[Executor]: Published article ID ${postData.id}.` });
            } else {
              throw new Error(postData.error);
            }
          }

          // Update Article Image
          else if (action.type === 'update_article_image') {
            logs.push({ success: true, message: `[Executor]: Resolving article image update for "${action.title}"` });
            
            let resolvedImageUrl = action.image_url;
            if (!resolvedImageUrl.startsWith('/') && !resolvedImageUrl.startsWith('http')) {
              logs.push({ success: true, message: `[Executor]: Querying media library to resolve "${resolvedImageUrl}"` });
              try {
                const mediaRes = await fetch('/api/media');
                const mediaData = await mediaRes.json();
                if (mediaData.success && mediaData.media) {
                  const matchedMedia = mediaData.media.find(m => 
                    m.file_name.toLowerCase() === resolvedImageUrl.toLowerCase() ||
                    m.file_name.toLowerCase().includes(resolvedImageUrl.toLowerCase())
                  );
                  if (matchedMedia) {
                    resolvedImageUrl = matchedMedia.file_url;
                    logs.push({ success: true, message: `[Executor]: Resolved filename to: "${resolvedImageUrl}"` });
                  } else {
                    resolvedImageUrl = '/uploads/' + resolvedImageUrl;
                    logs.push({ success: true, message: `[Executor Warning]: Filename not found in library, using: "${resolvedImageUrl}"` });
                  }
                } else {
                  resolvedImageUrl = '/uploads/' + resolvedImageUrl;
                }
              } catch (e) {
                logs.push({ success: false, message: `[Executor Warning]: Media search failed, falling back to "/uploads/${resolvedImageUrl}"` });
                resolvedImageUrl = '/uploads/' + resolvedImageUrl;
              }
            }

            // Fetch articles to find ID
            const artRes = await fetch('/api/articles');
            const artData = await artRes.json();
            const article = (artData.articles || []).find(a => a.title.toLowerCase().includes(action.title.toLowerCase()));

            if (article) {
              logs.push({ success: true, message: `[Executor]: Article found (ID: ${article.id}). Fetching content...` });
              const getArticleRes = await fetch('/api/articles');
              const getArticleData = await getArticleRes.json();
              const fullArticle = getArticleData.articles.find(a => a.id === article.id);

              logs.push({ success: true, message: `[Executor]: PUT /api/articles/${article.id} (Updating image to "${resolvedImageUrl}")` });
              const putRes = await fetch(`/api/articles/${article.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: fullArticle.title,
                  slug: fullArticle.slug,
                  category_id: fullArticle.category_id,
                  image_url: resolvedImageUrl,
                  summary: fullArticle.summary || '',
                  content_html: fullArticle.content_html
                })
              });
              const putData = await putRes.json();
              if (putData.success) {
                logs.push({ success: true, message: `[Executor]: Article image synced successfully.` });
              } else {
                throw new Error(putData.error || 'Failed to update article image');
              }
            } else {
              throw new Error(`Article titled "${action.title}" not found.`);
            }
          }

          // Replace Text in Article
          else if (action.type === 'replace_text_in_article') {
            logs.push({ success: true, message: `[Executor]: Resolving article text replacement for "${action.title}"` });
            const artRes = await fetch('/api/articles');
            const artData = await artRes.json();
            const article = (artData.articles || []).find(a => a.title.toLowerCase().includes(action.title.toLowerCase()));

            if (article) {
              logs.push({ success: true, message: `[Executor]: Article found (ID: ${article.id}). Performing replace on content...` });
              const getArticleRes = await fetch('/api/articles');
              const getArticleData = await getArticleRes.json();
              const fullArticle = getArticleData.articles.find(a => a.id === article.id);

              if (fullArticle.content_html.includes(action.target)) {
                const newHtml = fullArticle.content_html.replaceAll(action.target, action.replacement);
                logs.push({ success: true, message: `[Executor]: PUT /api/articles/${article.id} (Syncing updated HTML)` });
                const putRes = await fetch(`/api/articles/${article.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: fullArticle.title,
                    slug: fullArticle.slug,
                    category_id: fullArticle.category_id,
                    image_url: fullArticle.image_url,
                    summary: fullArticle.summary || '',
                    content_html: newHtml
                  })
                });
                const putData = await putRes.json();
                if (putData.success) {
                  logs.push({ success: true, message: `[Executor]: Article content replaced and saved.` });
                } else {
                  throw new Error(putData.error || 'Failed to save updated article content');
                }
              } else {
                throw new Error(`Target text "${action.target}" not found inside the article content.`);
              }
            } else {
              throw new Error(`Article titled "${action.title}" not found.`);
            }
          }

          // Delete Article
          else if (action.type === 'delete_article') {
            logs.push({ success: true, message: `[Executor]: Locating article to delete: "${action.title}"` });
            const artRes = await fetch('/api/articles');
            const artData = await artRes.json();
            const article = (artData.articles || []).find(a => a.title.toLowerCase().includes(action.title.toLowerCase()));

            if (article) {
              logs.push({ success: true, message: `[Executor]: DELETE /api/articles/${article.id}` });
              const deleteRes = await fetch(`/api/articles/${article.id}`, { method: 'DELETE' });
              const deleteData = await deleteRes.json();
              if (deleteData.success) {
                logs.push({ success: true, message: `[Executor]: Article soft-deleted successfully.` });
                if (deleteData.trashId && window.showUndoToast) {
                  window.showUndoToast(deleteData.trashId, `Article "${action.title}" soft-deleted`);
                }
              } else {
                throw new Error(deleteData.error || 'Delete request rejected');
              }
            } else {
              throw new Error(`Article titled "${action.title}" not found.`);
            }
          }
        }
      } catch (err) {
        logs.push({ success: false, message: `[Executor Error]: ${err.message}` });
        return {
          success: false,
          explanation: `Offline compiler transaction failed: ${err.message}`,
          actions: actions,
          logs: logs
        };
      }

      logs.push({ success: true, message: `[Compiler]: All transactions successfully committed.` });
      return {
        success: true,
        explanation: explanation,
        actions: actions,
        logs: logs
      };
    }
  };
})();
