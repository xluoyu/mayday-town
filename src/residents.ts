import Phaser from 'phaser';
import { showDialog, dialog } from './dialog';
import { mapPoint } from './town-map';

type Resident = { id: string; name: string; area: string; x: number; y: number; height: number; greeting: string; role: string; lines?: string[] };
export const residents: Resident[] = [
  { id: 'banana', name: '香蕉哥', area: 'Town', x: .225, y: .70, height: 94, role: '雪橇驿站 · 礼物运输', greeting: '雪橇已经准备好啦，一起把礼物送进雪夜吧！' },
  { id: 'tomato', name: '番茄君', area: 'Town', x: .32, y: .365, height: 65, role: '姜饼工坊 · 冬日烘焙', greeting: '今天的姜饼刚出炉，先来闻闻暖暖的香气！' },
  { id: 'lemon', name: '柠檬仔', area: 'Town', x: .70, y: .345, height: 70, role: '铃铛音乐亭 · 彩灯守护', greeting: '把每一盏小灯点亮，让铃声陪你过圣诞。' },
  { id: 'cherry', name: '樱桃姊妹', area: 'Market', x: .70, y: .445, height: 78, role: '礼物包装台 · 成对心意', greeting: '一份给你，一份给想念的人。今天想把什么装进礼物盒？' },
  { id: 'apple', name: '青苹果', area: 'Lake', x: .28, y: .76, height: 67, role: '冰湖乐园 · 雪地寻物', greeting: '雪地里藏着冬天的小惊喜，沿着湖边慢慢找找吧！' },
  { id: 'rabbit', name: '纯真兔兔', area: 'Market', x: .535, y: .405, height: 98, role: '圣诞邮局 · 心愿引导', greeting: '欢迎来到圣诞邮局，把想说的话写给远方的人吧。' },
  { id: 'fishing-bear', name: '人生海海摸魚熊', area: 'Lake', x: .74, y: .79, height: 96, role: '冰钓小屋 · 冬日钓友', greeting: '穿好背带裤，带上小鱼朋友，一起等冰湖里的惊喜吧！' },
  { id: 'pomelo', name: '柚初戀了可愛柚', area: 'Market', x: .81, y: .76, height: 79, role: '木偶小舞台 · 暖场伙伴', greeting: '叶子整理好了，蝴蝶结也系好了。今晚的小舞台要开演啦！' },
  { id: 'golden-shrimp', name: '金多虾', area: 'Market', x: .24, y: .445, height: 76, role: '热可可摊 · 暖心招待', greeting: '来杯热可可暖暖身子，多一点香甜，多一点快乐！' },
  { id: 'blue-dragon', name: '约翰蓝龙', area: 'Station', x: .79, y: .79, height: 94, role: '货运棚 · 装载伙伴', greeting: '游戏机先收好，一起检查货箱，把圣诞礼物送上车吧！' },
  { id: 'pink-dragon', name: '丘比粉龙', area: 'Town', x: .80, y: .71, height: 94, role: '礼物小屋 · 心意守护', greeting: '这支爱心箭会替你指路，来挑一份送给重要的人的礼物吧。' },
  { id: 'pear', name: '鸭梨大小姐', area: 'Station', x: .275, y: .72, height: 78, role: '林间营地 · 暖心陪伴', greeting: '在营地坐一会儿，看看星灯，把今天的鸭梨慢慢放下吧。' },
  { id: 'yogurt', name: '养乐多', area: 'Station', x: .27, y: .455, height: 82, role: '站房窗口 · 到站迎接', greeting: '欢迎抵达星光车站！带上一小瓶快乐，开始今晚的小镇旅程。' },
  { id: 'blueberry', name: '倔强卜', area: 'Station', x: .71, y: .445, height: 73, role: '观星台 · 星光守望', greeting: '今晚我在观星台等你，再冷的夜晚，也总有一颗星为你亮着。' },
];

