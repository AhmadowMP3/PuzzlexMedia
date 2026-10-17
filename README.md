# PuzzleX Media — website concept

A static, bilingual (Arabic RTL / English LTR) website for PuzzleX Media, built around the idea
"نحن القطعة الناقصة في أحجيتك" — *we are the missing piece in your puzzle*.

No build step: plain HTML, CSS and JavaScript, with GSAP + ScrollTrigger from cdnjs.

## Structure

```
concept/              the site (publish this folder)
  *.html              Arabic pages: index, about, services, work, project, contact, 404
  en/                 English pages, generated from the Arabic ones
  styles.css          all styles, dark + light themes
  main.js             shared helpers + the home-page puzzle hero
  sections.js         home: values star, partners puzzle + 3D piece pop-up
  pages.js            inner pages (about, services, work, project, contact, 404)
  projects.js         project data (Arabic + English)
  loader.js           first-visit loading puzzle
  cursor.js, theme.js custom cursor, light/dark switch
  assets/             icon, fonts, partner logos (WebP), share image
source-files/tools/
  make_en.py          rebuilds concept/en/ from the Arabic pages
```

## Run locally

```bash
cd concept
python -m http.server 5173
```

Then open http://localhost:5173.

## Updating the English pages

After changing text in an Arabic page, add the new strings' translations to the `EN` table in
`source-files/tools/make_en.py`, then run:

```bash
python -I source-files/tools/make_en.py concept
```

It lists any Arabic text it has no translation for. Strings inside the scripts use `T('عربي', 'English')`.

## Deploying (Cloudflare Pages)

Build command: none. Output directory: `concept`. `404.html` is picked up automatically.
The share-image tags point at `https://www.puzzlexmedia.com`; change them if the site lives elsewhere.

## Still placeholder

Phone, email, WhatsApp and social links; project images (generated placeholders); the contact
form is a demo and sends nothing until it is connected to a backend.
