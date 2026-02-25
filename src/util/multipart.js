import { badRequest } from "./http.js";

export function parseMultipartFormData(bodyBuffer, contentType) {
  const boundary = extractBoundary(contentType);
  const marker = `--${boundary}`;
  const raw = bodyBuffer.toString("latin1");
  const parts = raw.split(marker).slice(1, -1);

  const fields = {};
  const files = {};

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    if (!trimmed) continue;

    const splitIndex = trimmed.indexOf("\r\n\r\n");
    if (splitIndex < 0) continue;

    const headerText = trimmed.slice(0, splitIndex);
    const bodyText = trimmed.slice(splitIndex + 4);
    const headers = parseHeaders(headerText);
    const disposition = headers["content-disposition"] || "";
    const dispositionMeta = parseDisposition(disposition);

    if (!dispositionMeta.name) continue;

    const contentBytes = Buffer.from(bodyText, "latin1");
    if (dispositionMeta.filename) {
      files[dispositionMeta.name] = {
        filename: dispositionMeta.filename,
        contentType: headers["content-type"] || "application/octet-stream",
        buffer: trimTrailingCrlf(contentBytes),
      };
    } else {
      fields[dispositionMeta.name] = trimTrailingCrlf(contentBytes).toString("utf8");
    }
  }

  return { fields, files };
}

function extractBoundary(contentType) {
  const match = /boundary=([^;]+)/i.exec(String(contentType || ""));
  if (!match) throw badRequest("Missing multipart boundary");
  return match[1].trim().replace(/^"|"$/g, "");
}

function parseHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function parseDisposition(value) {
  const result = {};
  for (const segment of String(value || "").split(";")) {
    const [k, v] = segment.split("=");
    const key = String(k || "").trim().toLowerCase();
    if (key === "name") result.name = stripQuotes(v);
    if (key === "filename") result.filename = stripQuotes(v);
  }
  return result;
}

function stripQuotes(value) {
  return String(value || "").trim().replace(/^"|"$/g, "");
}

function trimTrailingCrlf(buffer) {
  if (buffer.length >= 2 && buffer[buffer.length - 2] === 13 && buffer[buffer.length - 1] === 10) {
    return buffer.subarray(0, buffer.length - 2);
  }
  return buffer;
}

