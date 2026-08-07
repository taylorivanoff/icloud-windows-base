const Store = require('electron-store');
const { screen } = require('electron');

function createStore() {
  return new Store();
}

function getStartMinimised(store) {
  return store.get('startMinimised', true);
}

function setStartMinimised(store, value) {
  store.set('startMinimised', value);
}

function getWindowBounds(store) {
  const saved = store.get('windowBounds');
  const defaults = { width: 1280, height: 800 };
  if (!saved) return defaults;
  const displays = screen.getAllDisplays();
  const inBounds = displays.some((d) => {
    const { x, y, width, height } = d.bounds;
    return saved.x >= x && saved.x < x + width && saved.y >= y && saved.y < y + height;
  });
  return inBounds ? saved : defaults;
}

function saveWindowBounds(store, mainWindow) {
  if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

module.exports = {
  createStore,
  getStartMinimised,
  setStartMinimised,
  getWindowBounds,
  saveWindowBounds
};
