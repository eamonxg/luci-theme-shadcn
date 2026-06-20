/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import Color from "colorjs.io";
import { resolveMode } from "../tokens/resolve.js";
import { ALPHAS } from "../tokens/spec.js";

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
    for (const [k, v] of Object.entries(m))
      lines.push(`  --${kebab(k)}: ${v};`);
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

// Add aliases for backward compatibility
const aliases = [
  `  --color-sidebar-fg: var(--sidebar-foreground);`,
  `  --color-terminal-fg: var(--terminal-foreground);`,
].join("\n");

const THEME = `@theme inline {
${themeColors}

${aliases}

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);

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
