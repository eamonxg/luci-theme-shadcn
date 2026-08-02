/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

// shadcn's spec bound to the shared resolver. The operators and resolution
// mechanism live in @eamonxg/luci-theme-tokens; only the spec is ours.
import { createResolver } from "@eamonxg/luci-theme-tokens/engine";
import { DERIVATIONS } from "./spec.js";
import { DEFAULTS } from "./defaults.js";

export const resolveTokens = createResolver(DERIVATIONS);
export const resolveMode = (mode) => resolveTokens(mode, { ...DEFAULTS[mode] });
