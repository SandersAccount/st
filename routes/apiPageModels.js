import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the page models configuration file
const pageModelsConfigPath = path.join(__dirname, '../config/pageModels.json');

// GET endpoint to return models for a specific page based on query parameter
// Example usage: /api/page-models?page=test-template.html
router.get('/', async (req, res) => {
  console.log('apiPageModels endpoint hit. Query:', req.query);
  try {
    const page = req.query.page;
    if (!page) {
      console.log('No page query parameter provided');
      return res.status(400).json({ error: 'Query parameter "page" is required.' });
    }

    let config = {};
    try {
      const data = await fs.readFile(pageModelsConfigPath, 'utf8');
      config = JSON.parse(data);
      console.log('Read pageModels config:', config);
    } catch (error) {
      console.error('Error reading page models config:', error);
      return res.status(500).json({ error: 'Failed to read page models configuration.' });
    }

    const models = config[page] || [];
    console.log(`Returning models for page ${page}:`, models);
    res.json(models);
  } catch (error) {
    console.error('Error in GET /api/page-models:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
