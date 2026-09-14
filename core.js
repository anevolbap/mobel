"use strict";
/* Möbel core: object types, geometry and file loading. No DOM and no app
   state, so node can load it for tests. index.html loads it first. */

/* ---------- type registry ---------- */
const DEFAULT_WALL_COLOR = "#3a3a42";
const DEFAULT_FURNITURE_COLOR = "#1b6cf0";
const MIN_SIZE = 1, SNAP_STEP = 5;
const MAX_SIZE = 10000, MAX_POS = 100000;   // cm: a loaded size is at most 100 m, a position within 1 km

// `z` is how far the bottom of an object is above the floor and `height` its
// size upwards, both in cm: a window starts at its sill, a shelf can hang on a
// wall. A room's height is the height of its walls.
// `clear` is the free space a piece needs beyond its own footprint, in cm per
// side: a fridge door swings at the front, a double bed needs both flanks. The
// sides are in the object's own frame, so they turn with the object.
const SIDES = { N: "Top", E: "Right", S: "Bottom", W: "Left" };
const SIDE_KEYS = Object.keys(SIDES);
const NO_CLEAR = { N: 0, E: 0, S: 0, W: 0 };
const TYPES = {
  room:       { name: "Room",        w: 400, h: 300, height: 250, color: "#6f8794", wall: 15 },
  wall:       { name: "Wall",        w: 300, h: 12,  height: 250, color: DEFAULT_WALL_COLOR },
  door:       { name: "Door",        w: 80,  h: 12,  height: 210, color: "#b07a3c" },
  window:     { name: "Window",      w: 100, h: 12,  height: 120, z: 90, color: "#3d8bd4" },
  tallwindow: { name: "Tall window", w: 160, h: 12,  height: 220, color: "#1f9aad" },
  bookshelf:  { name: "Bookshelf",   w: 80,  h: 28,  height: 180, color: "#8a6d3b",              piece: true },
  furniture:  { name: "Furniture",   w: 120, h: 60,  height: 75,  color: DEFAULT_FURNITURE_COLOR, piece: true },
  fridge:     { name: "Fridge",      w: 60,  h: 65,  height: 180, color: "#0891b2", piece: true, clear: { S: 100 } },
  desk:       { name: "Desk",        w: 140, h: 70,  height: 75,  color: "#1b6cf0", piece: true, clear: { S: 80 } },
  table:      { name: "Table",       w: 120, h: 80,  height: 75,  color: "#ca8a04", piece: true, clear: { N: 75, E: 75, S: 75, W: 75 } },
  bed:        { name: "Bed",         w: 140, h: 200, height: 50,  color: "#7c3aed", piece: true, clear: { E: 60, W: 60 } },
  sofa:       { name: "Sofa",        w: 200, h: 90,  height: 85,  color: "#16a34a", piece: true, clear: { S: 60 } },
  wardrobe:   { name: "Wardrobe",    w: 120, h: 60,  height: 200, color: "#8a6d3b", piece: true, clear: { S: 90 } },
};
const TYPE_KEYS = Object.keys(TYPES);
function isType(t) { return Object.prototype.hasOwnProperty.call(TYPES, t); }
function spawnDefaults(type) {
  const t = TYPES[isType(type) ? type : "furniture"];
  return {
    type: isType(type) ? type : "furniture",
    w: t.w, h: t.h, z: t.z || 0, height: t.height,
    label: type === "furniture" ? "Furniture" : t.name,
    color: t.color, flip: 0, rot: 0,
    clear: { ...NO_CLEAR, ...(t.clear || null) },   // copied, never shared
    wall: t.wall || 0,
  };
}

