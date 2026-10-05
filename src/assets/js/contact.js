/* Deadset Stickers: contact form. Messages go to Netlify Forms, which emails them on. */
(() => {
const {RM, $, $$} = window.Deadset;
const form = $('#contactForm'), done = $('#formDone'), err = $('#contactError');
if (!form) return;

// "Need more than 5,000? Get in touch" in the shop links here with ?topic=bulk
const params = new URLSearchParams(location.search);
const topic = params.get('topic');
if (topic && $(`#cTopic option[value="${CSS.escape(topic)}"]`)) $('#cTopic').value = topic;

const showDone = () => {
  form.hidden = true; done.hidden = false;
  done.scrollIntoView({behavior: RM ? 'auto' : 'smooth', block: 'center'});
};
// Without JavaScript the form posts normally and comes back with ?sent=1
if (params.get('sent') === '1') showDone();

$('#cFile').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f && f.size > 8 * 1024 * 1024) {
    e.target.value = '';
    $('#cFileText').textContent = 'That file is over 8MB. Attach a smaller version, or upload it in the shop.';
    return;
  }
  $('#cFileText').textContent = f ? f.name : 'Choose a file';
});

const checkField = el => {
  const f = el.closest('.field'); let ok = el.value.trim() !== '';
  if (ok && el.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
  f.classList.toggle('invalid', !ok); return ok;
};
$$('[required]', form).forEach(el => el.addEventListener('input', () => { if (el.closest('.field').classList.contains('invalid')) checkField(el); }));

const btn = $('button[type=submit]', form), label = btn.textContent;
form.addEventListener('submit', async e => {
  e.preventDefault();
  err.hidden = true;
  const bad = $$('[required]', form).filter(el => !checkField(el));
  if (bad.length) { bad[0].focus(); return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await fetch('/', {method: 'POST', body: new FormData(form)});
    if (!res.ok) throw new Error();
    showDone();
  } catch {
    err.textContent = "Sorry, that didn't send. Please try again in a moment.";
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
});
$('#formAgain').addEventListener('click', () => {
  form.reset(); $('#cFileText').textContent = 'Choose a file';
  done.hidden = true; form.hidden = false;
  history.replaceState(null, '', location.pathname);
});
})();
