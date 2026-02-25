import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { attachStreamHandler } from "../src/server/streamHandler.js";

function makeConfig() {
  return {
    streaming: {
      transcriptionProvider: "mock-stream",
      diarizeSidecarUrl: "http://localhost:9999",
      diarizeOnEnd: false,
    },
    deepgram: { apiKey: "", model: "nova-3-medical" },
    privacy: { auditLogFile: "" },
  };
}

function startServer(config) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.writeHead(404);
      res.end();
    });
    attachStreamHandler(server, config);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

describe("streamHandler", () => {
  it("accepts WebSocket connection and returns ready message", async () => {
    const config = makeConfig();
    const { server, port } = await startServer(config);

    try {
      const ws = new WebSocket(`ws://localhost:${port}/v1/stream`);

      const readyMsg = await new Promise((resolve, reject) => {
        ws.on("open", () => {
          ws.send(JSON.stringify({ language: "en" }));
        });
        ws.on("message", (data) => {
          resolve(JSON.parse(String(data)));
        });
        ws.on("error", reject);
      });

      assert.equal(readyMsg.type, "ready");
      assert.equal(readyMsg.provider, "mock-stream");

      ws.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      server.close();
    }
  });

  it("rejects upgrade on non-stream paths", async () => {
    const config = makeConfig();
    const { server, port } = await startServer(config);

    try {
      const ws = new WebSocket(`ws://localhost:${port}/v1/other`);

      const error = await new Promise((resolve) => {
        ws.on("error", resolve);
        ws.on("close", () => resolve(new Error("closed")));
      });

      assert.ok(error);
    } finally {
      server.close();
    }
  });

  it("receives mock transcript after sending audio frames", async () => {
    const config = makeConfig();
    const { server, port } = await startServer(config);

    try {
      const ws = new WebSocket(`ws://localhost:${port}/v1/stream`);

      const messages = [];

      await new Promise((resolve) => {
        ws.on("open", () => {
          ws.send(JSON.stringify({ language: "en" }));
        });
        ws.on("message", (data) => {
          const msg = JSON.parse(String(data));
          messages.push(msg);

          if (msg.type === "ready") {
            // Send 20 "audio" frames to trigger mock transcript
            for (let i = 0; i < 20; i++) {
              ws.send(Buffer.alloc(2048)); // 1024 samples of silence
            }
            // Wait a bit then stop
            setTimeout(() => {
              ws.send(JSON.stringify({ type: "stop" }));
            }, 200);
          }

          if (msg.type === "session_end") {
            resolve();
          }
        });
      });

      const transcripts = messages.filter((m) => m.type === "transcript");
      const sessionEnd = messages.find((m) => m.type === "session_end");

      assert.ok(transcripts.length > 0, "Should receive at least one transcript");
      assert.ok(transcripts[0].text.length > 0, "Transcript should have text");
      assert.ok(typeof transcripts[0].speaker === "number", "Should have speaker number");
      assert.ok(sessionEnd, "Should receive session_end");
      assert.ok(sessionEnd.fullTranscript.length > 0, "Full transcript should be non-empty");

      ws.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      server.close();
    }
  });
});
