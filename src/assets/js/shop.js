/* Deadset Stickers: the sticker builder (price calculator, artwork preview, checkout). */
(() => {
const {RM, $, $$, clamp} = window.Deadset;
if (!$('#pricing-data')) return;
let chosenFile = null, uploaded = null;   // the customer's artwork, and its upload once sent

/* ---------- shop: price calculator ---------- */
const PRICING = JSON.parse($('#pricing-data').textContent);
const SIZES = PRICING.sizes;
const QTYS = PRICING.rows.map(r => r.qty);
const PRICES = PRICING.rows.map(r => r.prices);
const POPULAR = PRICING.popularSize;   // gets the "Most popular" tag
const QUICK = PRICING.quickQuantities.filter(q => QTYS.includes(q));
let edge = 'white';
let si = POPULAR, qi = Math.max(0, QTYS.indexOf(100)), shown = 0, artRatio = 0.675;
const fmtQty = q => q.toLocaleString('en-AU');
const money = n => '$' + n.toLocaleString('en-AU', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const eachFmt = n => '$' + (n < 0.1 ? n.toFixed(3) : n.toFixed(2));
const sizeLabel = c => `${c} × ${c} cm`;

$('#sizeOpts').innerHTML = SIZES.map((z, i) =>
  `<label class="opt">${i === POPULAR ? '<span class="tag">Most popular</span>' : ''}<input type="radio" name="size" value="${i}"${i === si ? ' checked' : ''}><span class="opt-face"><strong>${z.cm} × ${z.cm}</strong><small data-size-each="${i}"></small></span></label>`).join('');
$('#qtySelect').innerHTML = QTYS.map((q, i) => `<option value="${i}"${i === qi ? ' selected' : ''}>${fmtQty(q)} stickers</option>`).join('');
$('#qtyQuick').innerHTML = QUICK.map(q => `<button type="button" class="chip" data-q="${QTYS.indexOf(q)}">${fmtQty(q)}</button>`).join('');
$('#sizeOpts').addEventListener('change', e => { si = +e.target.value; update(); });
$$('input[name=edge]').forEach(r => r.addEventListener('change', () => { edge = r.value; $('#stack').style.setProperty('--edge', edge === 'black' ? '#000' : '#fff'); renderArt(); update(); }));
$('#qtySelect').addEventListener('change', e => { qi = +e.target.value; update(); });
$('#qtyQuick').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; qi = +c.dataset.q; $('#qtySelect').value = qi; update(); });

const totalEl = $('#total');
let tweenId = 0;
function tween(from, to) {
  const id = ++tweenId;
  if (RM || from === to) { totalEl.textContent = money(to); return; }
  const t0 = performance.now(), dur = 550;
  const step = t => {
    if (id !== tweenId) return;
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    totalEl.textContent = money(p >= 1 ? to : from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  totalEl.classList.remove('bump'); void totalEl.offsetWidth; totalEl.classList.add('bump');
}
const ghostsFor = q => q < 100 ? 1 : q < 250 ? 2 : q < 1000 ? 3 : q < 5000 ? 4 : 5;
function update() {
  renderArt();
  const q = QTYS[qi], price = PRICES[qi][si], each = price / q;
  tween(shown, price); shown = price;
  $('#per').textContent = `${eachFmt(each)} per sticker`;
  const base = PRICES[0][si] / QTYS[0], save = Math.round((1 - each / base) * 100);
  $('#save').textContent = save > 0 ? `You save ${save}% per sticker compared to 50` : 'Order more and each sticker gets cheaper';
  $('#summarySize').textContent = `${fmtQty(q)} stickers at ${sizeLabel(SIZES[si].cm)}, ${edge} border`;
  $$('[data-size-each]').forEach(s => { const i = +s.dataset.sizeEach; s.textContent = eachFmt(PRICES[qi][i] / q) + ' each'; });
  $$('#qtyQuick .chip').forEach(c => c.classList.toggle('on', +c.dataset.q === qi));
  $$('#stack .ghost').forEach(g => g.classList.toggle('on', +g.style.getPropertyValue('--g') <= ghostsFor(q)));
  board();
}
function board() {
  const B = $('#board'); const W = B.clientWidth; if (!W) return;
  const cm = SIZES[si].cm;
  const boardCm = Math.max(20, Math.ceil((cm + 4) / 0.75 / 5) * 5);   // keep big stickers on the board
  const cmPx = W / boardCm; B.style.setProperty('--cm', cmPx + 'px');
  const widthCm = artRatio >= 1 ? cm : cm * artRatio;
  $('#stack').style.setProperty('--w', (widthCm * cmPx) + 'px');
  const heightCm = artRatio >= 1 ? cm / artRatio : cm;
  $('#dimLabel').textContent = `${+widthCm.toFixed(1)} cm`;
  $('#dimLabelV').textContent = `${+heightCm.toFixed(1)} cm`;
  $('#rulerLabel').textContent = `Fits in ${sizeLabel(cm)}`;
  $('#boardNote').textContent = `Shown to scale on a ${boardCm} cm wide surface. Each small grid square is 1 cm.`;
}
$('#previewArt').addEventListener('load', e => { const i = e.target; if (i.naturalWidth) { artRatio = i.naturalWidth / i.naturalHeight; board(); } });

/* upload */
const showArt = url => $$('#stack img').forEach(i => { i.src = url; });

/* Build the sticker shape the way a die-cut works: close up narrow gaps and holes in the design
   (like a skull's eyes or an open mouth), add a ~2 mm border around it, and fill everything
   inside the cut line with the border colour, since we can't print holes. */
const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function distanceTo(mask, w, h) {          // distance from every pixel to the nearest pixel where mask = 1
  const g = new Float64Array(w * h);
  for (let p = 0; p < w * h; p++) g[p] = mask[p] ? 0 : INF;
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) f[x] = g[o + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) g[o + x] = Math.sqrt(d[x]); }
  return g;
}
var artBase = null, artId = 0, lastRender = '';
function stickerShape(src, colour, cm) {
  const w0 = src.width, h0 = src.height, L = Math.max(w0, h0);
  const pxPerMm = L / (cm * 10);
  const border = Math.max(2, Math.min(2 * pxPerMm, L * .06));   // ~2 mm border
  const close = Math.max(2, Math.min(2.5 * pxPerMm, L * .07));  // closes gaps up to ~9 mm wide
  const R = border + close, pad = Math.ceil(R) + 3, w = w0 + pad * 2, h = h0 + pad * 2;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', {willReadFrequently: true});
  cx.drawImage(src, pad, pad);
  const a = cx.getImageData(0, 0, w, h).data;
  const art = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) art[p] = a[p * 4 + 3] >= 128 ? 1 : 0;
  const d1 = distanceTo(art, w, h);                       // grow the design outwards...
  const grown = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) grown[p] = d1[p] <= R ? 0 : 1;   // 1 = outside the grown shape
  const d2 = distanceTo(grown, w, h);                     // ...then shrink it back to a 2 mm border
  const alpha = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = Math.min(1, Math.max(0, d2[p] - close + .5));
  const outside = new Uint8Array(w * h), q = new Int32Array(w * h); let head = 0, tail = 0;
  const seed = p => { if (!outside[p] && alpha[p] < .5) { outside[p] = 1; q[tail++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const p = q[head++], x = p % w;
    if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w); if (p < w * (h - 1)) seed(p + w);
  }
  const m = cx.createImageData(w, h), md = m.data, c = colour === 'black' ? 0 : 255;
  for (let p = 0; p < w * h; p++) {
    const o = p * 4; md[o] = md[o + 1] = md[o + 2] = c;
    md[o + 3] = outside[p] ? Math.round(alpha[p] * 255) : 255;
  }
  cx.putImageData(m, 0, 0);
  cx.drawImage(src, pad, pad);
  return cv.toDataURL('image/png');
}
function renderArt() {
  if (!artBase) return;
  const cm = SIZES[si].cm, key = `${artId}|${edge}|${cm}`;
  if (key === lastRender) return;
  lastRender = key;
  showArt(stickerShape(artBase, edge, cm));
}
const useArt = canvas => { artBase = canvas; artId++; renderArt(); };

