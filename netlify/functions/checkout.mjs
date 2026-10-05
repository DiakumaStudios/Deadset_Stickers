// Works out the real price from the price list and opens a Stripe checkout for it.
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

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!process.env.STRIPE_SECRET_KEY) return json({ error: "Checkout isn't set up yet." }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Something went wrong with your order details." }, 400); }

  const si = Number(body.size), qi = Number(body.quantity);
  const size = pricing.sizes[si], row = pricing.rows[qi];
  const price = row && row.prices[si];
  const border = body.border === "black" ? "black" : body.border === "white" ? "white" : null;
  if (!size || !row || !(price > 0) || !border) return json({ error: "Please choose a size, quantity and border colour." }, 400);

  const artworkId = String(body.artwork || "");
  if (!ID_PATTERN.test(artworkId)) return json({ error: "Please add your artwork first." }, 400);
  const meta = await artworkStore().get(`${artworkId}/meta`, { type: "json" });
  if (!meta) return json({ error: "We couldn't find your artwork upload." }, 400);

  const origin = new URL(req.url).origin;
  const artworkLink = `${origin}/api/artwork?id=${artworkId}&sig=${signId(artworkId)}`;
  const qty = row.qty.toLocaleString("en-AU");
  const sizeLabel = `${size.cm} × ${size.cm} cm`;
  const details = {
    size: sizeLabel,
    quantity: String(row.qty),
    border,
    artwork_file: meta.name.slice(0, 450),
    artwork_link: artworkLink,
  };

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const gst = await gstRate(stripe);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "aud",
            unit_amount: cents(price),
            product_data: {
              name: `Die-cut stickers, ${sizeLabel}`,
              description: `${qty} stickers, ${border} border. Artwork: ${meta.name}`.slice(0, 500),
            },
          },
          quantity: 1,
          tax_rates: [gst],
        },
        {
          price_data: {
            currency: "aud",
            unit_amount: cents(pricing.shipping),
            product_data: { name: "Shipping (Australia-wide)" },
          },
          quantity: 1,
          tax_rates: [gst],
        },
      ],
      shipping_address_collection: { allowed_countries: ["AU"] },
      phone_number_collection: { enabled: true },
      metadata: details,
      payment_intent_data: {
        description: `Deadset order: ${qty} stickers at ${sizeLabel}, ${border} border`,
        metadata: details,
      },
      success_url: `${origin}/thanks/?order={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    return json({ error: "We couldn't open checkout just now." }, 502);
  }
};

export const config = { path: "/api/checkout" };
