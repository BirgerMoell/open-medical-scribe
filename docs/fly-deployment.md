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

The repo includes a helper script in [fly-deploy.sh](/Users/birger/Community/open-medical-scribe/scripts/fly-deploy.sh).

```bash
cd /Users/birger/Community/open-medical-scribe

export BERGET_API_KEY=replace-with-your-berget-key
export API_BEARER_TOKEN=replace-with-a-long-random-token
export CLIENT_AUTH_STATE_FILE=/data/client-access.json
export CLIENT_TRIAL_MAX_REQUESTS=20
export CLIENT_TRIAL_MAX_AUDIO_SECONDS=1200
export CLIENT_TRIAL_MAX_ESTIMATED_COST_USD=2.5
export CLIENT_BOOTSTRAP_PER_IP_PER_HOUR=10
export CLIENT_BOOTSTRAP_PER_INSTALL_PER_DAY=3
export CLIENT_ESTIMATED_COST_PER_AUDIO_MINUTE_USD=0.08
export CLIENT_REQUIRE_ATTESTATION=false

npm run deploy:fly
```

If you want to override the defaults, the script accepts:

```bash
FLY_APP_NAME=eir-scribe-backend \
FLY_REGION=arn \
FLY_VOLUME_NAME=scribe_data \
EIR_SCRIBE_DOMAIN=scribe.eir.space \
npm run deploy:fly
```

## DNS and TLS

After the Fly app is reachable, bind the production hostname:

```bash
fly certs add scribe.eir.space --app eir-scribe-backend
```

Then point DNS for `scribe.eir.space` to the Fly target the same way the existing `eir.space` services are managed.

## App configuration

The iPhone release build should point at:

- backend URL: `https://scribe.eir.space`
- ordinary users do not need the operator bearer token; the app bootstraps a per-install trial token automatically via `POST /v1/client/bootstrap`
- keep `API_BEARER_TOKEN` private for operator tooling and protected backend routes

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
