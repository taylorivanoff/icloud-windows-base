const { app, Tray, Menu, nativeImage, Notification } = require('electron');

let tray = null;

function notifyUpdateFound(appName, iconPath, version) {
  if (!Notification.isSupported()) return;
  new Notification({
    title: appName,
    body: `Update ${version} found. The app will update and restart.`,
    icon: iconPath
  }).show();
}

function buildTrayMenu({ appName, getStartMinimised, setStartMinimised, onShow, onRefresh, onCheckUpdates, onQuit }) {
  return Menu.buildFromTemplate([
    { label: `Show ${appName}`, click: onShow },
    { label: 'Refresh', click: onRefresh },
    { type: 'separator' },
    {
      label: 'Start minimised',
      type: 'checkbox',
      checked: getStartMinimised(),
      click: (item) => setStartMinimised(item.checked)
    },
    { type: 'separator' },
    { label: 'Check for Updates', click: onCheckUpdates },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { label: 'Quit', click: onQuit }
  ]);
}

function createTray({ appName, iconPath, menu }) {
  if (tray) return tray;
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip(appName);
  tray.setContextMenu(menu);
  return tray;
}

function updateTrayMenu(menu) {
  if (tray) tray.setContextMenu(menu);
}

function setTrayClickHandler(onClick) {
  if (tray) tray.on('click', onClick);
}

module.exports = {
  notifyUpdateFound,
  buildTrayMenu,
  createTray,
  updateTrayMenu,
  setTrayClickHandler
};
