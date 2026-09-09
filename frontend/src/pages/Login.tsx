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

      // Role-based Redirection
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || "admin@sih.com";
      if (email.toLowerCase() === adminEmail.toLowerCase()) {
        navigate('/dashboard');
      } else {
        navigate('/assessment');
      }

    } catch (error: any) {
      console.error(error);
      alert(error.message || "Authentication Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <form onSubmit={handleAuth} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-96 text-slate-200">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">
          {isRegistering ? "Create Account" : "SIH Stress Portal"}
        </h2>
        <input 
          type="email" 
          placeholder="Email address" 
          className="w-full mb-4 p-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
          value={email} onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full mb-6 p-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
          value={password} onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">
          {isRegistering ? "Sign Up" : "Login"}
        </button>
        
        <p className="mt-6 text-center text-sm text-slate-400">
          {isRegistering ? "Already have an account? " : "Don't have an account? "}
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-blue-400 hover:text-blue-300 font-semibold"
          >
            {isRegistering ? "Login" : "Sign Up"}
          </button>
        </p>
      </form>
    </div>
  );
}
