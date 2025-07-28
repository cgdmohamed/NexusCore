// Simple production server without ESM complications
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Import routes
import { registerRoutes } from "./routes.js";

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security middleware for production
if (process.env.NODE_ENV === 'production') {
  const helmet = await import("helmet");
  const compression = await import("compression");
  const cors = await import("cors");
  
  app.use(helmet.default({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "https:"],
      },
    },
  }));
  
  app.use(compression.default());
  app.use(cors.default({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000'],
    credentials: true,
  }));
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${new Date().toLocaleTimeString()} [express] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Register API routes
const server = await registerRoutes(app);

// Serve static files in production
const distPath = path.resolve(__dirname, 'public');
app.use(express.static(distPath));

// Catch-all handler for SPA
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  console.error(err);
});

const port = parseInt(process.env.PORT || '5000', 10);
server.listen({
  port,
  host: "0.0.0.0",
}, () => {
  console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${port}`);
});