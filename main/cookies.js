const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const sharedCookiePath = path.join(app.getPath('appData'), 'icloud-shared', 'cookies.json');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function loadSharedCookies(ses) {
  try {
    if (fs.existsSync(sharedCookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(sharedCookiePath, 'utf8'));
      for (const cookie of cookies) {
        try {
          await ses.cookies.set(cookie);
        } catch (_) { /* ignore invalid cookie */ }
      }
    }
  } catch (_) { /* ignore */ }
}

async function saveSharedCookies(ses) {
  try {
    const icloudCookies = await ses.cookies.get({ domain: 'icloud.com' });
    const appleCookies = await ses.cookies.get({ domain: 'apple.com' });
    const allCookies = [...icloudCookies, ...appleCookies];
    const cookiesToSave = allCookies.map((c) => ({
      url: `https://${c.domain.replace(/^\./, '')}${c.path}`,
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expirationDate: c.expirationDate,
      sameSite: c.sameSite || 'lax'
    }));
    ensureDir(sharedCookiePath);
    fs.writeFileSync(sharedCookiePath, JSON.stringify(cookiesToSave, null, 2));
  } catch (_) { /* ignore */ }
}

module.exports = { sharedCookiePath, loadSharedCookies, saveSharedCookies };
