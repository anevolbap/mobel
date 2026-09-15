// Run: node --test test/*.test.mjs
// Loads core.js and rearrange.js the way the page does, cuts the sample layout
// and the red band check out of index.html, and checks that the sample shows
// one blocked band that Rearrange can clear.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const file of ["core.js", "rearrange.js"]) {
  const url = new URL(`../${file}`, import.meta.url);
  vm.runInThisContext(readFileSync(url, "utf8"), { filename: url.pathname });
}
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
function section(script, start, end) {
  const a = script.indexOf(start);
  assert.ok(a >= 0, `missing section ${start}`);
  return script.slice(a, script.indexOf(end, a + start.length));
}
const src = [
  "const state = { objects: [], nextId: 1 };",
  section(page, "function addObject(", "function deleteObject("),
  section(page, "function bandBlocked(", "// type-specific symbols"),
  section(page, "function seed() {", "\nseed();"),
  "seed();",
  "return { state, bandBlocked };",
].join("\n");
const E = vm.runInThisContext(`(() => {\n${src}\n})()`);
const R = vm.runInThisContext("({ rearrangeProblem, searchLayouts, scoreLayout, currentPlacement, placedObject, clearanceWorld })");

// The red bands on the plan, as "label side".
function blockedBands(objects) {
  E.state.objects = objects;
  return objects.flatMap((o) => R.clearanceWorld(o).filter((b) => E.bandBlocked(o, b)).map((b) => `${o.label} ${b.side}`));
}
const sample = () => JSON.parse(JSON.stringify(E.state.objects));

test("the sample shows exactly one blocked band: the wardrobe front", () => {
  assert.deepEqual(blockedBands(sample()), ["Wardrobe S"]);
});

test("Rearrange on the sample room finds a layout with no blocked band", () => {
  const objs = sample();
  const P = R.rearrangeProblem(objs[0], objs);
  assert.deepEqual(P.movers.map((o) => o.label).sort(), ["Bed", "Desk", "Shelf", "Wardrobe"]);
  assert.equal(R.scoreLayout(P, R.currentPlacement(P)).bad, 0, "the sample itself has an overlap or blocks the door or window");
  const results = R.searchLayouts(P, { seed: 1 });
  assert.ok(results.length >= 1, "no valid layout found");
  const clear = results.filter((res) => {
    const placed = objs.map((o) => {
      const m = P.movers.indexOf(o);
      return m < 0 ? o : R.placedObject(o, res.placement[m]);
    });
    return blockedBands(placed).length === 0;
  });
  console.log(`  ${clear.length} of ${results.length} layouts have no blocked band`);
  assert.ok(clear.length >= 1, "every layout still has a blocked band");
});
