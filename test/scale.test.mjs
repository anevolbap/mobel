// Run: node --test test/*.test.mjs
// Loads core.js the way the page does and checks the length the scale bar picks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coreUrl = new URL("../core.js", import.meta.url);
vm.runInThisContext(readFileSync(coreUrl, "utf8"), { filename: coreUrl.pathname });
const { scaleBar, SCALE_LENGTHS } = vm.runInThisContext("({ scaleBar, SCALE_LENGTHS })");

test("the bar is the longest round length that fits in 160 px", () => {
  assert.deepEqual(scaleBar(1), { cm: 100, label: "1 m" });
  assert.deepEqual(scaleBar(1.6), { cm: 100, label: "1 m" });       // exactly 160 px
  assert.deepEqual(scaleBar(1.61), { cm: 50, label: "50 cm" });
  assert.deepEqual(scaleBar(2.25), { cm: 50, label: "50 cm" });
  assert.deepEqual(scaleBar(0.3), { cm: 500, label: "5 m" });
  assert.deepEqual(scaleBar(8), { cm: 20, label: "20 cm" });
});

test("between the ends of the list the bar is 64 to 160 px long", () => {
  for (let zoom = 0.16; zoom <= 16; zoom *= 1.01) {   // 10 m and 10 cm are 160 px at the ends
    const { cm } = scaleBar(zoom);
    assert.ok(SCALE_LENGTHS.includes(cm));
    assert.ok(cm * zoom <= 160 + 1e-9 && cm * zoom >= 64 - 1e-9, `zoom ${zoom}: ${cm * zoom} px`);
  }
});

test("past the ends of the list the bar stays 10 m or 10 cm", () => {
  assert.deepEqual(scaleBar(0.05), { cm: 1000, label: "10 m" });
  assert.deepEqual(scaleBar(40), { cm: 10, label: "10 cm" });
});
