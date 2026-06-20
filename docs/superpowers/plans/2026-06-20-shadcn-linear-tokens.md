# shadcn Linear Token Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin luci-theme-shadcn to Linear's look (lavender accent, cool-blue low-chroma grays, product-level dark canvas) using a flat-token generator ported from aurora, with zero runtime color computation (`color-mix()` / `oklch(from …)` → 0 in built CSS), across light/dark + follow-device.

**Architecture:** A Node generator (`tokens/` + `scripts/gen-tokens.js`, colorjs.io math) resolves a small set of per-mode input colors into a flat `_tokens.css` (base tokens + baked-alpha tokens + `@theme inline`). Component CSS keeps its existing token names and only swaps Tailwind opacity modifiers (`bg-primary/15`) for baked-alpha utilities (`bg-primary-a15`). login.css relative-color calls become the same alpha tokens.

**Tech Stack:** Node ESM, colorjs.io, TailwindCSS v4 (`@theme inline`), lightningcss, Vite.

## Global Constraints

- All dev commands run from `luci-theme-shadcn/.dev/`. Build = `pnpm build`; generate = `pnpm gen:tokens`.
- `_tokens.css` becomes a GENERATED file — never hand-edit after Task 6; edit `tokens/` inputs and re-run `pnpm gen:tokens`.
- No raw color computation in shipped CSS: built `htdocs/luci-static/shadcn/main.css` and `login.css` must contain zero `color-mix(` and zero `oklch(from`.
- Keep every existing consumer token name (`--color-primary`, `--color-background`, `--color-sidebar-*`, `--color-destructive`, …) so component files need only mechanical edits.
- Style with TailwindCSS v4 `@apply` + CSS nesting (existing convention). Prettier (with prettier-plugin-tailwindcss) runs on save — do not hand-reorder class lists.
- Dark mode keyed on `[data-darkmode="true"]`; default `device` (follow system) stays as-is.
- License header style on new source files matches existing files (Apache-2.0, `eamonxg <eamonxiong@gmail.com>`).
- Linear lavender primary = `oklch(0.567 0.158 275)`. Dark canvas = product-level `oklch(0.159 0.005 264)` (not near-black #010102).
- Commit after every task. This repo commits to `main` (established workflow). Commit message footer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

- `.dev/tokens/engine.js` — colorjs.io math ops (copied verbatim from aurora).
- `.dev/tokens/resolve.js` — derivation resolver (copied verbatim from aurora).
- `.dev/tokens/defaults.js` — editable per-mode input colors (Linear-derived).
- `.dev/tokens/spec.js` — `DERIVATIONS` (per-mode derived colors), `ALPHAS` (per-base alpha lists), `FIXED` (shadows).
- `.dev/scripts/gen-tokens.js` — emits `.dev/src/media/_tokens.css`.
- `.dev/src/media/_tokens.css` — GENERATED (`:root` + `[data-darkmode="true"]` + `@theme inline`).
- `.dev/src/media/_patches.css` — gains the icon-filter rules moved out of `_tokens.css`.
- `.dev/src/media/main.css`, `login.css` — drop their `@theme inline` blocks (now in `_tokens.css`).
- `.dev/src/media/components/*.css`, `_layout.css` — opacity modifiers → alpha utilities.
- `ucode/template/themes/shadcn/header.ut` — anti-flash inline `<style>` colors synced.

---

## Task 1: Add colorjs.io dependency and wire generation scripts

**Files:**
- Modify: `.dev/package.json`

**Interfaces:**
- Produces: `pnpm gen:tokens` script (runs `node scripts/gen-tokens.js`); `build` runs `gen:tokens` before `vite build`.

- [ ] **Step 1: Inspect current scripts/deps**

Run: `cd luci-theme-shadcn/.dev && cat package.json`
Note the exact `"scripts"` and `"devDependencies"` blocks.

- [ ] **Step 2: Install colorjs.io as a dev dependency**

Run: `cd luci-theme-shadcn/.dev && pnpm add -D colorjs.io`
Expected: `package.json` gains `"colorjs.io"` under `devDependencies`; `pnpm-lock.yaml` updates.

- [ ] **Step 3: Add the `gen:tokens` script and chain it into `build`**

In `.dev/package.json` `"scripts"`, set `build` to run generation first and add `gen:tokens`:

```json
    "build": "pnpm clean && pnpm gen:tokens && vite build",
    "gen:tokens": "node scripts/gen-tokens.js",
```

Keep all other scripts unchanged. (If the existing `build` differs, preserve its `clean`/`vite build` parts and only insert `pnpm gen:tokens &&` before `vite build`.)

- [ ] **Step 4: Verify the script is registered**

Run: `cd luci-theme-shadcn/.dev && pnpm run 2>&1 | grep -E "gen:tokens|build"`
Expected: both `gen:tokens` and `build` listed.

- [ ] **Step 5: Commit**

```bash
cd luci-theme-shadcn
git add .dev/package.json .dev/pnpm-lock.yaml
git commit -m "build: add colorjs.io and gen:tokens script for flat token generation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Port aurora's token math engine and resolver

**Files:**
- Create: `.dev/tokens/engine.js`
- Create: `.dev/tokens/resolve.js`

**Interfaces:**
- Produces: `mix(a,b,p)`, `shade(a,dl)`, `set(a,L,Ch)`, `alpha(a,p)`, `konst(s)`, `toOklch(v)` from `engine.js`; `resolveTokens(mode, inputs)` and `resolveMode(mode)` from `resolve.js` (returns `{name: oklchString}`).
- Consumes: `spec.js` `DERIVATIONS` and `defaults.js` `DEFAULTS` (created in Tasks 3–4).

- [ ] **Step 1: Create `engine.js` (verbatim from aurora)**

```js
import Color from "colorjs.io";

const C = (v) => (v instanceof Color ? v : new Color(v));

// color-mix(in oklab, a p%, b) => position toward b is (1 - p)
export const mix = (a, b, p) =>
  Color.mix(C(a), C(b), 1 - p, { space: "oklab", outputSpace: "oklch" });

export const shade = (a, dl) => {
  const c = C(a).to("oklch");
  c.coords[0] += dl;
  return c;
};

export const set = (a, L, Ch) => {
  const c = C(a).to("oklch");
  c.coords[0] = L;
  c.coords[1] = Ch;
  return c;
};

export const alpha = (a, p) => {
  const c = C(a).to("oklch");
  c.alpha = p;
  return c;
};

export const konst = (s) => C(s).to("oklch");

// Serialize a Color (or string) to an oklch() literal -- no color-mix / var().
export const toOklch = (v) =>
  C(v).to("oklch").toString({ precision: 4, format: "oklch" });
```

- [ ] **Step 2: Create `resolve.js` (verbatim from aurora)**

```js
import { DERIVATIONS } from "./spec.js";
import { DEFAULTS } from "./defaults.js";
import { mix, shade, set, alpha, konst, toOklch } from "./engine.js";

// inputs: {name: oklchString}. Returns flat {name: oklchString} values.
export function resolveTokens(mode, inputs) {
  const derivs = DERIVATIONS[mode];
  const resolved = { ...inputs };

  const ref = (name) => {
    if (resolved[name] === undefined) compute(name);
    return resolved[name];
  };

  function compute(name) {
    const rule = derivs[name];
    if (!rule) throw new Error(`unknown derived token: ${name}`);
    const [op, ...args] = rule;
    let color;
    switch (op) {
      case "mix":
        color = mix(ref(args[0]), ref(args[1]), args[2]);
        break;
      case "shade":
        color = shade(ref(args[0]), args[1]);
        break;
      case "set":
        color = set(ref(args[0]), args[1], args[2]);
        break;
      case "alpha":
        color = alpha(ref(args[0]), args[1]);
        break;
      case "const":
        if (args[0].startsWith("var:")) {
          resolved[name] = ref(args[0].slice(4));
          return;
        }
        color = konst(args[0]);
        break;
      default:
        throw new Error(`unknown op: ${op}`);
    }
    resolved[name] = toOklch(color);
  }

  for (const name of Object.keys(derivs)) compute(name);
  return resolved;
}

export const resolveMode = (mode) =>
  resolveTokens(mode, { ...DEFAULTS[mode] });
```

- [ ] **Step 3: Commit**

```bash
cd luci-theme-shadcn
git add .dev/tokens/engine.js .dev/tokens/resolve.js
git commit -m "feat: port aurora OKLCH token engine and resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(`engine.js`/`resolve.js` will throw on import until `spec.js`/`defaults.js` exist — created next. No standalone test here; the smoke test runs in Task 5.)

---

## Task 3: Author input colors (defaults.js)

**Files:**
- Create: `.dev/tokens/defaults.js`

**Interfaces:**
- Produces: `DEFAULTS = { light: {...}, dark: {...} }`, each a flat `{name: oklchString}` of the 10 input colors: `bg, surface, text, brand, on_brand, success, warning, danger, info, overlay_base`.

- [ ] **Step 1: Create `defaults.js`**

```js
// Editable input colors per mode. Everything else is derived in spec.js.
// Linear palette: lavender brand oklch(0.567 0.158 275); product-level dark
// canvas oklch(0.159 0.005 264); cool low-chroma grays (hue ~264-275).
export const DEFAULTS = {
  light: {
    bg: "oklch(0.985 0.004 275)",
    surface: "oklch(1 0 0)",
    text: "oklch(0.18 0.02 275)",
    brand: "oklch(0.567 0.158 275)",
    on_brand: "oklch(1 0 0)",
    success: "oklch(0.58 0.15 150)",
    warning: "oklch(0.70 0.13 75)",
    danger: "oklch(0.55 0.20 25)",
    info: "oklch(0.58 0.13 250)",
    overlay_base: "oklch(0 0 0)",
  },
  dark: {
    bg: "oklch(0.159 0.005 264)",
    surface: "oklch(0.205 0.004 264)",
    text: "oklch(0.978 0.002 264)",
    brand: "oklch(0.567 0.158 275)",
    on_brand: "oklch(1 0 0)",
    success: "oklch(0.637 0.175 147)",
    warning: "oklch(0.80 0.12 80)",
    danger: "oklch(0.63 0.16 25)",
    info: "oklch(0.70 0.10 250)",
    overlay_base: "oklch(0 0 0)",
  },
};
```

- [ ] **Step 2: Sanity-check it parses**

Run: `cd luci-theme-shadcn/.dev && node -e "import('./tokens/defaults.js').then(m=>console.log(Object.keys(m.DEFAULTS.light).length, Object.keys(m.DEFAULTS.dark).length))"`
Expected: `10 10`

- [ ] **Step 3: Commit**

```bash
cd luci-theme-shadcn
git add .dev/tokens/defaults.js
git commit -m "feat: add Linear-derived input colors for shadcn tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Author derivations and alpha map (spec.js)

**Files:**
- Create: `.dev/tokens/spec.js`

**Interfaces:**
- Produces: `DERIVATIONS = { light: {...}, dark: {...} }` (every consumer token not in inputs); `ALPHAS = { "<base-kebab>": [int...] }`; `FIXED = { light: {...}, dark: {...} }` (shadow literals). Derived token keys are snake_case; ALPHAS keys are kebab-case matching emitted CSS var names.

- [ ] **Step 1: Create `spec.js`**

```js
// Operators: ['mix',a,b,p] ['shade',a,dl] ['set',a,L,C] ['alpha',a,p] ['const',str]
// 'const','var:x' aliases token x. All values resolve to flat oklch() literals.
const common = {
  // Aliases to inputs (keep consumer names stable)
  background: ["const", "var:bg"],
  foreground: ["const", "var:text"],
  primary: ["const", "var:brand"],
  primary_foreground: ["const", "var:on_brand"],
  panel_bg: ["const", "var:surface"],
  destructive: ["const", "var:danger"],
  ring: ["const", "var:brand"],
  input: ["const", "var:border"],
  sidebar_bg: ["const", "var:bg"],
  sidebar_foreground: ["const", "var:text"],
  sidebar_accent_fg: ["const", "var:text"],
  sidebar_hover_bg: ["const", "var:sidebar_accent"],
  login_path_stroke: ["const", "var:brand"],
  progress_bar_end: ["const", "var:brand"],
  // Fixed foreground literals
  destructive_fg: ["const", "oklch(1 0 0)"],
  success_fg: ["const", "oklch(1 0 0)"],
  info_fg: ["const", "oklch(1 0 0)"],
  warning_fg: ["const", "oklch(0.20 0.05 75)"],
  terminal_foreground: ["const", "oklch(0.85 0.08 155)"],
  // Shared derived
  muted_foreground: ["mix", "text", "bg", 0.5],
  secondary_foreground: ["mix", "text", "bg", 0.85],
  sidebar_muted: ["mix", "text", "bg", 0.48],
  focus_ring: ["alpha", "brand", 0.5],
};

export const DERIVATIONS = {
  light: {
    ...common,
    muted: ["shade", "bg", -0.035],
    secondary: ["shade", "bg", -0.05],
    label_surface: ["shade", "bg", -0.022],
    border: ["mix", "text", "bg", 0.13],
    panel_border: ["const", "var:border"],
    primary_hover: ["shade", "brand", 0.06],
    sidebar_accent: ["shade", "bg", -0.04],
    sidebar_active_bg: ["alpha", "brand", 0.12],
    sidebar_active_fg: ["shade", "brand", -0.08],
    sidebar_border: ["const", "var:border"],
    terminal_bg: ["const", "oklch(0.14 0.02 264)"],
    progress_bar_start: ["mix", "brand", "surface", 0.6],
    login_left_bg: ["shade", "bg", -0.05],
  },
  dark: {
    ...common,
    muted: ["shade", "bg", 0.03],
    secondary: ["shade", "surface", 0.02],
    label_surface: ["shade", "surface", -0.01],
    border: ["mix", "text", "bg", 0.16],
    panel_border: ["alpha", "text", 0.08],
    primary_hover: ["shade", "brand", 0.06],
    sidebar_accent: ["shade", "surface", 0.025],
    sidebar_active_bg: ["alpha", "brand", 0.14],
    sidebar_active_fg: ["shade", "brand", 0.22],
    sidebar_border: ["alpha", "text", 0.08],
    terminal_bg: ["const", "oklch(0.12 0.02 264)"],
    progress_bar_start: ["mix", "brand", "surface", 0.6],
    login_left_bg: ["const", "oklch(0.10 0.02 264)"],
  },
};

// Baked-alpha variants. Each base (resolved per mode) is emitted at each alpha
// as a flat oklch(L C H / a) literal -> replaces Tailwind /NN opacity modifiers.
export const ALPHAS = {
  primary: [5, 15, 25, 60, 90],
  destructive: [10, 20, 30, 40, 50, 60, 70, 80, 90],
  secondary: [80],
  muted: [30, 80],
  "muted-foreground": [70],
  success: [10, 15, 40, 80],
  warning: [10, 15, 30, 40],
  info: [10, 15, 30, 40, 80],
  border: [60, 80],
  input: [30],
  "label-surface": [50],
  "overlay-base": [50, 60],
  background: [60],
  ring: [50],
};

// Mode-specific shadow literals, emitted verbatim.
export const FIXED = {
  light: {
    app_shadow_sm: "0 1px 3px oklch(0 0 0 / 0.06), 0 1px 2px oklch(0 0 0 / 0.04)",
    app_shadow_md: "0 4px 16px oklch(0 0 0 / 0.08), 0 1px 3px oklch(0 0 0 / 0.04)",
    app_shadow_lg: "0 12px 32px oklch(0 0 0 / 0.12)",
  },
  dark: {
    app_shadow_sm: "0 4px 12px oklch(0 0 0 / 0.3)",
    app_shadow_md: "0 10px 28px oklch(0 0 0 / 0.42)",
    app_shadow_lg: "0 20px 48px oklch(0 0 0 / 0.55)",
  },
};
```

- [ ] **Step 2: Verify resolver produces all consumer tokens with no errors**

Run:
```bash
cd luci-theme-shadcn/.dev && node -e "
import('./tokens/resolve.js').then(({resolveMode})=>{
  const r=resolveMode('light');
  const need=['primary','primary-foreground','background','foreground','muted','muted-foreground','border','input','ring','panel-bg','panel-border','sidebar-bg','sidebar-foreground','sidebar-muted','sidebar-accent','sidebar-accent-fg','sidebar-active-bg','sidebar-active-fg','sidebar-hover-bg','sidebar-border','secondary','secondary-foreground','label-surface','overlay-base','terminal-bg','terminal-foreground','destructive','destructive-fg','success','success-fg','warning','warning-fg','info','info-fg','progress-bar-start','progress-bar-end','login-left-bg','login-path-stroke'].map(k=>k.replace(/-/g,'_'));
  const missing=need.filter(k=>r[k]===undefined);
  console.log(missing.length? 'MISSING: '+missing.join(','): 'OK all present');
  console.log('sample primary=',r.primary,'border=',r.border);
});"
```
Expected: `OK all present` and `oklch(...)` samples (no `color-mix`, no `var(`).

- [ ] **Step 3: Commit**

```bash
cd luci-theme-shadcn
git add .dev/tokens/spec.js
git commit -m "feat: add token derivations and baked-alpha map

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Move icon-filter rules out of `_tokens.css` into `_patches.css`

**Files:**
- Modify: `.dev/src/media/_tokens.css:98-126` (remove icon-filter rules)
- Modify: `.dev/src/media/_patches.css` (append the rules)

**Interfaces:**
- Produces: a `_tokens.css` whose only content is tokens (safe to overwrite by the generator in Task 6); icon-filter behavior preserved in `_patches.css`.

- [ ] **Step 1: Append the icon-filter rules to `_patches.css`**

Add this block to the end of `.dev/src/media/_patches.css` (verbatim from current `_tokens.css` lines 98–126):

```css
/* Lucide SVGs as <img> ship with black strokes; parent color does not apply */
.card-header img,
.login-input-icon img,
img.shadcn-icon {
  filter: brightness(0) saturate(100%);
  opacity: 0.65;
}

html[data-darkmode="true"] .card-header img,
html[data-darkmode="true"] .login-input-icon img {
  filter: brightness(0) saturate(100%) invert(1);
}

#sidebar img.shadcn-icon {
  filter: brightness(0) saturate(100%);
  opacity: 0.65;
}

html[data-darkmode="true"] #sidebar img.shadcn-icon {
  filter: brightness(0) saturate(100%) invert(1);
  opacity: 0.7;
}

.card-header button:hover img,
#sidebar .sidebar-nav-item.active img,
#sidebar .sidebar-accordion-item.active img,
#sidebar .sidebar-nav-parent:hover img {
  opacity: 1;
}
```

- [ ] **Step 2: Verify the rules now live in `_patches.css`**

Run: `cd luci-theme-shadcn && grep -c "img.shadcn-icon" .dev/src/media/_patches.css`
Expected: `2` (or more) — rules present.

- [ ] **Step 3: Commit (the old `_tokens.css` copy is removed by Task 6's generation)**

```bash
cd luci-theme-shadcn
git add .dev/src/media/_patches.css
git commit -m "refactor: move icon-filter rules from _tokens.css to _patches.css

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Write the generator and regenerate `_tokens.css`

**Files:**
- Create: `.dev/scripts/gen-tokens.js`
- Modify (overwrite, generated): `.dev/src/media/_tokens.css`

**Interfaces:**
- Consumes: `resolveMode` (Task 2), `FIXED`, `ALPHAS` (Task 4).
- Produces: `_tokens.css` with `:root { light base + light alpha + structure }`, `[data-darkmode="true"] { dark base + dark alpha }`, `@theme inline { color map for every base + alpha token, font, radius }`.

- [ ] **Step 1: Create `gen-tokens.js`**

```js
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import Color from "colorjs.io";
import { resolveMode } from "../tokens/resolve.js";
import { FIXED, ALPHAS } from "../tokens/spec.js";

const kebab = (s) => s.replace(/_/g, "-");
const snake = (s) => s.replace(/-/g, "_");

const withAlpha = (oklchStr, pct) => {
  const c = new Color(oklchStr).to("oklch");
  c.alpha = pct / 100;
  return c.toString({ precision: 4, format: "oklch" });
};

function alphaTokens(resolved) {
  const out = {};
  for (const [base, list] of Object.entries(ALPHAS)) {
    const val = resolved[snake(base)];
    if (val === undefined) throw new Error(`ALPHAS base not resolved: ${base}`);
    for (const a of list) out[`${base}-a${a}`] = withAlpha(val, a);
  }
  return out;
}

function block(selector, ...maps) {
  const lines = [];
  for (const m of maps)
    for (const [k, v] of Object.entries(m)) lines.push(`  --${kebab(k)}: ${v};`);
  return `${selector} {\n${lines.join("\n")}\n`;
}

const light = resolveMode("light");
const dark = resolveMode("dark");
const lightA = alphaTokens(light);
const darkA = alphaTokens(dark);

const STRUCTURE = `
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
  --radius-base: 0.5rem;
`;

const themeColors = [...Object.keys(light), ...Object.keys(lightA)]
  .map((k) => `  --color-${kebab(k)}: var(--${kebab(k)});`)
  .join("\n");

const THEME = `@theme inline {
${themeColors}

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);

  --radius-sm: calc(var(--radius-base) * 0.5);
  --radius: calc(var(--radius-base) * 0.75);
  --radius-md: var(--radius-base);
  --radius-lg: calc(var(--radius-base) * 1.5);
  --radius-xl: calc(var(--radius-base) * 2);
  --radius-full: 9999px;
}
`;

const HEADER = `/**
 * luci-theme-shadcn: design tokens -- GENERATED, DO NOT EDIT.
 * Run \`pnpm gen:tokens\`. Source: tokens/defaults.js + tokens/spec.js
 * All color values are flat oklch() literals; no color-mix / oklch(from ...).
 * ORDER MATTERS: [data-darkmode="true"] must stay after :root.
 */
`;

const css =
  HEADER +
  "\n" +
  block(":root", light, lightA, { __struct__: "" }).replace(
    "  --__struct__: ;\n",
    STRUCTURE,
  ) +
  "}\n\n" +
  block('[data-darkmode="true"]', dark, darkA) +
  "}\n\n" +
  THEME;

await writeFile(
  resolve(import.meta.dirname, "../src/media/_tokens.css"),
  css,
  "utf-8",
);
console.log("gen-tokens: wrote src/media/_tokens.css");
```

> Note: the `__struct__` placeholder trick injects the non-color `STRUCTURE` lines inside `:root` after the color tokens. If you prefer, replace that `.replace(...)` line by concatenating `block(":root", light, lightA)` (without the trailing `}`) + `STRUCTURE` directly — functionally identical.

- [ ] **Step 2: Generate**

Run: `cd luci-theme-shadcn/.dev && pnpm gen:tokens`
Expected: `gen-tokens: wrote src/media/_tokens.css`

- [ ] **Step 3: Verify the generated file is flat and complete**

Run:
```bash
cd luci-theme-shadcn/.dev && \
echo "color-mix: $(grep -c 'color-mix' src/media/_tokens.css)" && \
echo "oklch(from: $(grep -c 'oklch(from' src/media/_tokens.css)" && \
echo "has primary-a15: $(grep -c -- '--primary-a15' src/media/_tokens.css)" && \
echo "has color-primary-a15: $(grep -c -- '--color-primary-a15' src/media/_tokens.css)" && \
echo "darkmode block: $(grep -c 'data-darkmode' src/media/_tokens.css)"
```
Expected: `color-mix: 0`, `oklch(from: 0`, `has primary-a15: 2` (root + dark), `has color-primary-a15: 1`, `darkmode block: 1`.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add .dev/scripts/gen-tokens.js .dev/src/media/_tokens.css
git commit -m "feat: generate flat _tokens.css with baked-alpha tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Remove the `@theme inline` block from `main.css`

**Files:**
- Modify: `.dev/src/media/main.css:18-55` (delete the `@theme inline { ... }` block)

**Interfaces:**
- Consumes: `@theme inline` now provided by `_tokens.css` (imported at `main.css:9`).

- [ ] **Step 1: Delete the entire `@theme inline { ... }` block in `main.css`**

Remove lines from `@theme inline {` through its closing `}` (currently lines 18–55, ending with the `--font-sans: 'Inter', ...;` line and `}`). Leave the surrounding `@import`, `@custom-variant`, and `@plugin` lines intact. The import of `_tokens.css` (line 9) must remain.

- [ ] **Step 2: Verify only `_tokens.css` now defines `@theme inline`**

Run: `cd luci-theme-shadcn && grep -rn "@theme inline" .dev/src/media/main.css`
Expected: no output (zero matches in main.css).

- [ ] **Step 3: Build to confirm utilities still resolve**

Run: `cd luci-theme-shadcn/.dev && pnpm build 2>&1 | tail -3`
Expected: `✓ built` with no Tailwind "unknown utility" errors.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add .dev/src/media/main.css .dev/../luci-theme-shadcn/htdocs/luci-static/shadcn/main.css 2>/dev/null; git add -A
git commit -m "refactor: drop main.css @theme block (now generated in _tokens.css)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Remove the `@theme inline` block from `login.css`

**Files:**
- Modify: `.dev/src/media/login.css:14-22` (delete the `@theme inline { ... }` block)

**Interfaces:**
- Consumes: `@theme inline` from `_tokens.css` (imported at `login.css:11`).

- [ ] **Step 1: Delete the `@theme inline { ... }` block in `login.css`**

Remove the block from `@theme inline {` through its closing `}` (currently lines 14–22). Keep the `@import "./_tokens.css";` and `@custom-variant` lines.

- [ ] **Step 2: Verify**

Run: `cd luci-theme-shadcn && grep -rn "@theme inline" .dev/src/media/login.css`
Expected: no output.

- [ ] **Step 3: Build**

Run: `cd luci-theme-shadcn/.dev && pnpm build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add -A
git commit -m "refactor: drop login.css @theme block (now generated in _tokens.css)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Replace opacity modifiers in badge, button, dropdown

**Files:**
- Modify: `.dev/src/media/components/_badge.css:5-8`
- Modify: `.dev/src/media/components/_button.css:27,31,40,46,53`
- Modify: `.dev/src/media/components/_dropdown.css:62`

**Interfaces:**
- Consumes: alpha utilities from `_tokens.css` (`bg-info-a15`, `bg-primary-a15`, etc.).

- [ ] **Step 1: Apply these exact substitutions (replace `/NN` modifier with `-aNN` suffix on the color name)**

`_badge.css`:
- `bg-info/15` → `bg-info-a15`
- `bg-warning/15` → `bg-warning-a15` (both occurrences)
- `bg-success/15` → `bg-success-a15`

`_button.css`:
- `bg-secondary/80` → `bg-secondary-a80`
- `bg-muted/80` → `bg-muted-a80`
- `bg-primary/90` → `bg-primary-a90`
- `bg-primary/15` → `bg-primary-a15`
- `bg-primary/25` → `bg-primary-a25`
- `border-primary/25` → `border-primary-a25`
- `bg-destructive/90` → `bg-destructive-a90`

`_dropdown.css`:
- `bg-primary/15` → `bg-primary-a15`

- [ ] **Step 2: Verify no leftover modifiers in these three files**

Run: `cd luci-theme-shadcn && grep -rnE "/[0-9]+" .dev/src/media/components/_badge.css .dev/src/media/components/_button.css .dev/src/media/components/_dropdown.css | grep -E "(bg|text|border|ring)-[a-z-]+/[0-9]"`
Expected: no output.

- [ ] **Step 3: Build**

Run: `cd luci-theme-shadcn/.dev && pnpm build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add -A
git commit -m "refactor: use baked-alpha tokens in badge/button/dropdown

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Replace opacity modifiers in form, input, message

**Files:**
- Modify: `.dev/src/media/components/_form.css:4,48,57`
- Modify: `.dev/src/media/components/_input.css:12,28`
- Modify: `.dev/src/media/components/_message.css:8,11,15,19`

**Interfaces:**
- Consumes: alpha utilities from `_tokens.css`.

- [ ] **Step 1: Apply these exact substitutions**

`_form.css`:
- `border-destructive/70` → `border-destructive-a70`
- `ring-destructive/40` → `ring-destructive-a40`
- `bg-primary/5` → `bg-primary-a5`
- `border-primary/60` → `border-primary-a60`
- `bg-muted/30` → `bg-muted-a30`
- `border-border/80` → `border-border-a80`

`_input.css`:
- `text-muted-foreground/70` → `text-muted-foreground-a70` (both occurrences, lines 12 and 28)

`_message.css`:
- `bg-success/10` → `bg-success-a10`; `border-success/30` → `border-success-a30`
- `bg-info/10` → `bg-info-a10`; `border-info/30` → `border-info-a30`
- `bg-warning/10` → `bg-warning-a10`; `border-warning/30` → `border-warning-a30`
- `bg-destructive/10` → `bg-destructive-a10`; `border-destructive/30` → `border-destructive-a30`

- [ ] **Step 2: Verify no leftover modifiers in these three files**

Run: `cd luci-theme-shadcn && grep -rnE "(bg|text|border|ring)-[a-z-]+/[0-9]" .dev/src/media/components/_form.css .dev/src/media/components/_input.css .dev/src/media/components/_message.css`
Expected: no output.

- [ ] **Step 3: Build**

Run: `cd luci-theme-shadcn/.dev && pnpm build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add -A
git commit -m "refactor: use baked-alpha tokens in form/input/message

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Replace opacity modifiers in modal, table, tabs, tooltip, layout

**Files:**
- Modify: `.dev/src/media/components/_modal.css:6,22,26,31,51,52,53,56`
- Modify: `.dev/src/media/components/_table.css:43`
- Modify: `.dev/src/media/components/_tabs.css:12,16,20`
- Modify: `.dev/src/media/components/_tooltip.css:3,6,9,12,15`
- Modify: `.dev/src/media/_layout.css:327`

**Interfaces:**
- Consumes: alpha utilities from `_tokens.css`.

- [ ] **Step 1: Apply these exact substitutions**

`_modal.css`:
- `bg-overlay-base/60` → `bg-overlay-base-a60`
- `bg-background/60` → `bg-background-a60` (all three occurrences: lines 22, 26, 56)
- `bg-destructive/20` → `bg-destructive-a20`; `border-destructive/60` → `border-destructive-a60`
- `bg-success/80` → `bg-success-a80`
- `bg-destructive/80` → `bg-destructive-a80`
- `bg-info/80` → `bg-info-a80`

`_table.css`:
- `bg-label-surface/50` → `bg-label-surface-a50`

`_tabs.css`:
- `border-destructive/50` → `border-destructive-a50`
- `ring-ring/50` → `ring-ring-a50`
- `bg-input/30` → `bg-input-a30`

`_tooltip.css`:
- `border-border/60` → `border-border-a60`
- `border-destructive/40` → `border-destructive-a40`
- `border-success/40` → `border-success-a40`
- `border-info/40` → `border-info-a40`
- `border-warning/40` → `border-warning-a40`

`_layout.css`:
- `bg-black/50` → `bg-overlay-base-a50`

- [ ] **Step 2: Repo-wide verify: zero opacity modifiers remain in source**

Run: `cd luci-theme-shadcn && grep -rnE "(bg|text|border|ring|from|to|fill|stroke|shadow|outline)-[a-z-]+/[0-9]+" .dev/src/media`
Expected: no output.

- [ ] **Step 3: Build**

Run: `cd luci-theme-shadcn/.dev && pnpm build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add -A
git commit -m "refactor: use baked-alpha tokens in modal/table/tabs/tooltip/layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Replace `oklch(from …)` relative-color in login.css

**Files:**
- Modify: `.dev/src/media/login.css:96-97,129-130,147,151-152`

**Interfaces:**
- Consumes: alpha utilities/vars from `_tokens.css` (`--primary-a20`, `--primary-a10`, `--destructive-a30`, `--destructive-a8`?, `--foreground-a5`?).

> Two needed alphas are not yet in `ALPHAS`: `foreground` at 5%, `destructive` at 8%, `primary` at 70%. Add them so the login replacements use baked tokens.

- [ ] **Step 1: Extend `ALPHAS` in `tokens/spec.js` for the login alphas**

In `tokens/spec.js`, update these `ALPHAS` entries:
- `primary: [5, 15, 25, 60, 90]` → `primary: [5, 10, 15, 20, 25, 60, 70, 90]`
- `destructive: [10, 20, 30, 40, 50, 60, 70, 80, 90]` → add `8`: `destructive: [8, 10, 20, 30, 40, 50, 60, 70, 80, 90]`
- add new entry `foreground: [5],`

- [ ] **Step 2: Regenerate tokens**

Run: `cd luci-theme-shadcn/.dev && pnpm gen:tokens`
Expected: `gen-tokens: wrote src/media/_tokens.css`

- [ ] **Step 3: Replace the relative-color declarations in `login.css`**

Replace each raw declaration with the matching CSS var (these are plain CSS properties, not `@apply` — use `var(--…)`):

- Line 96 `border: 1px solid oklch(from var(--primary) l c h / 0.2);` → `border: 1px solid var(--primary-a20);`
- Line 97 `background-color: oklch(from var(--primary) l c h / 0.1);` → `background-color: var(--primary-a10);`
- Line 129 `border-color: oklch(from var(--destructive) l c h / 0.3);` → `border-color: var(--destructive-a30);`
- Line 130 `background-color: oklch(from var(--destructive) l c h / 0.08);` → `background-color: var(--destructive-a8);`
- Line 147 `background-color: oklch(from var(--foreground) l c h / 0.05);` → `background-color: var(--foreground-a5);`
- Line 151 `border-color: oklch(from var(--primary) l c h / 0.7);` → `border-color: var(--primary-a70);`
- Line 152 `background-color: oklch(from var(--primary) l c h / 0.1);` → `background-color: var(--primary-a10);`

- [ ] **Step 4: Verify no relative-color remains in source**

Run: `cd luci-theme-shadcn && grep -rn "oklch(from" .dev/src/media`
Expected: no output.

- [ ] **Step 5: Build**

Run: `cd luci-theme-shadcn/.dev && pnpm build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
cd luci-theme-shadcn
git add -A
git commit -m "refactor: replace login.css relative-color with baked-alpha tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Sync the anti-flash inline style in header.ut

**Files:**
- Modify: `ucode/template/themes/shadcn/header.ut:31`

**Interfaces:**
- Consumes: the generated light/dark `--background` values (light `oklch(0.985 0.004 275)`, dark `oklch(0.159 0.005 264)`).

- [ ] **Step 1: Read the current anti-flash style and the new background values**

Run: `cd luci-theme-shadcn && sed -n '31p' ucode/template/themes/shadcn/header.ut && grep -m1 -- '--background:' .dev/src/media/_tokens.css && grep -A40 'data-darkmode' .dev/src/media/_tokens.css | grep -m1 -- '--background:'`
Note the two `oklch(...)` values (light then dark).

- [ ] **Step 2: Update the hardcoded colors to match the new canvas**

Replace the inline `<style>` on `header.ut:31` so the light value matches the new `:root` `--background` and the dark value matches the `[data-darkmode="true"]` `--background`:

```html
<style>html{background:oklch(0.985 0.004 275)}html[data-darkmode=true]{background:oklch(0.159 0.005 264)}</style>
```

(If the resolved values from Step 1 differ slightly due to precision, use the exact strings emitted in `_tokens.css`.)

- [ ] **Step 3: Verify**

Run: `cd luci-theme-shadcn && grep -n "html{background" ucode/template/themes/shadcn/header.ut`
Expected: shows the updated light + dark oklch values matching `_tokens.css`.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add ucode/template/themes/shadcn/header.ut
git commit -m "fix: sync header.ut anti-flash background to new canvas colors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 14: Final build and zero-runtime verification

**Files:**
- Modify (generated): `htdocs/luci-static/shadcn/main.css`, `htdocs/luci-static/shadcn/login.css`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Clean build**

Run: `cd luci-theme-shadcn/.dev && pnpm build 2>&1 | tail -5`
Expected: `✓ built`, both `main.css` and `login.css` emitted.

- [ ] **Step 2: Assert zero runtime color computation in BOTH built files**

Run:
```bash
cd luci-theme-shadcn && \
echo "main color-mix: $(grep -c 'color-mix(' htdocs/luci-static/shadcn/main.css)" && \
echo "main oklch(from: $(grep -c 'oklch(from' htdocs/luci-static/shadcn/main.css)" && \
echo "login color-mix: $(grep -c 'color-mix(' htdocs/luci-static/shadcn/login.css)" && \
echo "login oklch(from: $(grep -c 'oklch(from' htdocs/luci-static/shadcn/login.css)"
```
Expected: all four counts `0`. (If `main color-mix` is nonzero, run `grep -oE "color-mix\([^)]*\)" htdocs/luci-static/shadcn/main.css | sort -u` to find the source utility and fix the corresponding component file.)

- [ ] **Step 3: Confirm prior fixes survived**

Run: `cd luci-theme-shadcn && grep -c "rgb(var(--zone-color-rgb),.7)" htdocs/luci-static/shadcn/main.css && grep -c "min-h-9" .dev/src/media/components/_tabs.css`
Expected: `1` (zonebadge comma syntax intact) and `1` (tabmenu min-h-9 intact).

- [ ] **Step 4: Visual smoke test (manual, document results)**

With the dev server (`pnpm dev`) or on-device, check in **light**, **dark**, and **device-follow** (toggle OS theme): login page, Overview, a form page, firewall zone badges (zonebadge color), and `cbi-tabmenu` (no vertical scrollbar). Confirm lavender accent, cool-gray surfaces, no first-paint flash when switching OS theme. Note any token that reads wrong and tune it in `tokens/defaults.js` / `tokens/spec.js`, then `pnpm gen:tokens && pnpm build`.

- [ ] **Step 5: Commit the built assets**

```bash
cd luci-theme-shadcn
git add htdocs/luci-static/shadcn/main.css htdocs/luci-static/shadcn/login.css
git commit -m "build: regenerate shadcn assets with Linear flat tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 15 (optional): Align radius and heading tracking to Linear

**Files:**
- Modify: `.dev/scripts/gen-tokens.js` (radius already added in Task 6 `@theme`; tune `--radius-base` if corners look off)
- Modify: `.dev/src/media/_base.css` or `_layout.css` (heading letter-spacing)

**Interfaces:**
- Consumes: `@theme` radius scale already emitted.

- [ ] **Step 1: Decide if the global radius scale shifted any corners undesirably**

Run: `cd luci-theme-shadcn && grep -rn "rounded-" .dev/src/media | wc -l`
Review a few component corners in the running app. Linear uses 8px buttons/inputs, 12px cards. If the Task 6 radius scale (`--radius-base: 0.5rem`) reads wrong anywhere, adjust `--radius-base` or the individual `--radius-*` calc multipliers in `gen-tokens.js`.

- [ ] **Step 2: Add mild negative tracking on headings (Linear signature)**

In `.dev/src/media/_base.css`, add (or extend an existing base layer):

```css
@layer base {
  h1, h2, h3, h4 { letter-spacing: -0.02em; }
}
```

- [ ] **Step 3: Regenerate + build**

Run: `cd luci-theme-shadcn/.dev && pnpm gen:tokens && pnpm build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
cd luci-theme-shadcn
git add -A
git commit -m "style: align radius scale and heading tracking to Linear

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** token engine (T2), inputs (T3), derivations + alpha map (T4), generator/flat `_tokens.css` (T6), `@theme` consolidation (T7–T8), color-mix elimination across all 12 files (T9–T11), login relative-color (T12), follow-device anti-flash sync (T13), verification incl. prior fixes (T14), radius/typography (T15). Light+dark handled in every `tokens/` file. ✓
- **Alpha coverage:** every opacity modifier from the source inventory maps to an `ALPHAS` entry (verified against `grep` inventory; login adds primary 10/20/70, destructive 8, foreground 5 in T12). ✓
- **Naming consistency:** derived keys snake_case in JS, kebab in CSS via `kebab()`; alpha utilities are `<color>-a<NN>` (e.g. `bg-primary-a15`, `ring-ring-a50`, `text-muted-foreground-a70`). Consumer base names unchanged. ✓
- **Risk:** Task 6's `__struct__` injection is a minor hack — the inline note offers a plain-concatenation alternative. Radius scale (T6/T15) can shift existing `rounded-*` corners; T15 Step 1 gates that and it is an optional, independently revertible task.
