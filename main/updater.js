const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const { UPDATE_CHECK_INTERVAL_MS } = require('./constants');

function setupAutoUpdater({ onQuitForInstall }) {
  async function checkForUpdates() {
    if (!app.isPackaged) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch (_) {
      /* ignore */
    }
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Silent: download in background, then restart with no toast.
  autoUpdater.on('update-downloaded', () => {
    onQuitForInstall();
    autoUpdater.quitAndInstall(true, true);
  });

  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

  return { checkForUpdates };
}

module.exports = { setupAutoUpdater };
