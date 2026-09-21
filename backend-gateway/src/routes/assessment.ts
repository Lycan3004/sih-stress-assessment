import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, AuthRequest } from '../middlewares/auth';
import nodemailer from 'nodemailer';

const router = Router();
const prisma = new PrismaClient();

// Configure Nodemailer (Use your real credentials in production/SIH)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Save a new AI assessment to the database
router.post('/', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { textInput, sviScore, riskLevel, location } = req.body;
    
    // Find the user by their Firebase UID
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found in database' });
      return;
    }

    // Create the assessment record
    const assessment = await prisma.assessment.create({
      data: {
        userId: user.id,
        textInput: typeof req.body.textInput === 'object' ? JSON.stringify(req.body.textInput) : req.body.textInput,
        sviScore: typeof sviScore === 'number' ? sviScore : parseFloat(sviScore) || 5.0,
        riskLevel
      }
    });

    // Send an email if risk level is CRITICAL
    if (riskLevel === 'CRITICAL') {
      const locationLink = location 
        ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}">${location}</a>` 
        : 'Location unavailable';

      const mailOptions = {
        from: process.env.EMAIL_USER || 'system@sih.com',
        to: process.env.ADMIN_EMAIL || 'admin@sih.com', // Where alerts should go
        subject: '🚨 URGENT: Critical Stress Level Detected by Samvedna [NHAA]!',
        html: `
          <h2 style="color: #d32f2f;">EMERGENCY ALERT: CRITICAL RISK DETECTED BY SAMVEDNA [NHAA]</h2>
          <p><strong>User Email:</strong> ${user.email}</p>
          <p><strong>Stress Score:</strong> <span style="color: red; font-weight: bold;">${sviScore}/10.0</span></p>
          <p><strong>GPS Coordinates:</strong> ${locationLink}</p>
          <hr />
          <p><strong>Victim Transcript:</strong><br/>
          <em>"${typeof textInput === 'string' ? textInput : JSON.stringify(textInput)}"</em></p>
          <br/>
          <p>Please check the admin command center and dispatch resources immediately.</p>
        `
      };
      
      transporter.sendMail(mailOptions).then(() => {
        console.log(`📧 Critical Alert Email sent for user ${user.email}`);
      }).catch(err => console.error("Email failed to send:", err));
    }

    const io = req.app.get('io');
    if(io) io.emit('new_assessment', { 
      ...assessment, 
      user: user, 
      location, 
      reportData: req.body.reportData || null 
    });

    res.status(201).json({ ...assessment, reportData: req.body.reportData });
  } catch (error) {
    console.error('Save Assessment Error:', error);
    res.status(500).json({ error: 'Failed to save assessment' });
  }
});

// Get all assessments (For the Admin Dashboard)
router.get('/', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assessments = await prisma.assessment.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

export default router;
