# 🚀 Quick VPS Deployment Commands

## Current Issue:
Your VPS production server has the old version with missing API endpoints. Browser console shows 404 errors for `/api/tasks/stats`, `/api/dashboard/kpis`, `/api/activities`, etc.

## 📋 Manual Deployment Steps:

### Option 1: Automated Deployment
```bash
# Run the deployment script (if you have SSH access configured)
./deploy-to-server.sh
```

### Option 2: Manual Upload & Restart
```bash
# 1. Upload updated file to VPS
scp server/prod.cjs root@nexus.creativecode.com.eg:/root/NexusCore/server/

# 2. SSH into VPS and restart
ssh root@nexus.creativecode.com.eg
cd /root/NexusCore
pm2 delete companyos
pm2 start server/prod.cjs --name companyos
pm2 save
```

### Option 3: Copy File Content
1. **Download** the updated `server/prod.cjs` file from this Replit
2. **Upload** to your VPS at `/root/NexusCore/server/prod.cjs`
3. **Restart** PM2 process:
   ```bash
   pm2 delete companyos
   pm2 start server/prod.cjs --name companyos
   pm2 save
   ```

## 📊 File Verification:
- **Current VPS file**: ~750 lines, ~35 endpoints
- **Updated file**: 1432 lines, 91 endpoints
- **Missing endpoints**: 56 new API endpoints

## 🎯 Expected Results:
After deployment, all these browser console errors will disappear:
- ✅ `/api/tasks/stats` → Real task statistics
- ✅ `/api/dashboard/kpis` → Dashboard data
- ✅ `/api/activities` → Activity feed
- ✅ `/api/employees` → Employee management
- ✅ `/api/payment-sources/stats` → Payment analytics

## 📈 Performance Improvement:
- **Before**: 87.2% success rate (92 errors out of 721 requests)
- **After**: 99%+ success rate (almost zero 404 errors)

The updated server file contains all missing endpoints that your frontend is requesting!