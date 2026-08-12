const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/** Per-app cookie file (avoids sibling apps refreshing each other). */
const cookiePath = path.join(app.getPath('userData'), 'cookies.json');
/** Legacy shared path — one-time migrate into this app's userData, then ignore. */
const legacySharedCookiePath = path.join(app.getPath('appData'), 'icloud-shared', 'cookies.json');

/** Session cookies (no expiry from Apple) otherwise die when Electron quits. */
const SESSION_COOKIE_TTL_SEC = 180 * 24 * 60 * 60;
const SAVE_DEBOUNCE_MS = 400;

let applyingPersisted = false;
let saveTimer = null;
let lastSavedFingerprint = '';

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isAppleFamilyDomain(domain) {
  const d = String(domain || '').toLowerCase();
  return d.includes('icloud.com') || d.includes('apple.com');
}

function normalizeSameSite(sameSite) {
  // Electron get() returns "unspecified"; set() is more reliable with lax.
  if (sameSite === 'no_restriction' || sameSite === 'lax' || sameSite === 'strict') {
    return sameSite;
  }
  return 'lax';
}

function cookieUrl(cookie) {
  const host = String(cookie.domain || '').replace(/^\./, '');
  const cookiePathPart = cookie.path || '/';
  return `https://${host}${cookiePathPart}`;
}

function serializeCookie(cookie) {
  const expirationDate =
    typeof cookie.expirationDate === 'number' && Number.isFinite(cookie.expirationDate)
      ? cookie.expirationDate
      : Math.floor(Date.now() / 1000) + SESSION_COOKIE_TTL_SEC;

  return {
    url: cookieUrl(cookie),
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    expirationDate,
    sameSite: normalizeSameSite(cookie.sameSite)
  };
}

function fingerprint(cookies) {
  return cookies
    .map((c) => `${c.name}\n${c.domain}\n${c.value}`)
    .sort()
    .join('\0');
}

async function getAppleFamilyCookies(ses) {
  const all = await ses.cookies.get({});
  return all.filter((c) => isAppleFamilyDomain(c.domain));
}

function readCookieFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const cookies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(cookies) && cookies.length > 0 ? cookies : null;
  } catch (_) {
    return null;
  }
}

async function applyCookies(ses, cookies) {
  applyingPersisted = true;
  try {
    let applied = 0;
    for (const cookie of cookies) {
      if (!cookie?.name || !cookie?.domain) continue;
      try {
        await ses.cookies.set(serializeCookie(cookie));
        applied += 1;
      } catch (_) {
        /* ignore invalid cookie */
      }
    }
    lastSavedFingerprint = fingerprint(cookies.map(serializeCookie));
    await ses.cookies.flushStore();
    return applied > 0;
  } finally {
    applyingPersisted = false;
  }
}

async function loadPersistedCookies(ses) {
  try {
    let cookies = readCookieFile(cookiePath);
    let migratedFromLegacy = false;
    if (!cookies) {
      cookies = readCookieFile(legacySharedCookiePath);
      migratedFromLegacy = !!cookies;
    }
    if (!cookies) return false;

    const applied = await applyCookies(ses, cookies);
    if (applied && migratedFromLegacy) {
      // Copy into this app only; do not keep syncing the shared file.
      await savePersistedCookies(ses);
    }
    return applied;
  } catch (_) {
    return false;
  }
}

async function savePersistedCookies(ses) {
  if (applyingPersisted) return;
  try {
    const cookiesToSave = (await getAppleFamilyCookies(ses)).map(serializeCookie);
    const nextFingerprint = fingerprint(cookiesToSave);
    if (nextFingerprint === lastSavedFingerprint) return;

    ensureDir(cookiePath);
    const tmpPath = `${cookiePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(cookiesToSave, null, 2));
    fs.renameSync(tmpPath, cookiePath);
    lastSavedFingerprint = nextFingerprint;
  } catch (_) {
    /* ignore */
  }
}

function scheduleSavePersistedCookies(ses) {
  if (applyingPersisted) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    savePersistedCookies(ses);
  }, SAVE_DEBOUNCE_MS);
}

function stopCookiePersistence() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function isApplyingPersistedCookies() {
  return applyingPersisted;
}

module.exports = {
  cookiePath,
  loadPersistedCookies,
  savePersistedCookies,
  scheduleSavePersistedCookies,
  stopCookiePersistence,
  isApplyingPersistedCookies,
  isAppleFamilyDomain,
  // Back-compat aliases (previous shared-cookie API)
  sharedCookiePath: cookiePath,
  loadSharedCookies: loadPersistedCookies,
  saveSharedCookies: savePersistedCookies,
  scheduleSaveSharedCookies: scheduleSavePersistedCookies,
  stopWatchingSharedCookies: stopCookiePersistence,
  isApplyingSharedCookies: isApplyingPersistedCookies,
  watchSharedCookies: () => {}
};
