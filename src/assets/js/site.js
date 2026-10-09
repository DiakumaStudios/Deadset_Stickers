/* Deadset Stickers: shared behaviour for every page. */
(() => {
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- toast (shared with page scripts) ---------- */
const toastEl = $('#toast'); let toastT;
const toast = t => { toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 4500); };
/* ---------- cart (kept in this browser until checkout) ---------- */
const CART_KEY = 'deadset-cart-v1';
const cart = {
  MAX: 20,
  get() { try { const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(c) ? c : []; } catch { return []; } },
  set(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); }
    catch {   // storage full: keep the order, drop the little preview pictures
      localStorage.setItem(CART_KEY, JSON.stringify(items.map(i => ({...i, thumb: null}))));
    }
    cart.badge();
  },
  add(item) { const items = cart.get(); items.push({id: crypto.randomUUID(), ...item}); cart.set(items); },
  remove(id) { cart.set(cart.get().filter(i => i.id !== id)); },
  clear() { try { localStorage.removeItem(CART_KEY); } catch {} cart.badge(); },
  badge() {
    const n = cart.get().length;
    $$('.cart-count').forEach(el => { el.textContent = n; el.hidden = n === 0; });
    $$('.cart-btn').forEach(el => el.setAttribute('aria-label', `Cart, ${n} design${n === 1 ? '' : 's'}`));
  }
};
// After a successful payment Stripe sends people to /thanks/?order=..., so empty the cart.
if (location.pathname === '/thanks/' && new URLSearchParams(location.search).has('order')) cart.clear();
cart.badge();
addEventListener('storage', e => { if (e.key === CART_KEY) cart.badge(); });

window.Deadset = {toast, RM, $, $$, clamp, cart};

/* ---------- small drawn stickers ---------- */
const MUS = '#c5a64f';
const F = 'font-family="Archivo Black, Arial Black, Impact, sans-serif"';
const SVG = {
  stamp: `<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Approved stamp"><rect x="6" y="6" width="288" height="108" rx="10" fill="none" stroke="${MUS}" stroke-width="8"/><rect x="20" y="20" width="260" height="80" rx="4" fill="none" stroke="${MUS}" stroke-width="3"/><text x="150" y="75" text-anchor="middle" ${F} font-size="38" fill="${MUS}">APPROVED</text></svg>`
};
$$('[data-svg]').forEach(el => { if (SVG[el.dataset.svg]) el.innerHTML = SVG[el.dataset.svg]; });

/* ---------- text splitting ---------- */
$$('.split').forEach(h => $$('.line > span', h).forEach((s, i) => s.style.setProperty('--i', i)));
$$('.scrub').forEach(el => { el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' '); });
const fw = $('.foot-word'); if (fw) fw.innerHTML = [...fw.textContent].map(c => `<span>${c}</span>`).join('');
$$('[data-marquee]').forEach(t => { t.innerHTML = t.innerHTML.repeat(4); });
const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), {threshold: .12, rootMargin: '0px 0px -4% 0px'});
const arm = () => $$('.rv').forEach(el => io.observe(el));

/* ---------- page wipe between pages ---------- */
const wipe = $('.wipe');
const slide = (from, to) => {
  wipe.getAnimations().forEach(a => a.cancel());
  wipe.style.visibility = 'visible';
  if (RM) { wipe.style.transform = `translateY(${to})`; return Promise.resolve(); }
  const a = wipe.animate([{transform: `translateY(${from})`}, {transform: `translateY(${to})`}], {duration: 650, easing: 'cubic-bezier(.76,0,.24,1)'});
  wipe.style.transform = `translateY(${to})`;
  return a.finished;
};
const wipeOut = () => slide('0%', '-101%').then(() => { wipe.style.visibility = 'hidden'; });
let leaving = false;
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target && a.target !== '_self') return;
  if (a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) return;
  if (url.pathname === location.pathname && url.search === location.search) {
    if (url.hash) return;                 // same-page jump
    e.preventDefault(); document.body.classList.remove('menu-open'); window.scrollTo({top: 0, behavior: RM ? 'auto' : 'smooth'}); return;
  }
  e.preventDefault();
  if (leaving) return; leaving = true;
  slide('100%', '0%').then(() => { location.href = url.href; });
});
// Coming back with the browser's back button can restore a covered page, so uncover it.
addEventListener('pageshow', e => { if (e.persisted) { leaving = false; wipeOut(); } });

