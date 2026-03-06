# Open Medical Scribe Apple

Xcode project for Apple platforms using a shared SwiftUI client with both backend and on-device inference modes.

## Platforms

- macOS: can launch the local Node backend from this repository and use local `whisper-onnx` plus Ollama `qwen3.5:4b`
- iPhone/iPad: can run standalone with local `WhisperKit` transcription and an MLX-compatible Qwen model such as `mlx-community/Qwen3.5-4B-4bit`
- If you enter the upstream Hugging Face model ID `Qwen/Qwen3.5-4B`, the app resolves it to the Apple-compatible MLX variant automatically
- iPhone/iPad fallback: if the MLX Qwen path is unavailable, the app can fall back to Apple's on-device Foundation Models runtime when supported, or to a transcript-based offline draft template
- iPhone/iPad backend mode: still available if you want to point the app at a reachable Open Medical Scribe server

## Generate The Project

```bash
cd native/OpenMedicalScribeApple
xcodegen generate
```

This creates `OpenMedicalScribeApple.xcodeproj`.

## Build For iPhone Simulator

```bash
xcodebuild \
  -project OpenMedicalScribeApple.xcodeproj \
  -scheme OpenMedicalScribeiOS \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  build
```

## Build For macOS

```bash
xcodebuild \
  -project OpenMedicalScribeApple.xcodeproj \
  -scheme OpenMedicalScribeMac \
  build
```

## iPhone Usage

1. Launch the app and leave `Execution Mode` on `On Device`
2. Keep the default `Whisper Model` or switch to a smaller multilingual WhisperKit model if memory is tight
3. Keep the default `Qwen / MLX Model` of `mlx-community/Qwen3.5-4B-4bit`, enter `Qwen/Qwen3.5-4B` and let the app resolve it, or swap to another Apple-compatible MLX conversion
4. Tap `Prepare On-Device`
5. Import an audio file and run the scribe request

The first run can take time because the app may download and compile the local models for the device or simulator.

## Remote Backend Mode

If you do not want to run the local iPhone stack:

1. Switch `Execution Mode` to `Remote Backend`
2. Start the backend on your Mac or another trusted machine
3. Enter the backend URL in the app
4. Tap `Connect Backend`
5. Import an audio file and run the scribe request
