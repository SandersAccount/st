import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import './config/database.js';  // Import database connection
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

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Serve static files
app.use(express.static(path.resolve(__dirname, 'public')));
app.use('/storage/images', express.static(path.resolve(__dirname, 'storage', 'images')));
app.use(express.static(__dirname));

// Image generation endpoint
app.post('/api/generate', authMiddleware, async (req, res) => {
    try {
        const { prompt } = req.body;
        console.log('Starting image generation...');
        console.log('User:', req.user._id);
        console.log('Prompt:', prompt);

        // Check if user has enough credits
        if (req.user.credits < 1) {
            return res.status(403).json({ error: 'Not enough credits' });
        }

        if (!process.env.REPLICATE_API_TOKEN) {
            console.error('REPLICATE_API_TOKEN not found in environment variables');
            return res.status(500).json({ error: 'Replicate API token not configured' });
        }

        const modelVersion = "fofr/sticker-maker:4acb778eb059772225ec213948f0660867b2e03f277448f18cf1800b96a65a1a";
        
        console.log('Calling Replicate API...');
        const output = await replicate.run(
            modelVersion,
            {
                input: {
                    steps: 17,
                    width: 1152,
                    height: 1152,
                    prompt: prompt,
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
            userId: req.user._id,
            prompt: prompt,
            imageUrl: savedImage.publicUrl, // Use the public URL from B2
            status: 'completed'
        });

        await generation.save();
        console.log('Generation saved to database:', generation);

        // Deduct credits
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { credits: -1 } },
            { new: true }
        );

        res.json({
            generation: {
                _id: generation._id,
                imageUrl: generation.imageUrl,
                prompt: generation.prompt
            },
            credits: updatedUser.credits
        });
    } catch (error) {
        console.error('Error in image generation:', error);
        res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
});

// Image download endpoint
app.get('/api/download', authMiddleware, async (req, res) => {
    try {
        const { imageUrl } = req.query;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Validate the image URL belongs to the user
        const generation = await Generation.findOne({
            imageUrl: imageUrl,
            userId: req.user._id
        });

        if (!generation) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Use axios to stream the image
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream'
        });

        // Get file extension from URL
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('.');
        const extension = pathParts[pathParts.length - 1].toLowerCase();
        const validExtensions = ['png', 'jpg', 'jpeg', 'webp'];
        
        if (!validExtensions.includes(extension)) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        // Determine content type based on extension
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
        
        // Stream the image to the client
        response.data.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download image', details: error.message });
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
    res.sendFile(join(__dirname, 'login.html'));
});


app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html')); // Adjust the path if necessary
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
app.get('/', (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            res.sendFile(join(__dirname, 'index.html'));
        } catch (error) {
            res.sendFile(join(__dirname, 'login.html'));
        }
    } else {
        res.sendFile(join(__dirname, 'login.html'));
    }
});

app.get('/collections', authMiddleware, (req, res) => {
    console.log('Serving collections page for user:', req.user.email);
    res.sendFile(join(__dirname, 'collections.html'));
});

app.get('/generate', authMiddleware, (req, res) => {
    console.log('Serving generate page for user:', req.user.email);
    res.sendFile(join(__dirname, 'generate.html'));
});

app.get('/profile', authMiddleware, (req, res) => {
    console.log('Serving profile page for user:', req.user.email);
    res.sendFile(join(__dirname, 'profile.html'));
});

