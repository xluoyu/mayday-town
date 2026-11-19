import Phaser from 'phaser';
import { dialog, showDialog } from './dialog';

const BEST_KEY = 'bubu.masa.best.v1';
const PARTNERS = [
  { id: 'lemon', name: '柠檬仔' },
  { id: 'apple', name: '青苹果' },
  { id: 'blueberry', name: '倔强卜' },
  { id: 'pomelo', name: '可爱柚' },
  { id: 'tomato', name: '番茄君' },
];
type Target = { view: Phaser.GameObjects.Container; kind: number; age: number; x0: number; vx: number; vy: number; spin: number; speed: number };

class SmileScene extends Phaser.Scene {
  private targets: Target[] = [];
  private score = 0;
  private lives = 3;
  private elapsed = 0;
  private spawnIn = 0;
  private state: 'ready' | 'playing' | 'paused' | 'ended' = 'ready';
  private best = 0;
  private counts = [0, 0, 0, 0, 0];
  constructor(private host: HTMLElement) { super('Smile'); }

  preload() {
    this.load.image('smile-masa', '/assets/characters/smile-masa.png');
    this.load.image('smile-town', '/assets/scenes/town-background-v1.png');
    for (const partner of PARTNERS)
      this.load.image(`smile-${partner.id}`, `/assets/characters/${partner.id}-v1.png`);
  }

  create() {
    // A centered dialog can move when text wraps without resizing the canvas.
    // Refresh Phaser's cached input bounds before it transforms the next click.
    const refreshBounds = () => this.scale.updateBounds();
    const canvas = this.game.canvas;
    for (const event of ['mousedown', 'touchstart']) canvas.addEventListener(event, refreshBounds, true);
    const releaseInput = () => {
      for (const event of ['mousedown', 'touchstart']) canvas.removeEventListener(event, refreshBounds, true);
    };
    this.events.once('shutdown', releaseInput);
    this.events.once('destroy', releaseInput);
    try { const n = Number(localStorage.getItem(BEST_KEY)); this.best = Number.isSafeInteger(n) && n > 0 ? n : 0; } catch { /* Storage is optional. */ }
    this.textures.get('smile-masa').add('portrait', 0, 320, 65, 900, 890);
    this.add.image(480, 270, 'smile-town').setDisplaySize(960, 540);
    this.add.rectangle(480, 270, 960, 540, 0x082d3b, 0.48);
    const decor = this.add.graphics();
    decor.lineStyle(3, 0x536f62).beginPath().moveTo(0, 5).lineTo(160, 33).lineTo(320, 12).lineTo(480, 38).lineTo(640, 12).lineTo(800, 33).lineTo(960, 5).strokePath();
    for (let i = 0; i < 25; i++) {
      const x = i * 40, y = 15 + Math.sin(i * 0.6) * 10;
      decor.fillStyle(0xffd78b, 0.12).fillCircle(x, y, 14);
      decor.fillStyle(i % 3 ? 0xffdd9d : 0xe79774).fillCircle(x, y, 4);
    }
    for (let i = 0; i < 65; i++) decor.fillStyle(0xffffff, 0.15 + (i % 4) * 0.1).fillCircle((i * 137) % 960, (i * 89) % 540, 1 + i % 2);
    decor.fillStyle(0xe4eee5, 0.2).fillEllipse(480, 570, 1200, 110);
    this.host.querySelector<HTMLButtonElement>('[data-action="start"]')!.onclick = () => this.startRound();
    this.host.querySelector<HTMLButtonElement>('[data-action="pause"]')!.onclick = () => this.togglePause();
    const visibility = () => { if (document.hidden && this.state === 'playing') this.togglePause(); };
    document.addEventListener('visibilitychange', visibility);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', visibility));
    this.events.once('destroy', () => document.removeEventListener('visibilitychange', visibility));
    this.renderHud();
  }

  private startRound() {
    this.tweens.killAll();
    this.children.list.filter(child => child.name === 'hit-feedback').forEach(child => child.destroy());
    this.targets.forEach(t => t.view.destroy());
    this.targets = [];
    this.score = 0; this.lives = 3; this.elapsed = 0; this.spawnIn = 700;
    this.counts.fill(0); this.state = 'playing';
    this.tweens.timeScale = 1;
    this.host.querySelector('[data-time]')!.textContent = '0 秒';
    this.spawn(0); this.spawn(5);
    this.message('接住抛起的小镇伙伴，+1。让玛莎安静落下，别点他！');
    this.renderHud();
  }

