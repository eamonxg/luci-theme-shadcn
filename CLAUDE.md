# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All dev commands run from `.dev/`:

```bash
cd .dev/
cp .env.example .env   # set VITE_OPENWRT_HOST / VITE_OPENWRT_SSH_HOST for proxy + .ut sync
pnpm dev      # Vite dev server (proxies LuCI to the router; optional scp of *.ut on save)
pnpm build    # Clean + build production assets to htdocs/luci-static/
pnpm clean    # Remove build output only
pnpm gen:tokens       # Regenerate src/media/_tokens.css from tokens/*.js
pnpm check:contrast   # Check muted text tokens meet WCAG AA contrast
```

`VITE_OPENWRT_HOST` defaults to `http://192.168.1.1`. Set `VITE_OPENWRT_SSH_HOST` (e.g. `root@192.168.1.1`) to scp `ucode/template/themes/shadcn/*.ut` to `/usr/share/ucode/luci/template/themes/shadcn/` whenever a `.ut` file changes; leave empty to disable. Optional `VITE_OPENWRT_SSH_KEY` for a dedicated private key.

No test suite or linter CLI. Prettier (with `prettier-plugin-tailwindcss`) runs on format-on-save and sorts `@apply`/class lists — don't hand-reorder them.

## Architecture

**Dual-layer build**: source in `.dev/` → OpenWrt-compatible output committed to `htdocs/luci-static/`.

- `.dev/src/media/main.css` → `htdocs/luci-static/shadcn/main.css`
- `.dev/src/media/login.css` → `htdocs/luci-static/shadcn/login.css`
- `.dev/src/resource/*.js` → `htdocs/luci-static/resources/*.js` — passed through terser (format only, no mangle/bundle); each file stays a standalone LuCI `L.require()`-able module
- `.dev/public/shadcn/` → `htdocs/luci-static/shadcn/` — icons/images copied as-is
- `ucode/template/themes/shadcn/*.ut` — server-side templates, not processed by Vite; only pushed to a device via the SSH dev plugin

`htdocs/` is generated output checked into git. Rebuild it with `pnpm build`, or trigger the manual `frontend-assets-build.yml` workflow, which builds and commits `htdocs/**`.

`vite.config.ts` plugins worth knowing about:

- `local-serve-plugin` — serves `main.css`/`login.css`/sidebar & menu JS at their `/luci-static/...` paths during `pnpm dev` and forces a full reload on change
- `ut-sync-plugin` — scp's changed `.ut` templates to the router over SSH (`VITE_OPENWRT_SSH_HOST`)
- `redirect-plugin` — redirects `/` to `/cgi-bin/luci` in dev
- `luci-js-compress` — runs `.dev/src/resource/*.js` through terser into `resources/`
- a custom PostCSS pass strips `@layer` at-rules, since LuCI's CSS pipeline doesn't support them

## CSS

Style with TailwindCSS v4 `@apply`, using CSS Nesting (`&:hover`, `&[disabled]`, `.parent &`, etc.) for scoped selectors — this is the dominant pattern across every component file. Fall back to raw CSS declarations only when `@apply` can't express the rule: custom properties, `@keyframes`/`animation`/`filter`, `clip-path`, `backdrop-filter`, and inline SVG data-URI backgrounds.

`main.css` import order is meaningful (later imports win the cascade): `_tokens.css` → `_base.css` → `_layout.css` → `components/_*.css` → `_utilities.css` → `_patches.css`. New component styles get their own `components/_name.css`, imported before `_utilities.css`/`_patches.css`.

- **Token source**: edit input colors in `tokens/defaults.js`, derivations and baked-alpha variants in `tokens/spec.js`, then run `pnpm gen:tokens`. Do not edit generated `src/media/_tokens.css` directly.
- **`_tokens.css`**: generated flat OKLCH custom properties for light and dark modes plus the shared `@theme inline` mapping. It is imported by both `main.css` and `login.css`; runtime token-based `color-mix()` and relative `oklch(from …)` are prohibited.
- **`login.css`**: separate Vite build entry for the login page; it does **not** import `main.css`, but re-imports the generated `_tokens.css`.
- **`_patches.css`**: scoped compatibility overrides for third-party LuCI app pages, keyed on the `[data-page="..."]` attribute that `header.ut` derives from the request path (or a unique class/id). Add overrides here rather than in component files; revisit when the upstream app's markup changes.
- Dark mode: `@custom-variant dark` keyed on `[data-darkmode=true]`, set by an inline script in `header.ut` before paint (reads `localStorage['shadcn.theme']`) to avoid a flash of the wrong theme.
- **Icons, two sources**: `.dev/src/assets/icons/` (Lucide SVGs) are referenced from CSS via the `@assets` alias as `mask-image`/`mask`, so they inherit `currentColor`; `.dev/public/shadcn/icons/` are SVGs referenced directly via `<img>`/JS (sidebar, menu, login, theme toggle) and copied verbatim to `htdocs/luci-static/shadcn/icons/`.

## Sidebar & Menu

- `header.ut`: minimal shell — empty `#sidebar` (like material's `#mainmenu`); sidebar chrome + nav are built client-side in `menu-shadcn.js`
- `sidebar-shadcn.js`: state machine for theme (light/dark/device), sidebar collapse/expand, accordion, and mobile drawer — exposed as `window.ShadcnSidebar` after the `shadcn-sidebar-ready` event fires
- `menu-shadcn.js`: resolves the `admin` branch of `ui.menu.load()`, then renders a two-level sidebar matching luci-theme-material's depth; `ICON_MAP` maps a LuCI menu node's `name` to `/shadcn/icons/*.svg`; deeper levels render as `#tabmenu`

## Releases

- `Makefile` (`PKG_VERSION` / `PKG_RELEASE`) is the OpenWrt package manifest, built via `feeds/luci/luci.mk`.
- `.github/workflows/build-theme.yml` builds `.ipk`/`.apk` via `eamonxg/build-luci-package` on version tags, pushes to `main`/`feat/**`, or when the commit message contains `[build]`.

## Key References

- Vite config: `.dev/vite.config.ts`
- Design tokens: `.dev/src/media/_tokens.css`
- Version: `PKG_VERSION` / `PKG_RELEASE` in `Makefile`
