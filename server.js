const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sticker-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

// Models
const Collection = require('./models/Collection');
const Image = require('./models/Image');

// Routes
app.get('/api/collections', async (req, res) => {
    try {
        const collections = await Collection.find().populate('images');
        res.json(collections);
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
});

app.post('/api/collections', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const collection = new Collection({ title });
        await collection.save();
        res.status(201).json(collection);
    } catch (error) {
        console.error('Error creating collection:', error);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

app.post('/api/collections/:id/images', async (req, res) => {
    try {
        const { id } = req.params;
        const { imageUrl, prompt } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        const image = new Image({ url: imageUrl, prompt });
        await image.save();

        const collection = await Collection.findById(id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        collection.images.push(image._id);
        await collection.save();

        res.status(201).json(image);
    } catch (error) {
        console.error('Error adding image to collection:', error);
        res.status(500).json({ error: 'Failed to add image to collection' });
    }
});

app.delete('/api/collections/:collectionId/images/:imageId', async (req, res) => {
    try {
        const { collectionId, imageId } = req.params;

        const collection = await Collection.findById(collectionId);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        collection.images = collection.images.filter(id => id.toString() !== imageId);
        await collection.save();

        await Image.findByIdAndDelete(imageId);

        res.status(200).json({ message: 'Image removed from collection' });
    } catch (error) {
        console.error('Error removing image from collection:', error);
        res.status(500).json({ error: 'Failed to remove image from collection' });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
