/**
 * Resolve and load HTTPS certificates for the CLESS-Player control panel.
 *
 * Priority for certificate directory:
 *   1. CLESS_CERT_DIR environment variable
 *   2. ~/clessapp/config.json → certDir / https.certDir
 *   3. Development / source tree: <appRoot>/cert
 *   4. Packaged Electron: <process.resourcesPath>/cert (extraResources)
 *   5. Electron userData/cert
 *   6. ~/clessapp/cert (installed production override)
 *
 * Existing filenames are preferred: key.pem + key.crt
 * Also accepts cert.pem / server.crt as certificate aliases.
 *
 * Never logs private key material.
 */

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const KEY_CANDIDATES = ['key.pem', 'privkey.pem', 'server.key']
const CERT_CANDIDATES = ['key.crt', 'cert.pem', 'certificate.pem', 'server.crt', 'fullchain.pem']

class CertificateLoadError extends Error {
    constructor(message, details = {}) {
        super(message)
        this.name = 'CertificateLoadError'
        this.code = details.code || 'CERT_LOAD_ERROR'
        this.certDir = details.certDir || ''
        this.missing = details.missing || []
        this.tried = details.tried || []
    }
}

function safeRequireElectronApp() {
    try {
        // Only available in the Electron main process
        const electron = require('electron')
        return electron && electron.app ? electron.app : null
    } catch (_) {
        return null
    }
}

function readOptionalConfigCertDir(homedir) {
    const configPath = path.join(homedir || os.homedir(), 'clessapp', 'config.json')
    try {
        if (!fs.existsSync(configPath)) return ''
        const raw = fs.readFileSync(configPath, 'utf8')
        const cfg = JSON.parse(raw)
        const dir =
            (cfg && cfg.certDir) ||
            (cfg && cfg.https && cfg.https.certDir) ||
            (cfg && cfg.cpanel && cfg.cpanel.certDir) ||
            ''
        return typeof dir === 'string' ? dir.trim() : ''
    } catch (_) {
        // Config is optional; ignore parse/IO errors
        return ''
    }
}

function uniqueExistingDirs(candidates) {
    const seen = new Set()
    const out = []
    for (const dir of candidates) {
        if (!dir) continue
        const resolved = path.resolve(dir)
        if (seen.has(resolved)) continue
        seen.add(resolved)
        try {
            if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                out.push(resolved)
            }
        } catch (_) {
            // skip unreadable paths
        }
    }
    return out
}

/**
 * Build ordered candidate certificate directories for the current runtime.
 * @param {object} [opts]
 * @param {string} [opts.appRoot] - Override application root (defaults to module parent = player root)
 * @param {string} [opts.homedir]
 * @param {string} [opts.envCertDir] - Override for CLESS_CERT_DIR (tests)
 * @param {boolean} [opts.isPackaged]
 * @param {string} [opts.resourcesPath]
 * @param {string} [opts.userDataPath]
 */
function listCertDirectoryCandidates(opts = {}) {
    const appRoot = opts.appRoot || path.join(__dirname)
    const homedir = opts.homedir || os.homedir()
    const envCertDir =
        opts.envCertDir !== undefined
            ? opts.envCertDir
            : (process.env.CLESS_CERT_DIR || '').trim()
    const electronApp = safeRequireElectronApp()
    const isPackaged =
        opts.isPackaged !== undefined
            ? opts.isPackaged
            : !!(electronApp && typeof electronApp.isPackaged === 'boolean' && electronApp.isPackaged)
    const resourcesPath =
        opts.resourcesPath ||
        process.resourcesPath ||
        (isPackaged ? path.join(path.dirname(appRoot), '..') : '')
    let userDataPath = opts.userDataPath || ''
    if (!userDataPath && electronApp && typeof electronApp.getPath === 'function') {
        try {
            userDataPath = electronApp.getPath('userData')
        } catch (_) {
            userDataPath = ''
        }
    }

    const configCertDir = readOptionalConfigCertDir(homedir)

    const candidates = []
    if (envCertDir) candidates.push(envCertDir)
    if (configCertDir) candidates.push(configCertDir)

    // Development / source checkout: cert/ next to cpanel.js / index.js
    candidates.push(path.join(appRoot, 'cert'))

    // Packaged Electron: electron-builder extraResources → resources/cert
    if (resourcesPath) {
        candidates.push(path.join(resourcesPath, 'cert'))
    }

    if (userDataPath) {
        candidates.push(path.join(userDataPath, 'cert'))
    }

    // Installed production override under the clessapp data directory
    candidates.push(path.join(homedir, 'clessapp', 'cert'))

    // Legacy mistaken layout (parent-of-app/cert) — last resort only
    candidates.push(path.join(appRoot, '..', 'cert'))

    return {
        candidates: candidates.map((d) => path.resolve(d)),
        envCertDir,
        configCertDir,
        isPackaged,
        resourcesPath: resourcesPath || '',
        appRoot,
    }
}

