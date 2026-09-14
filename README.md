# Möbel

Browser-based, to-scale floor-plan editor. Lay out a home in exact centimetres:
drop in walls, doors, windows, bookshelves and furniture, then drag, rotate and
resize them. Vanilla JS + SVG in a single file. No framework, no build, no server.
Layouts are plain `.json` files you own.

## Run

Open `index.html` in a browser (double-click, or `firefox index.html`). That's it.

The whole app is one self-contained file with inline CSS and a single classic
`<script>`, so it runs straight from `file://`.

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
- **Shift+click** adds to the selection, **Shift+drag** on empty space draws a
  selection box. Dragging one selected object moves the whole group. Resize and
  rotate handles appear only when a single object is selected.
- **Front** and **Back** change the paint order.
- Edit the exact label, type, position, size, rotation and colour in the sidebar.
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

### Keyboard

- Arrow keys nudge (Shift = 1 cm), `R` rotates 90°.
- `X` (or `Del`) deletes, `D` (or `C`) duplicates, `Esc` deselects.
- `Ctrl/⌘+Z` undoes, `Ctrl/⌘+Shift+Z` (or `Ctrl+Y`) redoes, `Ctrl/⌘+A` selects all.
- `Ctrl/⌘+S` saves a `layout.json`; **File ▾ → Load** restores one.

## Notes

World coordinates are centimetres; all cm→px mapping goes through the single
`#viewport` transform. State lives in one `state` object and `render()` rebuilds
the SVG from it. Everything is an axis-aligned rectangle.

Undo stores JSON snapshots of `state.objects`, one per finished gesture, capped
at 50. Paint order is array order, so z-order is a move inside the array. Saved
files are version 5; older files load. A room from an older file picks up the
default 15 cm walls, and a version 4 `clear: 80, face: "S"` becomes
`clear: {N: 0, E: 0, S: 80, W: 0}`.

Room walls are four bands in the room's own frame, cut by interval subtraction
wherever a door or window overlaps them, so an opening is a real gap and not a
rectangle painted on top.

Rearrange turns the floor inside the walls into a 5 cm grid and scores a layout
on it. Reach is the share of every piece's clearance that a 60 cm wide person
coming in the door can get to. Open is the share of floor at least 50 cm from
anything. Back gap is how far a piece's back side stands from a wall or another
piece (the back is the side opposite its clearance). Overlaps, pieces outside
the room and pieces in a door's swing are penalised, and layouts with any of
them are never shown. Simulated annealing runs 8 times, the first from the
current layout and the rest from random wall positions, with moves that push a piece
against a wall, shift it, turn it or swap two pieces. Weights are in `RA`.
Only rooms at rotation 0 are supported, and pieces snap to 90° turns.

The engine has no DOM code, so `node --test test/rearrange.test.mjs` loads it
straight out of `index.html` and checks its results.
