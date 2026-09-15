# How it works

Vanilla JS, SVG for the plan and WebGL for the 3D view. No framework, no build,
no server.

## Files

The app is four files that must stay in the same folder:

- `index.html`: the page, its CSS, the app state and the plan UI code.
- `core.js`: object types, geometry and file loading.
- `rearrange.js`: the Rearrange engine.
- `view3d.js`: the 3D view.

They are plain `<script src>` files that share one global scope, not ES
modules, so the app runs straight from `file://`. `core.js` and `rearrange.js`
load before the inline script in `index.html`, `view3d.js` after it. `core.js`
and `rearrange.js` have no DOM code and never touch the app state.

For the installed app there are also `manifest.webmanifest`, `icon.svg`,
`icon-192.png`, `icon-512.png` and `sw.js`, the service worker. `sw.js` keeps a
copy of all app files in a cache named by its `VERSION` constant. It asks the
network first and uses the copy only when the network fails, so an online visit
always gets the files on the server. Browsers allow service workers only over
`http` or `https`, so from `file://` there is no install and no offline copy.

## State and drawing

World coordinates are centimetres. All cm to px mapping goes through the single
`#viewport` transform. State lives in one `state` object and `render()`
rebuilds the SVG from it. Every object is a rectangle that can turn around its
centre. Collision checks use its bounding box, which is exact at 0, 90, 180 and
270 degrees and too large at other angles.

Undo stores JSON snapshots of `state.objects`, one per finished gesture, capped
at 50. Paint order is array order, so z-order is a move inside the array.

Room walls are four bands in the room's own frame, cut by interval subtraction
wherever a door or window overlaps them, so an opening is a real gap and not a
rectangle painted on top.

A share link is the saved layout file, compressed with
`CompressionStream("deflate")` and written in base64url after `#layout=`. It
uses `deflate` and not `deflate-raw`, because Node 18 has only `deflate` and
`gzip`.

## 3D

The 3D view builds a list of boxes from `state.objects` on every change and
draws it with one small WebGL shader and flat light. Plan x is 3D x, plan y is
3D z. A wall band is split along its length at every opening edge, and each
slice keeps the heights that no opening covers. A plain wall is cut the same
way, so a door in a partition is a real gap in 3D. A room with wall thickness 0
still gets thin 10 cm walls in 3D, just outside its outline.

Walk moves at 70 cm per second with an 80° view (40° to 110° with scroll). It
collides with anything that crosses the band from 30 to 180 cm above the floor.

## Rearrange

Rearrange turns the floor inside the walls into a 5 cm grid and scores a layout
on it:

- Reach is the share of every piece's clearance that a 60 cm wide person coming
  in the door can get to.
- Open is the share of floor at least 50 cm from anything.
- Back gap is how far a piece's back side stands from a wall or another piece.
  The back is the side opposite its clearance.

Overlaps, pieces outside the room, pieces in a door's swing and pieces in front
of a window higher than its sill are penalised, and layouts with any of them
are never shown. In front of a window means within 30 cm of its centreline. A
piece with `z` over 0 hangs: it leaves the floor open and only clashes with
things at the same height, so a shelf at 120 cm can hang above a 75 cm desk but
not above a wardrobe.

Simulated annealing runs 8 times, the first from the current layout and the
rest from random wall positions, with moves that push a piece against a wall,
shift it, turn it or swap two pieces. Weights are in `RA` in `rearrange.js`.
Rooms over 400 m² of floor (`RA.MAX_CELLS`) are refused: the search takes about
40 s there, measured in Node.
