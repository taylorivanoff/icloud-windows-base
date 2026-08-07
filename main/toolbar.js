/** Remove iCloud's in-page toolbar (DOM only — no layout/panel heuristics). */
async function removeIcloudToolbar(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  try {
    await webContents.executeJavaScript(`(() => {
      const SELECTORS = [
        '.cloudos-toolbar-view',
        'header.cloudos-toolbar.app',
        'header.cloudos-toolbar'
      ];

      function removeToolbar(root = document) {
        for (const selector of SELECTORS) {
          root.querySelectorAll?.(selector)?.forEach((el) => el.remove());
        }
        for (const frame of root.querySelectorAll?.('iframe') || []) {
          try {
            const doc = frame.contentDocument;
            if (doc) removeToolbar(doc);
          } catch (_) { /* cross-origin */ }
        }
      }

      removeToolbar();
      if (!window.__icloudBaseToolbarObserver) {
        let scheduled = false;
        window.__icloudBaseToolbarObserver = new MutationObserver(() => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            removeToolbar();
          });
        });
        window.__icloudBaseToolbarObserver.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }
    })();`);
  } catch (_) { /* ignore */ }
}

module.exports = { removeIcloudToolbar };
