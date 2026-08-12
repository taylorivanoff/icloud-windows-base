const { app, session, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { applyCommonSettings, readCommonSettings, getMainWindow } = require('electron-tray-base');
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
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
    return pkg.build?.appId;
  } catch (_) {
    return undefined;
  }
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
 * }} config
 */
function run(config) {
  const { appName, protocol, icloudUrl, splashPath, iconPath, removeToolbar = false } = config;
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
    const ses = session.fromPartition('persist:icloud');
    await savePersistedCookies(ses);
    await ses.cookies.flushStore();
  }

  trayBase.run({
    appName,
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
      webPreferences: { partition: 'persist:icloud' }
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
        if (process.platform === 'win32') {
          const appId = readAppId();
          if (appId) app.setAppUserModelId(appId);
        }
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
