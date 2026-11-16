/* PuzzleX — the small things every page shares, plus a few home-page sections:
     the back-to-top piece (bottom right): its outline draws itself as you read, it turns lime at the end,
       and a press sends it flying up while the page follows
     Shater, the assistant in the corner (it takes the WhatsApp button's place; the server still adds that button)
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

/* ---------- Shater (شاطر): the site's assistant, in the corner the WhatsApp button had ----------
   A lime puzzle piece opens a small chat: Shater greets, the visitor asks (a few questions a visit, the number comes
   from the server), the answers come from /api/assistant (lib/assistant.js → OpenRouter). WhatsApp sits at the top of
   the chat. The chat lives in sessionStorage, so it follows the visitor from page to page. Without scripts the plain
   WhatsApp button stays (the server still adds it); with them it's hidden behind Shater. */
// the server adds the WhatsApp button after the page's scripts, so wait for the whole document
document.addEventListener('DOMContentLoaded', function initShater() {
  const body = document.body;
  if (!body.dataset.shater) return; // pages drawn without the server's settings
  const ON = body.dataset.shater === 'on';
  const LIMIT = Math.max(1, Number(body.dataset.shaterQ) || 3);
  const wa = document.querySelector('.wa-fab');
  const waHref = wa ? wa.href : '';
  document.documentElement.classList.add('has-shater');

  const KEY = 'puzzlex-shater';
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const st = Object.assign({ msgs: [], history: [], left: LIMIT, open: false, hello: false }, load() || {});
  st.left = Math.min(st.left, LIMIT);
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private mode: this page only */ } };

  // the mark: a lime puzzle piece with the brand's four-point star
  const STAR = '<path d="M50 16c3 19 15 31 34 34-19 3-31 15-34 34-3-19-15-31-34-34 19-3 31-15 34-34z"/>';
  const PIECE = jigsawD({ t: 1, r: 1, b: 0, l: 0 }, 100, 100);
  const PAD = Math.ceil(100 * TAB_DEPTH + 4);
  const logo = (cls) => `<svg class="${cls}" viewBox="-6 ${-PAD - 6} ${112 + PAD} ${112 + PAD}" aria-hidden="true"><path class="sh-piece" d="${PIECE}"/><g class="sh-star">${STAR}</g></svg>`;
  const WA_SVG = wa && wa.querySelector('svg') ? wa.querySelector('svg').outerHTML : '';

  // the launcher
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'sh-fab';
  fab.setAttribute('aria-controls', 'sh-panel');
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-label', T('افتح شاطر، مساعد بزل إكس', 'Open Shater, the PuzzleX assistant'));
  fab.innerHTML = `${logo('sh-fab-logo')}<span class="sh-fab-name">${T('شاطر', 'Shater')}</span>`;

  // the chat
  const panel = document.createElement('section');
  panel.className = 'sh-panel';
  panel.id = 'sh-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', T('شاطر، مساعد بزل إكس ميديا', 'Shater, the PuzzleX Media assistant'));
  panel.innerHTML = `
    <header class="sh-head">${logo('sh-avatar')}
      <p class="sh-who"><b>${T('شاطر', 'Shater')}</b><small>${T('مساعد بزل إكس ميديا', 'PuzzleX Media assistant')}</small></p>
      <button type="button" class="sh-close" aria-label="${T('إغلاق', 'Close')}">×</button>
    </header>
    ${waHref ? `<a class="sh-wa" href="${waHref}" target="_blank" rel="noopener" data-contact="whatsapp">${WA_SVG}<span>${T('تواصل معنا مباشرة على واتساب', 'Talk to us directly on WhatsApp')}</span></a>` : ''}
    <div class="sh-log" role="log" aria-live="polite"></div>
    <div class="sh-chips"></div>
    <form class="sh-form" novalidate>
      <label class="sr-only" for="sh-q">${T('سؤالك لشاطر', 'Your question for Shater')}</label>
      <textarea id="sh-q" rows="1" maxlength="500" placeholder="${T('اكتب سؤالك هنا…', 'Type your question…')}" enterkeyhint="send"></textarea>
      <button type="submit" class="sh-send" aria-label="${T('إرسال', 'Send')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-7.5 18-2.6-7.4L3 11.5z"/></svg></button>
    </form>
    <p class="sh-left" aria-live="polite"></p>`;
  body.append(fab, panel);

  const log = panel.querySelector('.sh-log');
  const chips = panel.querySelector('.sh-chips');
  const form = panel.querySelector('.sh-form');
  const input = panel.querySelector('textarea');
  const send = panel.querySelector('.sh-send');
  const leftEl = panel.querySelector('.sh-left');

  // an answer is plain text: links to this site or to WhatsApp become links, nothing else is ever markup
  const fill = (el, text) => {
    const re = /https?:\/\/(?:www\.)?(?:puzzlexmedia\.com|wa\.me)[^\s<>()"'،]*/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      const url = m[0].replace(/[.,؛:!?]+$/, '');
      el.append(text.slice(last, m.index));
      const a = document.createElement('a');
      a.href = url;
      a.textContent = url.replace(/^https?:\/\/(www\.)?/, '');
      if (/wa\.me/.test(url)) { a.target = '_blank'; a.rel = 'noopener'; }
      el.append(a);
      last = m.index + url.length;
    }
    el.append(text.slice(last));
  };
  const bubble = (who, text, extra) => {
    const el = document.createElement('div');
    el.className = `sh-msg sh-${who}${extra ? ` ${extra}` : ''}`;
    el.setAttribute('dir', 'auto');
    fill(el, text);
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };
  const say = (who, text, extra) => { st.msgs.push({ who, text, extra: extra || '' }); save(); return bubble(who, text, extra); };

  const GREETING = T('مرحبا، أنا شاطر 👋 بشو بقدر ساعدك؟', 'Hi, I\'m Shater 👋 How can I help you?');
  const INTRO = T('اسألني عن خدمات بزل إكس ميديا، وكيف نشتغل معك على مشروعك.', 'Ask me about PuzzleX Media\'s services and how we would work with you on your project.');
  const SUGGEST = EN
    ? ['What services do you offer?', 'How does a project with you start?', 'Can you run my brand\'s social media?']
    : ['شو الخدمات اللي بتقدموها؟', 'كيف بيبلش المشروع معكم؟', 'فيكم تمسكوا السوشال ميديا لعلامتي؟'];

  const drawLeft = () => {
    const done = st.left <= 0;
    leftEl.textContent = done ? T('خلصت أسئلتك لهالجلسة', 'You\'ve used this visit\'s questions')
      : st.left === 1 ? T('باقي لك سؤال واحد', '1 question left')
        : st.left === 2 ? T('باقي لك سؤالين', '2 questions left')
          : T(`باقي لك ${st.left} أسئلة`, `${st.left} questions left`);
    input.disabled = done;
    send.disabled = done;
    panel.classList.toggle('is-done', done);
    chips.hidden = done || st.history.length > 0;
  };
  const drawChips = () => {
    chips.replaceChildren(...SUGGEST.map((q) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sh-chip';
      b.textContent = q;
      b.addEventListener('click', () => ask(q));
      return b;
    }));
  };

  let busy = false;
  async function ask(raw) {
    const question = String(raw || '').trim().slice(0, 500);
    if (!question || busy || st.left <= 0) return;
    busy = true;
    send.disabled = true;
    say('me', question);
    input.value = '';
    fit();
    chips.hidden = true;
    const typing = bubble('bot', '', 'is-typing');
    typing.innerHTML = '<i></i><i></i><i></i>';
    typing.setAttribute('aria-label', T('شاطر يكتب', 'Shater is typing'));
    let data = {}, status = 0;
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: EN ? 'en' : 'ar', question, history: st.history }),
      });
      status = res.status;
      data = await res.json().catch(() => ({}));
    } catch (e) { status = 0; }
    typing.remove();
    if (typeof data.left === 'number') st.left = data.left;
    if (data.ok) {
      say('bot', data.answer);
      st.history.push({ q: question, a: data.answer });
    } else if (data.reason === 'not-ready' || (!ON && status === 503)) {
      say('bot', T('شاطر لسا عم يتجهّز ليجاوب 🙏 بس فريقنا جاهز هلق: كبسة وحدة على واتساب فوق وبنرد عليك.', 'Shater is still getting ready to answer 🙏 Our team is here right now though: tap WhatsApp above and we\'ll reply.'), 'is-note');
    } else if (data.reason === 'limit') {
      st.left = 0;
    } else if (data.reason === 'busy') {
      say('bot', T('وصلنا أسئلة كتير من نفس الشبكة بهالساعة. جرّب بعد شوي، أو كلّمنا على واتساب.', 'We\'ve had many questions from this network this hour. Try again later, or message us on WhatsApp.'), 'is-note');
    } else {
      say('bot', T('ما قدرت جاوب هلق، صار خلل بسيط. جرّب كمان مرة، وما رح ينحسب السؤال.', 'I couldn\'t answer just now, something went wrong. Try again; it won\'t count as a question.'), 'is-note');
    }
    if (st.left <= 0 && !st.msgs.some((m) => m.extra === 'is-end')) {
      say('bot', T('خلصت أسئلتك لهالجلسة 🙌 إذا حابب نكمّل، فريقنا بانتظارك على واتساب.', 'That\'s all the questions for this visit 🙌 If you\'d like to keep going, our team is waiting on WhatsApp.'), 'is-end');
    }
    save();
    busy = false;
    drawLeft();
    if (st.left > 0) input.focus({ preventScroll: true });
  }

  // the box grows with the question, up to four lines; Enter sends, Shift+Enter starts a new line
  const fit = () => {
    input.style.height = '';
    if (!input.value) return; // empty: one line, as the stylesheet draws it
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 2, 110)}px`;
  };
  input.addEventListener('input', fit);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); ask(input.value); }
  });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); ask(input.value); });

  // a greeting next to the piece, once a visit, after the visitor has had a look round
  const hello = document.createElement('div');
  hello.className = 'wa-hello sh-hello';
  hello.setAttribute('role', 'status');
  hello.innerHTML = '<b></b><span></span><button type="button" class="wa-hello-x"></button>';
  hello.querySelector('b').textContent = T('مرحبا، أنا شاطر 👋', 'Hi, I\'m Shater 👋');
  hello.querySelector('span').textContent = T('بشو بقدر ساعدك؟ اسألني عن خدماتنا.', 'How can I help? Ask me about our services.');
  const x = hello.querySelector('.wa-hello-x');
  x.setAttribute('aria-label', T('إغلاق', 'Close'));
  x.textContent = '×';
  const hideHello = () => { hello.classList.remove('is-in'); st.hello = true; save(); setTimeout(() => hello.remove(), 400); };

  const open = (focus = true) => {
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    fab.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('sh-open');
    st.open = true;
    st.hello = true;
    hello.remove();
    if (!st.msgs.length) { say('bot', GREETING); say('bot', INTRO); }
    save();
    log.scrollTop = log.scrollHeight;
    if (focus && st.left > 0 && matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
  };
  const close = () => {
    panel.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('sh-open');
    st.open = false;
    save();
    setTimeout(() => { if (!st.open) panel.hidden = true; }, 260);
  };
  fab.addEventListener('click', () => (st.open ? close() : open()));
  panel.querySelector('.sh-close').addEventListener('click', () => { close(); fab.focus({ preventScroll: true }); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && st.open) { close(); fab.focus({ preventScroll: true }); } });

  x.addEventListener('click', (ev) => { ev.stopPropagation(); hideHello(); });
  hello.addEventListener('click', () => { hideHello(); open(); });
  if (!st.hello && !REDUCED) {
    body.append(hello);
    setTimeout(() => { if (hello.isConnected && !st.open) hello.classList.add('is-in'); }, 9000);
    setTimeout(() => { if (hello.isConnected) hideHello(); }, 24000);
  }

  // on another page: the same conversation, and open if it was open
  st.msgs.forEach((m) => bubble(m.who, m.text, m.extra));
  drawChips();
  drawLeft();
  if (st.open) open(false);
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
