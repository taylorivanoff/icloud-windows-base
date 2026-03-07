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
  "icloud-windows-base": "^1.0.12",
  "electron-store": "^8.2.0",
  "electron-updater": "^6.1.8"
}
```

Keep in each app: `splash.html`, `icon.png`, `installer.nsh`, and app-specific `package.json` (appId, productName, build, etc.).

## Publishing to npm

Apps install the package from npm, so you must publish after changing the base:

**Manual:** From this repo run `npm login` (once), then `npm publish`.

**Via CI:** Push a version tag (e.g. `v1.0.12`) and add `NPM_TOKEN` (classic token with “Automation” or “Publish” scope) as a repo secret. The workflow will run `npm publish`.

After publishing, bump the version in this repo, tag, push; in each app run `npm update icloud-windows-base` (or bump the version range in their package.json) to pick up changes.

## Local development

To test base changes without publishing, in an app use a local path:

```json
"icloud-windows-base": "file:../icloud-windows-base"
```

Run `npm install` in the app, then `npm start` / `npm run release`. Switch back to `"^1.0.12"` (or current version) before committing.

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