/* ---------- mobile menu ---------- */
const menuBtn = $('.menu-btn');
menuBtn.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  menuBtn.setAttribute('aria-expanded', open);
});
$$('[data-scrollto]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.scrollto).scrollIntoView({behavior: RM ? 'auto' : 'smooth'})));

/* ---------- things that move with scrolling ---------- */
const C = {
  px: $$('[data-speed]').map(el => ({el, s: parseFloat(el.dataset.speed), m: parseFloat(el.dataset.mouse || 0)})),
  spin: $$('[data-spin]').map(el => ({el, s: parseFloat(el.dataset.spin)})),
  marq: $$('[data-marquee]').map(t => ({t, x: 0, dir: +t.dataset.marquee, w: 0})),
  where: $$('[data-dir]').map(el => ({el, dir: +el.dataset.dir})),
  how: $('.how'), howTrack: $('.how-track'), howBar: $('.how-bar'),
  scrub: $$('.scrub').map(el => ({el, words: $$('.w', el), last: -1}))
};
function sizeHow() {
  const h = C.how; if (!h) return;
  if (innerWidth <= 760) { h.style.height = ''; C.howTrack.style.transform = ''; h._dist = 0; return; }
  const dist = Math.max(0, C.howTrack.scrollWidth - innerWidth);
  h._dist = dist;
  h.style.height = (dist + innerHeight) + 'px';
}

const bar = $('.progress span'), head = $('.site-head'), brandBadge = $('.brand-badge'), cursor = $('.cursor');
let lastY = scrollY, vel = 0, cx = innerWidth / 2, cy = innerHeight / 2, mx = cx, my = cy;
function frame() {
  const y = scrollY, d = y - lastY; lastY = y; vel += (d - vel) * .2;
  const docH = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${docH > 0 ? y / docH : 0})`;
  head.classList.toggle('scrolled', y > 20);
  brandBadge.style.transform = `rotate(${Math.sin(y * .008) * 12}deg)`;
  C.spin.forEach(o => o.el.style.setProperty('--spin', (y * o.s) + 'deg'));
  if (!RM) {
    const pk = innerWidth < 900 ? .35 : 1;
    const nx = mx / innerWidth - .5, ny = my / innerHeight - .5;
    C.px.forEach(o => { o.el.style.transform = `translate3d(${nx * o.m}px,${y * o.s * pk + ny * o.m * .6}px,0)`; });
    const boost = 1 + Math.min(Math.abs(vel), 50) * .3;
    C.marq.forEach(m => {
      if (!m.w) m.w = m.t.scrollWidth / 2;
      m.x -= boost * m.dir;
      if (m.x <= -m.w) m.x += m.w;
      if (m.x > 0) m.x -= m.w;
      m.t.style.transform = `translate3d(${m.x}px,0,0)`;
    });
    const sk = clamp(vel * -.3, -12, 12);
    C.where.forEach(o => {
      const r = o.el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const prog = innerHeight - r.top;
      const x = o.dir === 1 ? -prog * .45 : -o.el.scrollWidth * .42 + prog * .45;
      o.el.style.transform = `translate3d(${x}px,0,0) skewX(${sk}deg)`;
    });
  }
  if (C.how && C.how._dist > 0) {
    const r = C.how.getBoundingClientRect();
    const total = C.how.offsetHeight - innerHeight;
    const p = clamp(-r.top / total);
    C.howTrack.style.transform = `translate3d(${-p * C.how._dist}px,0,0)`;
    C.howBar.style.setProperty('--p', p);
  }
  C.scrub.forEach(s => {
    const r = s.el.getBoundingClientRect();
    const p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .25));
    const n = Math.round(p * s.words.length);
    if (n !== s.last) { s.words.forEach((w, i) => w.classList.toggle('on', i < n)); s.last = n; }
  });
  mx += (cx - mx) * .22; my += (cy - my) * .22;
  cursor.style.transform = `translate3d(${mx}px,${my}px,0)`;
  requestAnimationFrame(frame);
}
addEventListener('pointermove', e => { cx = e.clientX; cy = e.clientY; if (e.pointerType === 'mouse') cursor.classList.add('live'); }, {passive: true});
document.addEventListener('pointerleave', () => cursor.classList.remove('live'));
document.addEventListener('pointerover', e => {
  const t = e.target;
  cursor.classList.toggle('hide', !!t.closest('.row'));
  cursor.classList.toggle('hover', !!t.closest('a,button,label,.shot,.step'));
});

/* ---------- hover toys ---------- */
$$('.row').forEach(row => {
  const f = $('.follower', row); if (!f) return; let lx = null;
  row.addEventListener('pointermove', e => {
    const r = row.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const dx = lx === null ? 0 : x - lx; lx = x;
    f.style.setProperty('--fx', x + 'px'); f.style.setProperty('--fy', y + 'px');
    f.style.setProperty('--fr', clamp(dx * 1.6, -28, 28) + 'deg');
  });
  row.addEventListener('pointerleave', () => { lx = null; });
});

/* sideways sticker reel */
$$('.reel').forEach(reel => {
  const wrap = reel.closest('section'), barEl = $('.reel-bar span', wrap);
  const prev = $('[data-reel="-1"]', wrap), next = $('[data-reel="1"]', wrap);
  const step = () => { const c = $('.shot', reel); return c ? c.offsetWidth + parseFloat(getComputedStyle(reel).columnGap || 24) : 300; };
  const sync = () => {
    const max = reel.scrollWidth - reel.clientWidth;
    const vis = reel.scrollWidth ? reel.clientWidth / reel.scrollWidth : 1;
    const p = max > 0 ? reel.scrollLeft / max : 0;
    const trackW = barEl.parentElement.clientWidth;
    barEl.style.setProperty('--w', (vis * 100) + '%');
    barEl.style.setProperty('--x', (p * trackW * (1 - vis)) + 'px');
    prev.disabled = reel.scrollLeft <= 2; next.disabled = reel.scrollLeft >= max - 2;
  };
  [prev, next].forEach(b => b.addEventListener('click', () => reel.scrollBy({left: step() * +b.dataset.reel, behavior: RM ? 'auto' : 'smooth'})));
  reel.addEventListener('scroll', sync, {passive: true});
  addEventListener('resize', sync);
  new ResizeObserver(sync).observe(reel);
  let down = false, sx = 0, sl = 0, moved = false;
  reel.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = reel.scrollLeft; });
  addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 4) { moved = true; reel.classList.add('dragging'); }
    if (moved) reel.scrollLeft = sl - dx;
  });
  addEventListener('pointerup', () => {
    if (!down) return; down = false;
    if (moved) { const sl2 = reel.scrollLeft; reel.classList.remove('dragging'); reel.scrollLeft = sl2; }
  });
  reel.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
  });
  sync();
});

$$('.magnetic').forEach(b => {
  b.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = b.getBoundingClientRect();
    b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .4}px)`;
  });
  b.addEventListener('pointerleave', () => { b.style.transform = ''; });
});
$$('.faq-q').forEach(b => b.addEventListener('click', () => {
  const open = b.parentElement.classList.toggle('open');
  b.setAttribute('aria-expanded', open);
}));
// Links like "#artwork-requirements" open that FAQ answer and scroll to it.
const openFaq = id => {
  const item = id && document.getElementById(id);
  if (!item || !item.classList.contains('faq-item')) return;
  item.classList.add('open'); $('.faq-q', item).setAttribute('aria-expanded', 'true');
  setTimeout(() => item.scrollIntoView({behavior: RM ? 'auto' : 'smooth', block: 'center'}), 50);
};
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-open-faq]'); if (!a) return;
  e.preventDefault(); openFaq(a.getAttribute('href').slice(1));
});
if (location.hash) openFaq(location.hash.slice(1));

/* ---------- resize ---------- */
let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { C.marq.forEach(m => { m.w = m.t.scrollWidth / 2; }); sizeHow(); }, 150); });

/* ---------- start ---------- */
sizeHow();
requestAnimationFrame(frame);
Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(1400)]).then(async () => {
  C.marq.forEach(m => { m.w = m.t.scrollWidth / 2; });
  sizeHow();
  await wait(150);
  await wipeOut();
  arm();
});
})();
