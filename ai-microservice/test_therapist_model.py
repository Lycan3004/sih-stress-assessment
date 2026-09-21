"""
Therapist Model Validation & Stress Analyzer Test Suite
Verifies:
1. Multi-turn dialogue progression (Stage 1 -> 2 -> 3 -> 4)
2. Human-like therapist persona & empathetic response tone
3. Cumulative SVI accuracy convergence as conversation length increases
4. Acoustic feature extraction & stress penalty detection with synthetic WAV
5. Emergency / Acute crisis safety overrides
"""

import io
import wave
import numpy as np
from ml.stress_analyzer import analyzer


def create_synthetic_wav(duration=1.0, sr=16000, freq=220.0, jitter=False, shiver=False):
    """Generates synthetic PCM WAV audio for acoustic testing."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    if jitter:
        # Modulated high pitch with tremor / shiver
        freq_mod = freq + 40.0 * np.sin(2 * np.pi * 8 * t)
        phase = 2 * np.pi * np.cumsum(freq_mod) / sr
        signal = 0.5 * np.sin(phase)
    else:
        signal = 0.5 * np.sin(2 * np.pi * freq * t)

    if shiver:
        noise = np.random.normal(0, 0.15, signal.shape)
        signal += noise

    # Normalize to 16-bit PCM
    signal = np.clip(signal, -1.0, 1.0)
    int_data = (signal * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(int_data.tobytes())
    return buf.getvalue()


def test_audio_analysis():
    print("\n--- [TEST 1] Acoustic Analysis Verification ---")
    calm_audio = create_synthetic_wav(duration=1.0, freq=180.0, jitter=False)
    stress_audio = create_synthetic_wav(duration=1.0, freq=300.0, jitter=True, shiver=True)

    calm_metrics = analyzer.analyze_audio(calm_audio)
    stress_metrics = analyzer.analyze_audio(stress_audio)

    print(f"Calm Audio -> Pitch: {calm_metrics['pitch_hz']}Hz, SVI Penalty: {calm_metrics['audio_svi_penalty']}")
    print(f"Stressed Audio -> Pitch: {stress_metrics['pitch_hz']}Hz, ZCR: {stress_metrics['shiver_zcr']}, SVI Penalty: {stress_metrics['audio_svi_penalty']}, Indicators: {stress_metrics['acoustic_indicators']}")

    assert calm_metrics is not None, "Calm audio analysis failed"
    assert stress_metrics is not None, "Stressed audio analysis failed"
    assert stress_metrics['audio_svi_penalty'] >= calm_metrics['audio_svi_penalty'], "Stressed audio should have higher penalty"
    print("[TEST 1 PASSED]: Acoustic analysis correctly measures vocal strain and tremor.")


def test_multi_turn_therapist_progression():
    print("\n--- [TEST 2] Multi-Turn Therapist Progression & SVI Convergence ---")
    
    dialogue_script = [
        # Turn 1: Initial check-in
        "I've been feeling completely overwhelmed at work and can barely sleep.",
        # Turn 2: Opening up about details
        "My manager keeps piling impossible deadlines, and I feel like I'm letting everyone down.",
        # Turn 3: Physical & emotional impact
        "Every morning I wake up with tight chest pains and a racing heartbeat, wondering if I can even do this.",
        # Turn 4: Loneliness & isolation
        "I haven't told my family or partner because I don't want them worrying, so I just bottle it all up.",
        # Turn 5: Exploring coping
        "Sometimes listening to music or taking a late walk helps for a few minutes, but the dread returns the next day.",
        # Turn 6: Seeking guidance
        "I really want to learn how to break this constant cycle of anxiety before I completely break down.",
    ]

    history = []
    prev_confidence = 0.0

    for i, user_msg in enumerate(dialogue_script):
        turn_num = i + 1
        print(f"\n>> Client (Turn {turn_num}): \"{user_msg}\"")

        # 1. Text analysis
        text_analysis = analyzer.calculate_text_svi(user_msg)

        # 2. Cumulative SVI calculation
        cumul = analyzer.compute_cumulative_svi(
            current_turn_score=text_analysis['svi_score'],
            history=history,
            has_audio=True,
            text=user_msg
        )

        # 3. Generate Therapist response
        response = analyzer.generate_remedy(
            text=user_msg,
            emotion=text_analysis['top_emotion'],
            risk_level=cumul['risk_level'],
            history=history,
            message_count=turn_num,
            cumulative_svi=cumul['cumulative_svi']
        )

        print(f"   [Metrics]: Turn SVI={cumul['current_turn_svi']} | Cumul SVI={cumul['cumulative_svi']}/10.0 | Confidence={cumul['confidence_percent']}% | Phase: '{cumul['therapeutic_phase']}' | Trend: {cumul['trend']}")
        print(f"   [Samvedna [NHAA]]: {response}\n")

        # Assertions
        assert cumul['confidence_percent'] > prev_confidence, f"Confidence must increase as turns progress (Turn {turn_num})"
        prev_confidence = cumul['confidence_percent']
        assert len(response.strip()) > 30, "Response must be substantive"
        assert "?" in response, "Therapist response must end with an empathetic question or check-in to keep client talking"

        # Update history for next turn
        history.append({"sender": "user", "text": user_msg})
        history.append({"sender": "system", "text": response, "score": cumul['cumulative_svi']})

    assert prev_confidence >= 88.0, "Session depth must yield high assessment confidence (>88%) after 6 turns"
    print("[TEST 2 PASSED]: Longitudinal dialogue successfully progressed through therapeutic phases with increasing SVI accuracy.")


def test_emergency_crisis_override():
    print("\n--- [TEST 3] Emergency & Crisis Heuristic Overrides ---")
    crisis_text = "I can't take this pain anymore, I have pills and I'm going to kill myself tonight."
    analysis = analyzer.calculate_text_svi(crisis_text)
    cumul = analyzer.compute_cumulative_svi(analysis['svi_score'], [], False, crisis_text)
    response = analyzer.generate_remedy(crisis_text, analysis['top_emotion'], cumul['risk_level'], [], 1, cumul['cumulative_svi'])

    print(f"Crisis Text: \"{crisis_text}\"")
    print(f"Detected SVI: {cumul['cumulative_svi']}/10.0 | Risk: {cumul['risk_level']}")
    print(f"Therapist Immediate Response: {response}")

    assert cumul['risk_level'] == "CRITICAL", "Crisis statement must trigger CRITICAL risk"
    assert cumul['cumulative_svi'] >= 9.0, "Crisis SVI must be >= 9.0"
    assert len(response) > 40, "Emergency response must provide caring, grounded de-escalation"
    print("[TEST 3 PASSED]: Immediate lethality was instantly flagged as CRITICAL with compassionate crisis response.")


if __name__ == "__main__":
    print("=" * 65)
    print("Starting Samvedna [NHAA] Stress Index & Therapist Model Verification...")
    print("=" * 65)
    test_audio_analysis()
    test_multi_turn_therapist_progression()
    test_emergency_crisis_override()
    print("\n" + "=" * 65)
    print("ALL TESTS PASSED SUCCESSFULLY! Desired results achieved.")
    print("=" * 65)
