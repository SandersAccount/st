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

// GET endpoint to display the page models configuration and a form to add/edit entries
router.get('/page-models', async (req, res) => {
  try {
    let config = {};
    try {
      const data = await fs.readFile(pageModelsConfigPath, 'utf8');
      config = JSON.parse(data);
    } catch (error) {
      config = {};
    }

    let html = `<h1>Page Models Configuration</h1>`;

    html += `<h2>Current Configuration</h2>`;
    html += `<ul>`;
    for (const [page, models] of Object.entries(config)) {
      html += `<li><strong>${page}</strong>: ${models.join(', ')}</li>`;
    }
    html += `</ul>`;

    // Form to add or update a page configuration
    html += `
      <h2>Add / Edit Configuration</h2>
      <form method="POST" action="/admin/page-models">
        <label>HTML Page Name: <input type="text" name="pageName" placeholder="e.g., test-template.html" required></label><br>
        <label>Models (comma separated): <input type="text" name="models" placeholder="e.g., sticker-maker, flux-dreamscape" required></label><br>
        <button type="submit">Save Configuration</button>
      </form>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error reading page models config:', error);
    res.status(500).send('Internal Server Error');
  }
});

// POST endpoint to add or update configuration for a specific page
router.post('/page-models', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { pageName, models } = req.body;
    if (!pageName || !models) {
      return res.status(400).send('Missing required fields');
    }

    // Parse the models from comma separated values, trim extra whitespace
    const modelsArray = models.split(',').map(item => item.trim()).filter(item => item.length > 0);

    // Load existing configuration
    let config = {};
    try {
      const data = await fs.readFile(pageModelsConfigPath, 'utf8');
      config = JSON.parse(data);
    } catch (error) {
      config = {};
    }

    // Update or add the configuration for the given pageName
    config[pageName] = modelsArray;

    // Save the new configuration
    await fs.writeFile(pageModelsConfigPath, JSON.stringify(config, null, 2));
    res.send(`<p>Configuration for <strong>${pageName}</strong> saved successfully!</p><p><a href="/admin/page-models">Go Back</a></p>`);
  } catch (error) {
    console.error('Error updating page models config:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
