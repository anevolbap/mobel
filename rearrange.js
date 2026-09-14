"use strict";
/* Möbel rearrange engine. Needs core.js. No DOM and no app state. */

/* ---------- rearrange: search for new layouts ---------- */
// One room at a time. The floor inside the walls becomes a grid, a layout gets
// a score on that grid, and simulated annealing moves the unlocked pieces to
// raise it. Doors, walls and locked pieces stay where they are.
//   reach: how much of each piece's clearance a person coming in the door can get to
//   open:  share of the floor at least OPEN_R from anything
//   gap:   how far a piece's back is from a wall or another piece
//   bad:   grid cells where a piece overlaps, leaves the room, blocks a door or
//          stands in front of a window higher than its sill
// A piece with z > 0 hangs: it leaves the floor free and only clashes with
// things that share its height, so a shelf can hang above a desk.
const RA = {
  CELL: 5,          // cm per grid cell
  PERSON_R: 30,     // half a walking person: passages under 60 cm do not count
  OPEN_R: 50,
  GAP_CAP: 100,     // a back further than this from anything scores the same
  WINDOW_DEPTH: 30, // cm on each side of a window's centreline kept below its sill
  W_REACH: 1, W_OPEN: 0.5, W_GAP: 0.3, W_BAD: 20,
  T0: 0.05, T1: 0.0005,
};
const RA_FAR = 1e6;
const RA_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N E S W in world space

