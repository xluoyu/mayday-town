import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true, channel: "msedge"});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+':'+r.status())});
await page.goto('http://127.0.0.1:5174');await page.waitForTimeout(2000);
for(const [key,name] of [['Town','中央小镇'],['Market','圣诞集市'],['Lake','冰湖乐园'],['Station','星光车站']]){
  await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(500);
  console.log(key,await page.evaluate(async(key)=>{const {game}=await import('/src/main.ts');const s=game.scene.getScene(key);return s.children.list.filter(o=>o.texture?.key.startsWith('resident-')).map(o=>({key:o.texture.key,x:o.x,y:o.y}));},key));
  await page.screenshot({path:`design/residents-${key}-v1.png`});
}
await page.getByRole('button',{name:'中央小镇',exact:true}).click();await page.waitForTimeout(400);
const pt=await page.evaluate(async()=>{const {game}=await import('/src/main.ts');const s=game.scene.getScene('Town');const o=s.children.list.find(o=>o.texture?.key==='resident-tomato');const c=s.cameras.main;return {x:(o.x-c.scrollX-c.width/2)*c.zoom+c.width/2,y:(o.y-o.displayHeight*.5-c.scrollY-c.height/2)*c.zoom+c.height/2};});
await page.mouse.click(pt.x,pt.y);await page.waitForTimeout(200);console.log('dialog',await page.locator('#modal').evaluate(e=>e.open),await page.locator('#modal-title').textContent());console.log('errors',errors);await browser.close();if(errors.length)process.exitCode=1;

