// Splitting costs on a trip (Michael, 2026-10-20: "Do the math and prefill
// venmo", "think international", "non-americans will have it streamlined
// between banks"). TripDeputy never holds or moves money. It adds up who paid
// what, works out the fewest payments that settle it, and opens the payer's
// own app or bank with the amount filled in. Pure functions, shared by the
// website and the app. Research and terms: docs/SPLIT-COSTS.md.
//
// Amounts are kept in the currency's minor units (cents) so the math never
// drifts. Each currency settles on its own: nothing is converted.

const MAX_COSTS = 300;
const MAX_PEOPLE = 25;
// Currencies with no minor unit in everyday use (ISO 4217 exponent 0).
const WHOLE = new Set(['JPY', 'KRW', 'CLP', 'VND', 'ISK', 'HUF', 'TWD', 'PYG', 'UGX', 'XAF', 'XOF']);

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isoOr = (v, fallback) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : fallback);
export const currencyOf = (v) => (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : 'USD');
export const minorDigits = (currency) => (WHOLE.has(currency) ? 0 : 2);
const toMinor = (amount, currency) => Math.round(Number(amount) * 10 ** minorDigits(currency));
export const fromMinor = (minor, currency) => (minor / 10 ** minorDigits(currency)).toFixed(minorDigits(currency));
const key = (name) => name.toLowerCase();

// "Dinner at the cenote, 1,200 MXN" as typed: "1,200", "1.200,50" and "45" all work.
export function parseAmount(raw) {
  let s = String(raw ?? '').replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  // The later separator is the decimal one when it has one or two digits after it.
  const dec = Math.max(lastComma, lastDot);
  if (dec >= 0 && s.length - dec - 1 <= 2 && s.length - dec - 1 > 0) {
    s = `${s.slice(0, dec).replace(/[.,]/g, '')}.${s.slice(dec + 1)}`;
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 1e8 ? n : null;
}

// How each person gets paid back. Everyone fills in only their own.
export function normalizePay(pay = {}) {
  const p = pay && typeof pay === 'object' ? pay : {};
  const handle = (v, re) => {
    const s = typeof v === 'string' ? v.trim().replace(/^[@$]/, '') : '';
    return re.test(s) ? s : '';
  };
  return {
    venmo: handle(p.venmo, /^[A-Za-z0-9_-]{1,30}$/),
    paypal: handle(p.paypal, /^[A-Za-z0-9]{1,20}$/),
    cashapp: handle(p.cashapp, /^[A-Za-z0-9]{1,20}$/),
    upi: handle(p.upi, /^[\w.-]{2,256}@[A-Za-z]{2,64}$/),
    // Any country's bank details as the person writes them: an IBAN, a sort
    // code and account, a Pix key, a PayID. Copied, never parsed.
    bank: typeof p.bank === 'string' ? p.bank.replace(/\r\n?/g, '\n').trim().slice(0, 300) : '',
  };
}

export function normalizePeople(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const name = text(raw && raw.name, 60);
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    out.push({ name, pay: normalizePay(raw.pay), updatedAt: isoOr(raw.updatedAt, '1970-01-01T00:00:00.000Z') });
    if (out.length >= MAX_PEOPLE) break;
  }
  return out;
}

export function newCostId(random = Math.random) {
  return Array.from({ length: 10 }, () => Math.floor(random() * 36).toString(36)).join('');
}

export function normalizeCosts(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' && /^[a-z0-9]{6,16}$/.test(raw.id) ? raw.id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const currency = currencyOf(raw.currency);
    const amount = Number(raw.amount);
    const paidBy = text(raw.paidBy, 60);
    const split = [...new Map((Array.isArray(raw.split) ? raw.split : []).map((n) => text(n, 60)).filter(Boolean).map((n) => [key(n), n])).values()];
    const cost = {
      id,
      label: text(raw.label, 120),
      amount: Number.isFinite(amount) && amount > 0 && amount < 1e8 ? Number(fromMinor(toMinor(amount, currency), currency)) : 0,
      currency,
      paidBy,
      split,
      updatedAt: isoOr(raw.updatedAt, '1970-01-01T00:00:00.000Z'),
    };
    // A deleted cost stays as a marker, so a phone that still has it does not bring it back.
    if (raw.deleted === true) cost.deleted = true;
    else if (!cost.amount || !paidBy || !split.length) continue;
    out.push(cost);
    if (out.length >= MAX_COSTS) break;
  }
  return out;
}

