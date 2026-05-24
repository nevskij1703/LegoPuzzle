/**
 * game.js — состояние и логика уровня.
 *
 * Чисто-доменная часть: знает про сетку, инвентарь, выделение и flood-fill.
 * Не трогает DOM — рендер делает ui.js. После любого изменения вызывает
 * window.UI.render() и сохраняет прогресс через window.Storage (если нужно).
 *
 * state = {
 *   levelId, rows, cols,
 *   grid: [[{bg, part}, ...]],
 *   inventory: [color|null × N],
 *   selection: null | {color, source:'grid'|'inventory', cells?, slots?},
 *   initialParts: [[color|null, ...]],   // снимок для resetLevel
 *   complete: bool
 * }
 */
window.Game = (function () {
  const NEIGH8 = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1],
  ];

  const state = {
    levelId: null,
    rows: 0,
    cols: 0,
    grid: [],
    inventory: [],
    selection: null,
    initialParts: [],
    complete: false,
    // Эффективная палитра уровня: { код: hex }.
    // Заполняется в startLevel() как merge(GAME_CONFIG.COLORS, level.colors).
    colors: {},
    // Набор кодов с hex='transparent' — bg=этим кодам преобразуется в null.
    transparentCodes: new Set(),
  };

  // Вернуть hex по коду цвета (с fallback на глобальную палитру).
  function colorHex(code) {
    if (code === null || code === undefined) return null;
    if (state.colors && code in state.colors) return state.colors[code];
    return (window.GAME_CONFIG.COLORS && window.GAME_CONFIG.COLORS[code]) || null;
  }

  // ===== Утилиты =====

  // Деталь "залочена" если стоит на своём цвете — её нельзя поднимать
  // и она не входит в flood-fill группу (выступает как стена).
  function isLocked(cell) {
    return cell.part !== null && cell.part === cell.bg;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  function snapshotParts(grid) {
    return grid.map(row => row.map(cell => cell.part));
  }

  function applyParts(grid, parts) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        grid[r][c].part = parts[r][c];
      }
    }
  }

  // ===== Flood-fill (8-связность) =====

  function floodFillParts(grid, r0, c0, color) {
    const rows = grid.length, cols = grid[0].length;
    if (grid[r0][c0].part !== color || isLocked(grid[r0][c0])) return [];
    const visited = [];
    for (let r = 0; r < rows; r++) visited.push(new Array(cols).fill(false));
    const queue = [{ r: r0, c: c0 }];
    visited[r0][c0] = true;
    const result = [];
    while (queue.length) {
      const node = queue.shift();
      result.push(node);
      for (let i = 0; i < NEIGH8.length; i++) {
        const nr = node.r + NEIGH8[i][0];
        const nc = node.c + NEIGH8[i][1];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (visited[nr][nc]) continue;
        if (grid[nr][nc].part !== color) continue;
        if (isLocked(grid[nr][nc])) continue;
        visited[nr][nc] = true;
        queue.push({ r: nr, c: nc });
      }
    }
    return result;
  }

  function floodFillEmptyBg(grid, r0, c0, color) {
    const rows = grid.length, cols = grid[0].length;
    if (grid[r0][c0].bg !== color || grid[r0][c0].part !== null) return [];
    const visited = [];
    for (let r = 0; r < rows; r++) visited.push(new Array(cols).fill(false));
    const queue = [{ r: r0, c: c0 }];
    visited[r0][c0] = true;
    const result = [];
    while (queue.length) {
      const node = queue.shift();
      result.push(node);
      for (let i = 0; i < NEIGH8.length; i++) {
        const nr = node.r + NEIGH8[i][0];
        const nc = node.c + NEIGH8[i][1];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (visited[nr][nc]) continue;
        if (grid[nr][nc].bg !== color || grid[nr][nc].part !== null) continue;
        visited[nr][nc] = true;
        queue.push({ r: nr, c: nc });
      }
    }
    return result;
  }

  // ===== Генерация начальной раскладки =====

  function buildInitialGrid(level, transparentCodes) {
    const grid = [];
    const colors = [];
    for (let r = 0; r < level.rows; r++) {
      const row = [];
      for (let c = 0; c < level.cols; c++) {
        let bg = (level.bg[r] && level.bg[r][c]) || null;
        // Прозрачные коды (hex=transparent) трактуем как «вне арта».
        if (bg !== null && transparentCodes && transparentCodes.has(bg)) bg = null;
        row.push({ bg: bg, part: null });
        if (bg !== null) colors.push(bg);
      }
      grid.push(row);
    }

    // Перемешиваем мульти-набор и проверяем что не победный.
    let attempts = 0;
    let isWinning;
    do {
      shuffle(colors);
      isWinning = true;
      let idx = 0;
      for (let r = 0; r < level.rows && isWinning; r++) {
        for (let c = 0; c < level.cols && isWinning; c++) {
          if (grid[r][c].bg !== null) {
            if (colors[idx] !== grid[r][c].bg) isWinning = false;
            idx++;
          }
        }
      }
      attempts++;
    } while (isWinning && attempts < 50);

    let idx = 0;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (grid[r][c].bg !== null) {
          grid[r][c].part = colors[idx++];
        }
      }
    }
    return grid;
  }

  // ===== Селекторы / геттеры =====

  function inventorySize() {
    return window.GAME_CONFIG.INVENTORY_SLOTS;
  }

  function selectionSize() {
    const sel = state.selection;
    if (!sel) return 0;
    return sel.source === 'grid' ? sel.cells.length : sel.slots.length;
  }

  function isComplete() {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (state.grid[r][c].part !== state.grid[r][c].bg) return false;
      }
    }
    for (let i = 0; i < state.inventory.length; i++) {
      if (state.inventory[i] !== null) return false;
    }
    return true;
  }

  // Проверка что (r,c) находится в selection.cells (только для source='grid')
  function selectionContainsCell(r, c) {
    const sel = state.selection;
    if (!sel || sel.source !== 'grid') return false;
    for (let i = 0; i < sel.cells.length; i++) {
      if (sel.cells[i].r === r && sel.cells[i].c === c) return true;
    }
    return false;
  }

  // Set из selection.cells для быстрого lookup в ui.js
  function selectedCellSet() {
    const sel = state.selection;
    const set = new Set();
    if (sel && sel.source === 'grid') {
      for (let i = 0; i < sel.cells.length; i++) {
        set.add(sel.cells[i].r + ',' + sel.cells[i].c);
      }
    }
    return set;
  }

  function selectedSlotSet() {
    const sel = state.selection;
    const set = new Set();
    if (sel && sel.source === 'inventory') {
      for (let i = 0; i < sel.slots.length; i++) set.add(sel.slots[i]);
    }
    return set;
  }

  // ===== Жизненный цикл уровня =====

  function startLevel(levelId) {
    const level = window.LEVELS.byId(levelId);
    if (!level) {
      console.warn('[game] Unknown level id=' + levelId);
      return false;
    }
    state.levelId = level.id;
    state.rows = level.rows;
    state.cols = level.cols;

    // Эффективная палитра: дефолты GAME_CONFIG.COLORS + override из level.colors.
    state.colors = Object.assign({}, window.GAME_CONFIG.COLORS, level.colors || {});
    // Какие коды считаются «вне арта» (transparent / null / пусто).
    state.transparentCodes = new Set();
    for (const code in state.colors) {
      const hex = state.colors[code];
      if (hex === 'transparent' || hex === null || hex === '') {
        state.transparentCodes.add(code);
      }
    }

    state.grid = buildInitialGrid(level, state.transparentCodes);
    state.inventory = new Array(inventorySize()).fill(null);
    state.selection = null;
    state.initialParts = snapshotParts(state.grid);
    state.complete = false;

    window.Storage.setCurrentLevelId(level.id);
    return true;
  }

  function resetLevel() {
    if (!state.initialParts.length) return;
    applyParts(state.grid, state.initialParts);
    state.inventory.fill(null);
    state.selection = null;
    state.complete = false;
  }

  function init() {
    const id = window.Storage.getCurrentLevelId() || 1;
    if (!window.LEVELS.byId(id)) {
      startLevel(1);
    } else {
      startLevel(id);
    }
  }

  // ===== Действия игрока =====

  function clearSelection() {
    if (!state.selection) return false;
    state.selection = null;
    return true;
  }

  function selectGridGroup(r, c) {
    const color = state.grid[r][c].part;
    if (color === null) return false;
    const cells = floodFillParts(state.grid, r, c, color);
    state.selection = { color: color, source: 'grid', cells: cells };
    return true;
  }

  function selectInventoryGroup(i) {
    const color = state.inventory[i];
    if (color === null) return false;
    const slots = [];
    for (let j = 0; j < state.inventory.length; j++) {
      if (state.inventory[j] === color) slots.push(j);
    }
    state.selection = { color: color, source: 'inventory', slots: slots };
    return true;
  }

  /**
   * Переносит до n деталей из source-источника selection в target-приёмник.
   * Возвращает количество фактически перенесённых.
   *
   * @param applyTarget — функция(color, k) которая на k-м шаге размещает деталь.
   *                     Возвращает true если ок, false если нет места (тогда стоп).
   */
  function transferFromSelection(applyTarget, maxN) {
    const sel = state.selection;
    let n = 0;
    while (n < maxN) {
      const sizeLeft = sel.source === 'grid' ? sel.cells.length : sel.slots.length;
      if (sizeLeft === 0) break;
      // Снимаем первую деталь
      if (sel.source === 'grid') {
        const cell = sel.cells.shift();
        state.grid[cell.r][cell.c].part = null;
      } else {
        const idx = sel.slots.shift();
        state.inventory[idx] = null;
      }
      const ok = applyTarget(sel.color, n);
      if (!ok) {
        // Откат: положили обратно? Сложно, поэтому просто прерываем и
        // помечаем; в текущей логике applyTarget вызывается с заранее
        // известным числом мест, поэтому отказа быть не должно.
        break;
      }
      n++;
    }
    return n;
  }

  function pickAtCell(r, c) {
    if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return false;
    const cell = state.grid[r][c];
    const sel = state.selection;

    // Клетка вне арта — клик игнорируется.
    if (cell.bg === null) {
      return false;
    }

    // Ничего не выбрано — выбираем группу.
    if (!sel) {
      if (cell.part !== null && !isLocked(cell)) {
        if (selectGridGroup(r, c)) {
          window.AudioFX.select();
          return true;
        }
      }
      // Клик по правильно стоящей детали или по пустой клетке — игнор.
      return false;
    }

    // Selection активна:

    // (а) Клик по своей же выделенной клетке — снять выделение.
    if (sel.source === 'grid' && selectionContainsCell(r, c)) {
      clearSelection();
      window.AudioFX.cancel();
      return true;
    }

    // (б) Клик по пустой подложке нужного цвета — попытка перенести.
    if (cell.part === null && cell.bg === sel.color) {
      const targets = floodFillEmptyBg(state.grid, r, c, sel.color);
      if (targets.length === 0) return false;
      const selSize = selectionSize();
      const n = Math.min(selSize, targets.length);
      let placed = 0;
      transferFromSelection(function (color, k) {
        const t = targets[k];
        state.grid[t.r][t.c].part = color;
        placed = k + 1;
        return true;
      }, n);
      if (placed > 0) {
        if (selectionSize() === 0) clearSelection();
        if (isComplete()) {
          state.complete = true;
          window.Storage.addCompletedLevel(state.levelId);
          window.AudioFX.win();
        } else {
          window.AudioFX.place();
        }
        return true;
      }
      return false;
    }

    // (в) Клик по детали (не нашей группы) — переключение selection.
    // Залоченные (стоящие на своём цвете) не выбираются.
    if (cell.part !== null && !isLocked(cell)) {
      clearSelection();
      if (selectGridGroup(r, c)) {
        window.AudioFX.select();
        return true;
      }
    }

    // (г) Клик по пустой подложке другого цвета — игнор + лёгкая ошибка.
    if (cell.part === null && cell.bg !== sel.color) {
      window.AudioFX.error();
      return false;
    }

    return false;
  }

  function pickAtSlot(i) {
    if (i < 0 || i >= state.inventory.length) return false;
    const item = state.inventory[i];
    const sel = state.selection;

    // Ничего не выбрано — выбираем группу по цвету этого слота.
    if (!sel) {
      if (item !== null) {
        if (selectInventoryGroup(i)) {
          window.AudioFX.select();
          return true;
        }
      }
      return false;
    }

    // Selection активна:

    // (а) Клик по своему же выделенному слоту — снять выделение.
    if (sel.source === 'inventory' && sel.slots.indexOf(i) !== -1) {
      clearSelection();
      window.AudioFX.cancel();
      return true;
    }

    // (б) Клик по пустому слоту — переносим в инвентарь.
    if (item === null) {
      // Собираем пустые слоты начиная с i, обходя массив по кругу.
      const empties = [];
      const N = state.inventory.length;
      for (let k = 0; k < N; k++) {
        const idx = (i + k) % N;
        if (state.inventory[idx] === null) empties.push(idx);
      }
      if (empties.length === 0) return false;
      const n = Math.min(selectionSize(), empties.length);
      let placed = 0;
      transferFromSelection(function (color, k) {
        state.inventory[empties[k]] = color;
        placed = k + 1;
        return true;
      }, n);
      if (placed > 0) {
        if (selectionSize() === 0) clearSelection();
        // Размещение в инвентарь не может дать победу (победа = пустой инвентарь).
        window.AudioFX.place();
        return true;
      }
      return false;
    }

    // (в) Клик по непустому слоту чужого цвета (или другой группе) — переключение.
    if (item !== null) {
      clearSelection();
      if (selectInventoryGroup(i)) {
        window.AudioFX.select();
        return true;
      }
    }

    return false;
  }

  // ===== Dev =====

  function devSolve() {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        state.grid[r][c].part = state.grid[r][c].bg;
      }
    }
    for (let i = 0; i < state.inventory.length; i++) state.inventory[i] = null;
    state.selection = null;
    if (isComplete()) {
      state.complete = true;
      window.Storage.addCompletedLevel(state.levelId);
    }
  }

  return {
    state: state,
    init: init,
    startLevel: startLevel,
    resetLevel: resetLevel,
    pickAtCell: pickAtCell,
    pickAtSlot: pickAtSlot,
    clearSelection: clearSelection,
    isComplete: isComplete,
    selectionSize: selectionSize,
    selectedCellSet: selectedCellSet,
    selectedSlotSet: selectedSlotSet,
    inventorySize: inventorySize,
    isLocked: isLocked,
    colorHex: colorHex,
    // dev:
    _devSolve: devSolve,
  };
})();
