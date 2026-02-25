/**
 * Browser streaming client with VAD and WebSocket audio transport.
 *
 * Uses @ricky0123/vad-web (Silero VAD via ONNX) for voice activity detection
 * and streams PCM16 audio to the server over WebSocket.
 *
 * Exports: initStreaming(elements, callbacks) -> { start, stop, isStreaming }
 */

const VAD_CDN = "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js";

let vadModule = null;
let vadInstance = null;
let ws = null;
let audioContext = null;
let sourceNode = null;
let workletNode = null;
let micStream = null;
let streaming = false;

/**
 * Initialize the streaming system.
 * @param {Object} callbacks
 * @param {function} callbacks.onTranscript - Called with { text, speaker, isFinal }
 * @param {function} callbacks.onUtteranceEnd - Called when an utterance boundary is detected
 * @param {function} callbacks.onSessionEnd - Called with { fullTranscript, speakers }
 * @param {function} callbacks.onStateChange - Called with state string
 * @param {function} callbacks.onError - Called with error message
 */
export function initStreaming(callbacks) {
  return {
    start(opts) { return startStreaming(opts, callbacks); },
    stop() { return stopStreaming(callbacks); },
    get isStreaming() { return streaming; },
  };
}

async function loadVad() {
  if (vadModule) return vadModule;

  // Load VAD from CDN if not already available
  if (!window.vad) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = VAD_CDN;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load VAD library from CDN"));
      document.head.appendChild(script);
    });
  }

  vadModule = window.vad;
  return vadModule;
}

async function startStreaming(opts = {}, callbacks) {
  if (streaming) return;

  callbacks.onStateChange("Loading VAD...");

  try {
    // Get microphone access
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Set up AudioContext for PCM extraction
    audioContext = new AudioContext({ sampleRate: 16000 });
    sourceNode = audioContext.createMediaStreamSource(micStream);

    // Set up AudioWorklet for continuous PCM16 streaming
    await audioContext.audioWorklet.addModule(createWorkletUrl());
    workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
    sourceNode.connect(workletNode);
    workletNode.connect(audioContext.destination);

    // Open WebSocket
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/v1/stream`;
    ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error("WebSocket connection failed"));
    });

    // Send config message
    ws.send(JSON.stringify({
      language: opts.language || "",
      country: opts.country || "",
      diarize: true,
    }));

    // Handle messages from server
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "transcript") {
          callbacks.onTranscript(msg);
        } else if (msg.type === "utterance_end") {
          callbacks.onUtteranceEnd();
        } else if (msg.type === "session_end") {
          callbacks.onSessionEnd(msg);
          // Session complete — clean up the WebSocket
          cleanup();
          callbacks.onStateChange("Stopped");
        } else if (msg.type === "error") {
          callbacks.onError(msg.message);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      if (streaming) stopStreaming(callbacks);
    };

    // Stream PCM16 audio from worklet to WebSocket
    workletNode.port.onmessage = (event) => {
      if (!streaming || !ws || ws.readyState !== WebSocket.OPEN) return;
      const float32 = event.data;
      const pcm16 = float32ToPcm16(float32);
      ws.send(pcm16.buffer);
    };

    streaming = true;
    callbacks.onStateChange("Streaming");

  } catch (error) {
    cleanup();
    callbacks.onError(String(error.message || error));
    callbacks.onStateChange("Error");
  }
}

function stopStreaming(callbacks) {
  if (!streaming) return;
  streaming = false;

  // Stop sending audio (disconnect worklet) but keep WebSocket open for session_end
  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (micStream) {
    for (const track of micStream.getTracks()) track.stop();
    micStream = null;
  }

  // Send stop message — server will run final transcription and send session_end
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "stop" }));
  }

  // Safety timeout: cleanup if session_end never arrives (e.g. model still loading)
  setTimeout(() => {
    if (ws) {
      cleanup();
      callbacks.onStateChange("Stopped");
    }
  }, 60000);
}

function cleanup() {
  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  if (micStream) {
    for (const track of micStream.getTracks()) track.stop();
    micStream = null;
  }
  if (ws) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }
}

/**
 * Convert Float32Array audio samples to PCM16 Int16Array.
 */
function float32ToPcm16(float32) {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

/**
 * Create a data URL for the AudioWorklet processor.
 * This avoids needing a separate file for the worklet.
 */
function createWorkletUrl() {
  const code = `
    class PcmProcessor extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0];
        if (input && input[0] && input[0].length > 0) {
          // Copy Float32 samples and send to main thread
          this.port.postMessage(new Float32Array(input[0]));
        }
        return true;
      }
    }
    registerProcessor('pcm-processor', PcmProcessor);
  `;
  const blob = new Blob([code], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
