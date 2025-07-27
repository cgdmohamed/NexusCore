# cPanel Deployment Guide for CompanyOS

This guide walks you through deploying the CompanyOS application on cPanel hosting with Node.js support.

## Prerequisites

Before starting, ensure your cPanel hosting provider supports:
- **Node.js 18 or higher**
- **PostgreSQL database**
- **SSL/HTTPS support** (recommended)
- Sufficient disk space (minimum 500MB)
- Memory allocation (minimum 512MB)

## Step 1: Prepare Your Files

### 1.1 Build the Application Locally
```bash
# Install dependencies
npm install

# Build both frontend and backend (this creates the dist folder)
npm run build

# Verify the build was successful
ls -la dist/
# Should show: index.js (server) and public/ (frontend files)
```

### 1.2 Create Production Package
Create a ZIP file containing these essential files:
```
production-package/
├── dist/                    # Built application files
│   ├── index.js            # Server bundle
│   └── public/             # Frontend assets
├── package.json            # Dependencies list
├── package-lock.json       # Exact dependency versions
├── .env.example           # Environment template
├── README_PRODUCTION.md   # Production guide
├── CPANEL_DEPLOYMENT.md   # This deployment guide
└── shared/                # Shared schema (if needed)
    └── schema.ts
```

**Important Files to Include:**
- `dist/index.js` - Your built server application
- `dist/public/` - All frontend files (HTML, CSS, JS)
- `package.json` - Required for npm install
- `package-lock.json` - Ensures exact dependency versions

## Step 2: cPanel Database Setup

### 2.1 Create PostgreSQL Database
1. Log into your cPanel
2. Navigate to **PostgreSQL Databases**
3. Create a new database: `companyos_prod`
4. Create a database user with full privileges
5. Note down the connection details:
   - Database name
   - Username
   - Password
   - Host (usually localhost)
   - Port (usually 5432)

### 2.2 Import Database Schema
Use phpPgAdmin or command line to run:
```sql
-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Run your database migrations
-- Import the schema from your development database
```

## Step 3: Upload and Configure

### 3.1 Upload Files
1. **Access File Manager:**
   - Log into cPanel
   - Open **File Manager**
   - Navigate to your domain's root folder (usually `public_html/`)

2. **Upload Production Package:**
   - Click **Upload** and select your production ZIP file
   - Wait for upload to complete
   - Click **Extract** to unzip the files

3. **Verify File Structure:**
   ```
   public_html/
   ├── dist/
   │   ├── index.js           # Server application
   │   └── public/            # Frontend files
   ├── package.json
   ├── package-lock.json
   ├── .env                   # Create this next
   └── node_modules/          # Will be created by npm install
   ```

4. **Set Proper Permissions:**
   - Right-click on `dist/index.js` → Change Permissions → 755
   - Ensure all files are readable by the web server

### 3.2 Environment Configuration
Create `.env` file in the root directory:
```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/companyos_prod

# Session Security
SESSION_SECRET=your-super-secure-session-secret-here

# Application Settings
NODE_ENV=production
PORT=3000

# Optional: Custom domain settings
DOMAIN=yourdomain.com
```

## Step 4: Node.js Application Setup

### 4.1 Configure Node.js App in cPanel
1. **Navigate to Node.js Apps:**
   - In cPanel main interface, find **Software** section
   - Click **Node.js Apps** (or **Node.js Selector**)

2. **Create New Application:**
   - Click **Create Application** button
   
