import test from "node:test";
import assert from "node:assert/strict";
import { parseMultipartFormData } from "../src/util/multipart.js";

test("parseMultipartFormData extracts text fields and file parts", () => {
  const boundary = "testBoundary123";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="noteStyle"\r\n\r\n` +
    `soap\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="audio"; filename="clip.wav"\r\n` +
    `Content-Type: audio/wav\r\n\r\n` +
    `RIFFDATA\r\n` +
    `--${boundary}--\r\n`;

  const parsed = parseMultipartFormData(
    Buffer.from(body, "latin1"),
    `multipart/form-data; boundary=${boundary}`,
  );

  assert.equal(parsed.fields.noteStyle, "soap");
  assert.equal(parsed.files.audio.filename, "clip.wav");
  assert.equal(parsed.files.audio.contentType, "audio/wav");
  assert.equal(parsed.files.audio.buffer.toString("utf8"), "RIFFDATA");
});

test("parseMultipartFormData throws on missing boundary", () => {
  assert.throws(
    () => parseMultipartFormData(Buffer.from("x"), "multipart/form-data"),
    /Missing multipart boundary/,
  );
});
