# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Keep this file short. Anything that needs more than a few lines belongs in `.dev/docs/` and is linked from here.

## Commands

All dev commands run from `.dev/`:

```bash
cd .dev/
pnpm setup:router     # One-shot dev setup: .env values + SSH key on the device (safe to re-run after a reflash)
pnpm dev              # Vite dev server (proxies LuCI to the router; auto-syncs *.ut over SSH)
pnpm build            # Clean + build production assets to htdocs/luci-static/
pnpm clean            # Remove build output only
pnpm gen:tokens       # Regenerate src/media/_tokens.css from tokens/*.js
pnpm check:contrast   # Check muted text tokens meet WCAG AA contrast
pnpm test             # node --test tests/*.test.js (router resolver, gates, contract)
```

## Layout

**Dual-layer build**: source in `.dev/` → OpenWrt-compatible output committed to `htdocs/luci-static/`. `htdocs/` is generated; rebuild it with `pnpm build`, never hand-edit it. Server-side templates (`ucode/template/themes/shadcn/*.ut`) are not processed by Vite.

Details — output map, load-bearing terser options, dev-server env, Vite plugins, release workflow: **[.dev/docs/build.md](.dev/docs/build.md)**.

## Rules that bite if ignored

- **CSS**: TailwindCSS v4 `@apply` + CSS Nesting everywhere; raw declarations only where `@apply` can't express the rule. `main.css` import order is the cascade order. Never wrap theme partials in `@layer`. Don't edit generated `src/media/_tokens.css` — edit `tokens/*.js` and run `pnpm gen:tokens`. → **[.dev/docs/css.md](.dev/docs/css.md)**
- **Page patches**: per-page third-party fixes in `src/media/patches/<page>.css` (+ optional `<page>.js`), discovered at render time by `header.ut`, not bundled into `main.css`. This is the one place that writes **plain CSS**, not `@apply`. → **[.dev/docs/patches.md](.dev/docs/patches.md)**
- **Client-side router**: `router-shadcn.js` turns navigation between LuCI **view** pages into same-document swaps via the Navigation API; every other case (call/cbi/function pages, no API, a poisoned document, an expired session) stays a full load. **Read the doc before touching navigation, teardown, page-scoped patches, `header.ut`'s `<head>`, or `#maincontent`'s scroll** — it depends on template hooks (`data-shadcn-shell`, `body[data-asset-version]`, `body[data-patches]`, `#maincontent[tabindex=-1]`) and on `menu-shadcn.js` keeping `syncRoute()`/`closeSurfaces()` working. Budget: 15 KB built. → **[.dev/docs/router.md](.dev/docs/router.md)**
- **Sidebar & menu**: built client-side in `menu-shadcn.js`; `header.ut` replays a `sessionStorage` cache pre-paint to avoid a flash. Bump the cache `v` whenever the sidebar markup changes shape. → **[.dev/docs/sidebar.md](.dev/docs/sidebar.md)**
- **Mock pages**: style a third-party app's page without having the app or a device — snapshots in `.dev/mocks/`, served at `/mocks/`. Snapshots are not portable between themes. → **[.dev/docs/mock-pages.md](.dev/docs/mock-pages.md)**

## Key references

- Vite config: `.dev/vite.config.ts`
- Design tokens: `.dev/src/media/_tokens.css` (generated), `.dev/tokens/*.js` (source)
- Version: `PKG_VERSION` / `PKG_RELEASE` in `Makefile`