3. **Configure Application Settings:**
   - **Node.js Version**: Select `18.x` or higher (recommended: 18.17+)
   - **Application Mode**: `Production`
   - **Application Root**: `/home/yourusername/public_html/` (full path to your domain)
   - **Application URL**: Leave blank or set to your domain
   - **Application Startup File**: `dist/index.js`
   - **Environment Variables**: Leave empty for now (we'll add these next)

4. **Advanced Settings:**
   - **Memory Limit**: Set to at least 512MB if available
   - **CPU Limit**: Use default unless specified by hosting provider
   - **Restart Policy**: Enable automatic restart on failure

### 4.2 Install Dependencies
1. **Access Node.js Terminal:**
   - In your Node.js app configuration page
   - Click **Open Terminal** or **SSH Access**
   - Navigate to your application directory:
     ```bash
     cd public_html/
     ```

2. **Install Production Dependencies:**
   ```bash
   # Install only production dependencies (faster and smaller)
   npm install --production
   
   # If you encounter permission issues, try:
   npm install --production --no-optional
   
   # Verify installation
   ls node_modules/
   ```

3. **Verify Critical Dependencies:**
   ```bash
   # Check if key packages are installed
   npm list express drizzle-orm bcrypt @neondatabase/serverless
   ```

4. **Clean Up (Optional):**
   ```bash
   # Remove unnecessary files to save space
   npm prune --production
   ```

### 4.3 Environment Variables
1. **Method 1: Through cPanel Interface**
   - In your Node.js app settings
   - Find **Environment Variables** section
   - Add each variable:

   | Variable Name | Example Value |
   |---------------|---------------|
   | `DATABASE_URL` | `postgresql://dbuser:dbpass@localhost:5432/companyos_prod` |
   | `SESSION_SECRET` | `your-super-secure-random-string-min-32-chars` |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` (or as specified by hosting provider) |

2. **Method 2: Create .env File**
   - Create `.env` file in your application root:
   ```bash
   # In File Manager, create new file: .env
   DATABASE_URL=postgresql://dbuser:dbpass@localhost:5432/companyos_prod
   SESSION_SECRET=your-super-secure-random-string-min-32-chars
   NODE_ENV=production
   PORT=3000
   ```

3. **Generate Secure SESSION_SECRET:**
   ```bash
   # In terminal, generate a random secret:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Step 5: SSL and Domain Configuration

### 5.1 Enable SSL
1. In cPanel, go to **SSL/TLS**
2. Enable **Force HTTPS Redirect**
3. Configure your SSL certificate (Let's Encrypt is recommended)

### 5.2 Domain Configuration
Ensure your domain points to the correct directory where your application is hosted.

## Step 6: Database Migration and Initial Setup

### 6.1 Run Database Migrations
1. **Access Database:**
   - In cPanel, go to **phpPgAdmin** (or **PostgreSQL Databases**)
   - Connect to your `companyos_prod` database

2. **Create Database Schema:**
   - Run the following SQL commands to create all required tables:
   ```sql
   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   
   -- Create sessions table for authentication
   CREATE TABLE sessions (
     sid VARCHAR PRIMARY KEY,
     sess JSONB NOT NULL,
     expire TIMESTAMP NOT NULL
   );
   CREATE INDEX IDX_session_expire ON sessions(expire);
   
   -- Create users table
   CREATE TABLE users (
     id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
     username VARCHAR UNIQUE NOT NULL,
     password_hash VARCHAR NOT NULL,
     email VARCHAR UNIQUE,
     first_name VARCHAR,
     last_name VARCHAR,
     role VARCHAR DEFAULT 'user',
     department VARCHAR DEFAULT 'operations',
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Add other tables as needed (clients, quotations, invoices, etc.)
   -- Copy from your development database or use drizzle-kit
   ```

3. **Alternative: Use Drizzle Push (if available):**
   ```bash
   # In your application terminal
   npm run db:push
   ```

### 6.2 Create Admin User
1. **Generate Password Hash:**
   In your local terminal or Node.js environment:
   ```javascript
   const bcrypt = require('bcrypt');
   const password = 'admin123'; // Change this to your desired password
   const hash = bcrypt.hashSync(password, 10);
   console.log('Password hash:', hash);
   ```

2. **Create Admin User in Database:**
   Run this SQL in phpPgAdmin:
   ```sql
   INSERT INTO users (
     id, username, password_hash, email, 
     first_name, last_name, role, department, is_active
   ) VALUES (
     gen_random_uuid(),
     'admin',
     '$2b$10$[YOUR_GENERATED_HASH_HERE]',
     'admin@yourcompany.com',
     'System',
     'Administrator',
     'admin',
     'management',
     true
   );
   ```

3. **Verify Admin User Creation:**
   ```sql
   SELECT username, email, role, department, is_active 
   FROM users 
   WHERE username = 'admin';
   ```

4. **Test Login Credentials:**
   - Username: `admin`
   - Password: `admin123` (or whatever you set)

## Step 7: Testing and Verification

### 7.1 Health Check
Visit: `https://yourdomain.com/api/health`
Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T...",
  "uptime": 123.45,
  "memory": {...},
  "version": "1.0.0"
}
```

### 7.2 Database Check
Visit: `https://yourdomain.com/api/ready`
Expected response:
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2025-01-27T..."
}
```

### 7.3 Application Access
1. Visit your domain
2. Log in with your admin credentials
3. Verify all modules are working

## Step 8: Performance Optimization

### 8.1 Static File Serving
Ensure your web server (Apache/Nginx) serves static files directly:
```apache
# .htaccess for Apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Serve static files directly
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^.*$ - [L]
    
    # Route everything else to Node.js app
    RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
