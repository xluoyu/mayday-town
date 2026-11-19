import Phaser from "phaser";
import { preloadResidents, createResidents } from "./residents";
import { dialog, showDialog } from "./dialog";
import { openSmileGame } from "./smile-game";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  ROAD_CLICK_RADIUS,
  mapPoint,
  nearestRoad,
  locateWalkTarget,
  findRoadRoute,
} from "./town-map";
import type { Point, RoadLocation } from "./town-map";
import type { Area, Place } from "./areas";
import { drawSceneBackdrop } from "./scene-backdrop";
const avatarOrigins = [
  [303.5 / 627, 567 / 627],
  [315 / 627, 567 / 627],
  [303.5 / 627, 568 / 627],
  [320.5 / 627, 569 / 627],
];

export class TownScene extends Phaser.Scene {
  private player: Point;
  private facing = 0;
  private route: Point[] = [];
  private pendingPlace: Place | null = null;
  private avatar!: Phaser.GameObjects.Container;
  private avatarSprite!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private marker!: Phaser.GameObjects.Graphics;
  private routeLine!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private roadOverlay!: Phaser.GameObjects.Graphics;
  private roadLabels!: Phaser.GameObjects.Container;
  private hop = 0;
  private lastFootprint = 0;
  private footprints: Phaser.GameObjects.Ellipse[] = [];
  constructor(private area: Area) {
    super(area.key);
    this.player = { ...area.graph.nodes[area.spawn] };
  }
  preload() {
    preloadResidents(this);
    if (!this.textures.exists(this.area.image))
      this.load.image(
        this.area.image,
        `/assets/scenes/${this.area.image}-background-v1.png`,
      );
    if (!this.textures.exists("bubu-directions"))
      this.load.spritesheet(
        "bubu-directions",
        "/assets/characters/bubu-turnaround-v1.png",
        { frameWidth: 627, frameHeight: 627 },
      );
  }
  create() {
    this.route = [];
    this.pendingPlace = null;
    this.footprints = [];
    this.lastFootprint = 0;
    this.add
      .image(0, 0, this.area.image)
      .setOrigin(0)
      .setDisplaySize(MAP_WIDTH, MAP_HEIGHT)
      .setDepth(-1);
    for (const place of this.area.places) this.createPlace(place);
    for (const occluder of this.area.occluders ?? [])
      this.createForeground(occluder.polygon, occluder.depth);
    this.routeLine = this.add.graphics().setDepth(0);
    this.marker = this.add.graphics().setDepth(1);
    this.shadow = this.add.ellipse(0, 0, 40, 13, 0x233f47, 0.24);
    this.avatarSprite = this.add
      .image(0, 0, "bubu-directions", 0)
      .setDisplaySize(100, 100);
    this.faceDirection(this.facing);
    this.avatar = this.add.container(0, 0, [this.avatarSprite]);
    this.label = this.add
      .text(0, 0, "", {
        fontFamily: "Microsoft YaHei",
        fontSize: "18px",
        color: "#fff0ce",
        backgroundColor: "#183944",
        padding: { x: 14, y: 9 },
      })
      .setOrigin(0.5, 1)
      .setDepth(4000)
      .setVisible(false);
    createResidents(this, this.area.key);
    this.createRoadOverlay();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (dialog.open || pointer.button !== 0) return;
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const target = locateWalkTarget(point, this.area.graph);
      // Road clicks take priority where broad building hit polygons overlap paths.
      if (target.distance <= ROAD_CLICK_RADIUS) {
        this.pendingPlace = null;
        this.walkTo(target);
        return;
      }
      const place = [...this.area.places]
        .sort((a, b) => b.depth - a.depth)
        .find((place) =>
          Phaser.Geom.Polygon.Contains(
            new Phaser.Geom.Polygon(
              place.polygon.map(([x, y]) => mapPoint(x, y)),
            ),
            point.x,
            point.y,
          ),
        );
      if (place) {
        this.label.setVisible(false);
        this.pendingPlace = place;
        this.walkTo(
          nearestRoad(this.area.graph.nodes[place.node], this.area.graph),
        );
      }
    });
    this.scale.on("resize", this.resize, this);
    this.events.once("shutdown", () =>
      this.scale.off("resize", this.resize, this),
    );
    this.resize();
    this.cameras.main.fadeIn(180, 6, 48, 66);
    this.game.events.emit("area-active", this.area.key);
  }
  private resize() {
    const { width, height } = this.scale;
    const zoom = Math.max(
      0.2,
      Math.min(width / MAP_WIDTH, (height - 210) / MAP_HEIGHT),
    );
    this.cameras.main
      .setZoom(zoom)
      .centerOn(MAP_WIDTH / 2, MAP_HEIGHT / 2 - 35 / zoom);
    drawSceneBackdrop(
      this.textures.get(this.area.image).getSourceImage() as HTMLImageElement,
      {
        left: (width - MAP_WIDTH * zoom) / 2,
        top: (height - MAP_HEIGHT * zoom) / 2 + 35,
        width: MAP_WIDTH * zoom,
        height: MAP_HEIGHT * zoom,
      },
    );
  }
  private createRoadOverlay() {
    const { nodes, edges } = this.area.graph;
    this.roadOverlay = this.add.graphics().setDepth(6000);
    this.roadOverlay.fillStyle(0x49efa4, 0.25);
    for (const polygon of this.area.graph.walkAreas ?? [])
      this.roadOverlay.fillPoints(polygon, true);
    this.roadOverlay.lineStyle(ROAD_CLICK_RADIUS * 2, 0x49efa4, 0.25);
    for (const [from, to] of edges)
      this.roadOverlay.lineBetween(
        nodes[from].x,
        nodes[from].y,
        nodes[to].x,
        nodes[to].y,
      );
    this.roadOverlay.fillStyle(0x49efa4, 0.25);
    for (const point of nodes)
      this.roadOverlay.fillCircle(point.x, point.y, ROAD_CLICK_RADIUS);
    this.roadOverlay.lineStyle(2, 0x9dffcd, 0.95);
    for (const [from, to] of edges)
      this.roadOverlay.lineBetween(
        nodes[from].x,
        nodes[from].y,
        nodes[to].x,
        nodes[to].y,
      );
    this.roadLabels = this.add.container(0, 0).setDepth(6001);
    nodes.forEach((point, index) => {
      this.roadLabels.add(
        this.add
          .text(point.x, point.y, String(index), {
            fontFamily: "Microsoft YaHei",
            fontSize: "14px",
            color: "#123d30",
            backgroundColor: "#c9ffe1",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5),
      );
    });
    this.setRoadVisibility(this.registry.get("roads-visible") === true);
  }
  setRoadVisibility(visible: boolean) {
    this.roadOverlay?.setVisible(visible);
    this.roadLabels?.setVisible(visible);
  }
  private createForeground(polygon: number[][], depth: number) {
    const points = polygon.map(([x, y]) => mapPoint(x, y));
    // Clip the same background pixels into depth-sorted foreground layers.
    const shape = this.add.graphics().setVisible(false);
    shape.fillStyle(0xffffff).fillPoints(points, true);
    this.add
      .image(0, 0, this.area.image)
      .setOrigin(0)
      .setDisplaySize(MAP_WIDTH, MAP_HEIGHT)
      .setDepth(depth * MAP_HEIGHT)
      .setMask(shape.createGeometryMask());
  }
  private createPlace(place: Place) {
    this.createForeground(place.polygon, place.depth);
    const points = place.polygon.map(([x, y]) => mapPoint(x, y));
    const area = new Phaser.Geom.Polygon(points);
    const hit = this.add
      .zone(0, 0, MAP_WIDTH, MAP_HEIGHT)
      .setOrigin(0)
      .setDepth(place.depth * MAP_HEIGHT + 1);
    hit.setInteractive(area, Phaser.Geom.Polygon.Contains).input!.cursor =
      "pointer";
    hit.on("pointerover", () => {
      if (dialog.open) return;
      const door = this.area.graph.nodes[place.node];
      this.label
        .setText(place.name)
        .setPosition(door.x, door.y - 35)
        .setVisible(true);
    });
    hit.on("pointerout", () => this.label.setVisible(false));
  }
  private faceDirection(frame: number) {
    this.facing = frame;
    const [x, y] = avatarOrigins[frame];
    this.avatarSprite.setFrame(frame).setOrigin(x, y);
  }
  private walkTo(target: RoadLocation) {
    this.route = findRoadRoute(this.player, target, this.area.graph);
    this.marker
      .clear()
      .lineStyle(2, 0xffdc9d, 0.9)
      .strokeEllipse(target.point.x, target.point.y, 34, 14);
    this.routeLine
      .clear()
      .lineStyle(2, 0xffe3a6, 0.45)
      .beginPath()
      .moveTo(this.player.x, this.player.y);
    for (const point of this.route) this.routeLine.lineTo(point.x, point.y);
    this.routeLine.strokePath();
  }
  update(time: number, delta: number) {
    if (!this.avatar) return;
    const dt = Math.min(delta, 40) / 1000;
    const moving = !dialog.open && this.route.length > 0;
    if (moving) {
      const target = this.route[0],
        dx = target.x - this.player.x,
        dy = target.y - this.player.y;
      const distance = Math.hypot(dx, dy),
        step = 170 * dt;
      if (distance > 0.001)
        this.faceDirection(dy >= 0 ? (dx >= 0 ? 1 : 0) : dx >= 0 ? 3 : 2);
      if (distance <= step) {
        this.player = { ...target };
        this.route.shift();
      } else {
        this.player.x += (dx / distance) * step;
        this.player.y += (dy / distance) * step;
      }
      this.hop += dt * 10;
      if (this.route.length === 0) {
        this.marker.clear();
        this.routeLine.clear();
        const place = this.pendingPlace;
        this.pendingPlace = null;
        if (place?.name === "礼物小屋") openSmileGame();
        else if (place)
          showDialog(
            place.name,
            place.description,
            "场景美术预览，可继续探索其他点位。",
          );
      }
    }
    const height = moving ? Math.abs(Math.sin(this.hop)) * 12 : 0;
    this.avatar
      .setPosition(this.player.x, this.player.y - height)
      .setDepth(this.player.y + 2);
    this.avatar.setScale(1 + height / 400, 1 - height / 400);
    this.shadow
      .setPosition(this.player.x, this.player.y)
      .setScale(1 - height / 60)
      .setDepth(this.player.y + 1);
    if (moving && time - this.lastFootprint > 180) {
      this.lastFootprint = time;
      this.footprints.push(
        this.add
          .ellipse(this.player.x, this.player.y, 5, 2.5, 0x796d58, 0.25)
          .setDepth(1),
      );
      if (this.footprints.length > 65) this.footprints.shift()!.destroy();
    }
  }
}

