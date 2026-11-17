// The trip brief: the seven answers on this page as a small structured
// record, plus the two ways it travels.
//
// 1. To TripDeputy, as a link TripDeputy already understands: its planner
//    opens https://tripdeputy.com/plan/#trip=t1.<data> and keeps the trip as
//    the visitor's own copy (trip-deputy src/lib/share.js). The trip rides in
//    the part after the #, which browsers never send to any server, so this
//    page still sends nothing anywhere.
// 2. As a file, trip-brief.json, to keep or hand to someone, and to load back.
//
// Both directions go back too: a TripDeputy share link pasted here fills the
// form. Pure functions only, so the same file runs on the page and under
// `node --test`. Nothing here guesses: a length or a date this page cannot
// read is left for TripDeputy to ask about, and the words are kept.

export const FORMAT = 'trip-brief';
export const VERSION = 1;
export const TRIPDEPUTY_PLAN = 'https://tripdeputy.com/plan/';
const TOKEN_PREFIX = 't1.';
const TD_SCHEMA = 1;

// The page's interest chips and TripDeputy's interest keys, one to one.
export const INTERESTS = [
  ['Food & markets', 'food'], ['History & museums', 'history'], ['Nature & hikes', 'nature'],
  ['Beaches', 'beach'], ['Art & design', 'art'], ['Nightlife', 'nightlife'],
  ['Kid-friendly', 'kids'], ['Off the beaten path', 'offbeat'], ['Photography', 'photo'],
  ['Relaxation & spas', 'relax'], ['Shopping', 'shopping'], ['Local festivals', 'festivals'],
];
const KEY_OF = new Map(INTERESTS);
const LABEL_OF = new Map(INTERESTS.map(([l, k]) => [k, l]));
export const PACES = ['relaxed', 'balanced', 'packed'];

const clip = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// ------------------------------------------------------------ the brief

// fields: what the page's form holds. pace is the select's index (0 to 2);
// tags are chip labels. Returns the brief, the stored shape.
export function briefFromForm(fields) {
  return normalizeBrief({
    destination: fields.destination,
    when: fields.when,
    who: fields.who,
    budget: fields.budget,
    pace: PACES[fields.paceIndex] || 'balanced',
    interests: (fields.tags || []).map((t) => KEY_OF.get(t)).filter(Boolean),
    constraints: fields.constraints,
  });
}

export function normalizeBrief(src) {
  const s = src && typeof src === 'object' ? src : {};
  return {
    format: FORMAT,
    version: VERSION,
    destination: clip(s.destination, 120),
    when: clip(s.when, 120),
    who: clip(s.who, 120),
    budget: clip(s.budget, 80),
    pace: PACES.includes(s.pace) ? s.pace : 'balanced',
    interests: Array.isArray(s.interests) ? [...new Set(s.interests.filter((k) => LABEL_OF.has(k)))] : [],
    constraints: clip(s.constraints, 300),
  };
}

// The form's values for a brief: the inverse of briefFromForm.
export function formFromBrief(brief) {
  const b = normalizeBrief(brief);
  return {
    destination: b.destination, when: b.when, who: b.who, budget: b.budget,
    paceIndex: PACES.indexOf(b.pace), tags: b.interests.map((k) => LABEL_OF.get(k)), constraints: b.constraints,
  };
}

// ------------------------------------------------------------ reading "when"

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };
const num = (w) => (/^\d+$/.test(w) ? Number(w) : WORDS[w]);

// How many nights the words name, or null. "5 days" is 4 nights (TripDeputy
// counts nights, and a 5-day trip sleeps away 4); "a week" is 7; "weekend"
// is 2; "day trip" is 0. Anything else is null, never a guess.
export function readNights(when) {
  const t = String(when || '').toLowerCase();
  if (/\bday ?trip\b|\bday out\b/.test(t)) return 0;
  if (/\b(long )?weekend\b/.test(t)) return /\blong weekend\b/.test(t) ? 3 : 2;
  let m = /\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s+nights?\b/.exec(t);
  if (m) return num(m[1]);
  m = /\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s+days?\b/.exec(t);
  if (m) return Math.max(0, num(m[1]) - 1);
  m = /\b(\d+|a|an|one|two|three|four)\s+weeks?\b/.exec(t);
  if (m) return num(m[1]) * 7;
  return null;
}

