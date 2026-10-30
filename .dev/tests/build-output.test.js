import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const output = resolve(import.meta.dirname, "../../htdocs/luci-static");
const read = (path) => readFileSync(resolve(output, path), "utf8");
const bytes = (path) => statSync(resolve(output, path)).size;

test("pruned login.css keeps every consumed variable resolvable", () => {
  const css = read("shadcn/login.css");
  const declared = new Set(
    [...css.matchAll(/[{;](--[\w-]+):/g)].map((m) => m[1]),
  );
  const registered = new Set(
    [...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1]),
  );
  // sysauth.ut declares it inline at render time.
  const injected = new Set(["--login-bg-image"]);

  const unresolvable = [];
  for (const [, name, delim] of css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g))
    if (
      delim !== "," &&
      !declared.has(name) &&
      !registered.has(name) &&
      !injected.has(name)
    )
      unresolvable.push(name);
  assert.deepEqual([...new Set(unresolvable)], []);

  for (const adminOnly of ["--sidebar-bg:", "--terminal-foreground:"])
    assert.ok(!css.includes(adminOnly), `${adminOnly} should be pruned`);
  assert.ok(
    css.includes("-webkit-backdrop-filter"),
    "prefixes must survive the prune",
  );
});

test("page content appears without decorative entry fades", () => {
  const css = read("shadcn/main.css");
  assert.ok(
    !css.includes("shadcn-fade-in"),
    "decorative entry keyframe remains",
  );
  assert.ok(
    !/#view>:not\(\.spinning\)[^{]*\{[^}]*\banimation:/.test(css),
    "view contents still animate on entry",
  );
});

// uhttpd serves identity bytes, so raw size is what every cold load pays.
// Set 2026-09 from main 129213, login 10521, menu 15859, router 15771,
// sidebar 6107, Inter latin 48256, logo 258.
test("production assets stay within raw-transfer budgets", () => {
  const main = bytes("shadcn/main.css");
  const login = bytes("shadcn/login.css");
  const menu = bytes("resources/menu-shadcn.js");
  const router = bytes("resources/router-shadcn.js");
  const sidebar = bytes("resources/sidebar-shadcn.js");
  const font = bytes("shadcn/inter-latin-wght-normal.woff2");
  const logo = bytes("shadcn/images/logo.svg");

  assert.ok(main <= 130_000, `main.css ${main} B exceeds 130 KB`);
  assert.ok(login <= 11_000, `login.css ${login} B exceeds 11 KB`);
  // 17.5K: palette tabs (third-level nodes, redirect-parent folding, legacy
  // recents mapping, parent-aware scoring, per-segment path words) added
  // ~1.2 KB; the admin total below moved by the same amount.
  assert.ok(menu <= 17_500, `menu-shadcn.js ${menu} B exceeds 17.5 KB`);
  assert.ok(router <= 16_000, `router-shadcn.js ${router} B exceeds 16 KB`);
  assert.ok(sidebar <= 6_500, `sidebar-shadcn.js ${sidebar} B exceeds 6.5 KB`);
  assert.ok(
    main + menu + router + sidebar + font <= 217_500,
    "admin assets exceed 217.5 KB",
  );
  assert.ok(login + font + logo <= 60_000, "login assets exceed 60 KB");
});
