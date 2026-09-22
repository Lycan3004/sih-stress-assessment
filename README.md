# 🚨 Samvedna [NHAA] - Real-Time Stress & Trauma Assessment Platform

![Hackathon](https://img.shields.io/badge/Smart_India_Hackathon-Ready-emerald?style=for-the-badge)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)

**Samvedna [NHAA]** (संवेदना — signifying deep empathy and shared emotional support) is an advanced, trauma-informed, multi-modal crisis intervention and stress assessment platform. It acts as an empathetic sanctuary for trauma victims while compiling clinical diagnostic assessments strictly for authorized crisis administrators in real-time.

---

## ✨ Key Features

*   🗣️ **Samvedna [NHAA] Trauma Sanctuary (`/assessment`)**: Provides deeply empathetic, conversational guidance with per-message distress indices, physiological sigh breathwork grounding, and 24/7 emergency helplines. Diagnostic reports remain confidential and are routed strictly to authorized admins.
*   🎙️ **Multi-Modal AI Analysis**: Combines NLP text classification (Hugging Face `DistilRoBERTa`) with physical acoustic analysis using `librosa` to detect vocal tremors, pitch instability, and jitter in the victim's voice.
*   🧠 **Generative Crisis Counselor**: Powered by Google Gemini (`gemini-3.5-flash-lite` / `gemini-3.6-flash`), the counselor retains conversation history and generates context-aware, calming, and actionable survival advice. Includes a resilient local topic-extraction NLP fallback if Gemini is offline.
*   🛡️ **Heuristic Safety Overrides**: Instantly bypasses AI models to trigger `CRITICAL` risk alerts if extreme-lethality keywords (weapons, suicide, self-harm, fire) are detected across multiple languages (English, Hindi, Hinglish, etc.).
*   📍 **Automated GPS Dispatch**: Automatically captures the victim's browser geolocation and sends an alert email to administrators featuring a live Google Maps coordinate link.
*   📡 **Live Command Center (`/dashboard`)**: Admin dashboard powered by `Socket.io` and `Recharts` providing a real-time, live-updating incident feed, risk distribution charts, and clinical dossier exports.

---

## 🛠️ Architecture & Tech Stack

This project uses a decoupled microservice architecture:

*   **Frontend UI (`frontend`)**: React 19, Tailwind CSS v4, Vite, Web Speech API, Web Audio API (PCM 16-bit WAV encoder), Lucide Icons, Recharts (`:5173`)
*   **Gateway Backend (`backend-gateway`)**: Node.js, Express, Prisma ORM (SQLite / PostgreSQL), Socket.io, Nodemailer (`:4000`)
*   **AI Microservice (`ai-microservice`)**: Python, FastAPI, Hugging Face Transformers (`DistilRoBERTa`), Google GenAI SDK, Librosa, Whisper (`:8000`)

---

## ⚡ Quick Start (1-Click Startup for Windows)

The easiest way to run the entire platform is with the automated, self-healing startup script:

1. Double-click **`run.bat`** in the project root (or run `.\run.bat` in your terminal).
2. **What `run.bat` does automatically**:
   - Cleans up and frees any lingering processes on ports `8000`, `4000`, and `5173` to prevent `EADDRINUSE` conflicts.
   - Verifies and auto-creates Python virtual environments (`venv`) and installs missing requirements.
   - Verifies Node dependencies and initializes the Prisma SQLite database (`dev.db`).
   - Boots all 3 microservices in dedicated, colored console windows.
   - Waits for services to initialize and automatically opens **`http://localhost:5173/assessment`** in your default browser!

3. **To stop all services anytime**:
   - Double-click **`stop.bat`** (or run `.\stop.bat`).

---

## 🚀 Step-by-Step Manual Installation & Run

If you prefer to run each service manually in separate terminal windows, follow these instructions.

### 1. Prerequisites
*   **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
*   **Python**: 3.10 or 3.11 recommended ([Download Python](https://www.python.org/))
*   **Database**: **Zero database installation required!** The project uses an embedded SQLite database (`dev.db`) out-of-the-box via Prisma. (PostgreSQL is optional for production).

> [!NOTE]
> **Windows PowerShell Execution Policy Note**:
> If PowerShell displays `File npm.ps1 cannot be loaded because running scripts is disabled on this system`, run this command in PowerShell once:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```
> Alternatively, you can use Command Prompt (CMD) or append `.cmd` (e.g., `npm.cmd install`).

---

### 2. Configure Environment Variables

Create `.env` files in their respective folders:

#### **`frontend/.env`**
```env
VITE_ADMIN_EMAIL="admin@sih.com"
```

#### **`backend-gateway/.env`**
```env
PORT=4000
DATABASE_URL="file:./dev.db"
EMAIL_USER="admin@sih.com"
EMAIL_PASS="mock-email-password"
ADMIN_EMAIL="admin@sih.com"
```

#### **`ai-microservice/.env`**
```env
GEMINI_API_KEY="your_google_gemini_api_key"
```
*(Note: If `GEMINI_API_KEY` is not provided, the microservice automatically runs its built-in offline NLP fallback engine).*

---

### 3. Start Each Service

Open three separate terminals:

#### **Terminal 1: Backend Gateway (Port 4000)**
```powershell
cd backend-gateway
npm install
npx prisma generate
npx prisma db push
npm run dev
```
*Server will run at: `http://localhost:4000`*

#### **Terminal 2: Python AI Microservice (Port 8000)**
```powershell
cd ai-microservice

# Create virtual environment (if not already created)
python -m venv venv

# Activate virtual environment:
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows CMD:
# venv\Scripts\activate.bat
# macOS / Linux:
# source venv/bin/activate

# Install dependencies:
pip install -r requirements.txt

# Start the FastAPI engine:
python main.py
```
*AI Microservice will run at: `http://localhost:8000`*

#### **Terminal 3: React Frontend (Port 5173)**
```powershell
cd frontend
npm install
npm run dev
```
*Frontend UI will run at: `http://localhost:5173`*

---

## 🌐 Platform Navigation & URLs

| Destination | URL | Description |
| :--- | :--- | :--- |
| **Victim Trauma Sanctuary** | [http://localhost:5173/assessment](http://localhost:5173/assessment) | Live conversational crisis support, vocal tremor analysis & grounding breathwork. |
| **Admin Command Center** | [http://localhost:5173/dashboard](http://localhost:5173/dashboard) | Live incident streaming, clinical SVI analytics & emergency responder dispatch. |
| **AI Microservice Health** | [http://localhost:8000/health](http://localhost:8000/health) | API health check & Hugging Face model readiness probe. |
| **Backend Gateway** | [http://localhost:4000](http://localhost:4000) | Express REST API & Socket.io server. |

---

## 🧪 Automated Testing & Model Validation

You can verify the AI acoustic analyzer, multi-turn therapist progression, and crisis safety overrides with the included test suite:

```powershell
cd ai-microservice
.\venv\Scripts\python.exe test_therapist_model.py
```

**What the test verifies:**
1. **Acoustic Analysis**: Analyzes synthetic calm vs. stressed audio waveforms for pitch, tremor, and Zero-Crossing Rate (ZCR).
2. **Therapist Progression**: Validates turns 1 through 6 across 4 clinical therapeutic phases (*Intake*, *Root Cause*, *Emotional Validation*, *Resilience*).
3. **Emergency Overrides**: Validates instant `CRITICAL` risk escalation (SVI 10.0) upon detection of acute crisis phrases.

---

## 💡 How It Works (End-to-End Flow)

1. **Voice & Text Input**: The victim speaks into the microphone or types. The frontend transcribes speech and encodes 16kHz PCM 16-bit WAV audio directly in the browser.
2. **Multi-Modal AI Scoring**: The React app posts data to the Python microservice (`/api/analyze`). The AI calculates a Stress Vulnerability Index (SVI) score (0.0 to 10.0) based on vocal tremor, pitch variation, and NLP emotion probabilities.
3. **Empathetic Counseling**: Gemini (or the fallback engine) responds with therapeutic pacing, active listening, and grounding exercises.
4. **Session Reporting**: Upon session completion, the frontend forwards the assessment to the Node.js gateway.
5. **Real-Time Dispatch**: If an assessment reaches `CRITICAL` risk (>8.0), the gateway instantly emits a WebSocket alert to the Admin Command Center and sends an emergency dispatch alert with GPS coordinates.

---

*Built for the Smart India Hackathon*
