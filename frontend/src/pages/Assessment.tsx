import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { Mic, Send, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'system';
  text: string;
  riskLevel?: string;
  score?: number;
}

export default function Assessment() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', sender: 'system', text: "Hello. This is a safe space. Please describe how you are feeling, or click the microphone to speak." }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Audio Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // Geolocation State
  const [location, setLocation] = useState<string | null>(null);

  useEffect(() => {
    // Request location on mount for emergencies
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(`${pos.coords.latitude},${pos.coords.longitude}`),
        (err) => console.warn("Location permission denied or unavailable.", err)
      );
    }
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech to Text logic + Audio Recording
  const handleMicrophone = async () => {
    if (isListening) {
      // Stop listening & recording
      setIsListening(false);
      mediaRecorderRef.current?.stop();
      return;
    }

    // 1. Start Speech-to-Text
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setText(prev => prev + " " + transcript);
      };
      recognition.onerror = (e: any) => console.error(e);
      recognition.start();
    }

    // 2. Start Audio Recording for Pitch/Shivers analysis
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop()); // Release microphone
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && !audioBlob) return;

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    
    // Store current state for submission, then clear UI
    const currentText = text;
    const currentBlob = audioBlob;
    setText('');
    setAudioBlob(null);
    setLoading(true);

    try {
      // 1. AI Analysis with FormData
      const formData = new FormData();
      formData.append('text', currentText);
      formData.append('history', JSON.stringify(messages.slice(-6).map(m => ({ sender: m.sender, text: m.text }))));
      
      if (currentBlob) {
        formData.append('audio', currentBlob, 'voice.wav');
      }

      const response = await axios.post('http://localhost:8000/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const analysisData = response.data.analysis;

      // 2. Save to Database
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        await axios.post('http://localhost:4000/api/assessments', {
          textInput: currentText,
          sviScore: analysisData.svi_score,
          riskLevel: analysisData.risk_level,
          location: location
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // 3. System Response (Dynamic Remedy)
      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'system',
        text: analysisData.remedy, // AI Generated Remedy!
        riskLevel: analysisData.risk_level,
        score: analysisData.svi_score
      };
      
      setMessages(prev => [...prev, systemMessage]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: "Error: Could not process request." }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-emerald-500 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-wider">SECURE ASSESSMENT PORTAL</h1>
        </div>
        <div className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-400">End-to-End Encrypted</div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 shadow-xl transition-all duration-300 transform translate-y-0
              ${msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-sm' 
                : 'bg-slate-800 text-slate-300 rounded-bl-sm border border-slate-700'}`}>
              
              <p className="text-sm md:text-base leading-relaxed">{msg.text}</p>
              
              {/* AI Badge for System responses */}
              {msg.score !== undefined && (
                <div className="mt-4 flex items-center gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-mono text-slate-400">SVI: {msg.score.toFixed(1)}/10</span>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded
                    ${msg.riskLevel === 'CRITICAL' ? 'bg-red-900/50 text-red-400' : 
                      msg.riskLevel === 'HIGH' ? 'bg-orange-900/50 text-orange-400' : 
                      'bg-emerald-900/50 text-emerald-400'}`}>
                    {msg.riskLevel === 'CRITICAL' && <AlertTriangle className="w-3 h-3" />}
                    {msg.riskLevel} RISK
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-sm p-4 flex gap-2 border border-slate-700 shadow-xl">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-slate-900 p-4 border-t border-slate-800 shadow-2xl">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2 items-end">
          <button
            type="button"
            onClick={handleMicrophone}
            className={`p-3 rounded-full transition-all duration-300 shadow-lg ${
              isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Mic className="w-6 h-6" />
          </button>
          <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 focus-within:border-blue-500 transition-colors shadow-inner overflow-hidden">
             <textarea
              className="w-full bg-transparent text-slate-200 p-4 outline-none resize-none"
              rows={1}
              placeholder="Type your message or use the microphone..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim() || loading}
            className="bg-blue-600 disabled:bg-slate-800 disabled:text-slate-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Send className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
}
