const { app, session, powerMonitor } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { savePersistedCookies, stopCookiePersistence } = require('./cookies');
const { setupIcloudWebview } = require('./icloud-webview');

function loadElectronTrayBase() {
  if (!app.isPackaged) {
    const localBase = path.join(__dirname, '..', '..', '..', 'electron-tray-base');
    try {
      const resolved = require.resolve(localBase);
      delete require.cache[resolved];
      return require(localBase);
    } catch (_) {
      // Fall through to installed package.
    }
  }
  return require('electron-tray-base');
}

const trayBase = loadElectronTrayBase();
const {
  applyCommonSettings,
  readCommonSettings,
  getMainWindow,
  configureAppIsolation,
  sessionPartition,
  readAppIdFromPackage
} = trayBase;

function createIcloudStore() {
  return new Store({
    defaults: {
      startMinimised: true,
      alwaysOnTop: false,
      opacity: 1,
      windowBounds: null
    }
  });
}

function readAppId() {
  return readAppIdFromPackage(app.getAppPath());
}

function refreshPage() {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
}

/**
 * Run the iCloud Electron app with the given config.
 * @param {{
 *   appName: string;
 *   protocol: string;
 *   icloudUrl: string;
 *   splashPath: string;
 *   iconPath: string;
 *   removeToolbar?: boolean;
 *   appId?: string;
 * }} config
 */
function run(config) {
  const { appName, protocol, icloudUrl, splashPath, iconPath, removeToolbar = false } = config;
  const appId = config.appId || readAppId();
  configureAppIsolation({ appId, appName });
  const partition = sessionPartition(appId);
  const store = createIcloudStore();

  function readSettings() {
    return {
      ...readCommonSettings(store),
      startMinimised: !!store.get('startMinimised', true)
    };
  }

  function writeSettings(partial = {}) {
    applyCommonSettings(store, partial);
    return readSettings();
  }

  async function flushPersistedCookies() {
    const ses = session.fromPartition(partition);
    await savePersistedCookies(ses);
    await ses.cookies.flushStore();
  }

  trayBase.run({
    appName,
    appId,
    protocol,
    iconPath,
    splashPath,
    store: { instance: store },
    dev: { reloader: false },
    loginItem: { syncOnReady: true },
    updater: { silent: true },
    window: {
      loadURL: icloudUrl,
      defaultBounds: { width: 1280, height: 800 },
      webPreferences: { partition }
    },
    tray: {
      onClick: 'toggle',
      showHide: false,
      showAlwaysOnTop: false,
      extraSections: () => [[{ label: 'Refresh', click: refreshPage }]]
    },
    sleep: {
      onResume: (win) => {
        if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
      }
    },
    hooks: {
      getSettings: readSettings,
      setSettings: writeSettings,
      onWindowCreated: async (win, ctx) => {
        await setupIcloudWebview(win, {
          icloudUrl,
          removeToolbar,
          enableOpenAtLogin: ctx.enableOpenAtLogin
        });
      },
      onReady: () => {
        app.setJumpList([]);
        powerMonitor.on('shutdown', () => {
          flushPersistedCookies().catch(() => {});
        });
      },
      onBeforeQuit: async () => {
        await flushPersistedCookies();
        stopCookiePersistence();
      }
    }
  });
}

module.exports = { run };
