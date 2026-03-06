import { spawn } from "node:child_process";

/**
 * Wrap raw PCM16 (signed 16-bit little-endian) samples in a WAV container.
 * Returns a Buffer with a complete WAV file.
 */
export function encodePcm16ToWav(pcmBuffer, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // sub-chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, headerSize);

  return buffer;
}

export async function decodeAudioToFloat32(audioBuffer, sampleRate = 16000) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-f", "s16le",
      "-ac", "1",
      "-ar", String(sampleRate),
      "pipe:1",
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error("ffmpeg is required for local whisper-onnx transcription but was not found in PATH."));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg audio decode failed (${code}): ${Buffer.concat(stderr).toString("utf8").trim() || "unknown error"}`));
        return;
      }

      const pcm = Buffer.concat(stdout);
      const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
      const float32 = new Float32Array(samples.length);
      for (let index = 0; index < samples.length; index += 1) {
        float32[index] = samples[index] / 32768;
      }
      resolve(float32);
    });

    child.stdin.write(audioBuffer);
    child.stdin.end();
  });
}
