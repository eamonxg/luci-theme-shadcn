import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(import.meta.dirname, "../src/resource/menu-shadcn.js"),
  "utf8",
);

const E = (tagName, attributes, children) => ({
  tagName,
  attributes,
  children,
});

const loadMenuModule = (localStorage = {}) => {
  const baseclass = {
    extend(module) {
      return module;
    },
  };
  const ui = { menu: { getChildren: () => [] } };
  const L = {
    env: { dispatchpath: [], requestpath: [] },
    url: (...segments) => `/${segments.join("/")}`,
  };

  return new Function(
    "baseclass",
    "ui",
    "E",
    "L",
    "_",
    "document",
    "window",
    "localStorage",
    "sessionStorage",
    "navigator",
    source,
  )(
    baseclass,
    ui,
    E,
    L,
    (value) => value,
    {},
    {},
    localStorage,
    {},
    { platform: "" },
  );
};

const DOCK_KEY = "shadcn.dock.items";
const DOCK_DESKTOP_KEY = "shadcn.dock.desktop";
const DOCK_MOBILE_KEY = "shadcn.dock.mobile";

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
};

const samplePages = [
  {
    path: "admin/status/overview",
    title: "Overview",
    icon: "activity",
    href: "/admin/status/overview",
    isLogout: false,
  },
  {
    path: "admin/network/network",
    title: "Network",
    icon: "network",
    href: "/admin/network/network",
    isLogout: false,
  },
  {
    path: "admin/network/firewall",
    title: "Firewall",
    icon: "shield",
    href: "/admin/network/firewall",
    isLogout: false,
  },
  {
    path: "admin/system/system",
    title: "System",
    icon: "settings",
    href: "/admin/system/system",
    isLogout: false,
  },
  {
    path: "admin/system/package-manager",
    title: "Software",
    icon: "package",
    href: "/admin/system/package-manager",
    isLogout: false,
  },
  {
    path: "admin/system/opkg",
    title: "Software Legacy",
    icon: "hard-drive",
    href: "/admin/system/opkg",
    isLogout: false,
  },
  {
    path: "admin/logout",
    title: "Logout",
    icon: "logout",
    href: "/admin/logout",
    isLogout: true,
  },
];

test("dock resolves default items when no custom storage exists", () => {
  const storage = fakeStorage();
  const menu = loadMenuModule(storage);
  menu.palIndex = samplePages;

  const items = menu._resolveDockItems();
  assert.equal(items.length, 5);
  assert.deepEqual(
    items.map((i) => i.path),
    [
      "admin/status/overview",
      "admin/network/network",
      "admin/network/firewall",
      "admin/system/system",
      "admin/system/package-manager",
    ],
  );
});

test("dock honors exactly user-selected items when user checks less than 5 items", () => {
  const custom = ["admin/system/opkg", "admin/network/firewall"];
  const storage = fakeStorage({ [DOCK_KEY]: JSON.stringify(custom) });
  const menu = loadMenuModule(storage);
  menu.palIndex = samplePages;

  const items = menu._resolveDockItems();
  assert.equal(items.length, 2);
  assert.equal(items[0].path, "admin/system/opkg");
  assert.equal(items[1].path, "admin/network/firewall");
});

test("dock ignores corrupted storage value and falls back to default", () => {
  const storage = fakeStorage({ [DOCK_KEY]: "invalid json" });
  const menu = loadMenuModule(storage);
  menu.palIndex = samplePages;

  const items = menu._resolveDockItems();
  assert.equal(items.length, 5);
  assert.equal(items[0].path, "admin/status/overview");
});

test("dock saves paths safely with max 5 slice", () => {
  const storage = fakeStorage();
  const menu = loadMenuModule(storage);

  menu._saveDockPaths([
    "admin/status/overview",
    "admin/network/network",
    "admin/network/firewall",
    "admin/system/system",
    "admin/status/realtime",
    "admin/system/opkg",
  ]);

  const saved = JSON.parse(storage.map.get(DOCK_KEY));
  assert.equal(saved.length, 5);
  assert.equal(saved[4], "admin/status/realtime");
});

test("dock reads visibility settings with default true", () => {
  const storage = fakeStorage();
  const menu = loadMenuModule(storage);

  const vis = menu._getDockVisibility();
  assert.equal(vis.desktop, true);
  assert.equal(vis.mobile, true);
});

test("dock reads saved visibility false for desktop and mobile", () => {
  const storage = fakeStorage({
    [DOCK_DESKTOP_KEY]: "false",
    [DOCK_MOBILE_KEY]: "false",
  });
  const menu = loadMenuModule(storage);

  const vis = menu._getDockVisibility();
  assert.equal(vis.desktop, false);
  assert.equal(vis.mobile, false);
});

test("dock saves visibility settings correctly", () => {
  const storage = fakeStorage();
  const menu = loadMenuModule(storage);

  menu._saveDockVisibility({ desktop: false, mobile: true });
  assert.equal(storage.map.get(DOCK_DESKTOP_KEY), "false");
  assert.equal(storage.map.get(DOCK_MOBILE_KEY), "true");
});
