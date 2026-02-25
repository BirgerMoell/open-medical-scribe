import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { requestDiarization } from "../src/services/diarizeClient.js";

describe("diarizeClient", () => {
  it("sends WAV to sidecar and returns diarization result", async () => {
    // Mock HTTP server that returns diarization segments
    const mockResponse = {
      segments: [
        { speaker: "SPEAKER_00", start: 0.0, end: 2.5, speakerIndex: 0 },
        { speaker: "SPEAKER_01", start: 2.8, end: 5.1, speakerIndex: 1 },
      ],
      speakerCount: 2,
    };

    const server = createServer((req, res) => {
      assert.equal(req.url, "/diarize");
      assert.equal(req.method, "POST");
      assert.equal(req.headers["content-type"], "audio/wav");

      let body = [];
      req.on("data", (chunk) => body.push(chunk));
      req.on("end", () => {
        const buf = Buffer.concat(body);
        assert.ok(buf.length > 0, "Should receive WAV data");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockResponse));
      });
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const config = {
        streaming: { diarizeSidecarUrl: `http://localhost:${port}` },
      };

      const wavBuffer = Buffer.from("fake-wav-data");
      const result = await requestDiarization(config, wavBuffer);

      assert.equal(result.speakerCount, 2);
      assert.equal(result.segments.length, 2);
      assert.equal(result.segments[0].speaker, "SPEAKER_00");
    } finally {
      server.close();
    }
  });

  it("throws on sidecar error", async () => {
    const server = createServer((req, res) => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Model not loaded" }));
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const config = {
        streaming: { diarizeSidecarUrl: `http://localhost:${port}` },
      };

      await assert.rejects(
        () => requestDiarization(config, Buffer.from("test")),
        /503/,
      );
    } finally {
      server.close();
    }
  });
});
