const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const auth = require('../middleware/auth');
const Collection = require('../models/Collection');
const Image = require('../models/Image');
const Tag = require('../models/Tag');

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

// Get all collections for current user with search and filters
router.get('/', auth, async (req, res) => {
    try {
        const { search, sort = 'updatedAt', category, tags, page = 1, limit = 20 } = req.query;
        let query = { _id: { $in: req.user.collections } };

        // Text search
        if (search) {
            query.$text = { $search: search };
        }

        // Category filter
        if (category) {
            query.category = category;
        }

        // Tags filter
        if (tags) {
            const tagIds = tags.split(',');
            query.tags = { $all: tagIds };
        }

        const sortOptions = {
            updatedAt: { updatedAt: -1 },
            name: { title: 1 },
            imageCount: { 'images.length': -1 }
        };

        const collections = await Collection.find(query)
            .populate({
                path: 'images',
                select: 'url prompt tags category metadata',
                populate: { path: 'tags', select: 'name color' }
            })
            .sort(sortOptions[sort] || sortOptions.updatedAt)
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Collection.countDocuments(query);

        res.json({
            collections,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching collections' });
    }
});

// Bulk import images
router.post('/bulk-import', auth, upload.array('images', 10), async (req, res) => {
    try {
        const { collectionId, category, tags } = req.body;
        const collection = await Collection.findOne({
            _id: collectionId,
            _id: { $in: req.user.collections }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const processedImages = await Promise.all(req.files.map(async (file) => {
            // Process image with sharp
            const processedBuffer = await sharp(file.buffer)
                .resize({ width: 800, height: 800, fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();

            const metadata = await sharp(processedBuffer).metadata();

            // Create image document
            const image = new Image({
                url: `data:image/jpeg;base64,${processedBuffer.toString('base64')}`,
                category: category || 'sticker',
                tags: tags ? tags.split(',') : [],
                metadata: {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    size: processedBuffer.length
                },
                createdBy: req.user._id
            });

            await image.save();
            return image._id;
        }));

        // Add images to collection
        collection.images.push(...processedImages);
        await collection.save();

        res.status(201).json({
            message: `Successfully imported ${processedImages.length} images`,
            imageIds: processedImages
        });
    } catch (error) {
        res.status(400).json({ error: 'Error importing images' });
    }
});

// Export collection
router.get('/:id/export', auth, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            _id: { $in: req.user.collections }
        }).populate({
            path: 'images',
            populate: { path: 'tags', select: 'name color' }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const exportData = {
            title: collection.title,
            createdAt: collection.createdAt,
            images: collection.images.map(image => ({
                url: image.url,
                prompt: image.prompt,
                category: image.category,
                tags: image.tags.map(tag => tag.name),
                metadata: image.metadata
            }))
        };

        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: 'Error exporting collection' });
    }
});

// Bulk update images
router.patch('/bulk-update', auth, async (req, res) => {
    try {
        const { imageIds, updates } = req.body;
        const allowedUpdates = ['category', 'tags'];
        const updateKeys = Object.keys(updates);
        
        if (!imageIds?.length || !updateKeys.length) {
            return res.status(400).json({ error: 'No images or updates specified' });
        }

        const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
        if (!isValidOperation) {
            return res.status(400).json({ error: 'Invalid updates' });
        }

        // Verify user has access to these images
        const userCollections = await Collection.find({
            _id: { $in: req.user.collections }
        });
        const userImageIds = userCollections.flatMap(c => c.images.map(id => id.toString()));
        const authorizedImages = imageIds.filter(id => userImageIds.includes(id));

        if (authorizedImages.length === 0) {
            return res.status(403).json({ error: 'No authorized images to update' });
        }

        // Perform updates
        const updatePromises = authorizedImages.map(async (imageId) => {
            const image = await Image.findById(imageId);
            if (!image) return null;

            updateKeys.forEach(key => {
                if (key === 'tags') {
                    image.tags = updates.tags;
                } else {
                    image[key] = updates[key];
                }
            });

            return image.save();
        });

        await Promise.all(updatePromises);

        res.json({
            message: `Successfully updated ${authorizedImages.length} images`,
            updatedIds: authorizedImages
        });
    } catch (error) {
        res.status(400).json({ error: 'Error updating images' });
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
