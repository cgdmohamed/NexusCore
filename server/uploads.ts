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