function pickExistingFile(dir, names) {
    for (const name of names) {
        const full = path.join(dir, name)
        try {
            if (fs.existsSync(full) && fs.statSync(full).isFile()) {
                return { name, path: full }
            }
        } catch (_) {
            // continue
        }
    }
    return null
}

/**
 * Resolve the certificate directory and key/cert file paths without reading contents.
 */
function resolveCertificatePaths(opts = {}) {
    const meta = listCertDirectoryCandidates(opts)
    const explicitDir = (meta.envCertDir || meta.configCertDir || '').trim()
    const searchDirs = explicitDir
        ? [path.resolve(explicitDir)]
        : uniqueExistingDirs(meta.candidates).length
          ? uniqueExistingDirs(meta.candidates)
          : meta.candidates.map((d) => path.resolve(d))

    const tried = []

    for (const dir of searchDirs) {
        const key = pickExistingFile(dir, KEY_CANDIDATES)
        const cert = pickExistingFile(dir, CERT_CANDIDATES)
        let dirExists = false
        try {
            dirExists = fs.existsSync(dir) && fs.statSync(dir).isDirectory()
        } catch (_) {
            dirExists = false
        }
        tried.push({
            dir,
            key: key ? key.name : null,
            cert: cert ? cert.name : null,
            exists: dirExists,
        })
        if (key && cert) {
            return {
                certDir: dir,
                keyPath: key.path,
                certPath: cert.path,
                keyFile: key.name,
                certFile: cert.name,
                source: meta.envCertDir && path.resolve(meta.envCertDir) === dir
                    ? 'CLESS_CERT_DIR'
                    : meta.configCertDir && path.resolve(meta.configCertDir) === dir
                      ? 'config.json'
                      : 'default',
                tried,
                meta,
            }
        }
        // Explicit override must not silently fall back to another directory
        if (explicitDir) {
            break
        }
    }

    const preferred = searchDirs[0] || path.join(meta.appRoot, 'cert')
    const missing = []
    const key = pickExistingFile(preferred, KEY_CANDIDATES)
    const cert = pickExistingFile(preferred, CERT_CANDIDATES)
    if (!key) missing.push(KEY_CANDIDATES[0] + ' (or ' + KEY_CANDIDATES.slice(1).join(', ') + ')')
    if (!cert) missing.push(CERT_CANDIDATES[0] + ' (or ' + CERT_CANDIDATES.slice(1).join(', ') + ')')

    throw new CertificateLoadError(
        [
            'Unable to start HTTPS CPanel server.',
            '',
            'Certificate files are missing:',
            ...missing.map((m) => `  * ${m}`),
            '',
            `Expected certificate directory: ${preferred}`,
            '',
            'Set CLESS_CERT_DIR to override, or place key.pem and key.crt in the cert directory.',
        ].join('\n'),
        {
            code: 'CERT_FILES_MISSING',
            certDir: preferred,
            missing,
            tried,
        }
    )
}

