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

test("heights survive a save and load, and old files get the type's heights", () => {
  const shelf = E.sanitize({ id: 1, type: "bookshelf", x: 0, y: 0, w: 80, h: 28, z: 120, height: 40 }, 1);
  assert.equal(shelf.z, 120);
  assert.equal(shelf.height, 40);
  const old = (type) => E.sanitize({ id: 1, type, x: 0, y: 0, w: 100, h: 12 }, 1);
  assert.deepEqual([old("window").z, old("window").height], [90, 120]);
  assert.deepEqual([old("door").z, old("door").height], [0, 210]);
  assert.deepEqual([old("room").z, old("room").height], [0, 250]);
  const broken = E.sanitize({ id: 1, type: "desk", z: -5, height: "abc" }, 1);
  assert.deepEqual([broken.z, broken.height], [0, 75]);
});

// A 300 x 300 room, door on the east wall, window on the north wall from x 100 to 220, sill at 90 cm.
function windowRoom(...pieces) {
  return [obj(1, "room", 0, 0, 300, 300, { wall: 10, height: 250 }),
    obj(2, "door", 285, 180, 80, 10, { rot: 90, height: 210 }),
    obj(3, "window", 100, -5, 120, 10, { z: 90, height: 120 }), ...pieces];
}

test("a tall piece cannot stand in front of a window, a low one can", () => {
  const objs = windowRoom(obj(4, "wardrobe", 0, 0, 120, 60, { height: 200 }), obj(5, "desk", 0, 0, 120, 60, { height: 75 }));
  const P = E.rearrangeProblem(objs[0], objs);
  const away = { ax: 5, ay: 235, rot: 0 };
  assert.ok(E.scoreLayout(P, [{ ax: 100, ay: 5, rot: 0 }, away]).bad > 0, "wardrobe under the window");
  assert.equal(E.scoreLayout(P, [away, { ax: 100, ay: 5, rot: 0 }]).bad, 0, "desk under the window");
});

test("search keeps a wardrobe away from the window", () => {
  const objs = windowRoom(obj(4, "wardrobe", 100, 5, 120, 60, { height: 200, clear: { ...NO, S: 60 } }),
    obj(5, "desk", 5, 235, 120, 60, { height: 75, clear: { ...NO, N: 50 } }));
  const P = E.rearrangeProblem(objs[0], objs);
  const results = E.searchLayouts(P, { restarts: 4, iters: 800, seed: 3 });
  assert.ok(results.length >= 1, "no valid layout found");
  const zone = { x: 100, y: -30, w: 120, h: 60 };
  for (const res of results) {
    const b = E.aabb(E.placedObject(P.movers[0], res.placement[0]));
    assert.ok(!overlap(b, zone), `wardrobe at the window: ${JSON.stringify(b)}`);
  }
});

test("a shelf can hang above a desk but not above a wardrobe", () => {
  const shelf = obj(5, "bookshelf", 0, 0, 120, 30, { z: 120, height: 40 });
  const onDesk = windowRoom(obj(4, "desk", 5, 235, 120, 60, { height: 75, lock: true }), shelf);
  const P1 = E.rearrangeProblem(onDesk[0], onDesk);
  assert.equal(E.scoreLayout(P1, [{ ax: 5, ay: 265, rot: 0 }]).bad, 0);
  const onWardrobe = windowRoom(obj(4, "wardrobe", 5, 235, 120, 60, { height: 200, lock: true }), { ...shelf });
  const P2 = E.rearrangeProblem(onWardrobe[0], onWardrobe);
  assert.ok(E.scoreLayout(P2, [{ ax: 5, ay: 265, rot: 0 }]).bad > 0);
  // the same works when both pieces move
  const both = windowRoom(obj(4, "desk", 0, 0, 120, 60, { height: 75 }), { ...shelf });
  const P3 = E.rearrangeProblem(both[0], both);
  assert.equal(E.scoreLayout(P3, [{ ax: 5, ay: 235, rot: 0 }, { ax: 5, ay: 265, rot: 0 }]).bad, 0);
});

test("a hung shelf leaves the floor open", () => {
  const at = { ax: 150, ay: 265, rot: 0 };
  const hung = windowRoom(obj(4, "bookshelf", 0, 0, 120, 30, { z: 120, height: 40 }));
  const standing = windowRoom(obj(4, "bookshelf", 0, 0, 120, 30, { height: 160 }));
  const open = (objs) => E.scoreLayout(E.rearrangeProblem(objs[0], objs), [at]).open;
  assert.ok(open(hung) > open(standing), `${open(hung)} <= ${open(standing)}`);
});

function aabbOf(o) { return E.aabb(o); }
function fmt(r) { return `score ${r.score.toFixed(3)} reach ${r.reach.toFixed(2)} open ${r.open.toFixed(2)} gap ${r.gap.toFixed(2)} bad ${r.bad}`; }
