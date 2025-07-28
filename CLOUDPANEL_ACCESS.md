# CloudPanel VPS Docker Access Guide

## Accessing Your Application

### 1. Direct VPS Access
Your application should be accessible at:
- **HTTP**: `http://YOUR_VPS_IP:5000`
- **If using domain**: `http://yourdomain.com:5000`

Replace `YOUR_VPS_IP` with your actual VPS IP address.

### 2. Check Application Status
SSH into your VPS and run:
```bash
# Check if containers are running
docker-compose ps

# Verify health status
curl http://localhost:5000/api/health

# Check application logs
docker-compose logs -f app
```

### 3. Configure Domain Access (Recommended)

#### Option A: Using CloudPanel Nginx Proxy
1. **In CloudPanel Dashboard:**
   - Go to Sites → Add Site
   - Domain: `yourdomain.com`
   - Type: "Reverse Proxy"
   - Destination URL: `http://localhost:5000`

2. **Or manually configure Nginx:**
```nginx
# /etc/nginx/sites-available/yourdomain.com
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Option B: Update Docker to Use Port 80
Edit your `.env.docker` file:
```bash
PORT=80
```
Then restart:
```bash
docker-compose down
docker-compose --env-file .env.docker up -d
```

### 4. SSL Certificate Setup
Once domain is working, add SSL:
```bash
# Install certbot if not available
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

## Firewall Configuration

Ensure your VPS firewall allows the required ports:
```bash
# Allow Docker application port
sudo ufw allow 5000

# Or if using port 80
sudo ufw allow 80
sudo ufw allow 443

# Check firewall status
sudo ufw status
```

## CloudPanel Specific Steps

### 1. Database Access (Optional)
If you want to access the database via CloudPanel:
- Database Host: `localhost`
- Port: `5433` (as configured in docker-compose)
- Database: `companyos`
- Username: `companyos_user`
- Password: (from your .env.docker file)

### 2. File Management
Your application files are in:
- Application: `/path/to/your/repo/`
- Logs: `docker-compose logs app`
- Database data: Docker volume `postgres-data`

### 3. Backup Strategy
```bash
# Backup database
docker-compose exec postgres pg_dump -U companyos_user companyos > backup.sql

# Backup complete setup
tar -czf companyos-backup.tar.gz .env.docker docker-compose.yml
```

## Troubleshooting Access Issues

### Cannot Access via IP:PORT
1. **Check if application is running:**
   ```bash
   docker-compose ps
   curl http://localhost:5000/api/health
   ```

2. **Check port binding:**
   ```bash
   netstat -tlnp | grep :5000
   # Should show: 0.0.0.0:5000
   ```

3. **Check firewall:**
   ```bash
   sudo ufw status
   # Ensure port 5000 is allowed
   ```

### Container Health Issues
1. **Check logs:**
   ```bash
   docker-compose logs app
   ```

2. **Common fixes:**
   ```bash
   # Restart services
   docker-compose restart
   
   # Full rebuild
   docker-compose down
   docker-compose --env-file .env.docker up -d --build
   ```

### Domain Not Working
1. **Check DNS:**
   ```bash
   nslookup yourdomain.com
   # Should point to your VPS IP
   ```

2. **Check Nginx configuration:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## Login Information

Once accessible:
- **URL**: `http://your-vps-ip:5000` or `http://yourdomain.com`
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@company.com`

⚠️ **Security**: Change the default password immediately after first login!

## Performance Optimization

For production on CloudPanel:
```bash
# Monitor resource usage
docker stats

# Optimize for VPS resources
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Quick Access Checklist

- [ ] VPS IP address known
- [ ] Port 5000 accessible (test: `telnet YOUR_VPS_IP 5000`)
- [ ] Docker containers running (`docker-compose ps`)
- [ ] Health check passing (`curl localhost:5000/api/health`)
- [ ] Application loads in browser
- [ ] Login works with admin/admin123
- [ ] Domain configured (optional)
- [ ] SSL certificate installed (optional)