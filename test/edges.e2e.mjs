// Swipes at the screen's side, on every machine, in Chromium through the real pages:  node test/edges.e2e.mjs
// (needs Playwright). On a phone with gesture navigation a swipe that starts by the screen's side is Back: a thumb on a
// flipper that rolls inward has its touch taken (pointercancel) and a Back follows. On each machine, at 390 x 844 with
// a touch screen: nothing overscrolls sideways and the canvas takes every touch; a finger down playing puts a step in
// the history, gone again a while after it lifts; a Back while it's down, or just after the browser takes the touch,
// keeps the round going; with no finger down there's no step, and Back goes to the floor in one press, from a round or
// from the title card (where a swipe from the very edge lands on the canvas under the card); a reload makes the step a
// plain one.
// What a finger holds or slides keeps clear of the screen's sides at 320, 360 and 390 px: Tilt's Launch button, the
// far ends of Topple's aim and the reach of Roll Up's ball. (Tilt's flippers take a tap or a hold on either half of
// the screen, so they need no slide; a dead strip by the sides would only miss flips.) And Tilt's address still names
// the table in the machine once the step for a slip comes off.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  let body;
  try { body = await readFile(join(root, path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await pw.chromium.launch();
const problems = [];
// A phone, with every machine played before (so each opens on its small title card) and today's special made already.
async function phone(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    try {
      const d = new Date(), key = [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-');
      if (!localStorage.getItem('free-play.special')) localStorage.setItem('free-play.special', JSON.stringify({ key, machine: 'made by the tests' }));
      for (const m of ['roll-up', 'tilt', 'clutch', 'topple', 'highrise', 'popgun', 'bonkers', 'hoops']) {
        if (!localStorage.getItem('free-play.' + m)) localStorage.setItem('free-play.' + m, JSON.stringify({ rounds: 1, games: 1 }));
      }
    } catch { /* storage off */ }
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' || type === 'touchMove' ? [{ x, y, id: 1 }] : [] });
  return { ctx, page, touch };
}

// Each machine: its hook, its Play button, how to tell its round is going on (no card up: a Back that the page took for
// leaving would pause it, or leave), and where a finger plays on it: a point on the page, from the machine's own
// drawing where it has to be exact, else by the screen's side, where the back gesture starts.
const MACHINES = [
  { path: 'tilt/', hook: 'tilt', play: '#startBtn', slip: 2500, ready: () => window.tilt.game.mode === 'play',
    cards: ['title', 'pause', 'over'], going: () => window.tilt.game.mode === 'play',
    at: () => ({ x: 30, y: 600 }) }, // a thumb on the left flipper
  { path: 'roll-up/', hook: 'rollUp', play: '#play', ready: () => window.rollUp.mode === 'aim', again: true,
    cards: ['title', 'menu', 'over'],
    at: () => { const b = window.rollUp.ball, p = window.rollUp.scene.project({ x: b.x, y: b.y, z: b.z }); return { x: p.x, y: p.y }; } },
  { path: 'clutch/', hook: 'clutch', play: '#play', slip: 2500, ready: () => window.clutch.state === 'ready',
    cards: ['title', 'menu'],
    at: () => ({ x: 30, y: 400 }) }, // a thumb holding the glass
  { path: 'topple/', hook: 'topple', play: '#play', ready: () => !!window.topple.cup,
    cards: ['title', 'menu', 'over'],
    at: () => ({ x: 30, y: 400 }) },
  { path: 'highrise/', hook: 'highrise', play: '#play', ready: () => window.highrise.ready, again: true,
    cards: ['title', 'menu'],
    at: () => ({ x: 30, y: 400 }) },
  { path: 'popgun/', hook: 'popgun', play: '#play', ready: () => window.popgun.mode === 'play',
    cards: ['title', 'menu', 'over'],
    at: async () => { const { W, H } = await import('./js/gallery.js'); const p = window.popgun.draw.at(W / 2, H / 2); return { x: p.x, y: p.y }; } },
  { path: 'bonkers/', hook: 'bonkers', play: '#play', ready: () => window.bonkers.mode === 'play',
    cards: ['title', 'menu', 'over'],
    at: async () => { const { HOLES } = await import('./js/burrow.js'); const p = window.bonkers.draw.at(HOLES[0], -30); return { x: p.x, y: p.y }; } },
  { path: 'hoops/', hook: 'hoops', play: '#play', ready: () => window.hoops.mode === 'play',
    cards: ['title', 'menu', 'over'],
    at: () => ({ x: 195, y: 700 }) },
];

for (const m of MACHINES) {
  const where = m.path.slice(0, -1), machine = base + m.path, floor = base;
  const { ctx, page, touch } = await phone();
  await page.goto(floor);
  await page.goto(machine);
  await page.waitForFunction(h => !!window[h], m.hook, { timeout: 10000 });
  const stillOn = async what => {
    await page.waitForTimeout(300);
    assert.equal(page.url(), machine, `${where}: ${what} left the machine`);
    assert.ok(await page.evaluate(ids => ids.every(id => document.getElementById(id).hidden), m.cards), `${where}: ${what} put a card up`);
    if (m.going) assert.ok(await page.evaluate(m.going), `${where}: ${what} didn't keep the round going`);
  };
  const back = () => page.goBack({ waitUntil: 'commit', timeout: 3000 }).catch(() => {});
  const toFloor = what => page.waitForURL(floor, { timeout: 3000 }).catch(() => assert.fail(`${where}: ${what} didn't go to the floor in one press`));

  // Nothing overscrolls sideways, and the machine takes every touch on its canvas.
  const look = await page.evaluate(() => ['html', 'body', '#stage'].map(s => { const c = getComputedStyle(document.querySelector(s)); return [c.overscrollBehaviorX, c.touchAction]; }));
  assert.deepEqual([look[0][0], look[1][0]], ['none', 'none'], `${where}: the page overscrolls sideways`);
  assert.equal(look[2][1], 'none', `${where}: the canvas doesn't take every touch`);

  const extra = () => page.evaluate(() => !!history.state?.__edgeGuard);
  const quiet = () => page.waitForTimeout((m.slip || 1000) + 400);

  // A swipe Back from the very edge of the screen on the title card isn't play: it goes to the floor in one press,
  // although it lands on the canvas under the card and the browser takes the touch.
  await touch('touchStart', 2, 420); await touch('touchMove', 20, 420); await touch('touchCancel');
  assert.ok(!(await extra()), `${where}: a touch on the title card put a step in the history`);
  await back();
  await toFloor('a swipe Back from the title card');

  // A round. The tap on Play is the page's first tap (a browser skips a step a page adds before one).
  await page.goForward({ waitUntil: 'load' });
  await page.waitForFunction(h => !!window[h], m.hook, { timeout: 10000 });
  await page.tap(m.play);
  await page.waitForFunction(m.ready, null, { timeout: 10000 });
  await page.waitForTimeout(400); // (a touch just after a card goes is taken for the second tap of a double tap on it)
  assert.ok(!(await extra()), `${where}: with no finger down, the page has a step of its own in the history`);
  const at = await page.evaluate(m.at);

  // A finger down playing puts a step in the history for a slip; a Back then keeps the round going.
  await touch('touchStart', at.x, at.y);
  assert.ok(await extra(), `${where}: a finger down playing didn't put a step in the history`);
  await back();
  await stillOn('a Back with a finger down');
  // A while after it lifts, the step is gone again, and the round still going.
  await touch('touchEnd');
  await quiet();
  assert.ok(!(await extra()), `${where}: the step was still there a while after the finger lifted`);
  await stillOn('taking the step off');
  if (m.again) await page.waitForFunction(m.ready, null, { timeout: 15000 });

  // The browser takes the touch, as the phone's back gesture does, and a Back follows: the round goes on.
  await touch('touchStart', at.x, at.y); await touch('touchMove', at.x + 12, at.y); await touch('touchCancel');
  await back();
  await stillOn('a Back just after the touch was taken');

  // A while later, with no step of the page's own left, Back goes to the floor in one press.
  await quiet();
  assert.ok(!(await extra()), `${where}: the step was still there a while after the touch was taken`);
  await back();
  await toFloor('Back a while after a touch was taken');
  await ctx.close();
}

// Tilt: a table picked while the step for a slip is still there (the last ball drained under a held flipper, and
// Change table straight away) is still the one the address names when the step comes off, though the page's own
// step under it had the address from before, so a reload or a shared link opens it.
{
  const { ctx, page, touch } = await phone();
  await page.goto(base + 'tilt/?table=space');
  await page.waitForFunction(() => !!window.tilt);
  await page.tap('#startBtn');
  await page.waitForFunction(() => window.tilt.game.mode === 'play');
  await touch('touchStart', 30, 600);
  await page.evaluate(() => window.tilt.useTable('haunted'));
  await touch('touchEnd');
  await page.waitForFunction(() => !history.state?.__edgeGuard, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  assert.equal(new URL(page.url()).search, '?table=haunted', "Tilt's address names another table once the step for a slip comes off");
  assert.equal(await page.evaluate(() => window.tilt.table.name), 'Haunted House');
  await ctx.close();
}

// Reloaded just after a finger lifted, with the step for a slip still there: the step is a plain one from then on
// (the one under it belongs to the page before the reload), so Back takes two presses to the floor, that once.
{
  const { ctx, page, touch } = await phone();
  await page.goto(base);
  await page.goto(base + 'hoops/');
  await page.waitForFunction(() => !!window.hoops);
  await page.tap('#play');
  await page.waitForFunction(() => window.hoops.mode === 'play');
  await page.waitForTimeout(400);
  await touch('touchStart', 195, 700); await touch('touchEnd');
  assert.ok(await page.evaluate(() => !!history.state?.__edgeGuard), 'a finger down playing on Hoops put no step in the history');
  await page.reload();
  await page.waitForFunction(() => !!window.hoops);
  await page.waitForTimeout(1400);
  assert.ok(!(await page.evaluate(() => !!history.state?.__edgeGuard)), 'after a reload, the step for a slip is still one');
  await page.goBack({ waitUntil: 'commit', timeout: 3000 }).catch(() => {});
  await page.goBack({ waitUntil: 'commit', timeout: 3000 }).catch(() => {});
  await page.waitForURL(base, { timeout: 3000 }).catch(() => assert.fail("after a reload, two Backs didn't go to the floor"));
  await ctx.close();
}

// What a finger holds or slides keeps 24 px from the screen's sides, clear of where the back gesture starts.
for (const viewport of [{ width: 320, height: 568 }, { width: 320, height: 640 }, { width: 360, height: 740 }, { width: 390, height: 844 }]) {
  const w = viewport.width, { ctx, page } = await phone(viewport);
  // Tilt's Launch button, held to launch, on each table.
  await page.goto(base + 'tilt/');
  await page.waitForFunction(() => !!window.tilt);
  for (const table of ['classic', 'space', 'haunted']) {
    await page.evaluate(t => { window.tilt.useTable(t); window.tilt.startGame(); }, table);
    await page.waitForSelector('#launch:not([hidden])');
    const b = await page.evaluate(() => { const r = document.getElementById('launch').getBoundingClientRect(); return { left: r.left, right: innerWidth - r.right }; });
    assert.ok(b.left >= 24 && b.right >= 24, `Tilt's Launch button is ${Math.min(b.left, b.right).toFixed(1)} px from the side on ${table} at ${w} px`);
  }
  // Topple: the chute reaches both ends of its rail with the finger 24 px from the screen's sides.
  await page.goto(base + 'topple/');
  await page.waitForFunction(() => !!window.topple);
  const ends = await page.evaluate(async () => {
    const { DECK } = await import('./js/machine.js');
    const d = window.topple.draw, a = d.railX(0), k = (d.railX(100) - a) / 100, px = mm => (mm - a) / k;
    return { left: px(12), right: innerWidth - px(DECK.W - 12) };
  });
  assert.ok(ends.left >= 24 && ends.right >= 24, `Topple's aim needs a finger ${Math.min(ends.left, ends.right).toFixed(1)} px from the side at ${w} px`);
  // Roll Up: the ball, dragged across, stays inside the lane, whose near end is well in from the sides.
  await page.goto(base + 'roll-up/');
  await page.waitForFunction(() => !!window.rollUp);
  const lane = await page.evaluate(async () => {
    const { LANE } = await import('./js/physics.js');
    const s = window.rollUp.scene, l = s.project({ x: -LANE.half, y: 0, z: LANE.start - 12 }), r = s.project({ x: LANE.half, y: 0, z: LANE.start - 12 });
    return { left: Math.min(l.x, r.x), right: innerWidth - Math.max(l.x, r.x) };
  });
  assert.ok(lane.left >= 24 && lane.right >= 24, `Roll Up's lane is ${Math.min(lane.left, lane.right).toFixed(1)} px from the side at ${w} px`);
  await ctx.close();
}

assert.deepEqual(problems, [], 'problems at the edges');
await browser.close();
server.close();
console.log('all good');
