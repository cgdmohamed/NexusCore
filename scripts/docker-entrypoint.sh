#!/bin/sh
# CompanyOS Docker Entrypoint Script
# Handles initialization and database setup

set -e

echo "Starting CompanyOS initialization..."

# Wait for database to be ready
echo "Waiting for database connection..."
while ! nc -z postgres 5432; do
  echo "Database not ready, waiting..."
  sleep 2
done

echo "Database is ready!"

# Run database migrations
echo "Running database migrations..."
npm run db:push

# Check if admin user exists
echo "Checking for admin user..."
ADMIN_EXISTS=$(node -e "
const { db } = require('./dist/db');
const { users } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function checkAdmin() {
  try {
    const admin = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
    console.log(admin.length > 0 ? 'true' : 'false');
  } catch (error) {
    console.log('false');
  }
  process.exit(0);
}

checkAdmin();
")

# Create admin user if it doesn't exist
if [ "$ADMIN_EXISTS" = "false" ]; then
  echo "Creating admin user..."
  node -e "
const bcrypt = require('bcrypt');
const { db } = require('./dist/db');
const { users } = require('./shared/schema');

async function createAdmin() {
  try {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    await db.insert(users).values({
      username: 'admin',
      passwordHash: passwordHash,
      email: 'admin@company.com',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      department: 'management',
      isActive: true
    });
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
  process.exit(0);
}

createAdmin();
"
else
  echo "Admin user already exists"
fi

echo "Initialization complete. Starting application..."

# Start the application
exec "$@"