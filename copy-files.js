const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'test-replicate');
const targetDir = __dirname;

const filesToCopy = [
    // HTML files
    'index.html',
    'admin.html',
    'admin-styles.html',
    'auth.html',
    'collection.html',
    'collections.html',
    'layout.html',
    'login.html',
    'plans.html',
    'profile.html',
    'register.html',
    
    // CSS and JS files
    'styles.css',
    'server.js',
    
    // Config files
    'package.json',
    '.env.example',
    
    // Directories to copy recursively
    'config',
    'middleware',
    'models',
    'routes',
    'services',
    'utils',
    'public'
];

function copyFileSync(source, target) {
    let targetFile = target;
    if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
        targetFile = path.join(target, path.basename(source));
    }
    fs.writeFileSync(targetFile, fs.readFileSync(source));
    console.log(`Copied file: ${source} -> ${targetFile}`);
}

function copyFolderRecursiveSync(source, target) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    if (fs.lstatSync(source).isDirectory()) {
        const files = fs.readdirSync(source);
        files.forEach(file => {
            const curSource = path.join(source, file);
            const curTarget = path.join(target, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, curTarget);
            } else {
                copyFileSync(curSource, curTarget);
            }
        });
    }
}

filesToCopy.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (!fs.existsSync(sourcePath)) {
        console.log(`Warning: Source file/directory not found: ${sourcePath}`);
        return;
    }
    
    if (fs.lstatSync(sourcePath).isDirectory()) {
        copyFolderRecursiveSync(sourcePath, targetPath);
    } else {
        copyFileSync(sourcePath, targetPath);
    }
});