/* ---------- geometry ---------- */
// Axis-aligned bounding box. Exact for 0/90/180/270; footprint otherwise.
function aabb(o) {
  const rot = (((o.rot || 0) % 360) + 360) % 360;
  if (rot === 90 || rot === 270) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    return { x: cx - o.h / 2, y: cy - o.w / 2, w: o.h, h: o.w };
  }
  return { x: o.x, y: o.y, w: o.w, h: o.h };
}
// What a target offers to snap to: its edges and centre, plus, for a room, the
// inner and outer face of each wall, so furniture lands against the wall and
// not on its centreline.
function snapEdges(t) {
  const b = aabb(t);
  const X = [b.x, b.x + b.w / 2, b.x + b.w], Y = [b.y, b.y + b.h / 2, b.y + b.h];
  const wt = t.type === "room" ? t.wall || 0 : 0;
  if (wt > 0) {
    const h2 = wt / 2;
    X.push(b.x - h2, b.x + h2, b.x + b.w - h2, b.x + b.w + h2);
    Y.push(b.y - h2, b.y + h2, b.y + b.h - h2, b.y + b.h + h2);
  }
  return { X, Y };
}
function rotatePoint(px, py, cx, cy, deg) {
  const r = (deg * Math.PI) / 180, dx = px - cx, dy = py - cy;
  return { x: cx + dx * Math.cos(r) - dy * Math.sin(r), y: cy + dx * Math.sin(r) + dy * Math.cos(r) };
}
function angleDeg(px, py, cx, cy) { return (Math.atan2(py - cy, px - cx) * 180) / Math.PI; }
// Frames everything that is drawn: rotated footprints and clearance bands too.
function contentBounds(objs) {
  if (!objs.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of objs) {
    for (const b of [aabb(o), ...clearanceWorld(o)]) {
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    }
  }
  return { minX, minY, maxX, maxY };
}
// Clearance bands, in the object's own frame (the group's rotate carries them).
// One per side with a depth; corners are left open.
function clearDepth(o, side) { return (o.clear && o.clear[side]) || 0; }
function clearanceRects(o) {
  const out = [];
  for (const side of SIDE_KEYS) {
    const c = clearDepth(o, side);
    if (c <= 0) continue;
    if (side === "N") out.push({ side, x: o.x, y: o.y - c, w: o.w, h: c });
    else if (side === "S") out.push({ side, x: o.x, y: o.y + o.h, w: o.w, h: c });
    else if (side === "W") out.push({ side, x: o.x - c, y: o.y, w: c, h: o.h });
    else out.push({ side, x: o.x + o.w, y: o.y, w: c, h: o.h });
  }
  return out;
}
// Turn a rect from an object's own frame into a world-space box. Exact at
// 0/90/180/270; footprint at other angles.
function rotRectAabb(r, cx, cy, deg) {
  if (!deg) return r;
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]
    .map(([px, py]) => rotatePoint(px, py, cx, cy, deg));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}
function clearanceWorld(o) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, rot = o.rot || 0;
  return clearanceRects(o).map((r) => ({ side: r.side, ...rotRectAabb(r, cx, cy, rot) }));
}

/* ---------- room walls ---------- */
// A room carries its own walls, centred on the rectangle, so two rooms placed
// edge to edge share one wall. Bands are in the room's own frame; the corners
// belong to the horizontal ones.
const OPENINGS = new Set(["door", "window", "tallwindow"]);
function roomBands(o) {
  const t = o.type === "room" ? o.wall || 0 : 0;
  if (t <= 0) return [];
  const h2 = t / 2;
  return [
    { x: o.x - h2, y: o.y - h2, w: o.w + t, h: t, axis: "x" },
    { x: o.x - h2, y: o.y + o.h - h2, w: o.w + t, h: t, axis: "x" },
    { x: o.x - h2, y: o.y + h2, w: t, h: o.h - t, axis: "y" },
    { x: o.x + o.w - h2, y: o.y + h2, w: t, h: o.h - t, axis: "y" },
  ].filter((b) => b.w > 0 && b.h > 0);
}
function roomBandsWorld(o) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, rot = o.rot || 0;
  return roomBands(o).map((b) => rotRectAabb(b, cx, cy, rot));
}
// [a0,a1] minus the cut intervals, left to right.
function subtractIntervals(a0, a1, cuts) {
  let segs = [[a0, a1]];
  for (const [c0, c1] of cuts) {
    const next = [];
    for (const [s0, s1] of segs) {
      if (c1 <= s0 || c0 >= s1) { next.push([s0, s1]); continue; }
      if (c0 > s0) next.push([s0, c0]);
      if (c1 < s1) next.push([c1, s1]);
    }
    segs = next;
  }
  return segs;
}
function rectsOverlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
// A room is a backdrop, a door/window sits inside a wall: neither blocks.
function blocksClearance(o) { return o.type === "wall" || !!TYPES[o.type].piece; }

