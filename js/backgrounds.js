/* ═══════════════════════════════════════════
   BACKGROUNDS.JS — Menu background pixel particles.
   ═══════════════════════════════════════════ */
const PixelBackgrounds = (() => {
  const P = 8; // pixel size

  function fillBase(ctx, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }

  /* MENU BACKGROUND: floating pixel particles */
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

  return { drawMenuBG };
})();
