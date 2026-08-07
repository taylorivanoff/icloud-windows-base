const { app } = require('electron');
const { START_MINIMIZED_ARG } = require('./constants');

function syncLoginItemArgs(getStartMinimised) {
  const login = app.getLoginItemSettings();
  if (!login.openAtLogin) return;
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: getStartMinimised() ? [START_MINIMIZED_ARG] : []
  });
}

function enableOpenAtLogin(getStartMinimised) {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: getStartMinimised() ? [START_MINIMIZED_ARG] : []
  });
}

module.exports = { syncLoginItemArgs, enableOpenAtLogin };
