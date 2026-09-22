import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let userCredential;
      if (isRegistering) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      
      const token = await userCredential.user.getIdToken();
      
      // Sync with Node.js Gateway to save credentials/user to PostgreSQL
      await fetch('http://localhost:4000/api/users/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Redirect to Landing Page Hub
      navigate('/landingpage');

    } catch (error: any) {
      console.error(error);
      alert(error.message || "Authentication Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/20 to-indigo-50/25">
      <form onSubmit={handleAuth} className="bg-white/85 backdrop-blur-md border border-slate-200/80 p-8 rounded-2xl shadow-lg w-96 text-slate-800">
        <h2 className="text-2xl font-bold mb-6 text-center text-teal-700">
          {isRegistering ? "Create Account" : "SIH Stress Portal"}
        </h2>
        <input 
          type="email" 
          placeholder="Email address" 
          className="w-full mb-4 p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 text-slate-900 placeholder-slate-400"
          value={email} onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full mb-6 p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 text-slate-900 placeholder-slate-400"
          value={password} onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="w-full bg-gradient-to-tr from-teal-500 via-blue-600 to-indigo-600 text-white p-3 rounded-lg font-bold hover:opacity-90 transition-opacity shadow-md shadow-teal-500/20">
          {isRegistering ? "Sign Up" : "Login"}
        </button>
        
        <p className="mt-6 text-center text-sm text-slate-500">
          {isRegistering ? "Already have an account? " : "Don't have an account? "}
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-teal-600 hover:text-teal-700 font-bold ml-1"
          >
            {isRegistering ? "Login" : "Sign Up"}
          </button>
        </p>
      </form>
    </div>
  );
}
