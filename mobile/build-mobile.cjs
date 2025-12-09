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
            // Skip .gz files to avoid duplicate resource errors in Android builds
            // Android Gradle treats both file.js and file.js.gz as the same resource
            if (!entry.name.endsWith('.gz')) {
                fs.copyFileSync(srcPath, destPath);
            }
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
    // Main CMS Player - this is the primary app that plays layouts/media
    { src: 'index.html', dest: 'index.html', isMain: true, isCMSPlayer: true },
    // Dashboard/Control Panel - for remote control (optional, accessible via navigation)
    { src: 'cpanel.html', dest: 'dashboard.html', isMain: false, isCMSPlayer: false },
    // Configuration and activation pages
    { src: 'configure.html', dest: 'configure.html', isMain: false, isCMSPlayer: false },
    { src: 'activate.html', dest: 'activate.html', isMain: false, isCMSPlayer: false },
    // System diagnostics page for debugging
    { src: 'diagnostics.html', dest: 'diagnostics.html', isMain: false, isCMSPlayer: false }
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
    
    // Add viewport meta at the START of <head> for proper mobile rendering
    const viewportMeta = `
    <!-- Viewport meta for mobile (MUST come first) -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
`;
    
    content = content.replace(/<head>/i, '<head>' + viewportMeta);
    
    // Add Capacitor scripts and mobile config at the END of <head>, just before </head>
    // This ensures all dependencies (jQuery, etc.) are loaded first
    const capacitorScripts = `
  
  <!-- Capacitor Mobile Initialization (MUST load last in head, before body) -->
  <script type="module" src="assets/js/mobile/capacitor-core.bundle.js"></script>
  <script src="assets/js/mobile/mobile-electron-shim.js" defer></script>
  <script src="assets/js/mobile/mobile-config.js" defer></script>
`;
    
    content = content.replace(/<\/head>/i, capacitorScripts + '</head>');
    
    // CMS Player specific adaptations
    if (file.isCMSPlayer) {
        // Remove hardcoded Socket.IO script and replace with dynamic loader
        content = content.replace(
            /<script[^>]*src=["']https:\/\/localhost:9000\/socket\.io\/socket\.io\.js["'][^>]*><\/script>/gi,
            '<!-- Socket.IO will be loaded dynamically by mobile-socketio-manager.js -->'
        );
        
        // Add Socket.IO CDN and mobile manager before socketio-cpanel.js
        const socketIoScripts = `
    <!-- Socket.IO Client Library -->
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js" crossorigin="anonymous"></script>
    
    <!-- Mobile Socket.IO Connection Manager -->
    <script src="assets/js/mobile/mobile-socketio-manager.js"></script>
    
    <!-- Mobile Socket.IO Adapter (bridges socketio-cpanel.js with mobile socket manager) -->
    <script src="assets/js/mobile/mobile-socketio-adapter.js"></script>
`;
        
        // Insert Socket.IO scripts before socketio-cpanel.js
        content = content.replace(
            /<script[^>]*src=["']assets\/js\/socketio-cpanel\.js["'][^>]*><\/script>/i,
            socketIoScripts + '\n  <script src="assets/js/socketio-cpanel.js"></script>'
        );
        
        // Add navigation buttons to dashboard and diagnostics
        const navigationButton = `
    <!-- Mobile Navigation -->
    <div id="mobile-nav" style="position: fixed; top: 10px; right: 10px; z-index: 10000; display: flex; gap: 5px;">
        <button onclick="window.location.href='dashboard.html'" style="padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            ⚙️ Dashboard
        </button>
        <button onclick="window.location.href='diagnostics.html'" style="padding: 10px 15px; background: #6366f1; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);" title="System Diagnostics">
            🔍
        </button>
    </div>
`;
        content = content.replace(/<body>/i, '<body>' + navigationButton);
    }
    
    // Dashboard specific adaptations
    if (!file.isCMSPlayer && file.src === 'cpanel.html') {
        // Replace Socket.IO script with CDN version
        content = content.replace(
            /<script[^>]*src=["']\/socket\.io\/socket\.io\.js["'][^>]*><\/script>/gi,
            `<!-- Socket.IO Client Library -->
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js" crossorigin="anonymous"></script>
    
    <!-- Mobile Socket.IO Connection Manager -->
    <script src="assets/js/mobile/mobile-socketio-manager.js"></script>`
        );
        
        // Add back button to CMS player
        const backButton = `
    <!-- Mobile Navigation -->
    <div id="mobile-nav-back" style="position: fixed; top: 10px; left: 10px; z-index: 10000;">
        <button onclick="window.location.href='index.html'" style="padding: 10px 15px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            <i class="bi bi-arrow-left"></i> Back to Player
        </button>
    </div>
`;
        content = content.replace(/<body>/i, '<body>' + backButton);
    }
    
    // Remove Electron IPC references in inline scripts
    content = content.replace(/window\.ipcRenderer/g, 'window.mobileAPI.ipc');
    content = content.replace(/window\.remote/g, 'window.mobileAPI.remote');
    content = content.replace(/require\(['"]electron['"]\)/g, '{}');
    
    // Write mobile version
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`✓ Processed ${file.src} → ${file.dest}${file.isCMSPlayer ? ' (CMS Player)' : ''}`);
});

// Bundle Capacitor modules using Rollup
console.log('\n📦 Bundling Capacitor modules...');
const { execSync } = require('child_process');
try {
    execSync('npx rollup -c rollup.config.js', { 
        cwd: mobileDir,
        stdio: 'inherit'
    });
    console.log('✓ Capacitor modules bundled successfully');
} catch (error) {
    console.error('❌ Failed to bundle Capacitor modules:', error.message);
    process.exit(1);
}

console.log('\n✅ Mobile build completed successfully!');
console.log('\n📱 Mobile App Structure:');
console.log('   - index.html      → CMS Player (Main App - plays layouts/media)');
console.log('   - dashboard.html  → Control Panel (Remote management)');
console.log('   - configure.html  → Configuration page');
console.log('   - activate.html   → Activation page');
console.log('\n🔧 Next steps:');
console.log('   1. cd mobile');
console.log('   2. npm install');
console.log('   3. npm run add:android  (first time only)');
console.log('   4. npm run build:android');
console.log('\n   For iOS:');
console.log('   3. npm run add:ios  (first time only)');
console.log('   4. npm run build:ios');
console.log('\n💡 Note: Update Socket.IO server address in mobile/www/index.html before building!\n');
