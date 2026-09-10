# 🧠 System Memory & Technical Architecture

## Real-Time Stress & Trauma Assessment Platform (SIH Project)

This document serves as the master architectural reference and context memory for the entire multi-service repository.

---

## 🏗️ 1. High-Level Architecture Overview

The system is designed as a distributed, real-time crisis intervention platform. It bridges high-throughput web clients, an event-driven Node.js API gateway, and a computationally intensive Python AI microservice.

```mermaid
graph TD
    subgraph Client["Frontend Client (React + Vite, Port 5173)"]
        UI["Web UI (Tailwind CSS v4)"]
        Mic["Web Speech API & MediaRecorder (.wav)"]
        FB_Auth["Firebase Client SDK Auth"]
        WS_Client["Socket.io Client"]
    end

    subgraph AI["AI Microservice (Python FastAPI, Port 8000)"]
        FastAPI["FastAPI App (/api/analyze)"]
        HF["Hugging Face DistilRoBERTa (Emotion Classifier)"]
        Librosa["Librosa Acoustic Analyzer (Pitch, ZCR, RMS)"]
        Heuristics["Heuristic Override Engine (Safety Keywords)"]
        Gemini["Google Gemini 3.6 Flash (Empathetic Counselor)"]
    end

    subgraph Gateway["Backend Gateway (Node.js Express, Port 4000)"]
        Express["Express API Server"]
        AuthMid["Firebase Admin Token Verification"]
        Prisma["Prisma ORM Client"]
        SocketIO["Socket.io Server (Real-time Broadcast)"]
        Mailer["Nodemailer Dispatcher (Critical Emergency Alerts)"]
    end

    subgraph Storage["External Services & Storage"]
        Postgres["PostgreSQL Database (Supabase / Local)"]
        FirebaseCloud["Firebase Authentication"]
        SMTP["Gmail SMTP / Mail Server"]
    end

    %% Client Interactions
    UI --> Mic
    UI --> FB_Auth
    FB_Auth <--> FirebaseCloud
    Mic -->|1. Multipart Form Data (Audio + Text)| FastAPI
    UI -->|3. Sync User & Post Assessment| Express
    WS_Client <-->|Live Updates| SocketIO

    %% AI Pipeline
    FastAPI --> HF
    FastAPI --> Librosa
    HF & Librosa --> Heuristics
    Heuristics --> Gemini
    FastAPI -->|2. SVI Score + Risk Level + Remedy| UI

    %% Gateway Interactions
    Express --> AuthMid
    Express --> Prisma
    Prisma <--> Postgres
    Express --> SocketIO
    Express -->|CRITICAL Risk Only| Mailer
    Mailer --> SMTP
```

---

## 🧩 2. Microservice & Component Breakdown

