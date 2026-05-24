/**
 * levels.js — данные уровней игры «Лего-паззл».
 *
 * Каждый уровень:
 *   id          — уникальный целочисленный
 *   name        — название (для UI)
 *   difficulty  — 'easy' | 'medium' | 'hard' (информационно)
 *   rows, cols  — размер сетки
 *   bg          — массив [rows][cols] цветовых кодов или null (вне арта).
 *                 Цветовые коды должны быть зарегистрированы в GAME_CONFIG.COLORS.
 *
 * Начальная раскладка деталей (parts) генерируется в game.js:
 *   - Собирается мульти-набор цветов всех непустых клеток bg.
 *   - Перемешивается Fisher-Yates'ом и раскидывается обратно по тем же клеткам.
 *   - Если случайно совпало с финальным — перемешиваем заново.
 *
 * MVP: один простой 8×8 смайлик с 3 цветами (Y/B/R).
 */
window.LEVELS = [
  {
    id: 1,
    name: 'Смайлик',
    difficulty: 'easy',
    rows: 8,
    cols: 8,
    bg: [
      [null, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', null],
      ['Y',  'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y' ],
      ['Y',  'B', 'Y', 'Y', 'Y', 'Y', 'B', 'Y' ],
      ['Y',  'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y' ],
      ['Y',  'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y' ],
      ['Y',  'R', 'R', 'R', 'R', 'R', 'R', 'Y' ],
      ['Y',  'Y', 'R', 'R', 'R', 'R', 'Y', 'Y' ],
      [null, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', null],
    ],
  },
];

// Helper for game.js — найти уровень по id.
window.LEVELS.byId = function (id) {
  for (let i = 0; i < window.LEVELS.length; i++) {
    if (window.LEVELS[i].id === id) return window.LEVELS[i];
  }
  return null;
};
