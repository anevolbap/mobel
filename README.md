# Möbel

A floor plan editor in the browser, to scale in centimetres. Möbel checks
whether your furniture fits and the room still works.

**Try it:** <https://anevolbap.github.io/mobel/>

- Draw rooms with walls, doors and windows, then place furniture.
- Each piece can show the free space it needs (clearance). That space turns red
  when something stands in it.
- **Rearrange** looks for furniture layouts where nothing is in the way.
- **Measure** checks the walking space, and **3D** lets you walk through the
  room.
- Save layouts as plain `.json` files, share them as a link, export SVG or PNG,
  or print.

The sample room has one red band: the bed stands too close to the wardrobe.
Select the room and press **Rearrange** to see layouts that fix it.

## Run

Open the link above. You can install it as an app from the browser, and it then
works offline.

To run it locally, download the repository and open `index.html` in a browser.
There is nothing to install or build.

## Non-goals

- No accounts and no server. Layouts stay in your browser, your files and the
  links you share.
- No build step and no dependencies. The app is plain files that run from
  `file://`.
- No furniture catalog with brand products. Pieces are boxes with a size, a
  height and clearance.
- No photo-real rendering. The 3D view is for checking space, not for looks.

## Documentation

- [User guide](docs/guide.md): every tool, the keys and touch gestures.
- [Layout file](docs/file-format.md): the saved JSON format.
- [How it works](docs/internals.md): code layout, Rearrange scoring, 3D.
- [Release](docs/release.md): how to publish a new version.
- [Contributing](CONTRIBUTING.md): tests and rules for pull requests.

## License

GPL-3.0-or-later, see `LICENSE`.
