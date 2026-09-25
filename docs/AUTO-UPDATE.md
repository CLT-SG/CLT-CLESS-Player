# CLESS-Player Auto-Update (GitHub Releases)

CLESS-Player can update itself from the project's GitHub Releases using `electron-updater`. Electron stays at the version declared in `package.json` (`22.3.9`).

## How deployed players update

1. Player starts (packaged install only).
2. After a short delay it checks GitHub Releases for a newer version than `app.getVersion()` / `package.json`.
3. If a newer release exists, the matching installer downloads in the background.
4. When download finishes:
   - Default: control panel shows **Update downloaded. Restart to apply.**
   - If **Auto Install & Restart Updates** is enabled: the player installs and restarts automatically (airport / unattended mode).
5. Periodic checks continue while the player runs (default every 6 hours).
6. If GitHub is unreachable, the failure is logged and **playback continues**.

### Control panel

Open `https://<player-ip>:9000`:

- **Check for Updates**
- Status text (`Checking for updates...`, `You are using the latest version.`, download progress, failures)
- **Auto Check for App Updates**
- **Auto Install & Restart Updates (unattended)**
- **Restart to Apply Update** after a successful download

APIs:

- `GET /api/updates/status`
- `POST /api/updates/check`
- `POST /api/updates/install`

Logs go to the existing electron-log files under `~/clessapp/logs/`.

### Private repositories

If Releases are private, set a GitHub token with `contents:read` on Releases:

- Environment: `GH_TOKEN` / `GITHUB_TOKEN`, or
- Config: `systemSettings.githubToken` in `~/clessapp/config.json`

Public Releases need no token.

### Linux notes

Windows uses NSIS installers. Linux ships both `.deb` (manual install) and `.AppImage` (used by electron-updater). Prefer the AppImage for devices that should auto-update.

## How to publish a new Player release

1. Bump `"version"` in `package.json` (semver, e.g. `3.13.2`). Do **not** change the Electron version unless intentionally upgrading Electron in a separate change.
2. Commit and push to the branch you want to release from.
3. Tag and push:

```bash
git tag v3.13.2
git push origin v3.13.2
```

4. GitHub Actions workflow **Release** (`.github/workflows/release.yml`) will:
   - Install dependencies and pin Electron to the version in `package.json`
   - Build Windows ia32 + x64 NSIS and Linux x64 deb + AppImage
   - Generate updater metadata (`latest.yml`, `latest-linux.yml`, blockmaps)
   - Create GitHub Release `CLESS-Player vX.Y.Z` with generated notes
   - Upload installers and metadata

Manual test without a new tag: **Actions → Release → Run workflow**.

The release tag must match `package.json` (`v` + version). Incomplete builds do not publish a release.

## CLESS-Server version reporting

Packaged players append `?v=<appVersion>` when polling `/{ds_id}/ds.xml`. CLESS-Server stores this on the Digital Signage record so administrators can see outdated devices. Older players that omit `v` keep working.
