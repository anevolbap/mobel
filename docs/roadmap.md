# Roadmap

Ideas for future versions. Each one keeps the [Non-goals](../README.md#non-goals):
no server, no dependencies, no build step, runs from `file://`, and the layout
file only gains fields.

Cost: **S** is a few hours, **M** a day or two, **L** a larger change.

## Quick wins

- **Wall lengths on the plan (S).** Show the inner length of each room wall
  next to it, like a real floor plan. Print and export get them for free.
- **Problem list (S).** A panel that lists every red clearance band, piece in
  a door swing and piece in front of a window. Click a line to select the
  piece. The checks already exist in `core.js` and `rearrange.js`.
- **Door swing clash in the plan (S).** Draw the swing arc red when a piece
  stands in it. Today only Rearrange knows about it.
- **Shorter share links (S).** Drop fields that equal the type default before
  compressing, and fill them back on load. Same file format, shorter links.
- **Piece list (S).** A table of all pieces with size and room, to copy or save
  as CSV. Handy before buying or moving.

## Plan editing

- **Text notes (S).** A `note` type with a label and no footprint, for things
  like "radiator" or "socket". New type, so old files still load.
- **Passage (S).** A door without a leaf and swing. Two rooms edge to edge plus
  a passage make an L-shaped or open-plan space.
- **Align and distribute (M).** Line up the selected pieces on an edge or
  centre, or space them evenly.
- **Copy and paste between layouts (S).** Put the selected objects on the
  clipboard as layout JSON, paste them into another tab.
- **Round pieces (M).** A `round` flag for tables and rugs. Drawing is easy,
  but collision and Rearrange treat them as their box.
- **Exact collision at any angle (M).** Replace the bounding box with a rotated
  rectangle test in `core.js`. Today a piece at 45° blocks more space than it
  really takes.

## Checks and Rearrange

- **Walking space overlay (M).** Colour the floor by how wide the free path is,
  from the grid Rearrange already builds. Shows narrow spots under 60 cm.
- **Rearrange in a worker (M).** The search runs on the main thread and freezes
  the page for up to 5 s. A worker built from a `Blob` keeps the page alive and
  can show progress. Must check it still works from `file://` in all three
  browsers.
- **Rotated rooms in Rearrange (M).** Work in the room's own frame, then turn
  the result back.
- **Simple wishes (L).** Soft goals like "desk near a window" or "bed not
  facing the door", as extra score terms in `RA`.

## Layouts

- **Variants (M).** Keep two to five versions of the same flat in one file and
  switch between them, or view two side by side. Adds a `variants` field.
- **Background image (M).** Load a scanned floor plan, set its scale by
  measuring one known wall, and trace over it. The image stays in the browser;
  saving it in the file is optional because it makes files large.
- **My pieces (S).** Save a piece (size, height, clearance, colour) as a
  preset in the Add menu. Stored in `localStorage` and in the layout file. Not
  a brand catalog.

## 3D

- **Save 3D view as PNG (S).** One call on the WebGL canvas.
- **Eye height setting (S).** Walk at the height of a child or a wheelchair
  user, not only 160 cm.

## Reach

- **Inches and feet (M).** A display setting only. The file stays in cm, so
  no format change.
- **Translations (M).** Move UI strings into one table in a separate file.
  Start with German and Spanish.

## Code health

- **Split `index.html` (M).** At about 1600 lines it holds the state, the UI
  and the drawing. Move the plan drawing and the input handling into their own
  plain `<script src>` files, so they can be tested like `core.js`.
- **Browser smoke test in CI (M).** A Playwright test that runs the browser
  check list. It is a dev tool only, the app keeps zero dependencies. Needs a
  decision, because it is the first dependency in the repository.
