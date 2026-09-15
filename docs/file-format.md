# Layout file

Files saved by version 2 or later keep loading in later versions of Möbel.
Later versions change the format only by adding fields: a field in a saved file
keeps its name and its meaning.

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

## Fields

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

## Loading rules

A missing or broken field falls back to a safe value: 0 for the position, the
type's default for size, height, colour, clearance and wall. A number that is
not finite counts as broken. Other numbers are kept in range: `w`, `h`, `z`,
`height`, `wall` and each `clear` side go up to 10000 cm (100 m), and `x`, `y`
stay between -100000 and 100000 cm (1 km).

Every object needs its own `id`. If two objects share an id, the first keeps
it and the other gets a new one above the highest id in the file. An object
with no id gets a new one too.

A file without `"app": "moebel"` or without an `objects` array is refused with
a message. A file with a higher `version` still loads, but a message warns that
fields this version does not know were dropped and will not be saved.

## Older versions

- Version 5 objects pick up their type's `z` and `height`.
- Rooms from files older than version 4 pick up the default 15 cm walls.
- A version 4 `clear: 80, face: "S"` becomes `clear: {N: 0, E: 0, S: 80, W: 0}`.

`test/fixtures` holds one file per old version, and the tests check that each
one still loads.
