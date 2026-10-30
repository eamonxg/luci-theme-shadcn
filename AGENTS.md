# AGENTS.md

Guidance for coding agents working in this repository.

**Read [CLAUDE.md](CLAUDE.md) — it is the single source of truth** (commands, layout, and the rules that bite if ignored). It is not Claude-specific; this file used to be a hand-kept copy of it and drifted.

Deep dives live in `.dev/docs/`:

- [build.md](.dev/docs/build.md) — build output map, terser options, dev-server env, Vite plugins, releases
- [css.md](.dev/docs/css.md) — `@apply` conventions, import order, tokens, dark mode, icons
- [patches.md](.dev/docs/patches.md) — on-demand per-page patches (CSS + JS)
- [router.md](.dev/docs/router.md) — the client-side router; read before touching navigation
- [sidebar.md](.dev/docs/sidebar.md) — sidebar/menu rendering and the anti-flash cache
- [mock-pages.md](.dev/docs/mock-pages.md) — styling third-party pages without a device

## Key Agent Constraints

When fixing UI or adding styles:

- **Core LuCI vs. Patches**: Official LuCI pages (such as `admin/status`, `admin/network`, `admin/system`) and shared LuCI markup structures (like `.cbi-section`, `.ifacebox`) are **core LuCI**, not third-party packages. Never create a page patch (`src/media/patches/`) for them. Locate the corresponding component under `src/media/components/` (e.g. `_card.css`, `_table.css`) and fix it in core CSS.
- **Unified Breakpoints**: Do not write ad-hoc raw `@media` queries with arbitrary pixel values (e.g. `@media (max-width: 900px)`). Use TailwindCSS standard responsive variants (`max-md:`, `md:`) to keep mobile and desktop breakpoints unified across the theme.
- **CSS Authoring**: Always use TailwindCSS v4 `@apply` and CSS nesting in `src/media/components/`. Plain CSS is strictly restricted to `src/media/patches/`.
