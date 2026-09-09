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

@app.post("/api/analyze")
async def analyze_stress(
    text: str = Form(""),
    history: str = Form("[]"),
    audio: Optional[UploadFile] = File(None)
):
    # Process Text
    text_analysis = analyzer.calculate_text_svi(text)
    
    # Process Audio (if provided)
    audio_analysis = None
    if audio:
        audio_bytes = await audio.read()
        audio_analysis = analyzer.analyze_audio(audio_bytes)
        
        if audio_analysis:
            # Combine text and audio scores
            new_score = min(10.0, text_analysis['svi_score'] + audio_analysis['audio_svi_penalty'])
            text_analysis['svi_score'] = round(new_score, 2)
            
            # Recalculate Risk Level
            if new_score >= 8.5: text_analysis['risk_level'] = "CRITICAL"
            elif new_score >= 6.0: text_analysis['risk_level'] = "HIGH"
            elif new_score >= 4.0: text_analysis['risk_level'] = "MODERATE"
            else: text_analysis['risk_level'] = "LOW"

    # Generate Remedy Response
    import json
    try:
        parsed_history = json.loads(history)
    except:
        parsed_history = []
        
    remedy = analyzer.generate_remedy(text, text_analysis['top_emotion'], text_analysis['risk_level'], parsed_history)

    return {
        "status": "SUCCESS",
        "input_text": text,
        "analysis": {
            "svi_score": text_analysis['svi_score'],
            "risk_level": text_analysis['risk_level'],
            "top_emotion": text_analysis['top_emotion'],
            "all_emotions": text_analysis['all_emotions'],
            "audio_metrics": audio_analysis,
            "remedy": remedy
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)