### 2.1. Frontend (`/frontend`)
- **Framework & Tooling**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React icons.
- **Port**: `5173` (`http://localhost:5173`)
- **Key Modules & Pages**:
  1. **`src/firebase.ts`**: Initializes Firebase client authentication with project `sih-stress-assessment`.
  2. **`src/pages/Login.tsx`**:
     - Handles Sign In and Sign Up using Firebase Auth (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`).
     - On successful auth, retrieves the user's ID token and calls `POST http://localhost:4000/api/users/sync` to persist/sync user records in PostgreSQL.
     - Performs role-based redirection: if email matches `VITE_ADMIN_EMAIL` (default: `admin@sih.com`), navigates to `/dashboard`; otherwise redirects to `/assessment`.
  3. **`src/pages/Assessment.tsx`** (Victim Portal):
     - **Microphone & Speech**: Uses `window.webkitSpeechRecognition` or `SpeechRecognition` to transcribe audio live into text, while simultaneously recording binary audio chunks via `navigator.mediaDevices.getUserMedia` + `MediaRecorder` as `audio/wav`.
     - **Geolocation**: Requests `navigator.geolocation.getCurrentPosition` on mount to acquire coordinates (`lat,long`) for emergency dispatch.
     - **Submitting to AI**: Sends `multipart/form-data` containing `text`, conversation `history` (last 6 turns), and raw `audio` (`voice.wav`) to `http://localhost:8000/api/analyze`.
     - **Submitting to Gateway**: Sends the computed `sviScore`, `riskLevel`, `textInput`, and `location` to `POST http://localhost:4000/api/assessments` with Bearer auth token.
     - **Rendering**: Displays conversation history with real-time SVI score badges, risk level tags (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), and AI counselor remedies.
  4. **`src/pages/Dashboard.tsx`** (Command Center / Responder UI):
     - Connects to `http://localhost:4000` via `socket.io-client`.
     - Subscribes to `new_assessment` event for instant real-time incident appending.
     - Fetches historic assessments via `GET http://localhost:4000/api/assessments`.
     - Displays KPI cards: Total Cases, Critical Alerts.
     - Displays Recharts BarChart visualizing the risk distribution (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`).
     - Displays Live Incident Feed table showing User Email, Timestamp, Victim Transcript, SVI Score, and Status.

---

### 2.2. Backend Gateway (`/backend-gateway`)
- **Runtime & Stack**: Node.js, Express 5, TypeScript, Nodemailer, Socket.io, Prisma ORM.
- **Port**: `4000` (`http://localhost:4000`)
- **Key Files & Responsibilities**:
  1. **`src/index.ts`**:
     - Sets up Express, CORS (`*`), JSON body parsing, and HTTP server wrapping `socket.io`.
     - Initializes Firebase Admin using `firebase-service-account.json` (with graceful fallback if file is omitted in local development).
     - Exposes health check endpoint `GET /health` which pings PostgreSQL via `prisma.$queryRaw\`SELECT 1\``.
     - Binds routes `/api/users` and `/api/assessments`.
  2. **`src/middlewares/auth.ts`**:
     - Intercepts requests, validates `Authorization: Bearer <token>` via Firebase Admin Auth `verifyIdToken(token)`.
     - Populates `req.user` with `uid` and `email`.
  3. **`src/routes/user.ts`**:
     - `POST /api/users/sync`: Synchronizes Firebase user records into PostgreSQL via Prisma. Upserts based on `firebaseUid`.
  4. **`src/routes/assessment.ts`**:
     - `POST /api/assessments`: Saves assessment records (`textInput`, `sviScore`, `riskLevel`, `userId`) to PostgreSQL.
     - **Emergency Alert Dispatch**: When `riskLevel === 'CRITICAL'`, automatically dispatches a prioritized HTML alert email using `nodemailer` to `ADMIN_EMAIL`. Formats geolocation coordinates into an active Google Maps link (`https://www.google.com/maps/search/?api=1&query=<lat,long>`).
     - Emits WebSocket event `new_assessment` to all connected clients through `io.emit`.
     - `GET /api/assessments`: Returns all assessments with relations (`include: { user: true }`) sorted by descending timestamp.
  5. **`prisma/schema.prisma`**:
     - Target DB: PostgreSQL (supports `pgvector` preview feature).
     - Models:
       - `User`: `id` (UUID), `firebaseUid` (unique), `email` (unique), `name`, `role` (`VICTIM`, `RESPONDER`, `ADMIN`), `assessments`.
       - `Assessment`: `id` (UUID), `userId` (FK to `User`), `textInput`, `audioUrl`, `sviScore` (Float), `riskLevel` (`PENDING`, `LOW`, `MODERATE`, `HIGH`, `CRITICAL`), `createdAt`.

---

### 2.3. AI Microservice (`/ai-microservice`)
- **Runtime & Stack**: Python 3.11 - 3.14, FastAPI, Uvicorn, Hugging Face Transformers, PyTorch, Librosa, SoundFile, Google GenAI SDK (`google-genai`), Python-dotenv.
- **Port**: `8000` (`http://localhost:8000`)
- **Key Files & Responsibilities**:
  1. **`main.py`**:
     - Exposes `GET /health` for readiness checks.
     - Exposes `POST /api/analyze` accepting `text` (Form), `history` (Form JSON string), and optional `audio` (UploadFile `.wav`).
     - Orchestrates text SVI calculation, audio feature extraction, score aggregation, risk level assignment, and remedy generation.
  2. **`ml/stress_analyzer.py` (`StressAnalyzer`)**:
     - **NLP Emotion Model**: Hugging Face pipeline `j-hartmann/emotion-english-distilroberta-base` for text classification into 7 emotions: `fear`, `sadness`, `anger`, `disgust`, `surprise`, `neutral`, `joy`.
     - **SVI Formula (Text)**:
       $$\text{Total Stress} = \sum (\text{score}_i \times \text{weight}_i)$$
       Weights: `fear`: 1.0, `sadness`: 0.8, `anger`: 0.7, `disgust`: 0.5, `surprise`: 0.4, `neutral`: 0.1, `joy`: 0.0.
       $$\text{SVI} = \text{Total Stress} \times 10.0$$
     - **Heuristic Overrides**:
       - Emergency keywords (`fire`, `gun`, `shoot`, `knife`, `suicide`, `die`, `bleeding`, etc.) add $+2.0$ per match.
       - Lethal keywords (`gun`, `suicide`, `kill myself`, `intruder`, `fire`, `heart attack`) force $\text{SVI} \ge 9.5$.
     - **Acoustic Audio Analysis (`librosa` + `soundfile`)**:
       - Fundamental frequency / pitch via `librosa.piptrack`.
       - Jitter / vocal tremor proxy via Zero Crossing Rate (`zcr`). If `zcr > 0.1`, adds $+1.5$ penalty.
       - Vocal tone/energy via Root Mean Square (`rms`). If `rms > 0.1`, adds $+1.0$ penalty.
       - Final score: $\min(10.0, \text{text\_svi} + \text{audio\_penalty})$.
     - **Risk Categorization**:
       - `CRITICAL`: SVI $\ge 8.0$ (or $\ge 8.5$ with audio)
       - `HIGH`: SVI $\ge 5.5$ (or $\ge 6.0$ with audio)
       - `MODERATE`: SVI $\ge 3.5$ (or $\ge 4.0$ with audio)
       - `LOW`: SVI $< 3.5$
     - **Remedy Counselor**:
       - **Generative**: Uses Google Gemini (`gemini-3.6-flash` via `google.genai.Client`) with conversational context and prompt guidance to generate empathetic, actionable survival instructions.
       - **Heuristic Fallback**: Comprehensive crisis protocol generator covering specific domains: Fire, Flood, Armed Violence / Intruder, Medical Emergencies, Suicide / Self-harm, and 3-2-1 Grounding / Box Breathing exercises.

---

## 🔄 3. End-to-End Operational Lifecycle

1. **User Authentication**:
   - Victim logs in on `http://localhost:5173/login`.
   - Firebase Auth authenticates user $\to$ frontend calls `http://localhost:4000/api/users/sync` $\to$ Gateway ensures user exists in PostgreSQL.
2. **Victim Voice / Text Input**:
   - Victim visits `/assessment`.
   - Browser requests Geolocation permissions (`navigator.geolocation`) and Microphone permissions (`navigator.mediaDevices.getUserMedia`).
   - Victim speaks: Web Speech API streams live text to the input field while MediaRecorder captures raw audio in a `.wav` Blob.
3. **AI Multimodal Evaluation**:
   - Frontend posts text + audio to `http://localhost:8000/api/analyze`.
   - DistilRoBERTa scores text emotion $\to$ Librosa extracts pitch, jitter (ZCR), and energy $\to$ Heuristic checks trigger lethal word overrides $\to$ Gemini generates real-time empathetic remedy.
   - Result payload returns to frontend: `{ svi_score, risk_level, top_emotion, audio_metrics, remedy }`.
4. **Persistence & Escalation**:
   - Frontend forwards assessment data (`sviScore`, `riskLevel`, `textInput`, `location`) to `POST http://localhost:4000/api/assessments`.
   - Backend saves record to database.
   - If `riskLevel === 'CRITICAL'`:
     - Gateway triggers Nodemailer to send high-priority alert email with Google Maps location coordinates to `ADMIN_EMAIL`.
     - Gateway emits `new_assessment` event over WebSockets (`io.emit`).
5. **Command Center Visualization**:
   - Admin viewing `http://localhost:5173/dashboard` receives `new_assessment` WebSocket event.
   - Live incident table updates in real time, KPI counter increments, and Recharts risk distribution graph re-renders immediately.

---

## ⚙️ 4. Environment Variables Reference

### 4.1. `frontend/.env`
```env
VITE_ADMIN_EMAIL="admin@sih.com"
```

### 4.2. `backend-gateway/.env`
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sih_db?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/sih_db?schema=public"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-gmail-app-password"
ADMIN_EMAIL="admin@sih.com"
```

### 4.3. `ai-microservice/.env`
```env
GEMINI_API_KEY="your_google_gemini_api_key"
```

---

## 🖥️ 5. Platform Quirks & Development Notes (Windows)

- **PowerShell Execution Policy**: Node scripts run via PowerShell require `.cmd` extensions (e.g. `npm.cmd`, `npx.cmd`) or execution policy bypass to prevent script execution security errors.
- **Python Dependencies & UV**: Python 3.14 on Windows has limited native wheels for certain C-extension packages (e.g., `psycopg2-binary`). The fast package installer `uv` resolves and caches wheels cleanly.
- **Windows Defender / Smart App Control**: Downloaded PyTorch `.dll` files in OneDrive directories can trigger `WinError 4551` (Application Control policy). Running `Get-Item "path\torch\lib\*.dll" | Unblock-File` unblocks downloaded DLL assets.
- **Prisma**: The backend uses Prisma 5. Generate client via `npx.cmd prisma generate`. For schema synchronization with a live PostgreSQL instance, use `npx.cmd prisma db push`.
