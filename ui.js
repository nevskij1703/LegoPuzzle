/**
 * ui.js — рендер DOM и обработчики кликов.
 *
 * Получает игровое состояние из window.Game и отрисовывает его в #puzzle-grid
 * и #inventory. Делегирует пользовательские клики обратно в Game.pickAt*.
 */
window.UI = (function () {
  const el = {};

  // Perceived luminance > 160 → светлый цвет (нужна тёмная контрастная галочка).
  function isLightHex(hex) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return false;
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
  }

  function cacheDom() {
    el.screenHome  = document.getElementById('screen-home');
    el.screenGame  = document.getElementById('screen-game');
    el.levelsList  = document.getElementById('levels-list');
    el.btnBack     = document.getElementById('btn-back');
    el.btnReset    = document.getElementById('btn-reset');
    el.levelTitle  = document.getElementById('level-title');
    el.selectionInfo = document.getElementById('selection-info');
    el.puzzleGrid  = document.getElementById('puzzle-grid');
    el.inventory   = document.getElementById('inventory');
    el.winOverlay  = document.getElementById('win-overlay');
    el.btnWinNext  = document.getElementById('btn-win-next');
  }

  function startLevelInUI(id) {
    window.Game.startLevel(id);
    buildGridDOM();
    buildInventoryDOM();
    render();
    showScreen('screen-game');
  }

  function renderLevelsList() {
    if (!el.levelsList) return;
    el.levelsList.innerHTML = '';
    const completed = window.Storage.getCompletedLevels();
    const frag = document.createDocumentFragment();
    window.LEVELS.forEach(level => {
      const card = document.createElement('button');
      card.className = 'level-card';
      card.dataset.id = level.id;
      const done = completed.includes(level.id) ? ' • ✓ пройден' : '';
      card.innerHTML =
        '<div class="level-num">' + level.id + '</div>' +
        '<div class="level-name">' + level.name + '</div>' +
        '<div class="level-meta">' + level.rows + '×' + level.cols + ' • ' + level.difficulty + done + '</div>';
      card.addEventListener('click', () => startLevelInUI(level.id));
      frag.appendChild(card);
    });
    el.levelsList.appendChild(frag);
  }

  // ===== Экраны =====
  function showScreen(id) {
    [el.screenHome, el.screenGame].forEach(s => {
      if (!s) return;
      s.classList.toggle('active', s.id === id);
    });
  }

  function showWinOverlay() {
    if (el.winOverlay) el.winOverlay.classList.add('active');
  }
  function hideWinOverlay() {
    if (el.winOverlay) el.winOverlay.classList.remove('active');
  }

  // ===== Построение DOM сетки =====
  function buildGridDOM() {
    const state = window.Game.state;
    el.puzzleGrid.style.setProperty('--cols', state.cols);
    el.puzzleGrid.style.setProperty('--rows', state.rows);
    // Для больших сеток ужимаем gap и inset детали — иначе круги слишком мелкие.
    const maxSide = Math.max(state.rows, state.cols);
    el.puzzleGrid.classList.toggle('grid-large', maxSide >= 15);
    el.puzzleGrid.classList.toggle('grid-huge', maxSide >= 25);
    if (maxSide >= 25) {
      el.puzzleGrid.style.setProperty('--grid-gap', '1px');
      el.puzzleGrid.style.setProperty('--part-inset', '6%');
      el.puzzleGrid.style.setProperty('--grid-radius', '2px');
    } else if (maxSide >= 15) {
      el.puzzleGrid.style.setProperty('--grid-gap', '1px');
      el.puzzleGrid.style.setProperty('--part-inset', '10%');
      el.puzzleGrid.style.setProperty('--grid-radius', '3px');
    } else {
      el.puzzleGrid.style.setProperty('--grid-gap', '2px');
      el.puzzleGrid.style.setProperty('--part-inset', '14%');
      el.puzzleGrid.style.setProperty('--grid-radius', '4px');
    }
    el.puzzleGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        const part = document.createElement('span');
        part.className = 'part';
        cell.appendChild(part);
        frag.appendChild(cell);
      }
    }
    el.puzzleGrid.appendChild(frag);
  }

  function buildInventoryDOM() {
    const N = window.Game.inventorySize();
    el.inventory.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.i = i;
      const part = document.createElement('span');
      part.className = 'part';
      slot.appendChild(part);
      el.inventory.appendChild(slot);
    }
  }

  // ===== Обновление состояния DOM =====
  function renderGrid() {
    const state = window.Game.state;
    const selSet = window.Game.selectedCellSet();
    const nodes = el.puzzleGrid.children;
    let idx = 0;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = nodes[idx++];
        const data = state.grid[r][c];
        // bg
        if (data.bg === null) {
          cell.dataset.bg = '';
          cell.dataset.bgLight = '';
          cell.classList.add('empty');
          cell.style.backgroundColor = '';
        } else {
          const hex = window.Game.colorHex(data.bg);
          cell.dataset.bg = data.bg;
          cell.dataset.bgLight = isLightHex(hex) ? 'true' : 'false';
          cell.classList.remove('empty');
          cell.style.backgroundColor = hex || '';
        }
        // part
        const partEl = cell.firstElementChild;
        if (data.part === null) {
          cell.dataset.part = '';
          partEl.style.backgroundColor = '';
          partEl.style.display = 'none';
        } else {
          cell.dataset.part = data.part;
          partEl.style.backgroundColor = window.Game.colorHex(data.part) || '';
          partEl.style.display = '';
        }
        // locked: деталь стоит на своём цвете — не интерактивна
        cell.dataset.locked = window.Game.isLocked(data) ? 'true' : 'false';
        // selection
        cell.dataset.selected = selSet.has(r + ',' + c) ? 'true' : 'false';
      }
    }
  }

  function renderInventory() {
    const state = window.Game.state;
    const selSet = window.Game.selectedSlotSet();
    const nodes = el.inventory.children;
    for (let i = 0; i < state.inventory.length; i++) {
      const slot = nodes[i];
      const color = state.inventory[i];
      const partEl = slot.firstElementChild;
      if (color === null) {
        slot.dataset.part = '';
        partEl.style.backgroundColor = '';
        partEl.style.display = 'none';
      } else {
        slot.dataset.part = color;
        partEl.style.backgroundColor = window.Game.colorHex(color) || '';
        partEl.style.display = '';
      }
      slot.dataset.selected = selSet.has(i) ? 'true' : 'false';
    }
  }

  function renderHeader() {
    const state = window.Game.state;
    if (el.levelTitle) {
      const level = window.LEVELS.byId(state.levelId);
      el.levelTitle.textContent = level ? level.name : ('Уровень ' + state.levelId);
    }
    if (el.selectionInfo) {
      const size = window.Game.selectionSize();
      el.selectionInfo.textContent = size > 0 ? ('Выбрано: ' + size) : '';
    }
  }

  function render() {
    renderGrid();
    renderInventory();
    renderHeader();
    if (window.Game.state.complete) {
      showWinOverlay();
    } else {
      hideWinOverlay();
    }
  }

  // ===== Обработчики =====
  function onGridClick(ev) {
    const cell = ev.target.closest('.cell');
    if (!cell || !el.puzzleGrid.contains(cell)) return;
    const r = parseInt(cell.dataset.r, 10);
    const c = parseInt(cell.dataset.c, 10);
    if (window.Game.pickAtCell(r, c)) render();
  }

  function onInventoryClick(ev) {
    const slot = ev.target.closest('.slot');
    if (!slot || !el.inventory.contains(slot)) return;
    const i = parseInt(slot.dataset.i, 10);
    if (window.Game.pickAtSlot(i)) render();
  }

  function bindHandlers() {
    if (el.btnBack) el.btnBack.addEventListener('click', () => {
      renderLevelsList();
      showScreen('screen-home');
    });
    if (el.btnReset) el.btnReset.addEventListener('click', () => {
      window.Game.resetLevel();
      render();
    });
    if (el.btnWinNext) el.btnWinNext.addEventListener('click', () => {
      hideWinOverlay();
      renderLevelsList();
      showScreen('screen-home');
    });
    if (el.puzzleGrid) el.puzzleGrid.addEventListener('click', onGridClick);
    if (el.inventory) el.inventory.addEventListener('click', onInventoryClick);
  }

  function init() {
    cacheDom();
    bindHandlers();
    renderLevelsList();
    showScreen('screen-home');
  }

  return {
    init: init,
    render: render,
    showScreen: showScreen,
    buildGridDOM: buildGridDOM,
    buildInventoryDOM: buildInventoryDOM,
    renderLevelsList: renderLevelsList,
    startLevelInUI: startLevelInUI,
  };
})();
