/* PuzzleX — light / dark theme toggle, carried by a puzzle wipe:
   pieces in the new theme's colour assemble across the screen from the button outwards,
   the theme flips underneath while it's covered, then the pieces lift away the same way.
   Uses rng, piecePath, DPR, LIME, REDUCED, playClick, heroPieceSize from main.js. */

(function initTheme() {
  const root = document.documentElement;
  const KEY = 'puzzlex-theme';
  const BG = { dark: '#0a0a0b', light: '#efefe9' };
  const SEAM = { dark: 'rgba(215,255,0,.55)', light: 'rgba(110,140,0,.55)' };
  const btn = document.querySelector('.theme-toggle');
  let busy = false;

  const label = (theme) => {
    btn.setAttribute('aria-pressed', String(theme === 'light'));
    btn.setAttribute('aria-label', theme === 'light' ? T('الوضع الداكن', 'Dark mode') : T('الوضع الفاتح', 'Light mode'));
  };
  label(root.dataset.theme);

  function apply(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: the choice just isn't remembered */ }
    label(theme);
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }

  btn.addEventListener('click', () => {
    if (busy) return;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    if (REDUCED) { apply(next); return; }
    busy = true;
    puzzleWipe(next, () => apply(next)).then(() => { busy = false; });
  });

  function puzzleWipe(next, onCovered) {
    return new Promise((resolve) => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const cv = document.createElement('canvas');
      cv.className = 'theme-wipe';
      cv.width = Math.round(vw * DPR);
      cv.height = Math.round(vh * DPR);
      document.body.appendChild(cv);
      const g = cv.getContext('2d');

      // an interlocking grid covering the screen, with the hero's piece size and lined up with the hero board,
      // so the wipe's pieces land exactly on the hero's own
      const size = heroPieceSize || Math.round(Math.max(64, Math.min(120, Math.min(vw, vh) / 6)));
      const board = document.querySelector('.board'); // only the home page has the hero board
      const br = board ? board.getBoundingClientRect() : { left: (vw % size) / 2, top: (vh % size) / 2 };
      const ox = br.left - Math.ceil(br.left / size) * size;
      const oy = br.top - Math.ceil(br.top / size) * size;
      const cols = Math.ceil((vw - ox) / size), rows = Math.ceil((vh - oy) / size);
      const R = rng((Date.now() & 0xffff) + 1);
      const hE = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, () => (R() > 0.5 ? 1 : -1)));
      const vE = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, () => (R() > 0.5 ? 1 : -1)));

      // pieces arrive (and later leave) in order of distance from the button
      const b = btn.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const far = Math.max(...[[0, 0], [vw, 0], [0, vh], [vw, vh]].map(([x, y]) => Math.hypot(x - bx, y - by)));
      const SPREAD = 0.6, IN = 0.42, OUT = 0.42;
      const pieces = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ox + c * size, y = oy + r * size;
          pieces.push({
            x, y,
            e: {
              t: r === 0 ? 0 : -hE[r - 1][c],
              b: r === rows - 1 ? 0 : hE[r][c],
              l: c === 0 ? 0 : -vE[r][c - 1],
              r: c === cols - 1 ? 0 : vE[r][c],
            },
            delay: (Math.hypot(x + size / 2 - bx, y + size / 2 - by) / far) * SPREAD + R() * 0.07,
            spin: (R() * 2 - 1) * 50,
          });
        }
      }
      const lastDelay = Math.max(...pieces.map((p) => p.delay));
      const fill = BG[next], seam = SEAM[next];
      const easeOut = (t) => 1 - (1 - t) ** 3;
      const easeIn = (t) => t * t * t;
      const clamp = (v) => Math.max(0, Math.min(1, v));

      const start = performance.now();
      let coverAt = null; // seconds since start when the screen got fully covered

      const draw = (t) => {
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        g.clearRect(0, 0, vw, vh);
        let visible = 0;
        for (const p of pieces) {
          // k: 0 = not there, 1 = locked in place
          const k = coverAt === null
            ? easeOut(clamp((t - p.delay) / IN))
            : 1 - easeIn(clamp((t - coverAt - p.delay) / OUT));
          if (k <= 0) continue;
          visible++;
          const s = 0.35 + 0.65 * k;
          g.save();
          g.globalAlpha = Math.min(1, k * 1.6);
          g.translate(p.x + size / 2, p.y + size / 2 - (1 - k) * size * 0.35);
          g.rotate(((1 - k) * p.spin * Math.PI) / 180);
          g.scale(s, s);
          g.beginPath();
          piecePath(g, -size / 2, -size / 2, size, size, p.e, size);
          g.fillStyle = fill;
          g.fill();
          g.lineWidth = 1.5; // seal the hairline between neighbours…
          g.strokeStyle = fill;
          g.stroke();
          g.lineWidth = 1; // …then draw the puzzle seams on top
          g.strokeStyle = seam;
          g.stroke();
          g.restore();
        }
        return visible;
      };

      const frame = (now) => {
        const t = (now - start) / 1000;
        const visible = draw(t);
        if (coverAt === null && t >= lastDelay + IN) {
          onCovered(); // the theme flips (and the hero redraws) under the full cover
          playClick();
          coverAt = (performance.now() - start) / 1000 + 0.06;
        } else if (coverAt !== null && t > coverAt && visible === 0) {
          cv.remove();
          resolve();
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
})();
