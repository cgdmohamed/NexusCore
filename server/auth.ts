import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { csrfSync } from "csrf-sync";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { pool } from "./db";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends Omit<SelectUser, 'passwordHash'> {
      passwordHash?: string; // Optional because we remove it for security
    }
  }
}

// Initialize PostgreSQL session store
const PgStore = connectPgSimple(session);

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string) {
  return await bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  // Validate required environment variables
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set in environment variables");
  }
  
  // CSRF_SECRET is required in production, optional in development
  if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
    throw new Error("CSRF_SECRET must be set in environment variables for production");
  }

  // Session configuration with PostgreSQL store
  const sessionSettings: session.SessionOptions = {
    store: new PgStore({
      pool, // Reuse existing database connection pool
      tableName: "session", // Table for session storage
      createTableIfMissing: true, // Auto-create session table if needed
      pruneSessionInterval: 60, // Clean expired sessions every 60 seconds
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // CSRF protection via SameSite
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Local strategy for username/password authentication (setup before routes)
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.passwordHash) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        const isValid = await comparePasswords(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        // Remove password hash from user object
        const { passwordHash, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        const { passwordHash, ...userWithoutPassword } = user;
        done(null, userWithoutPassword);
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, firstName, lastName } = req.body;
      
      // Validation
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, password, and email are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Create user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        passwordHash: hashedPassword,
        role: 'user', // Default role
        department: 'operations', // Default department
        isActive: true
      });
      
      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = user;
      
      // Auto-login after registration
      req.login(userWithoutPassword, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Configure CSRF protection (applied AFTER login/registration routes)
  const csrfSecret = process.env.CSRF_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-csrf-secret-change-in-production' : '');
  const { generateToken, csrfSynchronisedProtection } = csrfSync({
    secret: csrfSecret,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getTokenFromRequest: (req) => {
      // Check multiple sources for CSRF token
      return req.body?._csrf || req.headers['x-csrf-token'] as string || req.headers['csrf-token'] as string;
    },
  });

  // Endpoint to get CSRF token
  app.get("/api/csrf-token", (req, res) => {
    const token = generateToken(req);
    res.json({ csrfToken: token });
  });

  // Apply CSRF protection to all POST/PATCH/DELETE/PUT routes globally
  // This protects all API routes registered after this point
  // Login/registration routes above are NOT protected (they need to work without tokens)
  app.use(csrfSynchronisedProtection);

  // Logout endpoint (PROTECTED by CSRF)
  // This prevents CSRF attacks that could force users to logout
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });
}

// Middleware to protect routes
export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware to require admin role
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.role !== 'admin' && req.user.department !== 'management') {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}