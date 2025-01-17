import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import './config/database.js';
import Replicate from 'replicate';
import { saveImageFromUrl } from './utils/storage.js';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import auth from './middleware/auth.js';
import adminAuth from './middleware/adminAuth.js';
import imageGenerator from './services/imageGenerator.js';
import Generation from './models/Generation.js';
import Collection from './models/Collection.js';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Settings from './models/Settings.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscription.js';
import adminRoutes from './routes/admin.js';
import creditsRoutes from './routes/credits.js';
import Style from './models/Style.js';
import multer from 'multer';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { localStyleStorage } from './utils/localStyleStorage.js';
import axios from 'axios';
import ipnRouter from './routes/ipn.js';
import variablesRouter from './routes/variables.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3005;

// Initialize Replicate with API token
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// Auth middleware for protected routes
const authMiddleware = async (req, res, next) => {
    try {
        // Get token from cookie
        const token = req.cookies.token;
        
        if (!token) {
            // Redirect to login page if no token is found
            return res.redirect('/login');
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await User.findById(decoded.userId);
        if (!user) {
            // Redirect to login page if user is not found
            return res.redirect('/login');
        }

        req.user = user; // Attach user to request
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('Authentication error:', error);
        return res.redirect('/login'); // Redirect to login on error
    }
};

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3005',
        'https://sticker-app-xcap.onrender.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());
app.use(cookieParser());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                details: 'File size cannot exceed 5MB'
            });
        }
        return res.status(400).json({
            error: 'File upload error',
            details: err.message
        });
    } else if (err) {
        return res.status(500).json({
            error: 'Server error',
            details: err.message
        });
    }
    next();
});

// Serve static files
app.use(express.static(path.resolve(__dirname, 'public')));
app.use('/storage/images', express.static(path.resolve(__dirname, 'storage', 'images')));
app.use(express.static(__dirname));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/ipn/credits', ipnRouter);
app.use('/api/variables', variablesRouter);

// Admin pages
app.get('/admin', authMiddleware, adminAuth, (req, res) => {
    res.sendFile(join(__dirname, 'admin.html'));
});

app.get('/admin-variables', authMiddleware, adminAuth, (req, res) => {
    res.sendFile(join(__dirname, 'public', 'admin-variables.html'));
});

// Start server
async function startServer(initialPort = 3005) {
    let currentPort = initialPort;
    let maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            app.listen(currentPort, () => {
                console.log(`Server is running on port ${currentPort}`);
                console.log(`Access the app at http://localhost:${currentPort}`);
            });
            break;
        } catch (error) {
            console.log(`Port ${currentPort} is in use, trying next port...`);
            currentPort++;
            attempts++;
        }
    }

    if (attempts === maxAttempts) {
        console.error('Could not find an available port after multiple attempts');
        process.exit(1);
    }
}

startServer();
