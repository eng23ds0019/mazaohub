-- PostgreSQL Database Schema for MazaoHub

-- 1. Users Table (Admin authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL
);

-- 3. Articles Table (Blog and Field Notes)
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  summary TEXT,
  content_html TEXT NOT NULL,
  image_url TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  seo_title VARCHAR(255),
  seo_desc TEXT
);

-- 4. Sections Table (Dynamic page section content)
CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  page_slug VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  content_html TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(page_slug, section_id)
);

-- 5. Media Table (Uploaded files library)
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Settings Table (Global site settings)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT
);

-- 7. Form Submissions Table (Contact & demo requests)
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  form_type VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  company VARCHAR(255),
  message TEXT,
  details_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_sections_page_slug ON sections(page_slug);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
