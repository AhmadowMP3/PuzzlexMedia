/* PuzzleX Media — web server.
   Serves the site (Arabic at /, English at /en/), clean URLs, the 404 pages, per-project share previews,
   and the contact form: every message is appended to DATA_DIR/messages.jsonl and, when SMTP is set,
   emailed to CONTACT_TO. No framework; the only dependency is nodemailer.

   Settings come from the environment (see .env.example). Locally: `node server.js [port]`. */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const SITE_URL = (process.env.SITE_URL || 'https://www.puzzlexmedia.com').replace(/\/+$/, '');
const CANONICAL = 'https://www.puzzlexmedia.com'; // the address written into the pages
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

/* ---------- what may be served ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);
// the server's own files sit next to the site: never hand them out
const PRIVATE = new Set(['server.js', 'package.json', 'package-lock.json', 'dockerfile', 'docker-compose.yml',
  'readme.md', 'node_modules', 'source-files', 'data']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/* ---------- static files (read once, kept compressed in memory) ---------- */
const cache = new Map(); // abs path → { mtimeMs, body, gzip, br, etag }

async function load(file) {
  const st = await fsp.stat(file);
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit;
  let body = await fsp.readFile(file);
  const ext = path.extname(file).toLowerCase();
  // pages carry the canonical domain in their share tags; swap it when the site runs elsewhere
  if (SITE_URL !== CANONICAL && (ext === '.html' || ext === '.xml' || ext === '.txt')) {
    body = Buffer.from(body.toString('utf8').split(CANONICAL).join(SITE_URL));
  }
  const entry = { mtimeMs: st.mtimeMs, body, etag: `"${crypto.createHash('sha1').update(body).digest('base64url').slice(0, 20)}"` };
  if (COMPRESSIBLE.has(ext) && body.length > 1024) {
    entry.br = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    entry.gzip = zlib.gzipSync(body, { level: 9 });
  }
  cache.set(file, entry);
  return entry;
}

// URL path → file on disk, or null
function resolve(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p.includes('\0')) return null;
  const parts = p.split('/').filter(Boolean);
  if (parts.some((s) => s.startsWith('.'))) return null; // dotfiles, .git, ..
  if (parts.length && PRIVATE.has(parts[0].toLowerCase())) return null;
  const abs = path.resolve(ROOT, ...parts);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  const tries = p.endsWith('/') ? [path.join(abs, 'index.html')] : [abs, abs + '.html', path.join(abs, 'index.html')];
  for (const f of tries) {
    try { if (fs.statSync(f).isFile() && MIME[path.extname(f).toLowerCase()]) return f; } catch { /* next */ }
  }
  return null;
}

function send(req, res, status, entry, ext, headers = {}) {
  const h = { ...SECURITY_HEADERS, 'Content-Type': MIME[ext], ETag: entry.etag, Vary: 'Accept-Encoding', ...headers };
  if (status === 200 && req.headers['if-none-match'] === entry.etag) { res.writeHead(304, h); return res.end(); }
  const accept = req.headers['accept-encoding'] || '';
  let body = entry.body;
  if (entry.br && /\bbr\b/.test(accept)) { body = entry.br; h['Content-Encoding'] = 'br'; }
  else if (entry.gzip && /\bgzip\b/.test(accept)) { body = entry.gzip; h['Content-Encoding'] = 'gzip'; }
  h['Content-Length'] = body.length;
  res.writeHead(status, h);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function cacheControl(ext, query) {
  if (ext === '.html') return 'no-cache';                                   // always revalidate pages
  if (/(^|&)v=/.test(query)) return 'public, max-age=31536000, immutable';  // versioned assets (?v=NN)
  return 'public, max-age=86400';
}

/* ---------- per-project share previews (project.html?id=…) ---------- */
// projects.js is the browser's data file: run it in a sandbox to read the same list here
let projects = null;
function loadProjects() {
  const code = fs.readFileSync(path.join(ROOT, 'projects.js'), 'utf8');
  const read = (lang) => vm.runInNewContext(`${code}\n;({ PROJECTS, SECTORS })`, { document: { documentElement: { lang } } });
  projects = { ar: read('ar'), en: read('en') };
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function projectPage(html, id, en) {
  const p = projects[en ? 'en' : 'ar'].PROJECTS.find((x) => x.id === id);
  if (!p) return null;
  const title = `${p.title} — ${p.client} | PuzzleX Media`;
  const url = `${SITE_URL}/${en ? 'en/' : ''}project.html?id=${encodeURIComponent(p.id)}`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(p.summary)}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(title)}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(p.summary)}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${esc(url)}"`);
}

