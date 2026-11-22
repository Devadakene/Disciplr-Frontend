/* eslint-disable @typescript-eslint/no-unused-vars */
(function () {
  try {
    var stored = null;
    try {
      stored = localStorage.getItem('disciplr-theme');
    } catch (_unused) {
      stored = null;
    }
    var theme = stored;
    if (theme !== 'light' && theme !== 'dark') {
      var isDark = false;
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        try {
          isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (_unusedMedia) {
          isDark = false;
        }
      }
      theme = isDark ? 'dark' : 'light';
    }
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  } catch (_unusedRoot) {
    // Fail safe
  }
})();
