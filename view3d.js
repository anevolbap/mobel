"use strict";
/* ============================================================
   Möbel 3D: the plan raised into boxes, seen with an orbit camera.
   A classic script loaded after the one in index.html, so it uses its globals
   (state, TYPES, aabb, roomBands, ...) and still runs from file://.
   Plan x is 3D x, plan y is 3D z, and heights go up along 3D y.
   ============================================================ */

/* ---------- 3d: scene ---------- */
const WALL_3D = "#e9e4da", GLASS_3D = "#9cc9e8", GLASS_CM = 2;

// Doors and windows in an object's own frame, with their heights, so they can cut its walls.
function openings3d(o, objects) {
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, rot = o.rot || 0;
  return objects.filter((t) => OPENINGS.has(t.type)).map((t) => ({
    ...rotRectAabb(aabb(t), cx, cy, -rot), z0: t.z || 0, z1: (t.z || 0) + t.height, glass: t.type !== "door",
  }));
}
// What is left of one wall band: split it along the wall at every opening edge,
// and each slice keeps the heights no opening covers. A window slice also gets
// a pane of glass. Rects are in the band's frame, with z0 and z1.
function wallSlices(band, height, openings) {
  const horiz = band.axis === "x";
  const a0 = horiz ? band.x : band.y, a1 = a0 + (horiz ? band.w : band.h);
  const cuts = openings.filter((op) => rectsOverlap(band, op) && op.z1 > op.z0)
    .map((op) => ({ s0: horiz ? op.x : op.y, s1: horiz ? op.x + op.w : op.y + op.h, z0: op.z0, z1: op.z1, glass: op.glass }));
  const edges = [...new Set([a0, a1, ...cuts.flatMap((c) => [c.s0, c.s1]).filter((v) => v > a0 && v < a1)])].sort((p, q) => p - q);
  const slice = (s0, s1) => horiz ? { x: s0, y: band.y, w: s1 - s0, h: band.h } : { x: band.x, y: s0, w: band.w, h: s1 - s0 };
  const pane = (s0, s1) => horiz
    ? { x: s0, y: band.y + band.h / 2 - GLASS_CM / 2, w: s1 - s0, h: GLASS_CM }
    : { x: band.x + band.w / 2 - GLASS_CM / 2, y: s0, w: GLASS_CM, h: s1 - s0 };
  const out = [];
  for (let e = 0; e + 1 < edges.length; e++) {
    const s0 = edges[e], s1 = edges[e + 1];
    if (s1 - s0 < 0.5) continue;
    const here = cuts.filter((c) => c.s0 < s1 && c.s1 > s0);
    for (const [z0, z1] of subtractIntervals(0, height, here.map((c) => [c.z0, c.z1]))) {
      if (z1 - z0 >= 0.5) out.push({ ...slice(s0, s1), z0, z1 });
    }
    for (const c of here) {
      if (c.glass && Math.min(height, c.z1) > c.z0) out.push({ ...pane(s0, s1), z0: c.z0, z1: Math.min(height, c.z1), glass: true });
    }
  }
  return out;
}
// Everything to draw, as boxes: centre and size in plan (w along the box's own
// x, d along its own y), turned by rot degrees, from y0 up to y1.
function sceneBoxes(objects) {
  const out = [];
  const add = (o, r, y0, y1, color, kind) => {   // r is in o's own frame
    const c = rotatePoint(r.x + r.w / 2, r.y + r.h / 2, o.x + o.w / 2, o.y + o.h / 2, o.rot || 0);
    out.push({ cx: c.x, cy: c.y, w: r.w, d: r.h, rot: o.rot || 0, y0, y1, color, kind });
  };
  const walls = (o, bands, color) => {
    const ops = openings3d(o, objects);
    for (const band of bands) {
      for (const p of wallSlices(band, o.height, ops)) add(o, p, p.z0, p.z1, p.glass ? GLASS_3D : color, p.glass ? "glass" : "wall");
    }
  };
  for (const o of objects) {
    if (o.type === "room") {
      add(o, o, -2, 0, o.color, "floor");
      walls(o, roomBands(o), WALL_3D);
    } else if (o.type === "wall") {
      walls(o, [{ x: o.x, y: o.y, w: o.w, h: o.h, axis: o.w >= o.h ? "x" : "y" }], o.color === DEFAULT_WALL_COLOR ? WALL_3D : o.color);
    } else if (!OPENINGS.has(o.type)) {
      add(o, o, o.z || 0, (o.z || 0) + o.height, o.color, "piece");
    }
  }
  return out;
}

