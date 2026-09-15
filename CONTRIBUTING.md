# Contributing

## Run and test

Open `index.html` in a browser. There is nothing to install or build.

Run the tests with Node 18 or newer:

```bash
node --test test/*.test.mjs
```

CI runs the tests on Node 18 and 24, on every push and pull request. The tests
load `core.js` and `rearrange.js` the same way the page does, cut the 3D scene
builder out of `view3d.js` and the sample layout out of `index.html`, and check
the results with their own box math. The drawing and the pointer interaction
have no automated tests.

[How it works](docs/internals.md) explains the code.

## Rules

- One change per pull request. A bug fix and a new feature go in two pull
  requests.
- No dependencies and no build step. The app must keep working when you open
  `index.html` from `file://`.
- Match the style of the code around your change.
- Read the [Non-goals](README.md#non-goals) before you start a new feature.
- If you change `core.js`, `rearrange.js` or the 3D scene code, add or update a
  test.
- If you change the page, run the
  [browser check](docs/release.md#browser-check) and say in the pull
  request which browsers you tried.
- If you change the layout file, only add fields. Old files must keep loading
  (see [Layout file](docs/file-format.md)).

## License

Möbel is GPL-3.0-or-later. By sending a pull request you agree that your
change is published under the same license.
