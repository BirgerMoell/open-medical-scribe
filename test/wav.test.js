import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodePcm16ToWav } from "../src/util/wav.js";

describe("encodePcm16ToWav", () => {
  it("produces a valid WAV header for PCM16 mono 16kHz", () => {
    // 100 samples of silence (200 bytes of PCM16)
    const pcm = Buffer.alloc(200);
    const wav = encodePcm16ToWav(pcm, 16000);

    // WAV file should be 44 (header) + 200 (data) = 244 bytes
    assert.equal(wav.length, 244);

    // RIFF header
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.readUInt32LE(4), 236); // 36 + dataSize

    // WAVE format
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");

    // fmt sub-chunk
    assert.equal(wav.toString("ascii", 12, 16), "fmt ");
    assert.equal(wav.readUInt16LE(20), 1); // PCM format
    assert.equal(wav.readUInt16LE(22), 1); // mono
    assert.equal(wav.readUInt32LE(24), 16000); // sample rate
    assert.equal(wav.readUInt16LE(34), 16); // bits per sample

    // data sub-chunk
    assert.equal(wav.toString("ascii", 36, 40), "data");
    assert.equal(wav.readUInt32LE(40), 200); // data size
  });

  it("defaults to 16kHz sample rate", () => {
    const pcm = Buffer.alloc(100);
    const wav = encodePcm16ToWav(pcm);
    assert.equal(wav.readUInt32LE(24), 16000);
  });
});
