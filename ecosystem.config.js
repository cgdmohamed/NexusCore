module.exports = {
  apps: [{
    name: 'companyos',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // Restart configuration
    max_restarts: 10,
    min_uptime: '10s',
    
    // Memory and CPU limits
    max_memory_restart: '1G',
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Health monitoring
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.git'],
    
    // Auto restart on file changes (disable in production)
    autorestart: true
  }]
};