import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.route('**/src/smile-game.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('dialog.addEventListener("close",', 'window.__smile = minigame; dialog.addEventListener("close",') });
});
await page.route('**/src/main.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()) + '\nwindow.__town = game;' });
});
const host = page.locator('#modal-body');
async function clickTarget(danger) {
  await page.evaluate(danger => {
    const scene = window.__smile.scene.getScene('Smile');
    // Isolate this input trial from unrelated overlapping trajectories.
    scene.targets.forEach(t => t.view.destroy()); scene.targets = [];
    scene.spawn(danger ? 5 : 0);
  }, danger);
  await page.waitForTimeout(650);
  const pos = await page.evaluate(() => {
    const t = window.__smile.scene.getScene('Smile').targets[0];
    const r = window.__smile.canvas.getBoundingClientRect();
    return { x: r.left + t.view.x / 960 * r.width, y: r.top + t.view.y / 540 * r.height };
  });
  await page.mouse.click(pos.x, pos.y);
}try {
  await page.goto(process.env.SMILE_TEST_URL || 'http://127.0.0.1:5175');
  await page.waitForFunction(() => window.__town?.scene.isActive('Town'));
  await page.getByRole('button', { name: '不要欺负玛莎' }).click();
  await page.waitForFunction(() => document.querySelector('#modal-body').dataset.state === 'ready');
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  const flight = await page.evaluate(() => {
    const s = window.__smile.scene.getScene('Smile');
    s.targets.forEach(t => t.view.destroy()); s.targets = []; s.spawnIn = 999999;
    s.spawn(5); const t = s.targets[0];
    const sample = () => ({ x: t.view.x, y: t.view.y, alpha: t.view.alpha });
    const initial = sample();
    for (let i = 0; i < 12; i++) s.update(0, 50);
    const rising = sample();
    for (let i = 0; i < 18; i++) s.update(0, 50);
    const peak = sample();
    for (let i = 0; i < 12; i++) s.update(0, 50);
    const falling = sample();
    s.togglePause(); const beforePause = sample();
    s.update(0, 50); const afterPause = sample(); s.togglePause();
    for (let i = 0; i < 30; i++) s.update(0, 50);
    const removed = !s.targets.includes(t);
    s.startRound();
    return { initial, rising, peak, falling, beforePause, afterPause, removed };
  });
  assert.ok(flight.initial.y > 540, 'launch below the board');
  assert.ok(flight.rising.y < flight.initial.y && flight.peak.y < flight.rising.y);
  assert.ok(flight.falling.y > flight.peak.y, 'descend after apex');
  assert.notEqual(flight.rising.x, flight.peak.x, 'horizontal arc movement');
  assert.equal(flight.falling.alpha, 1, 'never fade away');
  assert.deepEqual(flight.beforePause, flight.afterPause);
  assert.ok(flight.removed, 'remove after falling below board');
  const ramp = await page.evaluate(() => {
    const s = window.__smile.scene.getScene('Smile');
    const levels = [0, 15000, 30000, 60000, 120000].map(time => {
      s.elapsed = time; return s.difficulty();
    });
    s.targets.forEach(t => t.view.destroy()); s.targets = [];
    s.elapsed = 60000;
    s.launchWave(() => 0.1);
    const wave = s.targets.map(t => ({ x: t.x0, speed: t.speed, label: t.view.list.find(c => c.type === 'Text')?.text }));
    const interval = s.spawnIn;
    s.startRound();
    return { levels, wave, interval };
  });
  assert.ok(ramp.levels[3].interval < ramp.levels[0].interval);
  assert.ok(ramp.levels[3].speed > ramp.levels[0].speed);
  assert.ok(ramp.levels[3].dangerChance > ramp.levels[0].dangerChance);
  assert.deepEqual(ramp.levels[3], ramp.levels[4], 'difficulty capped after 60 seconds');
  assert.equal(ramp.wave.length, 3, 'late-game three-target wave');
  assert.equal(new Set(ramp.wave.map(t => t.x)).size, 3, 'distinct launch lanes');
  assert.ok(ramp.wave.every(t => t.speed === 1.55 && t.label === '别点我'));
  assert.equal(ramp.interval, 260);
  await clickTarget(false);
  assert.equal(await page.locator('[data-score]').textContent(), '1');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const time = await page.locator('[data-time]').textContent();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('[data-time]').textContent(), time);
  assert.equal(await host.getAttribute('data-state'), 'paused');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  for (let i = 0; i < 3; i++) await clickTarget(true);
  assert.equal(await host.getAttribute('data-state'), 'ended');
  assert.equal(await page.locator('[data-lives]').textContent(), '0');
  assert.equal(await page.locator('[data-best]').textContent(), '1');
  await page.screenshot({ path: 'design/smile-result.png' });
  await page.getByRole('button', { name: '再玩一次', exact: true }).click();
  assert.equal(await page.locator('[data-score]').textContent(), '0');
  assert.equal(await page.locator('[data-lives]').textContent(), '3');
  await page.evaluate(() => {
    const scene = window.__smile.scene.getScene('Smile');
    for (let kind = 1; kind < 5; kind++) scene.spawn(kind);
  });
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'design/smile-playing.png' });
  await page.locator('#close').click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.smile-canvas canvas').count(), 0);
  await page.getByRole('button', { name: '不要欺负玛莎' }).click();
  await page.waitForFunction(() => document.querySelector('#modal-body').dataset.state === 'ready');
  assert.equal(await page.locator('[data-best]').textContent(), '1');
  await page.locator('#return').click();
  // Exercise the real town arrival dispatch, preserving player position on return.
  await page.evaluate(() => {
    const scene = window.__town.scene.getScene('Town');
    const place = scene.area.places.find(p => p.name === '礼物小屋');
    scene.pendingPlace = place;
    scene.route = [{ ...scene.player }];
  });
  await page.waitForFunction(() => document.querySelector('#modal-body').dataset.state === 'ready');
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  const before = await page.evaluate(() => ({ ...window.__town.scene.getScene('Town').player }));
  await page.locator('#return').click();
  const after = await page.evaluate(() => window.__town.scene.getScene('Town').player);
  assert.deepEqual(after, before);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '不要欺负玛莎' }).click();
  await page.waitForFunction(() => document.querySelector('#modal-body').dataset.state === 'ready');
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await clickTarget(false);
  assert.equal(await page.locator('[data-score]').textContent(), '1');
  await page.screenshot({ path: 'design/smile-mobile.png' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#modal').evaluate(e => e.open), false);
  assert.deepEqual(errors, []);
  console.log('PASS: ballistic launch, apex, descent, no fade, offscreen cleanup, paused trajectory; scoring, retry, best score, town return, mobile input and Escape. No runtime/resource errors.');
} catch (error) {
  await page.screenshot({ path: 'design/smile-failure.png' });
  throw error;
} finally { await browser.close(); }
