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

// Read package.json to get version info
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const APP_VERSION = packageJson.version;
const VERSION_CODE = parseInt(APP_VERSION.replace(/\./g, ''), 10); // Convert 3.1.3 to 313

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
            // Skip .gz files to avoid duplicate resource errors in Android builds
            // Android Gradle treats both file.js and file.js.gz as the same resource
            if (!entry.name.endsWith('.gz')) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

console.log('\n📝 Processing HTML files...');

