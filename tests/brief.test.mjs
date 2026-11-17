// The trip brief and its round trips, run with: node --test tests/
//
// The contract tests use TripDeputy's own code (tests/tripdeputy/, pinned):
// a link this page makes must open in TripDeputy's decodeTrip as the trip the
// person described, and a link TripDeputy makes must fill this page's form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as b from '../tool/brief.js';
import { decodeTrip, encodeTrip, shareUrl, tokenFromHash } from './tripdeputy/share.js';
import { normalizeTrip, INTERESTS as TD_INTERESTS } from './tripdeputy/trip.js';

const LISBON = {
  destination: 'Lisbon, Portugal', when: '5 days in late May', who: 'me + partner, no kids', budget: '~$2,000 excl. flights',
  paceIndex: 1, tags: ['Food & markets', 'History & museums', 'Nature & hikes'], constraints: 'vegetarian; one big hike; skip nightlife',
};
const openInTripDeputy = (url) => decodeTrip(tokenFromHash(new URL(url).hash));

test('every chip on the page is an interest TripDeputy knows', () => {
  for (const [, key] of b.INTERESTS) assert.ok(Object.hasOwn(TD_INTERESTS, key), key);
  assert.equal(b.INTERESTS.length, 12);
});

test('reading a length: days are nights plus one, and anything vague is not guessed', () => {
  const cases = { '5 days in late May': 4, 'a week in June': 7, 'two weeks': 14, '3 nights': 3, 'one night': 1, 'a weekend': 2, 'long weekend': 3,
    'day trip': 0, '10 days': 9, '1 day': 0, 'sometime in spring': null, '': null, 'a few days': null };
  for (const [words, nights] of Object.entries(cases)) assert.equal(b.readNights(words), nights, words);
});

test('reading a start date: only a whole date with a year, and only a real one', () => {
  assert.equal(b.readStart('5 days from 2026-05-20'), '2026-05-20');
  assert.equal(b.readStart('May 20, 2026 for a week'), '2026-05-20');
  assert.equal(b.readStart('leaving 3rd Sept 2026'), '2026-09-03');
  assert.equal(b.readStart('late May'), null);
  assert.equal(b.readStart('May 20'), null);
  assert.equal(b.readStart('2026-02-30'), null);
});

test('the example trip opens in TripDeputy as described, with the vague part kept in words', () => {
  const { url, notes } = b.tripDeputyLink(b.briefFromForm(LISBON));
  assert.ok(url.startsWith('https://tripdeputy.com/plan/#trip=t1.'));
  const trip = openInTripDeputy(url);
  assert.ok(trip, 'TripDeputy could not read the link');
  assert.equal(trip.destination, 'Lisbon, Portugal');
  assert.equal(trip.nights, 4);
  assert.equal(trip.startDate, null);
  assert.equal(trip.travelers, 'me + partner, no kids');
  assert.equal(trip.budget, '~$2,000 excl. flights');
  assert.equal(trip.pace, 'balanced');
  assert.deepEqual(trip.interests, ['food', 'history', 'nature']);
  assert.equal(trip.kids, false);
  assert.equal(trip.constraints, 'vegetarian; one big hike; skip nightlife; When: 5 days in late May');
  assert.deepEqual(notes, ['No exact start date, so the plan has no dates yet. Add one there when you know it.']);
  // TripDeputy gives a shared trip a fresh id of its own.
  assert.match(trip.id, /^[a-z0-9]{12}$/);
});

test('a whole date and length go over as numbers, with no words left over', () => {
  const trip = openInTripDeputy(b.tripDeputyLink(b.briefFromForm({ ...LISBON, when: '2026-05-20 for a week', constraints: '' })).url);
  assert.equal(trip.startDate, '2026-05-20');
  assert.equal(trip.nights, 7);
  assert.equal(trip.constraints, '');
});

test('a length the page cannot read is not invented: TripDeputy uses its own default, and the page says so', () => {
  const { url, notes } = b.tripDeputyLink(b.briefFromForm({ ...LISBON, when: 'sometime in spring' }));
  const trip = openInTripDeputy(url);
  assert.equal(trip.nights, normalizeTrip({}).nights);
  assert.match(trip.constraints, /When: sometime in spring$/);
  assert.match(notes.join(' '), /does not say how many, so it starts at its usual length/);
});

test('the kid-friendly chip sets TripDeputy\'s kids flag; "no kids" in the words does not', () => {
  assert.equal(openInTripDeputy(b.tripDeputyLink(b.briefFromForm({ ...LISBON, tags: ['Kid-friendly'] })).url).kids, true);
  assert.equal(openInTripDeputy(b.tripDeputyLink(b.briefFromForm({ ...LISBON, who: 'two adults and three kids', tags: [] })).url).kids, false);
});