/* PDF (and PDF-compatible Illustrator) previews: the PDF reader is only loaded when someone uploads one. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
let pdfLib = null;
async function loadPdfJs() {
  if (pdfLib) return pdfLib;
  const [lib, worker] = await Promise.all([import(PDFJS + 'pdf.min.mjs'), import(PDFJS + 'pdf.worker.min.mjs')]);
  globalThis.pdfjsWorker = worker;              // run the reader on the page itself
  lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
  return (pdfLib = lib);
}
async function renderPdf(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false}).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({scale: 1});
  const vp = page.getViewport({scale: Math.min(4, 1000 / Math.max(base.width, base.height))});
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
  await page.render({canvas: cv, canvasContext: cv.getContext('2d'), viewport: vp, background: 'rgba(0,0,0,0)'}).promise;
  doc.destroy();
  return cv;
}

/* Preview-only background removal: if the edges of the artwork are one plain colour,
   flood-fill that colour away from the edges (so white inside the design is kept),
   soften the edge pixels, then trim the empty space around the design. */
function cutOut(img) {
  const MAX = 1000;
  const iw = img.naturalWidth || img.width || MAX, ih = img.naturalHeight || img.height || MAX;
  const k2 = MAX / Math.max(iw, ih);
  const w = Math.max(1, Math.round(iw * k2)), h = Math.max(1, Math.round(ih * k2));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0, w, h);
  const id = cx.getImageData(0, 0, w, h), d = id.data;
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
  let clear = 0, r = 0, g = 0, b = 0, n = 0;
  edge.forEach(p => { const o = p * 4; if (d[o + 3] < 20) clear++; else { r += d[o]; g += d[o + 1]; b += d[o + 2]; n++; } });
  let removed = false, busy = false;
  if (clear < edge.length * .5 && n) {
    r /= n; g /= n; b /= n;
    const TOL = 48, SOFT = 80;
    const dist = o => Math.hypot(d[o] - r, d[o + 1] - g, d[o + 2] - b);
    const near = edge.filter(p => dist(p * 4) <= TOL).length;
    if (near >= edge.length * .8) {
      const seen = new Uint8Array(w * h), q = new Int32Array(w * h); let head = 0, tail = 0;
      edge.forEach(p => { if (!seen[p] && dist(p * 4) <= TOL) { seen[p] = 1; q[tail++] = p; } });
      while (head < tail) {
        const p = q[head++], o = p * 4; d[o + 3] = 0;
        const x = p % w, y = (p / w) | 0;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const m of nb) {
          if (m < 0 || seen[m]) continue;
          seen[m] = 1;
          const dm = dist(m * 4);
          if (dm <= TOL) q[tail++] = m;
          else if (dm < SOFT) d[m * 4 + 3] = Math.round(d[m * 4 + 3] * (dm - TOL) / (SOFT - TOL));
        }
      }
      removed = true;
    } else busy = true;
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { cx.drawImage(img, 0, 0, w, h); return {canvas: cv, removed: false, busy: false}; }
  cx.putImageData(id, 0, 0);
  const pad = 2; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return {canvas: out, removed, busy};
}

