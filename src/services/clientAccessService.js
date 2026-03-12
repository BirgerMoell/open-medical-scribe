import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function createClientAccessService(config, options = {}) {
  const now = options.now || (() => Date.now());
  const stateFile = config?.clientAccess?.stateFile || "data/client-access.json";
  const trialConfig = {
    maxRequests: config?.clientAccess?.trialMaxRequests ?? 20,
    maxAudioSeconds: config?.clientAccess?.trialMaxAudioSeconds ?? 20 * 60,
    maxEstimatedCostUsd: config?.clientAccess?.trialMaxEstimatedCostUsd ?? 2.5,
    bootstrapPerIpPerHour: config?.clientAccess?.bootstrapPerIpPerHour ?? 10,
    bootstrapPerInstallPerDay: config?.clientAccess?.bootstrapPerInstallPerDay ?? 3,
    estimatedCostPerAudioMinuteUsd: config?.clientAccess?.estimatedCostPerAudioMinuteUsd ?? 0.08,
    requireAttestation: config?.clientAccess?.requireAttestation ?? false,
  };
  const testerConfig = {
    maxRequests: config?.clientAccess?.testerMaxRequests ?? 1000,
    maxAudioSeconds: config?.clientAccess?.testerMaxAudioSeconds ?? 10 * 60 * 60,
    maxEstimatedCostUsd: config?.clientAccess?.testerMaxEstimatedCostUsd ?? 50,
  };

  function loadState() {
    try {
      const raw = readFileSync(stateFile, "utf8");
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch {
      return normalizeState({});
    }
  }

  function saveState(state) {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
  }

  function issueBootstrapToken({ installId, ipAddress, userAgent, attestation = {}, platform = "unknown" }) {
    const normalizedInstallId = normalizeInstallId(installId);
    if (trialConfig.requireAttestation && !attestation?.isSupported) {
      const error = new Error("This backend requires Apple device attestation before trial access can be issued.");
      error.statusCode = 403;
      error.code = "attestation_required";
      throw error;
    }

    const state = loadState();
    pruneWindows(state, now());

    const installHash = sha256(normalizedInstallId);
    const ipKey = ipAddress?.trim() || "unknown";
    applyRateLimit({
      buckets: state.bootstrapWindows.byIp,
      key: ipKey,
      limit: trialConfig.bootstrapPerIpPerHour,
      windowMs: 60 * 60 * 1000,
      label: "Too many bootstrap requests from this network. Please try again shortly.",
      nowMs: now(),
    });
    applyRateLimit({
      buckets: state.bootstrapWindows.byInstall,
      key: installHash,
      limit: trialConfig.bootstrapPerInstallPerDay,
      windowMs: 24 * 60 * 60 * 1000,
      label: "This installation has already requested secure trial access too many times today.",
      nowMs: now(),
    });

    const clientIndex = state.clients.findIndex((entry) => entry.installIdHash === installHash && entry.status === "active");
    const token = `oms_${randomBytes(24).toString("base64url")}`;
    const tokenHash = sha256(token);
    const attestationSummary = summarizeAttestation(attestation, platform);
    const timestamp = new Date(now()).toISOString();

    let client;
    if (clientIndex >= 0) {
      client = state.clients[clientIndex];
      client.tokenHash = tokenHash;
      client.lastSeenAt = timestamp;
      client.lastBootstrapAt = timestamp;
      client.lastSeenIp = ipKey;
      client.lastSeenUserAgent = safeUserAgent(userAgent);
      client.bootstrapCount = (client.bootstrapCount || 0) + 1;
      client.platform = platform || client.platform || "unknown";
      client.attestation = attestationSummary;
      client.mode = normalizeMode(client.mode);
      client.quotas = normalizeQuotas(client.quotas, client.mode === "tester" ? testerConfig : trialConfig);
      client.usage = normalizeUsage(client.usage);
    } else {
      client = {
        clientId: `cli_${randomBytes(8).toString("hex")}`,
        status: "active",
        mode: "trial",
        installIdHash: installHash,
        tokenHash,
        createdAt: timestamp,
        lastSeenAt: timestamp,
        lastBootstrapAt: timestamp,
        lastSeenIp: ipKey,
        lastSeenUserAgent: safeUserAgent(userAgent),
        bootstrapCount: 1,
        platform: platform || "unknown",
        attestation: attestationSummary,
        usage: {
          requestCount: 0,
          audioSeconds: 0,
          estimatedCostUsd: 0,
        },
        quotas: normalizeQuotas(null, trialConfig),
      };
      state.clients.push(client);
    }

    saveState(state);
    return buildBootstrapResponse(client, token);
  }

  function authenticateClientToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) {
      return null;
    }

    const state = loadState();
    const tokenHash = sha256(token);
    const client = state.clients.find((entry) => entry.tokenHash === tokenHash && entry.status === "active");
    if (!client) {
      return null;
    }

    return {
      clientId: client.clientId,
      mode: normalizeMode(client.mode),
      quotas: client.quotas,
      usage: client.usage,
      attestation: client.attestation,
      platform: client.platform,
    };
  }

  function assertCanUseClient(clientId) {
    const state = loadState();
    const client = state.clients.find((entry) => entry.clientId === clientId && entry.status === "active");
    if (!client) {
      throw quotaError(401, "Unknown or revoked client token.", "invalid_client_token");
    }

    if (client.usage.requestCount >= client.quotas.maxRequests) {
      throw quotaError(429, "Trial request limit reached. Contact Eir to extend access.", "trial_request_limit_reached", client);
    }

    if (client.usage.audioSeconds >= client.quotas.maxAudioSeconds) {
      throw quotaError(429, "Trial audio-minute limit reached. Contact Eir to extend access.", "trial_audio_limit_reached", client);
    }

    if (client.usage.estimatedCostUsd >= client.quotas.maxEstimatedCostUsd) {
      throw quotaError(429, "Trial spend limit reached. Contact Eir to extend access.", "trial_spend_limit_reached", client);
    }

    return {
      clientId: client.clientId,
      mode: normalizeMode(client.mode),
      quotas: client.quotas,
      usage: client.usage,
      attestation: client.attestation,
      platform: client.platform,
    };
  }

  function recordScribeUsage(clientId, { input = {}, result = {} } = {}) {
    const state = loadState();
    const client = state.clients.find((entry) => entry.clientId === clientId && entry.status === "active");
    if (!client) {
      return null;
    }

    const audioSeconds = estimateAudioSeconds(input, result);
    const estimatedCostUsd = roundUsd((audioSeconds / 60) * trialConfig.estimatedCostPerAudioMinuteUsd);

    client.lastSeenAt = new Date(now()).toISOString();
    client.usage.requestCount += 1;
    client.usage.audioSeconds += audioSeconds;
    client.usage.estimatedCostUsd = roundUsd(client.usage.estimatedCostUsd + estimatedCostUsd);
    saveState(state);

    return buildQuotaSnapshot(client);
  }

  function recordChatUsage(clientId, { estimatedCostUsd = 0 } = {}) {
    const state = loadState();
    const client = state.clients.find((entry) => entry.clientId === clientId && entry.status === "active");
    if (!client) {
      return null;
    }

    client.lastSeenAt = new Date(now()).toISOString();
    client.usage.requestCount += 1;
    client.usage.estimatedCostUsd = roundUsd(client.usage.estimatedCostUsd + Math.max(0, Number(estimatedCostUsd) || 0));
    saveState(state);

    return buildQuotaSnapshot(client);
  }

  function promoteClient(clientId, { resetUsage = false, quotas = {} } = {}) {
    const state = loadState();
    const client = state.clients.find((entry) => entry.clientId === clientId && entry.status === "active");
    if (!client) {
      const error = new Error("Unknown client.");
      error.statusCode = 404;
      throw error;
    }

    client.mode = "tester";
    client.quotas = normalizeQuotas(quotas, testerConfig);
    client.usage = resetUsage
      ? { requestCount: 0, audioSeconds: 0, estimatedCostUsd: 0 }
      : normalizeUsage(client.usage);
    client.lastSeenAt = new Date(now()).toISOString();
    saveState(state);

    return buildBootstrapResponse(client);
  }

  function listClients() {
    const state = loadState();
    return state.clients
      .filter((entry) => entry.status === "active")
      .map((entry) => ({
        clientId: entry.clientId,
        mode: normalizeMode(entry.mode),
        platform: entry.platform,
        lastSeenAt: entry.lastSeenAt,
        createdAt: entry.createdAt,
        bootstrapCount: entry.bootstrapCount || 0,
        quota: buildQuotaSnapshot(entry),
      }))
      .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")));
  }

  return {
    issueBootstrapToken,
    authenticateClientToken,
    assertCanUseClient,
    recordScribeUsage,
    recordChatUsage,
    promoteClient,
    listClients,
  };
}

