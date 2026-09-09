import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Sync user from Firebase to our PostgreSQL Database
router.post('/sync', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { uid, email } = req.user!;
    
    if (!email) {
      res.status(400).json({ error: 'Email is required from Firebase token' });
      return;
    }

    // Check if user already exists in DB
    let user = await prisma.user.findUnique({
      where: { firebaseUid: uid }
    });

    // If new user, create them in Postgres
    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: uid,
          email: email,
          // name could be pulled from the request body later if needed
        }
      });
      console.log(`🆕 New user created: ${user.email}`);
    }

    res.status(200).json({ message: 'User synced successfully', user });
  } catch (error) {
    console.error('User Sync Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;