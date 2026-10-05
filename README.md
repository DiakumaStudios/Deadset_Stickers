# Deadset Stickers website

Built with Eleventy, hosted on Netlify, payments through Stripe.

## Pages
- `/` home, `/about/`, `/shop/`, `/blog/` (+ one page per post), `/contact/`, `/thanks/` (after payment)
- `/admin/` - admin panel for blog posts and prices

## Where things live
- Page content: `src/*.njk`
- Blog posts: `src/blog/posts/*.md` (or use /admin/)
- Prices and shipping: `src/_data/pricing.json` (or use /admin/ > Shop settings)
- Styles and scripts: `src/assets/`
- Checkout, artwork upload and artwork download links: `netlify/functions/`

## Settings to add in Netlify (Site configuration > Environment variables)
- `STRIPE_SECRET_KEY` - from Stripe > Developers > API keys (use the test key first)
- Optional: `ARTWORK_LINK_SECRET` - any long random phrase, used to sign private artwork links
- Optional: `STRIPE_GST_RATE_ID` - only if you want to use a specific Stripe tax rate

## How an order works
1. Customer builds their stickers on /shop/ and clicks Checkout.
2. Their artwork uploads to Netlify's file storage.
3. The server looks up the real price, adds $13 shipping and GST, and opens Stripe checkout.
4. After paying they land on /thanks/. Stripe emails them a receipt and emails you a payment notification.
5. In Stripe, open the payment to see the size, quantity, border colour and a private artwork download link.