const drop = $('#drop'), dropText = $('#dropText');
const ALLOWED = ['png', 'jpg', 'jpeg', 'svg', 'pdf', 'ai'];
const say = (t, err = false) => { dropText.textContent = t; drop.classList.toggle('error', err); };
function handle(file) {
  if (!file) return;
  chosenFile = null; uploaded = null;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED.includes(ext)) return say(`We can't print from .${ext} files. Upload a PNG, JPG, SVG or PDF instead.`, true);
  if (!file.size) return say(`${file.name} looks empty. Try exporting it again.`, true);
  if (file.size > 50 * 1024 * 1024) return say('That file is over 50MB. Export a smaller version and try again.', true);
  chosenFile = file;
  $('#checkoutError').hidden = true;
  if (file.type.startsWith('image/')) {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const res = cutOut(img);
        useArt(res.canvas);
        say(res.removed ? `Using ${file.name}. We've removed the plain background for the preview.`
          : res.busy ? `Using ${file.name}. The background isn't a plain colour, so the preview shows it as a square. We'll sort the cut line in your proof.`
          : `Using ${file.name}. Drop another file to swap it.`);
      };
      img.onerror = () => say(`We couldn't open ${file.name}. Try exporting it again as a PNG.`, true);
      img.src = r.result;
    };
    r.readAsDataURL(file);
    say(`Loading ${file.name}…`);
  } else {
    say(`Loading ${file.name}…`);
    renderPdf(file).then(cv => {
      const res = cutOut(cv);
      useArt(res.canvas);
      say(res.busy ? `Using page 1 of ${file.name}. The background isn't a plain colour, so the preview shows it as a square. We'll sort the cut line in your proof.`
        : `Using page 1 of ${file.name}. Drop another file to swap it.`);
    }).catch(err => { console.error('PDF preview failed', err); say(ext === 'ai'
      ? `Got ${file.name}. We can't preview this Illustrator file here, but we'll show it in your proof.`
      : `Got ${file.name}. We couldn't preview this PDF here, but we'll show it in your proof.`); });
  }
}
{ const sample = new Image(); sample.onload = () => useArt(cutOut(sample).canvas); sample.src = '/assets/img/cactus.svg'; }
$('#file').addEventListener('change', e => handle(e.target.files[0]));
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => handle(e.dataTransfer.files[0]));


