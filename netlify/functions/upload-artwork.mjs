// Receives the customer's artwork in 3 MB pieces and saves it in Netlify's file storage.
import { artworkStore, json, ALLOWED, MAX_PARTS, MAX_PART_BYTES, ID_PATTERN } from "../lib/artwork.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const id = req.headers.get("x-upload-id") || "";
  const part = Number(req.headers.get("x-part"));
  const total = Number(req.headers.get("x-total"));
  if (!ID_PATTERN.test(id) || !Number.isInteger(part) || !Number.isInteger(total) || total < 1 || total > MAX_PARTS || part < 0 || part >= total) {
    return json({ error: "That upload didn't look right." }, 400);
  }

  let name = "artwork";
  try { name = decodeURIComponent(req.headers.get("x-file-name") || "artwork"); } catch {}
  name = name.replace(/[\\/\r\n"]/g, "_").slice(0, 150);
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED.includes(ext)) return json({ error: "Please upload a PNG, JPG, SVG or PDF file." }, 400);

  const body = await req.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_PART_BYTES) return json({ error: "That piece of the file was too big." }, 413);

  const store = artworkStore();
  await store.set(`${id}/part-${part}`, body);
  if (part === 0) {
    await store.setJSON(`${id}/meta`, {
      name,
      type: (req.headers.get("x-file-type") || "application/octet-stream").slice(0, 100),
      size: Number(req.headers.get("x-file-size")) || 0,
      parts: total,
      uploaded: new Date().toISOString(),
    });
  }
  return json({ ok: true });
};

export const config = { path: "/api/upload-artwork" };
