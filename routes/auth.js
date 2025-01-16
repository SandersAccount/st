import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

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
            user.name = name; // Update the name if needed
            await user.save();
            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            return res.status(200).json({ user: { id: user._id, email: user.email, name: user.name } });
        }

        // Create new user with hashed password
        user = new User({ email, password, name });
        await user.save(); // This should trigger the password hashing
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.status(201).json({ user: { id: user._id, email: user.email, name: user.name } });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
