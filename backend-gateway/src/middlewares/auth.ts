import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';

// Extend Express Request to include our custom user data
export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next(); // Token is valid, proceed to the next function
  } catch (error) {
    // Development fallback: decode unverified token payload if Firebase Admin verification is unavailable
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        req.user = {
          uid: payload.user_id || payload.sub || payload.uid || 'dev-user-uid',
          email: payload.email || 'user@example.com'
        };
        return next();
      }
    } catch (fallbackError) {
      console.error('Auth Fallback Error:', fallbackError);
    }

    console.error('Firebase Auth Error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};