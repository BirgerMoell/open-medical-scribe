export async function postJson(url, { headers = {}, body, timeoutMs = 60000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const error = new Error(
        `HTTP ${response.status} from ${url}: ${json?.error?.message || text || response.statusText}`,
      );
      error.statusCode = 502;
      throw error;
    }

    return { response, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

