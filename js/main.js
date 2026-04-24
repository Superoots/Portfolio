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
    onGameOver: (finalScore, reachedLevel) => {
      document.getElementById('go-score').textContent = finalScore;
      document.getElementById('go-level').textContent = reachedLevel + 1;
      gameOverOverlay.classList.remove('hidden');
    },
    onGameWin: (finalScore) => {
      document.getElementById('win-score').textContent = finalScore;
      gameWinOverlay.classList.remove('hidden');
    },
    onLevelUp: (newLevel) => {
      showLevelIntro(newLevel);
    },
  });

  function startGame() {
    showView('game');
    hideAllOverlays();
    Game.start(0);
    showLevelIntro(0);
  }

  function showLevelIntro(lvl) {
    levelTitle.textContent = 'LEVEL ' + (lvl + 1);
    levelTheme.textContent = 'THEME: ' + PixelBackgrounds.themeNames[lvl];
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
    Game.start(0);
    showLevelIntro(0);
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
