import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Auth from '../middleware/auth.js';
import Generation from '../models/Generation.js';
import Collection from '../models/Collection.js';

const router = express.Router();


// Register user
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if the email was used to purchase StickerLab
    const stickerLabPurchase = await User.findOne({ email: email, 'creditHistory.product': 'StickerLab' });
    if (!stickerLabPurchase) {
      return res.status(400).json({ error: 'Please, register with the same email that you used to purchase the StickerLab.' });
    }

    // Proceed to create the user
    let user = await User.findOne({ email });
    if (user) {
      // If the user exists, we can allow registration without alerts
      user.name = name; // Update the name if needed
      await user.save();
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.status(200).json({ 
        user: { 
          id: user._id, 
          email: user.email, 
          name: user.name 
        }
      });
    }

    // Create new user
    user = new User({ email, password, name });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name 
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', Auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user statistics
        const [generationsCount, collectionsCount] = await Promise.all([
            Generation.countDocuments({ userId: user._id }),
            Collection.countDocuments({ userId: user._id })
        ]);

        // Return user data with statistics
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            credits: user.credits,
            role: user.role,
            subscription: user.subscription,
            statistics: {
                generationsCount,
                collectionsCount
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user profile
router.put('/update', Auth, [
    body('name').notEmpty(),
    body('email').isEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email } = req.body;

        // Check if email is already taken by another user
        if (email !== req.user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email is already taken' });
            }
        }

        // Update user
        req.user.name = name;
        req.user.email = email;
        await req.user.save();

        res.json({ 
            user: { 
                id: req.user._id, 
                email: req.user.email, 
                name: req.user.name 
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout user
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully' });
});

export default router;
