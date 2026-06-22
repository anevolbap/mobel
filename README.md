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

- **Add ▾** places a wall, door, window, tall window, bookshelf or furniture at the view centre.
- Drag empty space to pan; scroll to zoom toward the cursor; **Fit** frames everything.
- Click to select; drag to move; drag the corner handle to resize; drag the round knob to rotate.
- Edit the exact label, type, position, size, rotation and colour in the sidebar.
- Doors show a swing arc; **Flip swing** changes the hinge. Orientation follows width vs height.
- The selected object shows its `W×H` in centimetres.
- **Snap 5 cm** toggles grid snapping.

### Keyboard

- Arrow keys nudge (Shift = 1 cm), `R` rotates 90°.
- `Del` removes, `Ctrl/⌘+D` duplicates, `Esc` deselects.
- `Ctrl/⌘+S` saves a `layout.json`; **File ▾ → Load** restores one.

## Notes

World coordinates are centimetres; all cm→px mapping goes through the single
`#viewport` transform. State lives in one `state` object and `render()` rebuilds
the SVG from it. Everything is an axis-aligned rectangle.
