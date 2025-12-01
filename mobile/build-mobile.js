/**
 * eCLESS Player Mobile Build Script
 * 
 * This script prepares the web frontend for mobile deployment by:
 * 1. Copying necessary HTML, CSS, and JS files from src/ to mobile/www/
 * 2. Removing Electron-specific dependencies
 * 3. Adding Capacitor-specific configurations
 * 4. Creating mobile-friendly versions of pages
 */

const fs = require('fs');
const path = require('path');

// Directories
const srcDir = path.join(__dirname, '..', 'src');
const mobileDir = path.join(__dirname);
const wwwDir = path.join(mobileDir, 'www');
const assetsDir = path.join(wwwDir, 'assets');

console.log('🚀 eCLESS Player Mobile Build Started...\n');

// Ensure www directory exists
if (!fs.existsSync(wwwDir)) {
    fs.mkdirSync(wwwDir, { recursive: true });
    console.log('✓ Created www directory');
}

// Copy assets directory recursively
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copy assets
const srcAssetsDir = path.join(srcDir, 'assets');
if (fs.existsSync(srcAssetsDir)) {
    console.log('📦 Copying assets directory...');
    copyDirectory(srcAssetsDir, assetsDir);
    console.log('✓ Assets copied successfully');
}

// Files to process
const files = [
    { src: 'cpanel.html', dest: 'index.html', isMain: true },
    { src: 'configure.html', dest: 'configure.html', isMain: false },
    { src: 'activate.html', dest: 'activate.html', isMain: false }
];

console.log('\n📝 Processing HTML files...');

files.forEach(file => {
    const srcPath = path.join(srcDir, file.src);
    const destPath = path.join(wwwDir, file.dest);
    
    if (!fs.existsSync(srcPath)) {
        console.log(`⚠ Warning: ${file.src} not found, skipping...`);
        return;
    }
    
    let content = fs.readFileSync(srcPath, 'utf8');
    
    // Remove Electron preload script reference
    content = content.replace(/<script\s+src=["'].*?preload\.js["'][^>]*><\/script>/gi, '');
    
    // Remove config-loader.js (Electron-specific)
    content = content.replace(/<script[^>]*src=["'].*?config-loader\.js["'][^>]*><\/script>/gi, '');
    content = content.replace(/<script[^>]*src=["'].*?config-loader-browser\.js["'][^>]*><\/script>/gi, '');
    
    // Add Capacitor scripts and mobile config at the start of <head>
    const capacitorScripts = `
    <!-- Capacitor Core -->
    <script type="module" src="assets/js/capacitor-core.js"></script>
    
    <!-- Mobile Configuration -->
    <script src="assets/js/mobile-config.js"></script>
    
    <!-- Viewport meta for mobile -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
`;
    
    content = content.replace(/<head>/i, '<head>' + capacitorScripts);
    
    // Remove Electron IPC references in inline scripts
    content = content.replace(/window\.ipcRenderer/g, 'window.mobileAPI.ipc');
    content = content.replace(/window\.remote/g, 'window.mobileAPI.remote');
    content = content.replace(/require\(['"]electron['"]\)/g, '{}');
    
    // Write mobile version
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`✓ Processed ${file.src} → ${file.dest}`);
});

console.log('\n✅ Mobile build completed successfully!');
console.log('\n📱 Next steps:');
console.log('   1. cd mobile');
console.log('   2. npm install');
console.log('   3. npm run add:android  (first time only)');
console.log('   4. npm run build:android');
console.log('\n   For iOS:');
console.log('   3. npm run add:ios  (first time only)');
console.log('   4. npm run build:ios\n');
