/**
 * Syncs the build artifacts that mobile shares with the desktop player.
 *
 * Only *generated* artifacts are copied. `mobile/www/assets/js` also holds
 * hand-maintained forks of several legacy scripts (`slot-media.js` and
 * friends have real mobile-specific changes), so copying the whole tree would
 * silently discard them. The convergence plan for those forks is in
 * docs/SHARED-CORE.md; until then the allow-list below is the boundary.
 *
 *   src/assets/js/cless-core.js  ->  www/assets/js/cless-core.js
 *   src/app-dist/                ->  www/app-dist/
 *
 * Both are produced by `npm run build` in `app/`, which must run first.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const wwwDir = path.join(__dirname, 'www');

/** Generated artifacts, and only generated artifacts. */
const SHARED_FILES = [
    { from: path.join('assets', 'js', 'cless-core.js'), required: true },
];

const SHARED_DIRECTORIES = [
    { from: 'app-dist', required: false },
];

function copyDirectory(src, dest) {
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else if (entry.name.endsWith('.gz')) {
            // Android Gradle treats file.js and file.js.gz as one resource.
            continue;
        } else if (entry.name.endsWith('.map')) {
            // Source maps are megabytes and are of no use inside an APK.
            continue;
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function syncSharedArtifacts() {
    let copied = 0;

    for (const { from, required } of SHARED_FILES) {
        const source = path.join(srcDir, from);
        if (!fs.existsSync(source)) {
            if (required) {
                throw new Error(`Missing ${from}. Run "npm run build" in app/ first.`);
            }
            continue;
        }
        const destination = path.join(wwwDir, from);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        console.log(`  copied ${from}`);
        copied += 1;
    }

    for (const { from, required } of SHARED_DIRECTORIES) {
        const source = path.join(srcDir, from);
        if (!fs.existsSync(source)) {
            if (required) {
                throw new Error(`Missing ${from}. Run "npm run build" in app/ first.`);
            }
            console.log(`  skipped ${from} (not built)`);
            continue;
        }
        copyDirectory(source, path.join(wwwDir, from));
        console.log(`  copied ${from}/`);
        copied += 1;
    }

    return copied;
}

/**
 * Adds the Capacitor bootstrap to the Vue renderer's page.
 *
 * `app-dist/index.html` is emitted by Vite and shipped to Electron as-is, so
 * it must not carry mobile-only script tags. On mobile the page still needs
 * two things before the Vue bundle runs: the Capacitor plugin bundle (which
 * is what populates `window.Capacitor.Plugins`, where the platform layer
 * looks) and the mobile config loader (which the Capacitor configuration
 * source reuses, so both renderers are configured identically).
 *
 * Injected here rather than committed so the two builds cannot diverge.
 */
const CAPACITOR_BOOTSTRAP = `    <!-- Injected by mobile/build-mobile.cjs -->
    <script type="module" src="../assets/js/mobile/capacitor-core.bundle.js"></script>
    <script src="../assets/js/mobile/mobile-electron-shim.js"></script>
    <script src="../assets/js/mobile/mobile-config.js"></script>
`;

const BOOTSTRAP_MARKER = 'mobile/build-mobile.cjs';

function injectCapacitorBootstrap() {
    const indexPath = path.join(wwwDir, 'app-dist', 'index.html');
    if (!fs.existsSync(indexPath)) return false;

    const html = fs.readFileSync(indexPath, 'utf8');
    if (html.includes(BOOTSTRAP_MARKER)) return false;

    // Ahead of Vite's own tag: module scripts run in document order, and the
    // renderer reads window.Capacitor.Plugins while it is still booting.
    const insertAt = html.indexOf('<script');
    if (insertAt < 0) {
        throw new Error('app-dist/index.html has no script tag; cannot order the Capacitor bootstrap.');
    }

    fs.writeFileSync(indexPath, html.slice(0, insertAt) + CAPACITOR_BOOTSTRAP.trimStart() + '    ' + html.slice(insertAt));
    return true;
}

console.log('Syncing shared build artifacts into mobile/www...');
const total = syncSharedArtifacts();
if (injectCapacitorBootstrap()) {
    console.log('  injected the Capacitor bootstrap into app-dist/index.html');
}
console.log(`Done: ${total} artifact(s) synced.`);
