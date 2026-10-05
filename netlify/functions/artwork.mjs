// Private download link for a customer's artwork (the link is in each Stripe order).
// The file is stored in pieces, so this page fetches the pieces and joins them back up in your browser.
import { artworkStore, json, checkSig, ID_PATTERN } from "../lib/artwork.mjs";

const page = `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Download artwork | Deadset Stickers</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#181818;color:#efe8cf;font:17px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}
main{max-width:30rem;text-align:center}
h1{font:900 1.6rem/1.1 "Arial Black",Impact,sans-serif;text-transform:uppercase;margin:0 0 .6rem}
p{color:#a9a48c;margin:0 0 1.4rem;overflow-wrap:anywhere}
button{font:900 1rem/1 "Arial Black",Impact,sans-serif;text-transform:uppercase;background:#c5a64f;color:#181818;border:3px solid #181818;box-shadow:5px 5px 0 #efe8cf;padding:1rem 1.6rem;cursor:pointer}
button[disabled]{opacity:.6;cursor:progress}
.bar{height:6px;background:rgba(239,232,207,.16);margin-top:1.2rem}.bar span{display:block;height:100%;width:0;background:#c5a64f}
img{max-width:100%;max-height:50vh;margin:1.2rem auto 0;display:block;background:repeating-conic-gradient(#2a2924 0 25%,#20201c 0 50%) 0 0/20px 20px}
</style></head>
<body><main>
<h1>Customer artwork</h1>
<p id="info">Loading file details…</p>
<button id="get" disabled>Download file</button>
<div class="bar" hidden><span></span></div>
<img id="preview" alt="" hidden>
</main>
<script>
(async () => {
  const q = new URLSearchParams(location.search), id = q.get('id'), sig = q.get('sig');
  const base = '/api/artwork?id=' + encodeURIComponent(id) + '&sig=' + encodeURIComponent(sig);
  const info = document.getElementById('info'), btn = document.getElementById('get');
  const bar = document.querySelector('.bar'), fill = document.querySelector('.bar span');
  let meta;
  try {
    const r = await fetch(base + '&meta=1'); if (!r.ok) throw 0; meta = await r.json();
  } catch { info.textContent = "This link isn't valid, or the file has been removed."; return; }
  const mb = (meta.size / 1048576).toFixed(meta.size > 1048576 ? 1 : 2);
  info.textContent = meta.name + ' (' + mb + ' MB), uploaded ' + new Date(meta.uploaded).toLocaleString('en-AU');
  btn.disabled = false;
  let blob = null;
  async function load() {
    if (blob) return blob;
    bar.hidden = false; const parts = [];
    for (let i = 0; i < meta.parts; i++) {
      const r = await fetch(base + '&part=' + i); if (!r.ok) throw 0;
      parts.push(await r.arrayBuffer()); fill.style.width = Math.round((i + 1) / meta.parts * 100) + '%';
    }
    return (blob = new Blob(parts, {type: meta.type}));
  }
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Downloading…';
    try {
      const b = await load(), a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = meta.name; document.body.appendChild(a); a.click(); a.remove();
      btn.textContent = 'Download again';
    } catch { info.textContent = 'Sorry, the download failed. Please try again.'; btn.textContent = 'Download file'; }
    btn.disabled = false;
  });
  if (/^image\\/(png|jpeg)$/.test(meta.type) && meta.size < 15 * 1048576) {
    try { const b = await load(); const img = document.getElementById('preview'); img.src = URL.createObjectURL(b); img.hidden = false; } catch {}
  }
})();
</script>
</body></html>`;

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "", sig = url.searchParams.get("sig") || "";
  if (!ID_PATTERN.test(id) || !checkSig(id, sig)) return new Response("This link isn't valid.", { status: 403 });

  const store = artworkStore();
  if (url.searchParams.has("meta")) {
    const meta = await store.get(`${id}/meta`, { type: "json" });
    return meta ? json(meta) : json({ error: "Not found" }, 404);
  }
  if (url.searchParams.has("part")) {
    const n = Number(url.searchParams.get("part"));
    if (!Number.isInteger(n) || n < 0 || n > 50) return new Response("Bad request", { status: 400 });
    const data = await store.get(`${id}/part-${n}`, { type: "arrayBuffer" });
    if (!data) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
  }
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
};

export const config = { path: "/api/artwork" };