/**
 * Load HTTPS credentials (Buffers) for tls/https.createServer.
 * Does not return or log private key text.
 */
function loadHttpsCredentials(opts = {}) {
    const resolved = resolveCertificatePaths(opts)
    let keyBuf
    let certBuf
    try {
        keyBuf = fs.readFileSync(resolved.keyPath)
    } catch (err) {
        throw new CertificateLoadError(
            [
                'Unable to start HTTPS CPanel server.',
                '',
                `Failed to read private key file: ${resolved.keyFile}`,
                `Certificate directory: ${resolved.certDir}`,
                `Error: ${err.code || err.message}`,
            ].join('\n'),
            {
                code: err.code === 'EACCES' ? 'CERT_PERMISSION_DENIED' : 'CERT_KEY_UNREADABLE',
                certDir: resolved.certDir,
                missing: [resolved.keyFile],
                tried: resolved.tried,
            }
        )
    }
    try {
        certBuf = fs.readFileSync(resolved.certPath)
    } catch (err) {
        throw new CertificateLoadError(
            [
                'Unable to start HTTPS CPanel server.',
                '',
                `Failed to read certificate file: ${resolved.certFile}`,
                `Certificate directory: ${resolved.certDir}`,
                `Error: ${err.code || err.message}`,
            ].join('\n'),
            {
                code: err.code === 'EACCES' ? 'CERT_PERMISSION_DENIED' : 'CERT_CERT_UNREADABLE',
                certDir: resolved.certDir,
                missing: [resolved.certFile],
                tried: resolved.tried,
            }
        )
    }

    if (!keyBuf || !keyBuf.length) {
        throw new CertificateLoadError(
            `Unable to start HTTPS CPanel server.\n\nPrivate key file is empty: ${resolved.keyFile}\nCertificate directory: ${resolved.certDir}`,
            { code: 'CERT_KEY_INVALID', certDir: resolved.certDir }
        )
    }
    if (!certBuf || !certBuf.length) {
        throw new CertificateLoadError(
            `Unable to start HTTPS CPanel server.\n\nCertificate file is empty: ${resolved.certFile}\nCertificate directory: ${resolved.certDir}`,
            { code: 'CERT_CERT_INVALID', certDir: resolved.certDir }
        )
    }

    const keyText = keyBuf.toString('utf8')
    const certText = certBuf.toString('utf8')
    if (!/BEGIN[\w\s]*PRIVATE KEY/.test(keyText)) {
        throw new CertificateLoadError(
            `Unable to start HTTPS CPanel server.\n\nPrivate key file does not look like a PEM key: ${resolved.keyFile}\nCertificate directory: ${resolved.certDir}`,
            { code: 'CERT_KEY_INVALID', certDir: resolved.certDir }
        )
    }
    if (!/BEGIN CERTIFICATE/.test(certText)) {
        throw new CertificateLoadError(
            `Unable to start HTTPS CPanel server.\n\nCertificate file does not look like a PEM certificate: ${resolved.certFile}\nCertificate directory: ${resolved.certDir}`,
            { code: 'CERT_CERT_INVALID', certDir: resolved.certDir }
        )
    }

    return {
        key: keyBuf,
        cert: certBuf,
        keyPath: resolved.keyPath,
        certPath: resolved.certPath,
        keyFile: resolved.keyFile,
        certFile: resolved.certFile,
        certDir: resolved.certDir,
        source: resolved.source,
    }
}

/**
 * Human-safe summary for logs (paths only — never key contents).
 */
function formatCertLoadSummary(loaded) {
    return [
        `cert_dir=${loaded.certDir}`,
        `source=${loaded.source}`,
        `key_file=${loaded.keyFile}`,
        `cert_file=${loaded.certFile}`,
    ].join(' ')
}

module.exports = {
    CertificateLoadError,
    listCertDirectoryCandidates,
    resolveCertificatePaths,
    loadHttpsCredentials,
    formatCertLoadSummary,
    KEY_CANDIDATES,
    CERT_CANDIDATES,
}