function normalizeState(state) {
  return {
    clients: Array.isArray(state.clients) ? state.clients.map(normalizeClient) : [],
    bootstrapWindows: {
      byIp: state.bootstrapWindows?.byIp && typeof state.bootstrapWindows.byIp === "object"
        ? state.bootstrapWindows.byIp
        : {},
      byInstall: state.bootstrapWindows?.byInstall && typeof state.bootstrapWindows.byInstall === "object"
        ? state.bootstrapWindows.byInstall
        : {},
    },
  };
}

function normalizeClient(client) {
  const mode = normalizeMode(client?.mode);
  const defaults = mode === "tester"
    ? {
        maxRequests: client?.quotas?.maxRequests ?? 1000,
        maxAudioSeconds: client?.quotas?.maxAudioSeconds ?? 10 * 60 * 60,
        maxEstimatedCostUsd: client?.quotas?.maxEstimatedCostUsd ?? 50,
      }
    : {
        maxRequests: client?.quotas?.maxRequests ?? 20,
        maxAudioSeconds: client?.quotas?.maxAudioSeconds ?? 20 * 60,
        maxEstimatedCostUsd: client?.quotas?.maxEstimatedCostUsd ?? 2.5,
      };

  return {
    ...client,
    mode,
    usage: normalizeUsage(client?.usage),
    quotas: normalizeQuotas(client?.quotas, defaults),
  };
}

