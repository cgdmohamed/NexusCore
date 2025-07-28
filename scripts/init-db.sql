-- CompanyOS Database Initialization Script
-- Creates necessary extensions and initial admin user

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sessions table if not exists (handled by Drizzle migrations)
-- This is just for reference, actual tables are created by the application

-- Create initial admin user after application starts
-- This will be handled by a separate migration script