test('an empty form still makes a link TripDeputy opens, and the page says what is missing', () => {
  const { url, notes } = b.tripDeputyLink(b.briefFromForm({}));
  const trip = openInTripDeputy(url);
  assert.ok(trip);
  assert.equal(trip.destination, '');
  assert.match(notes.join(' '), /No destination yet/);
});

test('text that is too long or has odd spacing is cut to what TripDeputy keeps, and TripDeputy agrees', () => {
  const brief = b.briefFromForm({ ...LISBON, destination: `  ${'x'.repeat(300)}  `, constraints: 'a\n\n  b' });
  assert.equal(brief.destination.length, 120);
  assert.equal(brief.constraints, 'a b');
  const trip = openInTripDeputy(b.tripDeputyLink(brief).url);
  assert.equal(trip.destination, brief.destination);
});

test('a TripDeputy share link fills the form, and says what stays in TripDeputy', () => {
  const td = normalizeTrip({
    destination: 'Kyoto', startDate: '2026-04-02', nights: 6, travelers: 'family of four', budget: 'mid', pace: 'relaxed',
    interests: ['history', 'food', 'kids'], constraints: 'one rest day', notes: 'temple list', saved: [{ url: 'https://example.com/ryokan', note: 'ryokan' }],
  });
  const { brief, notes } = b.readIncoming(shareUrl('https://tripdeputy.com', td));
  assert.equal(brief.destination, 'Kyoto');
  assert.equal(brief.when, '7 days from 2026-04-02');
  assert.equal(brief.who, 'family of four');
  assert.equal(brief.pace, 'relaxed');
  assert.deepEqual(brief.interests, ['history', 'food', 'kids']);
  assert.equal(brief.constraints, 'one rest day');
  assert.match(notes.join(' '), /notes stay in TripDeputy|saved link/);
  const form = b.formFromBrief(brief);
  assert.equal(form.paceIndex, 0);
  assert.deepEqual(form.tags, ['History & museums', 'Food & markets', 'Kid-friendly']);
});

test('round trip: page to TripDeputy and back gives the same brief', () => {
  const start = b.briefFromForm(LISBON);
  const trip = openInTripDeputy(b.tripDeputyLink(start).url);
  // TripDeputy re-shares the trip with its own encoder; the page reads it.
  const { brief } = b.readIncoming(`https://tripdeputy.com/plan/#trip=${encodeTrip(trip)}`);
  assert.deepEqual(brief, start);
});

test('round trip with a whole date: the length and date come back as plain words', () => {
  const start = b.briefFromForm({ ...LISBON, when: 'May 20, 2026 for 5 days' });
  const trip = openInTripDeputy(b.tripDeputyLink(start).url);
  const { brief } = b.readIncoming(`#trip=${encodeTrip(trip)}`);
  assert.equal(brief.when, '5 days from 2026-05-20');
  assert.deepEqual({ ...brief, when: '' }, { ...start, when: '' });
  // And the words read back to the same numbers.
  assert.equal(b.readNights(brief.when), 4);
  assert.equal(b.readStart(brief.when), '2026-05-20');
});

test('every way a pasted link or file can be wrong gets its own sentence', () => {
  assert.throws(() => b.readIncoming(''), /Paste a TripDeputy share link/);
  assert.throws(() => b.readIncoming('https://example.com/'), /not a TripDeputy trip link/);
  assert.throws(() => b.readIncoming('#trip=t1.!!!notbase64'), /cut short or damaged/);
  assert.throws(() => b.readIncoming(`#trip=t1.${btoa('{"v":1').replace(/=+$/, '')}`), /cut short or damaged/);
  assert.throws(() => b.readIncoming(`#trip=t1.${btoa('{"v":9}').replace(/=+$/, '')}`), /newer version/);
  assert.throws(() => b.readIncoming('{nope'), /not valid JSON/);
  assert.throws(() => b.readIncoming('{"format":"other"}'), /not a trip brief from this page/);
  assert.throws(() => b.readIncoming('{"format":"trip-brief","version":2}'), /newer version of this page/);
});

test('the brief file round-trips and cleans what a hand edit put in', () => {
  const start = b.briefFromForm(LISBON);
  assert.deepEqual(b.parseBriefFile(b.briefFile(start)), start);
  const edited = JSON.parse(b.briefFile(start));
  edited.pace = 'warp'; edited.interests.push('skydiving'); edited.extra = 'x';
  const back = b.parseBriefFile(JSON.stringify(edited));
  assert.equal(back.pace, 'balanced');
  assert.deepEqual(back.interests, ['food', 'history', 'nature']);
  assert.equal(back.extra, undefined);
});
