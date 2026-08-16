# Mock pages

Style a third-party app's page — write or adjust its `patches/*.css`, or check a `main.css`/component change against it — **without having the app (or a device) installed**. Snapshots live in `.dev/mocks/*.html` (git-ignored: large, device-specific, and they go stale). Served by `mock-pages-plugin` in `.dev/vite.config.ts`.

## The mock bar

Every HTML page the dev server hands out — proxied device pages and served snapshots alike — gets `scripts/mock-bar.client.js` (served at `/mocks/__bar.js`), a floating bottom-left bar in a Shadow DOM, so theme and patch CSS can neither restyle it nor be polluted by it.

On a device page it lists what `.dev/mocks/` holds, so the workflow is reachable without typing the `/mocks/` URL: `◆` appears when this page's `data-page` matches a snapshot and opens it in one click, `⊕` captures the open page, and an empty `.dev/mocks/` shrinks the bar to a lone `⊕`. Inside a snapshot it names the open one, steps through the rest, and `↩` goes back to the same page on the device. `✕` collapses it to a dot, remembered in `localStorage['shadcn.mockbar.collapsed']`.

The snapshot list is injected inline next to the script; both tags carry `data-shadcn-mock`, which is how a capture strips them back out — a snapshot must never bake in a list that is re-injected, current, on every serve.

## Capture

Open the page through the dev proxy and hit `⊕` on the mock bar — or press <kbd>Alt/Option+Shift+S</kbd>, or call `__shadcnMockCapture()`. It POSTs the live DOM to `/mocks/__save`, which writes `.dev/mocks/<data-page>.html` — doctype included, dev-only script tags stripped, custom-header gated so a foreign origin can't drive it. Hand-saved HTML works too; the filename is free, since a snapshot's identity is its `<body data-page>`.

**Capture from a device running _this_ theme — snapshots are not portable between themes.** A snapshot copies a rendered page verbatim, so it hard-codes the rendering theme in its stylesheet links (`/luci-static/shadcn/main.css` plus that page's patch), in the device's UCI token overrides inlined as `<style>`, and in the theme's own shell markup. A snapshot taken under `luci-theme-aurora` therefore renders **completely unstyled** here, since a dev server only serves its own `/luci-static/<theme>/` prefix; the tell is a terminal line naming the other theme's stylesheet (`[Mocks] miss /luci-static/aurora/main.css → 404 …`). Mirroring it under `mocks/static/`, which that generic hint suggests, is the wrong fix — re-capture on a shadcn device. Reusing a foreign snapshot regardless only makes sense for the app's own content region: repoint its stylesheet links at `shadcn`, and drop the inline `<style>`, whose captured tokens otherwise override this theme's.

## View

`pnpm dev`, then <http://localhost:5173/mocks/> — an index of every snapshot with its `data-page` and age. Each is served with the Vite HMR client injected, so editing `main.css`, a component, a `patches/*.css` or served JS full-reloads the open mock. Absolute `/luci-static/…` links resolve against this checkout and compile on the fly.

## Navigate

Inside a mock the bar also takes over clicks on the snapshot's own `/cgi-bin/luci/…` links, matching them to snapshots by `data-page` and jumping in place — an app's own tab bar works as it does on the device. Uncaptured targets are blocked with a hint naming the missing snapshot. The bar lists all snapshots and cycles with <kbd>[</kbd>/<kbd>]</kbd>; `↩` leaves for the real page, targeting the `requestpath` from LuCI's own inline bootstrap when that agrees with the snapshot's `data-page`, else falling back to splitting `data-page` (lossy when a segment contains a dash, `admin-status-disks-info`), then to the last device page visited in this tab.

## Third-party assets

Mirror an app's own css/js under `.dev/mocks/static/` following its URL (e.g. `.dev/mocks/static/luci-static/resources/foo/foo.css`); served as-is, no HMR. Misses requested by a mock page 404 instantly with a one-time terminal hint naming the mirror path, so mocks never hang on an unreachable router; anything else on `/luci-static` that falls through to the proxy is bounded to 5s → 504.

## No auth, no runtime

LuCI's runtime scripts (`luci.js`/`cbi.js`/`xhr.js`, `/cgi-bin/` endpoints) are stripped and `L`/`LuCI`/`XHR` stubbed, or LuCI would boot, poll, 403 and pop "Session expired". Framework-dependent theme JS (`menu-shadcn`, `sidebar-shadcn`) therefore no-ops — the captured DOM is already rendered, so the page still looks right; the theme's own inline scripts (dark mode, sidebar cache replay) still run.
