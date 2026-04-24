/* ═══════════════════════════════════════════
   GAME.JS — Rockster Teufel XL
   Crank the volume. Score points. Don't get
   the cops called on you.
   ═══════════════════════════════════════════ */
const Game = (() => {
  const GAME_DURATION = 90; // seconds per run

  /* ─── Stage config (difficulty ramps by survival time, tuned for 90s runs) ─── */
  const STAGES = [
    { name: 'WARM UP',           at:  0, sensMin: 0.5, sensMax: 1.2, fillMul: 0.85, drainMul: 1.2,  multCap: 2, shiftMin: 4000, shiftMax: 9000 },
    { name: 'GETTING LOUD',      at: 20, sensMin: 0.8, sensMax: 1.5, fillMul: 1.0,  drainMul: 1.0,  multCap: 3, shiftMin: 3000, shiftMax: 7000 },
    { name: 'LOUD NEIGHBORS',    at: 45, sensMin: 1.0, sensMax: 1.8, fillMul: 1.15, drainMul: 0.85, multCap: 4, shiftMin: 2500, shiftMax: 5500 },
    { name: 'POLICE EVERYWHERE', at: 70, sensMin: 1.3, sensMax: 2.2, fillMul: 1.35, drainMul: 0.7,  multCap: 6, shiftMin: 2000, shiftMax: 4500 },
  ];

  const NEIGHBOR_MOODS = [
    { threshold: 0,    emoji: '😐', label: 'CHILL',        color: '#4CAF50' },
    { threshold: 0.3,  emoji: '😕', label: 'HMM...',       color: '#FFC107' },
    { threshold: 0.5,  emoji: '😠', label: 'ANNOYED!',     color: '#FF9800' },
    { threshold: 0.7,  emoji: '🤬', label: 'FURIOUS!',     color: '#f44336' },
    { threshold: 0.85, emoji: '🚓', label: 'CALLING COPS', color: '#d32f2f' },
  ];

  function getNeighborMood(ratio) {
    for (let i = NEIGHBOR_MOODS.length - 1; i >= 0; i--) {
      if (ratio >= NEIGHBOR_MOODS[i].threshold) return NEIGHBOR_MOODS[i];
    }
    return NEIGHBOR_MOODS[0];
  }

  /* ─── State ─── */
  let canvas, ctx;
  let running = false;
  let paused = false;
  let frameId = null;
  let lastTs = 0;

  // Gameplay
  let volume = 0;          // 0..11
  let score = 0;
  let complaint = 0;       // 0..1 (real game-state value)
  let displayComplaint = 0; // what's drawn — jittered around `complaint`
  let nextSpikeAt = 0;     // timeElapsed threshold for next spike event
  let spikeMag = 0;        // current spike value (signed, eases toward spikeTarget)
  let spikeTarget = 0;     // current target for the slow swell
  let spikeHoldUntil = 0;  // timeElapsed after which spikeTarget returns to 0
  let sensitivity = 1;
  let timeElapsed = 0;
  let stageIdx = 0;
  let multiplier = 1;
  let powerMult = 1;         // active multiplier powerup (decays)
  let powerMultTimer = 0;    // seconds remaining
  let freezeTimer = 0;       // seconds remaining on snowflake freeze
  let zeroVolumeTimer = 0;   // ticks up while volume === 0
  let sensTimer = null;
  let stageBannerTimer = 0;
  let highScore = +(localStorage.getItem('rockster_hi') || 0);

  // Visual FX state
  let sparks = [];
  let lightningFlash = 0;  // 0..1
  let shakeOffset = { x: 0, y: 0 };
  let scorePopups = [];    // { text, x, y, life, color, size }
  let crowdPhase = 0;
  let powerups = [];       // { x, y, vy, type, size, wobble }
  let nextPowerupAt = 8;
  let powerupFlash = 0;    // brief glow on multiplier display when power-up is grabbed

  // Images
  let speakerImg = null;
  let speakerLoaded = false;
  let standImg = null;
  let standLoaded = false;

  // Callbacks
  let onGameOver = null;
  let onGameWin  = null;   // unused but kept for interface parity
  let onLevelUp  = null;

  // DOM refs populated by main.js bootstrap
  let knobEl, knobPointerEl, volValEl, compBarEl, compLabelEl, compMoodEl, multiplierEl, scoreEl, stageLabelEl, timeEl;
  let powerMultChip, powerFreezeChip;

  /* ─── Sizing ─── */
  let W, H, dpr;
  function resize() {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ─── Speaker image preload ─── */
  function preloadSpeaker() {
    speakerImg = new Image();
    speakerImg.onload = () => { speakerLoaded = true; };
    speakerImg.onerror = () => { speakerLoaded = false; };
    speakerImg.src = 'assets/rockster.png';

    standImg = new Image();
    standImg.onload = () => { standLoaded = true; };
    standImg.onerror = () => { standLoaded = false; };
    standImg.src = 'assets/rockster_stand.png';
  }

  /* ─── Knob wiring ─── */
  let knobDragging = false;
  let knobStartY = 0;
  let knobStartVal = 0;

  function setVolume(v) {
    volume = Math.max(0, Math.min(11, Math.round(v * 2) / 2));
    updateKnobVisual();
    const slider = document.getElementById('rockster-slider');
    if (slider && +slider.value !== volume) slider.value = volume;
  }

  function updateKnobVisual() {
    if (!knobEl) return;
    const angle = -135 + (volume / 11) * 270;
    knobEl.style.transform = `rotate(${angle}deg)`;
    if (knobPointerEl) {
      knobPointerEl.style.background = volume >= 10 ? '#ff3300' : '#ccc';
      knobPointerEl.style.boxShadow = volume >= 10 ? '0 0 8px #f30' : 'none';
    }
    if (volValEl) volValEl.textContent = volume.toFixed(1);
    updateKnobTicks();
  }

  function buildKnobTicks() {
    const wrap = document.getElementById('rockster-knob-ticks');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i <= 11; i++) {
      const a = (-135 + (i / 11) * 270) * (Math.PI / 180);
      const r = 102;
      const x = 115 + Math.cos(a) * r;
      const y = 115 + Math.sin(a) * r;
      const tick = document.createElement('div');
      tick.className = 'rockster-tick';
      tick.textContent = i;
      tick.style.cssText = `
        position:absolute;left:${x - 12}px;top:${y - 12}px;
        width:24px;height:24px;display:flex;align-items:center;justify-content:center;
        font-family:inherit;font-size:${i === 11 ? 14 : 12}px;
        color:${i === 11 ? '#ff0000' : '#555'};
        font-weight:${i === 11 ? 'bold' : 'normal'};
        pointer-events:none;
      `;
      tick.dataset.idx = i;
      wrap.appendChild(tick);
    }
  }

  function updateKnobTicks() {
    const wrap = document.getElementById('rockster-knob-ticks');
    if (!wrap) return;
    wrap.querySelectorAll('.rockster-tick').forEach(t => {
      const i = +t.dataset.idx;
      const active = i <= volume;
      const isEleven = i === 11;
      t.style.color = isEleven
        ? '#ff0000'
        : (active ? '#fff' : '#555');
      t.style.textShadow = (isEleven && volume >= 11)
        ? '0 0 10px #f00, 0 0 20px #f00'
        : 'none';
    });
  }

  function attachKnob() {
    if (!knobEl) return;
    buildKnobTicks();
    const onDown = (clientY) => {
      if (!running || paused) return;
      knobDragging = true;
      knobStartY = clientY;
      knobStartVal = volume;
    };
    const onMove = (clientY) => {
      if (!knobDragging) return;
      const delta = (knobStartY - clientY) / 15;
      setVolume(knobStartVal + delta);
    };
    const onUp = () => { knobDragging = false; };

    knobEl.addEventListener('mousedown', e => onDown(e.clientY));
    knobEl.addEventListener('touchstart', e => { e.preventDefault(); onDown(e.touches[0].clientY); }, { passive: false });
    window.addEventListener('mousemove', e => onMove(e.clientY));
    window.addEventListener('touchmove',  e => { if (knobDragging) { e.preventDefault(); onMove(e.touches[0].clientY); } }, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // Mouse wheel on entire game view
    const gameView = document.getElementById('view-game');
    if (gameView) {
      gameView.addEventListener('wheel', (e) => {
        if (!running || paused) return;
        e.preventDefault();
        const d = e.deltaY > 0 ? -0.5 : 0.5;
        setVolume(volume + d);
      }, { passive: false });
    }

    // Keyboard (up/down arrows, W/S)
    window.addEventListener('keydown', (e) => {
      if (!running || paused) return;
      if (e.key === 'ArrowUp'   || e.key === 'w' || e.key === 'W') { setVolume(volume + 0.5); }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { setVolume(volume - 0.5); }
    });

    // Slider
    const slider = document.getElementById('rockster-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        if (!running || paused) return;
        setVolume(+slider.value);
      });
    }
  }

  /* ─── Stage management ─── */
  function currentStage() {
    let s = STAGES[0], idx = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (timeElapsed >= STAGES[i].at) { s = STAGES[i]; idx = i; }
    }
    return { stage: s, idx };
  }

  function scheduleSensitivityShift() {
    const { stage } = currentStage();
    const ms = stage.shiftMin + Math.random() * (stage.shiftMax - stage.shiftMin);
    sensTimer = setTimeout(() => {
      sensitivity = stage.sensMin + Math.random() * (stage.sensMax - stage.sensMin);
      // rare spike in late stage
      if (stageIdx >= 3 && Math.random() < 0.2) sensitivity = 2.5;
      scheduleSensitivityShift();
    }, ms);
  }

  /* ─── Particles / FX ─── */
  function spawnSpark() {
    sparks.push({
      x: W/2 + (Math.random() - 0.5) * 120,
      y: H * 0.4 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 120,
      vy: -60 - Math.random() * 90,
      life: 1,
      color: ['#ff0', '#f80', '#f00', '#fff'][Math.floor(Math.random() * 4)],
    });
  }

  function spawnScorePopup() {
    scorePopups.push({
      text: '+' + Math.floor(volume * multiplier * 2),
      x: W/2 + (Math.random() - 0.5) * 180,
      y: H * 0.28 + (Math.random() - 0.5) * 30,
      life: 1,
      color: multiplier > 3 ? '#f44' : '#FFD700',
      size: 22,
    });
  }

  function pushPopup(text, x, y, color, size, life) {
    scorePopups.push({ text, x, y, color: color || '#FFD700', size: size || 22, life: life == null ? 1.4 : life });
  }

  /* ─── Power-up pixel-art bitmaps ─── */
  // Use " ", "." (shade/accent color), and "#" (primary color) to define 13×13 icons.
  // Centered at the middle cell (index 6).
  // 13×13 bitmaps. '#' = primary color, '.' = accent, ' ' = transparent.
  // Each row MUST be exactly 13 characters.
  const WEED_BITMAP = [
    '      #      ',
    '  #   #   #  ',
    ' ###  #  ### ',
    ' ### .#. ### ',
    '#### ### ####',
    '#############',
    ' ########### ',
    '  ###.#.###  ',
    '   #######   ',
    '    #####    ',
    '     ###     ',
    '      #      ',
    '      #      ',
  ];

  const MONEY_BITMAP = [
    '             ',
    '      #      ',
    '   #######   ',
    '  ##  #  ##  ',
    ' ##   #      ',
    ' ###  #      ',
    '   #######   ',
    '      #  ### ',
    '      #   ## ',
    '  ##  #   ## ',
    '   #######   ',
    '      #      ',
    '             ',
  ];

  const SNOW_BITMAP = [
    '      #      ',
    ' #    #    # ',
    '.##.  #  .##.',
    '  ##  #  ##  ',
    '   ## # ##   ',
    '    #####    ',
    '#### ### ####',
    '    #####    ',
    '   ## # ##   ',
    '  ##  #  ##  ',
    '.##.  #  .##.',
    ' #    #    # ',
    '      #      ',
  ];

  function drawBitmap(bitmap, cx, cy, unit, primary, accent) {
    const rows = bitmap.length;
    const cols = bitmap[0].length;
    const originX = cx - (cols / 2) * unit;
    const originY = cy - (rows / 2) * unit;
    for (let y = 0; y < rows; y++) {
      const row = bitmap[y];
      for (let x = 0; x < cols; x++) {
        const ch = row[x];
        if (ch === '#') {
          ctx.fillStyle = primary;
          ctx.fillRect(originX + x * unit, originY + y * unit, unit + 0.5, unit + 0.5);
        } else if (ch === '.') {
          ctx.fillStyle = accent;
          ctx.fillRect(originX + x * unit, originY + y * unit, unit + 0.5, unit + 0.5);
        }
      }
    }
  }

  /* ─── Power-ups ─── */
  const POWERUP_TYPES = [
    { key: 'weed',  weight: 0.28, bg: '#1b5e20', fg: '#a5d6a7', accent: '#66bb6a' },
    { key: 'money', weight: 0.28, bg: '#33691e', fg: '#f1c40f', accent: '#f4d03f' },
    { key: 'mult',  weight: 0.24, bg: '#4a148c', fg: '#ff6ec7', accent: '#e040fb' },
    { key: 'snow',  weight: 0.20, bg: '#0d3b66', fg: '#b3e5fc', accent: '#4fc3f7' },
  ];

  function pickPowerupType() {
    const r = Math.random();
    let acc = 0;
    for (const t of POWERUP_TYPES) {
      acc += t.weight;
      if (r <= acc) return t;
    }
    return POWERUP_TYPES[0];
  }

  function spawnPowerup() {
    const t = pickPowerupType();
    const size = 48;
    const margin = size + 30;
    powerups.push({
      x: margin + Math.random() * (W - margin * 2),
      y: -size,
      vy: 110 + Math.random() * 60,
      vx: (Math.random() - 0.5) * 40,
      type: t.key,
      size,
      wobble: Math.random() * Math.PI * 2,
      multValue: 1.5 + Math.floor(Math.random() * 3) * 0.5, // 1.5, 2.0, 2.5, 3.0
    });
  }

  function applyPowerup(p) {
    if (p.type === 'weed') {
      complaint = Math.max(0, complaint - 0.33);
      displayComplaint = complaint;
      pushPopup('-33% NEIGHBOR', p.x, p.y, '#66bb6a', 20, 1.6);
    } else if (p.type === 'money') {
      const bonus = 250 + Math.floor(Math.random() * 500);
      score += bonus;
      pushPopup('+$' + bonus, p.x, p.y, '#f4d03f', 24, 1.6);
    } else if (p.type === 'mult') {
      powerMult = p.multValue;
      powerMultTimer = 5;
      powerupFlash = 1;
      pushPopup('x' + p.multValue.toFixed(1) + ' FOR 5s', p.x, p.y, '#e040fb', 22, 1.6);
    } else if (p.type === 'snow') {
      freezeTimer = 5;
      // also zero out the swell so the bar visually calms down
      spikeTarget = 0;
      spikeMag = 0;
      pushPopup('NEIGHBOR FROZEN 5s', p.x, p.y, '#4fc3f7', 22, 1.6);
    }
    // sparkle burst
    for (let i = 0; i < 12; i++) {
      sparks.push({
        x: p.x, y: p.y,
        vx: (Math.random() - 0.5) * 280,
        vy: -60 - Math.random() * 140,
        life: 1,
        color: ['#fff', '#ff0', '#f80'][Math.floor(Math.random() * 3)],
      });
    }
  }

  function handleCanvasClick(clientX, clientY) {
    if (!running || paused) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    // hit-test topmost first (last drawn)
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      if (x >= p.x - p.size/2 && x <= p.x + p.size/2 &&
          y >= p.y - p.size/2 && y <= p.y + p.size/2) {
        applyPowerup(p);
        powerups.splice(i, 1);
        return;
      }
    }
  }

  /* ─── Update loop ─── */
  function update(dt) {
    if (paused) return;
    timeElapsed += dt;

    // Time limit
    if (timeElapsed >= GAME_DURATION) {
      timeUp();
      return;
    }

    // Stage transitions
    const { stage, idx } = currentStage();
    if (idx !== stageIdx) {
      stageIdx = idx;
      stageBannerTimer = 2.5;
      if (onLevelUp) onLevelUp(stage.name);
    }

    const intensity = volume / 11;
    multiplier = (1 + intensity * (stage.multCap - 1)) * powerMult;

    // Score
    score += volume * multiplier * 2 * dt;

    // Snowflake freeze — tick down timer
    if (freezeTimer > 0) freezeTimer = Math.max(0, freezeTimer - dt);

    // Complaint dynamics (true value) — skipped entirely while frozen
    let change = 0;
    if (freezeTimer <= 0) {
      if (volume > 0) {
        const vr = intensity;
        change = vr * vr * 0.12 * dt * sensitivity * stage.fillMul;
      }
      // Drain at low volume: tapered so chilling out always cools the bar a bit
      if (volume <= 3) {
        const drainByVol = { 0: 2.2, 0.5: 1.6, 1: 1.2, 1.5: 0.9, 2: 0.7, 2.5: 0.5, 3: 0.35 };
        const drainMult = drainByVol[volume] != null ? drainByVol[volume] : 0.35;
        change -= 0.07 * dt * drainMult * stage.drainMul;
      }
    }
    complaint = Math.max(0, Math.min(1, complaint + change));

    // Slow spike swells — set a target, ease toward it so player has time to react
    if (freezeTimer <= 0 && timeElapsed >= nextSpikeAt) {
      const mag = 0.22 + Math.random() * 0.28 * (1 + stageIdx * 0.35); // 0.22..0.50 base
      spikeTarget = (Math.random() < 0.55 ? 1 : -1) * mag;             // mostly rising, some dips
      spikeHoldUntil = timeElapsed + 0.7 + Math.random() * 0.4;        // hold target ~0.7–1.1s
      nextSpikeAt = timeElapsed + 1.8 + Math.random() * 2.4;           // 1.8..4.2s between swells
    }
    // Release the swell toward 0 after its hold window
    if (spikeTarget !== 0 && timeElapsed >= spikeHoldUntil) {
      spikeTarget = 0;
    }
    // Ease spikeMag toward spikeTarget slowly (so a big swell takes ~1–1.5s to rise)
    spikeMag += (spikeTarget - spikeMag) * Math.min(1, dt * 1.4);

    // Display jitter — wild when active, completely dead while frozen
    let target;
    if (freezeTimer > 0) {
      target = complaint; // no jitter, no spike, bar sits perfectly still
    } else {
      const jitterAmp = 0.08 + intensity * 0.22 + (sensitivity > 1.5 ? 0.08 : 0);
      const jitter = (Math.random() - 0.5) * 2 * jitterAmp;
      target = Math.max(0, Math.min(1, complaint + spikeMag + jitter));
    }
    // Fast-follow so jitter reads as real shake, not smoothed mush
    displayComplaint += (target - displayComplaint) * Math.min(1, dt * 30);

    if (complaint >= 1) {
      endGame();
      return;
    }

    // Power-up multiplier decay
    if (powerMultTimer > 0) {
      powerMultTimer -= dt;
      if (powerMultTimer <= 0) {
        powerMult = 1;
        powerMultTimer = 0;
      }
    }

    // Low-energy party-over countdown:
    // when point generation drops below threshold for 0.5s, countdown 3..2..1..0 then party over
    const rate = volume * multiplier * 2; // points/sec at this moment
    if (rate < 8 && freezeTimer <= 0) {
      zeroVolumeTimer += dt;
      if (zeroVolumeTimer >= 4.5) { // 0.5s grace + 3s countdown + 1s "party over" banner
        partyOver();
        return;
      }
    } else {
      zeroVolumeTimer = 0;
    }

    // Sparks
    if (intensity >= 0.5 && Math.random() < intensity * 0.8) spawnSpark();
    sparks.forEach(s => {
      s.vy += 120 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.6;
    });
    sparks = sparks.filter(s => s.life > 0);

    // Score popups
    if (volume > 0 && Math.random() < 0.08) spawnScorePopup();
    scorePopups.forEach(p => { p.y -= 48 * dt; p.life -= dt * 0.7; });
    scorePopups = scorePopups.filter(p => p.life > 0);

    // Power-ups: spawn schedule (rarer early, more frequent later)
    if (timeElapsed >= nextPowerupAt) {
      spawnPowerup();
      const minGap = Math.max(3, 5 - stageIdx);
      const maxGap = Math.max(6, 12 - stageIdx * 2);
      nextPowerupAt = timeElapsed + minGap + Math.random() * (maxGap - minGap);
    }
    powerups.forEach(p => {
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.wobble += dt * 3;
      p.vx += Math.sin(p.wobble) * 8 * dt;
    });
    powerups = powerups.filter(p => p.y < H + 80);

    // Power-up flash decay
    if (powerupFlash > 0) powerupFlash = Math.max(0, powerupFlash - dt * 1.2);

    // Lightning
    if (intensity > 0.7 && Math.random() < dt * 1.2) lightningFlash = 1;
    lightningFlash = Math.max(0, lightningFlash - dt * 3);

    // Shake
    if (volume >= 7) {
      const mag = (volume - 6) * 1.4;
      shakeOffset.x = (Math.random() - 0.5) * mag;
      shakeOffset.y = (Math.random() - 0.5) * mag;
    } else {
      shakeOffset.x = 0; shakeOffset.y = 0;
    }

    // Crowd phase
    crowdPhase += dt * (4 + intensity * 6);

    // Stage banner
    if (stageBannerTimer > 0) stageBannerTimer -= dt;

    // DOM HUD updates
    updateHUD();
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = Math.floor(score);
    if (multiplierEl) {
      multiplierEl.textContent = 'x' + multiplier.toFixed(1);
      multiplierEl.style.color = multiplier > 3 ? '#f44' : '#fc0';
      if (powerMultTimer > 0) {
        multiplierEl.classList.add('rockster-mult-hot');
        multiplierEl.dataset.remain = powerMultTimer.toFixed(1);
      } else {
        multiplierEl.classList.remove('rockster-mult-hot');
      }
    }
    if (compBarEl) compBarEl.style.width = (displayComplaint * 100).toFixed(1) + '%';
    const mood = getNeighborMood(complaint);
    if (compBarEl) {
      if (freezeTimer > 0) {
        compBarEl.style.background = 'linear-gradient(90deg, #4fc3f7, #b3e5fc)';
      } else {
        compBarEl.style.background = `linear-gradient(90deg, ${mood.color}, ${complaint > 0.7 ? '#f00' : mood.color})`;
      }
    }
    if (compMoodEl) {
      compMoodEl.textContent = freezeTimer > 0 ? '🥶' : mood.emoji;
      compMoodEl.classList.toggle('rockster-frozen', freezeTimer > 0);
    }
    if (compLabelEl) {
      const label = sensitivity > 1.5 ? 'SENSITIVE!' : sensitivity > 1 ? 'NORMAL' : 'TOLERANT';
      compLabelEl.textContent = label;
      compLabelEl.style.color = sensitivity > 1.5 ? '#ff4444' : sensitivity > 1 ? '#ffaa00' : '#66bb6a';
    }
    if (stageLabelEl) {
      const { stage } = currentStage();
      stageLabelEl.textContent = stage.name;
    }
    if (timeEl) {
      const remain = Math.max(0, GAME_DURATION - timeElapsed);
      const m = Math.floor(remain / 60);
      const s = Math.floor(remain % 60);
      timeEl.textContent = m + ':' + String(s).padStart(2, '0');
      timeEl.classList.toggle('rockster-time-urgent', remain <= 10 && remain > 0);
    }
    if (powerMultChip) {
      if (powerMultTimer > 0) {
        powerMultChip.classList.remove('hidden');
        powerMultChip.querySelector('.chip-label').textContent = 'x' + powerMult.toFixed(1);
        powerMultChip.querySelector('.chip-time').textContent = powerMultTimer.toFixed(1) + 's';
      } else {
        powerMultChip.classList.add('hidden');
      }
    }
    if (powerFreezeChip) {
      if (freezeTimer > 0) {
        powerFreezeChip.classList.remove('hidden');
        powerFreezeChip.querySelector('.chip-time').textContent = freezeTimer.toFixed(1) + 's';
      } else {
        powerFreezeChip.classList.add('hidden');
      }
    }
  }

  /* ─── Render ─── */
  function draw() {
    if (!ctx) return;
    const intensity = volume / 11;

    // Apply shake via transform (drawn into canvas)
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // Background — darkens with volume
    const bgShade = Math.max(2, Math.floor(12 - intensity * 10));
    ctx.fillStyle = `rgb(${bgShade},${bgShade},${bgShade + 4})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Radial glow behind speaker when loud
    if (running && volume > 5) {
      const grad = ctx.createRadialGradient(W/2, H*0.38, 20, W/2, H*0.38, Math.max(W, H) * 0.55);
      const red = 50 + (1 - intensity) * 80;
      grad.addColorStop(0, `rgba(255,${Math.floor(red)},0,${intensity * 0.25})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Lightning
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(255,255,180,${lightningFlash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(255,255,0,${lightningFlash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W * 0.3, 0);
      ctx.lineTo(W * 0.25, H * 0.25);
      ctx.lineTo(W * 0.35, H * 0.28);
      ctx.lineTo(W * 0.22, H * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W * 0.7, 0);
      ctx.lineTo(W * 0.77, H * 0.22);
      ctx.lineTo(W * 0.65, H * 0.26);
      ctx.lineTo(W * 0.8, H * 0.5);
      ctx.stroke();
    }

    // Speaker dimensions (computed first so amps can anchor relative)
    const speakerCenterX = W / 2;
    const speakerCenterY = H * 0.45;
    const speakerBaseW = Math.min(620, Math.max(320, H * 0.7));

    // Side Rockster speakers on stands (left + right)
    if (running && intensity >= 0.05 && (standLoaded || speakerLoaded)) {
      const miniScale = 1 + (intensity > 0.5 ? Math.sin(crowdPhase * 2) * 0.06 : 0);
      const offsetX = speakerBaseW * 1.05;
      if (standLoaded) {
        const sideAspect = standImg.naturalHeight / standImg.naturalWidth;
        const miniW = speakerBaseW * 0.55 * miniScale;
        const miniH = miniW * sideAspect;
        // Align the speaker-portion of the stand sprite roughly with the main speaker's center
        drawStandSprite(speakerCenterX - offsetX, speakerCenterY + miniH * 0.12, miniW, miniH, intensity);
        drawStandSprite(speakerCenterX + offsetX, speakerCenterY + miniH * 0.12, miniW, miniH, intensity);
      } else {
        const miniW = speakerBaseW * 0.45 * miniScale;
        const aspectSide = speakerImg.naturalHeight / speakerImg.naturalWidth;
        const miniH = miniW * aspectSide;
        drawSideRockster(speakerCenterX - offsetX, speakerCenterY + speakerBaseW * 0.22, miniW, miniH, intensity);
        drawSideRockster(speakerCenterX + offsetX, speakerCenterY + speakerBaseW * 0.22, miniW, miniH, intensity);
      }
    }
    const pulse = running && volume > 3
      ? 1 + Math.sin(crowdPhase * 8) * 0.05 * intensity
      : (running ? 1 : 1 + Math.sin(Date.now() * 0.003) * 0.03);
    const aspect = (speakerLoaded && speakerImg.naturalWidth)
      ? speakerImg.naturalHeight / speakerImg.naturalWidth
      : 1.4;
    const sw = speakerBaseW * pulse;
    const sh = sw * aspect;

    if (speakerLoaded) {
      // Orange/red drop glow at high volume
      if (volume > 8) {
        ctx.save();
        ctx.shadowColor = `rgba(255,${Math.floor(80 - intensity * 80)},0,0.9)`;
        ctx.shadowBlur = intensity * 36;
        ctx.drawImage(speakerImg, speakerCenterX - sw/2, speakerCenterY - sh/2, sw, sh);
        ctx.restore();
      } else {
        ctx.drawImage(speakerImg, speakerCenterX - sw/2, speakerCenterY - sh/2, sw, sh);
      }
    } else {
      // Fallback rectangle
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(speakerCenterX - sw/2, speakerCenterY - sh/2, sw, sh);
      ctx.strokeStyle = '#c00';
      ctx.lineWidth = 3;
      ctx.strokeRect(speakerCenterX - sw/2, speakerCenterY - sh/2, sw, sh);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ROCKSTER XL', speakerCenterX, speakerCenterY + sh/2 - 8);
    }

    // Flames under speaker
    if (running && intensity > 0.1) {
      const flameBase = speakerCenterY + sh/2 - 4;
      const count = Math.floor(intensity * 22) + 4;
      const flameW = Math.max(7, sw * 0.028);
      const gap = Math.max(3, sw * 0.012);
      const totalW = count * flameW + (count - 1) * gap;
      let fx = speakerCenterX - totalW / 2;
      for (let i = 0; i < count; i++) {
        const fh = 18 + Math.random() * 56 * intensity;
        const g = ctx.createLinearGradient(0, flameBase - fh, 0, flameBase);
        g.addColorStop(0, '#ffff00');
        g.addColorStop(0.5, '#ff6600');
        g.addColorStop(1, '#ff0000');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.7 + intensity * 0.3;
        ctx.fillRect(fx, flameBase - fh, flameW, fh);
        ctx.globalAlpha = 1;
        fx += flameW + gap;
      }
    }

    // Sparks
    sparks.forEach(s => {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Crowd silhouettes at bottom
    if (running && intensity >= 0.15) {
      drawCrowd(intensity);
    }

    // Power-ups (falling)
    powerups.forEach(p => drawPowerup(p));

    // Score popups
    scorePopups.forEach(p => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color || '#FFD700';
      ctx.font = `bold ${p.size || 22}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;

    // Zero-volume countdown overlay
    if (running && zeroVolumeTimer > 0.5) {
      const remain = 4.5 - zeroVolumeTimer; // 3s countdown starts at 0.5s silence
      const isBanner = zeroVolumeTimer >= 3.5;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, H * 0.3, W, H * 0.4);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      if (isBanner) {
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 56px "Press Start 2P", monospace';
        ctx.fillText('PARTY OVER', W/2, H * 0.48);
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 22px "Press Start 2P", monospace';
        ctx.fillText('THE VIBES ARE DEAD', W/2, H * 0.56);
      } else {
        const n = Math.max(1, Math.ceil(remain - 1)); // shows 3,2,1
        const phase = 1 - ((remain - 1) % 1); // 0..1 within the second
        const scale = 1 + Math.sin(phase * Math.PI) * 0.25;
        ctx.fillStyle = '#ff3333';
        ctx.font = `bold ${Math.floor(120 * scale)}px "Press Start 2P", monospace`;
        ctx.fillText(String(n), W/2, H * 0.52);
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 18px "Press Start 2P", monospace';
        ctx.fillText('PARTY IS SHUTTING DOWN — TURN IT UP!', W/2, H * 0.62);
      }
      ctx.restore();
    }

    // Stage banner
    if (stageBannerTimer > 0) {
      const t = stageBannerTimer;
      const fade = t > 2 ? (2.5 - t) / 0.5 : Math.min(1, t / 0.5);
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, H * 0.15, W, 48);
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 18px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const { stage } = currentStage();
      ctx.fillText('STAGE UP: ' + stage.name, W/2, H * 0.15 + 32);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawPowerup(p) {
    const s = p.size;
    const x = p.x - s/2;
    const y = p.y - s/2;
    const type = POWERUP_TYPES.find(t => t.key === p.type) || POWERUP_TYPES[0];

    // wobble rotation
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.wobble) * 0.12);
    ctx.translate(-p.x, -p.y);

    // Pulsing glow
    const glow = 0.5 + Math.sin(p.wobble * 2) * 0.3;
    ctx.shadowColor = type.accent;
    ctx.shadowBlur = 14 * glow;

    // Pixel tile background with outer border
    ctx.fillStyle = type.bg;
    ctx.fillRect(x, y, s, s);
    ctx.shadowBlur = 0;

    // Inner frame (pixel border effect)
    ctx.strokeStyle = type.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 4, y + 4, s - 8, 4);

    // Pixel-art icon based on type
    const cx = p.x, cy = p.y;
    const px = Math.max(2, Math.floor(s / 16)); // pixel unit

    if (p.type === 'weed') {
      // Pixel cannabis leaf: 7-fingered fan, symmetric
      drawBitmap(WEED_BITMAP, cx, cy, px, type.fg, type.accent);
    } else if (p.type === 'money') {
      // Clean pixel $ sign
      drawBitmap(MONEY_BITMAP, cx, cy, px, type.fg, type.accent);
    } else if (p.type === 'mult') {
      // "x<N>" label
      ctx.fillStyle = type.fg;
      ctx.font = `bold ${Math.floor(s * 0.42)}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x' + p.multValue.toFixed(1), cx, cy);
      ctx.textBaseline = 'alphabetic';
    } else if (p.type === 'snow') {
      drawBitmap(SNOW_BITMAP, cx, cy, px, type.fg, type.accent);
    }

    // Sparkle ticks on corners
    const tw = 3;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.4 + Math.sin(p.wobble * 3) * 0.3;
    ctx.fillRect(x + s - tw - 2, y + 2, tw, tw);
    ctx.fillRect(x + 2, y + s - tw - 2, tw, tw);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawStandSprite(cx, cy, w, h, intensity) {
    const sx = cx - w / 2;
    const sy = cy - h / 2;
    if (intensity > 0.7) {
      ctx.save();
      ctx.shadowColor = `rgba(255,${Math.floor(80 - intensity * 80)},0,0.7)`;
      ctx.shadowBlur = intensity * 24;
      ctx.drawImage(standImg, sx, sy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(standImg, sx, sy, w, h);
    }
  }

  function drawSideRockster(cx, cy, w, h, intensity) {
    // Draw the speaker sprite
    const sx = cx - w / 2;
    const sy = cy - h / 2;
    if (intensity > 0.7) {
      ctx.save();
      ctx.shadowColor = `rgba(255,${Math.floor(80 - intensity * 80)},0,0.7)`;
      ctx.shadowBlur = intensity * 24;
      ctx.drawImage(speakerImg, sx, sy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(speakerImg, sx, sy, w, h);
    }

    // Pixel stand below the speaker: vertical pole + tripod base
    const standTop = sy + h - 2;
    const poleW = Math.max(4, w * 0.06);
    const poleH = h * 0.38;
    const baseY = standTop + poleH;

    // Pole
    ctx.fillStyle = '#222';
    ctx.fillRect(cx - poleW/2, standTop, poleW, poleH);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cx - poleW/2, standTop, Math.max(1, poleW * 0.3), poleH);

    // Tripod legs (3 stubby pixel legs)
    const legLen = w * 0.35;
    const legThick = Math.max(3, w * 0.04);
    ctx.fillStyle = '#1a1a1a';
    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 2);
    ctx.lineTo(cx - legLen, baseY + legThick * 2);
    ctx.lineTo(cx - legLen + legThick, baseY + legThick * 2);
    ctx.lineTo(cx + legThick * 0.5, baseY - 2);
    ctx.closePath();
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 2);
    ctx.lineTo(cx + legLen, baseY + legThick * 2);
    ctx.lineTo(cx + legLen - legThick, baseY + legThick * 2);
    ctx.lineTo(cx - legThick * 0.5, baseY - 2);
    ctx.closePath();
    ctx.fill();
    // Center leg (short, forward)
    ctx.fillRect(cx - legThick/2, baseY - 2, legThick, legThick * 2);

    // Foot caps
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(cx - legLen - 2, baseY + legThick, legThick + 4, Math.max(2, legThick * 0.6));
    ctx.fillRect(cx + legLen - legThick - 2, baseY + legThick, legThick + 4, Math.max(2, legThick * 0.6));
  }

  function drawCrowd(intensity) {
    const count = Math.floor(intensity * 22) + 3;
    const baseY = H - 6;
    const spacing = Math.min(18, W / (count + 2));
    const totalW = count * spacing;
    let cx = W/2 - totalW/2;
    for (let i = 0; i < count; i++) {
      const bounce = intensity > 0.4 ? Math.abs(Math.sin(crowdPhase + i * 0.7)) * 8 : 0;
      const armUp = intensity > 0.5 && (i % 3 === 0);
      const h = 20 + (i % 5) * 3;
      const y = baseY - bounce;
      if (armUp) {
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 2, y - h - 10, 2, 8);
      }
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx + 3, y - h, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(cx + 1, y - h, 5, h);
      cx += spacing;
    }
  }

  /* ─── Main tick ─── */
  function tick(ts) {
    if (!running) return;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    update(dt);
    draw();
    frameId = requestAnimationFrame(tick);
  }

  /* ─── Game lifecycle ─── */
  function start() {
    score = 0;
    volume = 0;
    complaint = 0;
    displayComplaint = 0;
    spikeMag = 0;
    spikeTarget = 0;
    spikeHoldUntil = 0;
    nextSpikeAt = 2;
    sensitivity = 1;
    timeElapsed = 0;
    stageIdx = 0;
    multiplier = 1;
    powerMult = 1;
    powerMultTimer = 0;
    freezeTimer = 0;
    zeroVolumeTimer = 0;
    sparks = [];
    scorePopups = [];
    powerups = [];
    nextPowerupAt = 5 + Math.random() * 7;
    lightningFlash = 0;
    stageBannerTimer = 0;
    running = true;
    paused = true;  // wait for level-intro START click
    lastTs = 0;
    updateKnobVisual();
    updateHUD();
    clearTimeout(sensTimer);
    scheduleSensitivityShift();
    resize();
    if (frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    paused = false;
    clearTimeout(sensTimer);
    if (frameId) cancelAnimationFrame(frameId);
    frameId = null;
  }

  function pause()   { paused = true; }
  function unpause() { paused = false; lastTs = 0; }

  function endGame() {
    running = false;
    clearTimeout(sensTimer);
    const final = Math.floor(score);
    if (final > highScore) {
      highScore = final;
      localStorage.setItem('rockster_hi', String(highScore));
    }
    if (onGameOver) onGameOver(final, stageIdx);
  }

  function partyOver() {
    // Different loss reason — reuse game-over screen but tag it
    const over = document.getElementById('game-over');
    const title = over && over.querySelector('.game-over-title');
    if (title) title.textContent = 'PARTY OVER';
    endGame();
    // restore title after a moment so retry shows POLICE again
    setTimeout(() => { if (title) title.textContent = '🚓 POLICE!'; }, 3000);
  }

  function timeUp() {
    running = false;
    clearTimeout(sensTimer);
    const final = Math.floor(score);
    if (final > highScore) {
      highScore = final;
      localStorage.setItem('rockster_hi', String(highScore));
    }
    if (onGameWin) onGameWin(final);
  }

  function getState() { return { running, paused, score, volume, complaint, highScore, stage: stageIdx }; }
  function getHighScore() { return highScore; }

  /* ─── Init ─── */
  function init(canvasEl, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onGameOver = callbacks.onGameOver || null;
    onGameWin  = callbacks.onGameWin  || null;
    onLevelUp  = callbacks.onLevelUp  || null;

    // Find HUD refs
    knobEl        = document.getElementById('rockster-knob');
    knobPointerEl = document.getElementById('rockster-knob-pointer');
    volValEl      = document.getElementById('rockster-vol');
    compBarEl     = document.getElementById('rockster-comp-bar');
    compLabelEl   = document.getElementById('rockster-comp-label');
    compMoodEl    = document.getElementById('rockster-comp-mood');
    multiplierEl  = document.getElementById('rockster-mult');
    scoreEl       = document.getElementById('score-display');
    stageLabelEl  = document.getElementById('rockster-stage');
    timeEl        = document.getElementById('rockster-time');
    powerMultChip   = document.getElementById('rockster-power-mult');
    powerFreezeChip = document.getElementById('rockster-power-freeze');

    preloadSpeaker();
    attachKnob();

    // Canvas click for power-ups
    canvas.addEventListener('click', (e) => handleCanvasClick(e.clientX, e.clientY));
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches[0]) handleCanvasClick(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    resize();
  }

  return { init, start, stop, pause, unpause, resize, getState, getHighScore };
})();
