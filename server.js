import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import './config/database.js';  // Import database connection
import Replicate from 'replicate';
import { saveImageFromUrl, uploadBuffer } from './utils/storage.js';
import { dirname, join } from 'path';
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
import Variable from './models/Variable.js';
import Collection from './models/Collection.js'; 
import Generation from './models/Generation.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Initialize Replicate client
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

const port = process.env.PORT || 3005;

// Auth middleware
const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Admin auth middleware
const adminAuth = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify admin status' });
    }
};

// Admin set credits endpoint
app.post('/api/admin/set-credits', auth, adminAuth, async (req, res) => {
    try {
        const { userId, credits } = req.body;
        const creditsNum = parseInt(credits, 10);
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Set the credits
        user.credits = creditsNum;
        
        // Set hideCredits based on credit value
        user.hideCredits = creditsNum === 456321;

        await user.save();

        // Update credits display through websocket if available
        if (req.app.get('io')) {
            req.app.get('io').to(userId).emit('creditsUpdated', { 
                credits: user.credits,
                hideCredits: user.hideCredits
            });
        }

        res.json({ 
            success: true, 
            credits: user.credits,
            hideCredits: user.hideCredits,
            displayText: user.credits === 456321 ? 'HIDE' : (user.credits === 123654 ? 'Unlimited' : user.credits)
        });
    } catch (error) {
        console.error('Error setting credits:', error);
        res.status(500).json({ error: 'Failed to set credits' });
    }
});

