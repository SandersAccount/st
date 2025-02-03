import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the replicate models configuration file
const modelsConfigPath = path.join(__dirname, '../config/replicateModels.json');

// GET endpoint to display the list of models and a form to add new models
router.get('/replicate-models', async (req, res) => {
  try {
    const data = await fs.readFile(modelsConfigPath, 'utf8');
    const config = JSON.parse(data);
    const models = config.models || [];
    let html = `<h1>Replicate Models</h1>`;
    html += `<ul>`;
    models.forEach(model => {
      html += `<li><strong>${model.name}</strong> - ${model.run} - Default Input: ${JSON.stringify(model.defaultInput)}</li>`;
    });
    html += `</ul>`;

    // Form to add a new model
    html += `
      <h2>Add New Model</h2>
      <form method="POST" action="/admin/replicate-models">
        <label>Model Name: <input type="text" name="name" required></label><br>
        <label>Replicate Run: <input type="text" name="run" required></label><br>
        <label>Prompt Default: <input type="text" name="prompt"></label><br>
        <label>Guidance Scale: <input type="number" step="0.1" name="guidance_scale" value="3.0"></label><br>
        <label>Extra Lora Scale: <input type="number" step="0.1" name="extra_lora_scale" value="0.8"></label><br>
        <label>Custom Default Input (JSON): <br><textarea name="customInput" rows="5" cols="50" placeholder='{"output_quality":90}'></textarea></label><br>
        <button type="submit">Save Model</button>
      </form>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error reading replicate models config:', error);
    res.status(500).send('Internal Server Error');
  }
});

// POST endpoint to add a new model
router.post('/replicate-models', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { name, run, prompt, guidance_scale, extra_lora_scale, customInput } = req.body;
    if (!name || !run) {
      return res.status(400).send('Missing required fields');
    }

    // Standard defaults
    let defaultInput = {
      prompt: prompt || "",
      guidance_scale: guidance_scale ? parseFloat(guidance_scale) : 3.0,
      extra_lora_scale: extra_lora_scale ? parseFloat(extra_lora_scale) : 0.8
    };

    // If customInput is provided, try to parse it and merge
    if (customInput && customInput.trim() !== "") {
      try {
        const customDefaults = JSON.parse(customInput);
        // Merge custom defaults over the standard defaults
        defaultInput = { ...defaultInput, ...customDefaults };
      } catch (parseError) {
        return res.status(400).send('Invalid JSON in Custom Default Input');
      }
    }

    // Load existing configuration
    let config;
    try {
      const data = await fs.readFile(modelsConfigPath, 'utf8');
      config = JSON.parse(data);
    } catch (error) {
      config = { models: [] };
    }

    // Construct new model entry
    const newModel = {
      name,
      run,
      defaultInput
    };

    // Add the new model and save the file
    config.models.push(newModel);
    await fs.writeFile(modelsConfigPath, JSON.stringify(config, null, 2));
    res.send('<p>Model added successfully!</p><p><a href="/admin/replicate-models">Go Back</a></p>');
  } catch (error) {
    console.error('Error updating replicate models config:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
