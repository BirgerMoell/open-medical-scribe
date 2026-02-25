import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export function serveStaticFile(res, filePath) {
  try {
    const fullPath = resolve(process.cwd(), filePath);
    const content = readFileSync(fullPath);
    const mime = MIME_BY_EXT[extname(fullPath)] || "application/octet-stream";
    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", content.length);
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

