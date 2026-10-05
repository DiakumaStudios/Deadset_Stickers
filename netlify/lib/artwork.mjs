// Shared helpers for storing artwork and making private download links.
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const ALLOWED = ["png", "jpg", "jpeg", "svg", "pdf", "ai"];
export const MAX_PARTS = 20;                 // 20 x 3 MB pieces = up to 60 MB
export const MAX_PART_BYTES = 3.5 * 1024 * 1024;
export const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// "strong" so a file is readable straight after it's uploaded.
export const artworkStore = () => getStore({ name: "artwork", consistency: "strong" });

// Links are signed so only someone with the exact link (you, via Stripe) can download a file.
function linkKey() {
  if (process.env.ARTWORK_LINK_SECRET) return process.env.ARTWORK_LINK_SECRET;
  if (process.env.STRIPE_SECRET_KEY) return createHash("sha256").update("deadset-artwork:" + process.env.STRIPE_SECRET_KEY).digest("hex");
  return null;
}
export function signId(id) {
  const key = linkKey();
  if (!key) throw new Error("No signing key set");
  return createHmac("sha256", key).update(id).digest("hex").slice(0, 32);
}
export function checkSig(id, sig) {
  try {
    const a = Buffer.from(signId(id)), b = Buffer.from(String(sig || ""));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
