import librosa
import numpy as np
import io
import os
import soundfile as sf
from transformers import pipeline
from google import genai
from dotenv import load_dotenv

# Load environment variables (like GEMINI_API_KEY)
load_dotenv()

class StressAnalyzer:
    def __init__(self):
        print("🧠 Loading Hugging Face Emotion Model... (This might take a minute on first run)")
        # We use a fast DistilRoBERTa model fine-tuned on emotion detection
        self.emotion_classifier = pipeline(
            "text-classification", 
            model="j-hartmann/emotion-english-distilroberta-base", 
            top_k=None # Newer transformers require top_k=None instead of return_all_scores
        )

        # Initialize Gemini for highly human-like remedy generation
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.client = None
        if self.gemini_key:
            try:
                self.client = genai.Client(api_key=self.gemini_key)
            except Exception as e:
                print("Failed to initialize new Gemini Client:", e)

    def analyze_audio(self, audio_bytes: bytes):
        try:
            # Read audio from bytes
            y, sr = sf.read(io.BytesIO(audio_bytes))
            if len(y.shape) > 1: y = y[:, 0] # mono
            
            # 1. Pitch (Fundamental Frequency proxy)
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
            pitch_mean = np.mean(pitches[pitches > 0]) if np.any(pitches > 0) else 0

            # 2. "Shivers" (Jitter/Tremor proxy) -> High zero crossing rate
            zcr = np.mean(librosa.feature.zero_crossing_rate(y))
            
            # 3. Tone/Energy (RMS)
            rms = np.mean(librosa.feature.rms(y=y))

            # Audio SVI adjustment
            # High pitch variance or high ZCR (shivers) indicate vocal stress
            audio_stress = 0
            if zcr > 0.1: audio_stress += 1.5
            if rms > 0.1: audio_stress += 1.0
            
            return {
                "pitch_hz": round(float(pitch_mean), 2),
                "shiver_zcr": round(float(zcr), 4),
                "energy": round(float(rms), 4),
                "audio_svi_penalty": audio_stress
            }
        except Exception as e:
            print("Audio processing error:", str(e))
            return None

    def generate_remedy(self, text: str, emotion: str, risk_level: str, history: list = None) -> str:
        # Try to use Gemini for ultra human-like response
        if self.client:
            try:
                # Format history for the prompt
                history_str = ""
                if history:
                    for msg in history:
                        sender = "Victim" if msg.get("sender") == "user" else "You (AI Counselor)"
                        history_str += f"{sender}: {msg.get('text')}\n"

                prompt = f"""
                You are a highly empathetic, human crisis counselor. You are currently in a live chat with a victim.
                
                Recent Chat History:
                {history_str}
                
                Victim's new message: "{text}"
                Our NLP engine detected their primary emotion is {emotion} and their overall risk level is {risk_level}.
                
                Respond directly to the victim's new message in 1 to 3 short sentences. 
                CRITICAL INSTRUCTIONS:
                - Do NOT repeat yourself. Look at the chat history and make sure your response flows naturally as a continuation of the conversation.
                - Do NOT start every message with "I'm sorry" or "I hear you".
                - Provide specific, actionable, and varied advice based on their current situation.
                - If the risk is HIGH or CRITICAL, reassure them that responders are actively monitoring this channel.
                - Speak naturally like a real human.
                """
                response = self.client.models.generate_content(
                    model='gemini-3.6-flash',
                    contents=prompt
                )
                return response.text.replace('*', '').strip() # Clean markdown formatting
            except Exception as e:
                print("Gemini generation failed, falling back to heuristic:", e)

        # Fallback Heuristic if Gemini is not configured or fails
        text_lower = text.lower()
        
        # 1. Detect Specific Situational Keywords
        is_fire = any(word in text_lower for word in ["fire", "smoke", "burning", "flame"])
        is_flood = any(word in text_lower for word in ["water", "flood", "drowning", "trapped in car", "storm"])
        is_violence = any(word in text_lower for word in ["gun", "shoot", "attack", "knife", "hiding", "intruder", "assault"])
        is_medical = any(word in text_lower for word in ["bleeding", "heart", "breathe", "chest pain", "unconscious"])
        is_sh_suicide = any(word in text_lower for word in ["suicide", "kill myself", "end it", "die", "pointless"])

        # 2. Build the Dynamic Response
        response = ""

        # Step A: Empathy & Emotion Acknowledgement
        if emotion == "fear":
            response += "I can hear how terrifying this situation is for you. "
        elif emotion == "anger":
            response += "It is completely understandable to feel overwhelmed and frustrated right now. "
        elif emotion == "sadness":
            response += "I hear the pain in your words, and I'm so sorry you're facing this. "
        else:
            response += "I am actively monitoring your situation. "

        # Step B: Immediate Actionable Advice based on Situation
        if is_fire:
            response += "If there is smoke, get as low to the ground as possible. Cover your nose and mouth with a cloth, preferably damp. Do not open doors if the handle is warm. "
        elif is_flood:
            response += "Please move to the highest ground possible immediately. Do not attempt to walk, swim, or drive through moving water. "
        elif is_violence:
            response += "Your absolute priority is hiding. Find a secure room, lock or heavy-barricade the door, silence your phone completely, and stay out of sight. "
        elif is_medical:
            response += "Try to stay as still as possible. If there is severe bleeding, apply firm, direct pressure with a clean cloth. Keep taking slow, steady breaths. "
        elif is_sh_suicide:
            response += "Please stay with me. Your life has immense value, even when the pain feels unbearable. I have notified a crisis responder. "
        else:
            # Psychological Grounding for generalized high stress
            if risk_level in ["CRITICAL", "HIGH"]:
                response += "Let's do a quick grounding exercise to help stabilize your nervous system. Look around the room and name 3 things you can see, 2 things you can touch, and 1 thing you can hear. "
            else:
                response += "Try to take a deep breath in through your nose for 4 seconds, hold it for 4 seconds, and exhale slowly through your mouth. "

        # Step C: Closing Action based on Index Level
        if risk_level == "CRITICAL":
            response += "I have flagged your exact status to the emergency command center. Responders have been alerted."
        elif risk_level == "HIGH":
            response += "I am keeping your profile actively highlighted for our responders. Please keep talking to me if it helps."
        else:
            response += "You are in a safe space. Take it one step at a time."

        return response

    def calculate_text_svi(self, text: str) -> dict:
        """
        Analyzes text and returns an SVI (Stress Vulnerability Index) from 0.0 to 10.0
        """
        if not text:
            return {"svi": 0.0, "risk_level": "LOW", "emotions": []}

        # Get emotion scores from the AI
        raw_results = self.emotion_classifier(text)
        
        # Depending on transformers version, it might return a list of lists or just a list
        results = raw_results[0] if isinstance(raw_results[0], list) else raw_results
        
        # Sort emotions by highest score
        emotions = sorted(results, key=lambda x: x['score'], reverse=True)
        
        # SVI Weighting System (0 to 1 scale)
        # Fear, Sadness, and Anger contribute heavily to trauma/stress SVI
        weights = {
            "fear": 1.0,
            "sadness": 0.8,
            "anger": 0.7,
            "disgust": 0.5,
            "surprise": 0.4,
            "neutral": 0.1,
            "joy": 0.0
        }

        # Calculate weighted stress score (out of 10.0)
        total_stress = sum([score_dict['score'] * weights.get(score_dict['label'], 0) for score_dict in emotions])
        svi_score = total_stress * 10

        # --- CRITICAL HEURISTIC OVERRIDE ---
        # AI emotion models often fail to classify purely situational statements 
        # (e.g. "someone has a gun") as fear. We use keyword boosting to fix accuracy.
        text_lower = text.lower()
        emergency_keywords = [
            "fire", "smoke", "burning", "gun", "shoot", "knife", "hiding", "intruder", 
            "assault", "suicide", "kill myself", "die", "bleeding", "heart attack", 
            "breathe", "drowning", "trapped", "help", "emergency"
        ]
        
        matches = [word for word in emergency_keywords if word in text_lower]
        if matches:
            # Boost the score by 2.0 for every emergency word detected
            svi_score += len(matches) * 2.0
            
            # Extreme Lethality Overrides (Force CRITICAL)
            lethal_words = ["gun", "suicide", "kill myself", "intruder", "fire", "heart attack"]
            if any(word in text_lower for word in lethal_words):
                svi_score = max(svi_score, 9.5)

        # Cap the max score at 10.0
        svi_score = min(round(svi_score, 2), 10.0)

        # Categorize Risk Level
        risk_level = "LOW"
        if svi_score >= 8.0:
            risk_level = "CRITICAL"
        elif svi_score >= 5.5:
            risk_level = "HIGH"
        elif svi_score >= 3.5:
            risk_level = "MODERATE"

        return {
            "svi_score": svi_score,
            "risk_level": risk_level,
            "top_emotion": emotions[0]['label'],
            "all_emotions": emotions
        }

# Initialize the analyzer globally so it only loads into RAM once when the server starts
analyzer = StressAnalyzer()