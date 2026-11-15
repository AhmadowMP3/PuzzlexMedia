/* PuzzleX — the small things every page shares, plus a few home-page sections:
     the back-to-top piece (bottom right): its outline draws itself as you read, it turns lime at the end,
       and a press sends it flying up while the page follows
     the WhatsApp button's greeting bubble (the button itself is added by the server once there's a number)
     the home page's service request picker and partner logos strip, and the rivers of client reviews (home and feedback page)
   Uses T(), SITE, ROOT, REDUCED, EN, piecePath() and playClick() from main.js, jigsawD() and TAB_DEPTH from pages.js / main.js. */

/* ---------- back to top: a jigsaw piece with its knob pointing up ---------- */
(function initToTop() {
  const PAD = Math.ceil(100 * TAB_DEPTH + 4);
  const d = jigsawD({ t: 1, b: 0, l: 0, r: 0 }, 100, 100);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'to-top';
  btn.setAttribute('aria-label', T('العودة إلى أعلى الصفحة', 'Back to top'));
  btn.title = T('إلى الأعلى', 'Back to top');
  btn.innerHTML = `<svg viewBox="${-6 - PAD / 2} ${-PAD - 6} ${112 + PAD} ${112 + PAD}" aria-hidden="true">
    <path class="tt-base" d="${d}"/><path class="tt-fill" d="${d}"/><path class="tt-ring" d="${d}" pathLength="100"/>
    <path class="tt-arrow" d="M50 70V32M34 47l16-16 16 16"/></svg><span class="tt-pct" aria-hidden="true"></span>`;
  document.body.append(btn);
  const ring = btn.querySelector('.tt-ring');
  const pct = btn.querySelector('.tt-pct');

  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    ring.style.strokeDashoffset = String(100 - p * 100);
    pct.textContent = `${Math.round(p * 100)}%`;
    btn.classList.toggle('is-shown', scrollY > Math.min(700, innerHeight * 0.9));
    btn.classList.toggle('is-done', p > 0.985);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();

  btn.addEventListener('click', () => {
    if (btn.classList.contains('is-flying')) return;
    const go = () => {
      if (typeof lenis !== 'undefined' && lenis) lenis.scrollTo(0, { duration: REDUCED ? 0 : 1.4, force: true });
      else scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    };
    if (REDUCED) { go(); return; }
    // the piece lifts off and the page follows it up; it drops back into its corner once we're there
    btn.classList.add('is-flying');
    setTimeout(go, 120);
    setTimeout(() => btn.classList.remove('is-flying'), 1500);
  });
})();

/* ---------- WhatsApp: a greeting next to the round button, once per visit ---------- */
// the server adds the button after the page's scripts, so wait for the whole document
document.addEventListener('DOMContentLoaded', function initWhatsAppHello() {
  const fab = document.querySelector('.wa-fab');
  if (!fab || REDUCED) return;
  let seen = false;
  try { seen = sessionStorage.getItem('puzzlex-wa-hello') === '1'; } catch (e) { /* show it anyway */ }
  if (seen) return;
  const bubble = document.createElement('div');
  bubble.className = 'wa-hello';
  bubble.setAttribute('role', 'status');
  bubble.innerHTML = '<b></b><span></span><button type="button" class="wa-hello-x"></button>';
  bubble.querySelector('b').textContent = T('أهلاً 👋', 'Hi there 👋');
  bubble.querySelector('span').textContent = T('عندك مشروع؟ كلّمنا على واتساب.', 'Got a project? Message us on WhatsApp.');
  const x = bubble.querySelector('.wa-hello-x');
  x.setAttribute('aria-label', T('إغلاق', 'Close'));
  x.textContent = '×';
  document.body.append(bubble);
  const hide = () => {
    bubble.classList.remove('is-in');
    try { sessionStorage.setItem('puzzlex-wa-hello', '1'); } catch (e) { /* fine */ }
    setTimeout(() => bubble.remove(), 400);
  };
  x.addEventListener('click', hide);
  bubble.addEventListener('click', (ev) => { if (ev.target !== x) { fab.click(); hide(); } });
  fab.addEventListener('click', hide);
  // after the visitor has had a look round, not straight away
  setTimeout(() => { if (bubble.isConnected) bubble.classList.add('is-in'); }, 9000);
  setTimeout(() => { if (bubble.isConnected) hide(); }, 24000);
});

