/**
 * Client for the optional pyannote speaker diarization sidecar.
 * POSTs a WAV file and receives speaker segments.
 */
export async function requestDiarization(config, wavBuffer) {
  const url = `${config.streaming.diarizeSidecarUrl.replace(/\/+$/, "")}/diarize`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "audio/wav",
      },
      body: wavBuffer,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Diarization sidecar error (${response.status}): ${text}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
