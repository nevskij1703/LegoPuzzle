/**
 * audio.js — простые звуки и вибрация через WebAudio (без файлов).
 *
 * Звуки игры:
 *   select  — клик по детали, поднята группа
 *   place   — деталь(и) встали на место
 *   error   — попытка некорректного действия (необязательно дёргать)
 *   cancel  — снятие выделения
 *   win     — уровень пройден
 */
window.AudioFX = (function () {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { ctx = null; }
    }
    return ctx;
  }

  function beep(freq, durationMs, type, gainPeak) {
    if (!window.Storage.getSound()) return;
    const c = ensureCtx();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(c.destination);
    const now = c.currentTime;
    g.gain.exponentialRampToValueAtTime(gainPeak || 0.15, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    o.start(now);
    o.stop(now + durationMs / 1000 + 0.02);
  }

  function chord(freqs, durationMs, type) {
    if (!window.Storage.getSound()) return;
    freqs.forEach((f, i) => setTimeout(() => beep(f, durationMs, type, 0.10), i * 60));
  }

  function vibrate(pattern) {
    if (!window.Storage.getVibration()) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  return {
    select: () => { beep(620, 80,  'triangle'); vibrate(8); },
    place:  () => { beep(440, 100, 'sine');     vibrate(12); },
    cancel: () => { beep(300, 90,  'sine');     vibrate(8); },
    error:  () => { beep(200, 140, 'sawtooth'); vibrate([10, 30, 10]); },
    win:    () => { chord([523, 659, 784, 1046], 180, 'triangle'); vibrate([20, 60, 20, 60, 40]); },
  };
})();
