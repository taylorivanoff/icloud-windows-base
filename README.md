# icloud-windows-base - Shared Electron Wrapper for Windows Web Apps

Shared **Electron base package** for **web apps on Windows**. One library for system tray, persistent sessions, window bounds persistence, splash screen, and auto-updater. Single-service wrappers and the Premium Web App Launcher use this package.

Published on npm as [`icloud-windows-base`](https://www.npmjs.com/package/icloud-windows-base).

## What it powers

The original single-service wrappers support iCloud Calendar, Contacts, Drive, Find My, Keynote, Mail, Notes, Numbers, Pages, Photos, Reminders, plus Apple Music, Podcasts, TV, and Invites. The launcher API also supports configurable HTTPS web apps without making iCloud the product identity.

## Usage (in each app)

**main.js** - thin entry point:

```js
const path = require('path');
require('icloud-windows-base').run({
  appName: 'iCloud Calendar',
  protocol: 'icloud-calendar',
  icloudUrl: 'https://www.icloud.com/calendar',
  splashPath: path.join(__dirname, 'splash.html'),
  iconPath: path.join(__dirname, 'icon.png')
});
```

**package.json** - add dependency:

```json
"dependencies": {
  "icloud-windows-base": "^1.0.14",
  "electron-store": "^8.2.0",
  "electron-updater": "^6.1.8"
}
```

Keep in each app: `splash.html`, `icon.png`, `installer.nsh`, and app-specific `package.json` (appId, productName, build, etc.).

## Package layout

| Module | Responsibility |
|--------|----------------|
| `main/index.js` | App lifecycle orchestration (`run()`) |
| `main/window.js` | BrowserWindow, navigation guard, sleep refresh |
| `main/toolbar.js` | Remove iCloud in-page toolbar (DOM + MutationObserver) |
| `main/cookies.js` | Shared Apple session cookies across apps |
| `main/store.js` | Window bounds and tray preferences |
| `main/login.js` | Windows startup login item |
| `main/tray.js` | System tray menu |
| `main/updater.js` | GitHub release auto-updates |

Root `index.js` re-exports `./main` for backward compatibility.

## Publishing to npm

Apps install the package from npm, so you must publish after changing the base:

**Manual:** From this repo run `npm login` (once), then `npm publish`.

**Via CI:** Push a version tag (e.g. `v1.0.14`) and add `NPM_TOKEN` (classic token with "Automation" or "Publish" scope) as a repo secret. The workflow will run `npm publish`.

After publishing, bump the version in this repo, tag, push; in each app run `npm update icloud-windows-base` (or bump the version range in their package.json) to pick up changes.

## Local development

To test base changes without publishing, in an app use a local path:

```json
"icloud-windows-base": "file:../icloud-windows-base"
```

Run `npm install` in the app, then `npm start` / `npm run release`. Switch back to `"^1.0.14"` (or current version) before committing.

## Config for each app

| App | appName | protocol | icloudUrl |
|-----|---------|----------|-----------|
| Calendar | iCloud Calendar | icloud-calendar | https://www.icloud.com/calendar |
| Contacts | iCloud Contacts | icloud-contacts | https://www.icloud.com/contacts |
| Drive/Files | iCloud Drive | icloud-drive | https://www.icloud.com/iclouddrive |
| Find My | iCloud Find My | icloud-findmy | https://www.icloud.com/find |
| Keynote | iCloud Keynote | icloud-keynote | https://www.icloud.com/keynote |
| Mail | iCloud Mail | icloud-mail | https://www.icloud.com/mail |
| Notes | iCloud Notes | icloud-notes | https://www.icloud.com/notes |
| Numbers | iCloud Numbers | icloud-numbers | https://www.icloud.com/numbers |
| Pages | iCloud Pages | icloud-pages | https://www.icloud.com/pages |
| Photos | iCloud Photos | icloud-photos | https://www.icloud.com/photos |
| Reminders | iCloud Reminders | icloud-reminders | https://www.icloud.com/reminders |

## Launcher API

Use `runLauncher` for a product that owns a catalog of web apps:

```js
require('icloud-windows-base').runLauncher({
  appName: 'Premium Web App Launcher',
  protocol: 'web-app-launcher',
  entries: [{ id: 'notes', name: 'Notes', url: 'https://example.com' }],
  launcherPath: path.join(__dirname, 'launcher.html'),
  preloadPath: path.join(__dirname, 'preload.js'),
  iconPath: path.join(__dirname, 'icon.png')
});
```

The launcher opens HTTPS entries as vertical, tab-like views inside the launcher window, persists a shared browser session, and provides tray/startup behavior. It does not store service credentials.

## Security & authentication

Apps built on this package load **official Apple web UIs** in an Electron `BrowserWindow`. There is no custom login API and no password storage.

### User-facing summary

Each app README includes a [Security & authentication](docs/security-auth-snippet.md) section for end users. In short:

- Sign-in happens on Apple-controlled pages (`icloud.com`, `apple.com`, etc.).
- Session cookies for `icloud.com` and `apple.com` are persisted in partition `persist:icloud` and mirrored to `%APPDATA%\icloud-shared\cookies.json` so all apps in this family share one sign-in on the same Windows user account.
- `electron-store` holds only UI preferences (window bounds, tray options)—never Apple ID credentials.
- `nodeIntegration: false` in the web view; external links open via `shell.openExternal`.

### Implementation (for reviewers)

| Mechanism | Location in `index.js` |
|-----------|------------------------|
| Load shared cookies on startup | `loadSharedCookies()` → `persist:icloud` |
| Save cookies on change / quit | `saveSharedCookies()`, `ses.cookies.on('changed')`, `before-quit` |
| Shared cookie file | `%APPDATA%\icloud-shared\cookies.json` |
| Domains synced | `icloud.com`, `apple.com` only |
| Start at Windows login | Enabled after `X-APPLE-WEBAUTH-LOGIN` cookie is set |

Cookies are written to disk as JSON and are only as protected as the Windows user profile. Apps do not transmit session data to the package author or third parties—requests go to Apple the same way they would from a browser using those cookies.

To sign out on a machine, users should use Apple's web **Sign Out** or delete the shared cookie file and quit all related apps.

## Keywords

iCloud Windows Electron base, shared Electron tray wrapper, Apple ID session cookies, iCloud desktop app framework, electron-updater Windows template

## License

See repository license file if present.
