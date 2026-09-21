# 🚨 Samvedna [NHAA] - Real-Time Stress & Trauma Assessment Platform

![Hackathon](https://img.shields.io/badge/Smart_India_Hackathon-Ready-emerald?style=for-the-badge)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

**Samvedna [NHAA]** is an advanced, trauma-informed, multi-modal crisis intervention and stress assessment module. It acts as an empathetic sanctuary for trauma victims while compiling clinical diagnostic assessments strictly for authorized crisis administrators in real-time.

---

## ✨ Key Features

*   🗣️ **Samvedna [NHAA] Trauma Sanctuary**: Provides deeply empathetic, conversational guidance with per-message distress indices, physiological sigh grounding, and emergency helplines. Diagnostic reports remain confidential and are routed strictly to authorized admins.

*   🗣️ **Multi-Modal AI Analysis**: Combines NLP text classification (Hugging Face `DistilRoBERTa`) with physical acoustic analysis using `librosa` to detect vocal tremors, pitch instability, and jitter in the victim's voice.
*   🧠 **Generative Crisis Counselor**: Powered by Google's `gemini-3.6-flash`, the chatbot retains conversation history and generates highly empathetic, context-aware, and actionable survival advice.
*   🛡️ **Heuristic Safety Overrides**: Instantly bypasses AI models to trigger `CRITICAL` risk alerts if extreme-lethality keywords (e.g., *gun, fire, suicide*) are detected.
*   📍 **Automated GPS Dispatch**: Automatically captures the victim's browser geolocation and sends an encrypted HTML email to administrators featuring a live Google Maps coordinate link.
*   📡 **Live Command Center**: Admin dashboard powered by `Socket.io` and `Recharts` providing a real-time, live-updating incident feed and risk distribution charts.

## 🛠️ Architecture & Tech Stack

This project uses a modern microservice architecture, splitting the computationally heavy AI tasks from the fast API routing.

*   **Frontend UI**: React.js, Tailwind CSS v4, Vite, Web Speech API, MediaRecorder API
*   **Gateway Backend**: Node.js, Express, Socket.io, Nodemailer
*   **AI Microservice**: Python, FastAPI, Hugging Face Transformers, Google GenAI SDK, Librosa
*   **Database & Auth**: PostgreSQL (Supabase), Prisma ORM, Firebase Authentication

---

## 🚀 Local Development Setup

Because this project utilizes a microservice architecture, you will need three terminal windows to run the Frontend, Node Gateway, and Python AI Engine simultaneously.

### 1. Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   A PostgreSQL Database (e.g., Supabase)
*   Firebase Project Credentials
*   Google Gemini API Key

### 2. Environment Variables

You must create three `.env` files across the project:

**`frontend/.env`**
```env
VITE_ADMIN_EMAIL="admin@yourdomain.com"
# Add your Firebase VITE_ variables here
```

**`backend-gateway/.env`**
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-gmail-app-password"
ADMIN_EMAIL="admin@yourdomain.com"
```

**`ai-microservice/.env`**
```env
GEMINI_API_KEY="your_google_gemini_api_key"
```

### ⚡ Quick Start (1-Click Startup)

Simply double-click `run.bat` in the project root (or run `.\run.bat` in terminal). It automatically boots:
- The **Python AI Microservice** (port 8000)
- The **Node.js Gateway** (port 4000)
- The **React Frontend** (port 5173)
- Automatically launches your browser to `http://localhost:5173/assessment`!

To stop all services anytime, run `stop.bat`.

---

### 3. Manual Installation & Boot Sequence (Alternative)

**Terminal 1: Node.js API Gateway**
```bash
cd backend-gateway
npm install --legacy-peer-deps
npx prisma db push
npm run dev
# Runs on http://localhost:4000
```

**Terminal 2: Python AI Microservice**
```bash
cd ai-microservice
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

**Terminal 3: React Frontend**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 💡 How it Works

1.  **Input**: The victim speaks into the microphone. The browser simultaneously transcribes the text (Web Speech API) and records the raw `.wav` audio.
2.  **Analysis**: The React app sends a `multipart/form-data` request to the Python microservice. The AI calculates a Stress Vulnerability Index (SVI) score from 0.0 to 10.0 based on emotion and vocal acoustics.
3.  **Counseling**: Gemini analyzes the context and sends back a highly empathetic response.
4.  **Routing**: The React app forwards the final score to the Node.js API.
5.  **Alerting**: If the score is `CRITICAL` (>8.0), Node.js grabs the user's GPS coordinates, emits a WebSocket event to update the Admin Dashboard instantly, and fires a priority email to emergency responders.

---
*Built for the Smart India Hackathon*
