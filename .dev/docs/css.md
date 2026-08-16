# CSS conventions

Style with TailwindCSS v4 `@apply`, using CSS Nesting (`&:hover`, `&[disabled]`, `.parent &`, etc.) for scoped selectors — this is the dominant pattern across every component file. Fall back to raw CSS declarations only when `@apply` can't express the rule: custom properties, `@keyframes`/`animation`/`filter`, `clip-path`, `backdrop-filter`, and inline SVG data-URI backgrounds. The single deliberate exception is `patches/*.css`, plain CSS by design — see [patches.md](patches.md).

## Import order

`main.css` import order is meaningful (later imports win the cascade): `_tokens.css` → `_base.css` → `_layout.css` → `components/_*.css` → `_utilities.css` → `_shared.css`. New component styles get their own `components/_name.css`, imported before `_utilities.css`. Third-party app patches are **not** bundled into `main.css` — they load on demand per page.

Built CSS keeps Tailwind's native `@layer` structure. Theme partials (`_base.css`, `components/*`, `_utilities.css`, …) are plain unlayered CSS — organization comes from the file split, never wrap rules in `@layer`. Unlayered partials outrank Tailwind's layered base/utilities regardless of specificity; the OKLCH tokens already gate browsers to ones with `@layer` support.

## Tokens

- **Token source**: the engine and resolver (operators, `createResolver`, CSS emission helpers) come from `@eamonxg/luci-theme-tokens` (`/engine`, `/emit`); this repo only keeps `tokens/spec.js` (derivations, baked-alpha variants) + `tokens/defaults.js` (input colors). Edit those, then run `pnpm gen:tokens`. Do not edit generated `src/media/_tokens.css` directly.
- **`_tokens.css`**: generated flat OKLCH custom properties for light and dark modes plus the shared `@theme inline` mapping. It is imported by both `main.css` and `login.css`; runtime token-based `color-mix()` and relative `oklch(from …)` are prohibited.
- **`login.css`**: separate Vite build entry for the login page; it does **not** import `main.css`, but re-imports the generated `_tokens.css`.

## Dark mode

`@custom-variant dark` keyed on `[data-darkmode=true]`, set by an inline script in `header.ut` before paint (reads `localStorage['shadcn.theme']`) to avoid a flash of the wrong theme.

## Icons, two sources

- `.dev/src/assets/icons/` (Lucide SVGs) are referenced from CSS via the `@assets` alias as `mask-image`/`mask`, so they inherit `currentColor`.
- `.dev/public/shadcn/icons/` are SVGs referenced directly via `<img>`/JS (sidebar, menu, login, theme toggle) and copied verbatim to `htdocs/luci-static/shadcn/icons/`.
