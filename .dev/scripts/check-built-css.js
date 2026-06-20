/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve(
  import.meta.dirname,
  "../../htdocs/luci-static/shadcn",
);
const files = ["main.css", "login.css"];
const forbidden = [
  {
    label: "token-based color-mix()",
    pattern: /color-mix\([^)]*var\(--/g,
  },
  {
    label: "relative oklch()",
    pattern: /oklch\(from/g,
  },
];
const failures = [];

for (const file of files) {
  const css = await readFile(resolve(outputDir, file), "utf8");

  for (const { label, pattern } of forbidden) {
    const count = css.match(pattern)?.length ?? 0;
    if (count > 0) failures.push(`${file}: ${label} × ${count}`);
  }
}

if (failures.length > 0) {
  console.error(`Runtime token color functions found:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Built CSS contains no runtime token color functions.");
}
