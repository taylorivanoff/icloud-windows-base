const { shell } = require('electron');
const { SAFARI_UA } = require('./constants');
const {
  loadPersistedCookies,
  scheduleSavePersistedCookies,
  isApplyingPersistedCookies,
  isAppleFamilyDomain
} = require('./cookies');
const { removeIcloudToolbar } = require('./toolbar');

function parseAppTarget(icloudUrl) {
  try {
    const u = new URL(icloudUrl);
    const pathname = u.pathname.replace(/\/+$/, '') || '/';
    return { origin: u.origin, hostname: u.hostname, pathname, href: icloudUrl };
  } catch (_) {
    return null;
  }
}

function isIcloudHomeRedirect(url, appTarget) {
  if (!appTarget || !appTarget.hostname.endsWith('icloud.com')) return false;
  if (appTarget.pathname === '/') return false;
  try {
    const u = new URL(url);
    if (u.origin !== appTarget.origin) return false;
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return path === '/';
  } catch (_) {
    return false;
  }
}

function attachNavigationGuard(webContents, appTarget) {
  const blockHome = (event, url) => {
    if (isIcloudHomeRedirect(url, appTarget)) {
      event.preventDefault();
      webContents.loadURL(appTarget.href);
    }
  };
  webContents.on('will-navigate', blockHome);
  webContents.on('will-redirect', blockHome);
}

function attachToolbarRemoval(webContents) {
  const run = () => removeIcloudToolbar(webContents);
  webContents.on('dom-ready', run);
  webContents.on('did-finish-load', run);
  webContents.on('did-navigate-in-page', run);
  webContents.on('did-frame-finish-load', (_e, isMainFrame) => {
    if (!isMainFrame) run();
  });
}

async function setupIcloudWebview(win, { icloudUrl, removeToolbar = false, enableOpenAtLogin }) {
  const ses = win.webContents.session;
  await loadPersistedCookies(ses);

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = SAFARI_UA;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url !== 'about:blank#blocked') shell.openExternal(url);
    return { action: 'deny' };
  });

  attachNavigationGuard(win.webContents, parseAppTarget(icloudUrl));
  if (removeToolbar) attachToolbarRemoval(win.webContents);

  ses.cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (isApplyingPersistedCookies()) return;
    if (!isAppleFamilyDomain(cookie?.domain)) return;
    scheduleSavePersistedCookies(ses);
    if (!removed && cookie.name === 'X-APPLE-WEBAUTH-LOGIN' && typeof enableOpenAtLogin === 'function') {
      enableOpenAtLogin();
    }
  });
}

module.exports = { setupIcloudWebview };
