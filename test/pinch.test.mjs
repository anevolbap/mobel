// Run: node --test test/*.test.mjs
// Loads core.js the way the page does and checks the two-finger view math.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coreUrl = new URL("../core.js", import.meta.url);
vm.runInThisContext(readFileSync(coreUrl, "utf8"), { filename: coreUrl.pathname });
const { pinchView } = vm.runInThisContext("({ pinchView })");

const noClamp = (z) => z;
// screenPx = world * zoom + pan, as in index.html
const toWorld = (v, p) => ({ x: (p.x - v.panX) / v.zoom, y: (p.y - v.panY) / v.zoom });
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function near(actual, expected, msg) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual} != ${expected}`);
}

test("spreading the fingers zooms around their midpoint", () => {
  const view = { panX: 40, panY: -20, zoom: 1.5 };
  const a0 = { x: 300, y: 200 }, b0 = { x: 400, y: 200 };
  const a1 = { x: 250, y: 200 }, b1 = { x: 450, y: 200 };   // twice as far apart, same midpoint
  const v = pinchView(view, a0, b0, a1, b1, noClamp);
  near(v.zoom, 3, "zoom");
  const w0 = toWorld(view, mid(a0, b0)), w1 = toWorld(v, mid(a1, b1));
  near(w1.x, w0.x, "world x"); near(w1.y, w0.y, "world y");
});

test("pinching in zooms out", () => {
  const view = { panX: 0, panY: 0, zoom: 2 };
  const v = pinchView(view, { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 150, y: 100 }, { x: 250, y: 100 }, noClamp);
  near(v.zoom, 1, "zoom");
  near(toWorld(v, { x: 200, y: 100 }).x, toWorld(view, { x: 200, y: 100 }).x, "world x");
});

test("moving both fingers the same way pans without zooming", () => {
  const view = { panX: 10, panY: 20, zoom: 0.8 };
  const v = pinchView(view, { x: 100, y: 100 }, { x: 200, y: 150 }, { x: 130, y: 60 }, { x: 230, y: 110 }, noClamp);
  near(v.zoom, 0.8, "zoom");
  near(v.panX, 40, "panX"); near(v.panY, -20, "panY");
});

test("the world point under the first midpoint follows the midpoint", () => {
  const view = { panX: -120, panY: 75, zoom: 0.6 };
  const a0 = { x: 120, y: 340 }, b0 = { x: 260, y: 410 };
  const a1 = { x: 60, y: 300 }, b1 = { x: 380, y: 520 };
  const v = pinchView(view, a0, b0, a1, b1, noClamp);
  const w0 = toWorld(view, mid(a0, b0)), w1 = toWorld(v, mid(a1, b1));
  near(w1.x, w0.x, "world x"); near(w1.y, w0.y, "world y");
});

test("a clamped zoom still keeps the midpoint's world point", () => {
  const view = { panX: 0, panY: 0, zoom: 30 };
  const clamp = (z) => Math.min(40, z);
  const a0 = { x: 100, y: 100 }, b0 = { x: 110, y: 100 };
  const a1 = { x: 0, y: 100 }, b1 = { x: 210, y: 100 };
  const v = pinchView(view, a0, b0, a1, b1, clamp);
  near(v.zoom, 40, "zoom");
  const w0 = toWorld(view, mid(a0, b0)), w1 = toWorld(v, mid(a1, b1));
  near(w1.x, w0.x, "world x"); near(w1.y, w0.y, "world y");
});

test("fingers that land on the same spot do not break the view", () => {
  const view = { panX: 5, panY: 5, zoom: 1 };
  const p = { x: 200, y: 200 };
  const v = pinchView(view, p, p, { x: 180, y: 200 }, { x: 220, y: 200 }, noClamp);
  assert.deepEqual(v, { panX: 5, panY: 5, zoom: 1 });
});
