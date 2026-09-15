# User guide

Press `?` (or the **?** button in the toolbar) in the app for a short list of
keys and touch gestures.

## The plan

- Drag empty space to pan, scroll to zoom toward the cursor. **Fit** frames
  everything.
- A scale bar in the bottom right corner shows a round length, from 10 cm to
  10 m. It is printed and exported with the plan and keeps their scale.
- Every change is undoable, and the layout is kept in `localStorage`, so a
  reload brings back the last session.

## Rooms, walls, doors and windows

- **Add ▾** places a room, wall, door, window, tall window, bookshelf, fridge,
  desk, table, bed, sofa, wardrobe or generic furniture at the view centre.
- A **room** carries its own walls, so one room replaces the four walls you
  would otherwise draw. Set the thickness in the sidebar, or 0 for a bare floor.
  The wall is centred on the rectangle, so two rooms placed edge to edge share
  one wall. The label prints the floor area inside the walls.
- Doors and windows cut real gaps: drop one over a room wall and the wall opens
  to exactly its width. Move it away and the wall closes again. The plain
  **wall** type is there for partitions and shapes a rectangle cannot make.
- Drag a room's floor to pan, click its wall to select it. Furniture snaps to
  the inner face of the wall, so a sofa lands against it, not inside it.
- Doors show a swing arc. **Flip swing** changes the hinge. Orientation follows
  width vs height.

## Select and edit

- Click to select, drag to move, drag the corner handle to resize, drag the
  round knob to rotate.
- **Shift+click** adds to the selection, **Shift+drag** on empty space draws a
  selection box. Dragging one selected object moves the whole group. Resize and
  rotate handles appear only when a single object is selected.
- Edit the exact label, type, position, size, rotation and colour in the
  sidebar. Typed sizes are rounded to whole centimetres.
- **Above floor** and **Height** give an object its vertical size in
  centimetres. A window starts at its 90 cm sill, and a shelf can hang on a
  wall above a desk. For a room, **Wall height** is the height of its walls.
- **Front** and **Back** change the paint order.
- **Snap 5 cm** snaps to a 5 cm grid and aligns edges and centres to nearby
  objects, so walls connect flush. A thin line shows what it locked onto. Hold
  **Alt** while dragging to place freely.

## Clearance

**Clearance** draws a dashed band for the free space a piece needs beyond its
own footprint. Each side has its own depth in centimetres, set in a small pad
where each box sits where its side is. A fridge reserves 100 cm at the front, a
double bed 60 cm on both flanks, and a dining table 75 cm all round. The sides
turn with the object.

Each band turns red on its own when something solid stands in it, so a bed
pushed against a wall shows one flank blocked and the other still free.

## Measure

**Measure** (or `M`) turns the pointer into a tape. Drag to read a distance.
Both ends jump to nearby object edges, so measuring between two walls gives the
exact number. Hold **Alt** to measure free. `Esc` clears the tape. Measurements
are never saved.

## Rearrange

**Rearrange** (in a room's sidebar) looks for new layouts of the furniture in
that room and shows the best five in place. **Prev** and **Next** step through
them, **Apply** keeps one as a single undo step, **Cancel** puts everything
back. Tick **Locked** on a piece to keep it where it is, for example a built-in
wardrobe. Doors, windows and walls never move. Each run starts from a new
random seed, so pressing Rearrange again gives other ideas.

Limits:

- Only rooms at rotation 0 are supported, and pieces snap to 90° turns.
- Rooms with more than 400 m² of floor are refused, because the search gets
  too slow. A 3 × 3 m room takes about 1 s, a 6 × 4.5 m room about 5 s.
- A hanging piece still gets pushed against a wall like a floor piece.
- A piece belongs to the room that holds its centre.

## 3D and Walk

- **3D** shows the layout raised to its heights. Drag to turn around it,
  Shift+drag (or right-drag) to pan, scroll or pinch to zoom. Doors and windows
  cut the walls at their own heights. The sidebar still edits the selected
  object. Press **3D** again to go back to the plan.
- **Walk** puts you at eye height (160 cm). Click the view to look with the
  mouse, or drag if the browser does not lock the pointer. `W` `A` `S` `D` or
  the arrow keys walk, Shift runs. Scroll or pinch makes the view wider or
  narrower. You cannot walk through walls or furniture, but you pass through a
  door gap and under a high shelf. The first `Esc` frees the mouse, the next one
  goes back to turning around the layout.
- On a touch screen you can look around in Walk by dragging, but walking needs
  a keyboard.

## File menu

- **Save layout** and **Load layout** write and read a `.json` file. See
  [Layout file](file-format.md).
- **Export SVG** and **Export PNG** save the plan the way print shows it, with
  no selection, handles or measure tape. `layout.svg` is 1:20 on paper and
  opens on its own. `layout.png` has about 2 px per cm.
- **Copy share link** puts the whole layout into a link. If the browser blocks
  the clipboard, the link shows in a box to copy by hand. Very long links may
  be cut off by some chat apps. Opening a link loads its layout as one undo
  step. If your browser already holds a layout of your own, Möbel asks first.
- **Print** prints the plan alone, scaled to fit the page.
- **Clear all** and **Reset to sample** start over.

## Touch screens

One finger works like the mouse: tap to select, drag an object to move it, drag
empty space to pan. Pinch with two fingers to zoom, and move both to pan. A
pinch that begins on an object leaves the object where it was. Handles and
buttons are bigger, and a finger grabs a wall, door or window even a little
outside its edge.

## Keyboard

- Arrow keys nudge (Shift = 1 cm), `R` rotates 90°.
- `X` (or `Del`) deletes, `D` (or `C`) duplicates, `Esc` deselects.
- `Ctrl/⌘+Z` undoes, `Ctrl/⌘+Shift+Z` (or `Ctrl+Y`) redoes, `Ctrl/⌘+A` selects
  all.
- `Ctrl/⌘+S` saves a `layout.json`.
- `M` turns the measure tape on and off.
- `?` lists all keys and touch gestures.
- In a Rearrange preview: `←` / `→` step through the layouts, `Enter` applies,
  `Esc` cancels. Editing keys do nothing and dragging only pans. `Ctrl/⌘+S`
  saves the layout being previewed.
