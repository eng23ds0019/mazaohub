const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

// Load environment variables
require('dotenv').config();

let dbType = 'sqlite'; // fallback default
let pgPool = null;
let sqliteDb = null;

// Initialize Database connection
async function initDb() {
  const usePg = process.env.DB_HOST || process.env.DATABASE_URL;
  
  if (usePg) {
    console.log('PostgreSQL configuration found. Attempting connection...');
    try {
      const config = process.env.DATABASE_URL 
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
          };
      
      pgPool = new Pool({
        ...config,
        connectionTimeoutMillis: 5000 // 5 seconds timeout
      });

      // Test connection
      const client = await pgPool.connect();
      client.release();
      dbType = 'postgres';
      console.log('Successfully connected to PostgreSQL database.');
      return;
    } catch (err) {
      console.warn('PostgreSQL connection failed. Error:', err.message);
      console.warn('Falling back to SQLite...');
    }
  } else {
    console.log('No PostgreSQL configuration found in .env. Using local SQLite database...');
  }

  // SQLite fallback
  dbType = 'sqlite';
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'mazaohub.sqlite');
  
  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        reject(err);
      } else {
        console.log(`Connected to SQLite database at: ${dbPath}`);
        // Enable foreign key support in SQLite
        sqliteDb.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
          if (pragmaErr) console.warn('SQLite PRAGMA foreign_keys failed:', pragmaErr.message);
          resolve();
        });
      }
    });
  });
}

// Convert PostgreSQL param syntax ($1, $2, etc.) to SQLite syntax (?)
function convertParams(queryText, params) {
  if (dbType === 'postgres') {
    return { text: queryText, values: params };
  }
  // Replace $1, $2, etc. with ?1, ?2, etc.
  const sqliteText = queryText.replace(/\$(\d+)/g, '?$1');
  return { text: sqliteText, values: params };
}

// Generic query helper (returns array of rows)
async function query(text, params = []) {
  if (!pgPool && !sqliteDb) {
    await initDb();
  }

  const { text: formattedText, values } = convertParams(text, params);

  if (dbType === 'postgres') {
    const res = await pgPool.query(formattedText, values);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(formattedText, values, (err, rows) => {
        if (err) {
          console.error(`SQLite query error: ${formattedText}`, err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

// Generic execute helper (returns insertId/lastID or rowCount/changes)
async function run(text, params = []) {
  if (!pgPool && !sqliteDb) {
    await initDb();
  }

  const { text: formattedText, values } = convertParams(text, params);

  if (dbType === 'postgres') {
    const res = await pgPool.query(formattedText, values);
    // For INSERT queries returning ID, we'll expect RETURNING id in Postgres
    return {
      rowCount: res.rowCount,
      rows: res.rows
    };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(formattedText, values, function (err) {
        if (err) {
          console.error(`SQLite run error: ${formattedText}`, err);
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }
}

// Database schema setup
async function createTables() {
  if (dbType === 'postgres') {
    // PostgreSQL schema
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL
      );
    `);

    await run(`
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
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS sections (
        id SERIAL PRIMARY KEY,
        page_slug VARCHAR(255) NOT NULL,
        section_id VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        content_html TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(page_slug, section_id)
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(255) NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT
      );
    `);

    await run(`
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
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS trash_bin (
        id SERIAL PRIMARY KEY,
        item_type VARCHAR(100) NOT NULL,
        original_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        data_json TEXT NOT NULL,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    // SQLite schema
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        summary TEXT,
        content_html TEXT NOT NULL,
        image_url TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        seo_title TEXT,
        seo_desc TEXT
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_slug TEXT NOT NULL,
        section_id TEXT NOT NULL,
        title TEXT,
        content_html TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(page_slug, section_id)
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_type TEXT NOT NULL,
        name TEXT,
        email TEXT,
        company TEXT,
        message TEXT,
        details_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS trash_bin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type TEXT NOT NULL,
        original_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        data_json TEXT NOT NULL,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  console.log('All database tables verified/created successfully.');
}

function getDbType() {
  return dbType;
}

module.exports = {
  initDb,
  query,
  run,
  createTables,
  getDbType
};
