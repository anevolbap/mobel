# Contributing

## Run and test

Open `index.html` in a browser. There is nothing to install or build.

Run the tests with Node 18 or newer:

```bash
node --test test/*.test.mjs
```

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
  [browser check](README.md#browser-check-before-a-release) and say in the pull
  request which browsers you tried.
- If you change the layout file, only add fields. Old files must keep loading
  (see [Layout file](README.md#layout-file)).

## License

Möbel is GPL-3.0-or-later. By sending a pull request you agree that your
change is published under the same license.
