/**
 * migrations.js — реестр миграций сейва. См. docs/SAVES.md.
 *
 * Контракт:
 *   migrations[N]: state v(N-1) → state vN  (чистая функция)
 *   getCurrentSchemaVersion() — авто-вывод из max(keys)
 *   runMigrations(state, fromVersion) — каскад
 *
 * ⚠️ После публикации НЕ меняй существующие миграции — у живых юзеров уже
 * сейвы на этой схеме, поменяешь — сломаешь им апдейт. Добавляй новые
 * миграции под следующим номером.
 */
window.Migrations = (function () {
  const migrations = {
    // v0 → v1: identity. Новый проект, легаси-полей нет. Дефолты добавит
    // storage.js через Object.assign(DEFAULTS(), state). Эта миграция нужна
    // чтобы пустой/частичный объект корректно поднять до schemaVersion=1.
    1: function (state) {
      return state;
    },
  };

  function getCurrentSchemaVersion() {
    const keys = Object.keys(migrations).map(Number);
    return keys.length ? Math.max.apply(null, keys) : 1;
  }

  function runMigrations(state, fromVersion) {
    const current = getCurrentSchemaVersion();
    let v = (typeof fromVersion === 'number') ? fromVersion : 0;
    while (v < current) {
      const fn = migrations[v + 1];
      if (typeof fn !== 'function') {
        throw new Error('[migrations] Missing migration ' + (v + 1) + ' (target schemaVersion=' + current + ')');
      }
      state = fn(state);
      v++;
    }
    return { state: state, schemaVersion: current };
  }

  return {
    migrations: migrations,
    getCurrentSchemaVersion: getCurrentSchemaVersion,
    runMigrations: runMigrations,
  };
})();
