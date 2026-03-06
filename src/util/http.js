export function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

export async function readJsonBody(req, options = {}) {
  const raw = await readRawBody(req, options);
  const text = raw.toString("utf8");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Invalid JSON request body");
    error.statusCode = 400;
    throw error;
  }
}

export async function readRawBody(req, options = {}) {
  const maxBytes = options.maxBytes ?? Infinity;
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
