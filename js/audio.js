/* ═══════════════════════════════════════════
   AUDIO.JS — Retro 8-bit Sound Effects
   Uses Web Audio API oscillators (no files).
   ═══════════════════════════════════════════ */
const Audio8Bit = (() => {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone(freq, type, duration, volume = 0.15, ramp = null) {
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (ramp) {
      osc.frequency.linearRampToValueAtTime(ramp, c.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  }

  function playHit() {
    playTone(880, 'square', 0.06, 0.12);
    setTimeout(() => playTone(1100, 'square', 0.04, 0.08), 30);
  }

  function playMiss() {
    playTone(260, 'square', 0.18, 0.15, 120);
  }

  function playLevelUp() {
    playTone(523, 'square', 0.1, 0.12);
    setTimeout(() => playTone(659, 'square', 0.1, 0.12), 100);
    setTimeout(() => playTone(784, 'square', 0.1, 0.12), 200);
    setTimeout(() => playTone(1047, 'square', 0.15, 0.15), 300);
  }

  function playGameOver() {
    playTone(523, 'square', 0.15, 0.12);
    setTimeout(() => playTone(440, 'square', 0.15, 0.12), 160);
    setTimeout(() => playTone(349, 'square', 0.15, 0.12), 320);
    setTimeout(() => playTone(262, 'square', 0.3, 0.15), 480);
  }

  function playWin() {
    playTone(523, 'square', 0.1, 0.1);
    setTimeout(() => playTone(659, 'square', 0.1, 0.1), 100);
    setTimeout(() => playTone(784, 'square', 0.1, 0.1), 200);
    setTimeout(() => playTone(1047, 'square', 0.12, 0.12), 300);
    setTimeout(() => playTone(1319, 'square', 0.2, 0.15), 420);
  }

  function playClick() {
    playTone(660, 'square', 0.04, 0.08);
  }

  return { playHit, playMiss, playLevelUp, playGameOver, playWin, playClick };
})();
