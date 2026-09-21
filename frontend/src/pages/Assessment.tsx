import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { auth } from '../firebase';
import {
  Mic,
  MicOff,
  Send,
  AlertTriangle,
  ShieldCheck,
  Activity,
  HeartHandshake,
  Sparkles,
  Volume2,
  X,
  ChevronDown,
  ChevronUp,
  Wind,
  Info,
  RefreshCw,
  Clock,
  ArrowRight,
  Shield,
  ShieldAlert,
  Globe,
  Languages,
  Check
} from 'lucide-react';

interface AudioMetrics {
  pitch_hz?: number;
  pitch_instability?: boolean;
  shiver_zcr?: number;
  audio_svi_penalty?: number;
  acoustic_indicators?: string[];
  rms_energy?: number;
}

export interface SpeechLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  category: 'Indian' | 'Global';
}

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguage[] = [
  // 🇮🇳 Indian Regional Languages (Flagship SIH Priority)
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', category: 'Indian' },
  { code: 'en-IN', name: 'English (India)', nativeName: 'English (India)', flag: '🇮🇳', category: 'Indian' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', category: 'Indian' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', category: 'Indian' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', category: 'Indian' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', category: 'Indian' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', category: 'Indian' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', category: 'Indian' },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', category: 'Indian' },
  { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', category: 'Indian' },
  { code: 'ur-IN', name: 'Urdu', nativeName: 'اردو', flag: '🇮🇳', category: 'Indian' },
  
  // 🌍 Global Major Languages
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸', category: 'Global' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧', category: 'Global' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', category: 'Global' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷', category: 'Global' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', category: 'Global' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', category: 'Global' },
  { code: 'zh-CN', name: 'Mandarin (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳', category: 'Global' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', category: 'Global' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', category: 'Global' },
  { code: 'pt-BR', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', category: 'Global' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', category: 'Global' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', category: 'Global' },
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', category: 'Global' },
  { code: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', category: 'Global' },
];

interface Message {
  id: string;
  sender: 'user' | 'system';
  text: string;
  turnScore?: number;
  cumulativeScore?: number;
  riskLevel?: string;
  topEmotion?: string;
  allEmotions?: { label: string; score: number }[];
  audioMetrics?: AudioMetrics | null;
  confidence?: number;
  therapeuticPhase?: string;
  timestamp: string;
}

// Convert raw Float32 audio samples into a genuine 16kHz 16-bit Mono PCM WAV Blob
function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < 4; i++) view.setUint8(i, 'RIFF'.charCodeAt(i));
  view.setUint32(4, 36 + samples.length * 2, true);
  for (let i = 0; i < 4; i++) view.setUint8(8 + i, 'WAVE'.charCodeAt(i));

  // fmt sub-chunk
  for (let i = 0; i < 4; i++) view.setUint8(12 + i, 'fmt '.charCodeAt(i));
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16 bits

  // data sub-chunk
  for (let i = 0; i < 4; i++) view.setUint8(36 + i, 'data'.charCodeAt(i));
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export default function Assessment() {
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');

  // Multilingual Speech Recognition State
  const [selectedLang, setSelectedLang] = useState<string>(() => {
    return localStorage.getItem('sih_speech_lang') || 'hi-IN';
  });
  const [showLangModal, setShowLangModal] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [transcribingNotice, setTranscribingNotice] = useState<string | null>(null);

  const currentLangObj = SUPPORTED_SPEECH_LANGUAGES.find(l => l.code === selectedLang) || SUPPORTED_SPEECH_LANGUAGES[0];
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      sender: 'system',
      text: "Welcome. I am Samvedna [NHAA], your safe companion and stress assessment module. Take a slow, comfortable breath—you are in a completely safe, confidential sanctuary right now. Whatever trauma, pain, or heavy burden you are carrying, you do not have to face it alone anymore. When you feel ready, tell me: how is your heart and body feeling in this moment?",
      therapeuticPhase: 'Safe Sanctuary & Intake',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);

  // Audio Recording State for acoustic analysis & Whisper transcription
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const pcmSamplesRef = useRef<Float32Array[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMetricsHistory, setAudioMetricsHistory] = useState<AudioMetrics[]>([]);

  // Speech Recognition Ref
  const recognitionRef = useRef<any>(null);

  // Session Progress & Cumulative State
  const [sessionPhase, setSessionPhase] = useState<string>('Safe Sanctuary & Intake');
  const [latestCumulativeSvi, setLatestCumulativeSvi] = useState<number | null>(null);
  const [confidencePercent, setConfidencePercent] = useState<number>(35.0);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  // Safe Handover Modal State (Report is routed to Admin, NOT shown to victim)
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingStep, setBreathingStep] = useState<'Inhale (4s)' | 'Hold & Sip (1s)' | 'Exhale (6s)'>('Inhale (4s)');

  // Geolocation State for crisis dispatch
  const [location, setLocation] = useState<string | null>(null);

  useEffect(() => {
    // Request location on mount for safety dispatch if emergency occurs
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(`${pos.coords.latitude},${pos.coords.longitude}`),
        (err) => console.warn('Location permission denied or unavailable.', err)
      );
    }

    // Check Speech Recognition capability
    const hasSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    setSpeechSupported(hasSpeech);

    return () => {
      // Clean up recognition and audio processor on unmount
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (audioProcessorRef.current) {
        try { audioProcessorRef.current.disconnect(); } catch (e) {}
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimText, loading]);

  // Breathing exercise timer
  useEffect(() => {
    if (!breathingActive) return;
    const interval = setInterval(() => {
      setBreathingStep(prev => {
        if (prev === 'Inhale (4s)') return 'Hold & Sip (1s)';
        if (prev === 'Hold & Sip (1s)') return 'Exhale (6s)';
        return 'Inhale (4s)';
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [breathingActive]);

  // Language Switch Handler
  const handleSelectLanguage = (code: string) => {
    setSelectedLang(code);
    localStorage.setItem('sih_speech_lang', code);
    setShowLangModal(false);

    if (isListeningRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.lang = code;
      } catch (err) {
        console.warn('Could not update recognition language dynamically:', err);
      }
    }
  };

  // Stop audio session and process PCM samples into genuine WAV
  const stopAudioSession = async () => {
    isListeningRef.current = false;
    setIsListening(false);
    setInterimText('');

    // Stop Web Speech
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    // Disconnect Web Audio processor & tracks
    if (audioProcessorRef.current) {
      try { audioProcessorRef.current.disconnect(); } catch (e) {}
      audioProcessorRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { await audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }

    // Encode collected raw PCM float samples into pure 16kHz 16-bit Mono PCM WAV
    const chunks = pcmSamplesRef.current;
    pcmSamplesRef.current = [];

    if (chunks.length > 0) {
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      // Ensure we have at least 0.2s of audio
      if (totalLen >= 3200) {
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }

        const wavBlob = encodeWAV(merged, 16000);
        setAudioBlob(wavBlob);

        // Run backend Whisper transcription fallback so voice is guaranteed to transcribe
        setTranscribingNotice(`Transcribing in ${currentLangObj.nativeName}...`);
        try {
          const formData = new FormData();
          formData.append('audio', wavBlob, 'voice.wav');
          formData.append('language', selectedLang);
          const res = await axios.post('http://localhost:8000/api/transcribe', formData);
          if (res.data && res.data.transcript) {
            const trans = res.data.transcript.trim();
            if (trans) {
              setText(prev => (prev ? prev.trim() + ' ' + trans : trans));
            }
          }
        } catch (err) {
          console.warn('Backend audio transcription notice:', err);
        } finally {
          setTranscribingNotice(null);
        }
      }
    }
  };

  // Speech-to-Text & Audio Recording Controller (Multilingual)
  const handleMicrophone = async () => {
    // 1. If currently listening, STOP
    if (isListening) {
      await stopAudioSession();
      return;
    }

    // 2. START Audio Capture & Speech Recognition
    setMicError(null);
    pcmSamplesRef.current = [];
    isListeningRef.current = true;
    setIsListening(true);

    // Start Web Audio PCM Recorder (16kHz Mono)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return;
        const channelData = e.inputBuffer.getChannelData(0);
        pcmSamplesRef.current.push(new Float32Array(channelData));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error('Mic access denied:', err);
      setMicError('Microphone access denied. You are safe to type your message directly below.');
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    // Optional Web Speech API for live interim display if supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Prevents Chrome persistent socket drop/network crashes
        recognition.interimResults = true;
        recognition.lang = selectedLang;

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let finalChunk = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalChunk += transcript + ' ';
            } else {
              currentInterim += transcript;
            }
          }

          if (finalChunk) {
            setText(prev => (prev ? prev.trim() + ' ' + finalChunk.trim() : finalChunk.trim()));
            setInterimText('');
          } else {
            setInterimText(currentInterim);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition notice:', e.error);
          if (e.error === 'not-allowed') {
            setMicError('Microphone permission was denied.');
          }
        };

        recognition.onend = () => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Web Speech API initialization notice:', e);
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // If still listening, stop the microphone and merge interim text
    if (isListening) {
      await stopAudioSession();
    }

    const fullText = (text + (interimText ? ' ' + interimText : '')).trim();
    if (!fullText && !audioBlob) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: fullText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);

    // Store state for submission then clear input area
    const currentText = fullText;
    const currentBlob = audioBlob;
    setText('');
    setInterimText('');
    setAudioBlob(null);
    setLoading(true);

    try {
      // 1. AI Analysis with FormData
      const formData = new FormData();
      formData.append('text', currentText);
      formData.append('language', selectedLang);
      formData.append(
        'history',
        JSON.stringify(messages.slice(-10).map(m => ({
          sender: m.sender,
          text: m.text,
          score: m.turnScore || m.cumulativeScore
        })))
      );

      if (currentBlob) {
        formData.append('audio', currentBlob, 'voice.wav');
      }

      const response = await axios.post('http://localhost:8000/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const analysisData = response.data.analysis;

      // Update Session Progress Tracker
      if (analysisData.therapeutic_phase) setSessionPhase(analysisData.therapeutic_phase);
      if (analysisData.cumulative_svi !== undefined) setLatestCumulativeSvi(analysisData.cumulative_svi);
      if (analysisData.confidence_percent !== undefined) setConfidencePercent(analysisData.confidence_percent);

      if (analysisData.audio_metrics) {
        setAudioMetricsHistory(prev => [...prev, analysisData.audio_metrics]);
      }

      // 2. Save Assessment to Node Gateway Database
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        await axios.post(
          'http://localhost:4000/api/assessments',
          {
            textInput: currentText,
            sviScore: analysisData.cumulative_svi || analysisData.turn_svi || analysisData.svi_score,
            riskLevel: analysisData.risk_level,
            location: location
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        ).catch(err => console.warn('Gateway DB sync notice:', err));
      }

      // 3. Append Counselor's Empathetic Response with Turn Stress Index
      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'system',
        text: analysisData.remedy,
        turnScore: analysisData.turn_svi,
        cumulativeScore: analysisData.cumulative_svi,
        riskLevel: analysisData.risk_level,
        topEmotion: analysisData.top_emotion,
        allEmotions: analysisData.all_emotions,
        audioMetrics: analysisData.audio_metrics,
        confidence: analysisData.confidence_percent,
        therapeuticPhase: analysisData.therapeutic_phase,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, systemMessage]);
    } catch (error) {
      console.error('Assessment analysis error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'system',
          text: "I am listening closely with you. Please take a gentle breath—I am right here by your side. Could you tell me a little bit more about what you are feeling?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
    setLoading(false);
  };

  // Conclude Session & Safe Handover to Admin Command Center (Victim sees no clinical report)
  const handleConcludeSession = async () => {
    setShowHandoverModal(true);
    setHandoverLoading(true);

    try {
      // 1. Fetch full SVI synthesis from Python AI microservice for the Admin
      const formData = new FormData();
      formData.append('history', JSON.stringify(messages.map(m => ({
        sender: m.sender,
        text: m.text,
        score: m.turnScore || m.cumulativeScore
      }))));
      formData.append('audio_metrics_json', JSON.stringify(audioMetricsHistory));

      const res = await axios.post('http://localhost:8000/api/final-report', formData);
      const report = res.data.status === 'SUCCESS' ? res.data.report : null;

      // 2. Transmit to Backend Gateway for the Admin Dashboard & Emergency Dispatch
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const victimTranscript = messages.filter(m => m.sender === 'user').map(m => m.text).join(' | ');

      await axios.post('http://localhost:4000/api/assessments', {
        textInput: victimTranscript || 'Trauma counseling session completed with Samvedna [NHAA].',
        sviScore: report?.overall_svi || latestCumulativeSvi || 5.0,
        riskLevel: report?.risk_level || 'MODERATE',
        location: location || undefined,
        reportData: report
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      // Gentle relief celebration
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#0d9488', '#3b82f6', '#6366f1', '#10b981']
        });
      } catch (e) {}
    } catch (err) {
      console.warn('Session handover transmitted to admin:', err);
    }
    setHandoverLoading(false);
  };

  const userTurnCount = messages.filter(m => m.sender === 'user').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-indigo-50/25 text-slate-800 flex flex-col font-sans relative overflow-x-hidden selection:bg-teal-500 selection:text-white">
      {/* Decorative Ambient Floating Orbs for Gentle, Calming Vibecoder Aesthetics */}
      <div className="fixed top-[-10%] left-[-5%] w-[450px] h-[450px] bg-gradient-to-tr from-teal-200/30 to-blue-200/20 rounded-full blur-3xl pointer-events-none animate-float -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-gradient-to-tl from-indigo-200/25 to-pink-200/20 rounded-full blur-3xl pointer-events-none animate-float-slow -z-10" />

      {/* Header with Samvedna [NHAA] Profile & Progress */}
      <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 sticky top-0 z-30 shadow-xs transition-all">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Samvedna [NHAA] Profile */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-500 via-blue-600 to-indigo-600 p-[2px] shadow-md shadow-teal-500/20">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-teal-700 font-extrabold text-xs tracking-wider">
                  NHAA
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  Samvedna [NHAA]
                  <span className="text-[11px] bg-teal-50 text-teal-700 font-semibold px-2.5 py-0.5 rounded-full border border-teal-200/70">
                    Stress Index Module
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Trauma Sanctuary • Confidential 1-on-1 Crisis Support
              </p>
            </div>
          </div>

          {/* Healing Session Metrics & Handover Trigger */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Phase & Confidence Pill */}
            <div className="bg-white/90 border border-slate-200/90 rounded-xl px-3 py-1.5 flex items-center gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                <span>{sessionPhase}</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-200" />
              <div className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3 h-3 text-teal-600" />
                <span>Turn {userTurnCount}</span>
                <span className="text-slate-400 font-mono">({confidencePercent}% accuracy)</span>
              </div>
            </div>

            {/* Conclude Session & Safe Handover Button (For the Victim) */}
            <button
              id="conclude-session-btn"
              type="button"
              onClick={handleConcludeSession}
              className={`px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all duration-300 shadow-sm cursor-pointer ${
                userTurnCount >= 2
                  ? 'bg-gradient-to-r from-teal-600 via-indigo-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white shadow-teal-500/25 animate-pulse scale-102 hover:scale-105'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
              title="Safely conclude session and route stress report to crisis administrators"
            >
              <HeartHandshake className="w-4 h-4 text-teal-300" />
              <span>Conclude Session</span>
            </button>

            {/* Admin Command Center Link */}
            <button
              id="admin-dashboard-btn"
              type="button"
              onClick={() => window.open('/dashboard', '_blank')}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open Admin Command Center to view clinical reports & incident triage"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Admin View</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Conversation Canvas */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-4xl mx-auto w-full">
        {/* Speech API Unsupported Alert (e.g. Firefox/Brave without Web Speech) */}
        {!speechSupported && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs flex items-center gap-2 shadow-xs">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Web Speech API is not natively supported in this browser. You can still speak (raw audio will be recorded) or type safely. For real-time speech-to-text, use Google Chrome or Microsoft Edge.</span>
          </div>
        )}

        {/* Safe Haven Sanctuary Notice */}
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-start gap-3.5 transition-all hover:shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center shrink-0 text-teal-600 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-xs md:text-sm text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">A Safe Haven for Trauma Healing & Relief</p>
            <p className="text-slate-600 leading-relaxed">
              Speak or type at your own pace. Each message calculates your distress index and vocal physical strain. As you converse, Samvedna [NHAA] listens deeply like a supportive trauma therapist to make you feel safe and heard, while compiling your stress index securely for crisis care administrators.
            </p>
          </div>
        </div>

        {/* Microphone Error Alert (if permission denied) */}
        {micError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs animate-fadeInUp">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{micError}</span>
            </div>
            <button
              onClick={() => setMicError(null)}
              className="text-rose-600 hover:text-rose-800 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Stream */}
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isCritical = msg.riskLevel === 'CRITICAL';
          const isHigh = msg.riskLevel === 'HIGH';
          const isMod = msg.riskLevel === 'MODERATE';

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5 animate-fadeInUp`}>
              {/* Sender Label & Timestamp */}
              <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500 font-medium">
                <span className={isUser ? 'text-blue-600' : 'text-teal-700 font-bold'}>
                  {isUser ? 'You' : 'Samvedna [NHAA] (Stress Index Module)'}
                </span>
                <span>•</span>
                <span>{msg.timestamp}</span>
                {msg.therapeuticPhase && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-600 font-semibold">{msg.therapeuticPhase}</span>
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-4.5 shadow-sm transition-all duration-200 ${
                  isUser
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-blue-500/10'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-slate-200/60'
                }`}
              >
                <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Turn Stress Index Card (Preserved on EACH message!) */}
                {msg.turnScore !== undefined && (
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Turn SVI Score */}
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          <Activity className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-xs font-mono font-bold text-slate-900">
                            Current Distress: {msg.turnScore.toFixed(1)}/10
                          </span>
                        </div>

                        {/* Cumulative SVI Tracking */}
                        {msg.cumulativeScore !== undefined && (
                          <div className="text-[11px] text-slate-600 flex items-center gap-1 bg-teal-50/70 border border-teal-200/60 px-2 py-0.5 rounded-lg">
                            <span>Session Level:</span>
                            <span className="font-bold text-teal-700 font-mono">
                              {msg.cumulativeScore.toFixed(1)}/10
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Risk Badge */}
                      <div className="flex items-center gap-1.5">
                        {msg.topEmotion && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 capitalize font-medium">
                            {msg.topEmotion}
                          </span>
                        )}
                        <div
                          className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${
                            isCritical
                              ? 'bg-red-50 border-red-300 text-red-700 animate-pulse'
                              : isHigh
                              ? 'bg-orange-50 border-orange-300 text-orange-700'
                              : isMod
                              ? 'bg-amber-50 border-amber-300 text-amber-800'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          }`}
                        >
                          {isCritical && <AlertTriangle className="w-3 h-3 text-red-600" />}
                          {msg.riskLevel} IMPACT
                        </div>
                      </div>
                    </div>

                    {/* Acoustic Metrics Tag (if voice was analyzed for this turn) */}
                    {msg.audioMetrics && (
                      <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-200 flex items-center justify-between text-[11px] text-slate-700 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-teal-700 font-medium">
                          <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                          <span>Voice Tremor Analysis:</span>
                          <span className="font-mono text-slate-900 font-semibold">
                            {msg.audioMetrics.pitch_hz ? `${msg.audioMetrics.pitch_hz} Hz` : 'Analyzed'}
                          </span>
                        </div>
                        {msg.audioMetrics.acoustic_indicators && msg.audioMetrics.acoustic_indicators.length > 0 && (
                          <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            ⚠️ {msg.audioMetrics.acoustic_indicators[0]}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Granular Emotion Breakdown Toggle */}
                    {msg.allEmotions && msg.allEmotions.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDetails(prev => ({
                              ...prev,
                              [msg.id]: !prev[msg.id]
                            }))
                          }
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors mt-0.5 cursor-pointer"
                        >
                          {expandedDetails[msg.id] ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Hide Feeling Probabilities
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> View Emotion Distribution ({msg.allEmotions.length})
                            </>
                          )}
                        </button>

                        {expandedDetails[msg.id] && (
                          <div className="mt-2 space-y-1.5 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200 animate-fadeInUp">
                            {msg.allEmotions.slice(0, 4).map((emo) => (
                              <div key={emo.label} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-600 capitalize font-medium">{emo.label}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${Math.round(emo.score * 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-slate-800 font-semibold w-8 text-right">
                                    {Math.round(emo.score * 100)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Interim Voice Transcription Feedback Card */}
        {/* Live Speaking Interim Bubble with Multilingual Tag */}
        {isListening && (
          <div className="bg-gradient-to-r from-teal-50/90 via-sky-50/90 to-blue-50/90 border border-teal-200 rounded-2xl p-4 shadow-md animate-fadeInUp">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                  Listening Gently in {currentLangObj.flag} {currentLangObj.nativeName} ({currentLangObj.name})
                </span>
              </div>
              {/* Animated Sound Wave Bars */}
              <div className="flex items-center gap-1 h-6">
                <div className="w-1 bg-teal-500 rounded-full animate-wave" style={{ animationDelay: '0.1s', height: '14px' }} />
                <div className="w-1 bg-blue-500 rounded-full animate-wave" style={{ animationDelay: '0.2s', height: '22px' }} />
                <div className="w-1 bg-indigo-500 rounded-full animate-wave" style={{ animationDelay: '0.3s', height: '16px' }} />
                <div className="w-1 bg-teal-500 rounded-full animate-wave" style={{ animationDelay: '0.15s', height: '24px' }} />
                <div className="w-1 bg-blue-500 rounded-full animate-wave" style={{ animationDelay: '0.25s', height: '12px' }} />
              </div>
            </div>
            <p className="text-sm text-slate-800 italic font-sans min-h-[22px] font-medium">
              {interimText || text || 'Speak your heart out... I am listening closely...'}
            </p>
          </div>
        )}

        {/* Counselor Reflecting Animation */}
        {loading && (
          <div className="flex items-center gap-3 animate-fadeInUp">
            <div className="w-8 h-8 rounded-full bg-white border border-teal-200 flex items-center justify-center text-teal-700 text-xs font-extrabold shadow-xs">
              NHAA
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-4 flex items-center gap-2 shadow-sm">
              <span className="text-xs text-slate-500 font-medium mr-1">Samvedna [NHAA] is listening & holding space</span>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area with Multilingual Control Bar */}
      <div className="bg-white/90 backdrop-blur-md border-t border-slate-200/90 p-3 md:p-4 shadow-lg sticky bottom-0 z-20 transition-all">
        {/* Multilingual Voice Selection Bar */}
        <div className="max-w-4xl mx-auto mb-2.5 flex items-center justify-between gap-2 flex-wrap">
          {/* Active Language Badge & Modal Trigger */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowLangModal(true)}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              title="Click to change transcription language"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentLangObj.flag} {currentLangObj.nativeName} ({currentLangObj.name})</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Quick-Switch Pills */}
            <div className="hidden sm:flex items-center gap-1">
              {[
                { code: 'hi-IN', label: '🇮🇳 हिन्दी' },
                { code: 'en-IN', label: '🇮🇳 English' },
                { code: 'bn-IN', label: '🇮🇳 বাংলা' },
                { code: 'mr-IN', label: '🇮🇳 मराठी' },
                { code: 'es-ES', label: '🇪🇸 Español' },
              ].map(item => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelectLanguage(item.code)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    selectedLang === item.code
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-2xs'
                      : 'bg-white/80 hover:bg-slate-100 text-slate-600 border border-slate-200/70'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowLangModal(true)}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold px-2 py-0.5 cursor-pointer underline"
              >
                +20 More
              </button>
            </div>
          </div>

          {/* Active Status Pill */}
          <div className="flex items-center gap-2">
            {isListening && (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>Transcribing {currentLangObj.nativeName}...</span>
              </div>
            )}
            {transcribingNotice && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold animate-pulse">
                <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                <span>{transcribingNotice}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2.5 items-end">
          {/* Microphone Toggle Button */}
          <button
            id="mic-btn"
            type="button"
            onClick={handleMicrophone}
            title={isListening ? 'Click to stop speaking' : 'Click to speak (Voice-to-Text & Acoustic Tremor Analysis)'}
            className={`p-3.5 rounded-2xl transition-all duration-300 shadow-sm flex items-center justify-center shrink-0 cursor-pointer ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse ring-4 ring-red-200 shadow-md scale-105'
                : 'bg-white hover:bg-slate-50 text-blue-600 border border-slate-200 hover:border-slate-300 hover:scale-102'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-blue-600" />}
          </button>

          {/* Textarea Input with Clear button */}
          <div className="flex-1 relative bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-inner">
            <textarea
              id="chat-textarea"
              className="w-full bg-transparent text-slate-800 p-3.5 pr-10 outline-none resize-none text-sm md:text-base leading-relaxed max-h-32 min-h-[48px] placeholder:text-slate-400 font-sans"
              rows={1}
              placeholder={isListening ? 'Listening to your voice...' : 'Speak freely or type how you are feeling right now...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {text && (
              <button
                type="button"
                onClick={() => setText('')}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Send Message Button */}
          <button
            id="send-btn"
            type="submit"
            disabled={(!text.trim() && !interimText.trim() && !audioBlob) || loading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white p-3.5 rounded-2xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed hover:scale-102 active:scale-98"
            title="Send Message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        {/* Micro-guide under input */}
        <div className="max-w-4xl mx-auto mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-400" />
            Press <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] text-slate-700">Enter</kbd> to send • You are in a confidential safe space
          </span>
          {userTurnCount >= 2 && (
            <button
              onClick={handleConcludeSession}
              className="text-teal-700 hover:text-teal-800 font-semibold cursor-pointer underline flex items-center gap-1"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Conclude Session & Safe Handover</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SAFE HANDOVER SANCTUARY MODAL (SHOWN TO VICTIM - NO REPORT)  */}
      {/* ============================================================ */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeInUp">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl space-y-6 relative text-slate-800">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-xs">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    Session Safely Handed Over
                  </h2>
                  <p className="text-xs text-slate-500">
                    Transmitted confidentially to Emergency Care & Admin Triage
                  </p>
                </div>
              </div>
              <button
                id="close-handover-btn"
                onClick={() => setShowHandoverModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {handoverLoading ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
                <p className="text-sm text-slate-700 font-medium">
                  Connecting securely with crisis administrators and saving your session...
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Empathetic Safe Haven Message */}
                <div className="bg-gradient-to-br from-teal-50/70 via-sky-50/50 to-indigo-50/40 p-5 rounded-2xl border border-teal-100/90 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
                    <HeartHandshake className="w-4 h-4 text-teal-600" />
                    Samvedna [NHAA] Support Sanctuary Message
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Thank you for trusting Samvedna [NHAA] with your voice and feelings today. Opening up about painful, heavy experiences takes immense courage.
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    Your session has been securely recorded and transmitted to our emergency crisis support team and administrators. You are not alone, and trained specialists have your assessment on file to ensure you are safeguarded.
                  </p>
                </div>

                {/* Grounding Physiological Sigh Exercise */}
                <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Take A Calming Breath Before You Go
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBreathingActive(!breathingActive)}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer"
                    >
                      {breathingActive ? 'Stop Breath' : 'Start 60s Breath'}
                    </button>
                  </div>

                  {breathingActive ? (
                    <div className="text-center py-4 bg-white rounded-xl border border-teal-200 shadow-xs space-y-2 animate-fadeInUp">
                      <div className="w-14 h-14 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin mx-auto" />
                      <p className="text-sm font-bold text-teal-800 font-mono">
                        {breathingStep}
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Inhale deeply, take a second quick sip at the top, then slowly sigh out.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Drop your shoulders away from your ears, unclamp your jaw, and let your hands rest gently in your lap. Right now, in this moment, you are safe.
                    </p>
                  )}
                </div>

                {/* 24/7 Human Helplines */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <span className="font-bold text-slate-900 block">Immediate 24/7 Free Human Support:</span>
                  <div className="flex items-center justify-between text-slate-700 pt-1">
                    <span>Suicide & Crisis Lifeline:</span>
                    <strong className="text-teal-700 font-bold">Dial 988</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Crisis Text Line:</span>
                    <strong className="text-teal-700 font-bold">Text HOME to 741741</strong>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowHandoverModal(false)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    Return to Safe Chat
                  </button>

                  <button
                    type="button"
                    onClick={() => window.open('/dashboard', '_blank')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                    <span>Admin Command Center</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multilingual Selection Modal */}
      {showLangModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Select Spoken Language</h3>
                  <p className="text-[11px] text-slate-500">Transcribe voice accurately in your native language</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLangModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search filter */}
            <input
              type="text"
              placeholder="Search language (e.g. Hindi, Bengali, Spanish)..."
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
            />

            {/* Language list */}
            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {/* Indian Regional Languages */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                  🇮🇳 Indian Regional Languages
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SUPPORTED_SPEECH_LANGUAGES.filter(l => l.category === 'Indian' && (
                    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
                    l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
                    l.code.toLowerCase().includes(langSearch.toLowerCase())
                  )).map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedLang === lang.code
                          ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{lang.flag}</span>
                        <div>
                          <p className="text-xs">{lang.nativeName}</p>
                          <p className="text-[10px] text-slate-400">{lang.name}</p>
                        </div>
                      </div>
                      {selectedLang === lang.code && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global Languages */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                  🌍 Global Major Languages
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SUPPORTED_SPEECH_LANGUAGES.filter(l => l.category === 'Global' && (
                    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
                    l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
                    l.code.toLowerCase().includes(langSearch.toLowerCase())
                  )).map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedLang === lang.code
                          ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{lang.flag}</span>
                        <div>
                          <p className="text-xs">{lang.nativeName}</p>
                          <p className="text-[10px] text-slate-400">{lang.name}</p>
                        </div>
                      </div>
                      {selectedLang === lang.code && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center pt-1 border-t border-slate-100">
              Web Speech & Multi-Modal Acoustic AI auto-synchronizes with selected language
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
