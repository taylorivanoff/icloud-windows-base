const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const { UPDATE_CHECK_INTERVAL_MS } = require('./constants');

function setupAutoUpdater({ onUpdateFound, onQuitForInstall }) {
  let manualUpdateCheck = false;

  async function checkForUpdates(manual = false) {
    if (!app.isPackaged) return;
    manualUpdateCheck = manual;
    try {
      await autoUpdater.checkForUpdates();
    } catch (_) {
      manualUpdateCheck = false;
    }
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    onUpdateFound(info.version);
  });

  autoUpdater.on('update-not-available', () => {
    manualUpdateCheck = false;
  });

  autoUpdater.on('update-downloaded', () => {
    manualUpdateCheck = false;
    onQuitForInstall();
    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on('error', () => {
    manualUpdateCheck = false;
  });

  checkForUpdates(false);
  setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);

  return { checkForUpdates };
}

module.exports = { setupAutoUpdater };
