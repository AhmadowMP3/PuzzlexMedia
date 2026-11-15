/* PuzzleX — the company's own pages and lists (client notes, Nov 2026):
     team.json         { visible, members: [ { id, name, role, bio: { ar, en }, photo, links: { linkedin, … } } ] }
                       "Meet our team" on the About page; hidden until the team switches it on in the admin panel
     profile.json      { ar, en }   the company profile PDFs (/uploads/<id>.pdf), opened from the About page
     subscribers.json  [ { id, email, name, lang, date } ]   the newsletter sign-ups (no duplicates)
     applications.jsonl  one job application per line; the CVs sit in applications/<id>.pdf, never public
   The public side: POST /api/subscribe and POST /api/apply (multipart, with an optional PDF CV).
   The admin side: /api/admin/team, /profile, /subscribers, /applications (lib/admin.js passes them here). */
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const PhoneNumber = require('../phone-number');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINK_KEYS = ['linkedin', 'instagram', 'x', 'behance', 'website'];
const LINK_NAMES = { linkedin: 'LinkedIn', instagram: 'Instagram', x: 'X', behance: 'Behance', website: 'Website' };
const FIELDS_OF_WORK = {
  design: ['التصميم الجرافيكي', 'Graphic design'], video: ['المونتاج والفيديو', 'Video editing'],
  content: ['كتابة المحتوى والتسويق', 'Copywriting & marketing'], linkedin: ['خدمات لينكدإن', 'LinkedIn services'],
  dev: ['البرمجة', 'Software development'], other: ['مجال آخر', 'Something else'],
};
const EXPERIENCE = { '0': ['أقل من سنة', 'Under a year'], '1-3': ['من سنة إلى 3 سنوات', '1–3 years'], '3-5': ['من 3 إلى 5 سنوات', '3–5 years'], '5+': ['أكثر من 5 سنوات', 'Over 5 years'] };
const CV_MAX = 5 * 1024 * 1024;
const PROFILE_MAX = 80 * 1024 * 1024;

// a problem to show the user as it is (lib/admin.js answers these with their own status and message)
class Bad extends Error { constructor(message, status = 400) { super(message); this.status = status; this.userFacing = true; } }
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = (v, lang) => (v && typeof v === 'object' ? (lang === 'en' ? v.en || v.ar : v.ar || v.en) || '' : '');
const httpUrl = (v) => { const u = str(v, 400); return /^https?:\/\/[^\s"<>]+$/i.test(u) ? u : ''; };

/* ---------- a small multipart/form-data reader (the application form: a few fields and one PDF) ---------- */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || '');
  if (!m) return null;
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  const parts = [];
  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    pos += boundary.length;
    if (buf.slice(pos, pos + 2).toString() === '--') break; // the closing boundary
    pos += 2; // CRLF after the boundary
    const headEnd = buf.indexOf('\r\n\r\n', pos);
    if (headEnd === -1) break;
    const head = buf.slice(pos, headEnd).toString('utf8');
    const next = buf.indexOf(boundary, headEnd + 4);
    if (next === -1) break;
    parts.push({
      name: (/name="([^"]*)"/i.exec(head) || [])[1] || '',
      filename: (/filename="([^"]*)"/i.exec(head) || [])[1],
      body: buf.slice(headEnd + 4, next - 2), // minus the CRLF before the next boundary
    });
    pos = next;
  }
  return parts;
}

/* ---------- the team: cleaned on save, drawn on the About page ---------- */
function cleanTeam(body, imageSrc) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.members)) throw new Bad('بيانات الفريق غير صالحة');
  if (body.members.length > 60) throw new Bad('الحد الأقصى 60 شخصاً');
  const pair = (v, max) => ({ ar: str(v && v.ar, max), en: str(v && v.en, max) });
  return {
    visible: body.visible === true,
    members: body.members.map((m, i) => {
      const at = `العضو ${i + 1}`;
      const name = pair(m.name, 120);
      if (!name.ar && !name.en) throw new Bad(`${at}: اكتب الاسم`);
      const links = {};
      for (const k of LINK_KEYS) {
        const raw = str(m.links && m.links[k], 400);
        if (!raw) continue;
        const u = httpUrl(raw);
        if (!u) throw new Bad(`${at}: رابط ${LINK_NAMES[k]} يجب أن يبدأ بـ https://`);
        links[k] = u;
      }
      return {
        id: /^[a-f0-9]{8}$/.test(m.id) ? m.id : crypto.randomBytes(4).toString('hex'),
        name, role: pair(m.role, 160), bio: pair(m.bio, 600), photo: imageSrc(m.photo, `${at} — الصورة`), links,
      };
    }),
  };
}