</IfModule>
```

### 8.2 Caching Headers
Configure proper caching for static assets:
```apache
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
</IfModule>
```

## Step 9: Monitoring and Maintenance

### 9.1 Log Monitoring
- Check Node.js application logs in cPanel
- Monitor database performance
- Set up error notifications

### 9.2 Backup Strategy
- Regular database backups
- File system backups
- Environment configuration backups

### 9.3 Updates
**Step-by-Step Update Process:**

1. **Prepare Update Locally:**
   ```bash
   # Build new version
   npm install
   npm run build
   
   # Create update package
   zip -r companyos-update.zip dist/ package.json package-lock.json
   ```

2. **Backup Current Version:**
   - In cPanel File Manager, create backup folder
   - Copy current `dist/` folder to `dist-backup-YYYY-MM-DD/`
   - Export database backup through phpPgAdmin

3. **Upload New Version:**
   - Upload `companyos-update.zip` to cPanel
   - Extract to temporary folder
   - Replace `dist/` folder with new version

4. **Update Dependencies:**
   ```bash
   npm install --production
   ```

5. **Database Updates (if needed):**
   - Run any new migration scripts
   - Check for schema changes

6. **Restart Application:**
   - In Node.js Apps, click **Restart**
   - Monitor logs for any startup errors

7. **Verify Update:**
   - Test login functionality
   - Check all modules are working
   - Monitor performance for 24 hours

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify DATABASE_URL is correct
- Check PostgreSQL service is running
- Ensure database user has proper permissions

**Application Won't Start**
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check application logs for errors

**404 Errors for API Routes**
- Ensure URL rewriting is configured
- Check Node.js app is running on correct port
- Verify application root directory

**Authentication Issues**
- Verify SESSION_SECRET is set
- Check admin user exists in database
- Ensure password hash is correct

### Support Resources
- cPanel Documentation
- Node.js hosting provider support
- Application logs in cPanel interface

## Security Considerations

1. **Database Security**
   - Use strong database passwords
   - Limit database user permissions
   - Enable database SSL if available

2. **Application Security**
   - Use strong SESSION_SECRET
   - Enable HTTPS only
   - Regular security updates

3. **Access Control**
   - Admin-only authentication
   - Secure session management
   - Regular password changes

## Performance Tips

1. **Database Optimization**
   - Regular VACUUM operations
   - Proper indexing
   - Connection pooling

2. **Application Performance**
   - Enable compression
   - Optimize static file serving
   - Monitor memory usage

3. **Caching**
   - Browser caching for static files
   - Database query optimization
   - Session storage optimization

---

This deployment guide ensures your CompanyOS application runs securely and efficiently on cPanel hosting. For additional support, consult your hosting provider's Node.js documentation.