# Fixed Node.js + PostgreSQL Deployment Guide

## Issues Found and Fixed

1. **Database Driver**: Changed from Neon serverless to standard PostgreSQL driver
2. **Environment Loading**: Added dotenv support for .env file loading
3. **Missing Types**: Added TypeScript types for compression and CORS
4. **Database Setup**: Simplified PostgreSQL user creation

## Corrected Deployment Steps

### 1. Server Prerequisites
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2
sudo npm install -g pm2

# Verify installations
node --version
npm --version
psql --version
```

### 2. Database Setup (Fixed)
```bash
# Create database and user
sudo -u postgres createdb companyos
sudo -u postgres createuser companyos_user

# Set password and permissions
sudo -u postgres psql -c "ALTER USER companyos_user WITH ENCRYPTED PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE companyos TO companyos_user;"
sudo -u postgres psql -c "ALTER USER companyos_user CREATEDB;"

# Test connection (replace 'your_secure_password' with actual password)
PGPASSWORD=your_secure_password psql -h localhost -U companyos_user -d companyos -c "SELECT version();"
```

### 3. Application Setup
```bash
# Clone repository
git clone <your-repo-url>
cd your-repo

# Install dependencies
npm install

# Create environment file
touch .env
```

### 4. Environment Configuration
Create `.env` file with:
```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://companyos_user:your_secure_password@localhost:5432/companyos
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters-long
COMPANY_NAME=Creative Code Nexus
COMPANY_TAGLINE=Digital Solutions & Innovation
```

### 5. Database Schema Setup
```bash
# Push database schema
npm run db:push

# Verify tables created
PGPASSWORD=your_secure_password psql -h localhost -U companyos_user -d companyos -c "\dt"
```

### 6. Build and Deploy
```bash
# Build the application
npm run build

# Verify build output exists
ls -la dist/

# Use the production server (avoids ESM issues)
pm2 start server/prod.cjs --name companyos

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs companyos
```

### 7. Verify Application
```bash
# Test health endpoint
curl http://localhost:5000/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Test config endpoint
curl http://localhost:5000/api/config
# Expected: {"companyName":"Creative Code Nexus","companyTagline":"..."}

# Check if application serves frontend
curl -I http://localhost:5000
# Expected: HTTP/1.1 200 OK
```

### 8. Firewall Configuration
```bash
# Allow necessary ports
sudo ufw allow 22
sudo ufw allow 5000
sudo ufw enable
sudo ufw status
```

### 9. Access Application
- **URL**: `http://YOUR_SERVER_IP:5000`
- **Username**: `admin`
- **Password**: `admin123`

### 10. Optional: Nginx Reverse Proxy
```bash
# Install Nginx
sudo apt install nginx -y

# Create site configuration
sudo tee /etc/nginx/sites-available/companyos > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/companyos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Add SSL with Certbot
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting Commands

### Database Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
PGPASSWORD=your_secure_password psql -h localhost -U companyos_user -d companyos -c "SELECT NOW();"

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Application Issues
```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs companyos --lines 50

# Restart application
pm2 restart companyos

# Check environment variables
pm2 env 0  # Replace 0 with process ID
```

### Network Issues
```bash
# Check if port is listening
sudo netstat -tlnp | grep :5000

# Check firewall
sudo ufw status verbose

# Test local connection
curl -v http://localhost:5000/api/health
```

## Production Maintenance

### Backup Database
```bash
# Create backup
PGPASSWORD=your_secure_password pg_dump -h localhost -U companyos_user companyos > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
PGPASSWORD=your_secure_password psql -h localhost -U companyos_user -d companyos < backup_file.sql
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart companyos
```

### Monitor Resources
```bash
# Check PM2 monitoring
pm2 monit

# Check system resources
htop
df -h
free -m
```

## Expected Final State

✅ PostgreSQL running with companyos database  
✅ Node.js application built and running via PM2  
✅ Health endpoint responding at /api/health  
✅ Frontend accessible at http://your-ip:5000  
✅ Login working with admin/admin123  
✅ All modules (CRM, Invoices, Tasks, etc.) functional  
✅ Company branding displayed correctly  
✅ Optional: Domain with SSL certificate  

## Security Notes

1. **Change default password** immediately after first login
2. **Use strong SESSION_SECRET** (minimum 32 characters)
3. **Keep PostgreSQL updated** with security patches
4. **Consider firewall rules** to restrict database access
5. **Regular backups** of database and application