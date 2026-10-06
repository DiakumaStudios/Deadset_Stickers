/* Deadset Stickers: the cart page and checkout. */
(() => {
const {RM, $, cart} = window.Deadset;
const P = JSON.parse($('#pricing-data').textContent);
const money = n => '$' + n.toLocaleString('en-AU', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fileIcon = '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M12 4h17l9 9v31H12z"/><path d="M29 4v9h9"/></svg>';

// Looks the price up again from the current price list (prices can change between visits).
const priceOf = it => {
  const size = P.sizes[it.size], row = P.rows[it.quantity], price = row && row.prices[it.size];
  return size && price > 0 ? {size, row, price} : null;
};

const layout = $('#cartLayout'), empty = $('#cartEmpty'), list = $('#cartItems');
const btn = $('#checkout'), err = $('#checkoutError'), label = btn.textContent;

function render() {
  const items = cart.get();
  layout.hidden = !items.length; empty.hidden = !!items.length;
  if (!items.length) return;
  let subtotal = 0, stickers = 0, broken = 0;
  list.innerHTML = items.map(it => {
    const p = priceOf(it);
    if (!p) { broken++; return `<li class="cart-item broken" data-id="${esc(it.id)}"><div class="ci-thumb">${fileIcon}</div><div class="ci-info"><strong>This design is no longer available</strong><span>Please remove it and set it up again.</span></div><button class="ci-remove" type="button" data-remove="${esc(it.id)}">Remove</button></li>`; }
    subtotal += p.price; stickers += p.row.qty;
    return `<li class="cart-item" data-id="${esc(it.id)}">
      <div class="ci-thumb">${it.thumb ? `<img src="${esc(it.thumb)}" alt="">` : fileIcon}</div>
      <div class="ci-info">
        <strong>${p.size.cm} × ${p.size.cm} cm die-cut stickers</strong>
        <span>${p.row.qty.toLocaleString('en-AU')} stickers, ${esc(it.border)} border</span>
        <span class="ci-file">${esc(it.name)}</span>
      </div>
      <div class="ci-price">${money(p.price)}</div>
      <button class="ci-remove" type="button" data-remove="${esc(it.id)}" aria-label="Remove this design">Remove</button>
    </li>`;
  }).join('');
  const total = subtotal + P.shipping;
  $('#sumCount').textContent = `Stickers (${items.length - broken} design${items.length - broken === 1 ? '' : 's'})`;
  $('#sumSubtotal').textContent = money(subtotal);
  $('#sumShipping').textContent = money(P.shipping);
  $('#sumTotal').textContent = money(total);
  $('#sumGst').textContent = `Includes GST of ${money(total / 11)}.`;
  btn.disabled = broken > 0;
  if (broken) { err.textContent = 'Please remove the design that is no longer available before checking out.'; err.hidden = false; }
}

list.addEventListener('click', e => {
  const b = e.target.closest('[data-remove]'); if (!b) return;
  const li = b.closest('.cart-item');
  li.classList.add('leaving');
  setTimeout(() => { cart.remove(b.dataset.remove); err.hidden = true; render(); }, RM ? 0 : 300);
});

btn.addEventListener('click', async () => {
  err.hidden = true;
  const items = cart.get();
  if (!items.length) return;
  btn.disabled = true; btn.textContent = 'Opening secure checkout…';
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({items: items.map(({size, quantity, border, artwork}) => ({size, quantity, border, artwork}))})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "Checkout isn't available right now.");
    location.href = data.url;
  } catch (e) {
    err.textContent = `${e.message} Please try again, or get in touch if it keeps happening.`;
    err.hidden = false;
    btn.disabled = false; btn.textContent = label;
  }
});

addEventListener('pageshow', e => { if (e.persisted) { btn.disabled = false; btn.textContent = label; render(); } });
addEventListener('storage', render);
render();
})();
