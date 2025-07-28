# 🔄 Nginx Cache Clearing for VPS Deployment

## Your Nginx Setup Impact:

Since you have Nginx running as a reverse proxy, it's likely caching API responses. This means even after deploying the updated server with all 91 endpoints, Nginx may still serve cached 404 responses.

## 🚨 Critical Nginx Cache Clear Commands:

### Step 1: Clear Nginx Cache Directory
```bash
# Remove all cached files
sudo rm -rf /var/cache/nginx/*

# If cache is in different location, check:
sudo find /var -name "*nginx*cache*" -type d 2>/dev/null
sudo find /tmp -name "*nginx*cache*" -type d 2>/dev/null
```

### Step 2: Reload Nginx Configuration
```bash
# Test configuration first
sudo nginx -t

# Reload if test passes
sudo nginx -s reload

# Alternative: Full restart
sudo systemctl restart nginx
```

### Step 3: Verify Nginx Status
```bash
# Check if Nginx is running
sudo systemctl status nginx

# Check error logs for issues
sudo tail -f /var/log/nginx/error.log
```

## 🔍 Check Nginx Configuration:

Look for caching directives in your Nginx config:
```bash
# Check main config
sudo cat /etc/nginx/nginx.conf | grep -i cache

# Check site config
sudo cat /etc/nginx/sites-available/nexus.creativecode.com.eg | grep -i cache
```

Common caching directives that affect API responses:
- `proxy_cache`
- `proxy_cache_valid`
- `proxy_cache_bypass`
- `fastcgi_cache`

## 🎯 Complete Cache Clear Sequence:

After deploying updated server to VPS:

```bash
# 1. Update server
pm2 delete companyos
pm2 start server/prod.cjs --name companyos
pm2 save

# 2. Clear Nginx cache
sudo rm -rf /var/cache/nginx/*
sudo nginx -s reload

# 3. Test endpoint
curl -H "Cookie: your-session-cookie" http://localhost:5000/api/tasks/stats

# 4. Check through Nginx
curl https://nexus.creativecode.com.eg/api/tasks/stats
```

## 📊 Expected Behavior:

**Before Nginx Cache Clear:**
- Direct server call: ✅ Returns data
- Through Nginx: ❌ Returns cached 404

**After Nginx Cache Clear:**
- Direct server call: ✅ Returns data  
- Through Nginx: ✅ Returns data
- Browser: ✅ No more console errors

## ⚠️ Important Notes:

1. **Nginx caches both successful and error responses**
2. **API endpoints with 404 errors are cached as 404**
3. **Cache clearing must happen AFTER server deployment**
4. **Browser cache must also be cleared separately**

The Nginx cache clear is crucial since your users access the site through the domain (Nginx proxy) rather than direct server access.