// A start date only when the words give a whole one: 2026-05-20, May 20
// 2026, or 20 May 2026. "late May" or "May 20" with no year stays words: a
// guessed year puts a trip in the wrong calendar.
export function readStart(when) {
  const t = String(when || '').toLowerCase();
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  const mon = MONTHS.map((x) => x.slice(0, 3)).join('|');
  m = new RegExp(`\\b(${mon})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`).exec(t);
  if (m) return validDate(+m[3], MONTHS.findIndex((x) => x.startsWith(m[1])) + 1, +m[2]);
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${mon})[a-z]*\\.?,?\\s+(\\d{4})\\b`).exec(t);
  if (m) return validDate(+m[3], MONTHS.findIndex((x) => x.startsWith(m[2])) + 1, +m[1]);
  return null;
}
function validDate(y, mo, d) {
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null;
}

// ------------------------------------------------------------ to TripDeputy

// The trip TripDeputy will open, and a plain account of what it could not
// carry, for the page to say before the visitor leaves.
export function toTripDeputy(brief) {
  const b = normalizeBrief(brief);
  const nights = readNights(b.when);
  const startDate = readStart(b.when);
  const trip = {
    v: TD_SCHEMA,
    destination: b.destination,
    travelers: b.who,
    budget: b.budget,
    pace: b.pace,
    interests: b.interests,
    kids: b.interests.includes('kids'),
  };
  if (nights !== null) trip.nights = Math.min(60, nights);
  if (startDate) trip.startDate = startDate;
  // The words about when are kept with the constraints whenever they say
  // more than the numbers carry ("late May"), so nothing is lost on the way.
  const whenNote = b.when && (nights === null || startDate === null) ? `When: ${b.when}` : '';
  trip.constraints = [b.constraints, whenNote].filter(Boolean).join('; ').slice(0, 400);
  const notes = [];
  if (!b.destination) notes.push('No destination yet: TripDeputy will ask for one.');
  if (b.when && nights === null) notes.push(`TripDeputy counts nights, and "${b.when}" does not say how many, so it starts at its usual length. Change it there.`);
  if (!b.when) notes.push('No length given, so TripDeputy starts at its usual length. Change it there.');
  if (b.when && !startDate) notes.push('No exact start date, so the plan has no dates yet. Add one there when you know it.');
  return { trip, notes };
}

function toBase64Url(bytes) {
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function tripDeputyToken(trip) {
  return TOKEN_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(trip)));
}
export function tripDeputyLink(brief) {
  const { trip, notes } = toTripDeputy(brief);
  return { url: `${TRIPDEPUTY_PLAN}#trip=${tripDeputyToken(trip)}`, notes };
}

// ------------------------------------------------------------ back in

// Whatever was pasted or loaded: a TripDeputy share link, its #trip= part or
// bare token, or a trip-brief.json file. Returns { brief, notes } or throws
// one sentence the page can show as it is.
export function readIncoming(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Paste a TripDeputy share link, or load a trip-brief.json file.');
  if (raw.startsWith('{')) return { brief: parseBriefFile(raw), notes: [] };
  const m = /(?:^|[#&])trip=([^&\s]+)/.exec(raw);
  const token = m ? m[1] : raw;
  if (!token.startsWith(TOKEN_PREFIX)) throw new Error('That is not a TripDeputy trip link. A shared trip link has #trip= in it.');
  let data;
  try { data = JSON.parse(new TextDecoder().decode(fromBase64Url(token.slice(TOKEN_PREFIX.length)))); } catch {
    throw new Error('That TripDeputy link is cut short or damaged. Copy the whole link again.');
  }
  if (!data || typeof data !== 'object') throw new Error('That TripDeputy link is cut short or damaged. Copy the whole link again.');
  if (data.v !== TD_SCHEMA) throw new Error('That TripDeputy link is from a newer version than this page reads. Open it in TripDeputy instead.');
  return fromTripDeputy(data);
}

// A TripDeputy trip as a brief. Length and dates go back to words the way a
// person would write them; what a brief has no field for is named, not lost
// silently.
export function fromTripDeputy(trip) {
  const t = trip && typeof trip === 'object' ? trip : {};
  const nights = Number.isInteger(t.nights) ? t.nights : null;
  const parts = [];
  if (nights === 0) parts.push('a day trip');
  else if (nights !== null) parts.push(`${nights + 1} days`);
  if (typeof t.startDate === 'string' && validDate(...t.startDate.split('-').map(Number))) parts.push(`from ${t.startDate}`);
  // The "When: ..." note this page adds on the way out comes back as words.
  let constraints = typeof t.constraints === 'string' ? t.constraints : '';
  const whenNote = /(?:^|;\s*)When: ([^;]+)$/.exec(constraints);
  if (whenNote) constraints = constraints.slice(0, whenNote.index);
  const brief = normalizeBrief({
    destination: t.destination,
    when: whenNote ? whenNote[1] : parts.join(' '),
    who: t.travelers,
    budget: t.budget,
    pace: t.pace,
    interests: Array.isArray(t.interests) ? t.interests : [],
    constraints,
  });
  const notes = [];
  const left = [];
  if (t.dayEdits && Object.keys(t.dayEdits).length) left.push('day-by-day edits');
  if (Array.isArray(t.saved) && t.saved.length) left.push(`${t.saved.length} saved link${t.saved.length === 1 ? '' : 's'} and bookings`);
  if (typeof t.notes === 'string' && t.notes.trim()) left.push('notes');
  if (Array.isArray(t.costs) && t.costs.length) left.push('costs');
  if (left.length) notes.push(`This page holds the seven answers only, so the trip's ${left.join(', ')} stay in TripDeputy.`);
  return { brief, notes };
}

// ------------------------------------------------------------ the file

export function briefFile(brief) {
  return JSON.stringify(normalizeBrief(brief), null, 2) + '\n';
}

export function parseBriefFile(text) {
  let data;
  try { data = JSON.parse(String(text)); } catch { throw new Error('That file is not a trip brief: it is not valid JSON.'); }
  if (!data || data.format !== FORMAT) throw new Error('That file is not a trip brief from this page.');
  if (typeof data.version !== 'number' || data.version > VERSION) throw new Error('That trip brief was made by a newer version of this page. Reload the page and try again.');
  return normalizeBrief(data);
}
