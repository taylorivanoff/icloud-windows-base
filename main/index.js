const { app, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { createStore, getStartMinimised, setStartMinimised } = require('./store');
const { saveSharedCookies, stopWatchingSharedCookies } = require('./cookies');
const { syncLoginItemArgs } = require('./login');
const {
  createSplash,
  createWindow,
  refreshPage,
  setupSleepResumeRefresh,
  getMainWindow,
  showMainWindow
} = require('./window');
const {
  notifyUpdateFound,
  buildTrayMenu,
  createTray,
  updateTrayMenu,
  setTrayClickHandler
} = require('./tray');
const { setupAutoUpdater } = require('./updater');

/**
 * Run the iCloud Electron app with the given config.
 * @param {{
 *   appName: string;
 *   protocol: string;
 *   icloudUrl: string;
 *   splashPath: string;
 *   iconPath: string;
 *   removeToolbar?: boolean;
 * }} config
 */
function run(config) {
  const { appName, protocol, icloudUrl, splashPath, iconPath, removeToolbar = false } = config;
  const store = createStore();
  const isQuittingRef = { current: false };
  let startMinimised = true;
  let checkForUpdates = () => {};

  function windowOpts() {
    return { store, icloudUrl, startMinimised, isQuittingRef, removeToolbar };
  }

  function readStartMinimised() {
    return getStartMinimised(store);
  }

  function writeStartMinimised(value) {
    setStartMinimised(store, value);
    syncLoginItemArgs(readStartMinimised);
    updateTrayMenu(buildTrayMenuInstance());
  }

  function buildTrayMenuInstance() {
    return buildTrayMenu({
      appName,
      getStartMinimised: readStartMinimised,
      setStartMinimised: writeStartMinimised,
      onShow: () => {
        const win = getMainWindow();
        if (!win) {
          createWindow(windowOpts());
          return;
        }
        win.show();
      },
      onRefresh: () => refreshPage(),
      onCheckUpdates: () => checkForUpdates(true),
      onQuit: () => {
        isQuittingRef.current = true;
        app.quit();
      }
    });
  }

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on('second-instance', (_event, argv) => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
    handleProtocolUrl(argv.find((a) => a.startsWith(`${protocol}://`)));
  });

  function handleProtocolUrl(url) {
    if (!url || !getMainWindow()) return;
    showMainWindow();
    getMainWindow().focus();
  }

  app.setAsDefaultProtocolClient(protocol);

  app.on('ready', () => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
      if (pkg.build?.appId) app.setAppUserModelId(pkg.build.appId);
    } catch (_) { /* ignore */ }

    startMinimised = readStartMinimised();
    syncLoginItemArgs(readStartMinimised);

    if (!startMinimised) createSplash(splashPath);
    createWindow(windowOpts());

    createTray({
      appName,
      iconPath,
      menu: buildTrayMenuInstance()
    });

    setTrayClickHandler(() => {
      const win = getMainWindow();
      if (!win) {
        createWindow(windowOpts());
        return;
      }
      win.isVisible() ? win.hide() : win.show();
    });

    app.setJumpList([]);

    ({ checkForUpdates } = setupAutoUpdater({
      onUpdateFound: (version) => notifyUpdateFound(appName, iconPath, version),
      onQuitForInstall: () => {
        isQuittingRef.current = true;
      }
    }));

    setupSleepResumeRefresh();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  app.on('window-all-closed', (event) => {
    if (!isQuittingRef.current) event.preventDefault();
  });

  let flushOnQuitStarted = false;
  app.on('before-quit', (event) => {
    isQuittingRef.current = true;
    if (flushOnQuitStarted) return;
    flushOnQuitStarted = true;
    // Electron does not await async before-quit handlers; block quit until cookies flush.
    event.preventDefault();
    const ses = session.fromPartition('persist:icloud');
    Promise.resolve()
      .then(() => saveSharedCookies(ses))
      .then(() => ses.cookies.flushStore())
      .catch(() => {})
      .finally(() => {
        stopWatchingSharedCookies();
        app.exit(0);
      });
  });
}

module.exports = { run };
