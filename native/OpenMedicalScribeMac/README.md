# Open Medical Scribe Mac

Native macOS SwiftUI client for running Open Medical Scribe with local backend orchestration, plus the shared Apple-platform UI used by the standalone iPhone build.

## What it does

- launches the local Node backend from this repository
- configures `whisper-onnx` for transcription
- configures Ollama with `qwen3.5:4b` for note generation
- shares the same SwiftUI shell used by the iPhone app, which can instead run `WhisperKit` plus MLX Qwen locally on-device
- runs the bundled Swedish sample audio or imported audio files
- displays transcript and note output in a native macOS window

## Prerequisites

- macOS 14+
- Xcode command line tools
- Node.js 22+
- `ffmpeg` in `PATH`
- Ollama running locally with `qwen3.5:4b` installed

## Build

```bash
cd native/OpenMedicalScribeMac
swift build
```

## Run

```bash
cd native/OpenMedicalScribeMac
swift run
```

When the app opens:

1. Click `Start Local Stack`
2. Click `Run Swedish Sample` or `Import Audio`
3. Review the transcript and draft note

The app assumes this repository layout and defaults the repository path automatically. If you move the app files elsewhere, update the `Repository` field in the UI before starting the stack.
