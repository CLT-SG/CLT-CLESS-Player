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
        } else if (!entry.name.endsWith('.gz')) {
            // Android Gradle treats file.js and file.js.gz as one resource.
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

console.log('Syncing shared build artifacts into mobile/www...');
const total = syncSharedArtifacts();
console.log(`Done: ${total} artifact(s) synced.`);
