#!/bin/bash

# Production Build Script for CompanyOS
# This script builds the application for production deployment

set -e  # Exit on any error

echo "🚀 Starting CompanyOS Production Build..."

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

if [[ "$NODE_VERSION" < "v20" ]]; then
    echo "❌ Error: Node.js 20.x or higher is required"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
mkdir -p dist/

# Type check
echo "🔍 Running TypeScript type check..."
npm run check

# Build frontend
echo "🎨 Building frontend..."
npm run build:client

# Build backend
echo "⚙️  Building backend..."
npm run build:server

# Copy necessary files
echo "📋 Copying configuration files..."
cp -r shared dist/
cp package*.json dist/

# Create production package.json with only production dependencies
echo "📦 Creating production package.json..."
node -e "
const pkg = require('./package.json');
delete pkg.devDependencies;
pkg.scripts = {
  start: 'node index.js',
  'db:push': 'drizzle-kit push'
};
require('fs').writeFileSync('./dist/package.json', JSON.stringify(pkg, null, 2));
"

# Install production dependencies in dist folder
echo "📦 Installing production dependencies..."
cd dist
npm ci --production
cd ..

# Create deployment summary
echo "📊 Creating deployment summary..."
cat > dist/deployment-info.json << EOL
{
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'N/A')",
  "nodeVersion": "$NODE_VERSION",
  "buildEnvironment": "$(uname -a)",
  "version": "$(node -p "require('./package.json').version")"
}
EOL

# Verify build
echo "🔍 Verifying build..."
if [ ! -f "dist/index.js" ]; then
    echo "❌ Error: Backend build failed - index.js not found"
    exit 1
fi

if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Error: Frontend build failed - index.html not found"
    exit 1
fi

# Display build information
echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📊 Build Summary:"
echo "- Frontend: dist/public/"
echo "- Backend: dist/index.js"
echo "- Dependencies: $(cat dist/package.json | jq -r '.dependencies | keys | length') packages"
echo "- Build size: $(du -sh dist/ | cut -f1)"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Set environment variables"
echo "2. Run database migrations: npm run db:push"
echo "3. Start the application: npm start"