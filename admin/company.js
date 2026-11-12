/* PuzzleX admin — the team, the company profile, the newsletter and job applications (lib/company.js).
   Loaded after admin.js and uses its helpers (h, api, toast, ask, setPending, refreshBar, upload, dropZone,
   pickFiles, busy, clone, same, asset, fmtDate). */
'use strict';

/* =========================================================
   The team ("Meet our team" on the About page)
   ========================================================= */
const TEAM_LINKS = [['linkedin', 'LinkedIn'], ['instagram', 'Instagram'], ['x', 'X'], ['behance', 'Behance'], ['website', 'موقع شخصي']];
const blankMember = () => ({ id: '', name: { ar: '', en: '' }, role: { ar: '', en: '' }, bio: { ar: '', en: '' }, photo: '', links: {} });

async function viewTeam(view) {
  const r = await api('GET', '/team');
  let saved = r.data, rev = r.rev, team = clone(r.data);
  setPending({
    label: 'الفريق',
    count: () => (same(team, saved) ? 0 : 1),
    discard: () => { team = clone(saved); draw(); },
    save: async () => { const s = await api('PUT', '/team', { rev, data: team }); saved = s.data; rev = s.rev; team = clone(saved); draw(); },
  });
  const body = h('div', { class: 'grid' });
  const pairField = (label, obj, key, opts = {}) => h('div', { class: 'grid two' },
    ['ar', 'en'].map((l) => h('label', { class: 'field' }, h('span', null, `${label} (${l === 'ar' ? 'عربي' : 'English'})`),
      h(opts.long ? 'textarea' : 'input', {
        value: obj[key][l], dir: l === 'ar' ? 'rtl' : 'ltr', rows: opts.long ? 3 : null, maxlength: opts.max || 160,
        oninput: (e) => { obj[key][l] = e.target.value; refreshBar(); },
      }))));

  function memberCard(m, i) {
    const photo = m.photo
      ? h('img', { class: 'team-admin-photo', src: asset(m.photo), alt: '' })
      : h('div', { class: 'team-admin-photo empty' }, 'لا صورة');
    return h('div', { class: 'card grid' },
      h('div', { class: 'row', style: 'align-items:flex-start;gap:16px' },
        h('div', { class: 'grid', style: 'gap:8px;justify-items:center' }, photo,
          h('button', {
            type: 'button', class: 'btn btn-small', onclick: () => pickFiles(false, async ([f]) => {
              try { toast('جارٍ رفع الصورة…'); m.photo = await upload(f, 800); draw(); } catch (err) { toast(err.message, 'err'); }
            }),
          }, m.photo ? 'تغيير الصورة' : 'رفع صورة'),
          m.photo ? h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { m.photo = ''; draw(); } }, 'إزالة الصورة') : null),
        h('div', { class: 'grid', style: 'flex:1;min-width:0' },
          pairField('الاسم', m, 'name', { max: 120 }),
          pairField('المنصب', m, 'role', { max: 160 }),
          pairField('نبذة', m, 'bio', { long: true, max: 600 }),
          h('div', { class: 'grid two' }, TEAM_LINKS.map(([k, label]) => h('label', { class: 'field' }, h('span', null, label),
            h('input', { type: 'url', dir: 'ltr', value: m.links[k] || '', placeholder: 'https://…', oninput: (e) => { if (e.target.value.trim()) m.links[k] = e.target.value.trim(); else delete m.links[k]; refreshBar(); } })))))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-small', disabled: i === 0, onclick: () => { [team.members[i - 1], team.members[i]] = [team.members[i], team.members[i - 1]]; draw(); } }, '↑ تقديم'),
        h('button', { type: 'button', class: 'btn btn-small', disabled: i === team.members.length - 1, onclick: () => { [team.members[i + 1], team.members[i]] = [team.members[i], team.members[i + 1]]; draw(); } }, '↓ تأخير'),
        h('span', { class: 'spacer' }),
        h('button', {
          type: 'button', class: 'btn btn-small btn-danger',
          onclick: async () => { if (await ask(`حذف ${m.name.ar || m.name.en || 'هذا العضو'} من الفريق؟`, { yes: 'حذف', danger: true })) { team.members.splice(i, 1); draw(); } },
        }, 'حذف')));
  }

  function draw() {
    body.replaceChildren(
      h('div', { class: 'card row', style: 'align-items:center' },
        h('label', { class: 'tm-switch' },
          h('input', { type: 'checkbox', checked: team.visible, onchange: (e) => { team.visible = e.target.checked; refreshBar(); draw(); } }),
          h('span', null, team.visible ? 'القسم ظاهر في صفحة «من نحن»' : 'القسم مخفي عن الموقع')),
        h('span', { class: 'hint' }, team.visible && !team.members.length ? 'أضف شخصاً واحداً على الأقل ليظهر القسم.' : 'يظهر القسم فقط عندما يكون مفعّلاً وفيه شخص واحد على الأقل.')),
      ...team.members.map(memberCard),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { team.members.push(blankMember()); draw(); } }, '+ إضافة شخص'));
    refreshBar();
  }
  view.replaceChildren(
    h('div', { class: 'page-head' }, h('div', null,
      h('p', { class: 'kicker' }, 'TEAM'),
      h('h1', null, 'الفريق'),
      h('p', null, 'قسم «تعرّف على فريقنا» في صفحة «من نحن»: الصورة والاسم والمنصب والنبذة وحسابات التواصل لكل شخص. أخفِ القسم متى شئت دون حذف أحد.')),
      h('a', { class: 'btn btn-ghost', href: '/about.html#team-title', target: '_blank', rel: 'noopener' }, 'افتح صفحة «من نحن» ↗')),
    body);
  draw();
}

