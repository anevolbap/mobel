// Run: node --test test/*.test.mjs
// Loads core.js the way the page does and checks how layout files are read:
// ids, limits, the version check and the migration of old files in test/fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coreUrl = new URL("../core.js", import.meta.url);
vm.runInThisContext(readFileSync(coreUrl, "utf8"), { filename: coreUrl.pathname });
const E = vm.runInThisContext("({ readLayout, layoutJson, sanitizeObjects, LAYOUT_VERSION, MAX_SIZE, MAX_POS })");
const fixture = (v) => JSON.parse(readFileSync(new URL(`fixtures/layout-v${v}.json`, import.meta.url), "utf8"));
const layout = (objects, extra = {}) => ({ app: "moebel", version: E.LAYOUT_VERSION, units: "cm", objects, ...extra });
const NO = { N: 0, E: 0, S: 0, W: 0 };

test("repeated and missing ids get new ids above the highest one", () => {
  const { objects } = E.readLayout(layout([
    { id: 1, type: "desk" }, { id: 1, type: "bed" }, { id: "7", type: "sofa" }, { type: "table" }, { id: 0 }, { id: 5, type: "fridge" },
  ]));
  const ids = objects.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.slice(0, 1).concat(ids.slice(-1)), [1, 5]);     // the first owner of an id keeps it
  for (const id of ids.slice(1, -1)) assert.ok(id > 5, `id ${id} is above the highest id in the file`);
});

test("sizes and positions are clamped and non-finite numbers fall back", () => {
  const [room, desk, shelf] = E.readLayout(JSON.parse(`{"app": "moebel", "version": 6, "objects": [
    {"id": 1, "type": "room", "x": -1e9, "y": 1e9, "w": 1e9, "h": 200000, "height": 1e9, "wall": 1e9},
    {"id": 2, "type": "desk", "x": 1e999, "y": "Infinity", "w": 1e999, "h": -1e999, "z": 1e999, "height": "-Infinity"},
    {"id": 3, "type": "bookshelf", "w": 0.2, "z": 1e9, "clear": {"N": 1e9, "E": 1e999, "S": -5, "W": 30}}
  ]}`)).objects;
  assert.equal(E.MAX_SIZE, 10000);
  assert.equal(E.MAX_POS, 100000);
  assert.deepEqual([room.x, room.y, room.w, room.h, room.height, room.wall], [-E.MAX_POS, E.MAX_POS, E.MAX_SIZE, E.MAX_SIZE, E.MAX_SIZE, E.MAX_SIZE]);
  assert.deepEqual([desk.x, desk.y, desk.w, desk.h, desk.z, desk.height], [0, 0, 140, 70, 0, 75]);
  assert.deepEqual([shelf.w, shelf.z, shelf.clear], [1, E.MAX_SIZE, { N: E.MAX_SIZE, E: 0, S: 0, W: 30 }]);
});

test("a file from a newer version still loads and says so", () => {
  const objects = [{ id: 1, type: "desk", x: 10, y: 20, w: 140, h: 70, future: "field" }];
  const newer = E.readLayout(layout(objects, { version: E.LAYOUT_VERSION + 1 }));
  assert.equal(newer.newer, true);
  assert.equal(newer.objects.length, 1);
  assert.deepEqual([newer.objects[0].x, newer.objects[0].y], [10, 20]);
  assert.equal(E.readLayout(layout(objects)).newer, false);
  assert.equal(E.readLayout(fixture(2)).newer, false);
});

test("a file that is not a Möbel layout is refused", () => {
  for (const doc of [null, [], "text", 3, { objects: [] }, { app: "other", version: 6, objects: [] }]) {
    assert.throws(() => E.readLayout(doc), /not a Möbel layout/, JSON.stringify(doc));
  }
  for (const doc of [{ app: "moebel", version: 6 }, { app: "moebel", version: 6, objects: {} }]) {
    assert.throws(() => E.readLayout(doc), /objects/, JSON.stringify(doc));
  }
});

test("version 2 walls, doors and windows pick up heights, no clearance and no room walls", () => {
  const [wall, window, door, shelf] = E.readLayout(fixture(2)).objects;
  assert.deepEqual([wall.z, wall.height, wall.wall, wall.clear, wall.lock], [0, 250, 0, NO, false]);
  assert.deepEqual([window.x, window.z, window.height], [100, 90, 120]);
  assert.deepEqual([door.x, door.flip, door.rot, door.height], [-34, 2, 90, 210]);
  assert.deepEqual([shelf.label, shelf.clear, shelf.height], ["Shelf", NO, 180]);
});

test("version 3 rooms get 15 cm walls and one-sided clearance turns into sides", () => {
  const [room, desk, fridge] = E.readLayout(fixture(3)).objects;
  assert.deepEqual([room.wall, room.height, room.clear], [15, 250, NO]);
  assert.deepEqual(desk.clear, { ...NO, E: 50 });
  assert.deepEqual(fridge.clear, NO, "a recorded 0 is kept, not replaced by the fridge default");
});

test("version 4 keeps the room wall and moves clearance to its face", () => {
  const [room, bed, sofa] = E.readLayout(fixture(4)).objects;
  assert.deepEqual([room.wall, room.label], [20, "Bedroom"]);
  assert.deepEqual(bed.clear, { ...NO, W: 60 });
  assert.deepEqual([sofa.clear, sofa.rot, sofa.height], [{ ...NO, N: 60 }, 180, 85]);
});

test("version 5 objects pick up their type's z and height", () => {
  const [room, window, table] = E.readLayout(fixture(5)).objects;
  assert.deepEqual([room.wall, room.z, room.height], [0, 0, 250], "a bare room stays bare");
  assert.deepEqual([window.z, window.height], [90, 120]);
  assert.deepEqual([table.clear, table.lock, table.height], [{ N: 75, E: 75, S: 0, W: 75 }, true, 75]);
});

test("a current file loads unchanged, and save, load and save gives the same JSON", () => {
  const doc = fixture(6);
  const { objects } = E.readLayout(doc);
  assert.deepEqual(objects, doc.objects);
  const saved = E.layoutJson(objects);
  assert.deepEqual(JSON.parse(saved), doc);
  assert.equal(E.layoutJson(E.readLayout(JSON.parse(saved)).objects), saved);
});

test("the autosave list is cleaned the same way", () => {
  const objs = E.sanitizeObjects([{ id: 2, type: "desk", w: 1e9 }, { id: 2, type: "bed" }, "junk"]);
  assert.deepEqual(objs.map((o) => o.id), [2, 3]);
  assert.equal(objs[0].w, E.MAX_SIZE);
});
