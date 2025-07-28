#!/bin/bash
# CompanyOS Docker Build Script
# Builds production-ready Docker images

set -e

echo "🐳 Building CompanyOS Docker Images..."

# Build production image
echo "Building production image..."
docker build -t companyos:latest -f Dockerfile .

# Build development image
echo "Building development image..."
docker build -t companyos:dev -f Dockerfile.dev .

# Tag with version if provided
if [ ! -z "$1" ]; then
    VERSION=$1
    echo "Tagging with version: $VERSION"
    docker tag companyos:latest companyos:$VERSION
    echo "✅ Tagged companyos:$VERSION"
fi

echo "✅ Docker images built successfully!"
echo ""
echo "Available images:"
docker images | grep companyos

echo ""
echo "🚀 To deploy:"
echo "Production: docker-compose --env-file .env.docker up -d"
echo "Development: docker-compose -f docker-compose.dev.yml up -d"