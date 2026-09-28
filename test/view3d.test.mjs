// Run: node --test test/*.test.mjs
// Loads core.js the way the page does, cuts the 3D scene code out of view3d.js,
// and checks the boxes it builds with plain numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coreUrl = new URL("../core.js", import.meta.url);
vm.runInThisContext(readFileSync(coreUrl, "utf8"), { filename: coreUrl.pathname });
const view = readFileSync(new URL("../view3d.js", import.meta.url), "utf8");
function section(script, start, end) {
  const a = script.indexOf(start);
  assert.ok(a >= 0, `missing section ${start}`);
  return script.slice(a, script.indexOf(end, a + start.length));
}
const src = [
  section(view, "/* ---------- 3d: scene", "/* ---------- 3d: drawing"),
  ";({ sceneBoxes, walkBlocked, walkStep, wallHidesView })",
].join("\n");
const E = vm.runInThisContext(`(() => {\n${src}\n})()`.replace(";({", "return ({"));
const { TYPES, TYPE_KEYS } = vm.runInThisContext("({ TYPES, TYPE_KEYS })");

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

// The plan and height extent of all the parts of one piece: [x0, x1, y0, y1, z0, z1].
function extent(boxes) {
  const r = (v) => Math.round(v * 1000) / 1000;
  return [
    Math.min(...boxes.map((b) => b.cx - b.w / 2)), Math.max(...boxes.map((b) => b.cx + b.w / 2)),
    Math.min(...boxes.map((b) => b.cy - b.d / 2)), Math.max(...boxes.map((b) => b.cy + b.d / 2)),
    Math.min(...boxes.map((b) => b.y0)), Math.max(...boxes.map((b) => b.y1)),
  ].map(r);
}

test("furniture stands at its height and a room has a floor", () => {
  const bed = E.sceneBoxes([obj(4, "bed", 250, 100, 140, 190, { height: 50 })]);
  assert.deepEqual(extent(bed), [250, 390, 100, 290, 0, 50]);
  const shelf = E.sceneBoxes([obj(5, "bookshelf", 20, 20, 80, 30, { z: 120, height: 40 })]);
  assert.deepEqual(extent(shelf), [20, 100, 20, 50, 120, 160]);
  assert.equal(E.sceneBoxes(room()).filter((b) => b.kind === "floor").length, 1);
});

test("every furniture type fills its footprint and height, with no part outside", () => {
  for (const type of TYPE_KEYS.filter((t) => TYPES[t].piece)) {
    for (const [w, h, height] of [[TYPES[type].w, TYPES[type].h, TYPES[type].height], [200, 40, 30], [10, 10, 10]]) {
      const boxes = E.sceneBoxes([obj(1, type, 10, 20, w, h, { z: 5, height })]);
      assert.ok(boxes.length > 0, type);
      for (const b of boxes) assert.ok(b.w > 0 && b.d > 0 && b.y1 > b.y0, `${type} ${w}x${h}: empty part`);
      assert.deepEqual(extent(boxes), [10, 10 + w, 20, 20 + h, 5, 5 + height], `${type} ${w}x${h}x${height}`);
    }
  }
});

test("walking: blocked by a table, a desk and a sofa, up close", () => {
  for (const type of ["table", "desk", "sofa"]) {
    const boxes = E.sceneBoxes([obj(1, type, 0, 0, 120, 80, { height: 75 })]);
    assert.equal(E.walkBlocked(boxes, 60, 40), true, `${type}: middle`);
    assert.equal(E.walkBlocked(boxes, 60, 95), true, `${type}: 15 cm in front`);
    assert.equal(E.walkBlocked(boxes, 60, 105), false, `${type}: 25 cm in front`);
  }
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

// The room walls that go see-through, by side: N (y 0), S (y 300), W (x 0), E (x 400).
function fadedSides(objs, eye, target = { x: 200, y: 150 }) {
  const near = (a, b) => Math.abs(a - b) < 11;
  const side = (b) => (near(b.cy, 0) ? "N" : near(b.cy, 300) ? "S" : near(b.cx, 0) ? "W" : near(b.cx, 400) ? "E" : "?");
  return [...new Set(E.sceneBoxes(objs).filter((b) => E.wallHidesView(b, eye, target)).map(side))].sort();
}

test("orbit: the walls between the camera and the room go see-through", () => {
  assert.deepEqual(fadedSides(room(), { x: 200, y: 1500 }), ["S"]);
  assert.deepEqual(fadedSides(room(), { x: 1500, y: 1500 }), ["E", "S"]);
  assert.deepEqual(fadedSides(room(), { x: -900, y: -900 }), ["N", "W"]);
  assert.deepEqual(fadedSides(room(), { x: 100, y: 100 }), [], "camera inside the room");
});

test("orbit: a turned room and a plain wall fade the same way", () => {
  // Turned 90°, the room's south wall runs along x = 50 (see the door test above).
  const faded = E.sceneBoxes(room(90)).filter((b) => E.wallHidesView(b, { x: -1500, y: 150 }, { x: 200, y: 150 }));
  assert.ok(faded.length > 0 && faded.every((b) => Math.abs(b.cx - 50) < 11));
  const wall = E.sceneBoxes([obj(5, "wall", 0, 500, 300, 12, { height: 250 })]);
  assert.equal(E.wallHidesView(wall[0], { x: 150, y: 1500 }, { x: 150, y: 150 }), true);
  assert.equal(E.wallHidesView(wall[0], { x: 150, y: 1500 }, { x: 150, y: 1000 }), false, "the target is in front of it");
  const others = E.sceneBoxes(room()).filter((b) => b.kind !== "wall");
  assert.equal(others.some((b) => E.wallHidesView(b, { x: 200, y: 1500 }, { x: 200, y: 150 })), false, "only walls fade");
});
