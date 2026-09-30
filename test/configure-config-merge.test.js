'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

test('config-example.json includes auto-update system settings', () => {
  const example = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'config-example.json'), 'utf8')
  )
  assert.equal(typeof example.systemSettings.autoCheckUpdates, 'boolean')
  assert.equal(typeof example.systemSettings.autoInstallUpdates, 'boolean')
  assert.ok(example.systemSettings.updateCheckIntervalHours >= 1)
  assert.ok(example.syncSettings)
  assert.ok(example.displaySettings)
  assert.ok(example.networkSettings)
  assert.ok(example.mediaSettings)
})

test('configure.html exposes modern shell and update controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'configure.html'), 'utf8')
  assert.match(html, /app-shell/)
  assert.match(html, /cless-cpanel-theme|themeToggle/)
  assert.match(html, /id="autoCheckUpdates"/)
  assert.match(html, /id="checkForUpdatesSecondary"/)
  assert.match(html, /Application Updates/)
  assert.match(html, /Advanced Configuration/)
  assert.match(html, /displaySettings\.resolution|id="displayResolution"/)
  assert.match(html, /syncSettings\.syncMode|id="syncMode"/)
  assert.match(html, /update-client\.js/)
  assert.match(html, /configure-app\.js/)
})

test('second.html keeps existing GIF and real startup steps', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'second.html'), 'utf8')
  assert.match(html, /ezgif\.com-video-to-gif\.gif/)
  assert.match(html, /Loading configuration/)
  assert.match(html, /Checking network/)
  assert.match(html, /startup-status/)
  assert.match(html, /Offline Mode/)
  assert.match(html, /startupRetryBtn/)
  assert.match(html, /openwindow/)
})

test('UpdateManager startup delay is under 30s and respects autoCheck', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'UpdateManager.js'), 'utf8')
  assert.match(src, /STARTUP_CHECK_DELAY_MS\s*=\s*\d+/)
  const match = src.match(/STARTUP_CHECK_DELAY_MS\s*=\s*(\d+)/)
  assert.ok(match)
  assert.ok(Number(match[1]) <= 30000, 'startup check delay should be <= 30s')
  assert.match(src, /_readAutoCheck/)
  assert.match(src, /_schedulePeriodicChecks/)
  assert.match(src, /source: 'startup'/)
  assert.match(src, /source: 'periodic'/)
})

test('cpanel settings and configure share update field ids', () => {
  const cpanel = fs.readFileSync(path.join(__dirname, '..', 'src', 'cpanel.html'), 'utf8')
  const configure = fs.readFileSync(path.join(__dirname, '..', 'src', 'configure.html'), 'utf8')
  for (const id of [
    'autoCheckUpdates',
    'autoInstallUpdates',
    'updateCheckIntervalHours',
    'appUpdateStatus',
    'checkForUpdatesSecondary',
    'installUpdateBtn',
    'appVersionLabel'
  ]) {
    assert.match(cpanel, new RegExp(`id="${id}"`))
    assert.match(configure, new RegExp(`id="${id}"`))
  }
  assert.match(cpanel, /Application Updates/)
  assert.match(cpanel, /update-client\.js/)
})
