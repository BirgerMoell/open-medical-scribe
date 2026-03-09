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

In the app Settings:

- set `Backend URL` to your HTTPS endpoint
- set `Backend API Token` to the same bearer token configured on the server
- leave `Use your own Berget API key` off unless you explicitly want direct client-to-Berget traffic

## Before going live

- add server-side monitoring and alerts
- rotate API keys and bearer tokens through a secrets manager
- document your retention policy for transcripts, notes, and audit logs
- verify Swedish legal and procurement requirements for patient data handling
