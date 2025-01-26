import fs from 'fs';
import path from 'path';

// Font definitions - Add new fonts here
const fonts = [
    { name: 'Angeline Regular', file: 'angeline.ttf', fallback: 'script' },
    { name: 'Hartone Regular', file: 'Hartone Softed.ttf', fallback: 'display' },
    { name: 'Airstrike', file: 'airstrike.ttf', fallback: 'impact' },
    { name: 'Lemon Milk', file: 'lemonmilk.ttf', fallback: 'display' },
    { name: 'Super Bubble', file: 'Super Bubble.ttf', fallback: 'comic' },
    { name: 'Grobold', file: 'GROBOLD.ttf', fallback: 'display' },
    { name: 'Godzilla', file: 'Godzilla.ttf', fallback: 'impact' },
    { name: 'Insaniburger', file: 'Insanibc.ttf', fallback: 'impact' },
    { name: 'Forky', file: '1. Forky.ttf', fallback: 'comic' },
    { name: 'Commando', file: 'commando.ttf', fallback: 'impact' },
    { name: 'Borgsquad', file: 'borgsquad.ttf', fallback: 'display' },
    { name: 'Snickers', file: 'SNICN___.TTF', fallback: 'arial' },
    { name: 'Roboto Black', file: 'Roboto-Black.ttf', fallback: 'arial' },
    { name: 'Super Cartoon', file: 'Super Cartoon.ttf', fallback: 'arial' },
    { name: 'Heavitas', file: 'Heavitas.ttf', fallback: 'arial' },
    { name: 'Starborn', file: 'Starborn.ttf', fallback: 'arial' }
];

// Helper functions
function generateCSSVariableName(fontName) {
    return '--font-' + fontName.toLowerCase().replace(/\s+/g, '');
}

function generateFontClassName(fontName) {
    return 'font-' + fontName.toLowerCase().replace(/\s+/g, '');
}

// Generate fonts.css content
function generateFontCSS() {
    const fontNames = fonts.map(f => `'${f.name}'`).join(', ');
    
    let css = `/* Font System */
:root {
    /* Available Fonts - Used to generate font menu */
    --available-fonts: ${fontNames};

    /* Fallback Fonts */
    --fallback-display: 'Arial Black';
    --fallback-comic: 'Comic Sans MS';
    --fallback-impact: Impact;
    --fallback-arial: Arial;
    --fallback-script: 'Brush Script MT';

    /* Font Family Names */
${fonts.map(font => `    ${generateCSSVariableName(font.name)}: '${font.name}';`).join('\n')}
}

/* Font Face Definitions */
${fonts.map(font => `@font-face {
    font-family: var(${generateCSSVariableName(font.name)});
    src: url('/fonts/${font.file}') format('truetype');
    font-display: swap;
}`).join('\n\n')}

/* Font Classes */
${fonts.map(font => `.${generateFontClassName(font.name)} { font-family: var(${generateCSSVariableName(font.name)}), var(--fallback-${font.fallback}); }`).join('\n')}

/* Font Menu Styles */
${fonts.map(font => `.font-menu-header[data-selected-font="${font.name}"] .selected-font { font-family: var(${generateCSSVariableName(font.name)}), var(--fallback-${font.fallback}); }`).join('\n')}

/* Font Preview Styles */
${fonts.map(font => `.font-option[data-font="${font.name}"] .preview-text { font-family: var(${generateCSSVariableName(font.name)}), var(--fallback-${font.fallback}); }`).join('\n')}

.preview-text {
    font-size: 24px;
    line-height: 1.4;
    margin-bottom: 4px;
    color: #fff;
}`;

    return css;
}

// Generate sticker-editor.js font mapping
function generateStickerEditorFontMapping() {
    const fontMapping = {};
    fonts.forEach(font => {
        fontMapping[font.name] = font.file;
    });
    return fontMapping;
}

// Update sticker-editor.js with new font mapping
function updateStickerEditorJS() {
    const stickerEditorPath = './public/js/sticker-editor.js';
    let content = fs.readFileSync(stickerEditorPath, 'utf8');

    // Generate the new font mapping
    const fontMapping = generateStickerEditorFontMapping();
    const fontMappingStr = JSON.stringify(fontMapping, null, 12)
        .replace(/{/, '{\n            ')
        .replace(/}/, '\n        }');

    // Replace the existing font mapping
    content = content.replace(
        /this\.fontFiles = {[\s\S]*?};/m,
        `this.fontFiles = ${fontMappingStr};`
    );

    fs.writeFileSync(stickerEditorPath, content, 'utf8');
}

// Main execution
try {
    // Generate and write fonts.css
    const css = generateFontCSS();
    fs.writeFileSync('./public/css/fonts.css', css);
    console.log('Generated fonts.css successfully!');

    // Update sticker-editor.js
    updateStickerEditorJS();
    console.log('Updated sticker-editor.js successfully!');

    // Create a README in the fonts directory if it doesn't exist
    const readmePath = './public/fonts/README.md';
    if (!fs.existsSync(readmePath)) {
        const readme = `# Fonts Directory

This directory contains all the font files used in the sticker editor.

## Adding a New Font

1. Place your new font file (*.ttf) in this directory
2. Edit \`/public/js/generate-fonts-css.mjs\`
3. Add your font to the \`fonts\` array at the top of the file:
   \`\`\`javascript
   { name: 'Your Font Name', file: 'your-font-file.ttf', fallback: 'arial' }
   \`\`\`
   - \`name\`: The display name of the font (shown in the menu)
   - \`file\`: The exact filename of your font file
   - \`fallback\`: One of: 'arial', 'display', 'comic', 'impact', or 'script'
4. Run \`node public/js/generate-fonts-css.mjs\`
5. Refresh your browser

The script will automatically:
- Update the CSS variables and font faces
- Add the font to the font menu
- Update the font mapping in the editor
`;
        fs.writeFileSync(readmePath, readme);
        console.log('Created fonts/README.md with instructions');
    }

    console.log('\nAll done! Refresh your browser to see the changes.');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
