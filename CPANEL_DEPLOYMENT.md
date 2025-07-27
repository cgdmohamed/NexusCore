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

# Build the frontend
npm run build

# Build the backend
npm run build:server
```

### 1.2 Create Production Package
Create a ZIP file containing:
```
production-package/
├── dist/           # Built application files
├── package.json
├── package-lock.json
├── .env.example
└── README_PRODUCTION.md
```

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
1. In cPanel File Manager, navigate to your domain's public folder
2. Upload and extract your production package
3. Ensure the `dist` folder is in the web root

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
1. Go to **Node.js Apps** in cPanel
2. Click **Create Application**
3. Set the following:
   - **Node.js Version**: 18.x or higher
   - **Application Mode**: Production
   - **Application Root**: Your domain folder
   - **Application URL**: Your domain
   - **Application Startup File**: `dist/index.js`

### 4.2 Install Dependencies
In the Node.js app terminal:
```bash
npm install --production
```

### 4.3 Environment Variables
In the Node.js app interface, add these environment variables:
- `DATABASE_URL`: Your PostgreSQL connection string
- `SESSION_SECRET`: Your secure session secret
- `NODE_ENV`: production

## Step 5: SSL and Domain Configuration

### 5.1 Enable SSL
1. In cPanel, go to **SSL/TLS**
2. Enable **Force HTTPS Redirect**
3. Configure your SSL certificate (Let's Encrypt is recommended)

### 5.2 Domain Configuration
Ensure your domain points to the correct directory where your application is hosted.

## Step 6: Database Migration and Initial Setup

### 6.1 Run Database Migrations
Connect to your database and ensure all tables are created properly.

### 6.2 Create Admin User
Run this SQL to create your admin user:
```sql
INSERT INTO users (
  id, username, password_hash, email, 
  firstName, lastName, role, department, isActive
) VALUES (
  gen_random_uuid(),
  'admin',
  '$2b$10$YourHashedPasswordHere',
  'admin@yourcompany.com',
  'System',
  'Administrator',
  'admin',
  'operations',
  true
);
```

To generate the password hash, use:
```javascript
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('your-admin-password', 10);
console.log(hash);
```

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
To update the application:
1. Build new version locally
2. Upload new files
3. Restart Node.js application
4. Run any database migrations
5. Clear application cache

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