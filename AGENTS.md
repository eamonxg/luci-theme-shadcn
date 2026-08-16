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
