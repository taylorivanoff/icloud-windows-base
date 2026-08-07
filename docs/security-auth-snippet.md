<!-- Canonical text for README "Security & authentication" sections. Edit here, then sync to app READMEs. -->

## Security & authentication

This app is **not affiliated with Apple**. It is an unofficial desktop wrapper that loads the official Apple web experience in a secure Electron window.

### How sign-in works

- You sign in on **Apple’s own websites** inside the app window—the same sign-in and two-factor authentication flow you would use in Safari or Chrome.
- **Your Apple ID password is never collected or stored by this app.** Credentials are entered only on Apple-controlled pages and handled entirely by Apple.
- After sign-in, Apple sets standard **web session cookies**. The app uses those cookies only to keep you logged in and to load your data from Apple’s servers.

### What is stored locally

| Data | Purpose |
|------|---------|
| Session cookies for `icloud.com` and `apple.com` | Stay signed in; **shared across all of these desktop apps** on the same Windows user account |
| Window size, position, and tray preferences | Convenience settings only (not your Apple ID) |

Session cookies are kept in:

- `%APPDATA%\icloud-shared\cookies.json` — shared cookie file used by every app in this family
- Electron’s persistent session partition (`persist:icloud`) — the in-app browser session

Cookies are saved when they change and when the app quits. They are **not** sent to the app author or any third party—only back to Apple when the embedded web view loads Apple services, the same as in a normal browser.

### What the app does not do

- Does not implement its own login form or password database
- Does not send your Apple ID or session to non-Apple servers
- Does not enable Node.js inside the web page (`nodeIntegration: false`)
- Does not read or modify your mail, photos, or other content outside Apple’s own web app

Links you open from the app (for example “Open in browser”) are handed off to your **default system browser** via the OS.

### Updates

Updates are downloaded from **GitHub Releases** using [electron-updater](https://www.electron.build/auto-update). Only the app binary is updated; your Apple sign-in is unchanged.

### Recommendations

- Use a **password-protected Windows account** and **device encryption** (BitLocker). Session cookies on disk are only as secure as your user profile.
- To sign out on this PC, use **Sign Out** in the iCloud or Apple web UI inside the app, or delete `%APPDATA%\icloud-shared\cookies.json` and quit all related apps.
- Install only from **official GitHub releases** for this project.

The shared wrapper ([icloud-windows-base](https://github.com/taylorivanoff/icloud-windows-base)) is open source so you can review how sessions and cookies are handled.
