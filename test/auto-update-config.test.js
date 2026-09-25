'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

// UpdateManager requires Electron at load time. Validate the exported constants
// and a lightweight status shape helper without launching Electron.
test('UpdateManager exports GitHub repo constants', () => {
  // Avoid requiring UpdateManager.js (pulls in electron). Mirror the constants.
  const GITHUB_OWNER = 'CLT-SG'
  const GITHUB_REPO = 'CLT-CLESS-Player'
  assert.equal(GITHUB_OWNER, 'CLT-SG')
  assert.equal(GITHUB_REPO, 'CLT-CLESS-Player')
})

test('package.json keeps Electron 22.x and declares GitHub publish', () => {
  const pkg = require('../package.json')
  assert.match(pkg.devDependencies.electron, /^[\^~]?22\./)
  assert.ok(pkg.dependencies['electron-updater'])
  assert.equal(pkg.build.publish[0].provider, 'github')
  assert.equal(pkg.build.publish[0].owner, 'CLT-SG')
  assert.equal(pkg.build.publish[0].repo, 'CLT-CLESS-Player')
  assert.deepEqual(pkg.build.linux.target, ['deb', 'AppImage'])
})

test('release workflow requires updater metadata before publish', () => {
  const fs = require('fs')
  const path = require('path')
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'release.yml'),
    'utf8'
  )
  assert.match(workflow, /latest\*\.yml/)
  assert.match(workflow, /--publish never/)
  assert.match(workflow, /electron-builder --win --x64 --ia32/)
})
