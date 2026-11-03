# Navigation loading — 0.6.2 (2026-11-04)

The footer starts the menu and router modules in parallel. The router still
waits for the menu instance and `ui.menu.load()` before registering navigation
handlers. LuCI caches the pending promise for both its module loader and menu
request, so this removes the menu → router download dependency without adding
an `/admin/menu` request.

The header retains LuCI's standard translation script before `cbi.js`.
The optional catalog-directory probe was removed to keep template logic small
and avoid maintaining a separate decision about whether translations exist.

The pre-paint menu snapshot is scoped to language, user, session and theme
asset version. It is not reused after `ui.menu.flushCache()` invalidates the
LuCI session's menu. Logging out or returning to login clears the snapshot.

## Shared runtime integration

The theme pins `@eamonxg/luci-theme-devkit` to the published npm version
`0.3.2`. The lockfile records its registry integrity; no local dependency
patch or sibling checkout is required.

From the theme repository's `.dev/` directory, use the pnpm version pinned
by `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Shared runtime changes belong in the devkit repository. Publish the updated
npm package first, then update the theme dependency and lockfile before
rebuilding production assets.

The bounded dependency prewarmer brings the generated router from 15,771 B
to 17,806 B raw, or from 5,840 B to 6,618 B with Node gzip defaults. The router budget is now
18 KiB. Independent CSS, menu, sidebar and font budgets are unchanged.
The increase is 2,035 B raw and 778 B with Node gzip defaults.
The prewarmer fetches source without evaluating it, limits parallel requests,
honors reduced-data connections and retries failed fetches. Pointer hover
immediately fetches only the root view source; a 65 ms hover dwell then permits
dependency expansion. Keyboard `:focus-visible` may start deep warming directly.
Template shell prefetch always waits for that dwell. Pointer-down cancels the
pending timer without starting another fetch, and mouse focus starts no warmup.
A warmup generation counter lets the next intent retry after failures or a
navigation clears queued requests.
Template routes
with query parameters or wildcard arguments retain full document navigation;
template shells are cached by both template name and pathname. See the shared
devkit's maintained router documentation for the exact behavior.

## Validation

- Tests execute the footer with a never-resolving menu promise to verify the
  router download starts immediately, and remains disabled without the
  Navigation API.
- Cache tests cover identity/version mismatches and LuCI menu invalidation.
- Ordinary production builds use the published npm package. Both theme routers are
  17,806 B, SHA-256 `c18a6f9b3a2f9b551ac7d7ee55560fdaec16901bfca9da3c9ff0dfc42a35973b`.
- Device timing and template checks are recorded in the devkit performance
  report for this coordinated change; local unit timings are not device load
  timings.

Shadcn renders its sidebar chrome and enables delegated controls while the
menu tree is still loading. Only navigation items wait for the authoritative
menu. The replay cache schema is version 2 (`{v, stamp, html, scroll}`).

The combined admin budget increases only by the router allowance delta:
217,500 + (18,432 − 16,000) = 219,932 B. A delayed-menu test verifies chrome
and the ready event are available before the response arrives.

The shadcn suite passed all 26 tests after the frozen install and ordinary rebuild;
color/contrast build checks also pass. Combined admin assets are 219,373 B
(budget 219,932 B). The menu asset is 17,007 B, two bytes smaller than before.
