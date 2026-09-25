# CLESS-Player HTTPS certificates

The control panel HTTPS server (port **9000**) loads TLS material from a resolved
certificate directory. Do **not** hardcode machine paths such as `C:\app\cert`.

## Required files

```text
cert/
├── key.pem    # private key (PEM)
└── key.crt    # server certificate (PEM)
```

Alternate certificate filenames are also accepted: `cert.pem`, `server.crt`, `fullchain.pem`.

`csr.pem` is not required at runtime.

## Resolution order

1. Environment variable `CLESS_CERT_DIR` (exclusive when set)
2. `~/clessapp/config.json` field `certDir` / `https.certDir` / `cpanel.certDir` (exclusive when set)
3. Development / source tree: `<application root>/cert`
4. Packaged Electron: `<process.resourcesPath>/cert` (`extraResources`)
5. Electron `userData/cert`
6. `~/clessapp/cert`
7. Legacy fallback: `<application root>/../cert`

## Configuration examples

```bat
set CLESS_CERT_DIR=C:\CLESS\cert
```

```json
{
  "certDir": "C:\\CLESS\\cert"
}
```

## Packaging

`electron-builder` copies `./cert` into `resources/cert` via `extraResources`.
Private key files are **not** placed in renderer/static trees and must never be
exposed through Express routes or API responses.

## Security

- Private keys are read only in the Electron main / cpanel process.
- Log lines may include the certificate **directory** and filenames only — never key contents.
- Routes `/cert` and `/api/cert` return 404 by design.
