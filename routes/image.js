import express from 'express';
import imageService from '../services/imageService.js';

const router = express.Router();

// POST /api/image/generate
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing required parameter: prompt' });
    }

    const result = await imageService.generateImage(prompt);
    
    // Optionally, you can also store the generation record in a database here
    
    res.json(result);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
