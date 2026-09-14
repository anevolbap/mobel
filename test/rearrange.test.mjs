// Run: node --test test/
// Loads the rearrange engine out of index.html (no DOM needed) and checks its results
// with plain box math, not with the engine's own score.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
function section(start, end) {
  const a = script.indexOf(start);
  assert.ok(a >= 0, `missing section ${start}`);
  return script.slice(a, script.indexOf(end, a + start.length));
}
function fn(name) {
  const a = script.indexOf(`\nfunction ${name}(`);
  assert.ok(a >= 0, `missing function ${name}`);
  const eol = script.indexOf("\n", a + 1);
  if (script.slice(a, eol).trimEnd().endsWith("}")) return script.slice(a, eol + 1);   // one-liner
  return script.slice(a, script.indexOf("\n}\n", a) + 3);
}
const src = [
  section("/* ---------- type registry", "/* ---------- inline-SVG icons"),
  ...["aabb", "rectsOverlap", "rotatePoint", "rotRectAabb", "clearDepth", "clearanceRects", "clearanceWorld",
    "isType", "num", "sanitizeClear", "sanitize"].map(fn),
  section("/* ---------- rearrange: search", "/* ---------- properties sidebar"),
  ";({ RA, rearrangeProblem, scoreLayout, searchLayouts, currentPlacement, placedObject, aabb, clearanceWorld, sanitize })",
].join("\n");
// This context, not a new one: a separate realm makes every global lookup slow.
const E = vm.runInThisContext(`(() => {\n${src}\n})()`.replace(";({", "return ({"));

const NO = { N: 0, E: 0, S: 0, W: 0 };
function obj(id, type, x, y, w, h, extra = {}) {
  return { id, type, label: type, x, y, w, h, rot: 0, flip: 0, color: "#000", clear: { ...NO }, wall: 0, ...extra };
}
// A 300 x 300 kid's room, door on the east wall, built-in wardrobe locked on the south wall.
// The start is poor on purpose: desk in the middle, bed across the door.
function room() {
  return [
    obj(1, "room", 0, 0, 300, 300, { wall: 10 }),
    obj(2, "door", 285, 180, 80, 10, { rot: 90 }),
    obj(3, "desk", 110, 110, 120, 60, { clear: { ...NO, S: 50 } }),
    obj(4, "bed", 180, 150, 90, 190, { clear: { ...NO, E: 60 } }),
    obj(5, "bookshelf", 20, 10, 150, 30),
    obj(6, "furniture", 10, 200, 60, 45),
    obj(7, "wardrobe", 100, 289, 160, 1, { lock: true, clear: { ...NO, N: 10 } }),
  ];
}
const inner = { x: 5, y: 5, w: 290, h: 290 };
const overlap = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

test("problem splits the room into movers, fixed pieces and a door", () => {
  const objs = room();
  const P = E.rearrangeProblem(objs[0], objs);
  assert.deepEqual(P.movers.map((o) => o.id), [3, 4, 5, 6]);
  assert.deepEqual(P.fixed.map((o) => o.id), [7]);
  assert.equal(P.hasDoor, true);
});

test("search returns valid layouts that beat the start", () => {
  const objs = room();
  const P = E.rearrangeProblem(objs[0], objs);
  const start = E.scoreLayout(P, E.currentPlacement(P));
  const t0 = performance.now();
  const results = E.searchLayouts(P, { restarts: 8, iters: 2000, seed: 7 });
  const ms = performance.now() - t0;
  assert.ok(results.length >= 1, "no valid layout found");
  assert.ok(results[0].score > start.score, `best ${results[0].score} <= start ${start.score}`);
  for (let r = 1; r < results.length; r++) assert.ok(results[r - 1].score >= results[r].score);
  const wardrobe = aabbOf(objs[6]);
  const door = E.aabb(objs[1]);
  const doorZone = { x: door.x + door.w / 2 - 80, y: door.y, w: 160, h: door.h };
  for (const res of results) {
    assert.equal(res.bad, 0);
    const boxes = P.movers.map((o, m) => E.aabb(E.placedObject(o, res.placement[m])));
    boxes.forEach((b, m) => {
      const label = `${P.movers[m].type} ${JSON.stringify(b)}`;
      assert.ok(b.x >= inner.x - 1e-6 && b.y >= inner.y - 1e-6 && b.x + b.w <= inner.x + inner.w + 1e-6 && b.y + b.h <= inner.y + inner.h + 1e-6, `outside: ${label}`);
      assert.ok(!overlap(b, wardrobe), `on the locked wardrobe: ${label}`);
      assert.ok(!overlap(b, doorZone), `in the door zone: ${label}`);
      for (let q = m + 1; q < boxes.length; q++) assert.ok(!overlap(b, boxes[q]), `overlap: ${label} / ${JSON.stringify(boxes[q])}`);
      assert.equal(res.placement[m].rot % 90, 0);
    });
  }
  console.log(`  start ${fmt(start)}\n  best  ${fmt(results[0])}\n  ${results.length} layouts in ${Math.round(ms)} ms`);
});

test("a desk facing the wall scores lower reach than facing the room", () => {
  const objs = [obj(1, "room", 0, 0, 300, 300, { wall: 10 }), obj(2, "door", 285, 180, 80, 10, { rot: 90 }),
    obj(3, "desk", 5, 5, 120, 60, { clear: { ...NO, S: 50 } })];
  const P = E.rearrangeProblem(objs[0], objs);
  const facingRoom = E.scoreLayout(P, [{ ax: 5, ay: 5, rot: 0 }]);     // back on the north wall
  const facingWall = E.scoreLayout(P, [{ ax: 5, ay: 5, rot: 180 }]);   // clearance runs into the wall
  assert.ok(facingRoom.reach > facingWall.reach, `${facingRoom.reach} <= ${facingWall.reach}`);
  assert.ok(facingRoom.gap < 0.01, `gap ${facingRoom.gap}`);
});

test("the locked piece never moves", () => {
  const objs = room();
  const P = E.rearrangeProblem(objs[0], objs);
  assert.ok(!P.movers.some((o) => o.lock));
});

test("lock survives a save and load, and old files load unlocked", () => {
  const [locked, plain] = [room()[6], room()[2]];
  assert.equal(E.sanitize(JSON.parse(JSON.stringify(locked)), 1).lock, true);
  const old = { ...plain };
  delete old.lock;
  assert.equal(E.sanitize(old, 1).lock, false);
});

function aabbOf(o) { return E.aabb(o); }
function fmt(r) { return `score ${r.score.toFixed(3)} reach ${r.reach.toFixed(2)} open ${r.open.toFixed(2)} gap ${r.gap.toFixed(2)} bad ${r.bad}`; }
