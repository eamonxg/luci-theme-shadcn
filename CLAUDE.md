# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All dev commands run from `.dev/`:

```bash
cd .dev/
pnpm setup:router  # One-shot dev setup: all .env values (router IP, dev host/port) → .env, installs SSH key on device ([ip] to run non-interactively; safe to re-run after a reflash)
pnpm dev      # Vite dev server (proxies LuCI to the router; auto-syncs *.ut over SSH)
pnpm build    # Clean + build production assets to htdocs/luci-static/
pnpm clean    # Remove build output only
pnpm gen:tokens       # Regenerate src/media/_tokens.css from tokens/*.js
pnpm check:contrast   # Check muted text tokens meet WCAG AA contrast
```

All env vars are optional: `VITE_OPENWRT_HOST` is the bare router address (default `192.168.1.1`); the web proxy target and the `.ut`-sync SSH target (`root@<hostname>`) both derive from it — key selection etc. belongs in `~/.ssh/config`. `ucode/template/themes/shadcn/*.ut` is pushed whole to `/usr/share/ucode/luci/template/themes/shadcn/` on dev-server startup and on every save (tar over ssh stdin), and `/cgi-bin` page loads wait for in-flight pushes.

No test suite or linter CLI. Prettier (with `prettier-plugin-tailwindcss`) runs on format-on-save and sorts `@apply`/class lists — don't hand-reorder them.

## Architecture

**Dual-layer build**: source in `.dev/` → OpenWrt-compatible output committed to `htdocs/luci-static/`.

- `.dev/src/media/main.css` → `htdocs/luci-static/shadcn/main.css`
- `.dev/src/media/login.css` → `htdocs/luci-static/shadcn/login.css`
- `.dev/src/resource/*.js` → `htdocs/luci-static/resources/*.js` — passed through terser (compress + local-scope mangle, no bundling); each file stays a standalone LuCI `L.require()`-able module. Two terser options are load-bearing and must not be dropped: `compress.directives: false` keeps the leading `'require <dep>'` strings that LuCI's dependency scanner reads, and `mangle.toplevel: false` keeps top-level names (plus `parse.bare_returns` for the top-level `return`)
- `.dev/public/shadcn/` → `htdocs/luci-static/shadcn/` — icons/images copied as-is
- `ucode/template/themes/shadcn/*.ut` — server-side templates, not processed by Vite; only pushed to a device via the SSH dev plugin

`htdocs/` is generated output checked into git. Rebuild it with `pnpm build`, or trigger the manual `frontend-assets-build.yml` workflow, which builds and commits `htdocs/**`.

`vite.config.ts` plugins worth knowing about:

- `local-serve-plugin` — serves `main.css`/`login.css`/sidebar & menu JS at their `/luci-static/...` paths during `pnpm dev` and forces a full reload on change
- `ut-sync-plugin` — pushes the `.ut` template dir to the router over SSH (full push on startup + debounced push on save; `/cgi-bin` requests wait for pending pushes)
- `redirect-plugin` — redirects `/` to `/cgi-bin/luci` in dev
- `luci-js-compress` — runs `.dev/src/resource/*.js` through terser into `resources/`
- `mock-pages-plugin` — serves saved page snapshots at `/mocks/` against the live theme, and injects the mock bar into both those and proxied device pages (see **Mock Pages** below)

Built CSS keeps Tailwind's native `@layer` structure. Theme partials (`_base.css`, `components/*`, `_utilities.css`, …) are plain unlayered CSS — organization comes from the file split, never wrap rules in `@layer`. Unlayered partials outrank Tailwind's layered base/utilities regardless of specificity; the OKLCH tokens already gate browsers to ones with `@layer` support.

## Mock Pages

Style a third-party app's page — write or adjust its `patches/*.css`, or check a `main.css`/component change against it — **without having the app (or a device) installed**. Snapshots live in `.dev/mocks/*.html` (git-ignored: large, device-specific, and they go stale).

