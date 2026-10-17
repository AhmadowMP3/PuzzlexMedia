# PuzzleX Media — website

Bilingual website (Arabic RTL at `/`, English LTR at `/en/`) for PuzzleX Media —
"نحن القطعة الناقصة في أحجيتك", *we are the missing piece in your puzzle*.

Plain HTML, CSS and JavaScript (GSAP from cdnjs), served by a small Node server that also
handles the contact form. Ships as one Docker image.

## Deploy on a VPS (Docker)

```bash
git clone https://github.com/AhmadowMP3/PuzzlexMedia.git puzzlex
cd puzzlex
cp .env.example .env      # then edit .env (email settings, see below)
docker compose up -d --build
```

The site is now on port **8080**. Check it with `curl http://localhost:8080/healthz`.

**Domain + HTTPS:** put a reverse proxy in front (nginx, Caddy, Traefik or Cloudflare) that forwards
`www.puzzlexmedia.com` to `127.0.0.1:8080`, and set `TRUST_PROXY=1` in `.env`. With a proxy on the same
server, change the port line in `docker-compose.yml` to `"127.0.0.1:8080:8080"` so 8080 isn't public.
A minimal Caddy setup:

```
www.puzzlexmedia.com {
    reverse_proxy 127.0.0.1:8080
}
puzzlexmedia.com {
    redir https://www.puzzlexmedia.com{uri}
}
```

**Update after changes:** `git pull && docker compose up -d --build`

## Contact form

Every message is appended to `/data/messages.jsonl` inside the container (a Docker volume, kept across
updates). To read them:

```bash
docker compose exec web cat /data/messages.jsonl
```

To also get each message by email, fill in `CONTACT_TO` and the `SMTP_*` settings in `.env` and run
`docker compose up -d`. If email fails, the message is still saved and the error is in `docker compose logs`.

Built in: required-field checks on both sides, a hidden spam-trap field, 5 messages per visitor per
10 minutes, 16 KB size limit.

## Settings (`.env`)

| Name | What it does |
| --- | --- |
| `SITE_URL` | Public address used in share previews and the sitemap (default `https://www.puzzlexmedia.com`) |
| `TRUST_PROXY` | `1` behind a reverse proxy, so rate limits use the visitor's real IP |
| `CONTACT_TO` | Where contact messages are emailed |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Your mail provider's SMTP details |

## What the server does

- Serves the pages with clean URLs (`/about`, `/en/services`), Brotli/gzip compression and long caching
  for versioned assets (`?v=NN`)
- 404 page in the right language; server files (`server.js`, `package.json`, …) are never served
- Fills in the share preview (title, description) for each project: `project.html?id=…`
- `POST /api/contact`, `GET /healthz`, `robots.txt`, `sitemap.xml`

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Messages go to `./data/messages.jsonl`.

## Files

```
*.html, en/*.html     pages (Arabic / English)
styles.css            all styles, dark + light themes
main.js               shared helpers + the home-page puzzle hero
sections.js           home: values, partners puzzle, 3D piece pop-up
pages.js              inner pages, contact form, 404
projects.js           project data (Arabic + English); also read by the server
loader.js, cursor.js, theme.js
assets/               icon, fonts, partner logos (WebP), share image
server.js             the web server
Dockerfile, docker-compose.yml, .env.example
source-files/tools/make_en.py   rebuilds en/ from the Arabic pages
```

## Editing text

Change the Arabic page, add the new strings' English to the `EN` table in
`source-files/tools/make_en.py`, then run `npm run build:en` (needs Python). It lists anything it
can't translate. Text inside the scripts uses `T('عربي', 'English')`.
After editing CSS or JS, bump the `?v=NN` number in the pages so browsers fetch the new file.

## Still placeholder

Phone, email, WhatsApp and social links, and the project images (generated placeholders).
