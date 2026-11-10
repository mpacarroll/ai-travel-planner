// "Saved for this trip": links and ideas collected over weeks or months,
// before any planning happens. The owner's own test trip worked this way:
// send things whenever they turn up, and have them all remembered when it is
// time to plan. This free version keeps them on the device; the Pro version
// adds an address to forward links to from anywhere.

export const MAX_SAVED = 200;
const MAX_NOTE = 300;

// Only plain web links survive. Anything else (javascript:, data:, file:)
// would be dangerous to render as a link, so it is kept as text or dropped.
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!/^https?:\/\//i.test(s) || s.length > 2000 || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function clean(text, max) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

// One saved item from anything: a pasted line, a share-sheet payload, or a
// stored object. Returns null when there is nothing worth keeping.
export function toSavedItem({ url, note, title, text, addedAt } = {}, now = new Date()) {
  let link = safeUrl(url);
  let body = [title, text, note].map((x) => clean(x, MAX_NOTE)).filter(Boolean).join(' ');
  if (!link) {
    const found = body.match(URL_IN_TEXT);
    if (found) {
      link = safeUrl(found[0].replace(/[),.;:!?]+$/, ''));
      if (link) body = clean(body.replace(found[0], ''), MAX_NOTE);
    }
  } else if (body.includes(link)) {
    body = clean(body.replace(link, ''), MAX_NOTE);
  }
  if (!link && !body) return null;
  const when = typeof addedAt === 'string' && !Number.isNaN(Date.parse(addedAt)) ? addedAt : now.toISOString();
  return { url: link, note: clean(body, MAX_NOTE), addedAt: when };
}

// Pasted text: one item per line. A line with a link becomes a link with the
// rest of the line as its note; a line without one becomes an idea.
export function parseSavedText(text, now = new Date()) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .map((line) => toSavedItem({ text: line }, now))
    .filter(Boolean);
}

export function normalizeSaved(value) {
  if (!Array.isArray(value)) return [];
  return dedupe(value.map((v) => (v && typeof v === 'object' ? toSavedItem(v) : null)).filter(Boolean)).slice(-MAX_SAVED);
}

// The same link saved twice keeps the first copy, and gains the second note.
function dedupe(items) {
  const out = [];
  const byUrl = new Map();
  for (const item of items) {
    const key = item.url || `note:${item.note.toLowerCase()}`;
    const prev = byUrl.get(key);
    if (!prev) { byUrl.set(key, item); out.push(item); continue; }
    if (item.note && !prev.note.includes(item.note)) prev.note = clean(`${prev.note} ${item.note}`, MAX_NOTE);
  }
  return out;
}

export function addSaved(trip, items) {
  const before = trip.saved.length;
  const saved = normalizeSaved([...trip.saved, ...items]);
  return { trip: { ...trip, saved }, added: saved.length - before };
}

export function removeSaved(trip, index) {
  return { ...trip, saved: trip.saved.filter((_, i) => i !== index) };
}

export function savedLabel(item) {
  if (item.note) return item.note;
  try {
    const u = new URL(item.url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.length > 1 ? u.pathname : ''}`;
  } catch {
    return item.url;
  }
}

// What a share sheet or bookmarklet sends to /plan/?title=&text=&url=. The
// phone apps send everything shared since they were last open as one text,
// one share per line, so several lines become several items.
export function fromShareParams(params, now = new Date()) {
  const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]) || '';
  if (!get('url') && get('text').includes('\n')) return parseSavedText(get('text'), now);
  const item = toSavedItem({ url: get('url'), title: get('title'), text: get('text') }, now);
  return item ? [item] : [];
}
