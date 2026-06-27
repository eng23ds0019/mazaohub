const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

async function seed() {
  console.log('--- Starting Database Seeding ---');
  
  // 1. Initialize DB and tables
  await db.initDb();
  await db.createTables();

  // 2. Create Default Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mazaohub.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'Mazao@2024';
  const hashedPassword = await bcrypt.hash(adminPass, 10);
  
  // Check if admin user exists — always update password on seed so env var changes take effect
  const existingUsers = await db.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
  if (existingUsers.length === 0) {
    await db.run(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      ['MazaoHub Admin', adminEmail, hashedPassword, 'admin']
    );
    console.log(`✅ Created admin user: ${adminEmail}`);
  } else {
    // Update password so env var changes always apply
    await db.run(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, adminEmail]
    );
    console.log(`✅ Updated admin password for: ${adminEmail}`);
  }

  // 3. Load scraped content
  const scrapedPath = path.join(__dirname, 'data', 'scraped_content.json');
  if (!fs.existsSync(scrapedPath)) {
    console.error(`Scraped content file not found at: ${scrapedPath}`);
    process.exit(1);
  }
  
  const scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
  console.log(`Loaded ${scrapedData.length} items from scraped_content.json`);

  // 4. Create default categories
  const categories = [
    { name: 'Field Notes', slug: 'field-notes' },
    { name: 'News & Announcements', slug: 'news-announcements' },
    { name: 'Agribusiness', slug: 'agribusiness' },
    { name: 'Agronomy', slug: 'agronomy' }
  ];

  const categoryMap = {}; // name -> id
  for (const cat of categories) {
    const existing = await db.query('SELECT id FROM categories WHERE slug = $1', [cat.slug]);
    let catId;
    if (existing.length === 0) {
      if (db.getDbType() === 'postgres') {
        const result = await db.run('INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id', [cat.name, cat.slug]);
        catId = result.rows[0].id;
      } else {
        const result = await db.run('INSERT INTO categories (name, slug) VALUES ($1, $2)', [cat.name, cat.slug]);
        catId = result.lastID;
      }
    } else {
      catId = existing[0].id;
    }
    categoryMap[cat.slug] = catId;
  }
  console.log('Categories set up:', categoryMap);

  // 5. Seed Articles and Sections
  let articlesCount = 0;
  let sectionsCount = 0;

  for (const item of scrapedData) {
    const route = item.route;
    const headings = item.headings;
    const contentHtml = item.content_html;

    if (route.startsWith('news/') && route !== 'news') {
      // It is an article!
      const slug = route.substring(5); // strip 'news/'
      const title = headings[0] || slug.replace(/-/g, ' ');
      const summary = headings[1] || '';
      
      // Determine category based on slug keywords
      let catId = categoryMap['field-notes']; // default
      if (slug.includes('announc') || slug.includes('expand') || slug.includes('unveil')) {
        catId = categoryMap['news-announcements'];
      } else if (slug.includes('agri') || slug.includes('market') || slug.includes('coop')) {
        catId = categoryMap['agribusiness'];
      } else if (slug.includes('soil') || slug.includes('sensor') || slug.includes('fertilizer') || slug.includes('agronom')) {
        catId = categoryMap['agronomy'];
      }

      // Check if article exists
      const existing = await db.query('SELECT id FROM articles WHERE slug = $1', [slug]);
      if (existing.length === 0) {
        await db.run(
          'INSERT INTO articles (title, slug, summary, content_html, category_id, seo_title, seo_desc) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [title, slug, summary, contentHtml, catId, title, summary.substring(0, 160)]
        );
        articlesCount++;
      }
    } else {
      // It is a page section!
      const pageSlug = route === '' ? 'home' : route;
      const sectionId = 'main';
      const title = headings[0] || pageSlug;

      const existing = await db.query('SELECT id FROM sections WHERE page_slug = $1 AND section_id = $2', [pageSlug, sectionId]);
      if (existing.length === 0) {
        await db.run(
          'INSERT INTO sections (page_slug, section_id, title, content_html) VALUES ($1, $2, $3, $4)',
          [pageSlug, sectionId, title, contentHtml]
        );
        sectionsCount++;
      }
    }
  }

  console.log(`Seeded ${articlesCount} articles.`);
  console.log(`Seeded ${sectionsCount} page sections.`);

  // 6. Seed Site Settings (Contact Info, Navigation Menu, etc.)
  const defaultSettings = [
    { key: 'site_name', value: 'MazaoHub' },
    { key: 'site_title', value: 'MazaoHub — The Hospital for Farms | Soil Science & AI Agronomy' },
    { key: 'site_description', value: 'MazaoHub is the hospital for farms: soil science, AI agronomy and a real human in every field — giving the world\'s smallholder farmers the data to stop farming blind.' },
    { key: 'contact_email', value: 'info@mazaohub.com' },
    { key: 'contact_phone', value: '+255 744 333 444' },
    { key: 'contact_address', value: 'Dar es Salaam, Tanzania' },
    { key: 'social_linkedin', value: 'https://linkedin.com/company/mazaohub' },
    { key: 'social_twitter', value: 'https://twitter.com/mazaohub' },
    { key: 'nav_menu', value: JSON.stringify([
      { text: 'About', href: '#/about' },
      { text: 'What we offer', href: '#/offer' },
      { text: 'AI Engine', href: '#/ai' },
      { text: 'Data Intelligence', href: '#/engines' },
      { text: 'Global', href: '#/global' },
      { text: 'Field Notes', href: '#/news' },
      { text: 'Products', href: '#/products' },
      { text: 'Pricing', href: '#/pricing' }
    ])}
  ];

  for (const setting of defaultSettings) {
    const existing = await db.query('SELECT * FROM settings WHERE key = $1', [setting.key]);
    if (existing.length === 0) {
      await db.run('INSERT INTO settings (key, value) VALUES ($1, $2)', [setting.key, setting.value]);
    }
  }
  console.log('Seeded global website settings.');

  console.log('--- Database Seeding Completed Successfully ---');
}

module.exports = seed;

if (require.main === module) {
  seed().catch(err => {
    console.error('Seeding failed with error:', err);
    process.exit(1);
  });
}

