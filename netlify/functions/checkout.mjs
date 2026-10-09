// Works out the real price of every design in the cart and opens a Stripe checkout for the order.
import Stripe from "stripe";
import pricing from "../../src/_data/pricing.json";
import { artworkStore, json, signId, ID_PATTERN } from "../lib/artwork.mjs";

let gstRateId = process.env.STRIPE_GST_RATE_ID || null;

// Finds (or creates, the first time) a "GST 10% included" tax rate, so receipts show the GST.
async function gstRate(stripe) {
  if (gstRateId) return gstRateId;
  const list = await stripe.taxRates.list({ active: true, limit: 100 });
  const found = list.data.find((r) => r.inclusive && Number(r.percentage) === 10 && /gst/i.test(r.display_name));
  if (found) return (gstRateId = found.id);
  const created = await stripe.taxRates.create({
    display_name: "GST", percentage: 10, inclusive: true, country: "AU", description: "GST included in price",
  });
  return (gstRateId = created.id);
}

const cents = (dollars) => Math.round(Number(dollars) * 100);

const MAX_DESIGNS = 20;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!process.env.STRIPE_SECRET_KEY) return json({ error: "Checkout isn't set up yet." }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Something went wrong with your order details." }, 400); }
  const raw = Array.isArray(body.items) ? body.items : [];
  if (!raw.length) return json({ error: "Your cart is empty." }, 400);
  if (raw.length > MAX_DESIGNS) return json({ error: `Orders can include up to ${MAX_DESIGNS} designs.` }, 400);

  const store = artworkStore();
  const origin = new URL(req.url).origin;
  const designs = [];
  for (const [n, item] of raw.entries()) {
    // Every price is looked up again here, so nobody can change it in their browser.
    const si = Number(item.size), qi = Number(item.quantity);
    const size = pricing.sizes[si], row = pricing.rows[qi];
    const price = row && row.prices[si];
    const border = item.border === "black" ? "black" : item.border === "white" ? "white" : null;
    if (!size || !row || !(price > 0) || !border) return json({ error: `Design ${n + 1} in your cart needs setting up again. Please remove it and add it back.` }, 400);
    const artworkId = String(item.artwork || "");
    const meta = ID_PATTERN.test(artworkId) ? await store.get(`${artworkId}/meta`, { type: "json" }) : null;
    if (!meta) return json({ error: `We couldn't find the artwork for design ${n + 1}. Please remove it and add it back.` }, 400);
    designs.push({
      size, row, price, border, meta,
      sizeLabel: `${size.cm} × ${size.cm} cm`,
      qty: row.qty.toLocaleString("en-AU"),
      link: `${origin}/api/artwork?id=${artworkId}&sig=${signId(artworkId)}`,
    });
  }

  // Order details shown on the payment in your Stripe dashboard.
  const details = { designs: String(designs.length) };
  designs.forEach((d, i) => {
    details[`design_${i + 1}`] = `${d.qty} stickers, ${d.sizeLabel}, ${d.border} border. File: ${d.meta.name}`.slice(0, 500);
    details[`design_${i + 1}_artwork`] = d.link;
  });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const gst = await gstRate(stripe);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        ...designs.map((d) => ({
          price_data: {
            currency: "aud",
            unit_amount: cents(d.price),
            product_data: {
              name: `Die-cut stickers, ${d.sizeLabel}`,
              description: `${d.qty} stickers, ${d.border} border. Artwork: ${d.meta.name}`.slice(0, 500),
            },
          },
          quantity: 1,
          tax_rates: [gst],
        })),
        {
          price_data: {
            currency: "aud",
            unit_amount: cents(pricing.shipping),
            product_data: { name: "Express shipping (Australia-wide)" },
          },
          quantity: 1,
          tax_rates: [gst],
        },
      ],
      shipping_address_collection: { allowed_countries: ["AU"] },
      phone_number_collection: { enabled: true },
      metadata: details,
      payment_intent_data: {
        description: `Deadset order: ${designs.length} design${designs.length === 1 ? "" : "s"}`,
        metadata: details,
      },
      success_url: `${origin}/thanks/?order={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart/`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    return json({ error: "We couldn't open checkout just now." }, 502);
  }
};

export const config = { path: "/api/checkout" };
