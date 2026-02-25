"""
Speaker diarization sidecar using pyannote/speaker-diarization-3.1.

Usage:
    pip install -r requirements.txt
    export HF_TOKEN=your_huggingface_token
    uvicorn server:app --port 8786

The pyannote model requires accepting the license at:
    https://huggingface.co/pyannote/speaker-diarization-3.1
"""

import io
import os
import tempfile

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

app = FastAPI(title="pyannote diarization sidecar")

# Lazy-load pipeline on first request to avoid slow startup
_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    from pyannote.audio import Pipeline

    hf_token = os.environ.get("HF_TOKEN", "")
    if not hf_token:
        raise RuntimeError(
            "HF_TOKEN environment variable is required. "
            "Get a token at https://huggingface.co/settings/tokens "
            "and accept the pyannote model license at "
            "https://huggingface.co/pyannote/speaker-diarization-3.1"
        )

    _pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=hf_token,
    )
    return _pipeline


@app.get("/health")
async def health():
    return {"ok": True, "service": "pyannote-diarization-sidecar"}


@app.post("/diarize")
async def diarize(request: Request):
    """
    Accept a WAV file as binary body, run speaker diarization,
    return JSON segments with speaker labels and timestamps.
    """
    body = await request.body()
    if not body:
        return JSONResponse(
            status_code=400, content={"error": "Empty request body. Send WAV audio."}
        )

    try:
        pipeline = get_pipeline()
    except RuntimeError as e:
        return JSONResponse(status_code=503, content={"error": str(e)})

    # Write WAV to temp file (pyannote requires file path)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(body)
        tmp_path = tmp.name

    try:
        diarization = pipeline(tmp_path)

        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append(
                {
                    "speaker": speaker,
                    "start": round(turn.start, 3),
                    "end": round(turn.end, 3),
                    "duration": round(turn.end - turn.start, 3),
                }
            )

        # Map speaker labels to sequential integers
        speaker_map = {}
        for seg in segments:
            if seg["speaker"] not in speaker_map:
                speaker_map[seg["speaker"]] = len(speaker_map)
            seg["speakerIndex"] = speaker_map[seg["speaker"]]

        return {
            "segments": segments,
            "speakerCount": len(speaker_map),
            "speakers": [
                {"label": label, "index": idx} for label, idx in speaker_map.items()
            ],
        }

    finally:
        os.unlink(tmp_path)
