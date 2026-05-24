/**
 * ui.js — рендер DOM и обработчики кликов.
 *
 * Получает игровое состояние из window.Game и отрисовывает его в #puzzle-grid
 * и #inventory. Делегирует пользовательские клики обратно в Game.pickAt*.
 */
window.UI = (function () {
  const el = {};

  function cacheDom() {
    el.screenHome  = document.getElementById('screen-home');
    el.screenGame  = document.getElementById('screen-game');
    el.btnPlay     = document.getElementById('btn-play');
    el.btnBack     = document.getElementById('btn-back');
    el.btnReset    = document.getElementById('btn-reset');
    el.levelTitle  = document.getElementById('level-title');
    el.selectionInfo = document.getElementById('selection-info');
    el.puzzleGrid  = document.getElementById('puzzle-grid');
    el.inventory   = document.getElementById('inventory');
    el.winOverlay  = document.getElementById('win-overlay');
    el.btnWinNext  = document.getElementById('btn-win-next');
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
    el.puzzleGrid.innerHTML = '';
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        const part = document.createElement('span');
        part.className = 'part';
        cell.appendChild(part);
        el.puzzleGrid.appendChild(cell);
      }
    }
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
          cell.classList.add('empty');
        } else {
          cell.dataset.bg = data.bg;
          cell.classList.remove('empty');
        }
        // part
        if (data.part === null) {
          cell.dataset.part = '';
        } else {
          cell.dataset.part = data.part;
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
      if (color === null) {
        slot.dataset.part = '';
      } else {
        slot.dataset.part = color;
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
    if (el.btnPlay) el.btnPlay.addEventListener('click', () => {
      window.Game.init();
      buildGridDOM();
      buildInventoryDOM();
      render();
      showScreen('screen-game');
    });
    if (el.btnBack) el.btnBack.addEventListener('click', () => {
      showScreen('screen-home');
    });
    if (el.btnReset) el.btnReset.addEventListener('click', () => {
      window.Game.resetLevel();
      render();
    });
    if (el.btnWinNext) el.btnWinNext.addEventListener('click', () => {
      hideWinOverlay();
      showScreen('screen-home');
    });
    if (el.puzzleGrid) el.puzzleGrid.addEventListener('click', onGridClick);
    if (el.inventory) el.inventory.addEventListener('click', onInventoryClick);
  }

  function init() {
    cacheDom();
    bindHandlers();
    showScreen('screen-home');
  }

  return {
    init: init,
    render: render,
    showScreen: showScreen,
    buildGridDOM: buildGridDOM,
    buildInventoryDOM: buildInventoryDOM,
  };
})();
