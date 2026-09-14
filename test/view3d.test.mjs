// Run: node --test test/*.test.mjs
// Loads the 3D scene code out of view3d.js, with the helpers it needs from index.html,
// and checks the boxes it builds with plain numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
const view = readFileSync(new URL("../view3d.js", import.meta.url), "utf8");
function section(script, start, end) {
  const a = script.indexOf(start);
  assert.ok(a >= 0, `missing section ${start}`);
  return script.slice(a, script.indexOf(end, a + start.length));
}
function fn(name) {
  const a = main.indexOf(`\nfunction ${name}(`);
  assert.ok(a >= 0, `missing function ${name}`);
  return main.slice(a, main.indexOf("\n}\n", a) + 3);
}
const src = [
  section(main, "/* ---------- type registry", "/* ---------- inline-SVG icons"),
  ...["aabb", "rotatePoint", "rotRectAabb"].map(fn),
  section(main, "/* ---------- room walls", "/* ---------- view helpers"),
  section(view, "/* ---------- 3d: scene", "/* ---------- 3d: drawing"),
  ";({ sceneBoxes, walkBlocked, walkStep })",
].join("\n");
const E = vm.runInThisContext(`(() => {\n${src}\n})()`.replace(";({", "return ({"));

function obj(id, type, x, y, w, h, extra = {}) {
  return { id, type, label: type, x, y, w, h, z: 0, height: 75, rot: 0, flip: 0, color: "#336699", clear: { N: 0, E: 0, S: 0, W: 0 }, wall: 0, ...extra };
}
// A 400 x 300 room with 20 cm walls, 250 cm high. Door in the south wall from x 100 to 180,
// window in the north wall from x 200 to 320 with its sill at 90 cm.
function room(rot = 0) {
  return [
    obj(1, "room", 0, 0, 400, 300, { wall: 20, height: 250, rot }),
    obj(2, "door", 100, 290, 80, 20, { height: 210 }),
    obj(3, "window", 200, -10, 120, 20, { z: 90, height: 120 }),
    obj(4, "bed", 250, 100, 140, 190, { height: 50 }),
  ];
}
// Height ranges of the boxes of one kind whose centre lies in a plan rect, sorted.
function spans(boxes, kind, r) {
  return boxes.filter((b) => b.kind === kind && b.cx > r.x && b.cx < r.x + r.w && b.cy > r.y && b.cy < r.y + r.h)
    .map((b) => [b.y0, b.y1]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

test("a door leaves only the wall above it", () => {
  const boxes = E.sceneBoxes(room());
  assert.deepEqual(spans(boxes, "wall", { x: 100, y: 280, w: 80, h: 40 }), [[210, 250]]);
  assert.deepEqual(spans(boxes, "wall", { x: 20, y: 280, w: 80, h: 40 }), [[0, 250]]);
  assert.deepEqual(spans(boxes, "glass", { x: 100, y: 280, w: 80, h: 40 }), []);
});

test("a window leaves the wall below and above it, with a frame and glass between", () => {
  const boxes = E.sceneBoxes(room());
  const at = { x: 200, y: -20, w: 120, h: 40 };
  assert.deepEqual(spans(boxes, "wall", at), [[0, 90], [210, 250]]);
  assert.deepEqual(spans(boxes, "glass", at), [[95, 205]]);
  // two jambs over the full height, the sill and the head
  assert.deepEqual(spans(boxes, "frame", at), [[90, 95], [90, 210], [90, 210], [205, 210]]);
});

test("a door has a frame and a leaf standing open on its swing side", () => {
  const boxes = E.sceneBoxes(room());
  assert.deepEqual(spans(boxes, "frame", { x: 95, y: 280, w: 90, h: 40 }), [[0, 210], [0, 210], [205, 210]]);
  // flip 0: hinge on the left, the leaf stands north of the door, into the room, 70 cm long
  const leaf = boxes.find((b) => b.kind === "frame" && b.d === 70);
  assert.deepEqual([leaf.cx, leaf.cy, leaf.w, leaf.y1], [107, 255, 4, 205]);
});

test("a room with no wall thickness still gets thin walls in 3D, outside its outline, cut by its door", () => {
  const objs = room();
  objs[0] = { ...objs[0], wall: 0 };
  const boxes = E.sceneBoxes(objs);
  const west = boxes.filter((b) => b.kind === "wall" && b.cx < 0);
  assert.deepEqual(west.map((b) => [b.cx, b.w]), [[-5, 10]]);
  assert.deepEqual(spans(boxes, "wall", { x: 100, y: 280, w: 80, h: 40 }), [[210, 250]]);
  assert.equal(E.walkBlocked(boxes, 150, 150), false);
  assert.equal(E.walkBlocked(boxes, 50, 290), true);
});

test("walls fill the whole band around the openings", () => {
  const boxes = E.sceneBoxes(room()).filter((b) => b.kind === "wall");
  // north band: -10..410 in x. Full-height slices plus the two partial ones cover it once.
  const north = boxes.filter((b) => Math.abs(b.cy) < 1).map((b) => b.w * (b.y1 - b.y0)).reduce((s, v) => s + v, 0);
  assert.equal(north, 420 * 250 - 120 * 120);
});

test("furniture stands at its height and a room has a floor", () => {
  const boxes = E.sceneBoxes([...room(), obj(5, "bookshelf", 20, 20, 80, 30, { z: 120, height: 40 })]);
  const bed = boxes.find((b) => b.kind === "piece" && b.w === 140);
  assert.deepEqual([bed.cx, bed.cy, bed.y0, bed.y1], [320, 195, 0, 50]);
  const shelf = boxes.find((b) => b.kind === "piece" && b.w === 80);
  assert.deepEqual([shelf.y0, shelf.y1], [120, 160]);
  assert.equal(boxes.filter((b) => b.kind === "floor").length, 1);
});

test("walking: blocked by walls, windows and furniture, free through a door", () => {
  const boxes = E.sceneBoxes(room());
  assert.equal(E.walkBlocked(boxes, 150, 150), false, "middle of the room");
  assert.equal(E.walkBlocked(boxes, 50, 295), true, "in the south wall");
  assert.equal(E.walkBlocked(boxes, 140, 300), false, "in the door gap");
  assert.equal(E.walkBlocked(boxes, 260, 0), true, "in the window gap");
  assert.equal(E.walkBlocked(boxes, 235, 200), true, "15 cm from the bed");
  assert.equal(E.walkBlocked(boxes, 225, 200), false, "25 cm from the bed");
});

test("walking: under a high shelf, not under a low one", () => {
  const shelf = (z) => E.sceneBoxes([...room(), obj(5, "bookshelf", 20, 20, 80, 30, { z, height: 30 })]);
  assert.equal(E.walkBlocked(shelf(190), 60, 60), false);
  assert.equal(E.walkBlocked(shelf(120), 60, 60), true);
});

test("walking into a wall slides along it, and a stuck person can walk out", () => {
  const boxes = E.sceneBoxes(room());
  assert.deepEqual(E.walkStep(boxes, 40, 150, -15, 10), { x: 40, y: 160 });
  assert.deepEqual(E.walkStep(boxes, 320, 195, 5, 0), { x: 325, y: 195 });   // inside the bed
});

test("a turned room cuts its walls where the door is", () => {
  // Room turned 90° around its centre (200, 150): its south wall now runs along x = 50.
  const objs = room(90);
  objs[1] = obj(2, "door", 10, 110, 80, 20, { rot: 90, height: 210 });   // world box x 40..60, y 110..190
  objs.splice(2, 1);
  const boxes = E.sceneBoxes(objs);
  assert.deepEqual(spans(boxes, "wall", { x: 40, y: 110, w: 20, h: 80 }), [[210, 250]]);
});
