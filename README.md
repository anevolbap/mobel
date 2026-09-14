# Möbel

Browser-based, to-scale floor-plan editor. Lay out a home in exact centimetres:
drop in rooms, doors, windows, bookshelves and furniture, then drag, rotate and
resize them, or let **Rearrange** propose new furniture layouts for a room.
Vanilla JS, SVG for the plan and WebGL for the 3D view. No framework, no build,
no server. Layouts are plain `.json` files you own.

## Run

Open `index.html` in a browser (double-click, or `firefox index.html`). That's it.

The app is four files that must stay in the same folder:

- `index.html`: the page, its CSS, the app state and the plan UI code.
- `core.js`: object types, geometry and file loading.
- `rearrange.js`: the Rearrange engine.
- `view3d.js`: the 3D view.

They are plain `<script src>` files that share one global scope, not ES
modules, so the app still runs straight from `file://` (tested in Firefox).
`core.js` and `rearrange.js` load before the inline script in `index.html`,
`view3d.js` after it. `core.js` and `rearrange.js` have no DOM code and never
touch the app state.

## Test

```bash
node --test test/*.test.mjs
```

Needs Node 18 or newer (tested on 24) and nothing else. The tests load `core.js`
and `rearrange.js` the same way the page does, cut the 3D scene builder (which
has no DOM code) out of `view3d.js`, and check the results with their own box
math. Old layout files in `test/fixtures` check that each file version still
loads. The drawing and the pointer interaction have no automated tests.

## Use

- **Add ▾** places a room, wall, door, window, tall window, bookshelf, fridge,
  desk, table, bed, sofa, wardrobe or generic furniture at the view centre.
- A **room** carries its own walls, so one room replaces the four walls you would
  otherwise draw. Set the thickness in the sidebar, or 0 for a bare floor. The
  wall is centred on the rectangle, so two rooms placed edge to edge share one
  wall instead of stacking two. The label prints the floor area inside the walls.
- Doors and windows cut real gaps: drop one over a room wall and the wall opens
  to exactly its width. Move it away and the wall closes again. The plain **wall**
  type is still there for partitions and shapes a rectangle cannot make.
- Drag a room's floor to pan, click its wall to select it. Furniture snaps to the
  inner face of the wall, so a sofa lands against it, not inside it.
- Drag empty space to pan; scroll to zoom toward the cursor; **Fit** frames everything.
- Click to select; drag to move; drag the corner handle to resize; drag the round knob to rotate.
- On a touch screen one finger works like the mouse: tap to select, drag an
  object to move it, drag empty space to pan. Pinch with two fingers to zoom,
  and move both fingers to pan. The second finger cancels what the first one
  started, so a pinch that begins on an object leaves it where it was.
  Handles and buttons are bigger there, and a finger grabs a wall, door or
  window even a little outside its edge.
- **Shift+click** adds to the selection, **Shift+drag** on empty space draws a
  selection box. Dragging one selected object moves the whole group. Resize and
  rotate handles appear only when a single object is selected.
- **Front** and **Back** change the paint order.
- Edit the exact label, type, position, size, rotation and colour in the sidebar.
- **Above floor** and **Height** give an object its vertical size in centimetres.
  A window starts at its 90 cm sill, and a shelf can hang on a wall above a
  desk. Each type comes with a height (door 210, wardrobe 200, desk 75, bed 50).
  For a room, **Wall height** is the height of its walls.
- Doors show a swing arc; **Flip swing** changes the hinge. Orientation follows width vs height.
- The selected object shows its `W×H` in centimetres.
- **Clearance** draws a dashed band for the free space a piece needs beyond its
  own footprint. Each side has its own depth in centimetres, set in a small pad
  where the four boxes sit where their side is, so a fridge reserves 100 cm at
  the front, a double bed 60 cm on both flanks, and a dining table 75 cm all
  round. The sides are in the object's own frame, so they turn with the object.
  Fridge, desk, table, bed, sofa and wardrobe come with defaults; any object can
  have any combination.
- Each band turns red on its own when something solid stands in it, so a bed
  pushed against a wall shows one flank blocked and the other still free.
