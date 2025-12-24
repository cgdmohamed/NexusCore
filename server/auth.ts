import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { csrfSync } from "csrf-sync";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";
import { pool, db } from "./db";
import { User as SelectUser, users, passwordResetTokens, passwordResetRateLimits } from "@shared/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import nodemailer from "nodemailer";

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

  // Email transporter for password reset
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Rate limit configuration: max 3 requests per email per hour
  const RATE_LIMIT_MAX_REQUESTS = 3;
  const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  // Request password reset endpoint (no CSRF required - public endpoint)
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const clientIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      const normalizedEmail = email.toLowerCase().trim();

      // Check rate limiting
      const now = new Date();
      const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
      
      const [existingRateLimit] = await db
        .select()
        .from(passwordResetRateLimits)
        .where(
          and(
            eq(passwordResetRateLimits.email, normalizedEmail),
            gt(passwordResetRateLimits.windowStart, windowStart)
          )
        );

      if (existingRateLimit && existingRateLimit.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
        console.warn(`Rate limit exceeded for password reset: ${normalizedEmail}`);
        // Return success to prevent email enumeration
        return res.json({ 
          message: "If an account exists with this email, a password reset link has been sent." 
        });
      }

      // Update or create rate limit record
      if (existingRateLimit) {
        await db
          .update(passwordResetRateLimits)
          .set({ 
            requestCount: existingRateLimit.requestCount + 1,
            lastRequestAt: now 
          })
          .where(eq(passwordResetRateLimits.id, existingRateLimit.id));
      } else {
        await db.insert(passwordResetRateLimits).values({
          email: normalizedEmail,
          requestCount: 1,
          windowStart: now,
          lastRequestAt: now,
        });
      }

      // Find user by email (don't reveal if user exists)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (!user) {
        // Return same message to prevent email enumeration
        return res.json({ 
          message: "If an account exists with this email, a password reset link has been sent." 
        });
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour expiry

      // Invalidate any existing unused tokens for this user
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            eq(passwordResetTokens.used, false)
          )
        );

      // Store new token
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: tokenHash,
        expiresAt,
        ipAddress: clientIp,
      });

      // Send reset email
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

      try {
        await smtpTransporter.sendMail({
          from: `"${process.env.SMTP_FROM_NAME || 'CompanyOS'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: user.email,
          subject: "Password Reset Request",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>Hello ${user.firstName || user.username},</p>
              <p>We received a request to reset your password. Click the button below to set a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
              </div>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                ${resetUrl}
              </p>
            </div>
          `,
          text: `Password Reset Request\n\nHello ${user.firstName || user.username},\n\nWe received a request to reset your password. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
        });
        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Still return success to prevent email enumeration
      }

      res.json({ 
        message: "If an account exists with this email, a password reset link has been sent." 
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: "An error occurred. Please try again later." });
    }
  });

  // Reset password endpoint (with token validation)
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Hash the token to compare with stored hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const now = new Date();

      // Find valid token
      const [resetRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, tokenHash),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, now)
          )
        );

      if (!resetRecord) {
        return res.status(400).json({ 
          message: "Invalid or expired reset token. Please request a new password reset." 
        });
      }

      // Update user's password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await db
        .update(users)
        .set({ 
          passwordHash: hashedPassword,
          updatedAt: now,
          mustChangePassword: false,
        })
        .where(eq(users.id, resetRecord.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetRecord.id));

      console.log(`Password reset completed for user ID: ${resetRecord.userId}`);

      res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: "An error occurred. Please try again later." });
    }
  });

  // Validate reset token endpoint (check if token is valid before showing reset form)
  app.get("/api/validate-reset-token", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: "Token is required" });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const now = new Date();

      const [resetRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, tokenHash),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, now)
          )
        );

      if (!resetRecord) {
        return res.json({ valid: false, message: "Invalid or expired reset token" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error('Validate reset token error:', error);
      res.status(500).json({ valid: false, message: "An error occurred" });
    }
  });

  // Configure CSRF protection (applied AFTER login/registration routes)
  const { generateToken, csrfSynchronisedProtection } = csrfSync({
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getTokenFromRequest: (req) => {
      // Check multiple sources for CSRF token
      return req.body?._csrf || req.headers['x-csrf-token'] as string || req.headers['csrf-token'] as string;
    },
    getTokenFromState: (req) => {
      // Get token from session
      return (req.session as any)?.csrfToken;
    },
    storeTokenInState: (req, token) => {
      // Store token in session
      (req.session as any).csrfToken = token;
    },
  });

  // Endpoint to get CSRF token
  app.get("/api/csrf-token", (req, res) => {
    try {
      const token = generateToken(req);
      // Explicitly save the session to ensure the token is stored
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session for CSRF token:", err);
          return res.status(500).json({ message: "Failed to generate CSRF token" });
        }
        console.log(`CSRF token generated for session ${req.sessionID?.substring(0, 8)}...`);
        res.json({ csrfToken: token });
      });
    } catch (error) {
      console.error("Error generating CSRF token:", error);
      res.status(500).json({ message: "Failed to generate CSRF token" });
    }
  });

  // Apply CSRF protection to all POST/PATCH/DELETE/PUT routes globally
  // This protects all API routes registered after this point
  // Login/registration routes above are NOT protected (they need to work without tokens)
  app.use(csrfSynchronisedProtection);

  // CSRF error handler - catches ForbiddenError from csrf-sync and returns structured response
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.code === 'EBADCSRFTOKEN' || err.message === 'invalid csrf token') {
      const receivedToken = req.headers['x-csrf-token'] || req.headers['csrf-token'] || 'none';
      const sessionToken = (req.session as any)?.csrfToken || 'none';
      console.warn(`CSRF validation failed: ${req.method} ${req.path}`);
      console.warn(`  Session ID: ${req.sessionID?.substring(0, 8)}...`);
      console.warn(`  Received token: ${typeof receivedToken === 'string' ? receivedToken.substring(0, 16) + '...' : 'none'}`);
      console.warn(`  Session token: ${typeof sessionToken === 'string' ? sessionToken.substring(0, 16) + '...' : 'none'}`);
      return res.status(403).json({ 
        message: "Invalid or missing CSRF token. Please refresh and try again.",
        code: "CSRF_ERROR"
      });
    }
    next(err);
  });

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