/* ---------- home · service request: pick the pieces, the button opens the form with them chosen ---------- */
(function initRequest() {
  const box = document.querySelector('[data-request]');
  if (!box) return;
  const section = box.closest('.request');
  const go = section.querySelector('.rq-go');
  const count = section.querySelector('.rq-count');
  const empty = count.textContent;
  const KEY = 'puzzlex-services'; // shared with the services page and the contact form (pages.js)
  const buttons = [...box.querySelectorAll('.rq-opt')];
  const remembered = () => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '[]').filter((id) => typeof id === 'string'); } catch (e) { return []; }
  };
  const picked = new Set(remembered());
  // the noun after a number in Arabic: 1 and 2 have their own forms, 3–10 plural, 11+ singular
  const pieces = (n) => (EN ? `${n} ${n === 1 ? 'service' : 'services'} picked`
    : n === 1 ? 'اخترت خدمة واحدة' : n === 2 ? 'اخترت خدمتين' : `اخترت ${n} ${n <= 10 ? 'خدمات' : 'خدمة'}`);
  const draw = () => {
    const ids = [...picked];
    go.href = ids.length ? `contact.html?services=${ids.map(encodeURIComponent).join(',')}` : 'contact.html';
    count.textContent = ids.length ? pieces(ids.length) : empty;
    section.classList.toggle('has-picks', ids.length > 0);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(picked.has(b.dataset.id))));
    box.querySelectorAll('.rq-card').forEach((c) => c.classList.toggle('is-on', !!c.querySelector('[aria-pressed="true"]')));
    // saved on every change, so the picks reach the contact form however the visitor gets there (button, menu, footer)
    try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch (e) { /* the button's link still carries them */ }
    go.querySelector('.rq-n')?.remove();
    if (ids.length) {
      const n = document.createElement('span');
      n.className = 'rq-n';
      n.textContent = ids.length;
      go.append(n);
    }
  };
  box.addEventListener('click', (ev) => {
    const opt = ev.target.closest('.rq-opt');
    if (!opt) return;
    if (opt.getAttribute('aria-pressed') !== 'true') picked.add(opt.dataset.id); else picked.delete(opt.dataset.id);
    if (typeof playClick === 'function') { try { playClick(); } catch (e) { /* sound is a bonus */ } }
    draw();
  });
  draw();
  // back from the contact form with the page restored as it was: show what was changed there
  addEventListener('pageshow', (ev) => {
    if (!ev.persisted) return;
    picked.clear();
    remembered().forEach((id) => picked.add(id));
    draw();
  });
  // on phones the WhatsApp and back-to-top buttons would sit on the request bar: they step aside meanwhile
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => document.documentElement.classList.toggle('rq-in-view', e.isIntersecting), { rootMargin: '-35% 0px -10% 0px' })
      .observe(section);
  }
  if (!REDUCED && window.gsap && window.ScrollTrigger) {
    gsap.from(section.querySelectorAll('.rq-card'), {
      y: 40, autoAlpha: 0, rotate: (i) => (i % 2 ? 2 : -2), duration: 0.8, stagger: 0.1, ease: 'power3.out',
      scrollTrigger: { trigger: box, start: 'top 85%', toggleActions: 'play none none none' }, // see scroll.js: not `once`
    });
  }
})();

/* ---------- home · every partner logo on a strip that keeps moving (two rows, opposite ways) ---------- */
(function initLogoStrip() {
  const strip = document.querySelector('[data-logo-strip]');
  const logos = (SITE.partners || []).filter((p) => p && p.src);
  if (!strip) return;
  if (logos.length < 6) { strip.closest('.logo-strip')?.remove(); return; }
  const src = (s) => (/^(\/|https?:)/.test(s) ? s : ROOT + s);
  const half = Math.ceil(logos.length / 2);
  const rows = [logos.slice(0, half), logos.slice(half)];
  strip.innerHTML = rows.map((row, r) => {
    // each row twice, so the loop is seamless; the copy is hidden from screen readers
    const items = (copy) => row.map((p) => `<li${copy ? ' aria-hidden="true"' : ''}><img src="${src(p.src)}" alt="${copy ? '' : (p.name || '').replace(/[<>"&]/g, '')}" loading="lazy" decoding="async" width="132" height="70"></li>`).join('');
    return `<div class="ls-row${r ? ' rev' : ''}" style="--dur:${Math.max(28, row.length * 3.2)}s"><ul class="ls-track">${items(false)}${items(true)}</ul></div>`;
  }).join('');
})();

/* ---------- feedback page · rivers of reviews: rows of interlocking puzzle pieces sliding past, each row its own
   way and speed. Hover a row and it stops; click a piece and it opens large. A showcase (hidden from screen readers):
   every review is also in the wall below, with its search. Only transform moves, in CSS, one layer per row. ---------- */