- **The mock bar**: every HTML page the dev server hands out — proxied device pages and served snapshots alike — gets `scripts/mock-bar.client.js` (served at `/mocks/__bar.js`), a floating bottom-left bar in a Shadow DOM, so theme and patch CSS can neither restyle it nor be polluted by it. On a device page it lists what `.dev/mocks/` holds, so the workflow is reachable without typing the `/mocks/` URL: `◆` appears when this page's `data-page` matches a snapshot and opens it in one click, `⊕` captures the open page, and an empty `.dev/mocks/` shrinks the bar to a lone `⊕`. Inside a snapshot it names the open one, steps through the rest, and `↩` goes back to the same page on the device. `✕` collapses it to a dot, remembered in `localStorage['shadcn.mockbar.collapsed']`. The snapshot list is injected inline next to the script; both tags carry `data-shadcn-mock`, which is how a capture strips them back out — a snapshot must never bake in a list that is re-injected, current, on every serve.
- **Capture**: open the page through the dev proxy and hit `⊕` on the mock bar — or press <kbd>Alt/Option+Shift+S</kbd>, or call `__shadcnMockCapture()`. It POSTs the live DOM to `/mocks/__save`, which writes `.dev/mocks/<data-page>.html` — doctype included, dev-only script tags stripped, custom-header gated so a foreign origin can't drive it. Hand-saved HTML works too; the filename is free, since a snapshot's identity is its `<body data-page>`.
- **Capture from a device running _this_ theme — snapshots are not portable between themes.** A snapshot copies a rendered page verbatim, so it hard-codes the rendering theme in its stylesheet links (`/luci-static/shadcn/main.css` plus that page's patch), in the device's UCI token overrides inlined as `<style>`, and in the theme's own shell markup. A snapshot taken under `luci-theme-aurora` therefore renders **completely unstyled** here, since a dev server only serves its own `/luci-static/<theme>/` prefix; the tell is a terminal line naming the other theme's stylesheet (`[Mocks] miss /luci-static/aurora/main.css → 404 …`). Mirroring it under `mocks/static/`, which that generic hint suggests, is the wrong fix — re-capture on a shadcn device. Reusing a foreign snapshot regardless only makes sense for the app's own content region: repoint its stylesheet links at `shadcn`, and drop the inline `<style>`, whose captured tokens otherwise override this theme's.
- **View**: `pnpm dev`, then <http://localhost:5173/mocks/> — an index of every snapshot with its `data-page` and age. Each is served with the Vite HMR client injected, so editing `main.css`, a component, a `patches/*.css` or served JS full-reloads the open mock. Absolute `/luci-static/…` links resolve against this checkout and compile on the fly.
- **Navigate**: inside a mock the bar also takes over clicks on the snapshot's own `/cgi-bin/luci/…` links, matching them to snapshots by `data-page` and jumping in place — an app's own tab bar works as it does on the device. Uncaptured targets are blocked with a hint naming the missing snapshot. The bar lists all snapshots and cycles with <kbd>[</kbd>/<kbd>]</kbd>; `↩` leaves for the real page, targeting the `requestpath` from LuCI's own inline bootstrap when that agrees with the snapshot's `data-page`, else falling back to splitting `data-page` (lossy when a segment contains a dash, `admin-status-disks-info`), then to the last device page visited in this tab.
- **Third-party assets**: mirror an app's own css/js under `.dev/mocks/static/` following its URL (e.g. `.dev/mocks/static/luci-static/resources/foo/foo.css`); served as-is, no HMR. Misses requested by a mock page 404 instantly with a one-time terminal hint naming the mirror path, so mocks never hang on an unreachable router; anything else on `/luci-static` that falls through to the proxy is bounded to 5s → 504.
- **No auth, no runtime**: LuCI's runtime scripts (`luci.js`/`cbi.js`/`xhr.js`, `/cgi-bin/` endpoints) are stripped and `L`/`LuCI`/`XHR` stubbed, or LuCI would boot, poll, 403 and pop "Session expired". Framework-dependent theme JS (`menu-shadcn`, `sidebar-shadcn`) therefore no-ops — the captured DOM is already rendered, so the page still looks right; the theme's own inline scripts (dark mode, sidebar cache replay) still run.

## CSS

Style with TailwindCSS v4 `@apply`, using CSS Nesting (`&:hover`, `&[disabled]`, `.parent &`, etc.) for scoped selectors — this is the dominant pattern across every component file. Fall back to raw CSS declarations only when `@apply` can't express the rule: custom properties, `@keyframes`/`animation`/`filter`, `clip-path`, `backdrop-filter`, and inline SVG data-URI backgrounds. The single deliberate exception is `patches/*.css`, which is plain CSS by design — see **On-demand patches** below.

`main.css` import order is meaningful (later imports win the cascade): `_tokens.css` → `_base.css` → `_layout.css` → `components/_*.css` → `_utilities.css` → `_shared.css`. New component styles get their own `components/_name.css`, imported before `_utilities.css`. Third-party app patches are **not** bundled into `main.css` — they load on demand per page (see **On-demand patches** below).

- **Token source**: edit input colors in `tokens/defaults.js`, derivations and baked-alpha variants in `tokens/spec.js`, then run `pnpm gen:tokens`. Do not edit generated `src/media/_tokens.css` directly.
- **`_tokens.css`**: generated flat OKLCH custom properties for light and dark modes plus the shared `@theme inline` mapping. It is imported by both `main.css` and `login.css`; runtime token-based `color-mix()` and relative `oklch(from …)` are prohibited.
- **`login.css`**: separate Vite build entry for the login page; it does **not** import `main.css`, but re-imports the generated `_tokens.css`.
- **On-demand patches**: third-party LuCI app/page compatibility fixes live one-file-per-page in `src/media/patches/<page>.css`, where `<page>` is the `[data-page="..."]` value (request path segments joined by `-`). **Patches are the one place that writes plain CSS instead of `@apply`** — each is its own Rollup entry, so `@reference "../main.css";` + `@apply` made every file carry its own `@property` boilerplate (7 patches: 6,491 B → 1,083 B once rewritten). Write narrow `[data-page]`/class-scoped overrides with native declarations, still reaching for theme values through the `:root` custom properties (`var(--panel-bg)`, `var(--foreground-a30)`, `var(--shadow-sm)`, …) rather than hardcoded colours or magic numbers. The `@reference` + `@apply` route still _compiles_ for theme-repo patches and has real upsides — build-time validation (a typo'd utility fails the build; a typo'd `var()` fails silently at runtime) and the shared `dark:`/`md:`/`hover:` vocabulary — native is the default for the size numbers above, not a hard gate. App-shipped patches bypass the build entirely and have always been plain-CSS-only. A value a patch needs but `:root` doesn't expose gets added to `STRUCTURE` in `scripts/gen-tokens.js` (that is why `--shadow-sm` exists), not inlined. CSS Nesting still works, since it needs no Tailwind processing. `vite.config.ts` builds each as its own Rollup entry → `htdocs/luci-static/shadcn/patches/<page>.css`. `header.ut` discovers installed patches at render time via `fs.lsdir()` (no build-time allow-list) and matches them against the cumulative path-segment prefixes of the current page: a patch applies to its page and all subpages, matching only on real segment boundaries so a prefix never leaks onto a lookalike sibling app. All matching patches load (sorted, so a shorter/general name precedes a longer/specific one, which then cascades on top) — this also lets dynamically generated pages (e.g. one page per contact/device) be covered by a patch named after their fixed prefix. Because discovery is at render time, any package — not just the theme — may drop a `<page-prefix>.css` into `luci-static/shadcn/patches/` and it takes effect immediately, no theme rebuild required. To add a theme patch: create the file, run `pnpm build`, verify the built file is small. Removal is symmetric — delete the file, rebuild. Globally-applicable chrome tweaks (e.g. icon opacity) belong in `_shared.css`, not here. The mechanism also carries **JS payloads**: the same `lsdir()` sweep loads `patches/<page>.js` as `<script defer>` after the patch stylesheets (theme-owned sources in `src/resource/patches/`, Terser-compressed to `shadcn/patches/`; third-party packages may drop plain scripts the same way). `PATCH_ALIASES` in `vite.config.ts` can duplicate one built payload (CSS and JS) under several page names when unrelated pages share it (currently empty — the log viewer ships only `patches/admin-status-logs.js`, whose prefix covers both log tabs on every supported release; its CSS is core-page styling and lives in `components/_syslog.css` inside `main.css`, where the `.syslog-view` markup contract is deliberately global so other packages can reuse the viewer); `_`-prefixed files in `patches/` are `@import`-only fragments, never entries.
- Dark mode: `@custom-variant dark` keyed on `[data-darkmode=true]`, set by an inline script in `header.ut` before paint (reads `localStorage['shadcn.theme']`) to avoid a flash of the wrong theme.
- **Icons, two sources**: `.dev/src/assets/icons/` (Lucide SVGs) are referenced from CSS via the `@assets` alias as `mask-image`/`mask`, so they inherit `currentColor`; `.dev/public/shadcn/icons/` are SVGs referenced directly via `<img>`/JS (sidebar, menu, login, theme toggle) and copied verbatim to `htdocs/luci-static/shadcn/icons/`.

## Sidebar & Menu

- `header.ut`: near-minimal shell — empty `#sidebar` plus a parser-blocking inline script right after it that replays the sidebar cache (see below) before first paint; sidebar chrome + nav are otherwise built client-side in `menu-shadcn.js`
- `sidebar-shadcn.js`: state machine for theme (light/dark/device), sidebar collapse/expand, accordion, and mobile drawer — exposed as `window.ShadcnSidebar` after the `shadcn-sidebar-ready` event fires
- `menu-shadcn.js`: resolves the `admin` branch of `ui.menu.load()`, then renders a two-level sidebar; `ICON_MAP` maps a LuCI menu node's `name` to `/shadcn/icons/*.svg`; deeper levels render as `#tabmenu`
- **Sidebar cache (anti-flash)**: `menu-shadcn.js` snapshots `#sidebar.innerHTML` + scroll position into `sessionStorage['shadcn.sidebar.cache']` (`{v, lang, html, scroll}`) after render and on `pagehide`. The `header.ut` inline script replays it pre-paint on the next navigation, recomputes the active highlight for the current URL (longest link-path prefix — keep in sync with menu-shadcn's dispatchpath matching), restores accordion/scroll state, and sets `data-shadcn-built` / `data-shadcn-restored` on `#sidebar`. When restored, `renderSidebarChrome` only re-syncs the hostname, and `renderSidebarNav` preserves accordion/scroll across its authoritative rebuild. Restored HTML loses inline JS handlers (`innerHTML` serialization), so anything that must work before the re-render needs a delegated listener — e.g. the logout click in `header.ut`, which clears the cache and sets `window.shadcnSuppressSidebarCache` so the `pagehide` re-cache stays suppressed. Bump `v` whenever the sidebar markup changes shape. Cross-document `@view-transition` rules live in `components/_view-transitions.css` (only `#sidebar` gets its own snapshot group — the topbar must not, or its top-layer snapshot escapes `.content-card`'s rounded-corner clipping during transitions); they assume the cache keeps the sidebar's first frame populated.

## Releases

- `Makefile` (`PKG_VERSION` / `PKG_RELEASE`) is the OpenWrt package manifest, built via `feeds/luci/luci.mk`.
- `.github/workflows/build-theme.yml` builds `.ipk`/`.apk` via `eamonxg/build-luci-package` on version tags, pushes to `main`/`feat/**`, or when the commit message contains `[build]`.

## Key References

- Vite config: `.dev/vite.config.ts`
- Design tokens: `.dev/src/media/_tokens.css`
- Version: `PKG_VERSION` / `PKG_RELEASE` in `Makefile`
