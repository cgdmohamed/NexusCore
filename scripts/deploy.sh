#!/bin/bash

# Deployment Script for CompanyOS
# This script handles the complete deployment process

set -e

# Configuration
APP_NAME="companyos"
DEPLOY_USER="${DEPLOY_USER:-companyos}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/companyos}"
BACKUP_PATH="${BACKUP_PATH:-/var/backups/companyos}"
LOG_FILE="/var/log/companyos-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
    fi
}

# Backup current deployment
backup_current() {
    log "📦 Creating backup of current deployment..."
    
    if [ -d "$DEPLOY_PATH" ]; then
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_PATH"
        
        # Stop application
        systemctl stop $APP_NAME 2>/dev/null || pm2 stop $APP_NAME 2>/dev/null || true
        
        # Create backup
        cp -r "$DEPLOY_PATH" "$BACKUP_PATH/$BACKUP_NAME"
        log "✅ Backup created: $BACKUP_PATH/$BACKUP_NAME"
        
        # Keep only last 5 backups
        cd "$BACKUP_PATH"
        ls -t | tail -n +6 | xargs -r rm -rf
    else
        info "No existing deployment found, skipping backup"
    fi
}

# Deploy application
deploy_application() {
    log "🚀 Deploying application..."
    
    # Create deployment directory
    mkdir -p "$DEPLOY_PATH"
    
    # Copy build files
    if [ -d "dist" ]; then
        cp -r dist/* "$DEPLOY_PATH/"
        log "✅ Application files copied"
    else
        error "Build directory 'dist' not found. Run build script first."
    fi
    
    # Set permissions
    chown -R $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_PATH"
    chmod +x "$DEPLOY_PATH/index.js"
    
    # Install/update dependencies
    cd "$DEPLOY_PATH"
    sudo -u $DEPLOY_USER npm ci --production
    log "✅ Dependencies installed"
}

# Configure system service
configure_service() {
    log "⚙️  Configuring system service..."
    
    # Create systemd service file
    cat > /etc/systemd/system/$APP_NAME.service << EOL
[Unit]
Description=CompanyOS Application
After=network.target postgresql.service

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$DEPLOY_PATH
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Environment
Environment=NODE_ENV=production
EnvironmentFile=-/etc/default/$APP_NAME

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$DEPLOY_PATH/logs

[Install]
WantedBy=multi-user.target
EOL

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable $APP_NAME
    log "✅ System service configured"
}

# Setup nginx
setup_nginx() {
    log "🌐 Setting up Nginx..."
    
    # Check if nginx is installed
    if ! command -v nginx &> /dev/null; then
        warning "Nginx not installed, skipping nginx configuration"
        return
    fi
    
    # Copy nginx configuration
    if [ -f "nginx.conf" ]; then
        cp nginx.conf /etc/nginx/sites-available/$APP_NAME
        
        # Enable site
        ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
        
        # Test nginx configuration
        nginx -t
        systemctl reload nginx
        log "✅ Nginx configured"
    else
        warning "nginx.conf not found, skipping nginx setup"
    fi
}

# Run database migrations
run_migrations() {
    log "📊 Running database migrations..."
    
    cd "$DEPLOY_PATH"
    
    # Check if database is accessible
    if sudo -u $DEPLOY_USER timeout 10 npm run db:push > /dev/null 2>&1; then
        log "✅ Database migrations completed"
    else
        error "Database migration failed. Check database connectivity."
    fi
}

# Start application
start_application() {
    log "▶️  Starting application..."
    
    # Start the service
    systemctl start $APP_NAME
    
    # Wait for application to start
    sleep 5
    
    # Check if service is running
    if systemctl is-active --quiet $APP_NAME; then
        log "✅ Application started successfully"
        
        # Test health endpoint
        if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
            log "✅ Health check passed"
        else
            warning "Health check failed - application may still be starting"
        fi
    else
        error "Application failed to start. Check logs: journalctl -u $APP_NAME"
    fi
}

# Cleanup old deployments
cleanup() {
    log "🧹 Cleaning up..."
    
    # Remove old node_modules if they exist outside dist
    if [ -d "node_modules" ] && [ "$PWD" != "$DEPLOY_PATH" ]; then
        rm -rf node_modules
    fi
    
    # Clean package manager cache
    npm cache clean --force > /dev/null 2>&1 || true
    
    log "✅ Cleanup completed"
}

# Rollback function
rollback() {
    error_msg="$1"
    log "🔄 Rolling back deployment due to error: $error_msg"
    
    # Stop current application
    systemctl stop $APP_NAME 2>/dev/null || true
    
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_PATH" 2>/dev/null | head -n1)
    
    if [ -n "$LATEST_BACKUP" ] && [ -d "$BACKUP_PATH/$LATEST_BACKUP" ]; then
        # Restore backup
        rm -rf "$DEPLOY_PATH"
        cp -r "$BACKUP_PATH/$LATEST_BACKUP" "$DEPLOY_PATH"
        chown -R $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_PATH"
        
        # Start application
        systemctl start $APP_NAME
        
        log "✅ Rollback completed to: $LATEST_BACKUP"
    else
        error "No backup found for rollback"
    fi
}

# Main deployment process
main() {
    log "🚀 Starting CompanyOS deployment..."
    
    # Trap errors for rollback
    trap 'rollback "Deployment failed"' ERR
    
    check_permissions
    backup_current
    deploy_application
    configure_service
    setup_nginx
    run_migrations
    start_application
    cleanup
    
    log "🎉 Deployment completed successfully!"
    log "📊 Application Status:"
    systemctl status $APP_NAME --no-pager
    
    log "🔗 Access your application:"
    log "   - Local: http://localhost:5000"
    log "   - Health: http://localhost:5000/api/health"
    
    # Remove error trap
    trap - ERR
}

# Help function
show_help() {
    echo "CompanyOS Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --user USER    Deployment user (default: companyos)"
    echo "  --path PATH    Deployment path (default: /opt/companyos)"
    echo "  --backup PATH  Backup path (default: /var/backups/companyos)"
    echo ""
    echo "Environment Variables:"
    echo "  DEPLOY_USER    Deployment user"
    echo "  DEPLOY_PATH    Deployment path"
    echo "  BACKUP_PATH    Backup path"
    echo ""
    echo "Examples:"
    echo "  sudo $0                           # Deploy with defaults"
    echo "  sudo $0 --user myapp --path /app  # Deploy with custom settings"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --user)
            DEPLOY_USER="$2"
            shift 2
            ;;
        --path)
            DEPLOY_PATH="$2"
            shift 2
            ;;
        --backup)
            BACKUP_PATH="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main deployment
main