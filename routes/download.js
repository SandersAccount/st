const express = require('express');
const router = express.Router();
const axios = require('axios');
const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY } = process.env;

// Endpoint to proxy image downloads
router.get('/', async (req, res) => {
    try {
        const { imageUrl } = req.query;

        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Create Basic Auth header for B2
        const authToken = Buffer.from(`${B2_APPLICATION_KEY_ID}:${B2_APPLICATION_KEY}`).toString('base64');

        // Fetch image from B2
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                Authorization: `Basic ${authToken}`
            }
        });

        // Set appropriate headers and send the image
        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error('Error downloading image:', error);
        res.status(500).json({ error: 'Failed to download image' });
    }
});

module.exports = router;
