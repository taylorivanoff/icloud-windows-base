const { app, BrowserWindow, session, Tray, Menu, nativeImage, shell, screen, powerMonitor, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

const START_MINIMIZED_ARG = '--start-minimized';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Run the iCloud Electron app with the given config.
 * @param {{
 *   appName: string;
 *   protocol: string;
 *   icloudUrl: string;
 *   splashPath: string;
 *   iconPath: string;
 * }} config - App-specific config (appName, protocol, icloudUrl, paths to splash.html and icon.png)
 */
function run(config) {
  const { appName, protocol, icloudUrl, splashPath, iconPath } = config;
  const store = new Store();
  const sharedCookiePath = path.join(app.getPath('appData'), 'icloud-shared', 'cookies.json');

  function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function getStartMinimised() {
    return store.get('startMinimised', true);
  }

  function setStartMinimised(value) {
    store.set('startMinimised', value);
    syncLoginItemArgs();
    if (tray) tray.setContextMenu(buildTrayMenu());
  }

  function shouldStartMinimised() {
    return getStartMinimised();
  }

  function syncLoginItemArgs() {
    const login = app.getLoginItemSettings();
    if (!login.openAtLogin) return;
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: getStartMinimised() ? [START_MINIMIZED_ARG] : []
    });
  }

  function enableOpenAtLogin() {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: getStartMinimised() ? [START_MINIMIZED_ARG] : []
    });
  }

  async function loadSharedCookies(ses) {
    try {
      if (fs.existsSync(sharedCookiePath)) {
        const cookies = JSON.parse(fs.readFileSync(sharedCookiePath, 'utf8'));
        for (const cookie of cookies) {
          try { await ses.cookies.set(cookie); } catch (e) { }
        }
      }
    } catch (e) { }
  }

  async function saveSharedCookies(ses) {
    try {
      const icloudCookies = await ses.cookies.get({ domain: 'icloud.com' });
      const appleCookies = await ses.cookies.get({ domain: 'apple.com' });
      const allCookies = [...icloudCookies, ...appleCookies];
      const cookiesToSave = allCookies.map(c => ({
        url: `https://${c.domain.replace(/^\./, '')}${c.path}`,
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        secure: c.secure, httpOnly: c.httpOnly, expirationDate: c.expirationDate,
        sameSite: c.sameSite || 'lax'
      }));
      ensureDir(sharedCookiePath);
      fs.writeFileSync(sharedCookiePath, JSON.stringify(cookiesToSave, null, 2));
    } catch (e) { }
  }

  function getWindowBounds() {
    const saved = store.get('windowBounds');
    const defaults = { width: 1280, height: 800 };
    if (!saved) return defaults;
    const displays = screen.getAllDisplays();
    const inBounds = displays.some(d => {
      const { x, y, width, height } = d.bounds;
      return saved.x >= x && saved.x < x + width && saved.y >= y && saved.y < y + height;
    });
    return inBounds ? saved : defaults;
  }

  function saveWindowBounds() {
    if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  }

  let mainWindow, splashWindow, tray, isQuitting = false, startMinimised = true, manualUpdateCheck = false, staleAfterSleep = false;
  const gotTheLock = app.requestSingleInstanceLock();

  async function checkForUpdates(manual = false) {
    if (!app.isPackaged) return;
    manualUpdateCheck = manual;
    try {
      await autoUpdater.checkForUpdates();
    } catch (_) {
      manualUpdateCheck = false;
    }
  }

  if (!gotTheLock) { app.quit(); return; }

  app.on('second-instance', (event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
    handleProtocolUrl(argv.find(a => a.startsWith(`${protocol}://`)));
  });

  function handleProtocolUrl(url) {
    if (!url || !mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  }

  function createSplash() {
    splashWindow = new BrowserWindow({
      width: 300, height: 350, frame: false, transparent: true, alwaysOnTop: true,
      skipTaskbar: true, resizable: false, webPreferences: { nodeIntegration: false }
    });
    splashWindow.loadFile(splashPath);
    splashWindow.center();
  }

  async function createWindow() {
    if (mainWindow) return;
    const bounds = getWindowBounds();
    mainWindow = new BrowserWindow({
      ...bounds, show: false,
      webPreferences: { nodeIntegration: false, partition: 'persist:icloud' }
    });
    const ses = mainWindow.webContents.session;
    await loadSharedCookies(ses);
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
    mainWindow.setMenu(null);
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url !== 'about:blank#blocked') shell.openExternal(url);
      return { action: 'deny' };
    });
    mainWindow.loadURL(icloudUrl);
    mainWindow.webContents.on('did-finish-load', () => {
      if (splashWindow) { splashWindow.destroy(); splashWindow = null; }
      // Stay in tray when Start minimised is on (or launched at Windows login).
      if (!startMinimised) mainWindow.show();
    });
    ses.cookies.on('changed', (event, cookie, cause, removed) => {
      if (cookie.domain?.includes('icloud.com') || cookie.domain?.includes('apple.com')) {
        saveSharedCookies(ses);
        if (!removed && cookie.name === 'X-APPLE-WEBAUTH-LOGIN')
          enableOpenAtLogin();
      }
    });
    mainWindow.on('resize', saveWindowBounds);
    mainWindow.on('move', saveWindowBounds);
    mainWindow.on('show', () => {
      if (!staleAfterSleep) return;
      staleAfterSleep = false;
      refreshPage();
    });
    mainWindow.on('close', (event) => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); } });
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  async function refreshPage() {
    if (!mainWindow) await createWindow();
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

  function buildTrayMenu() {
    return Menu.buildFromTemplate([
      { label: `Show ${appName}`, click: () => { if (!mainWindow) createWindow(); mainWindow.show(); } },
      { label: 'Refresh', click: () => { refreshPage(); } },
      { type: 'separator' },
      {
        label: 'Start minimised',
        type: 'checkbox',
        checked: getStartMinimised(),
        click: (item) => setStartMinimised(item.checked)
      },
      { type: 'separator' },
      { label: 'Check for Updates', click: () => checkForUpdates(true) },
      { label: `Version ${app.getVersion()}`, enabled: false },
      { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]);
  }

  function notifyUpdateFound(version) {
    if (!Notification.isSupported()) return;
    new Notification({
      title: appName,
      body: `Update ${version} found. The app will update and restart.`,
      icon: iconPath
    }).show();
  }

  function createTray() {
    if (tray) return;
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
    tray.setToolTip(appName);
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => { if (!mainWindow) { createWindow(); return; } mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); });
  }

  function setupJumpList() {
    app.setJumpList([]);
  }

  function setupAutoUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      notifyUpdateFound(info.version);
    });

    autoUpdater.on('update-not-available', () => {
      manualUpdateCheck = false;
    });

    autoUpdater.on('update-downloaded', () => {
      manualUpdateCheck = false;
      isQuitting = true;
      autoUpdater.quitAndInstall(true, true);
    });

    autoUpdater.on('error', () => {
      manualUpdateCheck = false;
    });

    checkForUpdates(false);
    setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
  }

  app.setAsDefaultProtocolClient(protocol);

  app.on('ready', () => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
      if (pkg.build?.appId) app.setAppUserModelId(pkg.build.appId);
    } catch (_) { /* ignore */ }
    startMinimised = shouldStartMinimised();
    syncLoginItemArgs();
    if (!startMinimised) createSplash();
    createWindow();
    createTray();
    setupJumpList();
    setupAutoUpdater();
    setupSleepResumeRefresh();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  app.on('window-all-closed', (event) => { if (!isQuitting) event.preventDefault(); });
  app.on('before-quit', async () => { isQuitting = true; const ses = session.fromPartition('persist:icloud'); await saveSharedCookies(ses); await ses.cookies.flushStore(); });
}

module.exports = { run };