  private togglePause() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = this.state === 'playing' ? 'paused' : 'playing';
    this.tweens.timeScale = this.state === 'paused' ? 0 : 1;
    this.renderHud();
  }

  private difficulty() {
    const progress = Math.min(1, this.elapsed / 60000);
    return {
      interval: 800 - 540 * progress,
      speed: 1 + 0.55 * progress,
      dangerChance: 0.28 + 0.12 * progress,
      burstChance: 0.12 + 0.53 * progress,
      limit: 6 + Math.round(6 * progress),
      stage: this.elapsed < 15000 ? '热身' : this.elapsed < 30000 ? '加速' : this.elapsed < 60000 ? '挑战' : '狂欢',
    };
  }

  private launchWave(random = Math.random) {
    const difficulty = this.difficulty();
    const count = random() < difficulty.burstChance ? (this.elapsed >= 30000 && random() < 0.35 ? 3 : 2) : 1;
    for (let i = 0; i < count; i++)
      this.spawn(random() < difficulty.dangerChance ? 5 : Phaser.Math.Between(0, 4));
    this.spawnIn = difficulty.interval;
  }

  private spawn(kind: number) {
    const difficulty = this.difficulty();
    if (this.targets.length >= difficulty.limit) return;
    // Separate launch lanes keep a whole wave from starting on the same spot.
    const lanes = [150, 282, 414, 546, 678, 810].filter(x => this.targets.every(t => t.age > 240 || Math.abs(t.x0 - x) > 110));
    if (!lanes.length) return;
    const x0 = Phaser.Utils.Array.GetRandom(lanes);
    // Ballistic flight: constant horizontal speed and gravity, no timed fade.
    const vx = x0 < 480 ? Phaser.Math.Between(45, 140) : -Phaser.Math.Between(45, 140);
    const view = this.add.container(x0, 610);
    const portrait = this.add.image(0, 0, kind === 5 ? 'smile-masa' : `smile-${PARTNERS[kind].id}`, kind === 5 ? 'portrait' : undefined);
    portrait.setScale(108 / Math.max(portrait.width, portrait.height));
    view.add(portrait);
    if (kind === 5) view.add(this.add.text(0, -68, '别点我', { fontFamily: 'Microsoft YaHei', fontSize: '16px', color: '#ffe9ad', backgroundColor: '#613943', padding: { x: 9, y: 4 } }).setOrigin(0.5));
    view.setName(kind === 5 ? 'danger' : PARTNERS[kind].id);
    view.setSize(112, 112).setInteractive(new Phaser.Geom.Circle(56, 56, 52), Phaser.Geom.Circle.Contains);
    const target = { view, kind, age: 0, x0, vx, vy: -Phaser.Math.Between(690, 790), spin: Phaser.Math.FloatBetween(-0.18, 0.18), speed: difficulty.speed };
    this.targets.push(target);
    view.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.state !== 'playing' || pointer.button !== 0 || !this.targets.includes(target)) return;
      const hitX = view.x, hitY = view.y;
      this.targets.splice(this.targets.indexOf(target), 1); view.destroy();
      if (kind === 5) {
        this.lives--; this.message('哎呀，碰到玛莎了！扣除 1 次机会。');
        this.cameras.main.shake(100, 0.004);
      } else {
        this.score++; this.counts[kind]++; this.message(`找到${PARTNERS[kind].name}，+1！`);
      }
      const feedback = this.add.text(hitX, hitY, kind === 5 ? '别欺负玛莎！−1' : '+1', { fontFamily: 'Microsoft YaHei', fontSize: '28px', fontStyle: 'bold', color: kind === 5 ? '#ffc3b3' : '#ffe7ac', stroke: '#244334', strokeThickness: 4 }).setOrigin(0.5).setDepth(100);
      feedback.setName('hit-feedback');
      this.tweens.add({ targets: feedback, y: hitY - 45, alpha: 0, duration: 550, onComplete: () => feedback.destroy() });
      if (!this.lives) this.finish();
      this.renderHud();
    });
  }

  private finish() {
    this.state = 'ended';
    this.best = Math.max(this.best, this.score);
    try { localStorage.setItem(BEST_KEY, String(this.best)); } catch { /* Play without persistence. */ }
    this.targets.forEach(t => t.view.destroy()); this.targets = [];
    this.message(`本局 ${this.score} 分 · 坚持 ${Math.floor(this.elapsed / 1000)} 秒。可以再挑战一次。`);
  }

  private message(text: string) { this.host.querySelector('[data-feedback]')!.textContent = text; }

  private renderHud() {
    this.host.querySelector('[data-score]')!.textContent = String(this.score);
    this.host.querySelector('[data-lives]')!.textContent = String(this.lives);
    this.host.querySelector('[data-best]')!.textContent = String(this.best);
    this.host.querySelector('[data-stage]')!.textContent = this.difficulty().stage;
    this.host.querySelector('[data-counts]')!.textContent = `收集记录：${PARTNERS.map((p, i) => `${p.name} ${this.counts[i]}`).join(' · ')}`;
    const pause = this.host.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
    pause.disabled = this.state === 'ready' || this.state === 'ended';
    pause.textContent = this.state === 'paused' ? '继续游戏' : '暂停';
    const start = this.host.querySelector<HTMLButtonElement>('[data-action="start"]')!;
    start.hidden = this.state === 'playing' || this.state === 'paused';
    start.textContent = this.state === 'ended' ? '再玩一次' : '开始游戏';
    const overlay = this.host.querySelector<HTMLElement>('[data-overlay]')!;
    overlay.hidden = this.state === 'playing';
    this.host.querySelector('[data-state]')!.textContent = this.state === 'ready' ? '伙伴们，要起飞啦！' : this.state === 'paused' ? '雪夜小憩，等你回来' : `本次收集 · ${this.score} 分`;
    this.host.dataset.state = this.state;
  }

  update(_time: number, delta: number) {
    if (this.state !== 'playing') return;
    const dt = Math.min(delta, 50);
    this.elapsed += dt; this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.launchWave();
    }
    for (const target of [...this.targets]) {
      target.age += dt;
      // Scale the whole flight clock to accelerate both ascent and descent,
      // keeping the same reachable arc instead of throwing above the screen.
      const seconds = target.age / 1000 * target.speed;
      target.view.setPosition(target.x0 + target.vx * seconds, 610 + target.vy * seconds + 260 * seconds * seconds);
      target.view.rotation = target.spin * seconds;
      if (seconds > 1 && target.view.y > 630) {
        target.view.destroy(); this.targets.splice(this.targets.indexOf(target), 1);
      }
    }
    this.host.querySelector('[data-time]')!.textContent = `${Math.floor(this.elapsed / 1000)} 秒`;
    this.host.querySelector('[data-stage]')!.textContent = this.difficulty().stage;
  }
}

