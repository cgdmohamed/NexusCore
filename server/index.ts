import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { validateVaultKey } from "./crypto-utils";

const app = express();

// Production optimizations
async function setupProductionMiddleware() {
  if (process.env.NODE_ENV === 'production') {
    const { default: helmet } = await import("helmet");
    const { default: compression } = await import("compression");
    const { default: cors } = await import("cors");
    
    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcElem: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", "wss:", "https:"],
        },
      },
    }));
    
    // Gzip compression
    app.use(compression());
    
    // CORS configuration
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'csrf-token'],
    }));
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Paths whose response bodies must never appear in logs (contain sensitive credential data)
const SENSITIVE_PATHS = [/^\/api\/clients\/[^/]+\/credentials/];

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const isSensitive = SENSITIVE_PATHS.some((re) => re.test(path));
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    if (!isSensitive) {
      capturedJsonResponse = bodyJson;
    }
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Validate vault encryption key at startup — hard fail if missing or malformed
  try {
    validateVaultKey();
  } catch (err) {
    console.error("[VAULT] FATAL:", (err as Error).message);
    console.error("[VAULT] Set VAULT_ENCRYPTION_KEY to a 64-character hex string (32 bytes).");
    console.error("[VAULT] Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  }

  await setupProductionMiddleware();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
