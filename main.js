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

    const startBtn = document.createElement('button');
    startBtn.textContent = '▶ Уровень 1';
    startBtn.addEventListener('click', () => {
      window.Game.startLevel(1);
      window.UI.buildGridDOM();
      window.UI.buildInventoryDOM();
      window.UI.render();
      window.UI.showScreen('screen-game');
    });

    panel.appendChild(solveBtn);
    panel.appendChild(resetSaveBtn);
    panel.appendChild(startBtn);
    document.body.appendChild(panel);
  }
  /* /HTML2APK:DEV_ONLY */
})();
