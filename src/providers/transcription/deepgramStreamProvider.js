import WebSocket from "ws";

/**
 * Deepgram streaming transcription provider with real-time diarization.
 * Opens a WebSocket to Deepgram's listen endpoint for live transcription.
 */
export function createDeepgramStreamProvider(config) {
  return {
    name: "deepgram-stream",

    createSession({ language, diarize = true, onResult, onUtteranceEnd, onError, onClose }) {
      if (!config.deepgram.apiKey) {
        onError(new Error("DEEPGRAM_API_KEY not configured for streaming transcription."));
        return { sendAudio() {}, close() {} };
      }

      const params = new URLSearchParams({
        model: config.deepgram.model || "nova-3-medical",
        encoding: "linear16",
        sample_rate: "16000",
        channels: "1",
        smart_format: "true",
        punctuate: "true",
        interim_results: "true",
        utterance_end_ms: "1500",
      });

      if (diarize) params.set("diarize", "true");
      if (language) params.set("language", language);

      const url = `wss://api.deepgram.com/v1/listen?${params}`;
      let closed = false;

      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${config.deepgram.apiKey}`,
        },
      });

      ws.on("open", () => {
        // Connection ready — audio can be sent.
      });

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(String(data));

          if (msg.type === "Results") {
            const alt = msg.channel?.alternatives?.[0];
            if (!alt) return;

            const text = alt.transcript || "";
            if (!text.trim()) return;

            // Extract dominant speaker from words
            const words = (alt.words || []).map((w) => ({
              word: w.word || w.punctuated_word || "",
              speaker: typeof w.speaker === "number" ? w.speaker : -1,
              start: w.start,
              end: w.end,
              confidence: w.confidence,
            }));

            const speaker = dominantSpeaker(words);

            onResult({
              text,
              speaker,
              isFinal: msg.is_final === true,
              speechFinal: msg.speech_final === true,
              words,
            });
          }

          if (msg.type === "UtteranceEnd") {
            onUtteranceEnd();
          }
        } catch (err) {
          onError(err);
        }
      });

      ws.on("error", (err) => {
        onError(err);
      });

      ws.on("close", () => {
        closed = true;
        onClose();
      });

      return {
        sendAudio(pcm16Buffer) {
          if (closed || ws.readyState !== WebSocket.OPEN) return;
          ws.send(pcm16Buffer);
        },

        close() {
          if (closed) return;
          closed = true;
          // Send Deepgram close message to flush remaining audio
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "CloseStream" }));
          }
          // Give Deepgram a moment to send final results before closing
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close();
            }
          }, 1500);
        },
      };
    },
  };
}

function dominantSpeaker(words) {
  if (!words.length) return -1;
  const counts = {};
  for (const w of words) {
    if (w.speaker >= 0) {
      counts[w.speaker] = (counts[w.speaker] || 0) + 1;
    }
  }
  const entries = Object.entries(counts);
  if (!entries.length) return -1;
  entries.sort((a, b) => b[1] - a[1]);
  return Number(entries[0][0]);
}
