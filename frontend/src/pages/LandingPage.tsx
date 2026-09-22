import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, ShieldCheck, ArrowRight, Activity, Globe } from 'lucide-react';
import { auth } from '../firebase';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if the current user is an admin based on email
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email) {
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || "admin@sih.com";
        if (user.email.toLowerCase() === adminEmail.toLowerCase()) {
          setIsAdmin(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-indigo-50/25 text-slate-800 relative overflow-hidden font-sans selection:bg-teal-500 selection:text-white">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-gradient-to-tr from-teal-200/30 to-blue-200/20 blur-[120px] rounded-full pointer-events-none opacity-60"></div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 flex flex-col items-center">
        {/* Header / Hero Section */}
        <div className="text-center max-w-3xl mt-12 mb-20 animate-fadeInUp">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-200/70 text-teal-700 text-sm font-bold mb-6 shadow-sm">
            <SparklesIcon className="w-4 h-4" />
            <span>Welcome to the Samvedna [NHAA] portal</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-8 leading-tight text-slate-900">
            Empowering Mental Health <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-600">Through AI Insights</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-8">
            Our mission is to provide an accessible, safe, and confidential space for individuals to understand their emotional wellbeing.
            By blending conversational empathy with advanced acoustic and linguistic analysis, we deliver actionable insights that promote long-term mental health resilience.
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl animate-fadeInUp" style={{ animationDelay: '0.15s' }}>

          {/* Assessment Module Card */}
          <button
            onClick={() => navigate('/assessment')}
            className="group relative flex flex-col items-start p-8 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/90 hover:shadow-lg hover:border-teal-300 transition-all duration-300 text-left overflow-hidden shadow-sm"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 blur-3xl rounded-full group-hover:bg-teal-500/20 transition-all"></div>

            <div className="w-14 h-14 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center mb-6 text-teal-600 group-hover:scale-110 transition-transform shadow-xs">
              <Activity className="w-7 h-7" />
            </div>

            <h3 className="text-2xl font-bold mb-3 text-slate-900 group-hover:text-teal-700 transition-colors">Assessment Module</h3>
            <p className="text-slate-600 mb-6 leading-relaxed flex-grow">
              Enter a safe space to evaluate your current stress levels. Engage in a natural conversation with our AI to receive personalized insights and coping strategies.
            </p>

            <div className="flex items-center text-teal-600 font-bold mt-auto group-hover:translate-x-2 transition-transform">
              Start Assessment <ArrowRight className="w-5 h-5 ml-2" />
            </div>
          </button>

          {/* Admin Dashboard Card */}
          <button
            onClick={() => {
              if (isAdmin) {
                navigate('/dashboard');
              } else {
                alert("Access Denied: You must be an administrator to access the dashboard.");
              }
            }}
            className={`group relative flex flex-col items-start p-8 rounded-2xl border transition-all duration-300 text-left overflow-hidden shadow-sm ${isAdmin ? 'bg-white/80 backdrop-blur-sm border-slate-200/90 hover:border-indigo-300 hover:shadow-lg' : 'bg-slate-100/50 border-slate-200 opacity-70 cursor-not-allowed'}`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full transition-all ${isAdmin ? 'bg-indigo-500/10 group-hover:bg-indigo-500/20' : 'bg-slate-200/50'}`}></div>

            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-xs transition-transform ${isAdmin ? 'bg-indigo-50 border border-indigo-200/60 text-indigo-600 group-hover:scale-110' : 'bg-slate-200 border border-slate-300 text-slate-400'}`}>
              <ShieldCheck className="w-7 h-7" />
            </div>

            <h3 className={`text-2xl font-bold mb-3 transition-colors ${isAdmin ? 'text-slate-900 group-hover:text-indigo-700' : 'text-slate-500'}`}>Admin Dashboard</h3>
            <p className={`mb-6 leading-relaxed flex-grow ${isAdmin ? 'text-slate-600' : 'text-slate-500'}`}>
              Access holistic patient insights, track organizational wellbeing trends, and monitor conversational risk factors through our advanced telemetry.
            </p>

            <div className={`flex items-center font-bold mt-auto transition-transform ${isAdmin ? 'text-indigo-600 group-hover:translate-x-2' : 'text-slate-500'}`}>
              {isAdmin ? "Go to Dashboard" : "Restricted Access"} {isAdmin && <ArrowRight className="w-5 h-5 ml-2" />}
            </div>
          </button>

        </div>

        {/* Footer info */}
        <div className="mt-24 flex items-center gap-6 text-slate-500 text-sm font-medium animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Confidential & Secure</div>
          <div className="w-1 h-1 rounded-full bg-slate-300"></div>
          <div className="flex items-center gap-2"><HeartHandshake className="w-4 h-4" /> Empathetic AI</div>
        </div>
      </div>
    </div>
  );
}

// Simple Sparkles icon since it's not imported directly above to avoid clutter
function SparklesIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );
}