- **Snap 5 cm** snaps to a 5 cm grid and magnet-aligns edges/centres to nearby
  objects, so walls connect flush. A thin line shows what it locked onto. Hold
  **Alt** while dragging to place freely.
- **Measure** (or `M`) turns the pointer into a tape. Drag to read a distance in
  centimetres and metres. Both ends jump to nearby object edges, so measuring a
  clear span between two walls gives the exact number. Hold **Alt** to measure
  free. `Esc` clears the tape. Measurements are not part of the layout and are
  never saved.
- Every change is undoable, and the layout is kept in `localStorage`, so a reload
  brings back the last session. **File ▾ → Reset to sample** goes back to the
  demo room. **File ▾ → Print** prints the plan alone, without the interface.
- **Rearrange** (in a room's sidebar) looks for new layouts of the furniture in
  that room and shows the best five in place. **Prev** and **Next** (or the
  arrow keys) step through them, **Apply** (or `Enter`) keeps one as a single
  undo step, **Cancel** (or `Esc`) puts everything back. Tick **Locked** on a
  piece to keep it where it is, for example a built-in wardrobe. Doors, windows
  and walls never move. Each run starts from a new random seed, so pressing
  Rearrange again gives other ideas.

- **3D** shows the layout raised to its heights. Drag to turn around it,
  Shift+drag (or right-drag) to pan, scroll or pinch to zoom. Doors and windows cut the
  walls at their own heights, so a window leaves wall below its sill and above
  its top. A window has a frame and glass, a door has a frame and its leaf
  standing open on the side of its swing, and both show even with no wall
  under them. A room with wall thickness 0 still gets thin 10 cm walls in 3D,
  just outside its outline, so its floor keeps its size. The sidebar still edits the selected
  object and the 3D view follows. Press **3D** again to go back to the plan.
- **Walk** (in the 3D view) puts you at eye height (160 cm) where the 3D camera
  was looking, facing the same way. Click the view to look with the mouse, or
  drag if the browser does not lock the pointer. `W` `A` `S` `D` or the arrow
  keys walk (70 cm per second, so crossing a 3 m room takes a few seconds),
  Shift runs. The view is wide (80°) so a small room fits on screen, and scroll
  (or a pinch) makes it wider or narrower (40° to 110°). On a touch screen you
  can look around by dragging, but walking needs a keyboard. You cannot walk through walls, windows or furniture,
  but anything that is all below 30 cm or all above 180 cm lets you pass, so
  you walk through a door gap and under a high shelf. The first `Esc` frees the
  mouse, the next one (or **Walk** again) goes back to turning around the layout.

### Keyboard

- Arrow keys nudge (Shift = 1 cm), `R` rotates 90°.
- `X` (or `Del`) deletes, `D` (or `C`) duplicates, `Esc` deselects.
- `Ctrl/⌘+Z` undoes, `Ctrl/⌘+Shift+Z` (or `Ctrl+Y`) redoes, `Ctrl/⌘+A` selects all.
- `Ctrl/⌘+S` saves a `layout.json`; **File ▾ → Load** restores one.
- `M` turns the measure tape on and off.
- While a Rearrange preview is open: `←` / `→` step through the layouts,
  `Enter` applies, `Esc` cancels. Editing keys do nothing and dragging only
  pans. `Ctrl/⌘+S` still saves, and it saves the layout being previewed.

## Layout file

A saved layout is JSON:

```json
{
  "app": "moebel", "version": 6, "units": "cm",
  "objects": [
    { "id": 2, "type": "desk", "label": "Desk", "x": 40, "y": 40, "w": 140, "h": 60,
      "z": 0, "height": 75, "rot": 0, "color": "#1b6cf0", "flip": 0,
      "clear": { "N": 0, "E": 0, "S": 80, "W": 0 }, "wall": 0, "lock": false }
  ]
}
```

- `type`: `room`, `wall`, `door`, `window`, `tallwindow`, `bookshelf`,
  `furniture`, `fridge`, `desk`, `table`, `bed`, `sofa` or `wardrobe`. An
  unknown type loads as `furniture`.
- `x`, `y` is the top-left corner and `w`, `h` the size, all in cm, before
  rotation. `rot` is in degrees, clockwise, around the centre.
- `z` is the height of the object's bottom above the floor and `height` its
  size upwards, in cm. A room's `height` is its wall height.
- `clear` is the clearance depth per side in the object's own frame: `N` is the
  top edge before rotation.
- `wall` is a room's wall thickness. `flip` (0 to 3) is a door's hinge side.
- `lock: true` keeps a piece in place during Rearrange.
- Objects are painted in array order, so the first one is at the back.

On load, a missing or broken field falls back to a safe value: 0 for the
position, the type's default for size, height, colour, clearance and wall. A
number that is not finite counts as broken. Other numbers are kept in range:
`w`, `h`, `z`, `height`, `wall` and each `clear` side go up to 10000 cm (100 m),
and `x`, `y` stay between -100000 and 100000 cm (1 km). The sidebar holds
typed numbers to the same ranges, rounded to whole centimetres.

Every object needs its own `id`. If two objects share an id, the first keeps
it and the other gets a new one above the highest id in the file. An object
with no id gets a new one too.

A file without `"app": "moebel"` or without an `objects` array is refused with
a message. A file with a higher `version` than this Möbel saves still loads,
but a message warns that fields this version does not know were dropped and
will not be saved.

## Notes

World coordinates are centimetres; all cm→px mapping goes through the single
`#viewport` transform. State lives in one `state` object and `render()` rebuilds
the SVG from it. Every object is a rectangle that can turn around its centre.
Collision checks use its bounding box, which is exact at 0, 90, 180 and 270
degrees and too large at other angles.

Undo stores JSON snapshots of `state.objects`, one per finished gesture, capped
at 50. Paint order is array order, so z-order is a move inside the array. Saved
files are version 6; older files load. An object from a version 5 file picks up
its type's `z` and `height`, a room from an older file picks up the
default 15 cm walls, and a version 4 `clear: 80, face: "S"` becomes
`clear: {N: 0, E: 0, S: 80, W: 0}`.

Room walls are four bands in the room's own frame, cut by interval subtraction
wherever a door or window overlaps them, so an opening is a real gap and not a
rectangle painted on top.

The 3D view builds a list of boxes from `state.objects` on every change and
draws it with one small WebGL shader and flat light. Plan x is 3D x, plan y is
3D z. A wall band is split along its length at every opening edge, and each
slice keeps the heights that no opening covers. A plain wall is cut the same
way, so a door in a partition is a real gap in 3D.

Rearrange turns the floor inside the walls into a 5 cm grid and scores a layout
on it. Reach is the share of every piece's clearance that a 60 cm wide person
coming in the door can get to. Open is the share of floor at least 50 cm from
anything. Back gap is how far a piece's back side stands from a wall or another
piece (the back is the side opposite its clearance). Overlaps, pieces outside
the room, pieces in a door's swing and pieces in front of a window higher than
its sill are penalised, and layouts with any of them are never shown. In front
of a window means within 30 cm of its centreline. A piece with **Above floor**
over 0 hangs: it leaves the floor open and only clashes with things at the same
height, so a shelf at 120 cm can hang above a 75 cm desk but not above a
wardrobe. Simulated annealing runs 8 times, the first from the
current layout and the rest from random wall positions, with moves that push a piece
against a wall, shift it, turn it or swap two pieces. Weights are in `RA`.
Known limits of Rearrange:

- Only rooms at rotation 0 are supported, and pieces snap to 90° turns.
- Rooms with more than 400 m² of floor inside the walls are refused, because
  the search gets too slow (about 40 s at 400 m², measured in Node).
- A hanging piece still gets pushed against a wall like a floor piece, and the
  person walking in is not checked against its height.
- A piece belongs to the room that holds its centre.
- Search time grows with floor area: about 1 s for a 3 × 3 m room and 5 s for
  6 × 4.5 m (measured in Node).

## License

GPL-3.0-or-later, see `LICENSE`.
