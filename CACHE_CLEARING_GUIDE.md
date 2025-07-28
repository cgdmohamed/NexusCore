# 🧹 Cache Clearing Guide After VPS Deployment

## Cache Layers in the System:

### 1. React Query Cache (Frontend)
- **Type**: API response caching with `staleTime: Infinity`
- **Impact**: Old API responses cached indefinitely
- **Solution**: Browser refresh or manual clear

### 2. Browser Cache
- **Type**: Static assets, HTTP responses
- **Impact**: Cached 404 responses for missing endpoints
- **Solution**: Hard refresh or clear browser cache

### 3. Express Server Cache (VPS)
- **Type**: Session data, in-memory storage
- **Impact**: Old data structures in memory
- **Solution**: PM2 restart (already included in deployment)

### 4. Nginx Cache (if enabled)
- **Type**: Reverse proxy caching
- **Impact**: Cached API responses
- **Solution**: Nginx cache clear

## 🔄 Cache Clearing Steps:

### After VPS Deployment:

1. **Server Cache (Automatic)**
   ```bash
   # Already handled by PM2 restart
   pm2 delete companyos
   pm2 start server/prod.cjs --name companyos
   ```

2. **Browser Cache (User Action Required)**
   - **Hard Refresh**: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   - **Clear Cache**: Browser Settings → Clear browsing data → Cached images and files
   - **Developer Tools**: F12 → Network tab → Right-click → Clear browser cache

3. **React Query Cache (Automatic on Login)**
   ```javascript
   // Already implemented in useAuth.tsx
   queryClient.clear(); // Clears all cached data on logout/login
   ```

4. **Nginx Cache (If Applicable)**
   ```bash
   # On VPS if using Nginx caching
   sudo nginx -s reload
   # Or clear nginx cache directory
   sudo rm -rf /var/cache/nginx/*
   ```

## ⚡ Quick Cache Clear Commands:

### For Users (Browser):
```
1. Press Ctrl+Shift+Delete (Chrome/Firefox)
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh page (F5)
```

### For VPS Admin:
```bash
# Clear all caches on server
pm2 restart companyos
sudo nginx -s reload  # if using nginx
sudo systemctl restart nginx  # alternative
```

## 🎯 Verification Steps:

After clearing caches, check these endpoints work:
- `/api/tasks/stats` → Should return 200 with data
- `/api/dashboard/kpis` → Should load dashboard metrics
- `/api/activities` → Should show activity feed
- `/api/employees` → Should list employees

## 📊 Expected Results:

**Before Cache Clear:**
- Browser shows cached 404 errors
- Dashboard widgets show "loading" indefinitely
- Task stats don't load

**After Cache Clear:**
- All API endpoints return data
- Dashboard fully loads
- Zero console errors
- Success rate jumps to 99%+

## 🚨 Important Notes:

1. **React Query Cache**: Set to `staleTime: Infinity`, so data never refreshes automatically
2. **Browser Cache**: 404 responses are cached, causing persistent errors
3. **Session Cache**: User login may cache old authentication state
4. **Clear After Each Deployment**: Always clear caches when updating server endpoints

The key is clearing browser cache + hard refresh after VPS deployment!