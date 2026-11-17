// Wires the trip brief (brief.js) to the page: the TripDeputy link always
// carries the answers as they stand, the answers save to a file, and a saved
// file or a TripDeputy share link fills them back in. Reads and sets the form
// through the DOM only, so the page's own script needs no change.
import { briefFromForm, formFromBrief, tripDeputyLink, briefFile, readIncoming, INTERESTS } from './brief.js';

const $ = (id) => document.getElementById(id);
const FIELDS = { destination: 'dest', when: 'when', who: 'who', budget: 'budget', constraints: 'cons' };

function readForm() {
  const out = { paceIndex: $('pace').selectedIndex, tags: [...document.querySelectorAll('#tags .chip.on')].map((c) => c.dataset.tag) };
  for (const [k, id] of Object.entries(FIELDS)) out[k] = $(id).value;
  return out;
}

function fillForm(form) {
  for (const [k, id] of Object.entries(FIELDS)) $(id).value = form[k] || '';
  $('pace').selectedIndex = form.paceIndex >= 0 ? form.paceIndex : 1;
  // Click the chips that differ, so the page's own chip state stays in step.
  const want = new Set(form.tags || []);
  for (const [label] of INTERESTS) {
    const chip = document.querySelector(`#tags .chip[data-tag="${CSS.escape(label)}"]`);
    if (chip && chip.classList.contains('on') !== want.has(label)) chip.click();
  }
  const ex = $('clear') && $('clear').closest('.ex');
  if (ex) ex.hidden = true;
}

function refresh() {
  const { url, notes } = tripDeputyLink(briefFromForm(readForm()));
  $('td-open').href = url;
  $('td-notes').innerHTML = '';
  for (const n of notes) {
    const li = document.createElement('li');
    li.textContent = n;
    $('td-notes').appendChild(li);
  }
}

function say(text, kind) {
  const el = $('brief-status');
  el.textContent = text;
  el.dataset.kind = kind || '';
}

function load(text, from) {
  try {
    const { brief, notes } = readIncoming(text);
    fillForm(formFromBrief(brief));
    refresh();
    $('go').click();
    say([`Filled in from ${from}.`, ...notes].join(' '), 'ok');
  } catch (err) {
    say(err.message, 'error');
  }
}

// The link follows every change to the answers, including the chips and
// the Clear button, which change the form without input events. Their own
// handlers run on the button before the click bubbles here, so the form is
// already changed when this reads it.
const panel = $('trip');
panel.addEventListener('input', refresh);
panel.addEventListener('change', refresh);
panel.addEventListener('click', refresh);
$('td-open').addEventListener('focus', refresh);
$('td-open').addEventListener('mousedown', refresh);

$('brief-save').addEventListener('click', () => {
  const brief = briefFromForm(readForm());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([briefFile(brief)], { type: 'application/json' }));
  const slug = brief.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.download = `${slug || 'trip'}-brief.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  say('Saved. Load that file here any time to pick up where you left off.', 'ok');
});

$('brief-fill').addEventListener('click', () => load($('brief-paste').value, 'the TripDeputy link'));

$('brief-file').addEventListener('change', async () => {
  const f = $('brief-file').files[0];
  $('brief-file').value = '';
  if (!f) return;
  if (f.size > 64 * 1024) { say('That file is too big to be a trip brief.', 'error'); return; }
  load(await f.text(), f.name);
});

// A TripDeputy link opened straight onto this page (#trip=...) fills it in.
if (/[#&]trip=/.test(location.hash)) load(location.hash, 'the TripDeputy link');

refresh();
