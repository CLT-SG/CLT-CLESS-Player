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
        
        // Add mobile debug panel script in head (before body)
        const debugPanelScript = `
  <!-- Mobile Debug Panel -->
  <script src="assets/js/mobile/mobile-debug-panel.js"></script>
`;
        content = content.replace(/<\/head>/i, debugPanelScript + '</head>');
        
        // Add loading screen, navigation buttons, and initialization script
        const mobileEnhancements = `
    <!-- Loading Screen -->
    <div id="loading-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); z-index: 99999; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="text-align: center; color: white;">
            <h1 style="font-size: 2.5em; margin-bottom: 20px; font-weight: 300;">eCLESS Player</h1>
            <div style="width: 300px; height: 8px; background: rgba(255,255,255,0.3); border-radius: 4px; overflow: hidden; margin: 0 auto;">
                <div id="loading-progress" style="width: 0%; height: 100%; background: white; border-radius: 4px; transition: width 0.3s ease;"></div>
            </div>
            <p id="loading-status" style="margin-top: 20px; font-size: 1.1em; opacity: 0.9;">Initializing...</p>
            <p id="loading-substatus" style="margin-top: 10px; font-size: 0.9em; opacity: 0.7;"></p>
        </div>
    </div>

    <!-- Mobile Navigation with Auto-Hide -->
    <div id="mobile-nav" style="position: fixed; top: 10px; right: 10px; z-index: 10000; display: flex; gap: 8px; transition: opacity 0.3s ease, transform 0.3s ease;">
        <button onclick="window.location.href='configure.html'" style="padding: 10px 15px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 14px; font-weight: 500;">
            ⚙️ Settings
        </button>
        <button onclick="window.location.href='dashboard.html'" style="padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 14px; font-weight: 500;">
            📊 Dashboard
        </button>
        <button onclick="window.location.href='diagnostics.html'" style="padding: 10px 15px; background: #6366f1; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 14px; font-weight: 500;" title="System Diagnostics">
            🔍 Diagnostics
        </button>
        <button onclick="window.debugPanel?.toggle()" style="padding: 10px 15px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 14px; font-weight: 500;" title="Debug Console">
            🐛 Debug
        </button>
    </div>

    <script>
        // Auto-hide navigation system
        (function() {
            const nav = document.getElementById('mobile-nav');
            let hideTimeout;
            let isHiding = false;

            function showNav() {
                nav.style.opacity = '1';
                nav.style.transform = 'translateY(0)';
                isHiding = false;
                resetHideTimer();
            }

            function hideNav() {
                if (!isHiding) {
                    isHiding = true;
                    nav.style.opacity = '0';
                    nav.style.transform = 'translateY(-20px)';
                }
            }

            function resetHideTimer() {
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(hideNav, 5000); // Hide after 5 seconds
            }

            // Show on user activity
            document.addEventListener('touchstart', showNav);
            document.addEventListener('click', showNav);
            document.addEventListener('mousemove', showNav);

            // Show when hovering near top-right corner
            document.addEventListener('mousemove', function(e) {
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                if (e.clientX > windowWidth * 0.75 && e.clientY < windowHeight * 0.25) {
                    showNav();
                }
            });

            // Start the hide timer
            resetHideTimer();
        })();

        // Loading screen with initialization tracking
        (function() {
            const loadingOverlay = document.getElementById('loading-overlay');
            const loadingProgress = document.getElementById('loading-progress');
            const loadingStatus = document.getElementById('loading-status');
            const loadingSubstatus = document.getElementById('loading-substatus');
            
            let progress = 0;
            let initialized = false;

            function updateProgress(percent, status, substatus = '') {
                progress = Math.min(percent, 100);
                loadingProgress.style.width = progress + '%';
                loadingStatus.textContent = status;
                loadingSubstatus.textContent = substatus;
                console.log(\`[Loading] \${progress}% - \${status} \${substatus}\`);
            }

            function hideLoadingScreen() {
                if (initialized) return;
                initialized = true;
                console.log('[Loading] Complete - hiding loading screen');
                updateProgress(100, 'Ready!', 'Starting player...');
                setTimeout(() => {
                    loadingOverlay.style.opacity = '0';
                    loadingOverlay.style.transition = 'opacity 0.5s ease';
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                    }, 500);
                }, 500);
            }

            function showErrorMessage(message, details = '', showRetry = true) {
                loadingOverlay.innerHTML = \`
                    <div style="text-align: center; color: white; max-width: 500px; padding: 20px;">
                        <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                        <h2 style="font-size: 1.5em; margin-bottom: 15px; font-weight: 400;">\${message}</h2>
                        \${details ? \`<p style="font-size: 0.9em; opacity: 0.8; margin-bottom: 20px;">\${details}</p>\` : ''}
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            \${showRetry ? \`<button onclick="window.location.reload()" style="padding: 12px 24px; background: white; color: #667eea; border: none; border-radius: 5px; cursor: pointer; font-size: 1em; font-weight: 500; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">Retry</button>\` : ''}
                            <button onclick="window.location.href='configure.html'" style="padding: 12px 24px; background: rgba(255,255,255,0.2); color: white; border: 1px solid white; border-radius: 5px; cursor: pointer; font-size: 1em; font-weight: 500;">Settings</button>
                            <button onclick="window.location.href='diagnostics.html'" style="padding: 12px 24px; background: rgba(255,255,255,0.2); color: white; border: 1px solid white; border-radius: 5px; cursor: pointer; font-size: 1em; font-weight: 500;">Diagnostics</button>
                        </div>
                    </div>
                \`;
            }

            window.showErrorMessage = showErrorMessage;

            // Track initialization stages
            updateProgress(0, 'Starting...', 'Loading Capacitor');

            // Stage 1: Capacitor ready (25%)
            document.addEventListener('capacitorReady', function() {
                updateProgress(25, 'Capacitor Ready', 'Loading configuration...');
            });

            // Stage 2: Config loaded (50%)
            document.addEventListener('configLoaded', function(e) {
                updateProgress(50, 'Configuration Loaded', 'Connecting to server...');
            });

            // Stage 3: Socket.IO connected or skipped (75%)
            document.addEventListener('socketio-connected', function() {
                updateProgress(75, 'Connected to Server', 'Initializing player...');
            });

            // Also listen for timeout (Socket.IO is optional)
            window.addEventListener('socketio-timeout', function() {
                updateProgress(75, 'Server Connection Skipped', 'Initializing player...');
            });

            // Stage 4: App ready (100%)
            window.addEventListener('appReady', function() {
                updateProgress(100, 'Ready!', 'Starting player...');
                setTimeout(hideLoadingScreen, 500);
            });

            // Timeout fallback - hide loading screen after 20 seconds
            setTimeout(function() {
                if (!initialized) {
                    console.warn('[Loading] Timeout reached - hiding loading screen anyway');
                    // Check if we have config at least
                    if (window.config && window.config.hostserver) {
                        hideLoadingScreen();
                    } else {
                        showErrorMessage(
                            'Initialization Timeout',
                            'The app took too long to initialize. Please check your configuration.',
                            true
                        );
                    }
                }
            }, 20000);

            // Make functions globally available
            window.hideLoadingScreen = hideLoadingScreen;
            window.updateLoadingProgress = updateProgress;
        })();
    </script>
`;
        content = content.replace(/<body>/i, '<body>' + mobileEnhancements);
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

// ============================================
// Sync version numbers to build.gradle
// ============================================
console.log('\n🔄 Syncing version numbers...');

try {
    const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
    
    if (fs.existsSync(buildGradlePath)) {
        let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
        
        // Update versionCode (convert 3.1.3 to 313)
        buildGradleContent = buildGradleContent.replace(
            /versionCode\s+\d+/,
            `versionCode ${VERSION_CODE}`
        );
        
        // Update versionName
        buildGradleContent = buildGradleContent.replace(
            /versionName\s+"[^"]+"/,
            `versionName "${APP_VERSION}"`
        );
        
        fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');
        console.log(`✓ Updated build.gradle: versionCode=${VERSION_CODE}, versionName="${APP_VERSION}"`);
    } else {
        console.log('⚠ Warning: build.gradle not found, skipping version sync');
    }
} catch (error) {
    console.error('❌ Failed to sync versions:', error.message);
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
