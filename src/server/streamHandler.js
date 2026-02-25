import { WebSocketServer } from "ws";
import { createStreamingTranscriptionProvider } from "../providers/transcription/streamIndex.js";
import { createAuditLogger } from "../services/auditLogger.js";
import { encodePcm16ToWav } from "../util/wav.js";
import { requestDiarization } from "../services/diarizeClient.js";

/**
 * Attach a WebSocket server to the HTTP server for streaming audio.
 *
 * Protocol:
 * 1. Client connects to ws://host/v1/stream
 * 2. Client sends JSON config: { language, country, diarize }
 * 3. Client sends binary PCM16 (16kHz mono signed 16-bit LE) frames
 * 4. Server sends JSON messages back:
 *    - { type: "transcript", text, speaker, isFinal, words }
 *    - { type: "utterance_end" }
 *    - { type: "error", message }
 *    - { type: "session_end", fullTranscript, speakers, diarization }
 * 5. Client sends JSON { type: "stop" } or closes connection to end
 */
export function attachStreamHandler(server, config) {
  const wss = new WebSocketServer({ noServer: true });
  const audit = createAuditLogger(config);
  const streamProvider = createStreamingTranscriptionProvider(config);

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/v1/stream") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    let session = null;
    let configured = false;
    const pcmChunks = [];
    const utterances = [];
    let currentUtterance = { speaker: -1, parts: [] };

    function send(msg) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    ws.on("message", (data, isBinary) => {
      // Binary frame = PCM16 audio
      if (isBinary) {
        if (!session) return;
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        pcmChunks.push(buf);
        session.sendAudio(buf);
        return;
      }

      // Text frame = JSON control message
      try {
        const msg = JSON.parse(String(data));

        if (!configured && msg.language !== undefined) {
          // Config message — start the streaming session
          configured = true;
          session = streamProvider.createSession({
            language: msg.language || "",
            diarize: msg.diarize !== false,

            onResult(result) {
              // Accumulate for full transcript
              if (result.isFinal && result.text.trim()) {
                if (result.speaker !== currentUtterance.speaker && currentUtterance.parts.length) {
                  utterances.push({ ...currentUtterance });
                  currentUtterance = { speaker: result.speaker, parts: [] };
                }
                currentUtterance.speaker = result.speaker;
                currentUtterance.parts.push(result.text);
              }

              send({
                type: "transcript",
                text: result.text,
                speaker: result.speaker,
                isFinal: result.isFinal,
                speechFinal: result.speechFinal || false,
                words: result.words || [],
              });
            },

            onUtteranceEnd() {
              if (currentUtterance.parts.length) {
                utterances.push({ ...currentUtterance });
                currentUtterance = { speaker: -1, parts: [] };
              }
              send({ type: "utterance_end" });
            },

            onError(err) {
              send({ type: "error", message: String(err.message || err) });
            },

            onClose() {
              // Provider closed — handled in ws close
            },
          });

          send({ type: "ready", provider: streamProvider.name });
          return;
        }

        if (msg.type === "stop") {
          endSession();
        }
      } catch {
        send({ type: "error", message: "Invalid JSON message" });
      }
    });

    ws.on("close", () => {
      endSession();
    });

    ws.on("error", () => {
      endSession();
    });

    async function endSession() {
      if (!session) return;
      const s = session;
      session = null;

      s.close();

      // Flush remaining utterance
      if (currentUtterance.parts.length) {
        utterances.push({ ...currentUtterance });
      }

      // Build full transcript with speaker labels
      const speakers = new Set();
      const fullTranscript = utterances
        .map((u) => {
          speakers.add(u.speaker);
          const label = speakerLabel(u.speaker);
          return `${label}: ${u.parts.join(" ")}`;
        })
        .join("\n");

      // Optional: post-process with pyannote sidecar
      let diarization = null;
      if (config.streaming.diarizeOnEnd && pcmChunks.length) {
        const allPcm = Buffer.concat(pcmChunks);
        const wav = encodePcm16ToWav(allPcm, 16000);
        try {
          diarization = await requestDiarization(config, wav);
        } catch {
          // Sidecar not available — skip
        }
      }

      send({
        type: "session_end",
        fullTranscript,
        speakers: [...speakers].map((s) => ({ id: s, label: speakerLabel(s) })),
        utteranceCount: utterances.length,
        audioDurationSec: pcmChunks.reduce((n, c) => n + c.length, 0) / (16000 * 2),
        diarization,
      });

      audit.log({
        event: "stream_session_end",
        provider: streamProvider.name,
        utteranceCount: utterances.length,
        speakerCount: speakers.size,
        audioDurationSec: pcmChunks.reduce((n, c) => n + c.length, 0) / (16000 * 2),
      });
    }
  });

  return wss;
}

function speakerLabel(speaker) {
  if (speaker === 0) return "Speaker 1";
  if (speaker === 1) return "Speaker 2";
  if (speaker >= 0) return `Speaker ${speaker + 1}`;
  return "Unknown";
}