/* ---------- contact form ---------- */
const SERVICES = {
  identity: 'الهوية البصرية', 'social-design': 'السوشال ميديا والإعلانات', print: 'المطبوعات والإعلانات الطرقية',
  profiles: 'البروفايلات والعروض', 'ad-edit': 'المونتاج الإعلاني', 'intro-videos': 'الفيديوهات التعريفية',
  'event-videos': 'فيديوهات المناسبات والفعاليات', copywriting: 'كتابة المحتوى التسويقي', 'content-plan': 'خطة المحتوى الشهرية',
  community: 'إدارة التفاعل', kpi: 'تحليل الأداء', 'li-profile': 'لينكدإن · تحسين الحساب', 'li-content': 'لينكدإن · محتوى أسبوعي',
  'li-jobs': 'لينكدإن · التقديم لفرص العمل', 'li-coaching': 'لينكدإن · جلسات تدريب', 'li-audit': 'لينكدإن · تدقيق حساب الشركة',
  'li-plan': 'لينكدإن · خطة محتوى مؤسسي', 'li-talent': 'لينكدإن · استقطاب الكفاءات', 'li-ads': 'لينكدإن · حملات ممولة',
  other: 'غير متأكد — يحتاج استشارة',
};
const LIMITS = { name: 120, company: 160, email: 200, phone: 40, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

function validate(b) {
  const str = (k) => (typeof b[k] === 'string' ? b[k].trim().slice(0, LIMITS[k]) : '');
  const m = { name: str('name'), company: str('company'), email: str('email'), phone: str('phone'), message: str('message') };
  m.services = Array.isArray(b.services) ? [...new Set(b.services.filter((s) => typeof s === 'string' && SERVICES[s]))] : [];
  m.lang = b.lang === 'en' ? 'en' : 'ar';
  const ok = m.name.length >= 2 && EMAIL_RE.test(m.email) && (!m.phone || PHONE_RE.test(m.phone))
    && m.message.length >= 10 && m.services.length > 0;
  return ok ? m : null;
}

// a few messages per address per window is plenty for a real person
const hits = new Map();
const RATE = { max: 5, windowMs: 10 * 60 * 1000 };
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE.max;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (list.every((t) => now - t >= RATE.windowMs)) hits.delete(ip);
}, RATE.windowMs).unref();

let mailer = null;
if (process.env.SMTP_HOST && process.env.CONTACT_TO) {
  const nodemailer = require('nodemailer');
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function emailMessage(m) {
  const lines = [
    `الاسم: ${m.name}`, m.company ? `الشركة: ${m.company}` : null, `البريد: ${m.email}`, m.phone ? `الهاتف: ${m.phone}` : null,
    `اللغة: ${m.lang === 'en' ? 'English' : 'العربية'}`, '', 'القطع المطلوبة:', ...m.services.map((s) => `• ${SERVICES[s]}`),
    '', 'الرسالة:', m.message, '', `— ${m.date} · ${m.id}`,
  ].filter((l) => l !== null);
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.CONTACT_TO,
    replyTo: `"${m.name.replace(/"/g, '')}" <${m.email}>`,
    subject: `رسالة جديدة من الموقع — ${m.name}${m.company ? ` (${m.company})` : ''}`,
    text: lines.join('\n'),
  });
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || 'unknown';
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

async function handleContact(req, res) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { ok: false, error: 'type' });
  // collect bytes and decode once: a chunk boundary can fall inside a multi-byte Arabic character
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) return json(res, 413, { ok: false, error: 'size' });
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { ok: false, error: 'json' }); }
  if (!body || typeof body !== 'object') return json(res, 400, { ok: false, error: 'json' });
  // the hidden "website" field is only ever filled in by bots: pretend it worked
  if (typeof body.website === 'string' && body.website.trim()) return json(res, 200, { ok: true });
  const ip = clientIp(req);
  if (limited(ip)) return json(res, 429, { ok: false, error: 'rate' });
  const m = validate(body);
  if (!m) return json(res, 422, { ok: false, error: 'invalid' });
  m.id = crypto.randomUUID();
  m.date = new Date().toISOString();
  m.ip = ip;
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.appendFile(path.join(DATA_DIR, 'messages.jsonl'), JSON.stringify(m) + '\n', 'utf8');
  } catch (err) {
    console.error('[contact] could not save message', err);
    return json(res, 500, { ok: false, error: 'save' });
  }
  let emailed = false;
  if (mailer) {
    try { await emailMessage(m); emailed = true; } catch (err) { console.error('[contact] saved, but email failed:', err.message); }
  }
  console.log(`[contact] ${m.id} from ${m.email}${emailed ? ' (emailed)' : ''}`);
  json(res, 200, { ok: true });
}

/* ---------- routing ---------- */
async function notFound(req, res, urlPath) {
  const en = urlPath === '/en' || urlPath.startsWith('/en/');
  const file = path.join(ROOT, en ? 'en' : '', '404.html');
  send(req, res, 404, await load(file), '.html', { 'Cache-Control': 'no-cache' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (p === '/healthz') return json(res, 200, { ok: true });
    if (p === '/api/contact') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false }); }
      return await handleContact(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return json(res, 405, { ok: false }); }

    // the English pages use relative links: they need the trailing slash
    if (p === '/en') { res.writeHead(301, { Location: '/en/' + url.search }); return res.end(); }

    const file = resolve(p);
    if (!file) return await notFound(req, res, p);
    const ext = path.extname(file).toLowerCase();
    let entry = await load(file);

    if (path.basename(file) === 'project.html' && url.searchParams.get('id')) {
      const html = projectPage(entry.body.toString('utf8'), url.searchParams.get('id'), file.includes(`${path.sep}en${path.sep}`));
      if (html) {
        const body = Buffer.from(html);
        entry = { body, etag: `"${crypto.createHash('sha1').update(body).digest('base64url').slice(0, 20)}"`, gzip: zlib.gzipSync(body) };
      }
    }
    send(req, res, 200, entry, ext, { 'Cache-Control': cacheControl(ext, url.search.slice(1)) });
  } catch (err) {
    console.error('[server]', req.method, req.url, err);
    if (!res.headersSent) json(res, 500, { ok: false });
    else res.end();
  }
});

loadProjects();
server.listen(PORT, () => {
  console.log(`PuzzleX Media on http://localhost:${PORT} · messages → ${DATA_DIR} · email ${mailer ? `→ ${process.env.CONTACT_TO}` : 'off (no SMTP set)'}`);
});
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
