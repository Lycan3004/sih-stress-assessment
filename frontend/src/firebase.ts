import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Replace this with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBV5v8RMEVYhJvkmrX8M-V3J6KLqo-kgmo",
  authDomain: "sih-stress-assessment.firebaseapp.com",
  projectId: "sih-stress-assessment",
  storageBucket: "sih-stress-assessment.firebasestorage.app",
  messagingSenderId: "887278096876",
  appId: "1:887278096876:web:2e7185d5c6ba09a993f0c9",
  measurementId: "G-W7DCDF7QDM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
