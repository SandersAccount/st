const express = require('express');
const auth = require('../middleware/auth');
const Tag = require('../models/Tag');
const Image = require('../models/Image');

const router = express.Router();

// Get all tags (with optional search)
router.get('/', auth, async (req, res) => {
    try {
        const { search, sort = 'usageCount' } = req.query;
        let query = {};

        if (search) {
            query = { $text: { $search: search } };
        }

        const sortOptions = {
            usageCount: { usageCount: -1 },
            name: { name: 1 },
            recent: { createdAt: -1 }
        };

        const tags = await Tag.find(query)
            .sort(sortOptions[sort] || sortOptions.usageCount)
            .limit(100);

        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching tags' });
    }
});

// Create new tag
router.post('/', auth, async (req, res) => {
    try {
        const { name, color } = req.body;

        // Check if tag already exists
        let tag = await Tag.findOne({ name: name.toLowerCase() });
        if (tag) {
            return res.status(400).json({ error: 'Tag already exists' });
        }

        tag = new Tag({
            name: name.toLowerCase(),
            color,
            createdBy: req.user._id
        });
        await tag.save();

        res.status(201).json(tag);
    } catch (error) {
        res.status(400).json({ error: 'Error creating tag' });
    }
});

// Update tag
router.patch('/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'color'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        const tag = await Tag.findById(req.params.id);
        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Only creator can update tag
        if (tag.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to update this tag' });
        }

        updates.forEach(update => tag[update] = req.body[update]);
        await tag.save();

        res.json(tag);
    } catch (error) {
        res.status(400).json({ error: 'Error updating tag' });
    }
});

// Delete tag
router.delete('/:id', auth, async (req, res) => {
    try {
        const tag = await Tag.findById(req.params.id);
        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Only creator can delete tag
        if (tag.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to delete this tag' });
        }

        // Remove tag from all images
        await Image.updateMany(
            { tags: tag._id },
            { $pull: { tags: tag._id } }
        );

        await tag.remove();
        res.json({ message: 'Tag deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting tag' });
    }
});

// Get tag suggestions
router.get('/suggestions', auth, async (req, res) => {
    try {
        const { prompt } = req.query;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Use text search to find relevant tags
        const tags = await Tag.find(
            { $text: { $search: prompt } },
            { score: { $meta: 'textScore' } }
        )
        .sort({ score: { $meta: 'textScore' } })
        .limit(5);

        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching tag suggestions' });
    }
});

module.exports = router;