/* ---------- 3d: drawing ---------- */
const v3 = {
  gl: null, prog: null, buf: null, opaque: 0, glass: 0,
  yaw: 0, pitch: 0.95, dist: 1000, tx: 0, ty: 0,   // orbit camera: radians, cm; target in plan
};
const canvas3d = $("canvas3d"), hint3d = $("hint3d"), btn3d = $("btn-3d");

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function lookAt(e, t) {   // up is +y
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2], l = Math.hypot(zx, zy, zz);
  zx /= l; zy /= l; zz /= l;
  let xx = zz, xz = -zx;
  l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;
  const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
  return [xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
}
function mul4(a, b) {   // column-major a * b
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function init3d() {
  const gl = canvas3d.getContext("webgl", { antialias: true });
  if (!gl) return false;
  const shader = (type, text) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, text);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, `
    attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
    uniform mat4 uMatrix; varying vec3 vNormal; varying vec3 vColor;
    void main() { vNormal = aNormal; vColor = aColor; gl_Position = uMatrix * vec4(aPos, 1.0); }`));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec3 vNormal; varying vec3 vColor; uniform float uAlpha;
    void main() {
      vec3 n = normalize(vNormal);
      float light = 0.5 + 0.38 * max(dot(n, normalize(vec3(0.35, 1.0, 0.55))), 0.0)
                        + 0.18 * max(dot(n, normalize(vec3(-0.6, 0.3, -0.4))), 0.0);
      gl_FragColor = vec4(min(vColor * light, 1.0), uAlpha);
    }`));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
  Object.assign(v3, { gl, prog, buf: gl.createBuffer() });
  return true;
}

// Corner i of a box: bit 1 is +x, bit 2 is the top, bit 4 is +z (plan +y).
const BOX_FACES = [
  [[1, 3, 7, 5], [1, 0, 0]], [[0, 4, 6, 2], [-1, 0, 0]], [[2, 6, 7, 3], [0, 1, 0]],
  [[0, 1, 5, 4], [0, -1, 0]], [[4, 5, 7, 6], [0, 0, 1]], [[0, 2, 3, 1], [0, 0, -1]],
];
function pushBox(out, b) {
  const r = ((b.rot || 0) * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  const color = rgb(b.color);
  if (b.kind === "floor") for (let i = 0; i < 3; i++) color[i] += (1 - color[i]) * 0.6;
  const corner = (i) => {
    const lx = (i & 1 ? 0.5 : -0.5) * b.w, lz = (i & 4 ? 0.5 : -0.5) * b.d;
    return [b.cx + lx * cos - lz * sin, i & 2 ? b.y1 : b.y0, b.cy + lx * sin + lz * cos];
  };
  for (const [idx, [nx, ny, nz]] of BOX_FACES) {
    const n = [nx * cos - nz * sin, ny, nx * sin + nz * cos];
    for (const i of [idx[0], idx[1], idx[2], idx[0], idx[2], idx[3]]) out.push(...corner(i), ...n, ...color);
  }
}
function upload3d(boxes) {
  const data = [];
  for (const b of boxes) if (b.kind !== "glass") pushBox(data, b);
  const opaque = data.length / 9;
  for (const b of boxes) if (b.kind === "glass") pushBox(data, b);
  const gl = v3.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, v3.buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
  v3.opaque = opaque;
  v3.glass = data.length / 9 - opaque;
}
function camera3d() {
  const cp = Math.cos(v3.pitch);
  const eye = [v3.tx + v3.dist * cp * Math.sin(v3.yaw), 60 + v3.dist * Math.sin(v3.pitch), v3.ty + v3.dist * cp * Math.cos(v3.yaw)];
  return { eye, target: [v3.tx, 60, v3.ty], near: 5 };
}
function drawFrame() {
  const gl = v3.gl, dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(canvas3d.clientWidth * dpr)), H = Math.max(1, Math.round(canvas3d.clientHeight * dpr));
  if (canvas3d.width !== W || canvas3d.height !== H) { canvas3d.width = W; canvas3d.height = H; }
  gl.viewport(0, 0, W, H);
  const [r, g, b] = rgb(getComputedStyle(document.documentElement).getPropertyValue("--paper"));
  gl.clearColor(r, g, b, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(v3.prog);
  const cam = camera3d();
  gl.uniformMatrix4fv(gl.getUniformLocation(v3.prog, "uMatrix"), false,
    mul4(perspective(Math.PI / 3.4, W / H, cam.near, 100000), lookAt(cam.eye, cam.target)));
  gl.bindBuffer(gl.ARRAY_BUFFER, v3.buf);
  [["aPos", 0], ["aNormal", 3], ["aColor", 6]].forEach(([name, off]) => {
    const loc = gl.getAttribLocation(v3.prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 36, off * 4);
  });
  const alpha = gl.getUniformLocation(v3.prog, "uAlpha");
  gl.uniform1f(alpha, 1);
  gl.disable(gl.BLEND);
  gl.depthMask(true);
  if (v3.opaque) gl.drawArrays(gl.TRIANGLES, 0, v3.opaque);
  if (v3.glass) {   // see-through, drawn last and without hiding what is behind it
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(alpha, 0.35);
    gl.drawArrays(gl.TRIANGLES, v3.opaque, v3.glass);
    gl.depthMask(true);
  }
}
// Called from render() in index.html whenever the layout or the window changes.
function draw3d() {
  upload3d(sceneBoxes(state.objects));
  drawFrame();
}

/* ---------- 3d: interaction ---------- */
function fit3d() {
  const b = contentBounds(state.objects);
  if (!b) { Object.assign(v3, { tx: 0, ty: 0, dist: 1000 }); return; }
  v3.tx = (b.minX + b.maxX) / 2;
  v3.ty = (b.minY + b.maxY) / 2;
  v3.dist = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 1.1 + 300;
}
function set3d(mode) {
  if (mode && !v3.gl && !init3d()) { alert("This browser cannot draw the 3D view (no WebGL)."); return; }
  if (mode && !state.mode3d) { fit3d(); v3.yaw = 0; v3.pitch = 0.95; }
  state.mode3d = mode;
  canvas3d.hidden = hint3d.hidden = !mode;
  btn3d.classList.toggle("active", !!mode);
  hint3d.textContent = "Drag to turn · Shift+drag to pan · scroll to zoom";
  onChange();
}
btn3d.innerHTML = icon("cube") + "<span>3D</span>";
btn3d.title = "Show the layout in 3D";
btn3d.addEventListener("click", () => set3d(state.mode3d ? null : "orbit"));

let drag3d = null;
canvas3d.addEventListener("pointerdown", (e) => {
  drag3d = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 };
  canvas3d.setPointerCapture(e.pointerId);
});
canvas3d.addEventListener("pointermove", (e) => {
  if (!drag3d) return;
  const dx = e.clientX - drag3d.x, dy = e.clientY - drag3d.y;
  drag3d.x = e.clientX; drag3d.y = e.clientY;
  if (drag3d.pan) {   // move the target in plan, along the screen's right and up
    const k = v3.dist / Math.max(1, canvas3d.clientHeight);
    const c = Math.cos(v3.yaw), s = Math.sin(v3.yaw);
    v3.tx -= (dx * c + dy * s) * k;
    v3.ty -= (dy * c - dx * s) * k;
  } else {
    v3.yaw -= dx * 0.008;
    v3.pitch = Math.max(0.05, Math.min(1.55, v3.pitch + dy * 0.008));
  }
  drawFrame();
});
canvas3d.addEventListener("pointerup", () => { drag3d = null; });
canvas3d.addEventListener("pointercancel", () => { drag3d = null; });
canvas3d.addEventListener("contextmenu", (e) => e.preventDefault());
canvas3d.addEventListener("wheel", (e) => {
  e.preventDefault();
  v3.dist = Math.max(50, Math.min(20000, v3.dist * Math.exp(e.deltaY * 0.0015)));
  drawFrame();
}, { passive: false });
