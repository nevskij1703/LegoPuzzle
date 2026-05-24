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
    el.viewport    = document.getElementById('board-viewport');
    el.puzzleGrid  = document.getElementById('puzzle-grid');
    el.inventory   = document.getElementById('inventory');
    el.winOverlay  = document.getElementById('win-overlay');
    el.btnWinNext  = document.getElementById('btn-win-next');
    el.zoomSlider  = document.getElementById('zoom-slider');
    el.zoomIn      = document.getElementById('zoom-in');
    el.zoomOut     = document.getElementById('zoom-out');
    el.zoomValue   = document.getElementById('zoom-value');
  }

  // ===== Viewport: zoom + pan =====
  const viewState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    minScale: 1,
    maxScale: 4,
  };
  const pointers = new Map();           // pointerId → {x, y, startX, startY}
  let dragMoved = false;                 // true как только палец/курсор сдвинулся за порог
  const DRAG_THRESHOLD = 6;              // px
  let pinchInitialDist = 0;
  let pinchInitialScale = 1;
  let pinchInitialWorldX = 0;
  let pinchInitialWorldY = 0;

  function applyTransform() {
    if (!el.puzzleGrid) return;
    el.puzzleGrid.style.transform =
      'translate(' + viewState.offsetX + 'px,' + viewState.offsetY + 'px) scale(' + viewState.scale + ')';
    if (el.zoomSlider) el.zoomSlider.value = viewState.scale;
    if (el.zoomValue) el.zoomValue.textContent = viewState.scale.toFixed(2).replace(/\.?0+$/, '') + '×';
  }

  function clampOffsets() {
    if (!el.viewport) return;
    const vpW = el.viewport.clientWidth, vpH = el.viewport.clientHeight;
    const scaledW = vpW * viewState.scale;
    const scaledH = vpH * viewState.scale;
    const minX = Math.min(0, vpW - scaledW);
    const minY = Math.min(0, vpH - scaledH);
    if (viewState.offsetX < minX) viewState.offsetX = minX;
    if (viewState.offsetX > 0)    viewState.offsetX = 0;
    if (viewState.offsetY < minY) viewState.offsetY = minY;
    if (viewState.offsetY > 0)    viewState.offsetY = 0;
  }

  function resetView() {
    viewState.scale = 1;
    viewState.offsetX = 0;
    viewState.offsetY = 0;
    applyTransform();
  }

  // Установить scale, держа точку (focalX, focalY) viewport-координат под курсором.
  function zoomAt(newScale, focalX, focalY) {
    newScale = Math.max(viewState.minScale, Math.min(viewState.maxScale, newScale));
    if (newScale === viewState.scale) return;
    const worldX = (focalX - viewState.offsetX) / viewState.scale;
    const worldY = (focalY - viewState.offsetY) / viewState.scale;
    viewState.scale = newScale;
    viewState.offsetX = focalX - worldX * newScale;
    viewState.offsetY = focalY - worldY * newScale;
    clampOffsets();
    applyTransform();
  }

  function panBy(dx, dy) {
    viewState.offsetX += dx;
    viewState.offsetY += dy;
    clampOffsets();
    applyTransform();
  }

  function getViewportXY(ev) {
    const rect = el.viewport.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function onPointerDown(ev) {
    // Только основная кнопка мыши.
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    // Клики/touch по zoom-control не должны запускать pan.
    if (ev.target.closest && ev.target.closest('.zoom-control')) return;
    try { el.viewport.setPointerCapture(ev.pointerId); } catch (e) {}
    const p = getViewportXY(ev);
    pointers.set(ev.pointerId, { x: p.x, y: p.y, startX: p.x, startY: p.y });
    dragMoved = false;
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const p1 = pts[0], p2 = pts[1];
      pinchInitialDist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      pinchInitialScale = viewState.scale;
      const fx = (p1.x + p2.x) / 2;
      const fy = (p1.y + p2.y) / 2;
      pinchInitialWorldX = (fx - viewState.offsetX) / viewState.scale;
      pinchInitialWorldY = (fy - viewState.offsetY) / viewState.scale;
      dragMoved = true;
    }
  }

  function onPointerMove(ev) {
    if (!pointers.has(ev.pointerId)) return;
    const p = getViewportXY(ev);
    const stored = pointers.get(ev.pointerId);

    if (pointers.size === 1) {
      const dx = p.x - stored.startX;
      const dy = p.y - stored.startY;
      if (!dragMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragMoved = true;
        el.viewport.classList.add('dragging');
      }
      if (dragMoved) {
        panBy(p.x - stored.x, p.y - stored.y);
      }
      stored.x = p.x; stored.y = p.y;
    } else if (pointers.size === 2) {
      stored.x = p.x; stored.y = p.y;
      const pts = Array.from(pointers.values());
      const p1 = pts[0], p2 = pts[1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const fx = (p1.x + p2.x) / 2;
      const fy = (p1.y + p2.y) / 2;
      const newScale = Math.max(viewState.minScale,
        Math.min(viewState.maxScale, pinchInitialScale * dist / pinchInitialDist));
      viewState.scale = newScale;
      viewState.offsetX = fx - pinchInitialWorldX * newScale;
      viewState.offsetY = fy - pinchInitialWorldY * newScale;
      clampOffsets();
      applyTransform();
    }
  }

  function onPointerUp(ev) {
    if (!pointers.has(ev.pointerId)) return;
    try { el.viewport.releasePointerCapture(ev.pointerId); } catch (e) {}
    pointers.delete(ev.pointerId);

    // Если был ровно один pointer и не было drag — это tap/click по клетке.
    if (pointers.size === 0) {
      el.viewport.classList.remove('dragging');
      if (!dragMoved) {
        const elAt = document.elementFromPoint(ev.clientX, ev.clientY);
        // closest работает на SVGElement тоже; ищем родительский <g data-r>.
        const cell = elAt && elAt.closest && elAt.closest('[data-r]');
        if (cell && el.puzzleGrid.contains(cell)) {
          const r = parseInt(cell.getAttribute('data-r'), 10);
          const c = parseInt(cell.getAttribute('data-c'), 10);
          if (window.Game.pickAtCell(r, c)) render();
        }
      }
      dragMoved = false;
    } else if (pointers.size === 1) {
      // Переход pinch → pan: сбрасываем start, чтобы оставшийся палец
      // не дёрнул случайный pan от старой стартовой точки.
      const remaining = Array.from(pointers.values())[0];
      remaining.startX = remaining.x;
      remaining.startY = remaining.y;
      // dragMoved оставляем true — pinch уже произошёл, click не нужен.
    }
  }

  function onWheel(ev) {
    ev.preventDefault();
    const p = getViewportXY(ev);
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(viewState.scale * factor, p.x, p.y);
  }

  function onSliderInput() {
    const target = parseFloat(el.zoomSlider.value);
    const cx = el.viewport.clientWidth / 2;
    const cy = el.viewport.clientHeight / 2;
    zoomAt(target, cx, cy);
  }

  function bindViewportHandlers() {
    if (!el.viewport) return;
    el.viewport.addEventListener('pointerdown', onPointerDown);
    el.viewport.addEventListener('pointermove', onPointerMove);
    el.viewport.addEventListener('pointerup', onPointerUp);
    el.viewport.addEventListener('pointercancel', onPointerUp);
    el.viewport.addEventListener('wheel', onWheel, { passive: false });
    el.viewport.addEventListener('contextmenu', e => e.preventDefault());
    if (el.zoomSlider) el.zoomSlider.addEventListener('input', onSliderInput);
    if (el.zoomIn) el.zoomIn.addEventListener('click', () => {
      const cx = el.viewport.clientWidth / 2;
      const cy = el.viewport.clientHeight / 2;
      zoomAt(viewState.scale * 1.25, cx, cy);
    });
    if (el.zoomOut) el.zoomOut.addEventListener('click', () => {
      const cx = el.viewport.clientWidth / 2;
      const cy = el.viewport.clientHeight / 2;
      zoomAt(viewState.scale / 1.25, cx, cy);
    });
    window.addEventListener('resize', () => { clampOffsets(); applyTransform(); });
  }

  function startLevelInUI(id) {
    window.Game.startLevel(id);
    buildGridDOM();
    buildInventoryDOM();
    resetView();
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

  // ===== Построение SVG сетки =====
  // Поле рендерится одним <svg> с viewBox = cols × rows. Каждая клетка —
  // <g data-r data-c> с двумя детьми: <rect> (подложка) и <circle> (деталь).
  // SVG векторный — при любом zoom остаётся резким.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PART_RADIUS = 0.32;          // относительно клетки (1 = ширина клетки)
  const PART_RADIUS_SELECTED = 0.36;

  function buildGridDOM() {
    const state = window.Game.state;
    el.puzzleGrid.innerHTML = '';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + state.cols + ' ' + state.rows);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('puzzle-svg');

    const frag = document.createDocumentFragment();
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'cell');
        g.setAttribute('data-r', r);
        g.setAttribute('data-c', c);

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('class', 'bg');
        rect.setAttribute('x', c);
        rect.setAttribute('y', r);
        rect.setAttribute('width', 1);
        rect.setAttribute('height', 1);
        g.appendChild(rect);

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('class', 'part');
        circle.setAttribute('cx', c + 0.5);
        circle.setAttribute('cy', r + 0.5);
        circle.setAttribute('r', PART_RADIUS);
        g.appendChild(circle);

        frag.appendChild(g);
      }
    }
    svg.appendChild(frag);
    el.puzzleGrid.appendChild(svg);
    el.svg = svg;
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

  // ===== Обновление состояния SVG =====
  function renderGrid() {
    const state = window.Game.state;
    const selSet = window.Game.selectedCellSet();
    if (!el.svg) return;
    const nodes = el.svg.children;
    let idx = 0;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const g = nodes[idx++];
        if (!g) continue;
        const data = state.grid[r][c];
        const rect = g.firstElementChild;
        const circle = rect.nextElementSibling;

        // bg
        if (data.bg === null) {
          g.classList.add('empty');
          rect.removeAttribute('fill');
        } else {
          g.classList.remove('empty');
          rect.setAttribute('fill', window.Game.colorHex(data.bg) || '#000');
        }

        // part
        if (data.part === null) {
          circle.setAttribute('fill', 'none');
          circle.style.display = 'none';
        } else {
          circle.style.display = '';
          circle.setAttribute('fill', window.Game.colorHex(data.part) || '#000');
        }

        // locked / selected — через classes (стили из styles.css)
        const locked = window.Game.isLocked(data);
        const selected = selSet.has(r + ',' + c);
        g.classList.toggle('locked', locked);
        g.classList.toggle('selected', selected);
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
  // Клики по клеткам поля обрабатываются в onPointerUp (см. viewport-блок выше) —
  // через pointer-events чтобы корректно различить tap от pan/pinch.

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
    if (el.inventory) el.inventory.addEventListener('click', onInventoryClick);
    bindViewportHandlers();
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
