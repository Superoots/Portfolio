/* ═══════════════════════════════════════════
   MAIN.JS — View routing, Info cards, Credits,
   and game lifecycle orchestration.
   ═══════════════════════════════════════════ */
(() => {
  'use strict';

  /* ═══════════════════════════════════════════
     COINS + SHOP (persistent, localStorage-backed)
     ═══════════════════════════════════════════ */
  const Coins = (() => {
    let balance = +(localStorage.getItem('rockster_coins') || 0);
    const listeners = [];
    function save() { localStorage.setItem('rockster_coins', String(balance)); notify(); }
    function notify() { listeners.forEach(fn => fn(balance)); }
    return {
      get: () => balance,
      add: (n) => { balance += n; save(); },
      spend: (n) => { if (balance < n) return false; balance -= n; save(); return true; },
      onChange: (fn) => { listeners.push(fn); fn(balance); },
    };
  })();

  const Shop = (() => {
    const ITEMS = [
      // Speakers — stackable, cap 4
      { id: 'rockster_go',    category: 'speaker', cost: 500,  cap: 4, name: 'ROCKSTER GO',    desc: 'Tiny speaker. Max +3 pts/s at full volume. Stack up to 4.',  maxPts: 3,  sprite: 'assets/rockster_go.png' },
      { id: 'rockster_cross', category: 'speaker', cost: 1000, cap: 4, name: 'ROCKSTER CROSS', desc: 'Mid-size speaker. Max +8 pts/s. Stack up to 4.',             maxPts: 8,  sprite: 'assets/rockster_cross.png' },
      { id: 'rockster_xl2',   category: 'speaker', cost: 2500, cap: 4, name: 'ROCKSTER XL+',   desc: 'Another full XL. Max +15 pts/s. Stack up to 4.',             maxPts: 15, sprite: 'assets/rockster.png' },
      // Multiplier floor — tier, cap 1, lower tiers auto-superseded
      { id: 'mult_floor_2',   category: 'mult_floor', cost: 1500, cap: 1, name: 'MULTIPLIER FLOOR x2.0', desc: 'Your multiplier never drops below 2.0.', floor: 2.0 },
      { id: 'mult_floor_3',   category: 'mult_floor', cost: 3500, cap: 1, name: 'MULTIPLIER FLOOR x3.0', desc: 'Your multiplier never drops below 3.0.', floor: 3.0 },
      { id: 'mult_floor_4',   category: 'mult_floor', cost: 5000, cap: 1, name: 'MULTIPLIER FLOOR x4.0', desc: 'Your multiplier never drops below 4.0.', floor: 4.0 },
      // Consumable — Second Chance (stack up to 8)
      { id: 'second_chance',  category: 'consumable', cost: 2000, cap: 8, name: 'SECOND CHANCE', desc: 'Revive on game over with complaint at 50%. Timer pauses. One use per purchase. Stack up to 8.' },
      // Backdrops — own once, equip from shop
      { id: 'backdrop_party',        category: 'backdrop', cost: 300, cap: 1, name: 'BACKDROP: PARTY FLOOR',  desc: 'Throw a proper house party.',   sprite: 'assets/backdrop_party.png' },
      { id: 'backdrop_th_rosenheim', category: 'backdrop', cost: 300, cap: 1, name: 'BACKDROP: TH ROSENHEIM', desc: 'Rock the Rosenheim campus.',    sprite: 'assets/backdrop_th_rosenheim.png' },
    ];

    function loadOwned() {
      const raw = localStorage.getItem('rockster_owned');
      if (!raw) return {};
      try {
        const parsed = JSON.parse(raw);
        // Migrate old array-of-ids format -> { id: 1 }
        if (Array.isArray(parsed)) {
          const obj = {};
          parsed.forEach(id => { obj[id] = 1; });
          return obj;
        }
        if (parsed && typeof parsed === 'object') return parsed;
      } catch { /* ignore */ }
      return {};
    }
    let owned = loadOwned(); // { id: count }
    function save() { localStorage.setItem('rockster_owned', JSON.stringify(owned)); }

    let equippedBackdrop = localStorage.getItem('rockster_backdrop') || '';
    function saveEquipped() { localStorage.setItem('rockster_backdrop', equippedBackdrop); }

    return {
      items: ITEMS,
      getItem: (id) => ITEMS.find(i => i.id === id),
      count:  (id) => owned[id] || 0,
      owns:   (id) => (owned[id] || 0) > 0,
      ownedSpeakers: () => ITEMS
        .filter(i => i.category === 'speaker' && (owned[i.id] || 0) > 0)
        .map(item => ({ item, count: owned[item.id] })),
      currentMultFloor: () => {
        let max = 1;
        ITEMS.filter(i => i.category === 'mult_floor' && (owned[i.id] || 0) > 0)
          .forEach(i => { if (i.floor > max) max = i.floor; });
        return max;
      },
      // Backdrop management
      equippedBackdrop: () => equippedBackdrop,
      equipBackdrop: (id) => { equippedBackdrop = id || ''; saveEquipped(); },
      // Consumable use
      useOne: (id) => {
        if ((owned[id] || 0) <= 0) return false;
        owned[id] -= 1;
        if (owned[id] <= 0) delete owned[id];
        save();
        return true;
      },
      buy: (id) => {
        const item = ITEMS.find(i => i.id === id);
        if (!item) return false;
        const current = owned[item.id] || 0;
        if (current >= item.cap) return false;
        if (!Coins.spend(item.cost)) return false;
        owned[item.id] = current + 1;
        save();
        return true;
      },
    };
  })();
  window.Shop = Shop;
  window.Coins = Coins;

  /* ─── Coin displays (menu + game HUD) ─── */
  const menuCoinVal = document.getElementById('menu-coin-value');
  const gameCoinVal = document.getElementById('game-coin-value');
  const shopCoinVal = document.getElementById('shop-coin-value');
  Coins.onChange((n) => {
    if (menuCoinVal) menuCoinVal.textContent = n.toLocaleString();
    if (gameCoinVal) gameCoinVal.textContent = n.toLocaleString();
    if (shopCoinVal) shopCoinVal.textContent = n.toLocaleString();
  });

  /* ─── Shop UI ─── */
  const shopModal = document.getElementById('shop-modal');
  const shopCloseBtn = document.getElementById('shop-close-btn');
  const menuShopBtn = document.getElementById('menu-shop-btn');

  function renderShop() {
    const speakersEl = document.getElementById('shop-grid-speakers');
    const multEl     = document.getElementById('shop-grid-mult');
    const consEl     = document.getElementById('shop-grid-consumables');
    const bdEl       = document.getElementById('shop-grid-backdrops');
    if (!speakersEl || !multEl) return;
    [speakersEl, multEl, consEl, bdEl].forEach(el => { if (el) el.innerHTML = ''; });
    const currentFloor = Shop.currentMultFloor();
    const equipped = Shop.equippedBackdrop();

    const hostFor = (cat) => cat === 'speaker' ? speakersEl
                          : cat === 'mult_floor' ? multEl
                          : cat === 'consumable' ? consEl
                          : cat === 'backdrop'   ? bdEl
                          : speakersEl;

    Shop.items.forEach(item => {
      const host = hostFor(item.category);
      if (!host) return;
      const cnt = Shop.count(item.id);
      const atCap = cnt >= item.cap;
      const affordable = Coins.get() >= item.cost;
      const superseded = item.category === 'mult_floor' && item.floor <= currentFloor && cnt === 0;

      const el = document.createElement('div');
      el.className = 'shop-item'
        + (cnt > 0 ? ' owned' : '')
        + (superseded ? ' superseded' : '');

      const spriteHtml = item.sprite
        ? `<img class="shop-sprite" src="${item.sprite}" alt="${item.name}">`
        : item.category === 'mult_floor'
          ? `<div class="shop-sprite shop-sprite-mult">x${item.floor.toFixed(1)}</div>`
          : item.category === 'consumable'
            ? `<div class="shop-sprite shop-sprite-consumable">💫</div>`
            : '';

      // Count / cap badge
      let badge = '';
      if (item.cap > 1 && cnt > 0) {
        badge = `<div class="shop-item-count">OWNED ×${cnt}${cnt >= item.cap ? ' (MAX)' : ''}</div>`;
      } else if (item.cap === 1 && cnt > 0 && item.category !== 'backdrop') {
        badge = `<div class="shop-item-count">OWNED</div>`;
      }

      // Button label
      let btnLabel;
      if (superseded)    btnLabel = 'SUPERSEDED';
      else if (atCap)    btnLabel = item.category === 'backdrop' ? 'OWNED' : 'MAX OWNED';
      else if (cnt > 0 && item.cap > 1) btnLabel = `BUY ANOTHER &bull; 🪙 ${item.cost.toLocaleString()}`;
      else               btnLabel = `BUY &bull; 🪙 ${item.cost.toLocaleString()}`;

      // Backdrop equip UI
      let equipHtml = '';
      if (item.category === 'backdrop' && cnt > 0) {
        const isEq = equipped === item.id;
        equipHtml = `<button class="shop-equip-btn pixel-btn" data-equip="${item.id}">${isEq ? '★ EQUIPPED' : 'EQUIP'}</button>`;
      }

      el.innerHTML = `
        ${spriteHtml}
        <div class="shop-item-name">${item.name}</div>
        ${badge}
        <div class="shop-item-desc">${item.desc}</div>
        <button class="shop-buy-btn pixel-btn" ${atCap || !affordable || superseded ? 'disabled' : ''}>
          ${btnLabel}
        </button>
        ${equipHtml}
      `;
      const btn = el.querySelector('.shop-buy-btn');
      if (!atCap && !superseded) {
        btn.addEventListener('click', () => {
          Audio8Bit.playClick();
          if (Shop.buy(item.id)) renderShop();
        });
      }
      const eqBtn = el.querySelector('.shop-equip-btn');
      if (eqBtn) {
        eqBtn.addEventListener('click', () => {
          Audio8Bit.playClick();
          if (equipped === item.id) Shop.equipBackdrop(''); // unequip
          else Shop.equipBackdrop(item.id);
          renderShop();
        });
      }
      host.appendChild(el);
    });

    // Equip "no backdrop" option if user has any backdrop + current equipped
    if (bdEl && equipped) {
      const el = document.createElement('div');
      el.className = 'shop-item shop-backdrop-none';
      el.innerHTML = `
        <div class="shop-sprite shop-sprite-none">—</div>
        <div class="shop-item-name">NO BACKDROP</div>
        <div class="shop-item-desc">Back to the classic dark stage.</div>
        <button class="shop-equip-btn pixel-btn">EQUIP DEFAULT</button>
      `;
      el.querySelector('.shop-equip-btn').addEventListener('click', () => {
        Audio8Bit.playClick();
        Shop.equipBackdrop('');
        renderShop();
      });
      bdEl.appendChild(el);
    }
  }

  function openShop() {
    Audio8Bit.playClick();
    renderShop();
    shopModal.classList.remove('hidden');
  }
  function closeShop() {
    Audio8Bit.playClick();
    shopModal.classList.add('hidden');
  }
  if (menuShopBtn)  menuShopBtn.addEventListener('click', openShop);
  if (shopCloseBtn) shopCloseBtn.addEventListener('click', closeShop);
  if (shopModal) shopModal.addEventListener('click', (e) => { if (e.target === shopModal) closeShop(); });

  /* ─── Secret page gate ─── */
  const SECRET_COST = 10000;
  const secretBtn = document.getElementById('secret-btn');
  const secretLabel = document.getElementById('secret-label');

  function isSecretUnlocked() { return localStorage.getItem('rockster_secret_unlocked') === '1'; }
  function updateSecretLabel() {
    if (!secretLabel) return;
    if (isSecretUnlocked()) {
      secretLabel.textContent = '🎆 SECRET PAGE';
    } else {
      secretLabel.textContent = `🔒 SECRET · 10,000 🪙`;
    }
  }
  updateSecretLabel();
  Coins.onChange(() => updateSecretLabel());

  if (secretBtn) {
    secretBtn.addEventListener('click', () => {
      Audio8Bit.playClick();
      if (isSecretUnlocked()) { showView('secret'); return; }
      if (Coins.get() < SECRET_COST) {
        // shake + feedback
        secretBtn.classList.remove('shake');
        void secretBtn.offsetWidth; // force reflow
        secretBtn.classList.add('shake');
        secretLabel.textContent = `💸 NOT ENOUGH COINS (${Coins.get().toLocaleString()}/10,000)`;
        setTimeout(() => updateSecretLabel(), 1600);
        return;
      }
      // Confirm unlock
      const sure = confirm('SPEND 10,000 COINS TO UNLOCK THE SECRET PAGE?');
      if (!sure) return;
      if (!Coins.spend(SECRET_COST)) return;
      localStorage.setItem('rockster_secret_unlocked', '1');
      updateSecretLabel();
      showView('secret');
    });
  }

  /* ─── Revive (Second Chance) overlay buttons ─── */
  const reviveYes = document.getElementById('revive-yes-btn');
  const reviveNo  = document.getElementById('revive-no-btn');
  if (reviveYes) reviveYes.addEventListener('click', () => {
    Audio8Bit.playClick();
    if (window._roksterRevive) window._roksterRevive.accept();
  });
  if (reviveNo) reviveNo.addEventListener('click', () => {
    Audio8Bit.playClick();
    if (window._roksterRevive) window._roksterRevive.decline();
  });

  /* ─── View management ─── */
  const views = {
    menu:    document.getElementById('view-menu'),
    game:    document.getElementById('view-game'),
    info:    document.getElementById('view-info'),
    credits: document.getElementById('view-credits'),
    waters:  document.getElementById('view-waters'),
    secret:  document.getElementById('view-secret'),
  };

  function showView(name) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[name].classList.add('active');
    // Stop game if navigating away
    if (name !== 'game') Game.stop();
    // Reset credits scroll if entering credits
    if (name === 'credits') resetCreditsScroll();
    // Orientation lock is only enforced while playing
    document.body.classList.toggle('game-active', name === 'game');
  }

  /* ─── Menu buttons ─── */
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio8Bit.playClick();
      const target = btn.getAttribute('data-view');
      if (target === 'game') {
        maybeShowHowTo(startGame);
      } else {
        showView(target);
      }
    });
  });

  /* ─── How-to overlay ─── */
  const howToEl = document.getElementById('how-to-play');
  const howToStartBtn = document.getElementById('howto-start-btn');
  const howToSkipBox = document.getElementById('howto-skip');
  let howToOnStart = null;

  function maybeShowHowTo(onStart) {
    if (localStorage.getItem('rockster_skip_howto') === '1') {
      onStart();
      return;
    }
    howToOnStart = onStart;
    howToEl.classList.remove('hidden');
  }

  howToStartBtn.addEventListener('click', () => {
    Audio8Bit.playClick();
    if (howToSkipBox.checked) localStorage.setItem('rockster_skip_howto', '1');
    howToEl.classList.add('hidden');
    if (howToOnStart) howToOnStart();
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
      title: 'PROJECTS & TESTING',
      body: "Right now I'm in project management with a focus on testing. I enjoy the exchange with customers and the satisfaction of helping devs track down and fix the weird stuff. Bridging the gap between \"it works on my machine\" and \"it works in production\" is the sweet spot.",
      icon: '🧪',
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
    {
      title: 'WATER TASTE TESTING GUIDE',
      icon: '💧',
      special: true,
      body: `
        <p class="guide-intro">Thinking about ranking waters yourself? Here's the house rules:</p>
        <div class="guide-tip">
          <span class="guide-num">1</span>
          <div>
            <h4 class="guide-tip-title">NOT TOO WARM, NOT TOO COLD</h4>
            <p class="guide-tip-body">Ice-cold numbs your tongue and masks the minerals. Room temp hides nothing — that's where the real flavor lives. Aim for lightly chilled: ~10–15°C.</p>
          </div>
        </div>
        <div class="guide-tip">
          <span class="guide-num">2</span>
          <div>
            <h4 class="guide-tip-title">CLEAN PALATE OR NO DEAL</h4>
            <p class="guide-tip-body">No coffee, no food, no toothpaste aftertaste. Anything lingering will overpower the subtle differences between waters. Rinse with a neutral water first if needed.</p>
          </div>
        </div>
        <div class="guide-tip">
          <span class="guide-num">3</span>
          <div>
            <h4 class="guide-tip-title">DRINK FROM THE CONTAINER</h4>
            <p class="guide-tip-body">Glasses add their own neutral edge. For the full experience, taste straight from the bottle — it's how the brand intended it. Smell, sip, let it sit a second, then swallow.</p>
          </div>
        </div>
        <p class="guide-outro">Now go forth and rank responsibly.</p>
      `,
    },
  ];

  const cardsWrapper = document.getElementById('info-cards');
  cardsData.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'info-card' + (card.special ? ' info-card-special' : '');
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
    { rank: 4, name: 'SANTA EMILIA',  medal: '◆', intensity: 3,   taste: 8,   thirst: 9,   price: 5,  overall: 7.75, note: 'ONE OF THE CLEANEST, FRESHEST WATERS I KNOW.' },
    { rank: 5, name: 'ADELHOLZENER',  medal: '◆', intensity: 6,   taste: 9,   thirst: 8,   price: 7,  overall: 7.5,  note: 'BAVARIAN ALPINE PURITY.' },
    { rank: 6, name: 'VIO',           medal: '◆', intensity: 4,   taste: 8.5, thirst: 9.5, price: 7,  overall: 7.25, note: 'SOFT, CLEAN, SOLID DAILY DRIVER.' },
    { rank: 7, name: 'FIJI',          medal: '◆', intensity: 5,   taste: 7,   thirst: 9,   price: 1,  overall: 5.5,  note: 'SHIPPED HALFWAY AROUND THE WORLD. WHY.' },
    { rank: 8, name: 'GEROLSTEINER',  medal: '◆', intensity: 9,   taste: 2,   thirst: 2,   price: 7,  overall: 5.0,  note: 'TOO MUCH MINERAL. TASTES LIKE A COIN.' },
    { rank: 9, name: 'EVIAN',         medal: '◆', intensity: 3,   taste: 5,   thirst: 6,   price: 4,  overall: 4.5,  note: 'OVERPRICED. NAMED GERMANY\'S RIP-OFF OF THE MONTH 2016.' },
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
