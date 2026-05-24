/**
 * main.js — bootstrap игры.
 *
 * Порядок:
 *   1. Поднять Storage (триггерит миграции если нужно)
 *   2. UI.init() — закешировать DOM, повесить базовые обработчики, показать home
 *   3. Если `?dev=1` — поднять dev-панель (вырезается в release)
 */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    // Триггер первой загрузки сейва (миграции, дефолты)
    window.Storage.getCurrentLevelId();

    // UI
    window.UI.init();

    /* HTML2APK:DEV_ONLY */
    initDevPanel();
    /* /HTML2APK:DEV_ONLY */
  });

  /* HTML2APK:DEV_ONLY */
  function initDevPanel() {
    // Видна только при ?dev=1; в release-сборке этот блок целиком вырезается.
    if (window.__BUILD_RELEASE__) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') !== '1') return;

    const panel = document.createElement('div');
    panel.id = 'dev-panel';

    const solveBtn = document.createElement('button');
    solveBtn.textContent = '🔧 Решить уровень';
    solveBtn.addEventListener('click', () => {
      window.Game._devSolve();
      window.UI.render();
    });

    const resetSaveBtn = document.createElement('button');
    resetSaveBtn.textContent = '🗑 Сброс сейва';
    resetSaveBtn.addEventListener('click', () => {
      window.Storage.resetAll();
      window.location.reload();
    });

    // Быстрый запуск каждого уровня.
    (window.LEVELS || []).forEach(level => {
      const b = document.createElement('button');
      b.textContent = '▶ Уровень ' + level.id + ': ' + level.name;
      b.addEventListener('click', () => window.UI.startLevelInUI(level.id));
      panel.appendChild(b);
    });

    panel.appendChild(solveBtn);
    panel.appendChild(resetSaveBtn);
    document.body.appendChild(panel);
  }
  /* /HTML2APK:DEV_ONLY */
})();
