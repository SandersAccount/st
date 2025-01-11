const fs = require('fs');
const path = require('path');

const dirs = [
    'public',
    'public/js',
    'public/js/components',
    'config',
    'middleware',
    'models',
    'routes',
    'services',
    'utils'
];

dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
    }
});