/* ---------- checkout: upload the artwork, then hand over to Stripe ---------- */
const CHUNK = 3 * 1024 * 1024;            // big files go up in 3 MB pieces
const progWrap = $('#uploadProgress'), progBar = $('#uploadProgress span');
async function uploadArtwork(file) {
  if (uploaded && uploaded.file === file) return uploaded.id;
  const id = crypto.randomUUID();
  const parts = Math.max(1, Math.ceil(file.size / CHUNK));
  progWrap.hidden = false; progBar.style.width = '0%';
  for (let p = 0; p < parts; p++) {
    const chunk = file.slice(p * CHUNK, Math.min(file.size, (p + 1) * CHUNK));
    const res = await fetch('/api/upload-artwork', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Upload-Id': id, 'X-Part': String(p), 'X-Total': String(parts),
        'X-File-Name': encodeURIComponent(file.name), 'X-File-Type': file.type || 'application/octet-stream', 'X-File-Size': String(file.size)
      },
      body: chunk
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'We couldn\'t upload your artwork.');
    progBar.style.width = `${Math.round((p + 1) / parts * 100)}%`;
  }
  uploaded = {file, id};
  return id;
}

const checkoutBtn = $('#checkout'), checkoutErr = $('#checkoutError'), btnLabel = checkoutBtn.textContent;
const showErr = msg => { checkoutErr.textContent = msg; checkoutErr.hidden = false; };
const resetBtn = () => { checkoutBtn.disabled = false; checkoutBtn.textContent = btnLabel; };
checkoutBtn.addEventListener('click', async () => {
  checkoutErr.hidden = true;
  if (!chosenFile) {
    showErr('Please add your artwork first (step 3).');
    $('#drop').scrollIntoView({behavior: RM ? 'auto' : 'smooth', block: 'center'});
    return;
  }
  checkoutBtn.disabled = true;
  try {
    checkoutBtn.textContent = 'Uploading artwork…';
    const artwork = await uploadArtwork(chosenFile);
    checkoutBtn.textContent = 'Opening secure checkout…';
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({size: si, quantity: qi, border: edge, artwork})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Checkout isn\'t available right now.');
    location.href = data.url;
  } catch (err) {
    showErr(`${err.message} Please try again, or get in touch if it keeps happening.`);
    resetBtn();
  }
});
// If someone comes back from Stripe with the back button, make the button usable again.
addEventListener('pageshow', e => { if (e.persisted) resetBtn(); });

/* ---------- start ---------- */
let rt2;
addEventListener('resize', () => { clearTimeout(rt2); rt2 = setTimeout(board, 150); });
update();
})();
