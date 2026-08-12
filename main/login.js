const { app } = require('electron');
const { START_MINIMIZED_ARG } = require('./constants');

function hasStartMinimizedArg(argv = process.argv) {
  return argv.some(
    (arg) =>
      arg === '--start-minimized'
      || arg.startsWith('--start-minimized=')
      || arg === '--start-minimised'
      || arg.startsWith('--start-minimised=')
  );
}

/** True when this process was launched with the login-item minimised flag. */
function wasLaunchedMinimised(argv = process.argv) {
  return hasStartMinimizedArg(argv);
}

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

module.exports = {
  hasStartMinimizedArg,
  wasLaunchedMinimised,
  syncLoginItemArgs,
  enableOpenAtLogin
};