const LINK_ICONS = {
  linkedin: 'in', instagram: 'ig', x: 'x', behance: 'Bē',
  website: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16.6 16.6 0 0 0 0 4H4.3zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6A15.6 15.6 0 0 0 8.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.2 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.8-5.6a16.6 16.6 0 0 0 0-4h3.4a8 8 0 0 1 0 4h-3.4z"/></svg>',
};

function teamCards(team, lang) {
  return team.members.map((m) => {
    const name = pick(m.name, lang), role = pick(m.role, lang), bio = pick(m.bio, lang);
    const face = m.photo
      ? `<img class="team-photo" src="/${escAttr(String(m.photo).replace(/^\//, ''))}" alt="${escAttr(name)}" width="320" height="320" loading="lazy" decoding="async">`
      : `<span class="team-photo team-initial" aria-hidden="true">${escText([...name][0] || '')}</span>`;
    const links = LINK_KEYS.filter((k) => m.links && m.links[k]).map((k) =>
      `<a href="${escAttr(m.links[k])}" target="_blank" rel="noopener" aria-label="${escAttr(`${name} — ${LINK_NAMES[k]}`)}">${LINK_ICONS[k]}</a>`).join('');
    return `<li class="team-card">${face}<div class="team-info"><h3 class="team-name" dir="auto">${escText(name)}</h3>`
      + `${role ? `<p class="team-role" dir="auto">${escText(role)}</p>` : ''}${bio ? `<p class="team-bio" dir="auto">${escText(bio)}</p>` : ''}`
      + `${links ? `<div class="team-links">${links}</div>` : ''}</div></li>`;
  }).join('');
}

