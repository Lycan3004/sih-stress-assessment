from fastapi import FastAPI, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uvicorn
from ml.stress_analyzer import analyzer

app = FastAPI(title="SIH Stress Assessment AI Microservice")

# Allow React frontend to communicate with this AI Microservice
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "OK", "message": "AI Microservice is running!"}

@app.post("/api/transcribe")
async def transcribe_audio_endpoint(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    audio_bytes = await audio.read()
    mime = audio.content_type or "audio/wav"
    result = analyzer.transcribe_audio(audio_bytes, mime_type=mime, language_hint=language)
    return result

@app.post("/api/analyze")
async def analyze_stress(
    text: str = Form(""),
    history: str = Form("[]"),
    audio: Optional[UploadFile] = File(None),
    language: Optional[str] = Form(None)
):
    audio_bytes = None
    if audio:
        audio_bytes = await audio.read()

    # If text input was empty but audio was provided, auto-transcribe speech
    if not text.strip() and audio_bytes:
        transcription = analyzer.transcribe_audio(
            audio_bytes,
            mime_type=audio.content_type or "audio/wav",
            language_hint=language
        )
        if transcription.get("transcript"):
            text = transcription["transcript"]

    # Process Text
    text_analysis = analyzer.calculate_text_svi(text)
    
    # Process Audio (if provided)
    audio_analysis = None
    if audio_bytes:
        audio_analysis = analyzer.analyze_audio(audio_bytes)
        
    turn_score = text_analysis['svi_score']
    if audio_analysis and audio_analysis.get('audio_svi_penalty'):
        turn_score = min(10.0, round(turn_score + audio_analysis['audio_svi_penalty'], 2))

    # Parse History
    import json
    try:
        parsed_history = json.loads(history)
    except:
        parsed_history = []

    # Compute Cumulative Longitudinal SVI & Clinical Metrics
    cumul = analyzer.compute_cumulative_svi(
        current_turn_score=turn_score,
        history=parsed_history,
        has_audio=bool(audio_analysis),
        text=text
    )

    # Generate Human Therapist Response with explicit language awareness
    remedy = analyzer.generate_remedy(
        text=text,
        emotion=text_analysis['top_emotion'],
        risk_level=cumul['risk_level'],
        history=parsed_history,
        message_count=cumul['session_turns'],
        cumulative_svi=cumul['cumulative_svi'],
        language=language
    )

    return {
        "status": "SUCCESS",
        "input_text": text,
        "analysis": {
            "svi_score": cumul['cumulative_svi'],
            "turn_svi": turn_score,
            "cumulative_svi": cumul['cumulative_svi'],
            "confidence_percent": cumul['confidence_percent'],
            "therapeutic_phase": cumul['therapeutic_phase'],
            "trend": cumul['trend'],
            "session_turns": cumul['session_turns'],
            "risk_level": cumul['risk_level'],
            "top_emotion": text_analysis['top_emotion'],
            "all_emotions": text_analysis['all_emotions'],
            "audio_metrics": audio_analysis,
            "remedy": remedy
        }
    }

@app.post("/api/final-report")
async def generate_final_report_endpoint(
    history: str = Form("[]"),
    audio_metrics_json: str = Form("[]")
):
    import json
    try:
        parsed_history = json.loads(history)
    except:
        parsed_history = []
    try:
        parsed_audio = json.loads(audio_metrics_json)
    except:
        parsed_audio = []

    user_msgs = [m for m in parsed_history if m.get("sender") == "user"]
    if not user_msgs:
        return {"status": "ERROR", "message": "No conversational history found"}

    # Extract the latest cumulative score or compute it
    latest_scores = [float(m.get("score")) for m in parsed_history if m.get("sender") == "system" and m.get("score") is not None]
    current_score = latest_scores[-1] if latest_scores else 5.0

    cumul = analyzer.compute_cumulative_svi(
        current_turn_score=current_score,
        history=parsed_history[:-1] if parsed_history else [],
        has_audio=bool(parsed_audio),
        text=user_msgs[-1].get("text", "")
    )

    report = analyzer.generate_final_report(
        history=parsed_history,
        cumulative_svi=cumul['cumulative_svi'],
        confidence_percent=cumul['confidence_percent'],
        risk_level=cumul['risk_level'],
        dominant_emotions=[],
        audio_metrics_list=parsed_audio
    )

    return {
        "status": "SUCCESS",
        "report": report
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)