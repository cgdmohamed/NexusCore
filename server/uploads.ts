import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

/** Directory where uploaded files are stored (override with UPLOADS_DIR, e.g. a mounted volume). */
export const uploadsRoot = () => path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));

/** Resolve a public `/uploads/...` path to a file inside the uploads root, or null if it escapes it. */
export function resolveUploadPath(publicPath: string): string | null {
  const root = uploadsRoot();
  const relative = publicPath.replace(/^\/?uploads\/?/, "");
  const full = path.resolve(root, relative);
  return full.startsWith(root + path.sep) ? full : null;
}

/** Only values that point into the uploads area are acceptable as stored attachment URLs. */
export const isStoredUploadPath = (value: unknown): value is string =>
  typeof value === "string" && /^\/uploads\/[A-Za-z0-9_\-./]+$/.test(value) && !value.includes("..");

// The extension is derived from the declared content type, never from the client's file name.
const ALLOWED_TYPES: Record<string, { ext: string; kind: "receipt" | "invoice" }> = {
  "image/jpeg": { ext: ".jpg", kind: "receipt" },
  "image/png": { ext: ".png", kind: "receipt" },
  "image/gif": { ext: ".gif", kind: "receipt" },
  "application/pdf": { ext: ".pdf", kind: "invoice" },
};

// First bytes a genuine file of each type starts with.
const SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
};

/** True when the file on disk really starts like the type it was declared to be. */
export function matchesDeclaredType(filePath: string, mimetype: string): boolean {
  const signatures = SIGNATURES[mimetype];
  if (!signatures) return false;
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, "r");
    const head = Buffer.alloc(8);
    const read = fs.readSync(fd, head, 0, 8, 0);
    return signatures.some((sig) => read >= sig.length && sig.every((byte, i) => head[i] === byte));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Extensions that browsers may render inline; everything else is delivered as a download. */
const INLINE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".pdf"]);

/** Headers that stop an uploaded file from running as a page, whatever its name says. */
export function setUploadHeaders(res: Response, filePath: string) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  if (!INLINE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment");
  }
}

export const attachmentKind = (mimetype: string) => ALLOWED_TYPES[mimetype]?.kind ?? "other";

/** Single-file upload middleware (field "file") storing into uploads/<subdir>; failures become 400 responses. */
export function attachmentUpload(subdir: string, maxBytes = 5 * 1024 * 1024) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(uploadsRoot(), subdir);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ALLOWED_TYPES[file.mimetype].ext}`);
      },
    }),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
      else cb(new Error("Invalid file type. Only JPEG, PNG, GIF and PDF files are allowed."));
    },
  }).single("file");

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err && req.file && !matchesDeclaredType(req.file.path, req.file.mimetype)) {
        fs.rmSync(req.file.path, { force: true });
        return res.status(400).json({ message: "The file content does not match its declared type." });
      }
      if (!err) return next();
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? `File is too large (maximum ${Math.round(maxBytes / 1024 / 1024)}MB).`
          : err instanceof Error
            ? err.message
            : "Upload failed.";
      res.status(400).json({ message });
    });
  };
}
