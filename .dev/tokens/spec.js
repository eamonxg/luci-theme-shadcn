/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

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
  muted_foreground: ["mix", "text", "bg", 0.57],
  secondary_foreground: ["mix", "text", "bg", 0.85],
  sidebar_muted: ["mix", "text", "bg", 0.57],
  focus_ring: ["alpha", "brand", 0.5],
};

export const DERIVATIONS = {
  light: {
    ...common,
    muted: ["shade", "bg", -0.035],
    secondary: ["shade", "bg", -0.05],
    label_surface: ["shade", "bg", -0.022],
    border: ["mix", "text", "bg", 0.11],
    panel_border: ["const", "var:border"],
    primary_hover: ["shade", "brand", 0.06],
    sidebar_accent: ["shade", "bg", -0.04],
    sidebar_active_bg: ["alpha", "brand", 0.12],
    sidebar_active_fg: ["shade", "brand", -0.08],
    sidebar_border: ["const", "var:border"],
    terminal_bg: ["const", "oklch(0.14 0.02 264)"],
    warning_soft_fg: ["const", "oklch(0.42 0.12 75)"],
    progress_bar_start: ["mix", "brand", "surface", 0.6],
    login_left_bg: ["shade", "bg", -0.05],
  },
  dark: {
    ...common,
    muted: ["shade", "bg", 0.03],
    secondary: ["shade", "surface", 0.02],
    label_surface: ["shade", "surface", -0.01],
    border: ["mix", "text", "bg", 0.14],
    panel_border: ["alpha", "text", 0.08],
    primary_hover: ["shade", "brand", 0.06],
    sidebar_accent: ["shade", "surface", 0.025],
    sidebar_active_bg: ["alpha", "brand", 0.14],
    sidebar_active_fg: ["shade", "brand", 0.22],
    sidebar_border: ["alpha", "text", 0.08],
    terminal_bg: ["const", "oklch(0.12 0.02 264)"],
    warning_soft_fg: ["const", "oklch(0.86 0.10 85)"],
    progress_bar_start: ["mix", "brand", "surface", 0.6],
    login_left_bg: ["shade", "bg", -0.025],
  },
};

// Baked-alpha variants. Each base (resolved per mode) is emitted at each alpha
// as a flat oklch(L C H / a) literal -> replaces Tailwind /NN opacity modifiers.
export const ALPHAS = {
  primary: [5, 10, 15, 20, 25, 60, 70, 90],
  destructive: [8, 10, 20, 30, 40, 50, 60, 70, 80, 90],
  foreground: [5, 30],
  secondary: [80],
  muted: [30, 80],
  "muted-foreground": [70],
  success: [10, 15, 30, 40, 80],
  warning: [10, 15, 30, 40],
  info: [10, 15, 30, 40, 80],
  border: [60, 80],
  input: [30],
  "label-surface": [50],
  "overlay-base": [50, 60],
  background: [60],
  ring: [50],
};