// Two copies of a trip edited apart: keep every cost and person from both,
// the later edit of each one winning (worker/src/trips.js mergeTrip).
export function mergeCosts(a = [], b = []) {
  const byId = new Map();
  for (const c of [...a, ...b]) {
    const prev = byId.get(c.id);
    if (!prev || c.updatedAt > prev.updatedAt) byId.set(c.id, c);
  }
  return normalizeCosts([...byId.values()]);
}

export function mergePeople(a = [], b = []) {
  const byName = new Map();
  for (const p of [...a, ...b]) {
    const prev = byName.get(key(p.name));
    if (!prev || p.updatedAt > prev.updatedAt) byName.set(key(p.name), p);
  }
  return normalizePeople([...byName.values()]);
}

// Who is up and who is down, per currency, in minor units. An even split
// gives the leftover cents one each to the first names, alphabetically, so
// every phone gets the same answer.
export function balances(costs) {
  const out = {};
  for (const c of costs) {
    if (c.deleted) continue;
    const total = toMinor(c.amount, c.currency);
    const names = [...c.split].sort((x, y) => key(x).localeCompare(key(y)));
    const each = Math.floor(total / names.length);
    let extra = total - each * names.length;
    const book = (out[c.currency] ||= {});
    const add = (name, minor) => {
      const k = key(name);
      book[k] = { name: book[k] ? book[k].name : name, minor: (book[k] ? book[k].minor : 0) + minor };
    };
    add(c.paidBy, total);
    for (const n of names) {
      add(n, -(each + (extra > 0 ? 1 : 0)));
      if (extra > 0) extra -= 1;
    }
  }
  return out;
}

// The fewest payments that settle it: the biggest debt pays the biggest
// credit first. [{ from, to, minor, amount, currency }]
export function settleUp(costs) {
  const transfers = [];
  for (const [currency, book] of Object.entries(balances(costs)).sort(([a], [b]) => a.localeCompare(b))) {
    const byName = (x, y) => key(x.name).localeCompare(key(y.name));
    const owe = Object.values(book).filter((p) => p.minor < 0).map((p) => ({ ...p, minor: -p.minor })).sort((x, y) => y.minor - x.minor || byName(x, y));
    const get = Object.values(book).filter((p) => p.minor > 0).sort((x, y) => y.minor - x.minor || byName(x, y));
    let i = 0;
    let j = 0;
    while (i < owe.length && j < get.length) {
      const minor = Math.min(owe[i].minor, get[j].minor);
      if (minor > 0) transfers.push({ from: owe[i].name, to: get[j].name, minor, amount: fromMinor(minor, currency), currency });
      owe[i].minor -= minor;
      get[j].minor -= minor;
      if (!owe[i].minor) i += 1;
      if (!get[j].minor) j += 1;
    }
  }
  return transfers;
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: minorDigits(currency), maximumFractionDigits: minorDigits(currency) }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(minorDigits(currency))}`;
  }
}

// The ways the payer can pay this person back, each with the amount filled in.
// Venmo and Cash App take dollars (Cash App pounds too); UPI takes rupees;
// PayPal.me takes any currency it supports; bank details work anywhere and
// are copied, not opened. Venmo's and Cash App's links are unverified until
// tested on a phone (docs/SPLIT-COSTS.md).
export function payOptions(transfer, person, note = 'TripDeputy') {
  const pay = normalizePay(person && person.pay);
  const amt = transfer.amount;
  const msg = encodeURIComponent(note.slice(0, 60));
  const out = [];
  if (pay.venmo && transfer.currency === 'USD') out.push({ kind: 'venmo', label: 'Venmo', url: `https://venmo.com/${encodeURIComponent(pay.venmo)}?txn=pay&amount=${amt}&note=${msg}` });
  if (pay.paypal) out.push({ kind: 'paypal', label: 'PayPal', url: `https://paypal.me/${encodeURIComponent(pay.paypal)}/${amt}${transfer.currency}` });
  if (pay.cashapp && (transfer.currency === 'USD' || transfer.currency === 'GBP')) out.push({ kind: 'cashapp', label: 'Cash App', url: `https://cash.app/$${encodeURIComponent(pay.cashapp)}/${amt}` });
  if (pay.upi && transfer.currency === 'INR') out.push({ kind: 'upi', label: 'UPI', url: `upi://pay?pa=${encodeURIComponent(pay.upi)}&pn=${encodeURIComponent(person.name)}&am=${amt}&cu=INR&tn=${msg}` });
  if (pay.bank) out.push({ kind: 'bank', label: 'Copy bank details', copy: `${pay.bank}\nAmount: ${formatMoney(amt, transfer.currency)}\nReference: ${note.slice(0, 60)}` });
  return out;
}
