// Share links carry the whole trip in the URL fragment (after the #). Browsers
// never send the fragment to the server, so sharing a plan needs no account
// and no database, and the site never sees it.

import { normalizeTrip, SCHEMA_VERSION } from './trip.js';

const PREFIX = 't1.';

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Ticked boxes are personal progress, not part of the plan, so they stay home.
// So do how people get paid back (bank details among them): a snapshot link
// can be forwarded anywhere. Names and costs travel; each person adds their
// own pay-back details in their copy.
export function encodeTrip(trip) {
  const { packed, tasksDone, ...plan } = trip;
  if (Array.isArray(plan.people)) plan.people = plan.people.map(({ name, updatedAt }) => ({ name, updatedAt }));
  const json = JSON.stringify({ ...plan, v: SCHEMA_VERSION });
  return PREFIX + toBase64Url(new TextEncoder().encode(json));
}

export function decodeTrip(token) {
  if (typeof token !== 'string' || !token.startsWith(PREFIX)) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(token.slice(PREFIX.length)));
    const data = JSON.parse(json);
    if (!data || data.v !== SCHEMA_VERSION) return null;
    // A shared trip becomes the recipient's own copy, with a fresh id.
    return normalizeTrip({ ...data, id: undefined });
  } catch {
    return null;
  }
}

export function shareUrl(origin, trip) {
  return `${origin.replace(/\/$/, '')}/plan/#trip=${encodeTrip(trip)}`;
}

export function tokenFromHash(hash) {
  const m = /(?:^#|&)trip=([^&]+)/.exec(hash || '');
  return m ? m[1] : null;
}
