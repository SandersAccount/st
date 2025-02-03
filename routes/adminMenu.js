import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to config and menu actions folder
const menuConfigPath = path.join(__dirname, '../config/menuSetup.json');
const menuActionsDir = path.join(__dirname, '../menu-actions');

// Utility function to list available actions (file names without extension)
async function getAvailableActions() {
  try {
    const files = await fs.readdir(menuActionsDir);
    // Filter .js files and return the base file name (without extension)
    return files.filter(file => file.endsWith('.js')).map(file => file.replace('.js', ''));
  } catch (error) {
    console.error('Error reading menu actions directory:', error);
    return [];
  }
}

// Utility function to get current enabled actions from config
async function getEnabledActions() {
  try {
    const data = await fs.readFile(menuConfigPath, 'utf-8');
    const config = JSON.parse(data);
    return config.enabledActions || [];
  } catch (error) {
    console.error('Error reading menu config:', error);
    return [];
  }
}

// Utility function to save enabled actions to config
async function saveEnabledActions(actions) {
  const config = { enabledActions: actions };
  await fs.writeFile(menuConfigPath, JSON.stringify(config, null, 2));
}

// GET admin menu setup page
router.get('/menu-setup', async (req, res) => {
  try {
    const availableActions = await getAvailableActions();
    const enabledActions = await getEnabledActions();

    let formHtml = `<h1>Menu Setup</h1>
    <form method="POST" action="/admin/menu-setup">
      <ul>`;

    availableActions.forEach(action => {
      const checked = enabledActions.includes(action) ? 'checked' : '';
      formHtml += `<li>
        <label>
          <input type="checkbox" name="actions" value="${action}" ${checked}> ${action}
        </label>
      </li>`;
    });

    formHtml += `</ul>
      <button type="submit">Save</button>
    </form>`;

    res.send(formHtml);
  } catch (error) {
    console.error('Error in GET /admin/menu-setup:', error);
    res.status(500).send('Internal Server Error');
  }
});

// POST admin menu setup page to update enabled actions
router.post('/menu-setup', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    let actions = req.body.actions || [];
    if (!Array.isArray(actions)) {
      actions = [actions];
    }
    await saveEnabledActions(actions);
    res.send('<p>Menu configuration saved successfully!</p><p><a href="/admin/menu-setup">Go Back</a></p>');
  } catch (error) {
    console.error('Error in POST /admin/menu-setup:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
