// The page in a real browser (Chromium via Playwright): the TripDeputy link
// follows the answers, the answers save to a file and load back, and a
// TripDeputy share link fills the form. Run with: node --test tests/
// It needs the `playwright` package; where that is missing it is skipped
// with a message, and tests/brief.test.mjs still covers the logic.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { decodeTrip, tokenFromHash, shareUrl } from './tripdeputy/share.js';
import { normalizeTrip } from './tripdeputy/trip.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
// require, not import: a globally installed Playwright is found through
// NODE_PATH, which ES module imports ignore.
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { chromium = null; }
const skip = chromium ? false : 'playwright is not installed here';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
let server, base, browser;
before(async () => {
  if (skip) return;
  server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); if (server) server.close(); });

async function openPage() {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  const sent = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith(base)) sent.push(r.url()); });
  await page.goto(`${base}/tool/`);
  await page.waitForFunction(() => document.getElementById('td-open').href.includes('#trip='));
  return { page, ctx, errors, sent };
}
const tripFrom = async (page) => decodeTrip(tokenFromHash(new URL(await page.getAttribute('#td-open', 'href')).hash));

test('the TripDeputy link carries the example trip, and follows every change', { skip }, async () => {
  const { page, ctx, errors, sent } = await openPage();
  let trip = await tripFrom(page);
  assert.equal(trip.destination, 'Lisbon, Portugal');
  assert.equal(trip.nights, 4);
  assert.deepEqual(trip.interests, ['food', 'history', 'nature']);
  assert.match(await page.textContent('#td-notes'), /No exact start date/);

  await page.fill('#dest', 'Oaxaca, Mexico');
  await page.fill('#when', '2026-12-27 for a week');
  await page.selectOption('#pace', { index: 2 });
  await page.click('#tags .chip[data-tag="Beaches"]');
  await page.click('#tags .chip[data-tag="Nature & hikes"]');
  trip = await tripFrom(page);
  assert.equal(trip.destination, 'Oaxaca, Mexico');
  assert.equal(trip.startDate, '2026-12-27');
  assert.equal(trip.nights, 7);
  assert.equal(trip.pace, 'packed');
  assert.deepEqual(trip.interests, ['food', 'history', 'beach']);
  assert.equal(await page.textContent('#td-notes'), '');

  // Clear changes values without input events; the link still follows.
  await page.click('#clear');
  trip = await tripFrom(page);
  assert.equal(trip.destination, '');
  assert.match(await page.textContent('#td-notes'), /No destination yet/);

  assert.deepEqual(errors, []);
  // Building the request and following the answers sends nothing anywhere.
  assert.deepEqual(sent, []);
  await ctx.close();
});

test('save the answers to a file, change them, and load the file back', { skip }, async () => {
  const { page, ctx } = await openPage();
  await page.fill('#who', 'three friends');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#brief-save')]);
  assert.equal(dl.suggestedFilename(), 'lisbon-portugal-brief.json');
  // Playwright keeps a download under a random name; load it under its own.
  const file = path.join(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'brief-')), dl.suggestedFilename());
  fs.copyFileSync(await dl.path(), file);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.format, 'trip-brief');
  assert.equal(saved.who, 'three friends');

  await page.click('#clear');
  await page.click('summary');
  await page.setInputFiles('#brief-file', file);
  assert.match(await page.textContent('#brief-status'), /Filled in from lisbon-portugal-brief\.json/);
  assert.equal(await page.inputValue('#dest'), 'Lisbon, Portugal');
  assert.equal(await page.inputValue('#who'), 'three friends');
  const on = await page.$$eval('#tags .chip.on', (cs) => cs.map((c) => c.dataset.tag));
  assert.deepEqual(on, ['Food & markets', 'History & museums', 'Nature & hikes']);
  // The request is rebuilt from the loaded answers.
  assert.match(await page.textContent('#out pre'), /Travelers: three friends/);
  await ctx.close();
});

test('a TripDeputy share link fills the form, by paste or by opening the page with it', { skip }, async () => {
  const td = normalizeTrip({ destination: 'Kyoto', startDate: '2026-04-02', nights: 6, travelers: 'family of four', pace: 'relaxed', interests: ['history', 'kids'], notes: 'temple list' });
  const link = shareUrl('https://tripdeputy.com', td);
  const { page, ctx } = await openPage();
  await page.click('summary');
  await page.fill('#brief-paste', link);
  await page.click('#brief-fill');
  assert.match(await page.textContent('#brief-status'), /Filled in from the TripDeputy link\. .*notes stay in TripDeputy/);
  assert.equal(await page.inputValue('#dest'), 'Kyoto');
  assert.equal(await page.inputValue('#when'), '7 days from 2026-04-02');
  assert.equal(await page.$eval('#pace', (s) => s.selectedIndex), 0);
  assert.deepEqual(await page.$$eval('#tags .chip.on', (cs) => cs.map((c) => c.dataset.tag)), ['History & museums', 'Kid-friendly']);
  // And straight back: the link now carries the same trip to TripDeputy.
  const back = await tripFrom(page);
  assert.equal(back.startDate, '2026-04-02');
  assert.equal(back.nights, 6);
  assert.equal(back.kids, true);

  await page.fill('#brief-paste', 'https://tripdeputy.com/plan/#trip=t1.cut');
  await page.click('#brief-fill');
  assert.match(await page.textContent('#brief-status'), /cut short or damaged/);
  assert.equal(await page.inputValue('#dest'), 'Kyoto');
  await ctx.close();

  const direct = await browser.newPage();
  await direct.goto(`${base}/tool/${new URL(link).hash}`);
  await direct.waitForFunction(() => document.getElementById('dest').value === 'Kyoto');
  await direct.close();
});

test('on a phone the new controls fit the screen', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/tool/`);
  await page.click('summary');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page scrolls sideways by ${overflow}px`);
  for (const sel of ['#td-open', '#brief-save', '#brief-fill', '#brief-paste']) {
    const box = await page.locator(sel).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375, `${sel} is off screen`);
  }
  await ctx.close();
});
