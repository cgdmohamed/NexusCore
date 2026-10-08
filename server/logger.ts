// Minimal levelled logger. Output goes through console.* so pm2 / docker capture it as before.
// LOG_LEVEL=debug|info|warn|error (default: info in production, debug otherwise).
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = (): number => {
  const configured = (process.env.LOG_LEVEL || "").toLowerCase() as Level;
  if (configured in ORDER) return ORDER[configured];
  return process.env.NODE_ENV === "production" ? ORDER.info : ORDER.debug;
};

function write(level: Level, args: unknown[]) {
  if (ORDER[level] < threshold()) return;
  const prefix = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(prefix, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => write("debug", args),
  info: (...args: unknown[]) => write("info", args),
  warn: (...args: unknown[]) => write("warn", args),
  error: (...args: unknown[]) => write("error", args),
};
