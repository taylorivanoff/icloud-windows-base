const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const sharedCookiePath = path.join(app.getPath('appData'), 'icloud-shared', 'cookies.json');

/** Session cookies (no expiry from Apple) otherwise die when Electron quits. */
const SESSION_COOKIE_TTL_SEC = 180 * 24 * 60 * 60;
const SAVE_DEBOUNCE_MS = 400;
const WATCH_DEBOUNCE_MS = 300;
const WATCH_IGNORE_MS = 750;

let applyingShared = false;
let saveTimer = null;
let watchTimer = null;
let ignoreWatchUntil = 0;
let watcher = null;
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
  const cookiePath = cookie.path || '/';
  return `https://${host}${cookiePath}`;
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

async function loadSharedCookies(ses) {
  applyingShared = true;
  try {
    if (!fs.existsSync(sharedCookiePath)) return false;
    const raw = fs.readFileSync(sharedCookiePath, 'utf8');
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) return false;

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
  } catch (_) {
    return false;
  } finally {
    applyingShared = false;
  }
}

async function saveSharedCookies(ses) {
  if (applyingShared) return;
  try {
    const cookiesToSave = (await getAppleFamilyCookies(ses)).map(serializeCookie);
    const nextFingerprint = fingerprint(cookiesToSave);
    if (nextFingerprint === lastSavedFingerprint) return;

    ensureDir(sharedCookiePath);
    const tmpPath = `${sharedCookiePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(cookiesToSave, null, 2));
    fs.renameSync(tmpPath, sharedCookiePath);
    lastSavedFingerprint = nextFingerprint;
    ignoreWatchUntil = Date.now() + WATCH_IGNORE_MS;
  } catch (_) {
    /* ignore */
  }
}

function scheduleSaveSharedCookies(ses) {
  if (applyingShared) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveSharedCookies(ses);
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Keep sibling apps in sync while they are running.
 * @param {Electron.Session} ses
 * @param {{ onExternalUpdate?: () => void }} [options]
 */
function watchSharedCookies(ses, options = {}) {
  if (watcher) return;
  ensureDir(sharedCookiePath);

  const onChange = () => {
    if (Date.now() < ignoreWatchUntil) return;
    if (watchTimer) clearTimeout(watchTimer);
    watchTimer = setTimeout(async () => {
      watchTimer = null;
      if (Date.now() < ignoreWatchUntil) return;
      const applied = await loadSharedCookies(ses);
      if (applied && typeof options.onExternalUpdate === 'function') {
        options.onExternalUpdate();
      }
    }, WATCH_DEBOUNCE_MS);
  };

  try {
    watcher = fs.watch(path.dirname(sharedCookiePath), { persistent: false }, (_event, filename) => {
      if (filename && !String(filename).startsWith('cookies.json')) return;
      onChange();
    });
    watcher.on('error', () => {
      /* ignore watcher errors */
    });
  } catch (_) {
    watcher = null;
  }
}

function stopWatchingSharedCookies() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (watchTimer) {
    clearTimeout(watchTimer);
    watchTimer = null;
  }
  if (watcher) {
    try {
      watcher.close();
    } catch (_) {
      /* ignore */
    }
    watcher = null;
  }
}

function isApplyingSharedCookies() {
  return applyingShared;
}

module.exports = {
  sharedCookiePath,
  loadSharedCookies,
  saveSharedCookies,
  scheduleSaveSharedCookies,
  watchSharedCookies,
  stopWatchingSharedCookies,
  isApplyingSharedCookies,
  isAppleFamilyDomain
};
