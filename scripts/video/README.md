# Demo video

Made entirely with open-source tools:

- **Playwright** drives the real app and records it (`record.mjs`), with a visible cursor and scene markers.
- **Piper** (github.com/rhasspy/piper, voice `en_US-ryan-high`) reads `script.json`.
- **ffmpeg** fits each scene to its narration and mixes it (`assemble.py`).

```bash
uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python piper-tts
# download en_US-ryan-high.onnx(+.json) from huggingface.co/rhasspy/piper-voices into voice/
node record.mjs && python3 assemble.py
```
