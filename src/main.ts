import Phaser from "phaser";
import "./style.css";
import { TownScene } from "./town";
import { showDialog } from "./dialog";
import { dialog } from "./dialog";
import { areas } from "./areas";
import { startSnowfall } from "./snowfall";
import { openSmileGame } from "./smile-game";

document.getElementById('play-smile')!.onclick = openSmileGame;

const stopSnowfall = startSnowfall(
  document.querySelector<HTMLCanvasElement>("#snowfall")!,
);
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) stopSnowfall();
});

document.getElementById("help")!.onclick = () =>
  showDialog(
    "欢迎来到圣诞小镇",
    "点击石板路或开放广场，卜卜会蹦跳到所点位置。点击建筑或圣诞树，会自动到达并打开介绍。",
    "点击上方区域名称前往集市、冰湖或车站。返回时保留停留位置与朝向。",
  );
export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  transparent: true,
  antialias: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: areas.map((area) => new TownScene(area)),
  input: { keyboard: false },
  render: { roundPixels: false },
});

let activeArea = "Town";
let switching = true;
const roadsButton = document.getElementById("toggle-roads")!;
roadsButton.onclick = () => {
  const visible = game.registry.get("roads-visible") !== true;
  game.registry.set("roads-visible", visible);
  roadsButton.textContent = visible ? "隐藏道路" : "显示道路";
  roadsButton.setAttribute("aria-pressed", String(visible));
  if (!switching)
    (game.scene.getScene(activeArea) as TownScene).setRoadVisibility(visible);
};
const navigation = document.getElementById("areas")!;
const buttons = areas.map((area) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = area.name;
  button.disabled = true;
  button.setAttribute("aria-pressed", String(area.key === activeArea));
  button.onclick = () => {
    if (switching || area.key === activeArea || dialog.open) return;
    switching = true;
    buttons.forEach((item) => (item.disabled = true));
    game.scene.stop(activeArea);
    game.scene.start(area.key);
  };
  navigation.append(button);
  return button;
});
game.events.on("area-active", (key: string) => {
  activeArea = key;
  switching = false;
  buttons.forEach((button, index) => {
    button.disabled = false;
    button.setAttribute("aria-pressed", String(areas[index].key === key));
  });
  document.querySelector(".eyebrow")!.textContent = areas.find(
    (area) => area.key === key,
  )!.name;
});
