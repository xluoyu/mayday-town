import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
try {
  await page.route('**/src/main.ts*', async route => { const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()) + '\nwindow.__testGame = game; ' }); });
  await page.goto('http://127.0.0.1:5174');
  await page.waitForFunction(async () => window.__testGame.scene.isActive('Town'));
  const expected = await page.evaluate(async () => (await import(performance.getEntriesByType('resource').find(e => e.name.includes('/src/residents.ts')).name)).residents);
  assert.equal(expected.length, 14);
  const seen = [];
  for (const [key, name] of [['Town', '中央小镇'], ['Market', '圣诞集市'], ['Lake', '冰湖乐园'], ['Station', '星光车站']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(350);
    const actual = await page.evaluate(async key => {
      const game = window.__testGame;
      return game.scene.getScene(key).children.list.filter(o => o.texture?.key.startsWith('resident-'))
        .map(o => ({ id: o.texture.key.slice(9), x: o.x, y: o.y }));
    }, key);
    assert.deepEqual(actual.map(o => o.id).sort(), expected.filter(o => o.area === key).map(o => o.id).sort());
    seen.push(...actual.map(o => o.id));
    await page.screenshot({ path: `design/residents-${key}-v3.png` });
    for (const resident of actual) {
      const pt = await page.evaluate(async ({ key, id }) => {
        const game = window.__testGame;
        const s = game.scene.getScene(key), o = s.children.list.find(o => o.texture?.key === `resident-${id}`), c = s.cameras.main;
        const im=o.texture.getSourceImage(), cv=document.createElement('canvas'); cv.width=im.width;cv.height=im.height;const ctx=cv.getContext('2d');ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,im.width,im.height).data;
        let best=Infinity, px=0, py=0;
        for(let y=4;y<im.height-4;y+=4)for(let x=4;x<im.width-4;x+=4){const d=(x-im.width*.5)**2+(y-im.height*.5)**2;if(pixels[(y*im.width+x)*4+3]>220 && [-12,0,12].every(dy=>[-12,0,12].every(dx=>pixels[((y+dy)*im.width+x+dx)*4+3]>220)) && d<best){best=d;px=x;py=y;}}
        return { x: (o.x+(px/im.width-.5)*o.displayWidth-c.scrollX-c.width/2)*c.zoom+c.width/2,
          y: (o.y+(py/im.height-1)*o.displayHeight-c.scrollY-c.height/2)*c.zoom+c.height/2 };
      }, { key, id: resident.id });
      console.log(resident.id, pt); await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(80); await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(80);
      assert.equal(await page.locator('#modal').evaluate(e => e.open), true, resident.id);
      assert.equal(await page.locator('#modal-title').textContent(), expected.find(o => o.id === resident.id).name);
      await page.locator('#close').click();
    }
    console.log(key, actual.map(o => o.id));
  }
  assert.equal(new Set(seen).size, 14);
  const before = JSON.stringify(expected);
  await page.getByRole('button', { name: '中央小镇', exact: true }).click();
  assert.equal(await page.evaluate(async () => JSON.stringify((await import(performance.getEntriesByType('resource').find(e => e.name.includes('/src/residents.ts')).name)).residents)), before);
  assert.deepEqual(errors, []);
  console.log('PASS: 14 residents loaded once across 4 scenes; all clicked correctly; assignments stable on revisit; no runtime or resource errors.');
} finally { await browser.close(); }


