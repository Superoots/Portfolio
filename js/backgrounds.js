/* ═══════════════════════════════════════════
   BACKGROUNDS.JS — Canvas pixel-art background
   generators for each level theme.
   All drawing uses an 8×8 or 16×16 "pixel" grid.
   ═══════════════════════════════════════════ */
const PixelBackgrounds = (() => {
  const P = 8; // pixel size

  /* Helper: draw a filled rect in "pixel" units */
  function pr(ctx, px, py, pw, ph, color) {
    ctx.fillStyle = color;
    ctx.fillRect(px * P, py * P, pw * P, ph * P);
  }

  /* Helper: fill entire canvas with base color */
  function fillBase(ctx, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }

  /* ───── LEVEL 1: PC / DESKTOP ───── */
  function drawPC(ctx, w, h) {
    fillBase(ctx, w, h, '#1a1a2e');
    const cols = Math.ceil(w / P);
    const rows = Math.ceil(h / P);

    // Desk surface (bottom third)
    const deskY = Math.floor(rows * 0.7);
    pr(ctx, 0, deskY, cols, rows - deskY, '#5c3d2e');
    pr(ctx, 0, deskY, cols, 1, '#7a5440');

    // Monitor
    const mw = 20, mh = 14;
    const mx = Math.floor(cols / 2 - mw / 2);
    const my = deskY - mh - 4;
    // Bezel
    pr(ctx, mx, my, mw, mh, '#333');
    // Screen
    pr(ctx, mx + 1, my + 1, mw - 2, mh - 2, '#0f3460');
    // Screen content - text lines
    for (let i = 0; i < 5; i++) {
      const lineW = 4 + Math.floor(Math.random() * 10);
      pr(ctx, mx + 2, my + 2 + i * 2, Math.min(lineW, mw - 4), 1, '#00f5d4');
    }
    // Stand
    pr(ctx, mx + mw / 2 - 1, my + mh, 2, 3, '#555');
    pr(ctx, mx + mw / 2 - 3, my + mh + 3, 6, 1, '#555');

    // Keyboard
    const kw = 14, kh = 3;
    const kx = Math.floor(cols / 2 - kw / 2);
    const ky = deskY - 2;
    pr(ctx, kx, ky, kw, kh, '#444');
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 12; c++) {
        if (Math.random() > 0.2) {
          pr(ctx, kx + 1 + c, ky + r + 0.5, 0.8, 0.8, '#888');
        }
      }
    }

    // Mouse
    pr(ctx, kx + kw + 3, ky, 2, 3, '#666');
    pr(ctx, kx + kw + 3, ky, 2, 1, '#888');

    // Small decorative pixels (dust/particles)
    for (let i = 0; i < 30; i++) {
      const sx = Math.floor(Math.random() * cols);
      const sy = Math.floor(Math.random() * (deskY - 2));
      if (Math.random() > 0.5) {
        pr(ctx, sx, sy, 1, 1, 'rgba(0,245,212,0.08)');
      }
    }
  }

  /* ───── LEVEL 2: IT / SERVERS ───── */
  function drawIT(ctx, w, h) {
    fillBase(ctx, w, h, '#0a0a1a');
    const cols = Math.ceil(w / P);
    const rows = Math.ceil(h / P);

    // Draw server racks
    const rackCount = Math.max(2, Math.floor(cols / 18));
    for (let r = 0; r < rackCount; r++) {
      const rx = 4 + r * Math.floor((cols - 8) / rackCount);
      const ry = 4;
      const rw = 12;
      const rh = rows - 8;

      // Rack body
      pr(ctx, rx, ry, rw, rh, '#1a1a2e');
      pr(ctx, rx, ry, rw, 1, '#333');
      pr(ctx, rx, ry + rh - 1, rw, 1, '#333');
      pr(ctx, rx, ry, 1, rh, '#333');
      pr(ctx, rx + rw - 1, ry, 1, rh, '#333');

      // Server units
      for (let u = 0; u < Math.floor(rh / 3) - 1; u++) {
        const uy = ry + 2 + u * 3;
        pr(ctx, rx + 1, uy, rw - 2, 2, '#252545');
        // LED lights
        const ledColor = Math.random() > 0.3 ? '#80ed99' : '#e63946';
        pr(ctx, rx + 2, uy + 0.5, 0.8, 0.8, ledColor);
        // Drive bays
        for (let d = 0; d < 3; d++) {
          pr(ctx, rx + 4 + d * 2, uy + 0.5, 1.5, 1, '#333');
        }
      }
    }

    // Blinking small dots (network activity)
    for (let i = 0; i < 50; i++) {
      const sx = Math.floor(Math.random() * cols);
      const sy = Math.floor(Math.random() * rows);
      const c = Math.random() > 0.5 ? 'rgba(128,237,153,0.15)' : 'rgba(0,245,212,0.1)';
      pr(ctx, sx, sy, 1, 1, c);
    }

    // Floor
    pr(ctx, 0, rows - 3, cols, 3, '#111128');
    // Floor tiles
    for (let t = 0; t < cols; t += 4) {
      pr(ctx, t, rows - 3, 1, 3, '#1a1a3e');
    }
  }

  /* ───── LEVEL 3: GAMING ───── */
  function drawGaming(ctx, w, h) {
    fillBase(ctx, w, h, '#16082e');
    const cols = Math.ceil(w / P);
    const rows = Math.ceil(h / P);

    // Arcade machine (center-left)
    const ax = Math.floor(cols * 0.15);
    const ay = Math.floor(rows * 0.2);
    const aw = 14, ah = Math.floor(rows * 0.65);
    // Body
    pr(ctx, ax, ay, aw, ah, '#2a1050');
    pr(ctx, ax + 1, ay + 1, aw - 2, 1, '#c77dff');
    // Screen
    pr(ctx, ax + 2, ay + 4, aw - 4, 10, '#0f3460');
    // Screen content — simple space invader
    pr(ctx, ax + 4, ay + 6, 1, 1, '#80ed99');
    pr(ctx, ax + 6, ay + 6, 1, 1, '#80ed99');
    pr(ctx, ax + 5, ay + 7, 1, 1, '#80ed99');
    pr(ctx, ax + 4, ay + 8, 3, 1, '#80ed99');
    pr(ctx, ax + 3, ay + 9, 1, 1, '#80ed99');
    pr(ctx, ax + 7, ay + 9, 1, 1, '#80ed99');
    // Player ship
    pr(ctx, ax + 5, ay + 12, 1, 1, '#e63946');
    pr(ctx, ax + 4, ay + 13, 3, 1, '#e63946');
    // Joystick area
    pr(ctx, ax + 3, ay + 16, aw - 6, 5, '#1a0a30');
    pr(ctx, ax + 5, ay + 17, 1, 2, '#f4d35e');
    // Buttons
    pr(ctx, ax + 8, ay + 17, 2, 2, '#e63946');
    pr(ctx, ax + 10, ay + 18, 2, 2, '#00f5d4');

    // Controller (center-right)
    const cx2 = Math.floor(cols * 0.6);
    const cy2 = Math.floor(rows * 0.55);
    // Body
    pr(ctx, cx2, cy2, 16, 8, '#333');
    pr(ctx, cx2 + 1, cy2 - 1, 14, 1, '#444');
    pr(ctx, cx2 + 1, cy2 + 8, 14, 1, '#222');
    // D-pad
    pr(ctx, cx2 + 2, cy2 + 3, 3, 1, '#555');
    pr(ctx, cx2 + 3, cy2 + 2, 1, 3, '#555');
    // Buttons
    pr(ctx, cx2 + 11, cy2 + 2, 2, 2, '#e63946');
    pr(ctx, cx2 + 13, cy2 + 3, 2, 2, '#00f5d4');
    pr(ctx, cx2 + 10, cy2 + 4, 2, 2, '#f4d35e');

    // Stars/particles
    for (let i = 0; i < 40; i++) {
      const sx = Math.floor(Math.random() * cols);
      const sy = Math.floor(Math.random() * rows);
      const colors = ['#c77dff', '#e63946', '#00f5d4', '#f4d35e'];
      pr(ctx, sx, sy, 1, 1, colors[Math.floor(Math.random() * colors.length)] + '22');
    }

    // Floor
    pr(ctx, 0, rows - 2, cols, 2, '#0f0520');
  }

  /* ───── LEVEL 4: MUSIC ───── */
  function drawMusic(ctx, w, h) {
    fillBase(ctx, w, h, '#1a0a2e');
    const cols = Math.ceil(w / P);
    const rows = Math.ceil(h / P);

    // Big speaker (Rockster XL tribute)
    const sx = Math.floor(cols / 2 - 10);
    const sy = Math.floor(rows * 0.25);
    const sw = 20, sh = 24;
    // Body
    pr(ctx, sx, sy, sw, sh, '#222');
    pr(ctx, sx + 1, sy + 1, sw - 2, sh - 2, '#2a2a2a');
    // Big woofer
    const wcx = sx + sw / 2;
    const wcy = sy + sh / 2 + 2;
    for (let ring = 6; ring >= 0; ring--) {
      const c = ring % 2 === 0 ? '#444' : '#333';
      pr(ctx, wcx - ring, wcy - ring, ring * 2, ring * 2, c);
    }
    pr(ctx, wcx - 1, wcy - 1, 2, 2, '#555');
    // Tweeter
    pr(ctx, wcx - 2, sy + 3, 4, 4, '#3a3a3a');
    pr(ctx, wcx - 1, sy + 4, 2, 2, '#555');
    // Grille lines
    for (let g = 0; g < sh; g += 2) {
      pr(ctx, sx + 1, sy + g + 1, sw - 2, 0.3, 'rgba(255,255,255,0.05)');
    }

    // Music notes floating around
    const notePositions = [
      [sx - 8, sy + 5], [sx + sw + 4, sy + 3],
      [sx - 5, sy + 15], [sx + sw + 7, sy + 12],
      [sx + sw + 2, sy + 20], [sx - 10, sy + 22],
    ];
    notePositions.forEach(([nx, ny]) => {
      if (nx >= 0 && nx < cols - 2 && ny >= 0 && ny < rows - 3) {
        // Note stem
        pr(ctx, nx + 1, ny, 0.5, 3, '#f4d35e');
        // Note head
        pr(ctx, nx, ny + 2, 2, 1, '#f4d35e');
      }
    });

    // Sound wave lines (emanating from speaker)
    for (let wave = 1; wave <= 3; wave++) {
      const wOff = sw / 2 + 4 + wave * 4;
      for (let wy = -3; wy <= 3; wy++) {
        const alpha = (0.3 - wave * 0.08).toFixed(2);
        pr(ctx, sx + wOff, wcy + wy, 1, 1, `rgba(199,125,255,${alpha})`);
        pr(ctx, sx - 4 - wave * 4, wcy + wy, 1, 1, `rgba(199,125,255,${alpha})`);
      }
    }

    // Equalizer bars at bottom
    const eqY = rows - 6;
    for (let b = 0; b < cols; b += 3) {
      const bh = 1 + Math.floor(Math.random() * 5);
      const colors = ['#e63946', '#f4d35e', '#80ed99', '#00f5d4', '#c77dff'];
      pr(ctx, b, eqY + (5 - bh), 2, bh, colors[Math.floor(Math.random() * colors.length)]);
    }
  }

  /* ───── LEVEL 5: GYM ───── */
  function drawGym(ctx, w, h) {
    fillBase(ctx, w, h, '#1a1a1a');
    const cols = Math.ceil(w / P);
    const rows = Math.ceil(h / P);

    // Floor
    const floorY = Math.floor(rows * 0.78);
    pr(ctx, 0, floorY, cols, rows - floorY, '#2a2a2a');
    // Floor lines
    for (let fl = 0; fl < cols; fl += 6) {
      pr(ctx, fl, floorY, 0.5, rows - floorY, '#333');
    }

    // Barbell rack (left side)
    const rx = 4;
    const ry = floorY - 16;
    // Uprights
    pr(ctx, rx, ry, 1, 16, '#888');
    pr(ctx, rx + 10, ry, 1, 16, '#888');
    // Cross bar
    pr(ctx, rx, ry, 11, 1, '#888');
    // Barbell
    pr(ctx, rx - 2, ry + 4, 2, 2, '#e63946'); // left plate
    pr(ctx, rx, ry + 4.5, 11, 1, '#aaa');      // bar
    pr(ctx, rx + 11, ry + 4, 2, 2, '#e63946'); // right plate

    // Dumbbell on floor (center)
    const dx = Math.floor(cols / 2) - 4;
    const dy = floorY - 3;
    pr(ctx, dx, dy + 1, 2, 2, '#555');
    pr(ctx, dx + 2, dy + 1.5, 5, 1, '#aaa');
    pr(ctx, dx + 7, dy + 1, 2, 2, '#555');

    // Running track / treadmill (right side)
    const tx = Math.floor(cols * 0.65);
    const ty = floorY - 14;
    // Frame
    pr(ctx, tx, ty, 2, 14, '#666');
    pr(ctx, tx + 10, ty + 4, 2, 10, '#666');
    // Console
    pr(ctx, tx, ty, 12, 3, '#444');
    pr(ctx, tx + 2, ty + 0.5, 3, 2, '#0f3460'); // screen
    pr(ctx, tx + 3, ty + 1, 1, 1, '#80ed99');    // number on screen
    // Belt
    pr(ctx, tx + 1, ty + 6, 11, 7, '#333');
    for (let s = 0; s < 5; s++) {
      pr(ctx, tx + 1, ty + 6 + s * 1.5, 11, 0.5, '#3a3a3a');
    }

    // Motivational floating pixels
    for (let i = 0; i < 20; i++) {
      const px2 = Math.floor(Math.random() * cols);
      const py2 = Math.floor(Math.random() * (floorY - 4));
      const c = Math.random() > 0.5 ? 'rgba(230,57,70,0.1)' : 'rgba(128,237,153,0.08)';
      pr(ctx, px2, py2, 1, 1, c);
    }
  }

  /* ───── MENU BACKGROUND: floating pixel particles ───── */
  function drawMenuBG(ctx, w, h) {
    fillBase(ctx, w, h, '#1a1a2e');
    const cols = Math.ceil(w / P);
    const rows = Math.ceil(h / P);
    const colors = ['#e63946', '#f4d35e', '#00f5d4', '#80ed99', '#c77dff', '#ff9f1c'];
    for (let i = 0; i < 80; i++) {
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);
      const ci = Math.floor(Math.random() * colors.length);
      const a = (0.05 + Math.random() * 0.15).toFixed(2);
      ctx.fillStyle = colors[ci];
      ctx.globalAlpha = parseFloat(a);
      ctx.fillRect(x * P, y * P, P, P);
    }
    ctx.globalAlpha = 1;
  }

  /** Array of level drawers indexed 0-4 */
  const levelDrawers = [drawPC, drawIT, drawGaming, drawMusic, drawGym];
  const themeNames = ['PC', 'IT', 'GAMING', 'MUSIC', 'GYM'];

  return { levelDrawers, themeNames, drawMenuBG };
})();
