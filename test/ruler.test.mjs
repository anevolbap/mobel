// Run: node --test test/*.test.mjs
// Loads core.js the way the page does and checks where the ruler labels go.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coreUrl = new URL("../core.js", import.meta.url);
vm.runInThisContext(readFileSync(coreUrl, "utf8"), { filename: coreUrl.pathname });
const { rulerLabels } = vm.runInThisContext("({ rulerLabels })");

test("labels sit on the major lines and name them, even when the view starts on a 50 cm line", () => {
  const labels = rulerLabels(-50, 400, 100, 0, 0);
  assert.deepEqual(labels.map((l) => l.at), [0, 100, 200, 300, 400]);
  assert.deepEqual(labels.map((l) => l.text), ["0 m", "1 m", "2 m", "3 m", "4 m"]);
});

test("no label starts before the edge", () => {
  assert.deepEqual(rulerLabels(-32.4, 250, 100, 0, 0).map((l) => l.at), [0, 100, 200]);
  assert.deepEqual(rulerLabels(-132, 50, 100, 0, 0).map((l) => l.text), ["-1 m", "0 m"]);
});

test("a label that would run past the far edge is left out", () => {
  // "3 m" is 3 characters of 10 cm plus a 4 cm gap: it needs 34 cm after its line
  assert.deepEqual(rulerLabels(0, 333, 100, 4, 10).map((l) => l.at), [0, 100, 200]);
  assert.deepEqual(rulerLabels(0, 334, 100, 4, 10).map((l) => l.at), [0, 100, 200, 300]);
  assert.deepEqual(rulerLabels(0, 20, 100, 4, 10), []);
});
