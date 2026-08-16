# On-demand page patches

Third-party LuCI app/page compatibility fixes live one file per page in `src/media/patches/<page>.css`, where `<page>` is the `[data-page="..."]` value (request path segments joined by `-`). They are **not** bundled into `main.css`; `header.ut` links only the ones that match the page being rendered.

## Plain CSS, by design

**Patches are the one place that writes plain CSS instead of `@apply`.** Each is its own Rollup entry, so `@reference "../main.css";` + `@apply` made every file carry its own `@property` boilerplate (7 patches: 6,491 B → 1,083 B once rewritten).

Write narrow `[data-page]`/class-scoped overrides with native declarations, still reaching for theme values through the `:root` custom properties (`var(--panel-bg)`, `var(--foreground-a30)`, `var(--shadow-sm)`, …) rather than hardcoded colours or magic numbers. A value a patch needs but `:root` doesn't expose gets added to `STRUCTURE` in `scripts/gen-tokens.js` (that is why `--shadow-sm` exists), not inlined. CSS Nesting still works, since it needs no Tailwind processing.

The `@reference` + `@apply` route still _compiles_ for theme-repo patches and has real upsides — build-time validation (a typo'd utility fails the build; a typo'd `var()` fails silently at runtime) and the shared `dark:`/`md:`/`hover:` vocabulary — native is the default for the size numbers above, not a hard gate. App-shipped patches bypass the build entirely and have always been plain-CSS-only.

Globally-applicable chrome tweaks (e.g. icon opacity) belong in `_shared.css`, not here.

## Discovery and matching

`vite.config.ts` builds each patch as its own Rollup entry → `htdocs/luci-static/shadcn/patches/<page>.css`.

`header.ut` discovers installed patches at render time via `fs.lsdir()` (no build-time allow-list) and matches them against the cumulative path-segment prefixes of the current page: a patch applies to its page and all subpages, matching only on real segment boundaries so a prefix never leaks onto a lookalike sibling app. All matching patches load (sorted, so a shorter/general name precedes a longer/specific one, which then cascades on top) — this also lets dynamically generated pages (e.g. one page per contact/device) be covered by a patch named after their fixed prefix.

Because discovery is at render time, **any package — not just the theme — may drop a `<page-prefix>.css` into `luci-static/shadcn/patches/`** and it takes effect immediately, no theme rebuild required.

`PATCH_ALIASES` in `vite.config.ts` can duplicate one built payload (CSS and JS) under several page names when unrelated pages share it. It is currently empty — the log viewer ships only `patches/admin-status-logs.js`, whose prefix covers both log tabs on every supported release; its CSS is core-page styling and lives in `components/_syslog.css` inside `main.css`, where the `.syslog-view` markup contract is deliberately global so other packages can reuse the viewer. `_`-prefixed files in `patches/` are `@import`-only fragments, never entries.

## JS payloads

The same `lsdir()` sweep loads `patches/<page>.js` as `<script defer>` after the patch stylesheets (theme-owned sources in `src/resource/patches/`, Terser-compressed to `shadcn/patches/`; third-party packages may drop plain scripts the same way).

A JS patch must register `window.shadcn.patches[<stem>] = { mount, unmount }` and mount itself once at eval: the [client-side router](router.md) drives it across same-document navigations and a plain script would otherwise keep running on pages that are gone. `header.ut` also emits every installed patch file as `body[data-patches]` and marks its own `<link>`/`<script>` tags `data-shadcn-patch` so the router can enable/disable them per page.

## Adding / removing a theme patch

Create the file, run `pnpm build`, verify the built file is small. Removal is symmetric — delete the file, rebuild.
