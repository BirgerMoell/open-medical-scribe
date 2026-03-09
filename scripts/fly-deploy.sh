#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${FLY_APP_NAME:-eir-scribe-backend}"
REGION="${FLY_REGION:-arn}"
VOLUME_NAME="${FLY_VOLUME_NAME:-scribe_data}"
DOMAIN_NAME="${EIR_SCRIBE_DOMAIN:-scribe.eir.space}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_command fly

require_env BERGET_API_KEY
require_env API_BEARER_TOKEN

echo "Deploying ${APP_NAME} to Fly region ${REGION}"

if ! fly status --app "${APP_NAME}" >/dev/null 2>&1; then
  echo "Fly app ${APP_NAME} does not exist yet. Creating it."
  fly apps create "${APP_NAME}"
fi

if ! fly volumes list --app "${APP_NAME}" | awk 'NR>1 {print $1}' | grep -qx "${VOLUME_NAME}"; then
  echo "Creating Fly volume ${VOLUME_NAME} in ${REGION}"
  fly volumes create "${VOLUME_NAME}" --app "${APP_NAME}" --region "${REGION}" --size 1
else
  echo "Fly volume ${VOLUME_NAME} already exists"
fi

echo "Setting secrets"
fly secrets set \
  --app "${APP_NAME}" \
  BERGET_API_KEY="${BERGET_API_KEY}" \
  API_BEARER_TOKEN="${API_BEARER_TOKEN}"

echo "Deploying application"
fly deploy \
  --app "${APP_NAME}" \
  --config fly.toml \
  --remote-only

cat <<EOF

Deployment finished.

Next steps:
1. Bind TLS: fly certs add ${DOMAIN_NAME} --app ${APP_NAME}
2. Point DNS for ${DOMAIN_NAME} to the Fly target for ${APP_NAME}
3. Verify health: curl https://${DOMAIN_NAME}/health

EOF
