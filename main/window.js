const { BrowserWindow, shell, powerMonitor } = require('electron');
const { SAFARI_UA } = require('./constants');
const {
  loadSharedCookies,
  scheduleSaveSharedCookies,
  watchSharedCookies,
  isApplyingSharedCookies,
  isAppleFamilyDomain
} = require('./cookies');
const { getWindowBounds, saveWindowBounds } = require('./store');
const { enableOpenAtLogin } = require('./login');
const { removeIcloudToolbar } = require('./toolbar');

let mainWindow = null;
let splashWindow = null;
let staleAfterSleep = false;

function parseAppTarget(icloudUrl) {
  try {
    const u = new URL(icloudUrl);
    const pathname = u.pathname.replace(/\/+$/, '') || '/';
    return { origin: u.origin, hostname: u.hostname, pathname, href: icloudUrl };
  } catch (_) {
    return null;
  }
}

/** True when url is the iCloud home/launchpad, not the configured app path. */
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

function createSplash(splashPath) {
  splashWindow = new BrowserWindow({
    width: 300,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: { nodeIntegration: false }
  });
  splashWindow.loadFile(splashPath);
  splashWindow.center();
}

function getMainWindow() {
  return mainWindow;
}

function showMainWindow() {
  if (mainWindow) mainWindow.show();
}

async function createWindow({
  store,
  icloudUrl,
  startMinimised,
  isQuittingRef,
  removeToolbar = false
}) {
  if (mainWindow) return;
  const bounds = getWindowBounds(store);
  const appTarget = parseAppTarget(icloudUrl);

  mainWindow = new BrowserWindow({
    ...bounds,
    show: false,
    webPreferences: { nodeIntegration: false, partition: 'persist:icloud' }
  });

  const ses = mainWindow.webContents.session;
  await loadSharedCookies(ses);

  watchSharedCookies(ses, {
    onExternalUpdate: () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      // Pick up a login (or sign-out) performed in another app.
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = SAFARI_UA;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  mainWindow.setMenu(null);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url !== 'about:blank#blocked') shell.openExternal(url);
    return { action: 'deny' };
  });

  attachNavigationGuard(mainWindow.webContents, appTarget);
  if (removeToolbar) attachToolbarRemoval(mainWindow.webContents);

  mainWindow.loadURL(icloudUrl);

  mainWindow.webContents.on('did-finish-load', () => {
    if (splashWindow) {
      splashWindow.destroy();
      splashWindow = null;
    }
    if (!startMinimised) mainWindow.show();
  });

  ses.cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (isApplyingSharedCookies()) return;
    if (!isAppleFamilyDomain(cookie?.domain)) return;
    scheduleSaveSharedCookies(ses);
    if (!removed && cookie.name === 'X-APPLE-WEBAUTH-LOGIN') {
      enableOpenAtLogin(() => store.get('startMinimised', true));
    }
  });

  mainWindow.on('resize', () => saveWindowBounds(store, mainWindow));
  mainWindow.on('move', () => saveWindowBounds(store, mainWindow));
  mainWindow.on('show', () => {
    if (!staleAfterSleep) return;
    staleAfterSleep = false;
    refreshPage();
  });
  mainWindow.on('close', (event) => {
    if (!isQuittingRef.current) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function refreshPage() {
  if (!mainWindow) return;
  mainWindow.webContents.reloadIgnoringCache();
}

function setupSleepResumeRefresh() {
  powerMonitor.on('resume', () => {
    staleAfterSleep = true;
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      staleAfterSleep = false;
      refreshPage();
    }
  });
}

module.exports = {
  createSplash,
  createWindow,
  refreshPage,
  setupSleepResumeRefresh,
  getMainWindow,
  showMainWindow
};
