# Simple Deployment Guide

## Step 1: Prepare Your Server

SSH into your VPS and run:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for Docker permissions
exit
# SSH back in
```

## Step 2: Get the Application

```bash
# Clone the repository
git clone https://github.com/your-username/your-repo.git
cd your-repo

# Create environment file
cp .env.docker.example .env.docker
```

## Step 3: Configure Environment

Edit `.env.docker` with your details:
```bash
nano .env.docker
```

Set these values:
```bash
COMPANY_NAME=Your Company Name
COMPANY_TAGLINE=Your Company Tagline
SESSION_SECRET=change-this-to-a-long-random-string-minimum-32-characters
DB_PASSWORD=your-secure-database-password
```

## Step 4: Deploy

```bash
# Deploy the application
docker-compose --env-file .env.docker up -d

# Wait 2 minutes for everything to start
sleep 120

# Check status
docker-compose ps
```

## Step 5: Verify It's Working

```bash
# Test health check
curl http://localhost:5000/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Step 6: Access Your Application

- **URL**: `http://YOUR_SERVER_IP:5000`
- **Username**: `admin`
- **Password**: `admin123`

Replace `YOUR_SERVER_IP` with your actual server IP address.

## Step 7: Set Up Domain (Optional)

If you have a domain name:

1. **Point domain to your server IP** (in your domain registrar)

2. **Configure Nginx reverse proxy:**
```bash
# Install Nginx
sudo apt install nginx -y

# Create site configuration
sudo nano /etc/nginx/sites-available/yourapp
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. **Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/yourapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **Add SSL certificate:**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

## Troubleshooting

### If containers won't start:
```bash
# Check logs
docker-compose logs

# Rebuild
docker-compose down
docker-compose --env-file .env.docker up -d --build
```

### If you get "port already in use":
```bash
# Check what's using the port
sudo netstat -tlnp | grep :5432
sudo netstat -tlnp | grep :6379

# Kill conflicting services or change ports in .env.docker:
DB_PORT=5434
REDIS_PORT=6381
```

### If application won't load:
```bash
# Check firewall
sudo ufw allow 5000
sudo ufw status

# Check application logs
docker-compose logs app
```

## Common Issues

1. **"Permission denied"** → Run `sudo usermod -aG docker $USER` and logout/login
2. **"Port already in use"** → Change ports in `.env.docker`
3. **"Container unhealthy"** → Wait longer, check logs with `docker-compose logs app`
4. **Can't access from browser** → Check firewall: `sudo ufw allow 5000`

## Final Result

You should have:
- ✅ Application running at `http://your-ip:5000`
- ✅ Login working with admin/admin123
- ✅ All modules accessible (CRM, Invoices, Tasks, etc.)
- ✅ Company branding displayed
- ✅ Optional: Domain with SSL certificate

## Need Help?

1. Check container status: `docker-compose ps`
2. Check logs: `docker-compose logs app`
3. Test health: `curl http://localhost:5000/api/health`