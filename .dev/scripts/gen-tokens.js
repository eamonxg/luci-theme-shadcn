/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { alpha, toOklch } from "@eamonxg/luci-theme-tokens/engine";
import { block, themeColors } from "@eamonxg/luci-theme-tokens/emit";
import { resolveMode } from "../tokens/resolve.js";
import { ALPHAS } from "../tokens/spec.js";

const snake = (s) => s.replace(/-/g, "_");
const withAlpha = (oklchStr, pct) => toOklch(alpha(oklchStr, pct / 100));

function alphaTokens(resolved) {
  const out = {};
  for (const [base, list] of Object.entries(ALPHAS)) {
    const val = resolved[snake(base)];
    if (val === undefined) throw new Error(`ALPHAS base not resolved: ${base}`);
    for (const a of list) out[`${base}-a${a}`] = withAlpha(val, a);
  }
  return out;
}

const light = resolveMode("light");
const dark = resolveMode("dark");
const lightA = alphaTokens(light);
const darkA = alphaTokens(dark);

const STRUCTURE = `
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
  --radius-base: 0.5rem;

  /* Elevation. Emitted on :root (not just inlined into the shadow-* utilities)
     so on-demand patches/*.css -- standalone entries that carry no Tailwind
     helper output -- can reach it as var(--shadow-sm). */
  --shadow-sm:
    0 1px 3px 0 oklch(0% 0 0 / 0.1), 0 1px 2px -1px oklch(0% 0 0 / 0.1);
`;

const themeColorsCss = themeColors([
  ...Object.keys(light),
  ...Object.keys(lightA),
]);

// Add aliases for backward compatibility
const aliases = [
  `  --color-sidebar-fg: var(--sidebar-foreground);`,
  `  --color-terminal-fg: var(--terminal-foreground);`,
].join("\n");

const THEME = `@theme inline {
${themeColorsCss}

${aliases}

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);

  --shadow-sm: var(--shadow-sm);

  /* Radius ladder driven by a single knob; at 0.5rem it matches the
     Tailwind default scale (rounded-lg = 0.5rem). Tune --radius-base
     to scale all corners for custom-radius support. */
  --radius-sm: calc(var(--radius-base) * 0.5);
  --radius: calc(var(--radius-base) * 0.5);
  --radius-md: calc(var(--radius-base) * 0.75);
  --radius-lg: var(--radius-base);
  --radius-xl: calc(var(--radius-base) * 1.5);
}
`;

const HEADER = `/**
 * luci-theme-shadcn: design tokens -- GENERATED, DO NOT EDIT.
 * Run \`pnpm gen:tokens\`. Source: tokens/defaults.js + tokens/spec.js
 * All color values are flat oklch() literals; no dynamic color functions.
 * Dark mode overrides must stay after light mode block.
 */
`;

const css =
  HEADER +
  "\n" +
  block(":root", light, lightA) +
  STRUCTURE +
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