// The sides a piece should put against a wall: the opposite of its only
// clearance side, or the sides without clearance. A table (all four) has none.
function backSides(o) {
  const c = SIDE_KEYS.filter((s) => clearDepth(o, s) > 0);
  if (c.length === 4) return [];
  if (c.length === 1) return [SIDE_KEYS[(SIDE_KEYS.indexOf(c[0]) + 2) % 4]];
  return SIDE_KEYS.filter((s) => !c.includes(s));
}
function raDims(o, rot) { return rot % 180 ? [o.h, o.w] : [o.w, o.h]; }
function hangs(o) { return (o.z || 0) > 0; }
// True when two objects share some height.
function sameHeight(a, b) {
  const a0 = a.z || 0, b0 = b.z || 0;
  return a0 < b0 + (b.height || 0) && b0 < a0 + (a.height || 0);
}
function overlapCells(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? Math.ceil((w * h) / (RA.CELL * RA.CELL) - 1e-6) : 0;
}
// A placement is the world box's top-left plus a rotation in 90° steps.
function placedObject(o, p) {
  const [aw, ah] = raDims(o, p.rot);
  return { ...o, x: p.ax + aw / 2 - o.w / 2, y: p.ay + ah / 2 - o.h / 2, rot: p.rot };
}
function currentPlacement(P) {
  return P.movers.map((o) => {
    const rot = ((Math.round((o.rot || 0) / 90) * 90) % 360 + 360) % 360;
    const [aw, ah] = raDims(o, rot);
    return { ax: o.x + o.w / 2 - aw / 2, ay: o.y + o.h / 2 - ah / 2, rot };
  });
}
// Grid cells a world rect touches, in padded grid coordinates, or null.
function cellRange(P, r) {
  const C = RA.CELL, e = 1e-6;
  const i0 = Math.max(1, Math.floor((r.x - P.I.x) / C + e) + 1);
  const i1 = Math.min(P.nx, Math.ceil((r.x + r.w - P.I.x) / C - e));
  const j0 = Math.max(1, Math.floor((r.y - P.I.y) / C + e) + 1);
  const j1 = Math.min(P.ny, Math.ceil((r.y + r.h - P.I.y) / C - e));
  return i0 > i1 || j0 > j1 ? null : [i0, i1, j0, j1];
}
function fillCells(P, arr, r) {
  const c = cellRange(P, r);
  if (!c) return;
  for (let j = c[2]; j <= c[3]; j++) for (let i = c[0]; i <= c[1]; i++) arr[j * P.W + i] = 1;
}
// Everything about a room that stays the same while pieces move.
function rearrangeProblem(room, objects) {
  const t = room.wall || 0, C = RA.CELL;
  const I = { x: room.x + t / 2, y: room.y + t / 2, w: room.w - t, h: room.h - t };
  const nx = Math.max(1, Math.floor(I.w / C)), ny = Math.max(1, Math.floor(I.h / C));
  const W = nx + 2, H = ny + 2;                       // a ring of blocked cells around the floor
  // solids: fixed things checked box by box with their heights; `floor` ones are also in `base`
  const P = { I, nx, ny, W, H, base: new Uint8Array(W * H), door: new Uint8Array(W * H), hasDoor: false, doorTop: 0,
    movers: [], fixed: [], solids: [] };
  for (let i = 0; i < W; i++) P.base[i] = P.base[(H - 1) * W + i] = 1;
  for (let j = 0; j < H; j++) P.base[j * W] = P.base[j * W + W - 1] = 1;
  const near = { x: room.x - t / 2 - 20, y: room.y - t / 2 - 20, w: room.w + t + 40, h: room.h + t + 40 };
  for (const o of objects) {
    if (o.id === room.id) continue;
    const b = aabb(o);
    if (o.type === "door" && rectsOverlap(b, near)) {   // keep the swing and the way in free
      const L = Math.max(b.w, b.h);
      fillCells(P, P.door, b.w >= b.h
        ? { x: b.x, y: b.y + b.h / 2 - L, w: b.w, h: 2 * L }
        : { x: b.x + b.w / 2 - L, y: b.y, w: 2 * L, h: b.h });
      P.hasDoor = true;
      P.doorTop = Math.max(P.doorTop, (o.z || 0) + (o.height || 0));
      continue;
    }
    if ((o.type === "window" || o.type === "tallwindow") && rectsOverlap(b, near)) {   // keep it clear up to the glass
      const D = RA.WINDOW_DEPTH;
      const zone = b.w >= b.h ? { x: b.x, y: b.y + b.h / 2 - D, w: b.w, h: 2 * D } : { x: b.x + b.w / 2 - D, y: b.y, w: 2 * D, h: b.h };
      P.solids.push({ ...zone, z: o.z || 0, height: o.height || 0, floor: false });
      continue;
    }
    const piece = !!TYPES[o.type].piece;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const block = () => {
      P.solids.push({ ...b, z: o.z || 0, height: o.height || 0, floor: !hangs(o) });
      if (!hangs(o)) fillCells(P, P.base, b);
    };
    if (piece && cx > I.x && cx < I.x + I.w && cy > I.y && cy < I.y + I.h) {
      if (o.lock) { P.fixed.push(o); block(); } else P.movers.push(o);
    } else if ((piece || o.type === "wall") && rectsOverlap(b, I)) block();
  }
  return P;
}
// Two-pass chamfer distance (5 straight, 7 diagonal), in cm. The border ring is never updated.
function chamfer(d, W, H) {
  for (let j = 1; j < H - 1; j++) for (let i = 1, k = j * W + 1; i < W - 1; i++, k++) {
    let v = d[k];
    if (d[k - 1] + 5 < v) v = d[k - 1] + 5;
    if (d[k - W] + 5 < v) v = d[k - W] + 5;
    if (d[k - W - 1] + 7 < v) v = d[k - W - 1] + 7;
    if (d[k - W + 1] + 7 < v) v = d[k - W + 1] + 7;
    d[k] = v;
  }
  for (let j = H - 2; j >= 1; j--) for (let i = W - 2, k = j * W + W - 2; i >= 1; i--, k--) {
    let v = d[k];
    if (d[k + 1] + 5 < v) v = d[k + 1] + 5;
    if (d[k + W] + 5 < v) v = d[k + W] + 5;
    if (d[k + W + 1] + 7 < v) v = d[k + W + 1] + 7;
    if (d[k + W - 1] + 7 < v) v = d[k + W - 1] + 7;
    d[k] = v;
  }
}
function scoreLayout(P, pl) {
  const { W, H, I, door } = P, C = RA.CELL, n = W * H;
  const occ = P.base.slice();
  const placed = P.movers.map((o, m) => placedObject(o, pl[m]));
  let bad = 0;
  for (const o of placed) {
    const b = aabb(o);
    const ow = Math.max(0, Math.min(b.x + b.w, I.x + I.w) - Math.max(b.x, I.x));
    const oh = Math.max(0, Math.min(b.y + b.h, I.y + I.h) - Math.max(b.y, I.y));
    bad += Math.round((b.w * b.h - ow * oh) / (C * C));   // outside the room
    const c = cellRange(P, b);
    if (!c) continue;
    const up = hangs(o), belowDoor = (o.z || 0) < P.doorTop;
    for (let j = c[2]; j <= c[3]; j++) for (let i = c[0]; i <= c[1]; i++) {
      const k = j * W + i;
      if (up) { if (door[k] && belowDoor) bad++; continue; }
      if (occ[k]) bad++;
      if (door[k]) bad++;
      occ[k] = 1;
    }
  }
  // clashes the floor grid cannot see: hanging pieces and windows
  placed.forEach((o, m) => {
    const b = aabb(o), up = hangs(o);
    for (const s of P.solids) if ((up || !s.floor) && sameHeight(o, s)) bad += overlapCells(b, s);
    for (let q = m + 1; q < placed.length; q++) {
      const p = placed[q];
      if ((up || hangs(p)) && sameHeight(o, p)) bad += overlapCells(b, aabb(p));
    }
  });
  // distance from every free cell to the nearest obstacle or wall
  const d = new Int32Array(n);
  for (let k = 0; k < n; k++) d[k] = occ[k] ? 0 : RA_FAR;
  chamfer(d, W, H);
  // walk from the door through cells where a person fits (occupied cells have d = 0)
  const PR = RA.PERSON_R, OR = RA.OPEN_R;
  const walk = new Uint8Array(n), reached = new Uint8Array(n), stack = [];
  let open = 0, top = -1;
  for (let k = 0; k < n; k++) {
    const dk = d[k];
    if (dk >= OR) open++;
    if (dk < PR) continue;
    walk[k] = 1;
    if (door[k]) { reached[k] = 1; stack.push(k); }
    if (top < 0 || dk > d[top]) top = k;
  }
  if (!P.hasDoor && top >= 0) { reached[top] = 1; stack.push(top); }
  while (stack.length) {
    const k = stack.pop();
    if (walk[k - 1] && !reached[k - 1]) { reached[k - 1] = 1; stack.push(k - 1); }
    if (walk[k + 1] && !reached[k + 1]) { reached[k + 1] = 1; stack.push(k + 1); }
    if (walk[k - W] && !reached[k - W]) { reached[k - W] = 1; stack.push(k - W); }
    if (walk[k + W] && !reached[k + W]) { reached[k + W] = 1; stack.push(k + W); }
  }
  // free cells within reach of someone standing on a reached cell
  const t = new Int32Array(n);
  for (let k = 0; k < n; k++) t[k] = reached[k] ? 0 : RA_FAR;
  chamfer(t, W, H);
  const countTouch = (r) => {
    const c = cellRange(P, r);
    let hit = 0, all = 0;
    if (c) for (let j = c[2]; j <= c[3]; j++) for (let i = c[0], k = j * W + c[0]; i <= c[1]; i++, k++) {
      all++;
      if (!occ[k] && t[k] <= PR + C) hit++;
    }
    return { hit, all };
  };
  let reach = 0;
  const targets = [...placed, ...P.fixed];
  for (const o of targets) {
    const bands = clearanceWorld(o);
    if (bands.length) {
      for (const band of bands) reach += countTouch(band).hit / Math.max(1, (band.w * band.h) / (C * C)) / bands.length;
    } else {   // no clearance set: one reachable side is enough
      const b = aabb(o), outer = countTouch({ x: b.x - C, y: b.y - C, w: b.w + 2 * C, h: b.h + 2 * C });
      const ring = Math.max(1, outer.all - (countTouch(b).all));
      reach += Math.min(1, (4 * outer.hit) / ring);
    }
  }
  reach = targets.length ? reach / targets.length : 1;
  open /= P.nx * P.ny;
  // free run behind each piece's back, capped
  let gap = 0, backed = 0;
  placed.forEach((o, m) => {
    const sides = backSides(o);
    if (!sides.length) return;
    const b = aabb(o), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let best = RA.GAP_CAP;
    for (const s of sides) {
      const [dx, dy] = RA_DIRS[(SIDE_KEYS.indexOf(s) + pl[m].rot / 90) % 4];
      const x = dx ? (dx > 0 ? b.x + b.w + C / 2 : b.x - C / 2) : cx;
      const y = dy ? (dy > 0 ? b.y + b.h + C / 2 : b.y - C / 2) : cy;
      let i = Math.floor((x - I.x) / C) + 1, j = Math.floor((y - I.y) / C) + 1, run = 0;
      while (run < RA.GAP_CAP && i >= 0 && i < W && j >= 0 && j < H && !occ[j * W + i]) { run += C; i += dx; j += dy; }
      best = Math.min(best, run);
    }
    gap += best / RA.GAP_CAP;
    backed++;
  });
  gap = backed ? gap / backed : 0;
  const score = RA.W_REACH * reach + RA.W_OPEN * open - RA.W_GAP * gap - (RA.W_BAD * bad) / (P.nx * P.ny);
  return { score, reach, open, gap, bad };
}
// Small seeded generator, so a search can be repeated.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
// Snap to the grid, keep inside the room. The far wall is allowed off-grid, so pieces sit flush.
function clampPlace(P, o, p) {
  const I = P.I, C = RA.CELL, [aw, ah] = raDims(o, p.rot);
  const fit = (v, lo, span, size) => Math.max(lo, Math.min(lo + span - size, lo + Math.round((v - lo) / C) * C));
  return { ax: fit(p.ax, I.x, I.w, aw), ay: fit(p.ay, I.y, I.h, ah), rot: p.rot };
}
// Back against a random wall, facing into the room, somewhere along it.
function placeAgainstWall(P, o, rng) {
  const backs = backSides(o), I = P.I;
  const s = backs.length ? SIDE_KEYS.indexOf(backs[Math.floor(rng() * backs.length)]) : Math.floor(rng() * 4);
  const k = Math.floor(rng() * 4), rot = ((k - s + 4) % 4) * 90;
  const [aw, ah] = raDims(o, rot);
  let ax = I.x + rng() * (I.w - aw), ay = I.y + rng() * (I.h - ah);
  if (backs.length) {
    if (k === 0) ay = I.y; else if (k === 1) ax = I.x + I.w - aw; else if (k === 2) ay = I.y + I.h - ah; else ax = I.x;
  }
  return clampPlace(P, o, { ax, ay, rot });
}
function proposeLayout(P, pl, rng) {
  const n = P.movers.length, next = pl.slice(), m = Math.floor(rng() * n), o = P.movers[m], p = pl[m], r = rng();
  if (r < 0.35) {
    next[m] = placeAgainstWall(P, o, rng);
  } else if (r < 0.7) {
    const step = (1 + Math.floor(rng() * 10)) * RA.CELL * (rng() < 0.5 ? -1 : 1);
    next[m] = clampPlace(P, o, rng() < 0.5 ? { ...p, ax: p.ax + step } : { ...p, ay: p.ay + step });
  } else if (r < 0.85 || n < 2) {   // turn in place
    const rot = (p.rot + (rng() < 0.5 ? 90 : 180) * (rng() < 0.5 ? 1 : 3)) % 360;
    const [aw, ah] = raDims(o, p.rot), [bw, bh] = raDims(o, rot);
    next[m] = clampPlace(P, o, { ax: p.ax + (aw - bw) / 2, ay: p.ay + (ah - bh) / 2, rot });
  } else {                          // swap two pieces' centres
    const q = (m + 1 + Math.floor(rng() * (n - 1))) % n, oq = P.movers[q], pq = pl[q];
    const centre = (ob, pp) => { const [w, h] = raDims(ob, pp.rot); return [pp.ax + w / 2, pp.ay + h / 2]; };
    const at = (ob, pp, [x, y]) => { const [w, h] = raDims(ob, pp.rot); return clampPlace(P, ob, { ax: x - w / 2, ay: y - h / 2, rot: pp.rot }); };
    next[m] = at(o, p, centre(oq, pq));
    next[q] = at(oq, pq, centre(o, p));
  }
  return next;
}
function annealLayout(P, start, iters, rng) {
  let cur = start, curR = scoreLayout(P, cur), best = cur, bestR = curR;
  for (let it = 0; it < iters; it++) {
    const T = RA.T0 * Math.pow(RA.T1 / RA.T0, it / iters);
    const cand = proposeLayout(P, cur, rng), r = scoreLayout(P, cand);
    if (r.score >= curR.score || rng() < Math.exp((r.score - curR.score) / T)) {
      cur = cand; curR = r;
      if (r.score > bestR.score) { best = cand; bestR = r; }
    }
  }
  return { placement: best, ...bestR };
}
// One annealing run. The first starts from the layout as it is, the rest from random walls.
function searchRun(P, r, iters, rng) {
  const start = r === 0 ? currentPlacement(P) : P.movers.map((o) => placeAgainstWall(P, o, rng));
  return annealLayout(P, start, iters, rng);
}
// The best runs without overlaps, best first. Two layouts whose pieces moved less
// than a metre in total count as one.
function pickLayouts(P, found, keep = 5) {
  const centre = (o, p) => { const [w, h] = raDims(o, p.rot); return [p.ax + w / 2, p.ay + h / 2]; };
  const moved = (a, b) => P.movers.reduce((sum, o, m) => {
    const [x1, y1] = centre(o, a[m]), [x2, y2] = centre(o, b[m]);
    return sum + Math.hypot(x1 - x2, y1 - y2);
  }, 0);
  const out = [];
  for (const f of found.filter((f) => f.bad === 0).sort((a, b) => b.score - a.score)) {
    if (out.length < keep && !out.some((g) => moved(g.placement, f.placement) < 100)) out.push(f);
  }
  return out;
}
const RA_RESTARTS = 8, RA_ITERS = 1000;
function searchLayouts(P, { restarts = RA_RESTARTS, iters = RA_ITERS, keep = 5, seed = 1 } = {}) {
  const rng = mulberry32(seed), found = [];
  for (let r = 0; r < restarts; r++) found.push(searchRun(P, r, iters, rng));
  return pickLayouts(P, found, keep);
}
