# Build & dev server

**Dual-layer build**: source in `.dev/` → OpenWrt-compatible output committed to `htdocs/luci-static/`.

| source                              | output                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `.dev/src/media/main.css`           | `htdocs/luci-static/shadcn/main.css`                                                   |
| `.dev/src/media/login.css`          | `htdocs/luci-static/shadcn/login.css`                                                  |
| `.dev/src/resource/*.js`            | `htdocs/luci-static/resources/*.js` (`menu-shadcn`, `sidebar-shadcn`, `router-shadcn`) |
| `.dev/src/media/patches/*`          | `htdocs/luci-static/shadcn/patches/*` (see [patches.md](patches.md))                   |
| `.dev/public/shadcn/`               | `htdocs/luci-static/shadcn/` — icons/images copied as-is                               |
| `ucode/template/themes/shadcn/*.ut` | not processed by Vite; pushed to a device via the SSH dev plugin                       |

`htdocs/` is generated output checked into git. Rebuild it with `pnpm build`, or trigger the manual `frontend-assets-build.yml` workflow, which builds and commits `htdocs/**`.

## Terser options that are load-bearing

`.dev/src/resource/*.js` goes through terser (compress + local-scope mangle, no bundling); each file stays a standalone LuCI `L.require()`-able module. Two options must not be dropped:

- `compress.directives: false` — keeps the leading `'require <dep>'` strings that LuCI's dependency scanner reads;
- `mangle.toplevel: false` — keeps top-level names (plus `parse.bare_returns` for the top-level `return`).

## Dev-server environment

All env vars are optional. `VITE_OPENWRT_HOST` is the bare router address (default `192.168.1.1`); the web proxy target and the `.ut`-sync SSH target (`root@<hostname>`) both derive from it — key selection etc. belongs in `~/.ssh/config`.

`ucode/template/themes/shadcn/*.ut` is pushed whole to `/usr/share/ucode/luci/template/themes/shadcn/` on dev-server startup and on every save (tar over ssh stdin), and `/cgi-bin` page loads wait for in-flight pushes.

`pnpm setup:router` writes all of that to `.env` and installs the SSH key on the device in one shot (`pnpm setup:router <ip>` to run non-interactively; safe to re-run after a reflash).

## `vite.config.ts` plugins

- `local-serve-plugin` — serves `main.css`/`login.css`/sidebar, menu & router JS at their `/luci-static/...` paths during `pnpm dev` and forces a full reload on change
- `ut-sync-plugin` — pushes the `.ut` template dir to the router over SSH (full push on startup + debounced push on save; `/cgi-bin` requests wait for pending pushes)
- `redirect-plugin` — redirects `/` to `/cgi-bin/luci` in dev
- `luci-js-compress` — runs `.dev/src/resource/*.js` through terser into `resources/`
- `mock-pages-plugin` — serves saved page snapshots at `/mocks/` against the live theme, and injects the mock bar into both those and proxied device pages (see [mock-pages.md](mock-pages.md))

## Tests & formatting

No linter CLI; the only tests are `.dev/tests/*.test.js` (plain `node:test`, no deps), run with `pnpm test`. Prettier (with `prettier-plugin-tailwindcss`) runs on format-on-save and sorts `@apply`/class lists — don't hand-reorder them.

## Releases

- `Makefile` (`PKG_VERSION` / `PKG_RELEASE`) is the OpenWrt package manifest, built via `feeds/luci/luci.mk`.
- `.github/workflows/build-theme.yml` builds `.ipk`/`.apk` via `eamonxg/build-luci-package` on version tags, pushes to `main`/`feat/**`, or when the commit message contains `[build]`.