// Update user info endpoint to not show HIDE in user dashboard
app.get('/api/auth/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Set hideCredits flag based on credit value
        const hideCredits = user.credits === 456321;

        res.json({
            id: user._id,
            email: user.email,
            name: user.name,
            credits: user.credits,
            hideCredits: hideCredits,
            role: user.role,
            stickersGenerated: user.stickersGenerated || 0,
            collectionsCount: user.collectionsCount || 0
        });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Public endpoints that don't require auth
app.get('/api/settings', auth, async (req, res) => {
    try {
        console.log('Fetching settings');
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({
                appName: 'Sticker Generator',
                useLogoInstead: false
            });
            await settings.save();
        }
        console.log('Sending settings:', settings);
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// User info endpoint
app.get('/api/auth/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user._id,
            email: user.email,
            name: user.name,
            credits: user.credits,
            hideCredits: user.hideCredits,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Admin notifications endpoint
app.get('/api/admin/notifications', auth, adminAuth, async (req, res) => {
    try {
        // For now, just return an empty array
        res.json({
            notifications: []
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// IPN routes (must be before auth middleware and without authentication)
app.post('/api/ipn/credits/notification', upload.none(), async (req, res) => {
    try {
        console.log('Received WarriorPlus IPN notification:', req.body);
        console.log('Incoming Request Headers:', req.headers);

        // Parse form data
        const event = req.body.event || req.body.WP_ACTION;
        const itemNumber = req.body.itemNumber || req.body.WP_ITEM_NUMBER;
        const buyerEmail = req.body.buyerEmail || req.body.WP_BUYER_EMAIL;
        const buyerName = req.body.buyerName || req.body.WP_BUYER_NAME;
        const securityKey = req.body.securityKey || req.body.WP_SECURITYKEY;
        const transactionStatus = req.body.transactionStatus || req.body.WP_PAYMENT_STATUS;
        const saleId = req.body.saleId || req.body.WP_SALE;

        console.log('Parsed data:', {
            event,
            itemNumber,
            buyerEmail,
            buyerName,
            securityKey,
            transactionStatus,
            saleId
        });

        // Get security key from variables
        const securityVar = await Variable.findOne({ key: 'securityKey' });
        const validKey = securityVar ? securityVar.value : '4350c564f7cef14a92c7ff7ff9c6dce';

        // Validate security key
        if (securityKey !== validKey) {
            console.error('Invalid security key');
            return res.status(401).json({ error: 'Invalid security key' });
        }

        let user = await User.findOne({ email: buyerEmail });
        
        // Get product IDs from variables
        const stickerLabVar = await Variable.findOne({ key: 'stickerLabProduct' });
        const creditsVar = await Variable.findOne({ key: 'creditProducts' });
        
        const stickerLabProductId = stickerLabVar ? stickerLabVar.value.productId : 'wso_svyh7b';
        const creditProducts = creditsVar ? creditsVar.value : [];

        if (!user) {
            // Create a new user without a password if it's a StickerLab purchase
            if (itemNumber === stickerLabProductId) {
                user = new User({
                    email: buyerEmail,
                    name: buyerName,
                    registered: false,
                    creditHistory: [{ product: 'StickerLab', purchasedAt: new Date() }],
                });
                await user.save();
                console.log('New user created from IPN:', user.email);
            } else {
                console.error('Cannot add credits: User not found:', buyerEmail);
                return res.status(404).json({ error: 'User not found' });
            }
        }

        // Update credit history and assign credits based on product
        if (event === 'sale' && transactionStatus.toUpperCase() === 'COMPLETED') {
            let creditsToAdd = 0;
            let productName = '';

            if (itemNumber === stickerLabProductId) {
                creditsToAdd = 100;
                productName = 'StickerLab';
            } else {
                // Find the credit package that matches the product ID
                const creditPackage = creditProducts.find(p => p.productId === itemNumber);
                if (creditPackage) {
                    creditsToAdd = creditPackage.credits;
                    productName = `${creditsToAdd} Credits Package`;
                    console.log('Found credit package:', creditPackage);
                } else {
                    console.log('Unknown product:', itemNumber);
                    return res.status(400).json({ error: 'Unknown product' });
                }
            }

            // Add credits and update history
            user.creditHistory.push({ 
                product: productName, 
                purchasedAt: new Date(),
                credits: creditsToAdd,
                transactionId: saleId
            });
            user.credits = (user.credits || 0) + creditsToAdd;
            await user.save();

            console.log('Credits added successfully:', {
                userId: user._id,
                email: user.email,
                product: productName,
                creditsAdded: creditsToAdd,
                newBalance: user.credits,
                transactionId: saleId
            });

            res.json({
                message: 'Credits added successfully',
                userId: user._id,
                product: productName,
                creditsAdded: creditsToAdd,
                newBalance: user.credits
            });
        } else {
            console.log('Unhandled IPN event or status:', { event, transactionStatus });
            res.json({ message: 'Notification received but no action taken' });
        }
    } catch (error) {
        console.error('Error processing IPN:', error);
        res.status(500).json({ 
            error: 'Failed to process IPN notification',
            details: error.message
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', auth, adminAuth, adminRoutes); // Add both auth middlewares in correct order
app.use('/api/credits', creditsRoutes);
app.use('/api/ipn', ipnRouter);
app.use('/api/variables', variablesRouter);

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Serve static files from the public directory
app.use(express.static(join(__dirname, 'public')));

// Image generation endpoint
app.post('/api/generate', auth, async (req, res) => {
    try {
        const { prompt, style } = req.body;
        console.log('Starting image generation...');
        console.log('User:', req.userId);
        console.log('Prompt:', prompt);
        console.log('Style:', style);

        // Check if user has enough credits
        const user = await User.findById(req.userId);
        if (user.credits < 1) {
            return res.status(403).json({ error: 'Not enough credits' });
        }

        if (!process.env.REPLICATE_API_TOKEN) {
            console.error('REPLICATE_API_TOKEN not found in environment variables');
            return res.status(500).json({ error: 'Replicate API token not configured' });
        }

        // Combine prompt with style if provided
        const fullPrompt = style ? `${prompt}, ${style}` : prompt;
        console.log('Full prompt:', fullPrompt);

        const modelVersion = "fofr/sticker-maker:4acb778eb059772225ec213948f0660867b2e03f277448f18cf1800b96a65a1a";
        
        console.log('Calling Replicate API...');
        const output = await replicate.run(
            modelVersion,
            {
                input: {
                    steps: 17,
                    width: 1152,
                    height: 1152,
                    prompt: fullPrompt,
                    output_format: "png",
                    output_quality: 100,
                    negative_prompt: "ugly, blurry, poor quality, distorted",
                    number_of_images: 1
                }
            }
        );

        console.log('Replicate API response:', output);

        if (!output || !Array.isArray(output) || output.length === 0) {
            console.error('Invalid output from Replicate:', output);
            throw new Error('Invalid output from image generation');
        }

        // Save the image to B2
        const imageUrl = output[0];
        console.log('Saving image from URL:', imageUrl);
        const savedImage = await saveImageFromUrl(imageUrl);
        console.log('Image saved to B2:', savedImage);

        // Create the generation record
        const generation = new Generation({
            userId: new mongoose.Types.ObjectId(req.userId),
            prompt: fullPrompt,
            imageUrl: savedImage.publicUrl,
            status: 'completed'
        });

        await generation.save();
        console.log('Generation saved to database:', generation);

        // Deduct credits
        user.credits -= 1;
        await user.save();

        // Send response
        res.json({
            imageUrl: savedImage.publicUrl,
            generation: generation
        });
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

// Image download endpoint
app.get('/api/download', auth, async (req, res) => {
    try {
        const { imageUrl } = req.query;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Validate the image URL belongs to the user
        const generation = await Generation.findOne({
            imageUrl: imageUrl,
            userId: req.userId
        });

        if (!generation) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Parse the image URL to get file extension and name
        const parsedUrl = new URL(imageUrl);
        const pathParts = parsedUrl.pathname.split('.');
        const extension = pathParts[pathParts.length - 1].toLowerCase();
        const validExtensions = ['png', 'jpg', 'jpeg', 'webp'];
        
        if (!validExtensions.includes(extension)) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        // Determine content type
        const contentType = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp'
        }[extension];

        // Create filename
        const filename = `sticker-${Date.now()}.${extension}`;

        // Set headers for download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3005');

        // Stream the image using axios
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream'
        });

        // Pipe the response stream to the client
        response.data.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download image', details: error.message });
    }
});

// Image upscaling endpoint
app.post('/api/images/upscale', auth, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        console.log('Upscale request received for image:', imageUrl);

        // Check if user has enough credits
        const user = await User.findById(req.userId);
        console.log('User before upscale - ID:', req.userId, 'Credits:', user?.credits);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (user.credits < 1 && user.credits !== 123654) { // Allow if unlimited credits (123654)
            return res.status(403).json({ error: 'Not enough credits' });
        }
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'No image URL provided' });
        }

        // Run the upscale model
        const output = await replicate.run(
            "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
            {
                input: {
                    image: imageUrl,
                    scale: 2,
                    face_enhance: true
                }
            }
        );

        if (!output) {
            throw new Error('No output received from upscale model');
        }

        console.log('Upscale output:', output);

        // Save the upscaled image
        const savedImage = await saveImageFromUrl(output);
        console.log('Saved upscaled image:', savedImage);

        // Create a new generation record for the upscaled image
        const generation = new Generation({
            userId: new mongoose.Types.ObjectId(req.userId),
            prompt: 'Upscaled',
            imageUrl: savedImage.publicUrl,
            originalImage: imageUrl,
            status: 'completed',
            type: 'upscale',
            isUpscaled: true
        });

        await generation.save();
        console.log('Generation saved:', generation);

        // Deduct credits if not unlimited
        let updatedCredits = user.credits;
        if (user.credits !== 123654) {
            // Fetch fresh user data to avoid race conditions
            const freshUser = await User.findById(req.userId);
            if (!freshUser) {
                throw new Error('User not found during credit deduction');
            }
            
            if (freshUser.credits < 1 && freshUser.credits !== 123654) {
                throw new Error('Insufficient credits');
            }

            freshUser.credits -= 1;
            await freshUser.save();
            updatedCredits = freshUser.credits;
            console.log('Credits deducted. New balance:', updatedCredits);
            
            // Dispatch credit update event through websocket if available
            if (req.app.get('io')) {
                req.app.get('io').to(req.userId).emit('creditsUpdated', { credits: updatedCredits });
            }
        }

        res.json({
            success: true,
            imageUrl: savedImage.publicUrl,
            generationId: generation._id,
            credits: updatedCredits
        });

    } catch (error) {
        console.error('Error in upscale:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to upscale image',
            details: error.stack
        });
    }
});

// Download endpoint
app.get('/api/download', async (req, res) => {
    const { imageUrl } = req.query;
    
    if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
        // Fetch the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }

        // Get the content type
        const contentType = response.headers.get('content-type');
        
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="image-${Date.now()}.${contentType.split('/')[1]}"`);

        // Pipe the response to the client
        response.body.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download image' });
    }
});

// Background removal endpoint
app.post('/api/images/bgremove', auth, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        console.log('Background removal request received for image:', imageUrl);
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Extract the filename from the URL
        const urlParts = imageUrl.split('/');
        const originalFilename = urlParts[urlParts.length - 1];
        console.log('Original filename:', originalFilename);

        // Validate the image URL belongs to the user
        const generation = await Generation.findOne({
            userId: req.userId,
            imageUrl: { $regex: new RegExp(originalFilename + '$') }
        });

        console.log('Found generation:', generation);

        if (!generation) {
            return res.status(404).json({ error: 'Image not found' });
        }

        console.log('Starting background removal...');
        const modelVersion = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";
        
        console.log('Calling Replicate API with image:', imageUrl);
        const output = await replicate.run(
            modelVersion,
            {
                input: {
                    image: imageUrl,
                    format: "png",
                    reverse: false,
                    threshold: 0,
                    background_type: "rgba"
                }
            }
        );

        console.log('Replicate API response:', output);

        if (!output) {
            console.error('Invalid output from Replicate:', output);
            throw new Error('Failed to get processed image URL from Replicate');
        }

        // Handle both array and string responses from Replicate
        const processedImageUrl = Array.isArray(output) ? output[0] : output;
        console.log('Processed image URL:', processedImageUrl);

        if (!processedImageUrl || typeof processedImageUrl !== 'string') {
            throw new Error('Invalid processed image URL from Replicate');
        }

        // Download and save the processed image
        console.log('Downloading processed image...');
        const savedImage = await saveImageFromUrl(processedImageUrl, false, 'nobg');
        console.log('Saved image:', savedImage);

        if (!savedImage || !savedImage.publicUrl) {
            console.error('Failed to save image:', savedImage);
            throw new Error('Failed to save processed image');
        }

        // Update the generation record
        generation.imageUrl = savedImage.publicUrl;
        await generation.save();

        res.json({
            imageUrl: savedImage.publicUrl
        });
    } catch (error) {
        console.error('Error in background removal:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Failed to remove background',
            details: error.message
        });
    }
});

// Auth routes
app.get('/login', (req, res) => {
    const token = req.cookies.JWT_TOKEN;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.redirect('/');
        } catch (error) {
            // Invalid token, continue to login page
        }
    }
    res.sendFile(join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'register.html')); 
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Set cookie with token
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        // Send response
        res.json({
            user: {
                _id: user._id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// Protected routes - require authentication
app.get('/collections', auth, async (req, res) => {
    console.log('Serving collections page for user:', req.userId);
    res.sendFile(join(__dirname, 'public', 'collections.html'));
});

app.get('/generate', auth, async (req, res) => {
    console.log('Serving generate page for user:', req.userId);
    res.sendFile(join(__dirname, 'public', 'generate.html'));
});

app.get('/profile', auth, async (req, res) => {
    console.log('Serving profile page for user:', req.userId);
    res.sendFile(join(__dirname, 'public', 'profile.html'));
});

app.get('/index.html', auth, async (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/admin', auth, adminAuth, async (req, res) => {
    res.sendFile(join(__dirname, 'public', 'admin.html'));
});

app.get('/admin-variables', auth, adminAuth, async (req, res) => {
    res.sendFile(join(__dirname, 'public', 'admin-variables.html'));
});

app.get('/api/admin/users', auth, adminAuth, async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/api/admin/stats', auth, adminAuth, async (req, res) => {
    try {
        // Get user statistics
        const totalUsers = await User.countDocuments();
        const proUsers = await User.countDocuments({ 'subscription.plan': 'pro' });
        const totalGenerations = await Generation.countDocuments();

        // Get recent activity
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('-password');

        const recentGenerations = await Generation.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'name email');

        res.json({
            users: {
                total: totalUsers,
                pro: proUsers
            },
            generations: {
                total: totalGenerations
            },
            recent: {
                users: recentUsers,
                generations: recentGenerations
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

// Toggle user role
app.put('/api/admin/users/:id/role', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isAdmin = !user.isAdmin;
        await user.save();

        res.json({ success: true, user });
    } catch (error) {
        console.error('Error toggling user role:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// Update user plan
app.post('/api/admin/users/:userId/plan', auth, adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { plan } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { plan } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error updating user plan:', error);
        res.status(500).json({ error: 'Failed to update user plan' });
    }
});

// Public routes
app.get('/auth', (req, res) => {
    // If user is already logged in, redirect to home
    const token = req.cookies.token;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.redirect('/');
        } catch (error) {
            // Token is invalid, continue to auth page
        }
    }
    res.sendFile(join(__dirname, 'public', 'auth.html'));
});

// API routes - Update to be user-specific
app.get('/api/generations', auth, async (req, res) => {
    try {
        const generations = await Generation.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        // Add isUpscaled flag based on filename
        const enhancedGenerations = generations.map(gen => {
            const doc = gen.toObject();
            doc.isUpscaled = doc.imageUrl.toLowerCase().endsWith('output.png');
            return doc;
        });

        res.json(enhancedGenerations);
    } catch (error) {
        console.error('Error fetching generations:', error);
        res.status(500).json({ error: 'Failed to fetch generations' });
    }
});

app.get('/api/generations/recent', auth, async (req, res) => {
    try {
        console.log('Fetching recent generations for user:', req.userId);
        const generations = await Generation
            .find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(20);
        
        console.log('Found', generations.length, 'recent generations');
        
            const generationsWithUrls = generations.map(gen => {
            // Normalize image URL to match GenerationCard expectations
            let normalizedUrl = gen.imageUrl;
            if (normalizedUrl) {
                // Handle local storage URLs
                if (!normalizedUrl.startsWith('http')) {
                    normalizedUrl = `${process.env.PUBLIC_URL || 'http://localhost:3005'}${normalizedUrl}`;
                }
                
                // Normalize file extensions
                normalizedUrl = normalizedUrl
                    .replace(/-webp$/, '.webp')
                    .replace(/-png$/, '.png')
                    .replace(/-jpg$/, '.jpg')
                    .replace(/-jpeg$/, '.jpeg');
            }
            
            return {
                _id: gen._id,
                prompt: gen.prompt,
                imageUrl: normalizedUrl,
                status: gen.status,
                createdAt: gen.createdAt
            };
        });

        res.json(generationsWithUrls);
    } catch (error) {
        console.error('Error fetching recent generations:', error);
        res.status(500).json({ error: 'Failed to fetch recent generations' });
    }
});

// Delete generation endpoint
app.delete('/api/generations/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Log the incoming request
        console.log('Delete request:', {
            id,
            userId: req.userId,
            headers: req.headers
        });

        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected. Current state:', mongoose.connection.readyState);
            return res.status(500).json({ error: 'Database connection error' });
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.error('Invalid generation ID format:', id);
            return res.status(400).json({ error: 'Invalid generation ID format' });
        }

        // Log the query we're about to make
        console.log('Searching for generation with query:', {
            _id: id,
            userId: req.userId
        });

        // First find the generation to verify ownership
        const generation = await Generation.findOne({
            _id: id,
            userId: req.userId
        });

        if (!generation) {
            console.error('Generation not found or unauthorized. User:', req.userId);
            // Log all generations for this user to help debug
            const userGenerations = await Generation.find({ userId: req.userId });
            console.log('All generations for user:', userGenerations.map(g => g._id));
            return res.status(404).json({ error: 'Generation not found' });
        }

        // Delete the generation
        await Generation.deleteOne({ _id: id });
        console.log('Generation deleted successfully');

        res.json({ success: true, message: 'Generation deleted successfully' });
    } catch (error) {
        console.error('Error deleting generation:', error);
        res.status(500).json({ error: 'Failed to delete generation', details: error.message });
    }
});

// Collections API endpoints - Update to be user-specific
app.post('/api/collections', auth, async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) {
            throw new Error('Title is required');
        }

        const collection = new Collection({
            userId: req.userId,
            title,
            stats: {
                imageCount: 0,
                viewCount: 0,
                lastModified: new Date()
            }
        });
        await collection.save();

        res.json(collection);
    } catch (error) {
        console.error('Error creating collection:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/collections', auth, async (req, res) => {
    try {
        console.log('Fetching collections for user:', req.userId);
        const collections = await Collection.find({ userId: req.userId })
            .sort({ 'stats.lastModified': -1 })
            .populate({
                path: 'images',
                select: 'imageUrl prompt',
                options: { sort: { createdAt: -1 }, limit: 4 }
            });

        console.log('Found collections:', collections);

        // Get preview images for each collection
        const collectionsWithPreviews = collections.map(collection => {
            const collectionObj = collection.toObject();
            console.log('Processing collection:', collectionObj);
            
            // Format image URLs
            const formattedImages = collectionObj.images.map(image => ({
                ...image,
                imageUrl: image.imageUrl.startsWith('http') ? 
                    image.imageUrl : 
                    `${process.env.PUBLIC_URL || 'http://localhost:3005'}${image.imageUrl}`
            }));

            return {
                _id: collectionObj._id,
                title: collectionObj.title,
                stats: collectionObj.stats,
                images: formattedImages
            };
        });

        console.log('Sending collections:', collectionsWithPreviews);
        res.json(collectionsWithPreviews);
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
});

app.get('/api/collections/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            userId: req.userId
        }).populate('images', 'imageUrl prompt'); // Changed imageData to imageUrl to match schema

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Add isUpscaled flag based on URL path
        const enhancedCollection = collection.toObject();
        enhancedCollection.images = enhancedCollection.images.map(image => ({
            ...image,
            isUpscaled: image.imageUrl.includes('/upscaled/')
        }));

        res.json(enhancedCollection);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch collection' });
    }
});

app.get('/collection/:id', auth, async (req, res) => {
    console.log('Serving collection page for user:', req.userId);
    res.sendFile(join(__dirname, 'public', 'collection.html'));
});

app.post('/api/collections/:collectionId/images', auth, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const { imageUrl, prompt } = req.body;

        if (!imageUrl || imageUrl === 'undefined') {
            return res.status(400).json({ error: 'Valid image URL is required' });
        }

        // Find the collection
        const collection = await Collection.findOne({
            _id: collectionId,
            userId: req.userId
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Create a new Generation record
        const generation = new Generation({
            userId: req.userId,
            prompt: prompt || 'No prompt',
            imageUrl: imageUrl,
            fileName: `collection-${Date.now()}.png`,
            status: 'completed'
        });

        await generation.save();

        // Add the generation to the collection's images array
        collection.images.push(generation._id);
        
        // Update collection stats
        collection.stats = {
            ...collection.stats,
            imageCount: collection.images.length,
            lastModified: new Date()
        };

        await collection.save();

        res.json({ 
            message: 'Image added successfully',
            generation: generation,
            collection: collection 
        });
    } catch (error) {
        console.error('Error adding image to collection:', error);
        res.status(500).json({ error: error.message || 'Failed to add image to collection' });
    }
});

app.delete('/api/collections/:collectionId/images/:imageId', auth, async (req, res) => {
    try {
        const { collectionId, imageId } = req.params;

        const collection = await Collection.findOne({
            _id: collectionId,
            userId: req.userId
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Remove image from collection's images array
        collection.images = collection.images.filter(id => id.toString() !== imageId);
        
        // Update collection stats
        collection.stats.imageCount = collection.images.length;
        collection.stats.lastModified = new Date();

        // Update cover image if needed
        if (collection.coverImage && collection.coverImage === imageId) {
            collection.coverImage = collection.images[0] || null;
        }

        await collection.save();

        res.json({ message: 'Image removed from collection' });
    } catch (error) {
        console.error('Error removing image from collection:', error);
        res.status(500).json({ error: 'Failed to remove image from collection' });
    }
});

// User API routes
app.get('/api/auth/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        console.log('Fetched user data:', user);
        res.json(user);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// API route for user profile
app.get('/api/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile
app.put('/api/profile', auth, async (req, res) => {
    try {
        const { name, nickname, bio } = req.body;
        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: { name, nickname, bio } },
            { new: true }
        ).select('-password');
        
        res.json(user);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Serve admin-styles page
app.get('/admin-styles', auth, adminAuth, async (req, res) => {
    res.sendFile(join(__dirname, 'public', 'admin-styles.html'));
});

// Style management endpoints
app.get('/api/admin/styles', auth, adminAuth, async (req, res) => {
    try {
        const styles = await Style.find().sort({ order: 1 });
        
        // Map styles to include correct image URLs
        const mappedStyles = styles.map(style => ({
            _id: style._id,
            name: style.name,
            prompt: style.prompt,
            imageUrl: style.imageUrl.startsWith('http') ? style.imageUrl : `${process.env.PUBLIC_URL}${style.imageUrl}`
        }));

        res.json(mappedStyles);
    } catch (error) {
        console.error('Error fetching styles:', error);
        res.status(500).json({ error: 'Failed to fetch styles' });
    }
});

app.post('/api/admin/styles', auth, adminAuth, upload.single('image'), async (req, res) => {
    try {
        console.log('Received style creation request');
        const { name, prompt } = req.body;
        
        if (!name || !prompt) {
            console.log('Missing required fields:', { name: !!name, prompt: !!prompt });
            return res.status(400).json({ error: 'Name and prompt are required' });
        }

        if (!req.file) {
            console.log('No image file provided');
            return res.status(400).json({ error: 'Image file is required' });
        }

        try {
            console.log('Saving image locally...');
            const imageUrl = await localStyleStorage.saveImage(
                req.file.buffer,
                req.file.originalname
            );
            console.log('Image saved successfully:', imageUrl);

            console.log('Creating style in database...');
            const style = new Style({
                name,
                prompt,
                imageUrl: `/public${imageUrl}`, // Add public prefix to URL
                order: await Style.countDocuments()
            });

            await style.save();
            console.log('Style saved successfully:', style._id);
            res.status(201).json(style);
        } catch (saveError) {
            console.error('Error during style creation:', saveError);
            res.status(500).json({ error: 'Save failed', details: saveError.message });
        }
    } catch (error) {
        console.error('Error adding style:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.delete('/api/admin/styles/:id', auth, adminAuth, async (req, res) => {
    try {
        const style = await Style.findById(req.params.id);
        if (!style) {
            return res.status(404).json({ error: 'Style not found' });
        }

        // Delete image file if it exists
        if (style.imageUrl) {
            try {
                await localStyleStorage.deleteImage(style.imageUrl);
            } catch (error) {
                console.error('Error deleting old image:', error);
            }
        }

        await style.deleteOne();
        res.json({ message: 'Style deleted successfully' });
    } catch (error) {
        console.error('Error deleting style:', error);
        res.status(500).json({ error: 'Failed to delete style' });
    }
});

// Get all styles with sorting
app.get('/api/styles', auth, async (req, res) => {
    try {
        const { sortBy = 'order', sortOrder = 'asc' } = req.query;
        
        // Validate sort parameters
        const validSortFields = ['name', 'order'];
        const validSortOrders = ['asc', 'desc'];
        
        if (!validSortFields.includes(sortBy) || !validSortOrders.includes(sortOrder)) {
            return res.status(400).json({ error: 'Invalid sort parameters' });
        }

        // Create sort object
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        
        const styles = await Style.find().sort(sort);
        res.json(styles);
    } catch (error) {
        console.error('Error fetching styles:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/styles', auth, upload.single('image'), async (req, res) => {
    try {
        console.log('Received style creation request');
        const { name, prompt } = req.body;
        
        if (!name || !prompt) {
            console.log('Missing required fields:', { name: !!name, prompt: !!prompt });
            return res.status(400).json({ error: 'Name and prompt are required' });
        }

        if (!req.file) {
            console.log('No image file provided');
            return res.status(400).json({ error: 'Image file is required' });
        }

        try {
            console.log('Saving image locally...');
            const imageUrl = await localStyleStorage.saveImage(
                req.file.buffer,
                req.file.originalname
            );
            console.log('Image saved successfully:', imageUrl);

            console.log('Creating style in database...');
            const style = new Style({
                name,
                prompt,
                imageUrl,
                order: await Style.countDocuments()
            });

            await style.save();
            console.log('Style saved successfully:', style._id);
            res.status(201).json(style);
        } catch (saveError) {
            console.error('Error during style creation:', saveError);
            res.status(500).json({ error: 'Save failed', details: saveError.message });
        }
    } catch (error) {
        console.error('Error adding style:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.put('/api/styles/:id', auth, upload.single('image'), async (req, res) => {
    try {
        const { name, prompt } = req.body;
        const updateData = { name, prompt };

        const style = await Style.findById(req.params.id);
        if (!style) {
            return res.status(404).json({ error: 'Style not found' });
        }

        // If new image is uploaded
        if (req.file) {
            // Delete old image if it exists
            if (style.imageUrl) {
                try {
                    await localStyleStorage.deleteImage(style.imageUrl);
                } catch (error) {
                    console.error('Error deleting old image:', error);
                }
            }

            // Save new image
            updateData.imageUrl = await localStyleStorage.saveImage(
                req.file.buffer,
                req.file.originalname
            );
        }

        // Update style
        Object.assign(style, updateData);
        await style.save();
        
        res.json(style);
    } catch (error) {
        console.error('Error updating style:', error);
        res.status(500).json({ error: 'Failed to update style', details: error.message });
    }
});

app.delete('/api/styles/:id', auth, async (req, res) => {
    try {
        const style = await Style.findById(req.params.id);
        if (!style) {
            return res.status(404).json({ error: 'Style not found' });
        }

        // Delete image file if it exists
        if (style.imageUrl) {
            try {
                await localStyleStorage.deleteImage(style.imageUrl);
            } catch (error) {
                console.error('Error deleting image:', error);
            }
        }

        await style.deleteOne();
        res.json({ message: 'Style deleted successfully' });
    } catch (error) {
        console.error('Error deleting style:', error);
        res.status(500).json({ error: 'Failed to delete style' });
    }
});

// Get a single style by ID
app.get('/api/styles/:id', auth, async (req, res) => {
    try {
        const style = await Style.findById(req.params.id);
        if (!style) {
            return res.status(404).json({ error: 'Style not found' });
        }
        res.json(style);
    } catch (error) {
        console.error('Error fetching style:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/styles/order', auth, async (req, res) => {
    try {
        const { styles } = req.body;
        
        if (!Array.isArray(styles)) {
            return res.status(400).json({ error: 'Invalid styles array' });
        }

        // Update each style's order
        await Promise.all(styles.map(async ({ id, order }) => {
            await Style.findByIdAndUpdate(id, { order });
        }));

        res.json({ message: 'Order updated successfully' });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Get settings endpoint
app.get('/api/settings', auth, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update settings
app.put('/api/settings', auth, async (req, res) => {
    try {
        console.log('Updating settings:', req.body);
        
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }

        // Update text fields
        if (req.body.appName) settings.appName = req.body.appName;
        if (req.body.mainTitle) settings.mainTitle = req.body.mainTitle;
        
        // Update useLogoInstead
        settings.useLogoInstead = req.body.useLogoInstead === 'true';
        console.log('Use logo instead:', settings.useLogoInstead);

        // Handle logo upload
        if (req.file && settings.useLogoInstead) {
            console.log('Processing logo upload');
            try {
                const logoUrl = await localStyleStorage.saveImage(
                    req.file.buffer,
                    'logo-' + Date.now() + '-' + req.file.originalname
                );
                
                // Delete old logo if it exists
                if (settings.logoUrl) {
                    try {
                        await localStyleStorage.deleteImage(settings.logoUrl);
                    } catch (error) {
                        console.error('Error deleting old logo:', error);
                    }
                }
                
                settings.logoUrl = logoUrl;
                console.log('New logo URL:', logoUrl);
            } catch (error) {
                console.error('Error saving logo:', error);
                return res.status(500).json({ error: 'Failed to save logo' });
            }
        } else if (!settings.useLogoInstead) {
            // If not using logo, clear the logo URL
            settings.logoUrl = null;
        }

        await settings.save();
        console.log('Settings saved successfully');
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Add generation to collection
app.post('/api/collections/:collectionId/generations', auth, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const { imageUrl, prompt } = req.body;

        // Find the collection
        const collection = await Collection.findOne({
            _id: collectionId,
            userId: req.userId
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Create a new generation
        const generation = new Generation({
            userId: req.userId,
            prompt: prompt,
            imageUrl: imageUrl,
            status: 'completed'
        });

        await generation.save();
        console.log('Generation saved:', generation);

        // Add generation to collection
        collection.images.push(generation._id);
        collection.stats.imageCount = collection.images.length;
        collection.stats.lastModified = new Date();
        await collection.save();

        res.json({ success: true, collection });
    } catch (error) {
        console.error('Error adding to collection:', error);
        res.status(500).json({ error: 'Failed to add to collection' });
    }
});

// Image download endpoint
app.get('/api/download', auth, async (req, res) => {
    try {
        const { imageUrl } = req.query;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Validate the image URL belongs to the user
        const generation = await Generation.findOne({
            imageUrl: imageUrl,
            userId: req.userId
        });

        if (!generation) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Parse the image URL to get file extension and name
        const parsedUrl = new URL(imageUrl);
        const pathParts = parsedUrl.pathname.split('.');
        const extension = pathParts[pathParts.length - 1].toLowerCase();
        const validExtensions = ['png', 'jpg', 'jpeg', 'webp'];
        
        if (!validExtensions.includes(extension)) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        // Determine content type
        const contentType = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp'
        }[extension];

        // Create filename
        const filename = `sticker-${Date.now()}.${extension}`;

        // Set headers for download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3005');

        // Stream the image using axios
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream'
        });

        // Pipe the response stream to the client
        response.data.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download image', details: error.message });
    }
});

// Get all collections for the authenticated user
app.get('/api/collections', auth, async (req, res) => {
    try {
        const collections = await Collection.find({ userId: req.userId })
            .select('title stats')
            .lean();
        
        // Add imageCount to stats if it doesn't exist
        const collectionsWithStats = collections.map(collection => ({
            ...collection,
            stats: {
                ...collection.stats,
                imageCount: collection.stats?.imageCount || 0
            }
        }));
        
        res.json(collectionsWithStats);
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
});

app.get('/api/collections/:collectionId/generations', auth, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.collectionId,
            userId: req.userId
        }).populate('generations');

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Add isUpscaled flag based on filename
        const enhancedGenerations = collection.generations.map(gen => {
            const doc = gen.toObject();
            doc.isUpscaled = doc.imageUrl.toLowerCase().endsWith('output.png');
            return doc;
        });

        res.json(enhancedGenerations);
    } catch (error) {
        console.error('Error fetching collection generations:', error);
        res.status(500).json({ error: 'Failed to fetch generations' });
    }
});

// Face to Sticker endpoint
app.post('/api/face-to-sticker', auth, upload.single('image'), async (req, res) => {
    try {
        console.log('Face to sticker request received');
        const { prompt, style } = req.body;
        const imageFile = req.file;

        console.log('Request body:', req.body);
        console.log('Image file:', imageFile);

        // Check if user has enough credits
        const user = await User.findById(req.userId);
        console.log('User before face-to-sticker - ID:', req.userId, 'Credits:', user?.credits);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (user.credits < 1 && user.credits !== 123654) { // Allow if unlimited credits (123654)
            return res.status(403).json({ error: 'Not enough credits' });
        }
        
        if (!imageFile) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Combine prompt and style
        const fullPrompt = style ? `${prompt || ''} ${style}`.trim() : (prompt || '');
        console.log('Processing image with prompt:', fullPrompt);

        // Save the uploaded image and get its URL
        let imageUrl;
        try {
            const uploadResult = await uploadBuffer(imageFile.buffer, 'face-upload');
            imageUrl = uploadResult.url || uploadResult.publicUrl; // Handle different response formats
            console.log('Image saved successfully:', imageUrl);
        } catch (uploadError) {
            console.error('Error saving image:', uploadError);
            return res.status(500).json({ error: 'Failed to process uploaded image', details: uploadError.message });
        }

        if (!imageUrl) {
            return res.status(500).json({ error: 'Failed to get image URL after upload' });
        }

        console.log('Running face-to-sticker model with image URL:', imageUrl);

        // Run the face-to-sticker model
        const output = await replicate.run(
            "fofr/face-to-sticker:764d4827ea159608a07cdde8ddf1c6000019627515eb02b6b449695fd547e5ef",
            {
                input: {
                    image: imageUrl,
                    steps: 20,
                    width: 1024,
                    height: 1024,
                    prompt: fullPrompt,
                    negative_prompt: "ugly, blurry, poor quality, distorted",
                    guidance_scale: 7.5
                }
            }
        );

        console.log('Model output:', output);

        if (!output || !Array.isArray(output) || output.length === 0) {
            return res.status(500).json({ error: 'Invalid output from face-to-sticker model' });
        }

        // Save the generated image
        const generatedImageUrl = output[0];
        console.log('Saving generated image:', generatedImageUrl);
        const savedImage = await saveImageFromUrl(generatedImageUrl);

        // Create generation record
        const generation = new Generation({
            userId: new mongoose.Types.ObjectId(req.userId),
            prompt: fullPrompt,
            imageUrl: savedImage.publicUrl,
            originalImage: imageUrl,
            status: 'completed',
            type: 'face-to-sticker'
        });

        await generation.save();
        console.log('Generation saved:', generation);

        // Deduct credits if not unlimited
        let updatedCredits = user.credits;
        if (user.credits !== 123654) {
            // Fetch fresh user data to avoid race conditions
            const freshUser = await User.findById(req.userId);
            if (!freshUser) {
                throw new Error('User not found during credit deduction');
            }
            
            if (freshUser.credits < 1 && freshUser.credits !== 123654) {
                throw new Error('Insufficient credits');
            }

            freshUser.credits -= 1;
            await freshUser.save();
            updatedCredits = freshUser.credits;
            console.log('Credits deducted. New balance:', updatedCredits);
            
            // Dispatch credit update event through websocket if available
            if (req.app.get('io')) {
                req.app.get('io').to(req.userId).emit('creditsUpdated', { credits: updatedCredits });
            }
        }

        res.json({
            success: true,
            imageUrl: savedImage.publicUrl,
            generationId: generation._id,
            credits: updatedCredits
        });

    } catch (error) {
        console.error('Error in face-to-sticker:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to process image',
            details: error.stack
        });
    }
});

// Upload endpoint for canvas images
app.post('/api/upload', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        console.log('Uploading canvas image, size:', req.file.size);

        // Save the uploaded file
        const result = await uploadBuffer(req.file.buffer, 'canvas-uploads');

        res.json({
            imageUrl: result.publicUrl
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ 
            error: 'Failed to upload image',
            details: error.message
        });
    }
});

// Mount routes
// Removed duplicate route mounts

// Catch-all route to handle client-side routing
app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Check authentication for protected routes
    const token = req.cookies.token;
    if (!token && (req.path === '/' || req.path.startsWith('/collection/') || req.path === '/collections')) {
        return res.redirect('/login');
    }
    
    // Serve index.html for all other routes
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

import { initializeVariables } from './routes/variables.js';

async function startServer(initialPort = 3005) {
    try {
        // Initialize variables in the database
        await initializeVariables();
        
        const server = app.listen(initialPort, () => {
            console.log(`Server is running on port ${initialPort}`);
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.log(`Port ${initialPort} is in use, trying ${initialPort + 1}`);
                server.close();
                startServer(initialPort + 1);
            }
        });

        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

app.post('/api/admin/set-credits', auth, adminAuth, async (req, res) => {
    try {
        const { userId, credits } = req.body;
        const creditsNum = parseInt(credits, 10);
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Set the credits
        user.credits = creditsNum;
        
        // Set hideCredits based on credit value
        user.hideCredits = creditsNum === 456321;

        await user.save();

        // Update credits display through websocket if available
        if (req.app.get('io')) {
            req.app.get('io').to(userId).emit('creditsUpdated', { 
                credits: user.credits,
                hideCredits: user.hideCredits
            });
        }

        res.json({ 
            success: true, 
            credits: user.credits,
            hideCredits: user.hideCredits,
            displayText: user.credits === 456321 ? 'HIDE' : (user.credits === 123654 ? 'Unlimited' : user.credits)
        });
    } catch (error) {
        console.error('Error setting credits:', error);
        res.status(500).json({ error: 'Failed to set credits' });
    }
});

app.get('/api/auth/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Set hideCredits flag based on credit value
        const hideCredits = user.credits === 456321;

        res.json({
            id: user._id,
            email: user.email,
            name: user.name,
            credits: user.credits,
            hideCredits: hideCredits,
            role: user.role,
            stickersGenerated: user.stickersGenerated || 0,
            collectionsCount: user.collectionsCount || 0
        });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});
