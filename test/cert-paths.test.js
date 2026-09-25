/**
 * Unit tests for HTTPS certificate path resolution.
 * Run: node --test test/cert-paths.test.js
 */
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
    resolveCertificatePaths,
    loadHttpsCredentials,
    listCertDirectoryCandidates,
    CertificateLoadError,
    formatCertLoadSummary,
} = require('../certPaths')

const PROJECT_ROOT = path.join(__dirname, '..')
const PROJECT_CERT = path.join(PROJECT_ROOT, 'cert')

describe('certPaths', () => {
    it('lists development cert/ under the application root first among defaults', () => {
        const { candidates } = listCertDirectoryCandidates({
            appRoot: PROJECT_ROOT,
            envCertDir: '',
            isPackaged: false,
            resourcesPath: '',
            userDataPath: '',
            homedir: path.join(os.tmpdir(), 'no-clessapp-home'),
        })
        assert.equal(candidates[0], path.resolve(PROJECT_ROOT, 'cert'))
        assert.ok(!candidates.some((c) => c === path.resolve('C:\\app\\cert')))
    })

    it('prefers CLESS_CERT_DIR over project cert/', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cless-cert-'))
        try {
            fs.copyFileSync(path.join(PROJECT_CERT, 'key.pem'), path.join(tmp, 'key.pem'))
            fs.copyFileSync(path.join(PROJECT_CERT, 'key.crt'), path.join(tmp, 'key.crt'))
            const resolved = resolveCertificatePaths({
                appRoot: PROJECT_ROOT,
                envCertDir: tmp,
                isPackaged: false,
                resourcesPath: '',
                userDataPath: '',
                homedir: path.join(os.tmpdir(), 'no-clessapp-home'),
            })
            assert.equal(resolved.certDir, path.resolve(tmp))
            assert.equal(resolved.source, 'CLESS_CERT_DIR')
            assert.equal(resolved.keyFile, 'key.pem')
            assert.equal(resolved.certFile, 'key.crt')
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })

    it('resolves project cert/ in development without going to parent/../cert', () => {
        const resolved = resolveCertificatePaths({
            appRoot: PROJECT_ROOT,
            envCertDir: '',
            isPackaged: false,
            resourcesPath: '',
            userDataPath: '',
            homedir: path.join(os.tmpdir(), 'no-clessapp-home'),
        })
        assert.equal(resolved.certDir, path.resolve(PROJECT_CERT))
        assert.ok(resolved.keyPath.endsWith(path.join('cert', 'key.pem')))
        assert.ok(resolved.certPath.endsWith(path.join('cert', 'key.crt')))
        // Must NOT be the broken C:\\app\\cert style parent path when project cert exists
        assert.notEqual(resolved.certDir, path.resolve(PROJECT_ROOT, '..', 'cert'))
    })

    it('uses packaged resourcesPath/cert when project cert is absent', () => {
        const fakeApp = fs.mkdtempSync(path.join(os.tmpdir(), 'cless-app-'))
        const resources = fs.mkdtempSync(path.join(os.tmpdir(), 'cless-res-'))
        const resCert = path.join(resources, 'cert')
        fs.mkdirSync(resCert)
        try {
            fs.copyFileSync(path.join(PROJECT_CERT, 'key.pem'), path.join(resCert, 'key.pem'))
            fs.copyFileSync(path.join(PROJECT_CERT, 'key.crt'), path.join(resCert, 'key.crt'))
            const resolved = resolveCertificatePaths({
                appRoot: fakeApp,
                envCertDir: '',
                isPackaged: true,
                resourcesPath: resources,
                userDataPath: '',
                homedir: path.join(os.tmpdir(), 'no-clessapp-home'),
            })
            assert.equal(resolved.certDir, path.resolve(resCert))
        } finally {
            fs.rmSync(fakeApp, { recursive: true, force: true })
            fs.rmSync(resources, { recursive: true, force: true })
        }
    })

    it('loads PEM credentials without exposing key text in the summary', () => {
        const loaded = loadHttpsCredentials({
            appRoot: PROJECT_ROOT,
            envCertDir: '',
            isPackaged: false,
            resourcesPath: '',
            userDataPath: '',
            homedir: path.join(os.tmpdir(), 'no-clessapp-home'),
        })
        assert.ok(Buffer.isBuffer(loaded.key))
        assert.ok(Buffer.isBuffer(loaded.cert))
        assert.ok(loaded.key.length > 0)
        const summary = formatCertLoadSummary(loaded)
        assert.match(summary, /cert_dir=/)
        assert.match(summary, /key_file=key\.pem/)
        assert.doesNotMatch(summary, /BEGIN.*PRIVATE KEY/)
        assert.doesNotMatch(summary, /MII/)
    })

    it('throws a clear CertificateLoadError when files are missing', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'cless-empty-'))
        try {
            assert.throws(
                () =>
                    resolveCertificatePaths({
                        appRoot: empty,
                        envCertDir: empty,
                        isPackaged: false,
                        resourcesPath: '',
                        userDataPath: '',
                        homedir: path.join(os.tmpdir(), 'no-clessapp-home'),
                    }),
                (err) => {
                    assert.ok(err instanceof CertificateLoadError)
                    assert.match(err.message, /Unable to start HTTPS CPanel server/)
                    assert.match(err.message, /key\.pem/)
                    assert.match(err.message, /Expected certificate directory/)
                    assert.equal(err.code, 'CERT_FILES_MISSING')
                    return true
                }
            )
        } finally {
            fs.rmSync(empty, { recursive: true, force: true })
        }
    })

    it('accepts cert.pem as an alternate certificate filename', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cless-alt-'))
        try {
            fs.copyFileSync(path.join(PROJECT_CERT, 'key.pem'), path.join(tmp, 'key.pem'))
            fs.copyFileSync(path.join(PROJECT_CERT, 'key.crt'), path.join(tmp, 'cert.pem'))
            const resolved = resolveCertificatePaths({
                appRoot: path.join(tmp, 'app'),
                envCertDir: tmp,
                isPackaged: false,
                resourcesPath: '',
                userDataPath: '',
                homedir: path.join(os.tmpdir(), 'no-clessapp-home'),
            })
            assert.equal(resolved.certFile, 'cert.pem')
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })
})
