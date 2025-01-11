const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const auth = require('../middleware/auth');
const Collection = require('../models/Collection');
const Image = require('../models/Image');

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
    limits: {
        fileSize: 5000000 // 5MB limit
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload an image file'));
        }
        cb(null, true);
    }
});

// Get all collections for current user
router.get('/', auth, async (req, res) => {
    try {
        const collections = await Collection.find({ _id: { $in: req.user.collections } })
            .populate('images')
            .sort({ updatedAt: -1 });
        res.json(collections);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching collections' });
    }
});

// Create new collection
router.post('/', auth, async (req, res) => {
    try {
        const collection = new Collection({
            ...req.body,
            owner: req.user._id
        });
        await collection.save();

        // Add collection to user's collections
        req.user.collections.push(collection._id);
        await req.user.save();

        res.status(201).json(collection);
    } catch (error) {
        res.status(400).json({ error: 'Error creating collection' });
    }
});

// Update collection
router.patch('/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['title'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            _id: { $in: req.user.collections }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        updates.forEach(update => collection[update] = req.body[update]);
        await collection.save();

        res.json(collection);
    } catch (error) {
        res.status(400).json({ error: 'Error updating collection' });
    }
});

// Delete collection
router.delete('/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            _id: { $in: req.user.collections }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Remove collection from user's collections
        req.user.collections = req.user.collections.filter(id => id.toString() !== req.params.id);
        await req.user.save();

        // Delete all images in the collection
        await Image.deleteMany({ _id: { $in: collection.images } });

        // Delete the collection
        await collection.remove();

        res.json({ message: 'Collection deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting collection' });
    }
});

// Add image to collection
router.post('/:id/images', auth, upload.single('image'), async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            _id: { $in: req.user.collections }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        let imageUrl;
        if (req.file) {
            // Process uploaded image
            const buffer = await sharp(req.file.buffer)
                .resize({ width: 800, height: 800, fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();

            // Here you would typically upload to S3 or similar
            // For now, we'll convert to base64
            imageUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } else if (req.body.imageUrl) {
            imageUrl = req.body.imageUrl;
        } else {
            return res.status(400).json({ error: 'No image provided' });
        }

        const image = new Image({
            url: imageUrl,
            prompt: req.body.prompt
        });
        await image.save();

        collection.images.push(image._id);
        await collection.save();

        res.status(201).json(image);
    } catch (error) {
        res.status(400).json({ error: 'Error adding image to collection' });
    }
});

// Remove image from collection
router.delete('/:collectionId/images/:imageId', auth, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.collectionId,
            _id: { $in: req.user.collections }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        collection.images = collection.images.filter(id => id.toString() !== req.params.imageId);
        await collection.save();

        // Delete the image
        await Image.findByIdAndDelete(req.params.imageId);

        res.json({ message: 'Image removed from collection' });
    } catch (error) {
        res.status(500).json({ error: 'Error removing image from collection' });
    }
});

module.exports = router;