app.get('/index.html', authMiddleware, (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.get('/admin', authMiddleware, adminAuth, (req, res) => {
    res.sendFile(join(__dirname, 'admin.html'));
});

app.get('/api/admin/users', authMiddleware, adminAuth, async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/api/admin/stats', authMiddleware, adminAuth, async (req, res) => {
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
app.put('/api/admin/users/:id/role', authMiddleware, adminAuth, async (req, res) => {
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
app.put('/api/admin/users/:id/plan', authMiddleware, adminAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { 
                $set: { 
                    'subscription.plan': plan,
                    'subscription.startDate': new Date(),
                    'subscription.status': 'active'
                }
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user });
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
    res.sendFile(join(__dirname, 'auth.html'));
});

// API routes - Update to be user-specific
app.get('/api/generations', authMiddleware, async (req, res) => {
    try {
        const generations = await Generation.find({ userId: req.user._id })
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(generations);
    } catch (error) {
        console.error('Error fetching generations:', error);
        res.status(500).json({ error: 'Failed to fetch generations' });
    }
});

app.get('/api/generations/recent', authMiddleware, async (req, res) => {
    try {
        console.log('Fetching recent generations for user:', req.user._id);
        const generations = await Generation
            .find({ userId: req.user._id })
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

// Delete a generation
app.delete('/api/generations/:id', authMiddleware, async (req, res) => {
    try {
        const generation = await Generation.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!generation) {
            return res.status(404).json({ error: 'Generation not found' });
        }

        // Move to trash by updating the status
        generation.status = 'deleted';
        await generation.save();

        res.json({ message: 'Generation moved to trash' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to move generation to trash' });
    }
});

// Collections API endpoints - Update to be user-specific
app.post('/api/collections', authMiddleware, async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) {
            throw new Error('Title is required');
        }

        const collection = new Collection({
            userId: req.user._id,
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

app.get('/api/collections', authMiddleware, async (req, res) => {
    try {
        console.log('Fetching collections for user:', req.user._id);
        const collections = await Collection.find({ userId: req.user._id })
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

app.get('/api/collections/:id', authMiddleware, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('images', 'imageUrl prompt'); // Changed imageData to imageUrl to match schema

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json(collection);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch collection' });
    }
});

app.get('/collection/:id', authMiddleware, (req, res) => {
    console.log('Serving collection page for user:', req.user.email);
    res.sendFile(join(__dirname, 'collection.html'));
});

app.post('/api/collections/:collectionId/images', authMiddleware, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const { imageUrl, prompt } = req.body;

        if (!imageUrl || imageUrl === 'undefined') {
            return res.status(400).json({ error: 'Valid image URL is required' });
        }

        // Find the collection
        const collection = await Collection.findOne({
            _id: collectionId,
            userId: req.user._id
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Create a new Generation record
        const generation = new Generation({
            userId: req.user._id,
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

app.delete('/api/collections/:collectionId/images/:imageId', authMiddleware, async (req, res) => {
    try {
        const { collectionId, imageId } = req.params;

        const collection = await Collection.findOne({
            _id: collectionId,
            userId: req.user._id
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

// Delete generation - ensure user can only delete their own
app.delete('/api/generations/:id', authMiddleware, async (req, res) => {
    try {
        const generation = await Generation.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!generation) {
            return res.status(404).json({ error: 'Generation not found' });
        }

        await generation.deleteOne();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting generation:', error);
        res.status(500).json({ error: 'Failed to delete generation' });
    }
});

// User API routes
app.get('/api/auth/user', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
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
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile
app.put('/api/profile', authMiddleware, async (req, res) => {
    try {
        const { name, nickname, bio } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id,
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
app.get('/admin-styles', authMiddleware, adminAuth, (req, res) => {
    res.sendFile(join(__dirname, 'admin-styles.html'));
});

// Style management endpoints
app.get('/api/admin/styles', authMiddleware, adminAuth, async (req, res) => {
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

app.post('/api/admin/styles', authMiddleware, adminAuth, upload.single('image'), async (req, res) => {
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

app.delete('/api/admin/styles/:id', authMiddleware, adminAuth, async (req, res) => {
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
app.get('/api/styles', async (req, res) => {
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

app.post('/api/styles', authMiddleware, adminAuth, upload.single('image'), async (req, res) => {
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

app.put('/api/styles/:id', authMiddleware, adminAuth, upload.single('image'), async (req, res) => {
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

app.delete('/api/styles/:id', authMiddleware, adminAuth, async (req, res) => {
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

// Admin route to manage styles
app.get('/admin/styles', authMiddleware, adminAuth, (req, res) => {
    res.sendFile(join(__dirname, 'admin-styles.html'));
});

// Get all styles with sorting
app.get('/api/styles', async (req, res) => {
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

app.post('/api/styles', authMiddleware, adminAuth, upload.single('image'), async (req, res) => {
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

app.put('/api/styles/:id', authMiddleware, adminAuth, upload.single('image'), async (req, res) => {
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

app.delete('/api/styles/:id', authMiddleware, adminAuth, async (req, res) => {
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

// Update style order
app.put('/api/styles/order', authMiddleware, adminAuth, async (req, res) => {
    try {
        const { styles } = req.body;
        
        if (!Array.isArray(styles)) {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        // Update each style's order
        const updatePromises = styles.map(({ id, order }) => 
            Style.findByIdAndUpdate(id, { order }, { new: true })
        );

        await Promise.all(updatePromises);
        res.json({ message: 'Order updated successfully' });
    } catch (error) {
        console.error('Error updating style order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Get settings
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Update settings
app.put('/api/settings', authMiddleware, adminAuth, upload.single('logo'), async (req, res) => {
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
app.post('/api/collections/:collectionId/generations', authMiddleware, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const { imageUrl, prompt } = req.body;

        // Find the collection
        const collection = await Collection.findOne({
            _id: collectionId,
            userId: req.user._id
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Create a new generation
        const generation = new Generation({
            userId: req.user._id,
            prompt: prompt,
            imageUrl: imageUrl,
            status: 'completed'
        });
        await generation.save();

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
app.get('/api/download', authMiddleware, async (req, res) => {
    try {
        const { imageUrl } = req.query;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Validate the image URL belongs to the user
        const generation = await Generation.findOne({
            imageUrl: imageUrl,
            userId: req.user._id
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
app.get('/api/collections', authMiddleware, async (req, res) => {
    try {
        const collections = await Collection.find({ userId: req.user._id })
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

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/ipn', upload.none(), ipnRouter);

const startServer = async (initialPort = 3005) => {
    const findAvailablePort = async (startPort) => {
        return new Promise((resolve) => {
            const server = app.listen(startPort)
                .on('listening', () => {
                    server.close(() => resolve(startPort));
                })
                .on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        resolve(findAvailablePort(startPort + 1));
                    } else {
                        console.error('Server error:', err);
                        process.exit(1);
                    }
                });
        });
    };

    try {
        const port = await findAvailablePort(initialPort);
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            // Update CORS origin to match the new port
            app.use(cors({
                origin: [
                    `http://localhost:${port}`,
                    'https://sticker-app-xcap.onrender.com'
                ],
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
            }));
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
