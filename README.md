# icloud-windows-base

Shared Electron wrapper for all iCloud Windows apps. Single place for tray, shared cookies, window bounds, splash, and auto-updater. Each app (Calendar, Contacts, Mail, etc.) depends on this package and only provides a small config.

## Usage (in each app)

**main.js** — thin entry point:

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

**package.json** — add dependency:

```json
"dependencies": {
  "icloud-windows-base": "^1.0.0",
  "electron-store": "^8.2.0",
  "electron-updater": "^6.1.8"
}
```

Keep in each app: `splash.html`, `icon.png`, `installer.nsh`, and app-specific `package.json` (appId, productName, build, etc.).

## Local development

From an app repo (e.g. `icloud-calendar-windows`) use a local path until the base is published:

```json
"icloud-windows-base": "file:../icloud-windows-base"
```

Run `npm install` in the app, then `npm start` / `npm run release` as usual.

## Publishing the base

1. Push this repo to GitHub (e.g. `taylorivanoff/icloud-windows-base`).
2. **Option A — npm:** `npm publish` (public or scoped, e.g. `@taylorivanoff/icloud-windows-base`).
3. **Option B — GitHub Packages:** Publish to npm with registry `https://npm.pkg.github.com` and use `"icloud-windows-base": "^1.0.0"` (or your scope).

After publishing, replace `file:../icloud-windows-base` with the version range in each app and run `npm update icloud-windows-base` when you want to pull in wrapper changes.

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
