# 🚪 Backend Gateway — API & Event Dispatcher

Node.js Express gateway managing PostgreSQL persistence via Prisma ORM, Firebase token authentication, real-time WebSocket incident broadcasting via Socket.io, and Nodemailer emergency GPS dispatch.

---

## 🚀 Features

- **🔐 Firebase Authentication Middleware**: Validates incoming bearer tokens and synchronizes Firebase users into PostgreSQL.
- **📡 Real-Time WebSockets (`Socket.io`)**: Emits `new_assessment` events immediately when new trauma evaluations are logged.
- **🚨 Emergency Dispatcher**: Automatically triggers critical alert emails containing live Google Maps coordinate links for high-lethality situations (`CRITICAL`).
- **🗄️ Prisma ORM**: Structured schema handling `User` and `Assessment` entities with PostgreSQL and `pgvector` preview support.

---

## 🛠️ API Endpoints

### `GET /health`
Returns gateway status and verifies database connectivity:
```json
{
  "status": "OK",
  "message": "Gateway is running",
  "database": "Connected",
  "firebase": "Initialized"
}
```

### `POST /api/users/sync`
- Headers: `Authorization: Bearer <FirebaseIdToken>`
- Syncs the authenticated Firebase user into PostgreSQL.

### `POST /api/assessments`
- Headers: `Authorization: Bearer <FirebaseIdToken>`
- Body: `{ textInput, sviScore, riskLevel, location }`
- Saves assessment, broadcasts to connected WebSockets, and sends email alerts if `riskLevel === 'CRITICAL'`.

### `GET /api/assessments`
- Headers: `Authorization: Bearer <FirebaseIdToken>`
- Fetches all historical assessments ordered by descending timestamp for the admin dashboard.

---

## ⚙️ Environment Variables

Create `.env` in `backend-gateway/`:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sih_db?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/sih_db?schema=public"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
ADMIN_EMAIL="admin@sih.com"
```

---

## 🏃 Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps

# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push

# Start in development mode
npm run dev
# Runs on http://localhost:4000
```
