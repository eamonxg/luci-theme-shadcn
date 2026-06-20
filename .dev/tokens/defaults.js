/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

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
    text: "oklch(0.90 0.006 264)",
    brand: "oklch(0.567 0.158 275)",
    on_brand: "oklch(1 0 0)",
    success: "oklch(0.637 0.175 147)",
    warning: "oklch(0.80 0.12 80)",
    danger: "oklch(0.63 0.16 25)",
    info: "oklch(0.70 0.10 250)",
    overlay_base: "oklch(0 0 0)",
  },
};
