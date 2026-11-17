import { normalizeSaved } from './saved.js';
import { normalizeCosts, normalizePeople } from './costs.js';

// Trip model: the one shape every other module reads. Pure functions only, so
// the same file runs in the browser and under node --test.

export const SCHEMA_VERSION = 1;
export const MAX_NIGHTS = 60;

export const PACES = ['relaxed', 'balanced', 'packed'];
export const CLIMATES = ['warm', 'mild', 'cold', 'mixed'];
// Kinds of trip (triptypes.js, hq#759). Keys are stored; the details live there.
export const TRIP_TYPE_KEYS = ['adventure', 'nightlife', 'food', 'beach', 'culture', 'family', 'romance', 'events', 'bach', 'reunion'];

// Interest keys the planner understands. Labels are UI copy; keys are stored.
export const INTERESTS = {
  food: 'Food and markets',
  history: 'History and museums',
  nature: 'Nature and hikes',
  beach: 'Beaches',
  art: 'Art and design',
  nightlife: 'Nightlife',
  kids: 'Kid friendly',
  offbeat: 'Off the beaten path',
  photo: 'Photography',
  relax: 'Slow days and spas',
  shopping: 'Shopping',
  festivals: 'Local festivals',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Date math in UTC so a trip's days never shift with the viewer's time zone.
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function text(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function longText(value, max = 2000) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function intIn(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function newTripId(random = Math.random) {
  return Array.from({ length: 12 }, () => Math.floor(random() * 36).toString(36)).join('');
}

// Accepts anything (form values, a decoded share link, an old saved trip) and
// returns a valid trip. Liberal in what it accepts, precise in what it returns.
export function normalizeTrip(input = {}, { random } = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const interests = Array.isArray(src.interests)
    ? [...new Set(src.interests.filter((k) => Object.hasOwn(INTERESTS, k)))]
    : [];
  const id = typeof src.id === 'string' && /^[a-z0-9]{6,32}$/.test(src.id) ? src.id : newTripId(random);

  const trip = {
    v: SCHEMA_VERSION,
    id,
    destination: text(src.destination, 120),
    startDate: isIsoDate(src.startDate) ? src.startDate : null,
    // 0 nights is a day out: a day trip, or a day close to home (2026-10-19).
    nights: intIn(src.nights, 0, MAX_NIGHTS, 4),
    travelers: text(src.travelers, 120),
    budget: text(src.budget, 80),
    pace: oneOf(src.pace, PACES, 'balanced'),
    // The kind of trip, if picked: it shapes packing, bookings and the AI request.
    type: oneOf(src.type, TRIP_TYPE_KEYS, ''),
    // The example this trip was kept from, so opening it again finds the copy (hq#977).
    example: typeof src.example === 'string' && /^[a-z]{1,24}$/.test(src.example) ? src.example : '',
    climate: oneOf(src.climate, CLIMATES, 'mild'),
    interests,
    constraints: text(src.constraints, 400),
    stay: text(src.stay, 160),
    fixed: longText(src.fixed, 1000),
    international: src.international === true,
    carryOnOnly: src.carryOnOnly === true,
    laundry: src.laundry === true,
    kids: src.kids === true || interests.includes('kids'),
    // Close to home: no travel to get there and no stay to check into.
    nearHome: src.nearHome === true,
    // User edits layered on top of the generated plan, keyed by stable ids.
    dayEdits: normalizeDayEdits(src.dayEdits),
    packed: normalizeFlags(src.packed),
    tasksDone: normalizeFlags(src.tasksDone),
    notes: longText(src.notes),
    saved: normalizeSaved(src.saved),
    // Splitting costs (costs.js, 2026-10-20): who paid what, and how each person gets paid back.
    costs: normalizeCosts(src.costs),
    people: normalizePeople(src.people),
  };
  return trip;
}

function normalizeFlags(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [k, v] of Object.entries(value)) {
    if (/^[a-z0-9-]{1,64}$/.test(k) && v === true) out[k] = true;
  }
  return out;
}

const DAY_FIELDS = ['area', 'morning', 'afternoon', 'evening', 'flex', 'rainSwap', 'bookAhead'];

function normalizeDayEdits(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [k, v] of Object.entries(value)) {
    const n = Number.parseInt(k, 10);
    if (!Number.isInteger(n) || n < 1 || n > MAX_NIGHTS + 1 || !v || typeof v !== 'object') continue;
    const day = {};
    for (const f of DAY_FIELDS) {
      const t = text(v[f], 400);
      if (t) day[f] = t;
    }
    if (Object.keys(day).length) out[n] = day;
  }
  return out;
}

export const EDITABLE_DAY_FIELDS = DAY_FIELDS;

export function dayCount(trip) {
  return trip.nights + 1;
}

// A day out has no overnight stay (Michael, 2026-10-19: "not just vacations").
export function isDayOut(trip) {
  return trip.nights === 0;
}

// "4 nights", "1 night", or "a day out", for exports and summaries.
export function lengthLabel(trip) {
  if (isDayOut(trip)) return trip.nearHome ? 'a day out close to home' : 'a day trip';
  return `${trip.nights} night${trip.nights === 1 ? '' : 's'}`;
}

export function endDate(trip) {
  return trip.startDate ? addDays(trip.startDate, trip.nights) : null;
}

// "Austin, Fri, Dec 4": the date the way the rest of the planner writes it,
// never the stored ISO form (hq#751).
const TITLE_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function tripTitle(trip) {
  const where = trip.destination || (trip.nights ? 'Untitled trip' : 'Untitled day out');
  return trip.startDate ? `${where}, ${TITLE_DATE.format(new Date(`${trip.startDate}T00:00:00Z`))}` : where;
}
