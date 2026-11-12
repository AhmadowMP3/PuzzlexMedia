/* PuzzleX — the small things every page shares, plus a few home-page sections:
     the back-to-top piece (bottom right): its outline draws itself as you read, it turns lime at the end,
       and a press sends it flying up while the page follows
     the WhatsApp button's greeting bubble (the button itself is added by the server once there's a number)
     the home page's service request picker, the client-feedback orbit, and the partner logos strip
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

/* ---------- home · client feedback: a ring of interlocking pieces that turns in 3D ----------
   Front: photo, name, stars. A click flips the piece to the review. The ring turns by itself, stops while the
   pointer or focus is on it, and can be dragged or stepped with the arrows. A short list is repeated round the
   back of the ring so it closes; the copies are decoration (hidden from screen readers and the keyboard). */
(function initFeedbackOrbit() {
  const list = document.querySelector('.testimonials [data-orbit]');
  if (!list || !window.gsap) return;
  const real = [...list.children];
  if (real.length < 3) return; // too few for a ring: the plain grid stays

  // at least 10 places round the ring, filled with whole rounds of the reviews
  const slots = Math.max(real.length, Math.ceil(10 / real.length) * real.length);
  for (let k = real.length; k < slots; k++) {
    const copy = real[k % real.length].cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    copy.querySelectorAll('[aria-controls]').forEach((el) => el.removeAttribute('aria-controls'));
    list.append(copy);
  }
  const items = [...list.children];
  const N = items.length, STEP = 360 / N;
  // the edge between piece i and piece i+1: a tab on one side is the other's cut-in, all the way round
  const edge = items.map((_, i) => (i % 2 ? 1 : -1));
  const edgesOf = (i) => ({ t: 0, b: 0, r: edge[i], l: -edge[(i - 1 + N) % N] });

  const stage = document.createElement('div');
  stage.className = 'tmo-stage';
  list.before(stage);
  stage.append(list);
  list.classList.add('is-3d');

  // the arrows sit in the section's footer; "next" points the way the page reads
  const foot = document.querySelector('.testimonials .tm-foot');
  const nav = document.createElement('div');
  nav.className = 'tmo-nav';
  nav.innerHTML = `<button type="button" class="tmo-prev" aria-label="${T('الرأي السابق', 'Previous review')}"><span aria-hidden="true">${EN ? '←' : '→'}</span></button>`
    + `<button type="button" class="tmo-next" aria-label="${T('الرأي التالي', 'Next review')}"><span aria-hidden="true">${EN ? '→' : '←'}</span></button>`;
  if (foot) foot.prepend(nav);

  const state = { rot: 0 };
  let W = 0, H = 0, R = 0, flipped = null;

  // the outline of one face; the back is the same piece seen from behind, so its left and right swap
  const shapeSvg = (e, w, h, tab, pad) => {
    let d = '';
    const n = (v) => +v.toFixed(1);
    piecePath({
      moveTo: (x, y) => { d += `M${n(x)} ${n(y)}`; },
      lineTo: (x, y) => { d += `L${n(x)} ${n(y)}`; },
      bezierCurveTo: (a, b, c, dd, x, y) => { d += `C${n(a)} ${n(b)} ${n(c)} ${n(dd)} ${n(x)} ${n(y)}`; },
      closePath: () => { d += 'Z'; },
    }, 0, 0, w, h, e, tab);
    return `<svg class="tmo-shape" viewBox="${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}" aria-hidden="true"><path d="${d}"/></svg>`;
  };

  function layout() {
    const box = stage.clientWidth || window.innerWidth;
    W = Math.round(Math.min(290, Math.max(200, box * (box < 700 ? 0.58 : 0.23))));
    H = Math.round(W * 1.22);
    const tab = W * 0.46, pad = Math.ceil(tab * TAB_DEPTH + 4);
    R = W / 2 / Math.tan(Math.PI / N);
    stage.style.setProperty('--w', `${W}px`);
    stage.style.setProperty('--h', `${H}px`);
    stage.style.setProperty('--pad', `${pad}px`);
    // text keeps clear of a cut-in (it reaches into the piece); a tab sticks out, so that side needs no extra room
    const cut = Math.ceil(tab * TAB_DEPTH + 10), plain = 16;
    const sidePad = (el, e) => { el.style.paddingLeft = `${e.l < 0 ? cut : plain}px`; el.style.paddingRight = `${e.r < 0 ? cut : plain}px`; };
    items.forEach((it, i) => {
      const e = edgesOf(i);
      it.style.transform = `rotateY(${i * STEP}deg) translateZ(${R}px)`;
      it.querySelectorAll('.tmo-shape').forEach((s) => s.remove());
      const front = it.querySelector('.tmo-front'), back = it.querySelector('.tmo-back'), mirrored = { ...e, l: e.r, r: e.l };
      front.insertAdjacentHTML('afterbegin', shapeSvg(e, W, H, tab, pad));
      back.insertAdjacentHTML('afterbegin', shapeSvg(mirrored, W, H, tab, pad));
      sidePad(front, e);
      sidePad(back, mirrored);
    });
    render();
  }

  // the ring's turn, and which pieces face us (the ones turned away are hidden, so their backs never show)
  const norm = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  let frontIndex = 0;
  function render() {
    list.style.transform = `translateZ(${-R}px) rotateY(${state.rot}deg)`;
    let best = Infinity;
    items.forEach((it, i) => {
      const a = Math.abs(norm(i * STEP + state.rot));
      it.classList.toggle('is-away', a > 100);
      it.style.setProperty('--d', Math.min(1, a / 90).toFixed(3));
      if (a < best) { best = a; frontIndex = i; }
    });
    items.forEach((it, i) => it.classList.toggle('is-front', i === frontIndex));
  }

  const unflip = () => {
    if (!flipped) return;
    flipped.classList.remove('is-flipped');
    flipped.querySelector('.tmo-front')?.setAttribute('aria-expanded', 'false');
    flipped = null;
  };
  // turn the ring so piece i faces us, the short way round
  const turnTo = (i, duration = 0.9) => {
    const target = state.rot + norm(-i * STEP - state.rot);
    return gsap.to(state, { rot: target, duration: REDUCED ? 0 : duration, ease: 'power3.inOut', overwrite: true, onUpdate: render });
  };
  const step = (dir) => { unflip(); turnTo(frontIndex + dir); };

  function flip(it) {
    const was = it === flipped;
    unflip();
    if (was) return;
    const i = items.indexOf(it);
    if (i !== frontIndex) turnTo(i, 0.6);
    it.classList.add('is-flipped');
    it.querySelector('.tmo-front')?.setAttribute('aria-expanded', 'true');
    flipped = it;
    playClick();
  }

  // drag: one piece's width of pointer travel turns the ring one place; let go and it settles on the nearest piece
  let drag = null, moved = false;
  stage.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY, rot: state.rot, last: ev.clientX, t: performance.now(), v: 0, id: ev.pointerId };
    moved = false;
    gsap.killTweensOf(state);
  });
  stage.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x;
    if (!moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(ev.clientY - drag.y) > Math.abs(dx)) { drag = null; return; } // a vertical swipe scrolls the page
      moved = true;
      unflip();
      stage.classList.add('is-dragging');
      stage.setPointerCapture(ev.pointerId);
    }
    const now = performance.now();
    drag.v = (ev.clientX - drag.last) / Math.max(1, now - drag.t);
    drag.last = ev.clientX; drag.t = now;
    state.rot = drag.rot + (dx / W) * STEP;
    render();
  });
  const release = () => {
    if (!drag) return;
    stage.classList.remove('is-dragging');
    if (moved) {
      // a flick carries on a little before settling
      const fling = gsap.utils.clamp(-2, 2, Math.round((drag.v * 220) / W));
      const target = Math.round((state.rot / STEP) + fling) * STEP;
      gsap.to(state, { rot: target, duration: REDUCED ? 0 : 0.7, ease: 'power3.out', overwrite: true, onUpdate: render });
    }
    drag = null;
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  // a drag isn't a click
  stage.addEventListener('click', (ev) => {
    if (moved) { ev.preventDefault(); ev.stopPropagation(); moved = false; return; }
    const it = ev.target.closest('.tmo');
    if (it && !it.classList.contains('is-away')) flip(it);
  }, true);

  nav.querySelector('.tmo-next').addEventListener('click', () => step(1));
  nav.querySelector('.tmo-prev').addEventListener('click', () => step(-1));
  // the keyboard: Tab brings a piece round to the front, Enter / Space flips it (a button's own click, handled by the
  // stage above), Esc flips it back
  list.addEventListener('focusin', (ev) => {
    const it = ev.target.closest('.tmo');
    if (it && items.indexOf(it) !== frontIndex) turnTo(items.indexOf(it), 0.6);
  });
  list.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && flipped) { const btn = flipped.querySelector('.tmo-front'); unflip(); btn?.focus({ preventScroll: true }); }
  });

  // turns on its own, one place every few seconds, only while nobody is reading it and it's on screen
  let hover = false, inView = false;
  stage.addEventListener('pointerenter', () => { hover = true; });
  stage.addEventListener('pointerleave', () => { hover = false; release(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.3 }).observe(stage);
  if (!REDUCED) {
    setInterval(() => {
      if (hover || flipped || drag || !inView || document.hidden || list.contains(document.activeElement)) return;
      step(1);
    }, 3800);
  }

  layout();
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    layout();
  });
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
