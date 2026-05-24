/**
 * storage.js — обёртка над localStorage с системой миграций сейва.
 * См. docs/SAVES.md (контракт) и migrations.js (реестр миграций).
 *
 * Single-key: всё хранится в одном localStorage entry `LEGO_save`.
 * Это новый проект — legacy multi-key хранения нет.
 */
window.Storage = (function () {
  const STORAGE_KEY = 'LEGO_save';

  function DEFAULTS() {
    return {
      schemaVersion: window.Migrations.getCurrentSchemaVersion(),
      currentLevelId: 1,
      completedLevels: [],
      sound: window.GAME_CONFIG.enableSound,
      vibration: window.GAME_CONFIG.enableVibration,
    };
  }

  let cached = null;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch (e) {
      console.warn('[storage] save failed', e);
    }
  }

  function load() {
    if (cached) return cached;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        cached = DEFAULTS();
        persist();
        return cached;
      }

      const parsed = JSON.parse(raw);
      const fromVersion = (typeof parsed.schemaVersion === 'number') ? parsed.schemaVersion : 0;
      const target = window.Migrations.getCurrentSchemaVersion();

      if (fromVersion > target) {
        // Юзер откатил приложение — сейв новее кода. Делаем backup и сбрасываем.
        console.warn('[storage] save schemaVersion=' + fromVersion + ' > code=' + target + ', resetting');
        try { localStorage.setItem(STORAGE_KEY + '_backup_future_v' + fromVersion, raw); } catch (e) {}
        cached = DEFAULTS();
        persist();
        return cached;
      }

      let state = parsed;
      if (fromVersion < target) {
        const result = window.Migrations.runMigrations(parsed, fromVersion);
        state = result.state;
        state.schemaVersion = result.schemaVersion;
      }

      // Мердж с DEFAULTS — на случай новых полей которых нет в старом сейве.
      cached = Object.assign({}, DEFAULTS(), state, { schemaVersion: target });
      persist();
      return cached;
    } catch (e) {
      console.warn('[storage] load failed, using defaults', e);
      cached = DEFAULTS();
      return cached;
    }
  }

  // === Низкоуровневое API ===
  function get(key, fallback) {
    const state = load();
    if (key in state) return state[key];
    return (fallback !== undefined) ? fallback : undefined;
  }

  function set(key, value) {
    load();
    cached[key] = value;
    persist();
  }

  // === Прогресс по уровням ===
  function getCurrentLevelId() { return load().currentLevelId || 1; }
  function setCurrentLevelId(id) { set('currentLevelId', id | 0); }

  function getCompletedLevels() {
    const arr = load().completedLevels;
    return Array.isArray(arr) ? arr : [];
  }
  function addCompletedLevel(id) {
    const state = load();
    if (!Array.isArray(state.completedLevels)) state.completedLevels = [];
    if (!state.completedLevels.includes(id)) state.completedLevels.push(id);
    persist();
  }

  // === Настройки ===
  function getSound()      { return !!load().sound; }
  function setSound(v)     { set('sound', !!v); }
  function getVibration()  { return !!load().vibration; }
  function setVibration(v) { set('vibration', !!v); }

  // === Полный сброс ===
  function resetAll() {
    cached = DEFAULTS();
    persist();
  }

  return {
    get: get, set: set,
    getCurrentLevelId: getCurrentLevelId, setCurrentLevelId: setCurrentLevelId,
    getCompletedLevels: getCompletedLevels, addCompletedLevel: addCompletedLevel,
    getSound: getSound, setSound: setSound,
    getVibration: getVibration, setVibration: setVibration,
    resetAll: resetAll,
  };
})();