function normalizeMode(mode) {
  return mode === "tester" ? "tester" : "trial";
}

function normalizeUsage(usage) {
  return {
    requestCount: Math.max(0, Number(usage?.requestCount) || 0),
    audioSeconds: Math.max(0, Number(usage?.audioSeconds) || 0),
    estimatedCostUsd: roundUsd(Math.max(0, Number(usage?.estimatedCostUsd) || 0)),
  };
}

function normalizeQuotas(quotas, defaults) {
  return {
    maxRequests: Math.max(1, Number(quotas?.maxRequests) || defaults.maxRequests),
    maxAudioSeconds: Math.max(60, Number(quotas?.maxAudioSeconds) || defaults.maxAudioSeconds),
    maxEstimatedCostUsd: roundUsd(Math.max(0.01, Number(quotas?.maxEstimatedCostUsd) || defaults.maxEstimatedCostUsd)),
  };
}

function normalizeInstallId(installId) {
  const normalized = String(installId || "").trim();
  if (normalized.length < 12 || normalized.length > 160) {
    const error = new Error("installId is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function summarizeAttestation(attestation, platform) {
  const provider = String(attestation?.provider || "none").trim() || "none";
  const status = String(attestation?.status || "missing").trim() || "missing";
  const isSupported = Boolean(attestation?.isSupported);
  const evidence = attestation?.evidence ? "present" : "absent";

  return {
    provider,
    status,
    isSupported,
    evidence,
    platform,
  };
}

function safeUserAgent(userAgent) {
  return String(userAgent || "").slice(0, 300);
}

function applyRateLimit({ buckets, key, limit, windowMs, label, nowMs }) {
  if (!limit || limit < 1) {
    return;
  }

  const bucket = buckets[key];
  if (!bucket || nowMs >= bucket.resetAt) {
    buckets[key] = { count: 1, resetAt: nowMs + windowMs };
    return;
  }

  if (bucket.count >= limit) {
    const error = new Error(label);
    error.statusCode = 429;
    error.code = "bootstrap_rate_limited";
    throw error;
  }

  bucket.count += 1;
}

function pruneWindows(state, nowMs) {
  for (const buckets of [state.bootstrapWindows.byIp, state.bootstrapWindows.byInstall]) {
    for (const [key, bucket] of Object.entries(buckets)) {
      if (!bucket || nowMs >= bucket.resetAt) {
        delete buckets[key];
      }
    }
  }
}

function buildBootstrapResponse(client, bearerToken) {
  return {
    clientId: client.clientId,
    bearerToken,
    mode: normalizeMode(client.mode),
    attestation: client.attestation,
    quota: buildQuotaSnapshot(client),
  };
}

function buildQuotaSnapshot(client) {
  return {
    used: {
      requests: client.usage.requestCount,
      audioSeconds: client.usage.audioSeconds,
      estimatedCostUsd: client.usage.estimatedCostUsd,
    },
    limits: {
      requests: client.quotas.maxRequests,
      audioSeconds: client.quotas.maxAudioSeconds,
      estimatedCostUsd: client.quotas.maxEstimatedCostUsd,
    },
    remaining: {
      requests: Math.max(0, client.quotas.maxRequests - client.usage.requestCount),
      audioSeconds: Math.max(0, client.quotas.maxAudioSeconds - client.usage.audioSeconds),
      estimatedCostUsd: roundUsd(Math.max(0, client.quotas.maxEstimatedCostUsd - client.usage.estimatedCostUsd)),
    },
  };
}

function quotaError(statusCode, message, code, client) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (client) {
    error.quota = buildQuotaSnapshot(client);
  }
  return error;
}

function estimateAudioSeconds(input, result) {
  const transcriptSeconds = maxTimestamp(result?.transcriptDocument);
  if (transcriptSeconds > 0) {
    return Math.ceil(transcriptSeconds);
  }

  const inputMime = String(input?.audioMimeType || "").toLowerCase();
  const inputBytes = estimateInputBytes(input);
  if (inputBytes > 0) {
    const bytesPerSecond = estimateBytesPerSecond(inputMime);
    return Math.max(1, Math.ceil(inputBytes / bytesPerSecond));
  }

  return 60;
}

function maxTimestamp(document) {
  const words = Array.isArray(document?.words) ? document.words : [];
  const segments = Array.isArray(document?.segments) ? document.segments : [];
  let max = 0;
  for (const item of [...words, ...segments]) {
    const value = Number(item?.end ?? item?.endMs);
    if (Number.isFinite(value) && value > max) {
      max = value;
    }
  }

  if (max > 1000) {
    return max / 1000;
  }

  return max;
}

function estimateInputBytes(input) {
  const audioBase64 = String(input?.audioBase64 || "");
  if (!audioBase64) {
    return 0;
  }

  try {
    return Buffer.from(audioBase64, "base64").byteLength;
  } catch {
    return 0;
  }
}

function estimateBytesPerSecond(mimeType) {
  if (mimeType.includes("wav")) return 32000;
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return 2000;
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) return 4000;
  if (mimeType.includes("ogg")) return 3000;
  return 4000;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function roundUsd(value) {
  return Math.round(value * 1000) / 1000;
}
