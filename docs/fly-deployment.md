# Eir Scribe Fly Deployment

This backend is ready to run as a dedicated Fly.io app in the Stockholm region, following the same operating pattern as the existing `egen_journal` production services on `eir.space`.

## Recommended shape

- dedicated Fly app: `eir-scribe-backend`
- region: `arn`
- public hostname: `scribe.eir.space`
- runtime mode: `SCRIBE_MODE=api`
- providers: `TRANSCRIPTION_PROVIDER=berget`, `NOTE_PROVIDER=berget`
- one persistent volume mounted at `/data` for audit logs and optional settings state

The repo already includes a deployable [fly.toml](/Users/birger/Community/open-medical-scribe/fly.toml).

## Why a separate Fly app

- audio uploads and note drafting have different traffic patterns than the rest of Eir
- PHI-bearing request logs and audit logs need tighter separation
- scaling, timeouts, and request size limits are scribe-specific
- an incident in another Eir backend should not degrade live transcription traffic

## First deploy

```bash
cd /Users/birger/Community/open-medical-scribe

fly launch --no-deploy --copy-config --name eir-scribe-backend --region arn
fly volumes create scribe_data --region arn --size 1
fly secrets set \
  API_BEARER_TOKEN=replace-with-a-long-random-token \
  BERGET_API_KEY=replace-with-your-berget-key
fly deploy
```

## DNS and TLS

After the Fly app is reachable, bind the production hostname:

```bash
fly certs add scribe.eir.space
```

Then point DNS for `scribe.eir.space` to the Fly target the same way the existing `eir.space` services are managed.

## App configuration

The iPhone release build should point at:

- backend URL: `https://scribe.eir.space`
- bearer token: same value as `API_BEARER_TOKEN`

If you later want to expose the service under another `eir.space` subdomain, update:

- [fly.toml](/Users/birger/Community/open-medical-scribe/fly.toml)
- [project.yml](/Users/birger/Community/open-medical-scribe/native/OpenMedicalScribeApple/project.yml)

## Operational defaults

- web UI disabled in production
- runtime settings writes disabled
- audit log written to `/data/audit.log`
- health endpoint at `/health`
- request size limit `64 MB`

## Notes

- Fly volumes keep this service single-region and effectively single-machine unless you move logs/settings elsewhere.
- If you later add background jobs, diarization sidecars, or queue-backed processing, keep them as separate Fly processes or separate apps rather than combining them into the request-serving machine.
