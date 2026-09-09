import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { initializeApp, cert } from 'firebase-admin/app';
import userRoutes from './routes/user';
import assessmentRoutes from './routes/assessment';

// Load environment variables
dotenv.config();

// Initialize Prisma DB Client
const prisma = new PrismaClient();

// Initialize Firebase Admin
// Using a try-catch so the server doesn't crash if the JSON file is missing during early dev
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require('../firebase-service-account.json');
  initializeApp({
    credential: cert(serviceAccount)
  });
  console.log('🔥 Firebase Admin Initialized');
} catch (error) {
  console.warn('⚠️ Firebase Admin could not be initialized. Missing or invalid firebase-service-account.json');
}

// Initialize Express
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/assessments', assessmentRoutes);

// Health Check Route
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Quick DB ping to ensure Prisma is working
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ 
      status: 'OK', 
      message: 'Gateway is running', 
      database: 'Connected',
      firebase: 'Initialized'
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Database disconnected' });
  }
});

import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Attach socket io to the app so our routes can access it
app.set('io', io);

io.on('connection', (socket) => {
  console.log('⚡ A user connected to WebSockets');
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Gateway Server running on http://localhost:${PORT}`);
});