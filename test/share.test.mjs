// Run: node --test test/*.test.mjs
// Loads core.js the way the page does and checks that a layout survives a share link.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coreUrl = new URL("../core.js", import.meta.url);
vm.runInThisContext(readFileSync(coreUrl, "utf8"), { filename: coreUrl.pathname });
const E = vm.runInThisContext("({ encodeShare, decodeShare, readLayout, layoutJson, sanitizeObjects })");
const fixture = JSON.parse(readFileSync(new URL("fixtures/layout-v6.json", import.meta.url), "utf8"));
// many objects with varied numbers, so the compressed bytes hit every base64 character
const many = E.sanitizeObjects(Array.from({ length: 300 }, (_, i) => ({
  id: i + 1, type: ["desk", "bed", "sofa", "door"][i % 4], label: `Piece ${i} ${"xyz".repeat(i % 7)}`,
  x: (i * 7919) % 3000, y: (i * 104729) % 2000, w: 40 + ((i * 31) % 160), h: 30 + ((i * 17) % 90), rot: (i * 45) % 360,
})));

test("a layout comes back from its share link unchanged", async () => {
  for (const objects of [fixture.objects, many, []]) {
    const doc = await E.decodeShare(await E.encodeShare(objects));
    assert.equal(E.layoutJson(E.readLayout(doc).objects), E.layoutJson(objects));
  }
});

test("the link data is base64url, with no + / or =", async () => {
  const data = await E.encodeShare(many);
  assert.match(data, /^[A-Za-z0-9_-]+$/);
  assert.match(Buffer.from(data, "base64url").toString("base64"), /[+/]/, "plain base64 of the same bytes has + or /");
  assert.ok(data.length < E.layoutJson(many).length / 3, "the data is compressed");
});

test("a broken link throws a clear error", async () => {
  const data = await E.encodeShare(fixture.objects);
  const flipped = data.slice(0, 40) + (data[40] === "A" ? "B" : "A") + data.slice(41);
  const notJson = Buffer.from("not a layout").toString("base64url");
  for (const bad of [data.slice(0, data.length / 2), flipped, "!!!", "", "A", notJson]) {
    await assert.rejects(E.decodeShare(bad), /The link is broken or cut off/, JSON.stringify(bad.slice(0, 20)));
  }
});
