# AGENTS.md

Guidance for coding agents working in this repository.

## Commands

All build and verification commands run from `.dev/` (using `pnpm`):

```bash
cd .dev
pnpm test             # Run unit tests (node:test in tests/*.test.js)
pnpm build            # Clean, gen tokens, check contrast, vite build, check colors
pnpm gen:tokens       # Regenerate src/media/_tokens.css from tokens/*.js
pnpm check:contrast   # Check text tokens meet WCAG AA contrast
pnpm check:colors     # Validate built CSS token references
pnpm format:check     # Prettier check
pnpm dev              # Vite dev server (proxies LuCI, auto-syncs *.ut over SSH)
```

## Dual-Layer Architecture & Git Boundaries

- **Source**: `.dev/src/` (`media/` for CSS, `resource/` for JS), `.dev/tokens/`, `.dev/public/`.
- **Build Output**: `htdocs/luci-static/` is **generated output committed to git**. Rebuild with `pnpm build` in `.dev/`; never edit `htdocs/` by hand.
- **Server Templates**: `ucode/template/themes/shadcn/*.ut` (Ucode templates) are server-side and not processed by Vite.

## Rules & Constraints

- **CSS & Nesting**: TailwindCSS v4 `@apply` + CSS Nesting. Fall back to raw CSS only where `@apply` cannot express the rule (custom properties, keyframes, clip-path). Never wrap theme partials in `@layer`.
- **Tokens**: Do not edit `.dev/src/media/_tokens.css` directly. Edit `.dev/tokens/spec.js` / `defaults.js` and run `pnpm gen:tokens`.
- **Page Patches**: Third-party page fixes in `.dev/src/media/patches/<page>.css` (and `.dev/src/resource/patches/<page>.js`) compile to separate entrypoints loaded on demand by `header.ut`. Patches write **plain CSS**, not `@apply`.
- **JS Bundling / Terser**: `.dev/src/resource/*.js` are standalone LuCI modules. Terser must retain directives (`compress.directives: false`) and top-level names (`mangle.toplevel: false`) for LuCI's scanner and `L.require()`.
- **Client-Side Router & Sidebar**: Router (`router-shadcn.js` via `@eamonxg/luci-theme-devkit`) intercepts same-document view swaps via Navigation API. Sidebar cache (`sessionStorage['shadcn.sidebar.cache']`) replays pre-paint in `header.ut` to prevent flash; bump cache version `v` whenever sidebar DOM structure changes.

## Documentation Index (`.dev/docs/`)

- [build.md](.dev/docs/build.md) — Output map, terser rules, dev server, CI/release flow
- [css.md](.dev/docs/css.md) — Import cascade, Tailwind v4 tokens, dark mode, Lucide icon sources
- [patches.md](.dev/docs/patches.md) — On-demand per-page patch architecture and plain-CSS rule
- [router.md](.dev/docs/router.md) — Navigation API router lifecycle, gates (expiry, poison), teardown contract
- [sidebar.md](.dev/docs/sidebar.md) — Client-side menu, pre-paint cache replay, view transitions
- [mock-pages.md](.dev/docs/mock-pages.md) — Styling third-party pages without device via snapshot mocks
