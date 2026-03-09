# Eir Scribe Sweden-First Deployment

## Recommended order

1. `AWS eu-north-1 (Stockholm)` if you want the fastest managed path with strong regional controls.
2. `ELASTX` if you want a Swedish operator and Swedish data-center footprint.
3. `Safespring` if Swedish public-sector alignment and Swedish hosting are more important than ecosystem breadth.

## Not recommended for Sweden-only residency

`Hetzner` is a strong low-cost host, but it should not be the first choice when Swedish residency is non-negotiable because its standard cloud footprint is not in Sweden.

## Production baseline

Use these repo artifacts:

- `Dockerfile`
- `fly.toml`
- `infra/caddy/Caddyfile`
- `infra/systemd/open-medical-scribe.service`

Minimum environment:

```bash
PORT=8787
SCRIBE_MODE=api
APP_ENV=production
PUBLIC_BASE_URL=https://scribe.eir.space
ENABLE_WEB_UI=false
TRANSCRIPTION_PROVIDER=berget
NOTE_PROVIDER=berget
BERGET_API_KEY=...
BERGET_TRANSCRIBE_MODEL=KBLab/kb-whisper-large
BERGET_NOTE_MODEL=openai/gpt-oss-120b
API_BEARER_TOKEN=replace-with-long-random-token
CLIENT_AUTH_STATE_FILE=/data/client-access.json
CLIENT_TRIAL_MAX_REQUESTS=20
CLIENT_TRIAL_MAX_AUDIO_SECONDS=1200
CLIENT_TRIAL_MAX_ESTIMATED_COST_USD=2.5
CLIENT_BOOTSTRAP_PER_IP_PER_HOUR=10
CLIENT_BOOTSTRAP_PER_INSTALL_PER_DAY=3
CLIENT_ESTIMATED_COST_PER_AUDIO_MINUTE_USD=0.08
CLIENT_REQUIRE_ATTESTATION=false
SETTINGS_FILE=/data/settings.json
ENABLE_SETTINGS_WRITE=false
MAX_REQUEST_BYTES=67108864
AUDIT_LOG_FILE=/data/audit.log
```

## Fly.io on `eir.space`

If you want the quickest production path, mirror the existing `egen_journal` Fly setup:

- dedicated Fly app for scribe traffic
- `primary_region = "arn"`
- custom domain such as `scribe.eir.space`
- one Fly volume mounted at `/data`

The repo now includes a ready starting point in [fly.toml](/Users/birger/Community/open-medical-scribe/fly.toml) and a deployment guide in [fly-deployment.md](/Users/birger/Community/open-medical-scribe/docs/fly-deployment.md).

## Reverse proxy

Terminate TLS in Caddy or your managed load balancer.

Requirements:

- HTTPS in production
- request body limit for audio uploads
- access logs
- restricted inbound ports

## iPhone app configuration

The default iPhone flow no longer needs a pasted backend token for ordinary trial use:

- set `Backend URL` to your HTTPS endpoint
- leave the operator token empty for normal users; the app will obtain a per-install client token automatically on first cloud use
- only use `Operator Backend Token (advanced)` for internal testing or operator-managed clients
- leave `Use your own Berget API key` off unless you explicitly want direct client-to-Berget traffic

## Before going live

- add server-side monitoring and alerts
- rotate API keys and bearer tokens through a secrets manager
- document your retention policy for transcripts, notes, and audit logs
- verify Swedish legal and procurement requirements for patient data handling
