'use strict'

/**
 * Runtime helpers for CLESS-Player update gating.
 * Kept Electron-free so unit tests can require this module directly.
 */

/**
 * Reliable production/installed detection.
 *
 * Electron sets `app.isPackaged === true` for electron-builder artifacts and
 * installed applications (including locally packaged production builds).
 * Unpackaged `electron .` / source runs are development.
 *
 * Do not classify production solely from NODE_ENV or similar env vars —
 * a packaged install may still have NODE_ENV unset or "development".
 *
 * @param {{ isPackaged?: boolean } | null | undefined} appLike
 * @returns {boolean}
 */
function isProductionInstall(appLike) {
    return !!(appLike && appLike.isPackaged === true)
}

module.exports = {
    isProductionInstall
}