/* ---------- file loading ---------- */
const LAYOUT_VERSION = 6;
function num(v, fallback) { const n = typeof v === "string" ? parseFloat(v) : v; return Number.isFinite(n) ? n : fallback; }
function clampRound(v, lo, hi) { return Math.min(hi, Math.max(lo, Math.round(v))); }
// Up to version 4 clearance was one depth on one side: {clear: 80, face: "S"}.
function sanitizeClear(raw, def) {
  const out = { ...NO_CLEAR };
  if (raw.clear && typeof raw.clear === "object") {
    for (const s of SIDE_KEYS) out[s] = clampRound(num(raw.clear[s], 0), 0, MAX_SIZE);
    return out;
  }
  const legacy = num(raw.clear, NaN);
  if (Number.isFinite(legacy)) {
    const side = Object.prototype.hasOwnProperty.call(SIDES, raw.face) ? raw.face : "S";
    out[side] = clampRound(legacy, 0, MAX_SIZE);
    return out;
  }
  return { ...out, ...(def.clear || null) };   // no clearance recorded: type default
}
function sanitize(raw, fallbackId) {
  if (!raw || typeof raw !== "object") return null;
  const type = isType(raw.type) ? raw.type : "furniture";
  const def = TYPES[type];
  return {
    id: Number.isSafeInteger(raw.id) && raw.id > 0 ? raw.id : fallbackId,
    type,
    label: typeof raw.label === "string" ? raw.label : "",
    x: clampRound(num(raw.x, 0), -MAX_POS, MAX_POS), y: clampRound(num(raw.y, 0), -MAX_POS, MAX_POS),
    w: clampRound(num(raw.w, def.w), MIN_SIZE, MAX_SIZE),
    h: clampRound(num(raw.h, def.h), MIN_SIZE, MAX_SIZE),
    z: clampRound(num(raw.z, def.z || 0), 0, MAX_SIZE),
    height: clampRound(num(raw.height, def.height), MIN_SIZE, MAX_SIZE),
    color: typeof raw.color === "string" && raw.color ? raw.color : def.color,
    flip: [0, 1, 2, 3].includes(raw.flip) ? raw.flip : 0,
    clear: sanitizeClear(raw, def),
    wall: clampRound(num(raw.wall, def.wall || 0), 0, MAX_SIZE),
    lock: raw.lock === true,
    rot: Number.isFinite(num(raw.rot, NaN)) ? ((Math.round(num(raw.rot, 0)) % 360) + 360) % 360 : 0,
  };
}
// Selection and undo find objects by id, so ids must be unique. The first
// object with an id keeps it; a repeated or missing id gets a new one above the
// highest id in the list.
function sanitizeObjects(list) {
  const objs = list.map((raw) => sanitize(raw, 0)).filter(Boolean);
  let next = objs.reduce((m, o) => Math.max(m, o.id), 0) + 1;
  const seen = new Set();
  for (const o of objs) {
    if (!o.id || seen.has(o.id)) o.id = next++;
    seen.add(o.id);
  }
  return objs;
}
// A saved file: {app: "moebel", version, units, objects}. Throws when `doc` is
// not one. A file from a newer version still loads, with `newer` set, since
// the fields this version knows are read the same way.
function readLayout(doc) {
  if (!doc || typeof doc !== "object" || doc.app !== "moebel") throw new Error("This is not a Möbel layout file.");
  if (!Array.isArray(doc.objects)) throw new Error("Missing an 'objects' array.");
  return { objects: sanitizeObjects(doc.objects), newer: num(doc.version, 0) > LAYOUT_VERSION };
}
function layoutJson(objects) {
  return JSON.stringify({ app: "moebel", version: LAYOUT_VERSION, units: "cm", objects }, null, 2);
}
