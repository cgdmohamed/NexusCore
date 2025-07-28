#!/bin/bash
# CompanyOS Docker Deployment Script
# Automates production deployment with checks

set -e

# Configuration
ENV_FILE=".env.docker"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)

echo "🚀 CompanyOS Docker Deployment"
echo "=============================="

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file $ENV_FILE not found!"
    echo "📝 Creating from template..."
    cp .env.docker.example $ENV_FILE
    echo "✅ Please edit $ENV_FILE with your configuration and run again."
    exit 1
fi

# Create backup directory
mkdir -p $BACKUP_DIR

# Function to backup database
backup_database() {
    echo "📦 Creating database backup..."
    if docker ps | grep -q companyos-postgres; then
        docker exec companyos-postgres pg_dump -U companyos_user companyos | gzip > "$BACKUP_DIR/backup-$DATE.sql.gz"
        echo "✅ Database backup created: $BACKUP_DIR/backup-$DATE.sql.gz"
    else
        echo "ℹ️  No existing database to backup"
    fi
}

# Function to deploy
deploy() {
    echo "🐳 Deploying CompanyOS..."
    
    # Pull latest images if using remote registry
    # docker-compose --env-file $ENV_FILE pull
    
    # Deploy services
    docker-compose --env-file $ENV_FILE up -d
    
    echo "⏳ Waiting for services to be ready..."
    sleep 30
    
    # Check health
    if docker ps | grep -q companyos-app; then
        echo "✅ Application container is running"
    else
        echo "❌ Application container failed to start"
        exit 1
    fi
    
    if docker ps | grep -q companyos-postgres; then
        echo "✅ Database container is running"
    else
        echo "❌ Database container failed to start"
        exit 1
    fi
}

# Function to verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."
    
    # Test health endpoint
    if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
        echo "📋 Checking logs..."
        docker-compose --env-file $ENV_FILE logs --tail=20 app
        exit 1
    fi
    
    # Test database connection
    if docker exec companyos-postgres pg_isready -U companyos_user > /dev/null 2>&1; then
        echo "✅ Database connection verified"
    else
        echo "❌ Database connection failed"
        exit 1
    fi
}

# Parse arguments
case "${1:-deploy}" in
    "backup")
        backup_database
        ;;
    "deploy")
        backup_database
        deploy
        verify_deployment
        echo ""
        echo "🎉 Deployment completed successfully!"
        echo "🌐 Application: http://localhost:5000"
        echo "🔑 Login: admin / admin123"
        ;;
    "verify")
        verify_deployment
        ;;
    "logs")
        docker-compose --env-file $ENV_FILE logs -f ${2:-app}
        ;;
    "stop")
        echo "🛑 Stopping CompanyOS..."
        docker-compose --env-file $ENV_FILE down
        echo "✅ Services stopped"
        ;;
    "restart")
        echo "🔄 Restarting CompanyOS..."
        docker-compose --env-file $ENV_FILE restart
        echo "✅ Services restarted"
        ;;
    *)
        echo "Usage: $0 {deploy|backup|verify|logs|stop|restart}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment with backup and verification"
        echo "  backup  - Create database backup only"
        echo "  verify  - Verify deployment health"
        echo "  logs    - View logs (optionally specify service)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        exit 1
        ;;
esac