(function initFeedbackRivers() {
  const box = document.querySelector('[data-feedback-rivers]');
  const list = box && box.querySelector('.fbr-list');
  if (!list) return;
  const all = [...list.children];

  // two shapes do the whole river: a piece with both sides cut in, then one with both tabs out, and so on
  const pathOf = (e, w, h, tab) => {
    let d = '';
    const n = (v) => +v.toFixed(1);
    piecePath({
      moveTo: (x, y) => { d += `M${n(x)} ${n(y)}`; },
      lineTo: (x, y) => { d += `L${n(x)} ${n(y)}`; },
      bezierCurveTo: (a, b, c, dd, x, y) => { d += `C${n(a)} ${n(b)} ${n(c)} ${n(dd)} ${n(x)} ${n(y)}`; },
      closePath: () => { d += 'Z'; },
    }, 0, 0, w, h, e, tab);
    return d;
  };

  const rowsEl = document.createElement('div');
  rowsEl.className = 'fbr-rows';
  const view = document.createElement('dialog');
  view.className = 'fbr-view';
  view.setAttribute('aria-label', T('رأي العميل', 'Client review'));
  box.after(view);

  let lastW = 0;
  function build() {
    const vw = box.clientWidth || window.innerWidth;
    if (vw === lastW) return;
    lastW = vw;
    const small = vw < 700;
    const W = small ? 256 : 320, H = small ? 198 : 196, tab = H * 0.44, pad = Math.ceil(tab * TAB_DEPTH + 4);
    const cut = Math.ceil(tab * TAB_DEPTH + 12), plain = 18;
    box.style.setProperty('--w', `${W}px`);
    box.style.setProperty('--h', `${H}px`);
    box.style.setProperty('--pad', `${pad}px`);
    box.style.setProperty('--cut', `${cut}px`);
    box.style.setProperty('--plain', `${plain}px`);
    const shapes = [{ t: 0, b: 0, l: -1, r: -1 }, { t: 0, b: 0, l: 1, r: 1 }].map((e) => pathOf(e, W, H, tab));

    // fewer rows when there are few reviews; each row an even number of pieces, so the loop locks in at its seam
    const nRows = Math.min(Number(box.dataset.rows) || 3, all.length >= 18 ? 3 : all.length >= 10 ? 2 : 1);
    const rows = Array.from({ length: nRows }, () => []);
    all.forEach((li, i) => rows[i % nRows].push(li));
    const speeds = [34, 26, 40]; // px a second
    rowsEl.replaceChildren(...rows.map((row, r) => {
      if (row.length % 2) row = row.concat(row[0]);
      // one set must be at least as wide as the screen; then it's there twice and slides exactly one set's width
      let set = row;
      while (set.length * W < vw + W) set = set.concat(row);
      const piece = (li, k) => {
        const el = li.cloneNode(true);
        el.classList.add(k % 2 ? 'is-tabs' : 'is-cuts');
        if ((k + r * 3) % 9 === 4) el.classList.add('is-lime');
        el.insertAdjacentHTML('afterbegin', `<svg class="fbr-shape" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}" aria-hidden="true"><path d="${shapes[k % 2]}"/></svg>`);
        return el;
      };
      const track = document.createElement('ul');
      track.className = 'fbr-track';
      track.append(...set.map(piece), ...set.map(piece));
      const rowEl = document.createElement('div');
      rowEl.className = `fbr-row${r % 2 ? ' is-rev' : ''}`;
      rowEl.style.setProperty('--shift', `${-set.length * W}px`);
      rowEl.style.setProperty('--dur', `${((set.length * W) / speeds[r % speeds.length]).toFixed(1)}s`);
      rowEl.append(track);
      return rowEl;
    }));
    // the big piece in the viewer: a tab on top and on one side, a cut on the others
    view.dataset.shape = pathOf({ t: 1, r: -1, b: -1, l: 1 }, 600, 360, 360 * 0.34);
  }

  list.replaceWith(rowsEl);
  box.classList.add('is-ready');
  build();
  window.addEventListener('resize', () => { clearTimeout(build.t); build.t = setTimeout(build, 200); });

  // off screen, the rivers stop (and so does the work of moving them)
  new IntersectionObserver(([e]) => box.classList.toggle('is-off', !e.isIntersecting)).observe(box);

  // a click (not a drag of the page on a phone) opens the piece large
  rowsEl.addEventListener('click', (ev) => {
    const li = ev.target.closest('.fbr');
    if (!li) return;
    const pad = Math.ceil(360 * 0.34 * TAB_DEPTH + 4);
    const content = li.cloneNode(true);
    content.querySelector('.fbr-shape')?.remove();
    view.innerHTML = `<div class="fbr-big${li.classList.contains('is-lime') ? ' is-lime' : ''}">`
      + `<svg class="fbr-shape" viewBox="${-pad} ${-pad} ${600 + 2 * pad} ${360 + 2 * pad}" preserveAspectRatio="none" aria-hidden="true"><path d="${view.dataset.shape}"/></svg>`
      + `<div class="fbr-big-body">${content.innerHTML}</div>`
      + `<button type="button" class="fbr-close" aria-label="${T('إغلاق', 'Close')}">×</button></div>`;
    box.classList.add('is-paused');
    view.showModal();
    view.querySelector('.fbr-close').focus({ preventScroll: true });
    if (!REDUCED && window.gsap) gsap.fromTo(view.querySelector('.fbr-big'), { scale: 0.85, rotation: -4, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.45, ease: 'back.out(1.6)' });
    playClick();
  });
  view.addEventListener('click', (ev) => { if (ev.target === view || ev.target.closest('.fbr-close')) view.close(); });
  view.addEventListener('close', () => box.classList.remove('is-paused'));
})();
