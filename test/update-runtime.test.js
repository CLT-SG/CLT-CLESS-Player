'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { isProductionInstall } = require('../update-runtime')

test('isProductionInstall is true only for packaged Electron apps', () => {
  assert.equal(isProductionInstall({ isPackaged: true }), true)
  assert.equal(isProductionInstall({ isPackaged: false }), false)
  assert.equal(isProductionInstall({}), false)
  assert.equal(isProductionInstall(null), false)
  assert.equal(isProductionInstall(undefined), false)
})

test('isProductionInstall ignores NODE_ENV-style fields (packaged wins)', () => {
  // A packaged install must count as production even if env looks like "development"
  assert.equal(
    isProductionInstall({ isPackaged: true, env: { NODE_ENV: 'development' } }),
    true
  )
  // Unpackaged source must never count as production
  assert.equal(
    isProductionInstall({ isPackaged: false, env: { NODE_ENV: 'production' } }),
    false
  )
})

test('UpdateManager gates automatic checks to production installs', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'UpdateManager.js'), 'utf8')
  assert.match(src, /isProductionInstall/)
  assert.match(src, /Development mode detected - automatic update disabled/)
  assert.match(src, /_scheduleStartupCheck/)
  assert.match(src, /dispose\s*\(/)
  // Periodic scheduler must refuse non-production
  assert.match(src, /periodic update checks skipped \(not a production\/installed app\)/)
  // Startup path must not run when Auto Update setting is off
  assert.match(src, /startup update check disabled by Auto Update setting/)
  // Development check must not contact the update server
  assert.match(src, /no update server contact/)
})

test('index.js disposes UpdateManager timers on before-quit', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
  assert.match(src, /before-quit/)
  assert.match(src, /updateManager\.dispose/)
})

test('package.json keeps Electron 22.x for updater compatibility', () => {
  const pkg = require('../package.json')
  assert.match(pkg.devDependencies.electron, /^[\^~]?22\./)
  assert.ok(pkg.dependencies['electron-updater'])
})