// Only the five band balls are random street visitors; established hosts stay fixed.
// Allocate once at page load, retaining the layout when switching scenes.
const ballStreetSlots = [
  { area: 'Town', x: .43, y: .84 },
  { area: 'Town', x: .65, y: .77 },
  { area: 'Market', x: .43, y: .64 },
  { area: 'Market', x: .61, y: .76 },
  { area: 'Lake', x: .43, y: .78 },
  { area: 'Lake', x: .63, y: .60 },
  { area: 'Station', x: .42, y: .56 },
  { area: 'Station', x: .65, y: .75 },
];
for (let i = ballStreetSlots.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [ballStreetSlots[i], ballStreetSlots[j]] = [ballStreetSlots[j], ballStreetSlots[i]];
}
// Original game dialogue inspired by published interviews, not personal quotations.
const bandBalls = [
  { id: 'mayday-ashin', name: '阿信', lines: [
    '今天先收集一个小小的开心，明天再多一个。慢慢地，也能堆成很大的幸福。',
    '如果一时不知道往哪里走，就先去有灯的地方吧。今晚的小镇，会有人陪你。',
    '雪落下来没有声音，不过你来了，这个晚上就有了想唱歌的理由。',
  ] },
  { id: 'mayday-monster', name: '怪兽', lines: [
    '礼物带了、围巾戴了，人也到齐了。好，下一站出发，我来带路！',
    '喜欢的事就认真玩。先把这一小段练好，下一段我们一起研究。',
    '别急着一个人扛，分一点给我们。五个人一起，总有办法把事情弄好。',
  ] },
  { id: 'mayday-masa', name: '玛莎', lines: [
    '你是不是绕了三圈还没选好礼物？没关系，至少今天的运动量有了。',
    '拍雪景可以，记得也看看旁边的人。人家陪你站这么久，不是路灯耶。',
    '这杯可可很甜。好了，今天的苦先放旁边，明天再来认真讨论。',
  ] },
  { id: 'mayday-ming', name: '冠佑', lines: [
    '一、二、三、四。不是催你走，是怕你跟不上我的散步节拍。',
    '大家说今天要交换礼物。我已经准备好了，就等大家记得叫我。',
    '天冷就把外套穿好，走累就休息。这个建议很简单，但真的有用。',
  ] },
  { id: 'mayday-stone', name: '石头', lines: [
    '刚才那一段路很安静，脚踩着雪的声音也很好听。要不要一起再走一小段？',
    '挑礼物时想到的那个人，或许才是今晚最值得记住的风景。',
    '如果遇到好看的灯，就停下来看看。回家以后，也可以讲给家里的人听。',
  ] },
];
bandBalls.forEach((ball, index) => residents.push({
  ...ball, ...ballStreetSlots[index], height: 67,
  role: '五月天 · 街道偶遇', greeting: ball.lines[0],
}));
const dialogueTurns = new Map<string, number>();

export function preloadResidents(scene: Phaser.Scene) {
  for (const resident of residents)
    if (!scene.textures.exists(`resident-${resident.id}`))
      scene.load.image(`resident-${resident.id}`, `/assets/characters/${resident.id}-v1.png`);
}

export function createResidents(scene: Phaser.Scene, area: string) {
  for (const resident of residents.filter(item => item.area === area)) {
    const { x, y } = mapPoint(resident.x, resident.y);
    const sprite = scene.add.image(x, y, `resident-${resident.id}`).setOrigin(.5, 1).setDepth(y + 2);
    const scale = resident.height / sprite.height;
    sprite.setScale(scale);
    scene.add.ellipse(x, y - 1, sprite.displayWidth * .65, 12, 0x233f47, .22).setDepth(y + 1);
    const label = scene.add.text(x, y - resident.height - 12, resident.name, {
      fontFamily: 'Microsoft YaHei', fontSize: '17px', color: '#fff0ce',
      backgroundColor: '#183944', padding: { x: 10, y: 7 },
    }).setOrigin(.5, 1).setDepth(4001).setVisible(false);
    sprite.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 32 });
    sprite.on('pointerover', () => { if (!dialog.open) label.setVisible(true); });
    sprite.on('pointerout', () => label.setVisible(false));
    sprite.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      label.setVisible(false);
      const turn = dialogueTurns.get(resident.id) ?? 0;
      const greeting = resident.lines ? resident.lines[turn % resident.lines.length] : resident.greeting;
      dialogueTurns.set(resident.id, turn + 1);
      showDialog(resident.name, resident.role, greeting);
    });
    scene.tweens.add({ targets: sprite, scaleX: scale * 1.015, scaleY: scale * .985,
      duration: 1500, delay: residents.indexOf(resident) * 190, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}

