# Сейв и миграции (05_LegoPuzzle)

## Структура (schemaVersion = 1)

LocalStorage-ключ: `LEGO_save`. Единый JSON:

```json
{
  "schemaVersion": 1,
  "currentLevelId": 1,
  "completedLevels": [],
  "sound": true,
  "vibration": true
}
```

Проект новый — legacy multi-key хранения нет, миграция 1 — identity (просто поднимает schemaVersion).

## Поля

| Поле | Тип | Описание |
|---|---|---|
| `schemaVersion` | int | Текущая версия формата. Растёт только при изменении структуры `data`. Автовычисляется из `max(Object.keys(window.Migrations.migrations))`. |
| `currentLevelId` | int | Последний выбранный игроком уровень. По умолчанию 1. |
| `completedLevels` | int[] | Список id пройденных уровней. |
| `sound` | bool | Включён ли звук. По умолчанию из `GAME_CONFIG.enableSound`. |
| `vibration` | bool | Включена ли вибрация. По умолчанию из `GAME_CONFIG.enableVibration`. |

## Контракт

- [migrations.js](../migrations.js) — реестр миграций. Каждая миграция — чистая функция `(state) => state`.
- [storage.js](../storage.js) при `load()`:
  1. Пытается прочитать single-key `LEGO_save`.
  2. Если его нет — берёт `DEFAULTS()`.
  3. Иначе прогоняет через `window.Migrations.runMigrations()` каскадно с `fromVersion` до `getCurrentSchemaVersion()`.
  4. Мерджит с `DEFAULTS()` чтобы добить недостающие поля (на случай новых полей в апдейте).
  5. Сохраняет результат обратно в `LEGO_save`.

## Как добавить новую миграцию

Когда меняешь структуру сейва (новое поле, переименование, удаление, изменение типа):

1. В [migrations.js](../migrations.js) добавь функцию `N: function (state) { /* v(N-1) → vN */ return state; }`, где N = текущая `getCurrentSchemaVersion()` + 1.
2. Обнови `DEFAULTS()` в [storage.js](../storage.js).
3. Добавь новые геттеры/сеттеры в `Storage.*` если нужно.
4. **После публикации** в РуСтор обнови `.claude/release-state.json` (`lastPublishedSchemaVersion: N`). Делает автоматически skill `prepare-release-candidate`.

## ⚠️ Правила

- **Не меняй уже опубликованную миграцию.** У живых юзеров уже сейвы на этой схеме — изменение сломает им апдейт.
- **Миграции — defensive**: используй `?? defaultValue` для отсутствующих полей. Не падай при «странных» данных.
- **Каскадные** — каждая запускается ровно один раз для каждого юзера, в порядке возрастания версии.

## Проверка перед релизом

Skill `prepare-release-candidate` перед сборкой запускает **полный self-test**: пустой сейв прогоняется через **все** миграции в реестре, проверяется корректность результата. Если что-то падает — сборка релиза не запускается.

## Опубликованный релиз

`.claude/release-state.json` обновляется **автоматически** skill'ом `prepare-release-candidate` после того, как пользователь подтвердил, что отправляет собранный APK в стор. Если не подтвердил — файл не трогается, при следующем RC та же база для сравнения.
