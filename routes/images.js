import express from 'express';
import auth from '../middleware/auth.js';
import storage from '../utils/storage.js';

const router = express.Router();

// Delete an image
router.delete('/:imageId', auth, async (req, res) => {
    try {
        const { imageId } = req.params;
        
        if (!imageId) {
            return res.status(400).json({ error: 'Image ID is required' });
        }

        // Add confirmation dialog on the server side
        try {
            await storage.deleteImage(imageId);
            res.status(200).json({ message: 'Image deleted successfully' });
        } catch (error) {
            console.error('Error deleting image from storage:', error);
            res.status(500).json({ error: 'Failed to delete image from storage' });
        }
    } catch (error) {
        console.error('Error in delete image route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
