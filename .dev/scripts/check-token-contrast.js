/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

import Color from "colorjs.io";
import { resolveMode } from "../tokens/resolve.js";

const MIN_TEXT_CONTRAST = 4.5;
const checks = [
  ["muted_foreground", "background"],
  ["sidebar_muted", "sidebar_bg"],
];
const failures = [];

for (const mode of ["light", "dark"]) {
  const tokens = resolveMode(mode);

  for (const [foreground, background] of checks) {
    const ratio = Color.contrast(
      new Color(tokens[background]),
      new Color(tokens[foreground]),
      "WCAG21",
    );

    if (ratio < MIN_TEXT_CONTRAST) {
      failures.push(
        `${mode}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(
    `Text token contrast must be at least ${MIN_TEXT_CONTRAST}:1:\n${failures.join("\n")}`,
  );
  process.exitCode = 1;
} else {
  console.log("Text token contrast meets WCAG AA.");
}