export function openSmileGame() {
  if (dialog.open) return;
  showDialog('不要欺负玛莎', '点击抛起的伙伴，收集一点快乐。玛莎就让他飞过去吧！', '', '☺');
  dialog.classList.add('smile-dialog');
  const host = document.querySelector<HTMLElement>('#modal-body')!;
  host.innerHTML = `
    <div class="smile-hud"><span>收集快乐 <b data-score>0</b></span><span>剩余机会 <b data-lives>3</b></span><span>个人纪录 <b data-best>0</b></span><span><span data-stage>热身</span> · <span data-time>0 秒</span></span></div>
    <div class="smile-board"><div class="smile-canvas" role="application" aria-label="不要欺负玛莎，点击抛起的小镇伙伴，避开玛莎"></div><div class="smile-overlay" data-overlay><div class="smile-ticket"><span class="smile-kicker">圣诞小镇 · 雪夜游乐场</span><img class="smile-masa-preview" src="/assets/characters/smile-masa.png" alt="不要点击的玛莎"><strong data-state>正在准备游戏…</strong><p>伙伴 +1 分 · 玛莎 −1 次机会<br>共有 3 次机会，漏接不扣分</p></div></div></div>
    <div class="smile-legend">${PARTNERS.map(p => `<span><img src="/assets/characters/${p.id}-v1.png" alt="">${p.name}</span>`).join('')}<span class="smile-danger-legend">玛莎：请放过我</span></div>
    <div class="smile-controls"><button class="primary" data-action="start">开始游戏</button><button class="primary" data-action="pause" disabled>暂停</button></div>
    <p data-feedback role="status" aria-live="polite">从雪地抛起，沿弧线落下。看准伙伴再点击。</p><div data-counts></div>`;
  const minigame = new Phaser.Game({ type: Phaser.CANVAS, parent: host.querySelector<HTMLElement>('.smile-canvas')!, width: 960, height: 540, backgroundColor: '#143443', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { keyboard: false }, scene: new SmileScene(host), audio: { noAudio: true } });
  dialog.addEventListener('close', () => {
    minigame.destroy(true);
    dialog.classList.remove('smile-dialog');
    host.replaceChildren();
    delete host.dataset.state;
  }, { once: true });
}
