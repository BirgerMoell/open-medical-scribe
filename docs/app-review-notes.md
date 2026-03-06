# Eir Scribe App Review Notes Template

Use this as the starting point for the `Notes for Review` field in App Store Connect.

## Suggested reviewer note

`Eir Scribe is a clinician-assistive medical documentation app. It records a clinical conversation, produces a transcript, and drafts a note for clinician review. It is not intended for autonomous diagnosis or treatment.`

`The app supports two paths:`

- `Cloud`: uploads audio and generated text to the configured backend, or directly to Berget if the user opts in to a personal API key.
- `Local on iPhone`: downloads on-device Whisper and Qwen models, then runs transcription and note drafting locally on the device.

`Please review using a test account or test backend that you control. If you want to avoid any network dependency, use the local-on-iPhone path after the initial model download.`

`The first-run privacy notice and in-app privacy policy explain that generated notes require clinician review before use in patient care.`