/* =========================================================
   The company profile (the PDFs opened from the About page)
   ========================================================= */
async function viewProfile(view) {
  setPending(null);
  let profile = (await api('GET', '/profile')).profile;
  const body = h('div', { class: 'grid two' });
  function sendPdf(lang, file, btn) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { toast('اختر ملف PDF', 'err'); return; }
    if (file.size > 80 * 1024 * 1024) { toast('الملف أكبر من 80 ميغابايت — صدّره بجودة أقل للويب', 'err'); return; }
    return busy(btn, () => new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/admin/profile/${lang}`);
      xhr.setRequestHeader('X-PX-Admin', '1');
      xhr.setRequestHeader('Content-Type', 'application/pdf');
      xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) btn.textContent = `جارٍ الرفع ${Math.round((e.loaded / e.total) * 100)}%`; });
      xhr.addEventListener('load', () => {
        let d = null;
        try { d = JSON.parse(xhr.responseText); } catch { /* below */ }
        if (d && d.ok) { profile = d.profile; toast('تم رفع الملف — ظاهر الآن في الموقع'); draw(); } else toast((d && d.error) || 'تعذّر رفع الملف', 'err');
        resolve();
      });
      xhr.addEventListener('error', () => { toast('تعذّر الاتصال بالخادم', 'err'); resolve(); });
      xhr.send(file);
    }));
  }
  function draw() {
    body.replaceChildren(...['ar', 'en'].map((lang) => {
      const src = profile[lang];
      const up = h('button', { type: 'button', class: 'btn btn-primary' }, src ? 'استبدال الملف' : 'رفع ملف PDF');
      up.onclick = () => pickFiles(false, ([f]) => sendPdf(lang, f, up), 'application/pdf,.pdf');
      return h('div', { class: 'card grid' },
        h('h2', { class: 'section-title', style: 'margin:0' }, lang === 'ar' ? 'البروفايل بالعربية' : 'البروفايل بالإنجليزية'),
        src ? h('p', null, '✅ ', h('a', { href: src, target: '_blank', rel: 'noopener' }, 'فتح الملف الحالي ↗')) : h('p', { class: 'muted' }, 'لا يوجد ملف بعد — الرابط لا يظهر في الموقع حتى ترفعه.'),
        h('div', { class: 'row' }, up,
          src ? h('button', {
            type: 'button', class: 'btn btn-danger', onclick: async (e) => {
              if (!await ask('إزالة هذا الملف من الموقع؟', { yes: 'إزالة', danger: true })) return;
              try { profile = (await busy(e.currentTarget, () => api('DELETE', `/profile/${lang}`))).profile; draw(); toast('أُزيل الملف'); } catch (err) { toast(err.message, 'err'); }
            },
          }, 'إزالة') : null));
    }));
  }
  view.replaceChildren(
    h('div', { class: 'page-head' }, h('div', null,
      h('p', { class: 'kicker' }, 'PROFILE'),
      h('h1', null, 'الملف التعريفي'),
      h('p', null, 'ملفا PDF يفتحان في المتصفح من قسم «الملف التعريفي» في صفحة «من نحن» ومن تذييل كل صفحة، ويستطيع الزائر تنزيلهما. صدّر الملف بجودة الويب (أقل من 20 ميغابايت يُفضّل) ليفتح بسرعة على الجوال.')),
      h('a', { class: 'btn btn-ghost', href: '/about.html#profile-title', target: '_blank', rel: 'noopener' }, 'افتح صفحة «من نحن» ↗')),
    body);
  draw();
}

/* =========================================================
   Newsletter subscribers
   ========================================================= */
async function viewNewsletter(view) {
  setPending(null);
  let list = (await api('GET', '/subscribers')).subscribers.slice().reverse();
  const table = h('div', { class: 'grid' });
  const search = h('input', { type: 'search', placeholder: 'ابحث بالبريد أو الاسم', class: 'input', oninput: () => draw() });
  function draw() {
    const q = search.value.trim().toLowerCase();
    const shown = q ? list.filter((s) => s.email.includes(q) || (s.name || '').toLowerCase().includes(q)) : list;
    table.replaceChildren(shown.length
      ? h('div', { class: 'card', style: 'padding:0;overflow:auto' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', null, 'البريد'), h('th', null, 'الاسم'), h('th', null, 'اللغة'), h('th', null, 'تاريخ الاشتراك'), h('th', null, ''))),
        h('tbody', null, shown.map((s) => h('tr', null,
          h('td', { class: 'ltr' }, h('a', { href: `mailto:${s.email}` }, s.email)), h('td', { dir: 'auto' }, s.name || '—'),
          h('td', null, s.lang === 'en' ? 'الإنجليزية' : 'العربية'), h('td', null, fmtDate(s.date)),
          h('td', null, h('button', {
            type: 'button', class: 'btn btn-small btn-danger', onclick: async (e) => {
              if (!await ask(`إزالة ${s.email} من النشرة؟`, { yes: 'إزالة', danger: true })) return;
              try { await busy(e.currentTarget, () => api('DELETE', `/subscribers/${s.id}`)); list = list.filter((x) => x !== s); draw(); toast('أُزيل المشترك'); } catch (err) { toast(err.message, 'err'); }
            },
          }, 'إزالة')))))))
      : h('p', { class: 'empty' }, list.length ? 'لا نتائج.' : 'لا مشتركين بعد. من يشترك من نموذج «ابقَ على اطلاع» أسفل صفحات الموقع يظهر هنا.'));
  }
  view.replaceChildren(
    h('div', { class: 'page-head' }, h('div', null,
      h('p', { class: 'kicker' }, 'NEWSLETTER'),
      h('h1', null, 'النشرة البريدية'),
      h('p', null, `${list.length} مشتركاً. صدّر القائمة إلى Excel لترسل النشرة من بريدك أو من أي خدمة رسائل جماعية.`)),
      h('a', { class: 'btn btn-primary', href: '/api/admin/subscribers.csv', download: 'puzzlex-newsletter.csv' }, 'تصدير إلى Excel (CSV)')),
    search, h('div', { style: 'height:12px' }), table);
  draw();
}

/* =========================================================
   Job applications (careers.html)
   ========================================================= */
async function viewApplications(view) {
  setPending(null);
  const r = await api('GET', '/applications');
  let apps = r.applications;
  const fieldName = (k) => (r.fields[k] || [k])[0], expName = (k) => (r.experience[k] || ['—'])[0];
  const list = h('div', { class: 'msgs' });
  const setRead = async (a, read) => { await api('PATCH', `/applications/${a.id}`, { read }); a.read = read; };
  function draw() {
    list.replaceChildren(...(apps.length ? apps.map((a) => {
      const d = h('details', { class: `msg${a.read ? '' : ' unread'}` },
        h('summary', null, h('span', { class: 'dot', 'aria-hidden': 'true' }),
          h('span', { class: 'who', dir: 'auto' }, a.name, h('small', null, ` — ${fieldName(a.field)}`)),
          h('span', { class: 'when' }, fmtDate(a.date))),
        h('div', { class: 'body' },
          h('dl', { class: 'kv' },
            h('dt', null, 'واتساب'), h('dd', null, h('a', { href: `https://wa.me/${a.phone.replace(/\D/g, '')}`, class: 'ltr', target: '_blank', rel: 'noopener' }, a.phone)),
            h('dt', null, 'البريد'), h('dd', null, h('a', { href: `mailto:${a.email}`, class: 'ltr' }, a.email)),
            h('dt', null, 'المجال'), h('dd', null, fieldName(a.field)),
            h('dt', null, 'الخبرة'), h('dd', null, a.experience ? expName(a.experience) : '—'),
            a.portfolio ? [h('dt', null, 'الأعمال'), h('dd', null, h('a', { href: a.portfolio, class: 'ltr', target: '_blank', rel: 'noopener noreferrer' }, a.portfolio))] : null,
            h('dt', null, 'لغة الصفحة'), h('dd', null, a.lang === 'en' ? 'الإنجليزية' : 'العربية')),
          h('div', { class: 'text', dir: 'auto' }, a.about),
          h('div', { class: 'row' },
            a.cv ? h('a', { class: 'btn btn-primary btn-small', href: `/api/admin/applications/${a.id}/cv` }, 'تنزيل السيرة الذاتية (PDF)') : h('span', { class: 'muted small' }, 'بلا سيرة ذاتية'),
            h('a', { class: 'btn btn-small', href: `https://wa.me/${a.phone.replace(/\D/g, '')}`, target: '_blank', rel: 'noopener' }, 'رد على واتساب'),
            h('button', { type: 'button', class: 'btn btn-small', 'data-read-toggle': '', onclick: async () => { try { await setRead(a, !a.read); draw(); } catch (err) { toast(err.message, 'err'); } } }, a.read ? 'تعليم كغير مقروء' : 'تعليم كمقروء'),
            h('span', { class: 'spacer' }),
            h('button', {
              type: 'button', class: 'btn btn-small btn-danger', onclick: async () => {
                if (!await ask(`حذف طلب ${a.name} وسيرته الذاتية نهائياً؟`, { yes: 'حذف', danger: true })) return;
                try { await api('DELETE', `/applications/${a.id}`); apps = apps.filter((x) => x !== a); draw(); toast('حُذف الطلب'); } catch (err) { toast(err.message, 'err'); }
              },
            }, 'حذف'))));
      d.addEventListener('toggle', () => {
        if (!d.open || a.read) return;
        setRead(a, true).then(() => { d.classList.remove('unread'); d.querySelector('[data-read-toggle]').textContent = 'تعليم كغير مقروء'; }).catch(() => {});
      });
      return d;
    }) : [h('p', { class: 'empty' }, 'لا طلبات توظيف بعد. ما يُرسل من صفحة «انضم لفريقنا» يظهر هنا.')]));
  }
  view.replaceChildren(
    h('div', { class: 'page-head' }, h('div', null,
      h('p', { class: 'kicker' }, 'CAREERS'),
      h('h1', null, 'طلبات التوظيف'),
      h('p', null, 'كل ما يُرسل من صفحة «انضم لفريقنا»، الأحدث أولاً. السير الذاتية محفوظة على الخادم ولا يصل إليها أحد إلا من اللوحة.')),
      h('a', { class: 'btn btn-ghost', href: '/careers.html', target: '_blank', rel: 'noopener' }, 'افتح الصفحة ↗')),
    list);
  draw();
}

VIEWS.team = viewTeam;
VIEWS.profile = viewProfile;
VIEWS.newsletter = viewNewsletter;
VIEWS.applications = viewApplications;
