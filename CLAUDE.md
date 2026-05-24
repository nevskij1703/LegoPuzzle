# 05_LegoPuzzle — заметки для Claude Code

Игра «Лего-паззл» — расставь круглые цветные детали по подложкам своего цвета на пиксельной картинке. Веб-проект на vanilla JS, упаковывается в Android APK через Html2Apk Builder для публикации в РуСтор.

## Архитектура

**Classic IIFE** (как 04_True-or-Do). Каждый модуль — самовызывающаяся функция, экспортирует API в `window`. Никаких ES-modules / type="module" / build-step.

### Граф модулей (порядок в [index.html](index.html))

```
1. config.js     → window.GAME_CONFIG (палитра, INVENTORY_SLOTS)
2. migrations.js → window.Migrations (реестр миграций сейва)
3. storage.js    → window.Storage (single-key 'LEGO_save')   [DEPS: migrations, config]
4. levels.js     → window.LEVELS (массив уровней + .byId helper)
5. audio.js      → window.AudioFX (WebAudio синтез)          [DEPS: storage]
6. game.js       → window.Game (state, flood-fill, переносы) [DEPS: config, levels, audio, storage]
7. ui.js         → window.UI (рендер DOM, делегирование кликов) [DEPS: game]
8. main.js       → bootstrap (DOMContentLoaded → Storage.load → UI.init + dev panel)
```

## Игровая механика

- **Сетка**: NxN клеток. Каждая = `{bg, part}`. `bg` — цвет подложки (или null = клетка вне арта). `part` — цвет круглой детали (или null = пустое место).
- **Инвентарь**: 12 слотов внизу для временного хранения деталей.
- **Выбор группы**: клик по детали → flood-fill **по 8-связности** (включая диагонали) собирает всех соседей того же цвета. Клик по детали в инвентаре → выделяются **все** того же цвета в инвентаре.
- **Перенос**: клик по пустой подложке своего цвета → flood-fill **пустых подложек** этого цвета считает вместимость → переносим `min(selSize, capacity)` штук. Остаток остаётся в selection.
- **Победа**: все `grid[r][c].part === grid[r][c].bg` И инвентарь пуст.

См. [план](../../../.claude/plans/melodic-painting-hoare.md) и подробный API в [game.js](game.js).

## Как запустить локально

Два варианта:

### A. `file://` (быстро)
Открыть [index.html](index.html) двойным кликом в любом браузере. IIFE-архитектура не требует HTTP-сервер.

### B. Preview-сервер (с авто-обновлением и dev-режимом)
```powershell
python -m http.server 8774
```
Открыть `http://localhost:8774/`. Для dev-панели — `http://localhost:8774/?dev=1`.

Конфиг сервера — [.claude/launch.json](.claude/launch.json).

## Dev-инструменты

Чит-панель и дев-функции обёрнуты в маркеры `HTML2APK:DEV_ONLY` (вырезаются html2apk при `-Release`) И в проверку `window.__BUILD_RELEASE__` (инжектится html2apk в `<head>` финального HTML).

Открыть dev-панель: `?dev=1` в URL. Кнопки:
- **🔧 Решить уровень** — `Game._devSolve()` авто-расставит детали.
- **🗑 Сброс сейва** — `Storage.resetAll()` + reload.
- **▶ Уровень 1** — стартануть первый уровень напрямую, минуя главную.

В release-сборке всё это удалено + `window.__BUILD_RELEASE__=true` гарантирует что даже если что-то случайно осталось — оно не выполнится.

## Сейв

См. [docs/SAVES.md](docs/SAVES.md). Single-key `LEGO_save`. schemaVersion=1 (identity-миграция). При расширении сейва — добавляй новую миграцию, не меняй существующие.

## Сборка APK

### Debug (для отладки на устройстве)
Skill `build-apk-from-html`. Сохраняет dev-режим и маркеры. Без подписи (или с debug-keystore html2apk).

### Release (для РуСтор)
Skill `prepare-release-candidate`. Шаги:
1. Self-test миграций — все пройдут от пустого сейва до текущей schema.
2. Показ значений `.claude/build-config.json` → подтверждение от пользователя.
3. `html2apk -Release ...` с подписью из `Store_Info/keystore/release.jks`.
4. После сборки — вопрос «отправляешь в стор?». Если да — `.claude/release-state.json` обновляется.

## Что НЕ подключено (отложено)

- **Реклама** (Yandex Mobile Ads). Когда будем подключать — skill `connect-yandex-mobile-ads`. После этого обновить `Store_Info/PRIVACY_POLICY.md` (раздел «Какие данные собирают встроенные сервисы») и перегенерировать `PRIVACY_POLICY.pdf`.
- **RuStore In-App Review SDK**. Skill `connect-rustore-review`. Меняет deep-link «оценить» на нативный диалог.
- **Несколько уровней**. Сейчас только 1 (смайлик 8×8). По мере отладки добавляем средние 20×20 и сложные 40×40.

## Полезное

- **Поле "appId"**: `com.terekh.legopuzzle` ([.claude/build-config.json](.claude/build-config.json)).
- **Версия cache-busting** в HTML: `?v=N` у скриптов. Поднимать при изменении исходников, чтобы WebView не отдавал старый кеш.
- **Глобальные правила** Александра: [~/.claude/CLAUDE.md](~/.claude/CLAUDE.md) — стандарты по dev-обёрткам, миграциям сейвов, структуре проекта.
