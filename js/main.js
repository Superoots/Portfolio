/* ═══════════════════════════════════════════
   MAIN.JS — View routing, Info cards, Credits,
   and game lifecycle orchestration.
   ═══════════════════════════════════════════ */
(() => {
  'use strict';

  /* ─── View management ─── */
  const views = {
    menu:    document.getElementById('view-menu'),
    game:    document.getElementById('view-game'),
    info:    document.getElementById('view-info'),
    credits: document.getElementById('view-credits'),
    waters:  document.getElementById('view-waters'),
  };

  function showView(name) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[name].classList.add('active');
    // Stop game if navigating away
    if (name !== 'game') Game.stop();
    // Reset credits scroll if entering credits
    if (name === 'credits') resetCreditsScroll();
  }

  /* ─── Menu buttons ─── */
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio8Bit.playClick();
      const target = btn.getAttribute('data-view');
      if (target === 'game') {
        startGame();
      } else {
        showView(target);
      }
    });
  });

  /* ═══════════════════════════════════════════
     GAME LIFECYCLE
     ═══════════════════════════════════════════ */
  const gameCanvas = document.getElementById('game-canvas');
  const levelIntro = document.getElementById('level-intro');
  const levelTitle = document.getElementById('level-intro-title');
  const levelTheme = document.getElementById('level-intro-theme');
  const levelStartBtn = document.getElementById('level-start-btn');
  const gameOverOverlay = document.getElementById('game-over');
  const gameWinOverlay = document.getElementById('game-win');

  // Init game engine
  Game.init(gameCanvas, {
    onGameOver: (finalScore, reachedStage) => {
      document.getElementById('go-score').textContent = finalScore;
      document.getElementById('go-level').textContent = (reachedStage + 1);
      gameOverOverlay.classList.remove('hidden');
    },
    onGameWin: (finalScore) => {
      document.getElementById('win-score').textContent = finalScore;
      gameWinOverlay.classList.remove('hidden');
    },
    onLevelUp: (stageName) => {
      // Stage-up banner is drawn inside the canvas; no overlay needed
    },
  });

  function startGame() {
    showView('game');
    hideAllOverlays();
    Game.start();
    showIntro();
  }

  function showIntro() {
    levelTitle.textContent = 'ROCKSTER XL';
    levelTheme.textContent = 'STAGE: WARM UP';
    levelIntro.classList.remove('hidden');
  }

  levelStartBtn.addEventListener('click', () => {
    Audio8Bit.playClick();
    levelIntro.classList.add('hidden');
    Game.unpause();
  });

  // Retry
  document.getElementById('retry-btn').addEventListener('click', () => {
    Audio8Bit.playClick();
    hideAllOverlays();
    Game.start();
    showIntro();
  });

  // Game Over → Menu
  document.getElementById('go-menu-btn').addEventListener('click', () => {
    Audio8Bit.playClick();
    hideAllOverlays();
    showView('menu');
  });

  // Win → Menu
  document.getElementById('win-menu-btn').addEventListener('click', () => {
    Audio8Bit.playClick();
    hideAllOverlays();
    showView('menu');
  });

  // Win → Retry
  const retryWinBtn = document.getElementById('retry-win-btn');
  if (retryWinBtn) {
    retryWinBtn.addEventListener('click', () => {
      Audio8Bit.playClick();
      hideAllOverlays();
      Game.start();
      showIntro();
    });
  }

  // Game back button
  document.getElementById('game-back-btn').addEventListener('click', () => {
    Audio8Bit.playClick();
    Game.stop();
    hideAllOverlays();
    showView('menu');
  });

  function hideAllOverlays() {
    levelIntro.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    gameWinOverlay.classList.add('hidden');
  }

  /* ═══════════════════════════════════════════
     INFO CARDS
     ═══════════════════════════════════════════ */
  const cardsData = [
    {
      title: "WHO'S THIS GUY?",
      body: "Hey, I'm Andreas — 3/4 Greek, fully dedicated, based in Germany. I work in Data & AI by day, blast music on my Teufel Rockster XL by night, and somehow still find time to hit the gym. Welcome to my little corner of the internet.",
      icon: '👤',
    },
    {
      title: 'DATA, AI & ALL THAT JAZZ',
      body: "I work in the world of Data and AI — think models, pipelines, and the occasional existential conversation with Claude Opus 4.7. Yes, I have a favorite LLM. No, I'm not sorry about it.",
      icon: '🤖',
    },
    {
      title: 'THE SOUNDTRACK',
      body: "My playlists are a beautiful mess. One minute it's chill R&B, the next it's Greek rap, then US rap, and before you know it we're deep into metal and electro. The Teufel Rockster XL handles it all — and so do my neighbors (hopefully).",
      icon: '🎵',
    },
    {
      title: 'IRON & ASPHALT',
      body: "Gym and running keep me sane. Whether it's pushing weight or logging miles, it's where I reset. No crazy goals, no influencer nonsense — just showing up and getting it done.",
      icon: '🏋️',
    },
    {
      title: 'GREEK ROOTS, GERMAN BASE',
      body: "Born with a Greek last name nobody spells right on the first try. Living in Germany, where the trains are (sometimes) on time and the bread is undefeated. It's the best of both worlds — sun and structure.",
      icon: '🇬🇷',
    },
    {
      title: 'RANDOM FACTS & HOT TAKES',
      body: "Claude Opus 4.7 > everything else (fight me). I can go from a Metallica riff to a chill R&B vibe in one playlist. Mavroeidakos means \"son of the dark one\" — pretty metal if you ask me. And yes, the Rockster XL is basically a family member at this point.",
      icon: '🔥',
    },
  ];

  const cardsWrapper = document.getElementById('info-cards');
  cardsData.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'info-card';
    el.innerHTML = `
      <div class="card-header">
        <span class="card-header-title">${card.icon} ${card.title}</span>
        <span class="card-header-icon">▶</span>
      </div>
      <div class="card-body">
        <div class="card-body-inner">${card.body}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      Audio8Bit.playClick();
      const wasOpen = el.classList.contains('open');
      // Close all
      cardsWrapper.querySelectorAll('.info-card').forEach(c => c.classList.remove('open'));
      if (!wasOpen) el.classList.add('open');
    });
    cardsWrapper.appendChild(el);
  });

  /* ═══════════════════════════════════════════
     WATERS RANKING
     ═══════════════════════════════════════════ */
  const watersData = [
    { rank: 1, name: 'BLACK FOREST',  medal: '🥇', intensity: 10,  taste: 10,  thirst: 10,  price: 9,  overall: 9.75, note: 'THE KING. AFFORDABLE, ICONIC, PERFECT.' },
    { rank: 2, name: 'LAURETANA',     medal: '🥈', intensity: 9.5, taste: 9.5, thirst: 8,   price: 6,  overall: 8.25, note: 'ITALIAN PREMIUM. SMOOTH AND ELITE.' },
    { rank: 3, name: 'VOLVIC',        medal: '🥉', intensity: 7.5, taste: 8.5, thirst: 10,  price: 6,  overall: 8.0,  note: 'VOLCANIC FRENCH CLASSIC. A BIT PRICIER, WORTH IT.' },
    { rank: 4, name: 'ADELHOLZENER',  medal: '◆', intensity: 6,   taste: 9,   thirst: 8,   price: 7,  overall: 7.5,  note: 'BAVARIAN ALPINE PURITY.' },
    { rank: 5, name: 'VIO',           medal: '◆', intensity: 4,   taste: 8.5, thirst: 9.5, price: 7,  overall: 7.25, note: 'SOFT, CLEAN, SOLID DAILY DRIVER.' },
    { rank: 6, name: 'FIJI',          medal: '◆', intensity: 5,   taste: 7,   thirst: 9,   price: 1,  overall: 5.5,  note: 'SHIPPED HALFWAY AROUND THE WORLD. WHY.' },
    { rank: 7, name: 'GEROLSTEINER',  medal: '◆', intensity: 9,   taste: 2,   thirst: 2,   price: 7,  overall: 5.0,  note: 'TOO MUCH MINERAL. TASTES LIKE A COIN.' },
    { rank: 8, name: 'EVIAN',         medal: '◆', intensity: 3,   taste: 5,   thirst: 6,   price: 4,  overall: 4.5,  note: 'OVERPRICED. NAMED GERMANY\'S RIP-OFF OF THE MONTH 2016.' },
  ];

  function statBar(value) {
    const filled = Math.round(value);
    let color = 'var(--accent-red)';
    if (value >= 7) color = 'var(--accent-green)';
    else if (value >= 5) color = 'var(--accent-yellow)';
    let html = '<div class="stat-bar">';
    for (let i = 0; i < 10; i++) {
      html += `<span class="stat-cell" style="background:${i < filled ? color : 'var(--bg-light)'}"></span>`;
    }
    html += '</div>';
    return html;
  }

  function statRow(label, value) {
    return `
      <div class="stat-row">
        <span class="stat-label">${label}</span>
        ${statBar(value)}
        <span class="stat-value">${value}</span>
      </div>`;
  }

  const waterHero = document.getElementById('waters-hero');
  const watersList = document.getElementById('waters-list');

  const hero = watersData[0];
  waterHero.innerHTML = `
    <div class="water-rank-badge hero-badge">#${hero.rank}</div>
    <div class="water-medal hero-medal">${hero.medal}</div>
    <h3 class="water-name hero-name">${hero.name}</h3>
    <p class="water-note hero-note">${hero.note}</p>
    <div class="water-stats">
      ${statRow('INTENSITY', hero.intensity)}
      ${statRow('TASTE',     hero.taste)}
      ${statRow('THIRST',    hero.thirst)}
      ${statRow('PRICE',     hero.price)}
    </div>
    <div class="water-overall hero-overall">
      <span class="overall-label">OVERALL</span>
      <span class="overall-value">${hero.overall}/10</span>
    </div>
  `;

  watersData.slice(1).forEach(w => {
    const el = document.createElement('div');
    el.className = 'water-card';
    el.innerHTML = `
      <div class="water-rank-badge">#${w.rank}</div>
      <div class="water-medal">${w.medal}</div>
      <h4 class="water-name">${w.name}</h4>
      <p class="water-note">${w.note}</p>
      <div class="water-stats">
        ${statRow('INTENSITY', w.intensity)}
        ${statRow('TASTE',     w.taste)}
        ${statRow('THIRST',    w.thirst)}
        ${statRow('PRICE',     w.price)}
      </div>
      <div class="water-overall">
        <span class="overall-label">OVERALL</span>
        <span class="overall-value">${w.overall}/10</span>
      </div>
    `;
    watersList.appendChild(el);
  });

  /* Cursor-tracking tilt for hero + cards */
  function attachTilt(el) {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const rx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      const ry = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      el.style.setProperty('--rx', rx.toFixed(3));
      el.style.setProperty('--ry', ry.toFixed(3));
    });
    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--rx', 0);
      el.style.setProperty('--ry', 0);
    });
  }
  attachTilt(waterHero);
  watersList.querySelectorAll('.water-card').forEach(attachTilt);

  /* ═══════════════════════════════════════════
     CREDITS
     ═══════════════════════════════════════════ */
  const starfield = document.getElementById('credits-starfield');

  // Generate stars
  function generateStars() {
    starfield.innerHTML = '';
    for (let i = 0; i < 60; i++) {
      const star = document.createElement('div');
      star.className = 'credits-star';
      const size = Math.random() > 0.7 ? 3 : 2;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = (Math.random() * 2).toFixed(1) + 's';
      star.style.animationDuration = (1.5 + Math.random() * 2).toFixed(1) + 's';
      starfield.appendChild(star);
    }
  }
  generateStars();

  function resetCreditsScroll() {
    const scroll = document.getElementById('credits-scroll');
    // Force restart animation
    scroll.classList.add('paused');
    scroll.style.animation = 'none';
    // Trigger reflow
    void scroll.offsetHeight;
    scroll.style.animation = '';
    scroll.classList.remove('paused');
  }

  /* ═══════════════════════════════════════════
     MENU BACKGROUND ANIMATION
     ═══════════════════════════════════════════ */
  const menuCanvas = document.getElementById('menu-bg-canvas');
  const menuCtx = menuCanvas.getContext('2d');

  function drawMenuBg() {
    const dpr = window.devicePixelRatio || 1;
    menuCanvas.width = menuCanvas.clientWidth * dpr;
    menuCanvas.height = menuCanvas.clientHeight * dpr;
    menuCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PixelBackgrounds.drawMenuBG(menuCtx, menuCanvas.clientWidth, menuCanvas.clientHeight);
  }

  // Animate menu bg with slow refresh
  let menuAnimFrame;
  function animateMenuBg() {
    drawMenuBg();
    menuAnimFrame = setTimeout(() => requestAnimationFrame(animateMenuBg), 2000);
  }
  animateMenuBg();

  window.addEventListener('resize', () => {
    drawMenuBg();
    if (Game.getState().running) Game.resize();
  });

  /* ─── Initial state ─── */
  showView('menu');

})();
