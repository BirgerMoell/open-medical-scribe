#!/usr/bin/env bash
# Local transcription script for open-medical-scribe.
# Reads audio from stdin, writes transcript to stdout.
# Uses openai-whisper (pip package) with the "base" model.

set -euo pipefail

TMPFILE=$(mktemp /tmp/scribe-audio-XXXXXX)

# Detect extension from AUDIO_MIME_TYPE env var
case "${AUDIO_MIME_TYPE:-audio/wav}" in
  *mp3*|*mpeg*) EXT=".mp3" ;;
  *mp4*|*m4a*)  EXT=".m4a" ;;
  *ogg*)        EXT=".ogg" ;;
  *flac*)       EXT=".flac" ;;
  *)            EXT=".wav" ;;
esac

mv "$TMPFILE" "${TMPFILE}${EXT}"
TMPFILE="${TMPFILE}${EXT}"
trap 'rm -f "$TMPFILE"' EXIT

cat > "$TMPFILE"

python3 -c "
import sys, warnings
warnings.filterwarnings('ignore')
import whisper
model = whisper.load_model('base')
result = model.transcribe('$TMPFILE', language='sv')
print(result['text'].strip())
"
