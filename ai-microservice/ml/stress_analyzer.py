import io
import os
import random
import re
import wave
from typing import Dict, List, Optional, Tuple

import librosa
import numpy as np
import soundfile as sf
from dotenv import load_dotenv
from google import genai
# from transformers import pipeline (lazy imported in _ensure_classifier / _ensure_asr)

# Load environment variables
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(override=True)


class StressAnalyzer:
    def __init__(self):
        self.emotion_classifier = None
        self.asr_pipeline = None
        self.local_llm_pipeline = None
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.client = None
        self._ensure_gemini_client()

    def _ensure_gemini_client(self):
        """Ensure Gemini client is initialized with latest key."""
        if not self.gemini_key:
            self.gemini_key = os.getenv("GEMINI_API_KEY")
        if self.gemini_key and not self.client:
            try:
                self.client = genai.Client(api_key=self.gemini_key)
                print("[AI] Gemini Client initialized successfully.")
            except Exception as e:
                print("[AI] Failed to initialize Gemini Client:", e)

    def _ensure_classifier(self):
        """Lazy load Hugging Face emotion classification pipeline."""
        if self.emotion_classifier is None:
            try:
                print("[AI] Loading Hugging Face Emotion Model (j-hartmann/emotion-english-distilroberta-base)...")
                from transformers import pipeline
                self.emotion_classifier = pipeline(
                    "text-classification",
                    model="j-hartmann/emotion-english-distilroberta-base",
                    top_k=None,
                )
            except Exception as e:
                print("[AI] Could not load Hugging Face Emotion Model (fallback active):", e)
                self.emotion_classifier = None

    def _ensure_local_llm(self):
        """Lazy load Hugging Face local conversational LLM pipeline (offline fallback only)."""
        if self.local_llm_pipeline is None:
            try:
                import torch
                print("[AI] Initializing local Conversational LLM (TinyLlama-1.1B — offline fallback)...")
                from transformers import pipeline
                self.local_llm_pipeline = pipeline(
                    "text-generation",
                    model="TinyLlama/TinyLlama-1.1B-Chat-v1.0",
                    device_map="auto",
                )
                print("[AI] Local LLM (TinyLlama) initialized as offline fallback.")
            except Exception as e:
                print("[AI] Could not initialize local LLM:", e)
                self.local_llm_pipeline = None

    def _ensure_asr(self):
        """Lazy load Hugging Face Whisper ASR pipeline for offline speech recognition."""
        if self.asr_pipeline is None:
            try:
                print("[AI] Initializing local Whisper ASR (openai/whisper-tiny)...")
                from transformers import pipeline
                self.asr_pipeline = pipeline(
                    "automatic-speech-recognition",
                    model="openai/whisper-tiny",
                )
                print("[AI] Whisper ASR initialized successfully.")
            except Exception as e:
                print("[AI] Could not initialize Whisper ASR (fallback active):", e)
                self.asr_pipeline = None

    def _decode_audio(self, audio_bytes: bytes) -> Tuple[Optional[np.ndarray], int]:
        """
        Robust multi-format audio decoder.
        Tries soundfile, scipy.io.wavfile, and standard wave library.
        """
        # Attempt 1: soundfile
        try:
            y, sr = sf.read(io.BytesIO(audio_bytes))
            if len(y.shape) > 1:
                y = y[:, 0]  # downmix to mono
            return y.astype(np.float32), sr
        except Exception as sf_err:
            pass

        # Attempt 2: scipy.io.wavfile
        try:
            from scipy.io import wavfile
            sr, data = wavfile.read(io.BytesIO(audio_bytes))
            if len(data.shape) > 1:
                data = data[:, 0]
            # Normalize to [-1.0, 1.0] float
            if data.dtype == np.int16:
                y = data.astype(np.float32) / 32768.0
            elif data.dtype == np.int32:
                y = data.astype(np.float32) / 2147483648.0
            elif data.dtype == np.uint8:
                y = (data.astype(np.float32) - 128.0) / 128.0
            else:
                y = data.astype(np.float32)
            return y, sr
        except Exception as scipy_err:
            pass

        # Attempt 3: standard wave module
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                sr = wf.getframerate()
                n_frames = wf.getnframes()
                channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                raw_data = wf.readframes(n_frames)

                if sampwidth == 2:
                    audio_data = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32) / 32768.0
                elif sampwidth == 4:
                    audio_data = np.frombuffer(raw_data, dtype=np.int32).astype(np.float32) / 2147483648.0
                else:
                    audio_data = np.frombuffer(raw_data, dtype=np.int8).astype(np.float32) / 128.0

                if channels > 1:
                    audio_data = audio_data[::channels]
                return audio_data, sr
        except Exception as wave_err:
            pass

        return None, 0

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/wav", language_hint: Optional[str] = None) -> Dict:
        """
        Multilingual speech-to-text transcriber supporting all languages (Hindi, English, Spanish, Bengali, etc.).
        Uses Gemini multimodal audio processing when available, or acoustic decoder fallback.
        """
        if not audio_bytes or len(audio_bytes) < 100:
            return {
                "status": "ERROR",
                "transcript": "",
                "detected_language": "Unknown",
                "message": "Audio sample is empty or too short."
            }

        # 1. Gemini Multimodal Audio Transcription
        if self.client:
            try:
                from google.genai import types
                clean_mime = "audio/wav"
                if "webm" in mime_type:
                    clean_mime = "audio/webm"
                elif "mp3" in mime_type:
                    clean_mime = "audio/mp3"
                elif "ogg" in mime_type:
                    clean_mime = "audio/ogg"

                audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=clean_mime)
                prompt = (
                    "You are an expert multilingual speech-to-text transcriber for crisis counseling.\n"
                    "Carefully transcribe all spoken words in this audio verbatim in the EXACT original language spoken.\n"
                    f"Language context: {language_hint or 'Auto-detect any spoken language (e.g. Hindi, English, Bengali, Tamil, Telugu, Marathi, Spanish, etc.)'}.\n\n"
                    "Respond with ONLY a raw JSON object (no markdown backticks):\n"
                    "{\n"
                    '  "transcript": "<verbatim transcribed text in original script>",\n'
                    '  "detected_language": "<language name, e.g. Hindi, English, Spanish>",\n'
                    '  "english_translation": "<English translation if not English, else same as transcript>"\n'
                    "}"
                )

                for m_name in ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash"]:
                    try:
                        resp = self.client.models.generate_content(
                            model=m_name,
                            contents=[audio_part, prompt]
                        )
                        if resp and resp.text:
                            import json
                            raw = resp.text.strip()
                            if raw.startswith("```"):
                                raw = raw.split("```")[1]
                                if raw.startswith("json"):
                                    raw = raw[4:]
                            data = json.loads(raw.strip())
                            return {
                                "status": "SUCCESS",
                                "transcript": data.get("transcript", "").strip(),
                                "detected_language": data.get("detected_language", "Auto"),
                                "english_translation": data.get("english_translation", "")
                            }
                    except Exception:
                        continue
            except Exception as e:
                print("[AI] Multimodal audio transcription error:", e)

        # 2. Local Whisper ASR Fallback (100% offline, multilingual)
        try:
            self._ensure_asr()
            if self.asr_pipeline:
                y, sr = self._decode_audio(audio_bytes)
                if y is not None and len(y) > 0:
                    generate_kwargs = {"task": "transcribe"}
                    # Map language hint (e.g., 'en-IN', 'hi-IN', 'es-ES') to Whisper language code
                    if language_hint:
                        clean_hint = language_hint.split('-')[0].lower()
                        supported_whisper = ["en", "hi", "es", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa", "ur", "fr", "de", "ar", "zh", "ja", "ru", "pt", "it", "ko", "tr", "id"]
                        if clean_hint in supported_whisper:
                            generate_kwargs["language"] = clean_hint

                    res = self.asr_pipeline({"sampling_rate": sr, "raw": y}, generate_kwargs=generate_kwargs)
                    if res and res.get("text"):
                        clean_text = res["text"].strip()
                        # Avoid returning silence hallucinations like "[BLANK_AUDIO]" or single punctuation
                        if clean_text and clean_text not in ["you", "Thank you.", ".", ""]:
                            return {
                                "status": "SUCCESS",
                                "transcript": clean_text,
                                "detected_language": language_hint or "Auto",
                                "audio_metrics": self.analyze_audio(audio_bytes),
                                "message": "Transcribed locally via Whisper ASR."
                            }
        except Exception as asr_err:
            print("[AI] Local Whisper ASR error:", asr_err)

        # 3. Acoustic Analysis Fallback
        acoustic = self.analyze_audio(audio_bytes)
        return {
            "status": "SUCCESS",
            "transcript": "",
            "detected_language": language_hint or "Auto",
            "audio_metrics": acoustic,
            "message": "Audio acoustic parameters analyzed directly."
        }

    def analyze_audio(self, audio_bytes: bytes) -> Optional[Dict]:
        """
        Performs acoustic physical feature analysis to detect vocal stress, tremor, and strain:
        1. Pitch (F0) & Pitch Instability
        2. Vocal Tremors (Zero Crossing Rate / Jitter proxy)
        3. Vocal Energy (RMS / Volume strain)
        4. Spectral Centroid (Vocal sharpness/tension)
        """
        if not audio_bytes or len(audio_bytes) < 100:
            return None

        try:
            y, sr = self._decode_audio(audio_bytes)
            if y is None or len(y) < sr * 0.2:  # Need at least 200ms
                return None

            # Remove silence / trim edges
            y_trimmed, _ = librosa.effects.trim(y, top_db=25)
            if len(y_trimmed) < sr * 0.1:
                y_trimmed = y

            # 1. Pitch extraction using piptrack
            pitches, magnitudes = librosa.piptrack(y=y_trimmed, sr=sr)
            voiced = pitches[pitches > 40]
            if len(voiced) > 0:
                pitch_mean = float(np.mean(voiced))
                pitch_std = float(np.std(voiced))
            else:
                pitch_mean = 0.0
                pitch_std = 0.0

            # 2. Vocal Tremor / Shiver (Zero Crossing Rate)
            zcr_vals = librosa.feature.zero_crossing_rate(y_trimmed)[0]
            zcr_mean = float(np.mean(zcr_vals))
            zcr_std = float(np.std(zcr_vals))

            # 3. Energy / Vocal Strain (RMS)
            rms_vals = librosa.feature.rms(y=y_trimmed)[0]
            rms_mean = float(np.mean(rms_vals))
            rms_std = float(np.std(rms_vals))

            # 4. Spectral Centroid (Vocal Brightness / Tight Throat)
            cent_vals = librosa.feature.spectral_centroid(y=y_trimmed, sr=sr)[0]
            centroid_mean = float(np.mean(cent_vals))

            # Acoustic stress penalty calculation (0.0 to 3.0)
            audio_stress = 0.0
            indicators = []

            # Pitch instability (high pitch variance indicates voice cracking / choking up)
            if pitch_std > 45.0:
                audio_stress += 0.8
                indicators.append("Vocal pitch instability / voice cracking")
            elif pitch_mean > 260.0 and pitch_std > 30.0:
                audio_stress += 0.6
                indicators.append("Elevated vocal pitch under distress")

            # High zero-crossing rate reflects breathy shivering or panic hyperventilation
            if zcr_mean > 0.09:
                audio_stress += 1.0
                indicators.append("Vocal tremor / breathy tremor detected")
            elif zcr_mean > 0.06:
                audio_stress += 0.5

            # Extreme loudness variation (shouting or gasping) or very low whispery energy
            if rms_std > 0.06:
                audio_stress += 0.8
                indicators.append("Irregular vocal intensity")
            elif rms_mean < 0.015:
                audio_stress += 0.4
                indicators.append("Whispered / faint vocalization")

            # Spectral centroid tension
            if centroid_mean > 2200.0:
                audio_stress += 0.4
                indicators.append("Acoustic tension")

            audio_stress = min(round(audio_stress, 2), 3.0)

            return {
                "pitch_hz": round(pitch_mean, 1),
                "pitch_instability": round(pitch_std, 1),
                "shiver_zcr": round(zcr_mean, 4),
                "energy": round(rms_mean, 4),
                "spectral_centroid": round(centroid_mean, 1),
                "audio_svi_penalty": audio_stress,
                "acoustic_indicators": indicators,
            }
        except Exception as e:
            print("[AI] Audio processing error:", str(e))
            return None

    def calculate_text_svi(self, text: str) -> dict:
        """
        Analyzes text and returns an SVI (Stress Vulnerability Index) from 0.0 to 10.0.
        Combines deep transformer classification with emergency heuristic boosting.
        """
        if not text or not text.strip():
            return {
                "svi_score": 0.0,
                "risk_level": "LOW",
                "top_emotion": "neutral",
                "all_emotions": [{"label": "neutral", "score": 1.0}],
            }

        self._ensure_classifier()

        # Get emotion scores from Hugging Face model
        try:
            raw_results = self.emotion_classifier(text)
            results = raw_results[0] if isinstance(raw_results[0], list) else raw_results
            emotions = sorted(results, key=lambda x: x["score"], reverse=True)
        except Exception as e:
            print("[AI] Transformer classification fallback:", e)
            emotions = [
                {"label": "sadness", "score": 0.4},
                {"label": "fear", "score": 0.3},
                {"label": "neutral", "score": 0.3},
            ]

        # Emotion Weighting Scale (0 to 1.0)
        weights = {
            "fear": 1.0,
            "sadness": 0.85,
            "anger": 0.75,
            "disgust": 0.55,
            "surprise": 0.40,
            "neutral": 0.10,
            "joy": 0.0,
        }

        # Multilingual distress detection calibration
        text_lower = text.lower()
        has_non_ascii = bool(re.search(r'[\u0900-\u0D7F\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF]', text))
        
        # Multilingual high-distress triggers
        high_fear_words = ["डर", "घबराहट", "बचाओ", "खतरा", "darr", "dar", "bhoy", "miedo", "panico", "peur", "خوف"]
        high_sad_words = ["दर्द", "रोना", "अकेला", "तन्हा", "dard", "akelapan", "dolor", "sola", "solo", "tristesse", "ألم"]
        
        if (has_non_ascii or any(w in text_lower for w in ["madad", "bachao", "darr", "dard", "ayuda", "miedo"])) and emotions[0]["label"] == "neutral":
            if any(w in text_lower for w in high_fear_words):
                emotions = [{"label": "fear", "score": 0.92}, {"label": "sadness", "score": 0.05}, {"label": "neutral", "score": 0.03}]
            elif any(w in text_lower for w in high_sad_words):
                emotions = [{"label": "sadness", "score": 0.89}, {"label": "fear", "score": 0.07}, {"label": "neutral", "score": 0.04}]

        total_stress = sum([s["score"] * weights.get(s["label"], 0.2) for s in emotions])
        svi_score = total_stress * 10.0

        # Comprehensive Multilingual Heuristic keywords for trauma, crisis, distress
        emergency_keywords = [
            # English
            "fire", "smoke", "burning", "gun", "shoot", "knife", "hiding", "intruder",
            "assault", "suicide", "kill myself", "die", "bleeding", "heart attack",
            "breathe", "drowning", "trapped", "help", "emergency", "overwhelmed",
            "panic", "can't take this", "falling apart", "terrified", "hopeless",
            "shaking", "crying", "suffocating", "alone",
            # Hindi / Hinglish (SIH context)
            "मदद", "बचाओ", "डर", "सांस", "खून", "दर्द", "आत्महत्या", "मरना", "मारना",
            "बंदूक", "आग", "हमला", "अकेला", "घबराहट", "रो रहा", "रो रही", "सदमा", "बेहोश",
            "madad", "bachao", "darr", "dard", "khoon", "saans", "ghabrahat",
            "aatmahatya", "mar jaunga", "mar jaungi", "chot", "aag", "goli", "chaku", "akelapan",
            # Bengali & Marathi
            "সাহায্য", "বাঁচাও", "ভয়", "রক্ত", "আগুন", "যন্ত্রণা", "আত্মহত্যা", "মরতে", "শ্বাস",
            "मदत", "वाचवा", "भीती", "रक्त", "वेदना", "श्वास", "एकटेपणा", "त्रास",
            # Tamil & Telugu
            "உதவி", "காப்பாற்றுங்கள்", "பயம்", "ரத்தம்", "வலி", "சுவாசம்",
            "సహాయం", "రక్షించండి", "భయం", "రక్తం", "బాధ", "శ్వాస",
            # Spanish
            "ayuda", "miedo", "sangre", "fuego", "pistola", "suicidio", "matarme", "dolor",
            "panico", "morir", "emergencia", "respirar", "atrapado", "sola", "solo", "peligro",
            # French & Arabic
            "aide", "peur", "sang", "feu", "douleur", "panique", "mourir",
            "مساعدة", "خوف", "دم", "نार", "انتحار", "ألم", "ذعر"
        ]

        matches = [word for word in emergency_keywords if word in text_lower]
        if matches:
            # Boost score based on distress markers
            svi_score += len(matches) * 1.5

            # Lethal overrides (forces CRITICAL score immediately across languages)
            lethal_words = [
                "gun", "suicide", "kill myself", "intruder", "fire", "heart attack", "end it all", "shoot myself",
                "आत्महत्या", "खुदकुशी", "मर जाऊंगा", "मर जाऊंगी", "मरना चाहता", "mar jaunga", "aatmahatya", "khudkushi",
                "suicidio", "matarme", "quiero morir", "acabar con todo",
                "মরতে চাই", "मरावे वाटते", "చావాలనుకుంటున్నాను", "சாக வேண்டும்"
            ]
            if any(word in text_lower for word in lethal_words):
                svi_score = max(svi_score, 9.5)

        svi_score = min(round(svi_score, 2), 10.0)

        risk_level = "LOW"
        if svi_score >= 8.0:
            risk_level = "CRITICAL"
        elif svi_score >= 5.8:
            risk_level = "HIGH"
        elif svi_score >= 3.8:
            risk_level = "MODERATE"

        return {
            "svi_score": svi_score,
            "risk_level": risk_level,
            "top_emotion": emotions[0]["label"],
            "all_emotions": emotions,
        }

    def compute_cumulative_svi(
        self,
        current_turn_score: float,
        history: List[Dict],
        has_audio: bool = False,
        text: str = "",
    ) -> Dict:
        """
        Calculates a clinical cumulative SVI across the length of the therapy conversation.
        As the conversation extends (more turns, emotional details, and voice samples),
        the assessment confidence increases and the SVI reflects the true ongoing clinical picture.
        """
        # Extract past user messages
        user_messages = [m for m in history if m.get("sender") == "user"]
        turn_count = len(user_messages) + 1  # Including current turn

        # Extract previous scores stored in system messages or estimate from history
        past_scores = []
        for m in history:
            if m.get("sender") == "system" and m.get("score") is not None:
                past_scores.append(float(m.get("score")))

        # Append current turn score
        all_scores = past_scores + [current_turn_score]

        # 1. Exponential moving average giving more weight to recent turns while preserving trajectory
        # Changed decay from 0.65 to 0.85 to make long conversation history more impactful on the final score.
        weights = [0.85 ** (len(all_scores) - 1 - i) for i in range(len(all_scores))]
        weighted_sum = sum(s * w for s, w in zip(all_scores, weights))
        cumulative_svi = weighted_sum / sum(weights)

        # Safety override: if any turn reached 9.0+, don't drop below 7.5 immediately without resolution
        if max(all_scores) >= 9.0:
            cumulative_svi = max(cumulative_svi, 7.5)

        cumulative_svi = round(min(10.0, max(0.0, cumulative_svi)), 2)

        # 2. Assessment Confidence percentage (increases with session depth & modalities)
        # Turn 1: ~38%, Turn 2: ~55%, Turn 3: ~70%, Turn 4: ~82%, Turn 5: ~90%, Turn 6+: 95-98%
        base_confidence = min(96.0, 26.0 + (turn_count * 14.0) - (turn_count ** 1.3 * 1.5))
        if has_audio:
            base_confidence = min(98.0, base_confidence + 6.0)
        if len(text.split()) > 15:
            base_confidence = min(98.0, base_confidence + 3.0)
        confidence_percent = round(base_confidence, 1)

        # 3. Emotional Trend (improving, escalating, or stable)
        trend = "stable"
        if len(all_scores) >= 2:
            diff = current_turn_score - all_scores[-2]
            if diff <= -0.9:
                trend = "improving"
            elif diff >= 0.9:
                trend = "escalating"

        # 4. Final Risk Level Determination
        risk_level = "LOW"
        if cumulative_svi >= 8.0 or current_turn_score >= 9.0:
            risk_level = "CRITICAL"
        elif cumulative_svi >= 5.8:
            risk_level = "HIGH"
        elif cumulative_svi >= 3.8:
            risk_level = "MODERATE"

        # Determine clinical therapeutic phase
        if turn_count <= 2:
            therapeutic_phase = "Intake & Check-in"
        elif turn_count <= 4:
            therapeutic_phase = "Root Cause & Exploration"
        elif turn_count <= 6:
            therapeutic_phase = "Emotional Validation & Resilience"
        else:
            therapeutic_phase = "Coping & Grounding Guidance"

        return {
            "current_turn_svi": current_turn_score,
            "cumulative_svi": cumulative_svi,
            "confidence_percent": confidence_percent,
            "trend": trend,
            "risk_level": risk_level,
            "session_turns": turn_count,
            "therapeutic_phase": therapeutic_phase,
        }

    def generate_final_report(
        self,
        history: List[Dict],
        cumulative_svi: float,
        confidence_percent: float,
        risk_level: str,
        dominant_emotions: List[str] = None,
        audio_metrics_list: List[Dict] = None,
    ) -> Dict:
        """
        Synthesizes the multi-turn session into a clinical stress assessment report.
        Extracts key stress themes, somatic signals, emotional trajectory, and provides
        an evidence-based coping and recovery roadmap.
        """
        user_texts = [m.get("text", "") for m in history if m.get("sender") == "user"]
        combined_text = " ".join(user_texts).lower()
        turn_count = len(user_texts)

        # 1. Identify Stress Themes & Triggers
        triggers = []
        if any(w in combined_text for w in ["sleep", "insomnia", "tired", "exhausted", "nightmare", "waking up"]):
            triggers.append({"category": "Sleep & Circadian Fatigue", "description": "Disrupted sleep architecture, chronic exhaustion, or morning dread."})
        if any(w in combined_text for w in ["work", "job", "manager", "boss", "deadline", "project", "fired", "hours"]):
            triggers.append({"category": "Occupational & Workload Strain", "description": "High-pressure professional demands, unmanageable deadlines, or fear of failure."})
        if any(w in combined_text for w in ["exam", "test", "school", "college", "study", "grades", "professor"]):
            triggers.append({"category": "Academic Performance Pressure", "description": "Intense evaluation stress, academic overwhelm, or performance anxiety."})
        if any(w in combined_text for w in ["chest", "heart", "racing", "breathe", "shaking", "pain", "tight", "stomach"]):
            triggers.append({"category": "Somatic & Physiological Hyperarousal", "description": "Autonomic nervous system distress including tachycardia, chest tightness, or tremors."})
        if any(w in combined_text for w in ["alone", "lonely", "nobody", "isolated", "hide", "secret", "bottle"]):
            triggers.append({"category": "Emotional Isolation & Concealment", "description": "Bearing emotional burdens without adequate interpersonal sharing or support."})
        if any(w in combined_text for w in ["suicide", "kill myself", "end it", "pointless", "no reason to live"]):
            triggers.append({"category": "Acute Psychological Distress & Crisis", "description": "High-urgency crisis markers requiring immediate protective intervention."})
        if not triggers:
            triggers.append({"category": "Generalized Tension & Daily Life Stressors", "description": "Accumulation of routine pressures and emotional fatigue."})

        # 2. Acoustic Vocal Strain Summary
        acoustic_summary = {
            "samples_analyzed": len(audio_metrics_list or []),
            "vocal_tremor_detected": False,
            "average_pitch_hz": None,
            "pitch_instability": False,
            "vocal_strain_level": "Mild"
        }
        if audio_metrics_list:
            pitches = [m.get("pitch_hz") for m in audio_metrics_list if m and m.get("pitch_hz")]
            if pitches:
                acoustic_summary["average_pitch_hz"] = round(float(np.mean(pitches)), 1)
            tremors = [m for m in audio_metrics_list if m and m.get("shiver_zcr", 0) > 0.08]
            if tremors:
                acoustic_summary["vocal_tremor_detected"] = True
            penalties = [m.get("audio_svi_penalty", 0) for m in audio_metrics_list if m]
            avg_penalty = np.mean(penalties) if penalties else 0
            if avg_penalty >= 1.5:
                acoustic_summary["vocal_strain_level"] = "Elevated"
            elif avg_penalty >= 0.8:
                acoustic_summary["vocal_strain_level"] = "Moderate"

        # 3. Multi-dimensional Stress Breakdown
        emotional_score = min(10.0, round(cumulative_svi * 1.02, 1))
        physical_strain = 7.5 if acoustic_summary["vocal_tremor_detected"] else (5.5 if "Somatic & Physiological Hyperarousal" in [t["category"] for t in triggers] else 3.5)
        cognitive_load = 8.0 if "Occupational & Workload Strain" in [t["category"] for t in triggers] or "Academic Performance Pressure" in [t["category"] for t in triggers] else 5.0

        # 4. Trauma-Informed Narrative (Directly speaking to the victim with deep compassion)
        clinical_narrative = (
            f"You have shown incredible courage in opening up and speaking your truth today. "
            f"Based on our dialogue, your current Trauma & Stress Vulnerability Index is {cumulative_svi}/10.0 ({risk_level} Impact), "
            f"with an assessment accuracy of {confidence_percent}%. "
            f"Your emotional and bodily sensations are deeply valid, natural human survival responses to {', '.join([t['category'] for t in triggers[:2]])}. "
            f"You are not broken, you are surviving an intense weight, and you do not have to carry all of this alone."
        )

        # 5. Tailored Trauma Healing & Recovery Roadmap
        coping_roadmap = [
            {
                "title": "Immediate Nervous System Regulation",
                "action": "Take 3 physiological sighs with me: breathe in deeply through your nose, take a secondary quick sip of air at the top, and release it in a long, slow sigh out through your mouth.",
                "type": "Somatic Safety"
            },
            {
                "title": "Creating Your Safe Physical Haven",
                "action": "Wrap yourself in a warm blanket, dim bright lights, and place both feet flat on the floor. Tell your body: 'Right now, in this room, I am safe.'",
                "type": "Comfort & Grounding"
            },
            {
                "title": "Gentle Self-Compassion & Permission to Rest",
                "action": "Release any expectations of having to be productive or strong today. Give yourself permission to rest without self-judgment.",
                "type": "Self-Care"
            }
        ]
        if risk_level in ["CRITICAL", "HIGH"]:
            coping_roadmap.append({
                "title": "24/7 Immediate Crisis & Human Support",
                "action": "You deserve unconditional support right now. Dial 988 (Suicide & Crisis Lifeline) or text HOME to 741741 to connect with a caring human specialist for free.",
                "type": "Immediate Support"
            })

        return {
            "overall_svi": cumulative_svi,
            "risk_level": risk_level,
            "confidence_percent": confidence_percent,
            "turn_count": turn_count,
            "stress_dimensions": {
                "emotional_sentiment": emotional_score,
                "physical_vocal_strain": physical_strain,
                "cognitive_workload": cognitive_load,
            },
            "triggers": triggers,
            "acoustic_summary": acoustic_summary,
            "clinical_narrative": clinical_narrative,
            "coping_roadmap": coping_roadmap,
        }

    def generate_remedy(
        self,
        text: str,
        emotion: str,
        risk_level: str,
        history: list = None,
        message_count: int = 0,
        cumulative_svi: float = 0.0,
        language: Optional[str] = None,
    ) -> str:
        """
        Generates a truly context-aware, human-like therapist response that
        directly addresses what the user actually said. Reads their words,
        picks up on topics, and responds in context — never repeats canned lines.
        """
        turn = message_count
        history = history or []

        # ============================================================
        # 1. TRY GEMINI FIRST — Best quality, context-aware conversation
        # ============================================================
        self._ensure_gemini_client()
        if self.client:
            try:
                from google.genai import types

                # Build proper multi-turn conversation history for Gemini
                contents = []
                for msg in history[-10:]:
                    role = "user" if msg.get("sender") == "user" else "model"
                    msg_text = msg.get("text", "")
                    if msg_text.strip():
                        contents.append(types.Content(
                            role=role,
                            parts=[types.Part.from_text(text=msg_text)]
                        ))

                # Add the current user message
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=text)]
                ))

                # Determine therapeutic phase instructions
                if turn <= 2:
                    phase = (
                        "PHASE: INTAKE (Turn 1-2). Your ONLY job: make them feel safe. "
                        "Acknowledge exactly what they just told you. Ask ONE gentle question "
                        "that flows naturally from their words. Do NOT give advice yet."
                    )
                elif turn <= 4:
                    phase = (
                        "PHASE: EXPLORATION (Turn 3-4). Dig deeper into what they shared. "
                        "Reference specific things they mentioned earlier. Ask about root causes, "
                        "how long this has been happening, or who else knows."
                    )
                elif turn <= 6:
                    phase = (
                        "PHASE: VALIDATION (Turn 5-6). Reflect back the full picture of what "
                        "they've shared across the conversation. Validate their strength. "
                        "Ask what has helped them cope before, or what they need most right now."
                    )
                else:
                    phase = (
                        "PHASE: COPING (Turn 7+). Based on everything they've told you, offer "
                        "ONE specific, personalized grounding technique or micro-step that directly "
                        "relates to their situation. Check in on how their body feels right now."
                    )

                lang_rule = "7. LANGUAGE: Reply in the EXACT language the user is speaking. Match their script."
                if language:
                    clean_l = language.lower().strip()
                    if clean_l.startswith("en"):
                        lang_rule = "7. LANGUAGE: CRITICAL: The user has selected English. You MUST respond in English regardless of Indian or cultural topics."
                    elif clean_l.startswith("hi"):
                        lang_rule = "7. LANGUAGE: CRITICAL: The user has selected Hindi. You MUST respond in Hindi (Devanagari script)."
                    elif clean_l.startswith("es"):
                        lang_rule = "7. LANGUAGE: CRITICAL: The user has selected Spanish. You MUST respond in Spanish."

                system_instruction = (
                    "You are Samvedna [NHAA], a warm, deeply human trauma-informed companion. "
                    "You are NOT a chatbot — you are a safe person sitting beside someone in pain.\n\n"
                    f"Turn: {turn + 1} | SVI: {cumulative_svi}/10 | Risk: {risk_level} | Emotion: {emotion}\n\n"
                    f"{phase}\n\n"
                    "ABSOLUTE RULES:\n"
                    "1. RESPOND DIRECTLY TO WHAT THEY JUST SAID. Reference their actual words, "
                    "topics, feelings, and situation. If they mentioned work stress, talk about work. "
                    "If they mentioned a relationship, talk about that relationship. If they said they "
                    "feel scared, address that specific fear. If they mentioned discrimination or wanting to report an incident, "
                    "validate their hurt and answer their question clearly. NEVER give a generic reply.\n"
                    "2. Sound like a real human who genuinely cares — use natural conversational language, "
                    "not therapy textbook phrases. No bullet points, no lists, no clinical labels.\n"
                    "3. Keep it SHORT: 2-4 sentences max. People in distress can't process long text.\n"
                    "4. End with a question or check-in that connects to what they just shared.\n"
                    "5. NEVER say 'As an AI', 'I understand that you feel', or repeat the same lines.\n"
                    "6. NEVER jump to crisis response unless they explicitly mention self-harm, "
                    "suicide, weapons, or active danger. Normal sadness/stress ≠ crisis.\n"
                    f"{lang_rule}\n"
                    "8. Read the conversation history carefully. Don't ask questions they already answered. "
                    "Build on what they previously said to show you're truly listening."
                )

                model_names = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash"]
                for m_name in model_names:
                    try:
                        resp = self.client.models.generate_content(
                            model=m_name,
                            contents=contents,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=0.75,
                                max_output_tokens=300,
                            ),
                        )
                        if resp and resp.text:
                            cleaned = resp.text.replace("*", "").replace("#", "").strip()
                            # Remove any accidental self-identification as AI
                            for bad in ["As an AI", "as an AI", "I'm an AI", "I am an AI", "As a language model"]:
                                cleaned = cleaned.replace(bad, "")
                            if len(cleaned) > 20:
                                print(f"[AI] Gemini generated response successfully using {m_name}")
                                return cleaned.strip()
                    except Exception as me:
                        print(f"[AI] Gemini attempt with {m_name} failed: {me}")
                        continue
            except Exception as e:
                print("[AI] Gemini generation failed, trying local LLM fallback:", e)

        # ============================================================
        # 2. LOCAL LLM FALLBACK (offline only — when Gemini is unavailable)
        # ============================================================
        self._ensure_local_llm()
        if self.local_llm_pipeline:
            try:
                messages = []
                system_prompt = (
                    "You are Samvedna [NHAA], a warm trauma-informed therapist in a live text chat. "
                    "RULES:\n"
                    "- Reply ONLY with YOUR response. Do NOT generate the user's words or a script.\n"
                    "- Keep it 2-3 sentences. Be warm, direct, and reference what the user said.\n"
                    "- Do NOT use bullet points, lists, or clinical jargon.\n"
                    "- End with one gentle follow-up question.\n"
                    "- Never say 'As an AI' or ask who Samvedna is — you ARE Samvedna."
                )
                if language and language.lower().startswith("hi"):
                    system_prompt += "\nRespond in Hindi (Devanagari script) or Hinglish."
                elif language and language.lower().startswith("es"):
                    system_prompt += "\nRespond in Spanish."
                
                messages.append({"role": "system", "content": system_prompt})
                
                for msg in history[-10:]:
                    role = "user" if msg.get("sender") == "user" else "assistant"
                    msg_text = msg.get("text", "")
                    if msg_text.strip():
                        messages.append({"role": role, "content": msg_text})
                
                messages.append({"role": "user", "content": text})
                
                prompt = self.local_llm_pipeline.tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
                
                outputs = self.local_llm_pipeline(
                    prompt, 
                    max_new_tokens=200,
                    do_sample=True,
                    temperature=0.6,
                    repetition_penalty=1.15,
                    top_k=50,
                    top_p=0.92,
                    eos_token_id=self.local_llm_pipeline.tokenizer.eos_token_id,
                    pad_token_id=self.local_llm_pipeline.tokenizer.eos_token_id
                )
                
                generated_text = outputs[0]["generated_text"][len(prompt):].strip()
                if generated_text:
                    # Safety: truncate at any hallucinated user/assistant turn markers
                    for stop_marker in ["\nUser:", "\nuser:", "\nHuman:", "\n<|", "Debasis:", "Patient:"]:
                        if stop_marker in generated_text:
                            generated_text = generated_text.split(stop_marker)[0].strip()

                    # Remove any accidental self-identification as AI
                    for bad in ["As an AI", "as an AI", "I'm an AI", "I am an AI", "As a language model"]:
                        generated_text = generated_text.replace(bad, "")

                    # Truncate at last complete sentence boundary if text was cut off mid-sentence
                    last_punct = max(generated_text.rfind('.'), generated_text.rfind('?'), generated_text.rfind('!'))
                    if last_punct > 25:
                        generated_text = generated_text[:last_punct + 1].strip()

                    if len(generated_text) > 15:
                        return generated_text.strip()
            except Exception as e:
                print("[AI] Local LLM generation failed, falling back:", e)

        # ============================================================
        # 3. CONTEXT-AWARE TEMPLATE FALLBACK (when both LLM & Gemini are unavailable)
        # ============================================================
        return self._generate_therapist_engine_response(
            text, emotion, risk_level, turn, cumulative_svi, history, language=language
        )

    def _generate_therapist_engine_response(
        self, text: str, emotion: str, risk_level: str, turn: int,
        cumulative_svi: float, history: list = None, language: Optional[str] = None
    ) -> str:
        """
        Context-aware fallback that reads the user's actual words,
        extracts themes/topics, and crafts a response that directly
        addresses what they said — not random generic lines.
        """
        text_lower = text.lower().strip()
        history = history or []

        # --- Strict Language Routing ---
        target_lang = "en"
        lang_pref = (language or "").lower().strip()
        if lang_pref.startswith("en"):
            # User explicitly selected an English variant (e.g. en-IN, en-US) -> ALWAYS English!
            target_lang = "en"
        elif lang_pref.startswith("hi"):
            target_lang = "hi"
        elif lang_pref.startswith("es"):
            target_lang = "es"
        elif lang_pref.startswith("bn"):
            target_lang = "bn"
        elif lang_pref.startswith("mr"):
            target_lang = "mr"
        else:
            # Fallback: Detect script
            if re.search(r'[\u0900-\u097F]', text):
                target_lang = "hi"
            elif re.search(r'[\u0980-\u09FF]', text):
                target_lang = "bn"
            else:
                # Latin text: ONLY match whole words with \b word boundaries
                spanish_words = ["ayuda", "miedo", "tengo", "siento", "dolor", "estoy", "hola", "gracias", "por favor"]
                hindi_words = ["madad", "bachao", "mujhe", "kya", "nahi", "kaise", "kuch", "shukriya"]
                if any(re.search(r'\b' + re.escape(w) + r'\b', text_lower) for w in spanish_words):
                    target_lang = "es"
                elif any(re.search(r'\b' + re.escape(w) + r'\b', text_lower) for w in hindi_words):
                    target_lang = "hi"
                else:
                    target_lang = "en"

        is_hindi = (target_lang == "hi")
        is_spanish = (target_lang == "es")

        # --- Emergency overrides (only for actual emergencies) ---
        lethal = any(w in text_lower for w in [
            "suicide", "kill myself", "end it all", "no reason to live", "want to die",
            "आत्महत्या", "मर जाऊंगा", "मर जाऊंगी", "खुदकुशी", "suicidio", "matarme"
        ])
        is_violence = any(w in text_lower for w in ["gun", "shoot", "knife", "intruder", "attack", "hiding", "बंदूक", "हमला", "pistola"])
        is_fire = any(w in text_lower for w in ["fire", "smoke", "burning", "trapped", "आग", "fuego"])
        is_medical = any(w in text_lower for w in ["bleeding", "heart attack", "can't breathe", "chest pain", "खून", "sangre"])

        if lethal:
            if is_hindi:
                return "आपकी जिंदगी बहुत कीमती है, और मैं इस पल में पूरी तरह आपके साथ हूँ। जो दर्द आप महसूस कर रहे हैं वह असली है, लेकिन आपको इसे अकेले नहीं सहना है। क्या आप मेरे साथ एक धीमी सांस ले सकते हैं?"
            if is_spanish:
                return "Tu vida es profundamente valiosa y estoy aquí contigo ahora mismo. El dolor que sientes es real, pero no tienes que enfrentarlo solo. ¿Puedes respirar hondo conmigo?"
            return "Your life matters deeply to me, and I am right here beside you. The pain you're carrying is real, but you don't have to hold it alone. Can you take one slow breath with me and tell me where you are right now?"

        if is_violence:
            return "Your safety comes first. Stay low and quiet, and make sure you're in a secure spot. I'm staying right here with you. Can you tell me — is anyone else nearby?"
        if is_fire:
            return "Get low near the floor where the air is clearest and cover your mouth. Focus on the nearest exit. Can you see a door or window from where you are?"
        if is_medical:
            return "Try to stay as still as you can. If there's bleeding, press a clean cloth firmly on it. I'm right here — can you take a slow breath for me?"

        # --- Extract what the user is actually talking about ---
        topics = self._extract_topics(text_lower)
        user_subject = topics.get("subject", "what you're going through")

        # --- Build context-aware response based on extracted topics ---

        # Hindi contextual responses
        if is_hindi:
            if turn <= 2:
                return f"आपने जो बताया, मैं उसे पूरी तरह सुन रही हूँ। {self._hindi_reflect(topics)} ये सब साझा करने के लिए बहुत हिम्मत चाहिए। क्या आप मुझे थोड़ा और बता सकते हैं — यह कब से चल रहा है?"
            elif turn <= 4:
                return f"मैं समझ रही हूँ कि {self._hindi_reflect(topics)} आप पर कितना भारी पड़ रहा है। इसे अकेले झेलना बहुत मुश्किल है। क्या कोई है जिससे आप इस बारे में बात कर पाते हैं?"
            elif turn <= 6:
                return f"आपने आज जो साझा किया है उससे मुझे पता चलता है कि आप कितने मजबूत हैं। {self._hindi_reflect(topics)} — इसे सहना आसान नहीं है। पहले कभी कोई चीज़ थी जिससे आपको थोड़ी राहत मिली हो?"
            return "आपने आज बहुत गहरी बातें साझा की हैं। आइए अभी एक साथ एक लंबी सांस लेते हैं। अभी इस पल में आपका शरीर कैसा महसूस कर रहा है?"

        # Spanish contextual responses
        if is_spanish:
            if turn <= 2:
                return "Escucho lo que me cuentas y quiero que sepas que estás en un espacio completamente seguro. ¿Puedes contarme un poco más sobre cómo empezó todo esto?"
            return "Gracias por compartir eso conmigo. Lo que sientes es completamente válido. ¿Qué es lo que más te pesa en este momento?"

        # --- English context-aware responses ---
        prev_user_msgs = [m.get("text", "") for m in history if m.get("sender") == "user"]

        # Handle greetings and light check-ins warmly
        if not user_subject or user_subject == "":
            greetings = [
                "Hello, I'm so glad you reached out. This is your safe space — no rush, no judgment. How are you feeling right now, and what's been on your mind?",
                "Hey, welcome. I'm right here with you. Take all the time you need. What's been going on in your world lately?",
                "Hi, it's really good that you came to talk. How has your day been, and is there something specific weighing on you?",
            ]
            return random.choice(greetings)

        if turn <= 2:
            reflection = self._reflect_content(text, topics)
            return f"{reflection} Thank you for trusting me with this — you are in a safe, confidential space. {self._contextual_question(topics, turn)}"

        elif turn <= 4:
            reflection = self._reflect_content(text, topics)
            return f"{reflection} {self._contextual_question(topics, turn)}"

        elif turn <= 6:
            reflection = self._reflect_content(text, topics)
            if prev_user_msgs:
                return f"Looking at everything you've shared with me today, I can see how heavily this has been weighing on you. {reflection} What has helped you get through difficult days like this before?"
            return f"{reflection} You've shown real strength talking through all of this. Is there anything that brings you even a small moment of peace?"

        else:
            reflection = self._reflect_content(text, topics)
            coping = self._contextual_coping(topics)
            return f"{reflection} {coping}"

    def _extract_topics(self, text_lower: str) -> dict:
        """Extract themes, subjects, and feelings from user text using whole word boundaries."""
        topics = {"subject": "", "feeling": "", "people": [], "keywords": []}

        # Detect simple greetings first
        greeting_patterns = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon",
                            "how are you", "just wanted to talk", "need someone to talk", "i want to talk",
                            "feeling lately", "not feeling well", "need help"]
        words = text_lower.split()
        if len(words) <= 4 and any(re.search(r'\b' + re.escape(g) + r'\b', text_lower) for g in greeting_patterns):
            distress_check = ["scared", "afraid", "panic", "crying", "hurt", "pain", "die", "kill", "fire", "blood"]
            if not any(re.search(r'\b' + re.escape(d) + r'\b', text_lower) for d in distress_check):
                topics["subject"] = ""
                return topics

        # Detect subject areas — ranked using WHOLE WORD boundaries (\b)
        subject_map = {
            "discrimination": [
                "casteist", "caste", "racist", "racism", "discrimination", "discriminated",
                "slur", "humiliated", "humiliating", "untouchable", "derogatory", "harassed",
                "harassment", "insult", "insulted", "community function"
            ],
            "legal_reporting": [
                "complaint", "police", "police station", "report", "file", "fir", "record",
                "formal complaint", "written statement", "on record", "submit in writing"
            ],
            "work": ["work", "job", "boss", "manager", "office", "colleague", "fired", "deadline", "salary", "career", "coworker"],
            "relationship": ["relationship", "partner", "husband", "wife", "boyfriend", "girlfriend", "marriage", "divorce", "breakup", "love", "dating", "ex"],
            "family": ["family", "parents", "mother", "father", "mom", "dad", "brother", "sister", "children", "kids", "son", "daughter"],
            "school": ["school", "college", "university", "exam", "exams", "grades", "study", "studied", "teacher", "professor", "homework", "class", "fail", "semester"],
            "health": ["health", "sick", "hospital", "doctor", "medicine", "disease", "headache", "stomach"],
            "money": ["money", "debt", "rent", "bills", "broke", "financial", "afford", "loan"],
            "loneliness": ["alone", "lonely", "nobody", "isolated", "no one", "no friends", "invisible"],
            "sleep": ["sleep", "insomnia", "nightmare", "nightmares", "can't sleep", "waking up"],
            "anxiety": ["anxious", "anxiety", "worry", "nervous", "panic", "overthinking", "racing thoughts"],
            "grief": ["loss", "lost someone", "died", "death", "grief", "funeral", "passed away", "miss them"],
            "trauma": ["accident", "crash", "assault", "attacked", "abuse", "abused", "violence", "raped", "molested",
                      "beaten", "trauma", "ptsd", "flashback", "afraid to drive", "afraid to go", "nightmares",
                      "can't drive", "scared to go", "haunted", "reliving"],
        }

        # Count matches per subject using WORD BOUNDARIES (\b)
        subject_scores = {}
        for subj, keywords in subject_map.items():
            matches = [kw for kw in keywords if re.search(r'\b' + re.escape(kw) + r'\b', text_lower)]
            if matches:
                subject_scores[subj] = len(matches)
                topics["keywords"].extend(matches)

        # Pick the subject with the most keyword matches
        if subject_scores:
            topics["subject"] = max(subject_scores, key=subject_scores.get)
        else:
            topics["subject"] = "what you're going through"

        # Detect expressed feelings with word boundaries
        feeling_map = {
            "scared": ["scared", "afraid", "terrified", "fear", "frightened"],
            "sad": ["sad", "crying", "tears", "heartbroken", "depressed", "down", "cry"],
            "angry": ["angry", "mad", "furious", "frustrated", "rage", "pissed"],
            "overwhelmed": ["overwhelmed", "too much", "can't handle", "drowning", "falling apart", "can't take"],
            "exhausted": ["tired", "exhausted", "drained", "burnt out", "no energy"],
            "hopeless": ["hopeless", "pointless", "what's the point", "no hope", "given up"],
            "anxious": ["anxious", "worry", "nervous", "panic", "restless"],
            "confused": ["confused", "lost", "don't know", "not sure", "don't understand"],
            "guilty": ["guilty", "fault", "blame", "sorry", "should have"],
            "numb": ["numb", "nothing", "empty", "feel nothing", "blank"],
        }

        for feeling, keywords in feeling_map.items():
            if any(re.search(r'\b' + re.escape(kw) + r'\b', text_lower) for kw in keywords):
                topics["feeling"] = feeling
                break

        return topics

    def _reflect_content(self, text: str, topics: dict) -> str:
        """Create a reflection that shows we actually read what they said."""
        subject = topics.get("subject", "")
        feeling = topics.get("feeling", "")

        reflections = {
            "discrimination": [
                "What you experienced was completely wrong and unacceptable. Being targeted and humiliated in front of others carries a deep, unfair sting, and you have every right to feel hurt and want this on record.",
                "Facing caste-based comments and public humiliation is deeply painful and degrading. It takes immense strength and self-respect to stand up and decide you want this formally recorded.",
                "No one should ever have to endure that kind of humiliation. What you're feeling right now makes complete sense, and I stand firmly beside you.",
            ],
            "legal_reporting": [
                "Wanting to document what happened and create an official record is a completely valid and proactive step to protect your dignity and safety.",
                "Taking steps to file an official report takes real courage, especially while processing the emotional weight of what occurred.",
            ],
            "work": [
                "It sounds like work has been putting an enormous amount of pressure on you.",
                "I can hear how much the stress from work has been building up.",
                "Dealing with that kind of work pressure day after day takes a real toll.",
            ],
            "relationship": [
                "Relationship pain cuts really deep, and what you're describing sounds incredibly hard.",
                "I can hear how much this relationship situation has been hurting you.",
                "When someone we care about is at the center of our pain, everything feels heavier.",
            ],
            "family": [
                "Family issues carry a unique weight because these are the people closest to us.",
                "I can sense how much what's happening with your family is affecting you.",
                "When things are difficult at home, it's hard to find peace anywhere else.",
            ],
            "school": [
                "Academic pressure can feel crushing, especially when it feels like everything depends on it.",
                "I hear you — the pressure around studies and performance can be overwhelming.",
                "That kind of academic stress is exhausting, especially when you feel like you can't let up.",
            ],
            "health": [
                "Dealing with health concerns on top of everything else must feel so draining.",
                "When our body isn't well, everything else feels harder to manage.",
            ],
            "money": [
                "Financial stress has a way of creeping into every part of life and making everything feel heavier.",
                "I hear you — money worries can make it feel like there's no room to breathe.",
            ],
            "loneliness": [
                "Feeling alone with all of this is one of the hardest parts, and I'm really glad you're talking to me right now.",
                "Carrying this by yourself must feel so isolating. You don't have to do that anymore.",
            ],
            "sleep": [
                "When sleep is disrupted, everything feels harder to cope with — your mind and body both need that rest.",
                "Not being able to sleep properly takes such a toll on how we handle everything else.",
            ],
            "anxiety": [
                "That racing, restless feeling you're describing sounds really intense and exhausting.",
                "When anxiety takes hold like that, it can feel like your mind won't give you a moment of peace.",
            ],
            "grief": [
                "Losing someone leaves a kind of ache that doesn't have a simple fix, and I hear that in your words.",
                "Grief doesn't follow a timeline, and what you're feeling right now is completely valid.",
            ],
            "trauma": [
                "What you went through sounds deeply traumatic, and the way it's still affecting you makes complete sense.",
                "Surviving something like that leaves marks that aren't always visible, and I can hear how much it's still with you.",
                "Your mind and body are still processing what happened, and that's a completely natural response to trauma.",
            ],
        }

        feeling_reflections = {
            "scared": "I can sense the fear in what you're sharing, and that's a completely natural response.",
            "sad": "The sadness you're carrying is heavy, and it's okay to feel it fully right now.",
            "angry": "Your frustration makes complete sense given what you're dealing with.",
            "overwhelmed": "It sounds like everything is piling up at once, and that's an incredibly hard place to be.",
            "exhausted": "You sound really drained, and that exhaustion is your body telling you it needs care.",
            "hopeless": "When things feel this dark, it's hard to see a way through — but I'm here beside you.",
            "anxious": "That anxious energy you're describing sounds really draining and relentless.",
            "confused": "Not knowing what to do or feel is its own kind of pain, and it's okay to sit with that.",
            "guilty": "You're being really hard on yourself, and I want you to know that you deserve compassion too.",
            "numb": "Sometimes feeling nothing is the mind's way of protecting itself when there's been too much pain.",
        }

        parts = []
        if subject in reflections:
            parts.append(random.choice(reflections[subject]))
        if feeling and feeling in feeling_reflections and not parts:
            parts.append(feeling_reflections[feeling])

        if not parts:
            words = text.split()
            if len(words) > 5:
                parts.append("I hear what you're telling me, and I can feel how much weight is behind those words.")
            else:
                parts.append("Thank you for sharing that with me — every word matters here.")

        return " ".join(parts)

    def _contextual_question(self, topics: dict, turn: int) -> str:
        """Ask a question that directly relates to what they talked about."""
        subject = topics.get("subject", "")

        questions = {
            "discrimination": [
                "Regarding your question on submitting this: you can file an online grievance via your state police citizen portal, or submit a signed written letter in person at the local station to receive an acknowledged stamped copy (GD entry). As you consider your next step, how is your heart and body feeling in this moment?",
                "Do you have a trusted person or close friend who can stand beside you for support right now?",
                "Are you somewhere physically safe and calm right now where you can take a moment for yourself?",
            ],
            "legal_reporting": [
                "To answer your question: yes, you can submit a complaint online through your state police portal, or visit the police station with two copies of a written statement to get an official receiving stamp. Before dealing with the formalities, how are you holding up emotionally?",
                "Would it help to talk through how to prepare your written statement so you feel steady and clear?",
            ],
            "work": [
                "How long has this work situation been affecting you like this?",
                "Is there anyone at work who knows what you're going through?",
                "When you think about work tomorrow, what feeling comes up first?",
            ],
            "relationship": [
                "How has this been affecting your day-to-day life?",
                "Do you feel like you've been able to talk to anyone about this?",
                "What would feel like even a small step toward feeling better about this?",
            ],
            "family": [
                "Has it always been this difficult, or has something changed recently?",
                "Who in your life feels like a safe person to lean on right now?",
                "What part of the family situation weighs on you the most?",
            ],
            "school": [
                "How has this academic pressure been affecting your sleep and mood?",
                "Do you feel like anyone around you understands what you're going through?",
                "What would take even a little bit of this pressure off your shoulders?",
            ],
            "loneliness": [
                "When did you start feeling this alone?",
                "Is there anyone — even one person — who you feel comfortable reaching out to?",
                "What would connection look like for you right now, even in a small way?",
            ],
            "sleep": [
                "How long has your sleep been disrupted like this?",
                "When you lie awake, what tends to run through your mind?",
                "What does your evening usually look like before you try to sleep?",
            ],
            "anxiety": [
                "When the anxiety hits, what does it feel like in your body?",
                "Is there a particular time of day when it feels the worst?",
                "What have you tried so far to manage these feelings?",
            ],
            "grief": [
                "Would you like to tell me about the person you lost?",
                "How have you been taking care of yourself through this?",
                "What do you miss the most?",
            ],
            "trauma": [
                "How has this experience been affecting your daily life since it happened?",
                "Do you feel safe right now, in this moment?",
                "Has there been anyone you've been able to talk to about what happened?",
            ],
        }

        if subject in questions:
            return random.choice(questions[subject])

        generic = [
            "Can you tell me a bit more about what's been happening?",
            "How has this been showing up in your everyday life?",
            "What feels like the heaviest part of all this for you?",
            "How long have you been carrying this?",
        ]
        return random.choice(generic)

    def _contextual_coping(self, topics: dict) -> str:
        """Suggest a coping step specific to their situation."""
        subject = topics.get("subject", "")

        coping = {
            "discrimination": "What was said to you reflects their prejudice, not your worth or dignity. Can you place one hand over your heart, feel its steady rhythm, and take a slow breath with me? You are in control now.",
            "legal_reporting": "Take it one step at a time — you don't have to resolve everything this exact hour. Can you write down just the basic facts (date, location, witness names) on a piece of paper, and then set it aside to take a quiet breath?",
            "work": "One thing that might help right now — can you set one small boundary today, even just closing your laptop 30 minutes earlier? How does that feel as an idea?",
            "relationship": "Right now, the most important relationship is the one you have with yourself. Can you do one kind thing for yourself tonight — even just making your favorite warm drink and sitting quietly?",
            "family": "Family pain is some of the hardest to sit with. Can you give yourself permission to step back from trying to fix things, just for today? How does your body feel as you consider that?",
            "school": "Let's take the pressure down just one notch. Can you pick the one thing that feels most manageable and focus only on that today? Everything else can wait.",
            "loneliness": "You reached out to me today, and that's a brave step. Can you think of one small way to connect with someone this week — even just a text to someone you trust?",
            "sleep": "Tonight, try this: put your phone in another room 30 minutes before bed, and take 3 slow breaths where the exhale is twice as long as the inhale. How does your body feel right now?",
            "anxiety": "Let's ground together right now. Put both feet flat on the floor, press your palms against your legs, and take one slow breath. Can you name 3 things you can see around you?",
            "grief": "Grief doesn't need to be rushed or fixed. If it feels right, you could write a short letter to the person you lost — just for you, no one else needs to see it. How does that idea feel?",
            "trauma": "Healing from trauma isn't linear, and you don't have to rush it. Right now, can you notice your feet on the ground and take one slow breath? You are safe in this moment.",
        }

        if subject in coping:
            return coping[subject]
        return "Let's try something small together right now — put one hand on your chest, take a slow breath in for 4 seconds, and let it out for 6. How does your chest feel after that?"

    def _hindi_reflect(self, topics: dict) -> str:
        """Create Hindi reflection based on extracted topics."""
        subject = topics.get("subject", "")
        reflections = {
            "discrimination": "इस भेदभाव और अपमान की तकलीफ",
            "legal_reporting": "शिकायत और कानूनी प्रक्रिया का यह तनाव",
            "work": "काम का यह दबाव",
            "relationship": "रिश्ते की यह तकलीफ",
            "family": "परिवार की यह स्थिति",
            "school": "पढ़ाई का यह दबाव",
            "loneliness": "अकेलेपन का यह एहसास",
            "sleep": "नींद न आने की यह परेशानी",
            "anxiety": "यह बेचैनी और घबराहट",
            "grief": "इस खोने का दर्द",
            "health": "सेहत की यह चिंता",
            "money": "पैसों की यह तंगी",
            "trauma": "इस सदमे और आघात का दर्द",
        }
        return reflections.get(subject, "यह सब कुछ")


# Global singleton instance
analyzer = StressAnalyzer()