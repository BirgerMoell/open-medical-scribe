# Eir Scribe App Store Readiness

## Repo-side fixes already implemented

- first-use privacy and clinical-safety notice on iPhone
- in-app privacy policy sheet, with room for a hosted privacy-policy URL at release time
- explicit local-model download warning before the multi-GB on-device path
- no shipped private LAN backend default in the iPhone build
- HTTPS enforcement for non-local cloud backends
- optional backend bearer token support in the iPhone app
- export now degrades gracefully instead of failing all-or-nothing
- branded app icon asset catalog for iPhone and macOS
- app-level privacy manifest for required-reason API disclosure

## Still required outside the repo

- publish `docs/privacy-policy.html` and `docs/support.html`, then add those URLs in App Store Connect and the release build settings
- complete the App Privacy questionnaire for audio, transcript, note, and optional cloud processing data
- adapt `docs/app-review-notes.md` into the final reviewer note that explains local versus cloud processing
- verify your legal basis and patient-consent workflow for recordings
- verify your production hosting, DPA, retention, and incident-response process

## Product positioning

This app should be presented as clinician-assistive drafting software, not as autonomous medical decision support.
