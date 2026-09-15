# Release

The site on GitHub Pages is built from `main`, so a push to `main` publishes.

1. Change `VERSION` in `sw.js` (for example `mobel-1` to `mobel-2`). Browsers
   see that `sw.js` changed, cache the new files under the new name and delete
   the old cache. Without the change, the offline copy keeps the old files.
2. If you added a file the app loads, add it to `FILES` in `sw.js`.
3. Run the tests: `node --test test/*.test.mjs`.
4. Run the browser check below.

## Browser check

The tests do not cover the page itself, so check it by hand. Do it in Firefox,
in Chrome, and in Safari on iOS, both from `file://` and from the Pages site.

- [ ] The page opens with no errors in the console.
- [ ] Add a piece, then drag, resize and rotate it.
- [ ] A clearance band turns red when a piece stands in it.
- [ ] Rearrange on a room: step with Prev and Next, and Apply one. Run it
  again and Cancel.
- [ ] 3D turns around the layout, and Walk moves with the keys.
- [ ] On a phone: tap, drag, and pinch to zoom.
- [ ] Export SVG and Export PNG save files that look like the plan.
- [ ] Copy share link, then open the link in another browser.
- [ ] Print shows the plan alone.
- [ ] From Pages: install the app, go offline, and open it.
- [ ] `VERSION` in `sw.js` has a new value.
