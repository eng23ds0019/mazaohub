# MazaoHub Dynamic CMS & Web Application

A modern, editable, database-driven recreation of [mazaohub.com](https://mazaohub.com/) built with Node.js, Express, and a dual-database architecture supporting both **PostgreSQL** and **SQLite** fallback out of the box.

Every single page section, product detail page, global setting, contact form submission, and blog article is managed dynamically via an integrated, responsive Admin Panel.

---

## Technical Stack
- **Frontend**: HTML5, CSS3, JavaScript (D3.js Natural Earth map, scroll reveals, ticker sliders, and layout animations matched exactly with the original site).
- **Backend**: Node.js + Express (REST API structure).
- **Database**: PostgreSQL (Production) / SQLite (Fallback for local dev with no configurations).
- **Authentication**: JWT (JSON Web Tokens) with secure HttpOnly cookies.

---

## Project Structure
```
├── /data                # Local SQLite database file location (Fallback)
├── /public              # Static folder served by Express
│   ├── /admin           # Admin panel view and scripts
│   │   ├── index.html   # Admin dashboard UI
│   │   ├── admin.css    # Admin styling
│   │   └── admin.js     # Admin CRUD API handlers
│   ├── /css             # Frontend website styles
│   │   └── style.css    # Extracted unified CSS stylesheet
│   ├── /js              # Website frontend scripts
│   │   ├── main.js      # Bootstrapper (fetches data, starts map, observers)
│   │   └── router.js    # SPA client router (swaps views via URL hashes)
│   ├── /uploads         # Folder for image uploads managed by CMS
│   └── index.html       # Dynamic website frame
├── /src                 # Backend source code
│   ├── /config          # Configurations
│   │   └── db.js        # Dual-database connection driver
│   ├── /controllers     # Route controllers for APIs
│   │   ├── authController.js
│   │   ├── contentController.js
│   │   ├── articleController.js
│   │   └── submissionController.js
│   ├── /middleware      # Verification middleware
│   │   └── auth.js      # JWT authorization verifier
│   ├── /routes          # API endpoints definition
│   │   ├── auth.js
│   │   ├── content.js
│   │   ├── articles.js
│   │   ├── media.js
│   │   └── submissions.js
│   └── server.js        # Express application entry point
├── package.json         # Package scripts and dependencies
├── schema.sql           # PostgreSQL reference database schema
└── seed.js              # Scraped database seeder script
```

---

## Deployment & Setup

### Prerequisites
- Node.js (v16.0.0 or higher)
- npm (Node Package Manager)
- PostgreSQL (Optional; defaults to SQLite if configuration is missing)

### Installation
1. Clone or copy the project files to your directory.
2. Open a terminal in the project directory and install the npm dependencies:
   ```bash
   npm install
   ```

### Configuration
Create a `.env` file in the root directory (already created locally) to manage environment variables:
```env
PORT=3000
JWT_SECRET=your_jwt_secret_token_here

# PostgreSQL Configuration (Uncomment and fill to run on PostgreSQL in production)
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=yourpassword
# DB_NAME=mazaohub
# DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/mazaohub
```

### Seeding original content
To populate the database with all 114 pages, categories, settings, and original news articles extracted from the reference site:
```bash
npm run seed
```

### Running Locally
Run the server in development mode:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the live site.

---

## Admin Panel Access
- URL: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Default Admin Account**:
  - **Email**: `admin@mazaohub.com`
  - **Password**: `admin123`

---

## API Reference Documentation

### Public API Endpoints
- `GET /api/content/sections` - Retrieve all editable page layout views.
- `GET /api/content/settings` - Retrieve global settings (SEO tags, contact info).
- `GET /api/articles` - Get list of blog posts (supports optional `?search=query` or `?category=slug`).
- `GET /api/articles/:slug` - Retrieve an individual article content by slug.
- `GET /api/articles/categories` - Get all article categories.
- `POST /api/submissions` - Submit contact or booking forms. Matches details to storage.

### Admin CMS Protected API (Requires JWT Cookie/Header)
- `POST /api/auth/login` - Sign-in admin credentials.
- `POST /api/auth/logout` - Clear session tokens.
- `GET /api/auth/me` - Validate session user details.
- `PUT /api/content/sections/:page_slug/:section_id` - Update raw HTML content for a page view.
- `PUT /api/content/settings` - Update global SEO metadata and contact numbers.
- `POST /api/articles` - Publish new article.
- `PUT /api/articles/:id` - Edit existing article.
- `DELETE /api/articles/:id` - Remove article.
- `POST /api/articles/categories` - Create new article category.
- `DELETE /api/articles/categories/:id` - Remove category.
- `POST /api/media/upload` - Upload image asset using Multer (form-data).
- `GET /api/media` - View media library collection.
- `DELETE /api/media/:id` - Unlink file from disk and database records.
- `GET /api/submissions` - Read all submissions forms.
- `DELETE /api/submissions/:id` - Delete submission logs.