function createCompany({ store, json, clientIp, readBody }) {
  const dir = store.dataDir;
  const appDir = path.join(dir, 'applications');
  const APPS = path.join(dir, 'applications.jsonl');

  // first start: the team section exists but stays hidden, and there's no profile until one is uploaded
  function seed() {
    if (!fs.existsSync(path.join(dir, 'team.json'))) fs.writeFileSync(path.join(dir, 'team.json'), JSON.stringify({ visible: false, members: [] }, null, 1));
    if (!fs.existsSync(path.join(dir, 'profile.json'))) fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({ ar: '', en: '' }, null, 1));
    if (!fs.existsSync(path.join(dir, 'subscribers.json'))) fs.writeFileSync(path.join(dir, 'subscribers.json'), '[]');
    fs.mkdirSync(appDir, { recursive: true });
  }

  /* ---------- the pages ---------- */
  // the team is shown once it's switched on in the admin panel and has someone in it
  const teamShown = () => { const t = store.read('team.json', { visible: false, members: [] }); return t.visible === true && t.members.length > 0; };
  const ABOUT_TEAM = 4; // the About page shows the first few; the team page shows everyone

  function applyPage(html, page, lang) {
    const team = store.read('team.json', { visible: false, members: [] });
    if (!teamShown()) {
      html = html.replace(/\s*<a class="footer-team" [^>]*>[^<]*<\/a>/g, '');
      if (page === 'about.html') html = html.replace(/\s*<!-- ===== Meet our team ===== -->\s*<section class="team"[\s\S]*?<\/section>/, '');
    } else if (page === 'about.html') {
      const few = { ...team, members: team.members.slice(0, ABOUT_TEAM) };
      html = html.replace(/<ul class="team-grid" data-team><\/ul>/, `<ul class="team-grid" data-team>${teamCards(few, lang)}</ul>`);
    } else if (page === 'team.html') {
      html = html.replace(/<ul class="team-grid" data-team><\/ul>/, `<ul class="team-grid" data-team>${teamCards(team, lang)}</ul>`);
    }
    // the company profile: each language's link only when its PDF is uploaded; the block goes when neither is
    const profile = store.read('profile.json', { ar: '', en: '' });
    const ok = (src) => /^\/uploads\/[a-f0-9]{24}\.pdf$/.test(src || '');
    for (const l of ['ar', 'en']) {
      html = ok(profile[l])
        ? html.replace(new RegExp(`(<a class="profile-link" data-profile="${l}" href=")[^"]*"`, 'g'), `$1${profile[l]}"`)
        : html.replace(new RegExp(`\\s*<a class="profile-link" data-profile="${l}"[^>]*>[\\s\\S]*?</a>`, 'g'), '');
    }
    if (!ok(profile.ar) && !ok(profile.en)) {
      html = html.replace(/\s*<!-- ===== Company profile ===== -->\s*<section class="profile-dl"[\s\S]*?<\/section>/, '')
        .replace(/\s*<a class="footer-profile" [^>]*>[^<]*<\/a>/g, '');
    } else {
      // the footer's link opens the page's own language, or the other one when only that exists
      const src = ok(profile[lang]) ? profile[lang] : (ok(profile.ar) ? profile.ar : profile.en);
      html = html.replace(/(<a class="footer-profile" href=")[^"]*"/g, `$1${src}"`);
    }
    return html;
  }

  /* ---------- rate limits: a few requests per address per window ---------- */
  const hits = new Map();
  const limited = (key, max, windowMs) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    return list.length > max;
  };
  setInterval(() => { const now = Date.now(); for (const [k, l] of hits) if (l.every((t) => now - t > 3600e3)) hits.delete(k); }, 600e3).unref();

  /* ---------- POST /api/subscribe { email, name, lang, website } ---------- */
  async function subscribe(req, res) {
    if (req.method !== 'POST') return json(res, 405, { ok: false });
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { ok: false, error: 'type' });
    let b;
    try { b = JSON.parse((await readBody(req, 4 * 1024)).toString('utf8')); } catch { return json(res, 400, { ok: false, error: 'json' }); }
    if (!b || typeof b !== 'object') return json(res, 400, { ok: false, error: 'json' });
    if (str(b.website, 200)) return json(res, 200, { ok: true }); // the hidden field: only bots fill it in
    if (limited(`s:${clientIp(req)}`, 5, 600e3)) return json(res, 429, { ok: false, error: 'rate' });
    const email = str(b.email, 254).toLowerCase();
    if (!EMAIL.test(email)) return json(res, 422, { ok: false, error: 'email' });
    // already on the list: the same "thank you", so the form never tells anyone who is subscribed
    await store.update('subscribers.json', [], (list) => {
      if (!list.some((s) => s.email === email)) {
        list.push({ id: crypto.randomBytes(6).toString('hex'), email, name: str(b.name, 120), lang: b.lang === 'en' ? 'en' : 'ar', date: new Date().toISOString() });
        console.log(`[newsletter] new subscriber (${list.length} in all)`);
      }
      return list;
    });
    return json(res, 200, { ok: true });
  }

  /* ---------- POST /api/apply (multipart: the fields, and an optional PDF CV) ---------- */
  let appQueue = Promise.resolve();
  const serial = (job) => { const run = appQueue.then(job, job); appQueue = run.catch(() => {}); return run; };
  const readApps = async () => {
    let raw = '';
    try { raw = await fsp.readFile(APPS, 'utf8'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    return raw.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  };
  const writeApps = async (list) => {
    const tmp = `${APPS}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fsp.writeFile(tmp, list.map((a) => JSON.stringify(a)).join('\n') + (list.length ? '\n' : ''), 'utf8');
    await fsp.rename(tmp, APPS);
  };

  async function applyJob(req, res) {
    if (req.method !== 'POST') return json(res, 405, { ok: false });
    const type = String(req.headers['content-type'] || '');
    if (!type.startsWith('multipart/form-data')) return json(res, 415, { ok: false, error: 'type' });
    let buf;
    try { buf = await readBody(req, CV_MAX + 64 * 1024); } catch { return json(res, 413, { ok: false, error: 'size' }); }
    const parts = parseMultipart(buf, type);
    if (!parts) return json(res, 400, { ok: false, error: 'form' });
    const field = (n) => { const p = parts.find((x) => x.name === n && x.filename === undefined); return p ? p.body.toString('utf8') : ''; };
    if (str(field('website'), 200)) return json(res, 200, { ok: true }); // bots
    if (limited(`a:${clientIp(req)}`, 3, 3600e3)) return json(res, 429, { ok: false, error: 'rate' });

    const a = {
      name: str(field('name'), 120), email: str(field('email'), 254), phone: PhoneNumber.normalize(str(field('phone'), 40), str(field('dial'), 4).replace(/\D/g, '')),
      field: FIELDS_OF_WORK[field('field')] ? field('field') : '', experience: EXPERIENCE[field('experience')] ? field('experience') : '',
      portfolio: httpUrl(field('portfolio')), about: str(field('about'), 3000), lang: field('lang') === 'en' ? 'en' : 'ar',
    };
    if (a.name.length < 2 || !a.phone || !EMAIL.test(a.email) || !a.field || a.about.length < 10) return json(res, 422, { ok: false, error: 'invalid' });
    const cv = parts.find((p) => p.name === 'cv' && p.filename !== undefined && p.body.length);
    if (cv && (cv.body.length > CV_MAX || cv.body.slice(0, 5).toString('latin1') !== '%PDF-')) return json(res, 422, { ok: false, error: 'cv' });

    a.id = crypto.randomUUID();
    a.date = new Date().toISOString();
    a.read = false;
    a.cv = Boolean(cv);
    await serial(async () => {
      await fsp.mkdir(appDir, { recursive: true });
      if (cv) await fsp.writeFile(path.join(appDir, `${a.id}.pdf`), cv.body);
      await fsp.appendFile(APPS, JSON.stringify(a) + '\n', 'utf8');
    });
    console.log(`[careers] application ${a.id} (${a.field}${a.cv ? ', with CV' : ''})`);
    return json(res, 200, { ok: true });
  }

  /* ---------- the admin panel's routes (signed in already; lib/admin.js checks writes come from the panel) ---------- */
  async function admin(req, res, route, { readJson, who, guardWrite }) {
    const method = req.method;
    if (route === '/applications' && method === 'GET') {
      const list = (await readApps()).reverse();
      return json(res, 200, { ok: true, fields: FIELDS_OF_WORK, experience: EXPERIENCE, applications: list });
    }
    const am = route.match(/^\/applications\/([0-9a-f-]{36})(\/cv)?$/);
    if (am && am[2] && method === 'GET') {
      const file = path.join(appDir, `${am[1]}.pdf`);
      let st;
      try { st = await fsp.stat(file); } catch { throw new Bad('السيرة الذاتية غير موجودة', 404); }
      res.writeHead(200, {
        'Content-Type': 'application/pdf', 'Content-Length': st.size, 'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="cv-${am[1].slice(0, 8)}.pdf"`, 'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(file).pipe(res);
      return true;
    }
    if (am && !am[2] && (method === 'PATCH' || method === 'DELETE')) {
      guardWrite(req);
      const b = method === 'PATCH' ? await readJson(req, 1024) : {};
      let found = false;
      await serial(async () => {
        let list = await readApps();
        if (method === 'DELETE') { const n = list.filter((x) => x.id !== am[1]); found = n.length !== list.length; list = n; }
        else for (const x of list) if (x.id === am[1]) { x.read = Boolean(b.read); found = true; }
        if (found) await writeApps(list);
        if (found && method === 'DELETE') await fsp.rm(path.join(appDir, `${am[1]}.pdf`), { force: true });
      });
      if (!found) throw new Bad('الطلب غير موجود', 404);
      if (method === 'DELETE') console.log(`[admin] ${who} deleted application ${am[1]}`);
      return json(res, 200, { ok: true });
    }

    if (route === '/subscribers' && method === 'GET') return json(res, 200, { ok: true, subscribers: store.read('subscribers.json', []) });
    if (route === '/subscribers.csv' && method === 'GET') {
      const cell = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      const rows = store.read('subscribers.json', []).map((s) => [s.email, s.name, s.lang === 'en' ? 'English' : 'العربية', s.date.slice(0, 10)].map(cell).join(','));
      // a BOM so Excel opens the Arabic names as Arabic
      const body = '﻿' + [['email', 'name', 'language', 'date'].map(cell).join(','), ...rows].join('\r\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="puzzlex-newsletter.csv"', 'Cache-Control': 'no-store' });
      res.end(body);
      return true;
    }
    const sm = route.match(/^\/subscribers\/([a-f0-9]{12})$/);
    if (sm && method === 'DELETE') {
      guardWrite(req);
      let found = false;
      await store.update('subscribers.json', [], (list) => { const n = list.filter((s) => s.id !== sm[1]); found = n.length !== list.length; return n; });
      if (!found) throw new Bad('المشترك غير موجود', 404);
      console.log(`[admin] ${who} removed a newsletter subscriber`);
      return json(res, 200, { ok: true });
    }

    if (route === '/profile' && method === 'GET') return json(res, 200, { ok: true, profile: store.read('profile.json', { ar: '', en: '' }) });
    const pm = route.match(/^\/profile\/(ar|en)$/);
    if (pm && method === 'DELETE') {
      guardWrite(req);
      await store.update('profile.json', { ar: '', en: '' }, (p) => ({ ...p, [pm[1]]: '' }));
      console.log(`[admin] ${who} removed the ${pm[1]} company profile`);
      return json(res, 200, { ok: true, profile: store.read('profile.json', { ar: '', en: '' }) });
    }
    if (pm && method === 'POST') {
      // the PDF as the body, streamed to disk (a profile can be tens of megabytes)
      guardWrite(req);
      if (Number(req.headers['content-length']) > PROFILE_MAX) throw new Bad('الملف كبير جداً (الحد 80 ميغابايت) — صدّر الملف بجودة أقل للويب', 413);
      const name = `${crypto.randomBytes(12).toString('hex')}.pdf`;
      const tmp = path.join(store.uploadsDir, `${name}.part`);
      await fsp.mkdir(store.uploadsDir, { recursive: true });
      let size = 0, head = Buffer.alloc(0);
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(tmp);
        req.on('data', (chunk) => {
          size += chunk.length;
          if (head.length < 5) head = Buffer.concat([head, chunk]).slice(0, 5);
          if (size > PROFILE_MAX) { req.destroy(); out.destroy(); reject(new Bad('الملف كبير جداً (الحد 80 ميغابايت)', 413)); return; }
          if (!out.write(chunk)) { req.pause(); out.once('drain', () => req.resume()); }
        });
        req.on('end', () => out.end(resolve));
        req.on('error', reject);
        out.on('error', reject);
      }).catch(async (err) => { await fsp.rm(tmp, { force: true }); throw err; });
      if (head.toString('latin1') !== '%PDF-') { await fsp.rm(tmp, { force: true }); throw new Bad('الملف ليس PDF', 415); }
      await fsp.rename(tmp, path.join(store.uploadsDir, name));
      await store.update('profile.json', { ar: '', en: '' }, (p) => ({ ...p, [pm[1]]: `/uploads/${name}` }));
      console.log(`[admin] ${who} uploaded the ${pm[1]} company profile (${Math.round(size / 1024)} KB)`);
      return json(res, 200, { ok: true, profile: store.read('profile.json', { ar: '', en: '' }) });
    }
    return false;
  }

  return { seed, teamShown, applyPage, subscribe, applyJob, admin };
}

module.exports = { createCompany, cleanTeam, parseMultipart, FIELDS_OF_WORK, EXPERIENCE };
