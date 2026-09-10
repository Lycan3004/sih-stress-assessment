# 🧠 AI Microservice — Stress & Acoustic Analysis Engine

FastAPI microservice handling multi-modal trauma assessment, combining Natural Language Processing (NLP) emotion detection, acoustic voice stress analysis, heuristic safety overrides, and Google Gemini crisis counseling.

---

## 🚀 Features

- **🗣️ Multi-Modal SVI Computation**:
  - **Text Emotion Classification**: Evaluates input transcripts across 7 emotions (`fear`, `sadness`, `anger`, `disgust`, `surprise`, `neutral`, `joy`).
  - **Acoustic Audio Analysis**: Uses `librosa` & `soundfile` on raw `.wav` audio to measure:
    - Pitch / Fundamental Frequency (`pitches`)
    - Vocal Tremor / Jitter proxy via Zero Crossing Rate (`zcr`)
    - Voice Energy / Tension via Root Mean Square (`rms`)
  - **Stress Vulnerability Index (SVI)**: Computes a unified distress metric from `0.0` to `10.0`.
- **🛡️ Heuristic Safety Overrides**:
  - Automatically identifies extreme-lethality terms (e.g. *gun, fire, suicide, intruder, bleeding*) and elevates scores to `CRITICAL` ($\ge 9.5$) to bypass NLP model latency or false negatives.
- **💬 Empathetic Crisis Counseling**:
  - Generates context-aware survival remedies using Google Gemini 3.6 Flash (`gemini-3.6-flash`).
  - Built-in heuristic crisis fallback for fire, flood, active violence, and 3-2-1 grounding exercises if API keys are not supplied.

---

## 🛠️ API Endpoints

### `GET /health`
Returns readiness status:
```json
{
  "status": "OK",
  "message": "AI Microservice is running!"
}
```

### `POST /api/analyze`
Accepts `multipart/form-data`:
- `text`: string (required or optional with audio)
- `history`: JSON array string of previous chat turns (e.g. `[{"sender":"user","text":"..."}]`)
- `audio`: binary `.wav` file (optional)

Returns:
```json
{
  "status": "SUCCESS",
  "input_text": "...",
  "analysis": {
    "svi_score": 10.0,
    "risk_level": "CRITICAL",
    "top_emotion": "fear",
    "all_emotions": [...],
    "audio_metrics": { ... },
    "remedy": "..."
  }
}
```

---

## ⚙️ Environment Variables

Create `.env` in `ai-microservice/`:
```env
GEMINI_API_KEY="your_google_gemini_api_key"
```

---

## 🏃 Getting Started

```bash
# Activate virtual environment
.\venv\Scripts\activate  # Windows
# or source venv/bin/activate  # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Run service
python main.py
# Runs on http://localhost:8000
```
