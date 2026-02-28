/* ═══════════════════════════════════════════
   GAME.JS — Core falling-letter game engine
   ═══════════════════════════════════════════ */
const Game = (() => {
  /* ─── Constants ─── */
  const NAME = 'ANDREASMAVROEIDAKOS';
  const LETTERS_PER_LEVEL = 18;
  const MAX_HEALTH = 100;
  const MISS_DAMAGE = 25;        // base damage per miss
  const MISS_DAMAGE_VAR = 5;     // ±variation
  const REGEN_CHANCE = 0.25;
  const REGEN_AMOUNT = 5;
  const HUD_HEIGHT = 50;         // pixels reserved for HUD at top

  const LEVEL_CONFIG = [
    { maxSimultaneous: 1, speed: 1.5,  spawnInterval: 1400 },
    { maxSimultaneous: 2, speed: 2.0,  spawnInterval: 1100 },
    { maxSimultaneous: 3, speed: 2.5,  spawnInterval: 900 },
    { maxSimultaneous: 4, speed: 3.0,  spawnInterval: 700 },
    { maxSimultaneous: 5, speed: 3.5,  spawnInterval: 550 },
  ];

  /* ─── State ─── */
  let canvas, ctx;
  let running = false;
  let paused = false;
  let health, score, level, lettersSpawned, lettersCleared;
  let letters = [];       // active falling letters
  let particles = [];     // hit-explosion particles
  let frameId = null;
  let lastSpawnTime = 0;
  let bgDrawn = false;
  let bgImage = null;     // off-screen canvas for background
  let onGameOver = null;  // callback
  let onGameWin = null;
  let onLevelUp = null;

  /* ─── Sizing ─── */
  let W, H, dpr;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgDrawn = false;
  }

  /* ─── Background cache ─── */
  function cacheBackground() {
    const offscreen = document.createElement('canvas');
    offscreen.width = W * dpr;
    offscreen.height = H * dpr;
    const offCtx = offscreen.getContext('2d');
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PixelBackgrounds.levelDrawers[level](offCtx, W, H);
    bgImage = offscreen;
    bgDrawn = true;
  }

  /* ─── Letter object ─── */
  function createLetter() {
    const ch = NAME[Math.floor(Math.random() * NAME.length)];
    const size = 24 + Math.floor(Math.random() * 20); // 24-44px
    const x = 20 + Math.random() * (W - 60);
    return {
      ch,
      x,
      y: -size,
      size,
      speed: LEVEL_CONFIG[level].speed + (Math.random() - 0.5) * 0.4,
      alive: true,
      opacity: 1,
    };
  }

  /* ─── Particles ─── */
  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  /* ─── Score popup (DOM) ─── */
  function showScorePopup(x, y, points) {
    const el = document.createElement('div');
    el.className = 'score-popup';
    el.textContent = '+' + points;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    const gameView = document.getElementById('view-game');
    gameView.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  /* ─── HUD update ─── */
  function updateHUD() {
    const bar = document.getElementById('health-bar');
    const hpTxt = document.getElementById('hp-text');
    const scoreTxt = document.getElementById('score-display');
    const levelTxt = document.getElementById('level-display');

    const pct = Math.max(0, health) / MAX_HEALTH * 100;
    bar.style.width = pct + '%';
    bar.classList.remove('low', 'med');
    if (pct <= 25) bar.classList.add('low');
    else if (pct <= 50) bar.classList.add('med');

    hpTxt.textContent = Math.max(0, Math.round(health));
    scoreTxt.textContent = score;
    levelTxt.textContent = level + 1;
  }

  /* ─── Hit detection ─── */
  function tryHit(clickX, clickY) {
    // Iterate in reverse so we hit top-most (latest drawn) first
    for (let i = letters.length - 1; i >= 0; i--) {
      const l = letters[i];
      if (!l.alive) continue;
      const halfW = l.size * 0.55;
      const halfH = l.size * 0.6;
      if (
        clickX >= l.x - halfW && clickX <= l.x + halfW &&
        clickY >= l.y - halfH && clickY <= l.y + halfH
      ) {
        l.alive = false;
        lettersCleared++;

        // Score: bonus for how high the letter still is
        const progress = Math.max(0, l.y - HUD_HEIGHT) / (H - HUD_HEIGHT);
        let multiplier;
        if (progress < 0.3) multiplier = 2.0;
        else if (progress < 0.6) multiplier = 1.5;
        else multiplier = 1.0;
        const points = Math.round(100 * multiplier);
        score += points;

        // Regen
        if (Math.random() < REGEN_CHANCE) {
          health = Math.min(MAX_HEALTH, health + REGEN_AMOUNT);
        }

        // FX
        spawnParticles(l.x, l.y, '#f4d35e');
        showScorePopup(l.x, l.y, points);
        Audio8Bit.playHit();
        updateHUD();
        return true;
      }
    }
    return false;
  }

  /* ─── Miss handler ─── */
  function missLetter(l) {
    const sizeRatio = l.size / 44; // 0..1 based on max size
    const dmg = MISS_DAMAGE + Math.round((sizeRatio - 0.5) * MISS_DAMAGE_VAR * 2);
    health -= dmg;
    Audio8Bit.playMiss();
    spawnParticles(l.x, H, '#e63946');
    updateHUD();
    if (health <= 0) {
      health = 0;
      updateHUD();
      endGame(false);
    }
  }

  /* ─── Level transition ─── */
  function checkLevelUp() {
    if (lettersSpawned >= LETTERS_PER_LEVEL && letters.every(l => !l.alive)) {
      if (level < LEVEL_CONFIG.length - 1) {
        level++;
        lettersSpawned = 0;
        lettersCleared = 0;
        letters = [];
        bgDrawn = false;
        paused = true;
        Audio8Bit.playLevelUp();
        if (onLevelUp) onLevelUp(level);
      } else {
        // All levels cleared!
        endGame(true);
      }
    }
  }

  /* ─── End game ─── */
  function endGame(won) {
    running = false;
    cancelAnimationFrame(frameId);
    if (won) {
      Audio8Bit.playWin();
      if (onGameWin) onGameWin(score);
    } else {
      Audio8Bit.playGameOver();
      if (onGameOver) onGameOver(score, level);
    }
  }

  /* ─── Main loop ─── */
  function loop(timestamp) {
    if (!running) return;
    frameId = requestAnimationFrame(loop);
    if (paused) return;

    // Draw background
    if (!bgDrawn) cacheBackground();
    ctx.clearRect(0, 0, W, H);
    if (bgImage) ctx.drawImage(bgImage, 0, 0, W, H);

    // Dim overlay so letters are visible
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);

    // Spawn letters
    const cfg = LEVEL_CONFIG[level];
    const activeCount = letters.filter(l => l.alive).length;
    if (
      lettersSpawned < LETTERS_PER_LEVEL &&
      activeCount < cfg.maxSimultaneous &&
      timestamp - lastSpawnTime > cfg.spawnInterval
    ) {
      letters.push(createLetter());
      lettersSpawned++;
      lastSpawnTime = timestamp;
    }

    // Update & draw letters
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = letters.length - 1; i >= 0; i--) {
      const l = letters[i];
      if (!l.alive) {
        letters.splice(i, 1);
        continue;
      }
      l.y += l.speed;

      // Missed — fell past bottom
      if (l.y > H + l.size) {
        l.alive = false;
        missLetter(l);
        letters.splice(i, 1);
        continue;
      }

      // Draw letter
      ctx.save();
      ctx.font = `${l.size}px 'Press Start 2P', monospace`;
      // Glow
      ctx.shadowColor = '#f4d35e';
      ctx.shadowBlur = 8;
      // Outline
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(l.ch, l.x, l.y);
      // Fill
      const colors = ['#e63946', '#f4d35e', '#00f5d4', '#80ed99', '#c77dff', '#ff9f1c'];
      ctx.fillStyle = colors[NAME.indexOf(l.ch) % colors.length];
      ctx.fillText(l.ch, l.x, l.y);
      ctx.restore();
    }

    // Update & draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Check level advancement
    checkLevelUp();
  }

  /* ─── Input ─── */
  function handlePointer(e) {
    if (!running || paused) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    let cx, cy;
    if (e.touches) {
      cx = e.touches[0].clientX - rect.left;
      cy = e.touches[0].clientY - rect.top;
    } else {
      cx = e.clientX - rect.left;
      cy = e.clientY - rect.top;
    }
    tryHit(cx, cy);
  }

  /* ─── Public API ─── */
  function init(canvasEl, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onGameOver = callbacks.onGameOver || null;
    onGameWin = callbacks.onGameWin || null;
    onLevelUp = callbacks.onLevelUp || null;

    window.addEventListener('resize', resize);
    canvas.addEventListener('click', handlePointer);
    canvas.addEventListener('touchstart', handlePointer, { passive: false });
    resize();
  }

  function start(startLevel = 0) {
    health = MAX_HEALTH;
    score = 0;
    level = startLevel;
    lettersSpawned = 0;
    lettersCleared = 0;
    letters = [];
    particles = [];
    bgDrawn = false;
    running = true;
    paused = true; // will be unpaused by level intro
    lastSpawnTime = 0;
    updateHUD();
    resize();
    frameId = requestAnimationFrame(loop);
  }

  function unpause() {
    paused = false;
    lastSpawnTime = performance.now();
  }

  function stop() {
    running = false;
    paused = false;
    if (frameId) cancelAnimationFrame(frameId);
  }

  function getState() {
    return { health, score, level, running, paused };
  }

  return { init, start, unpause, stop, getState, resize };
})();
