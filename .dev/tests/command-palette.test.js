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

// The module's top level only defines constants and returns the extended
// object, so empty DOM/storage stubs keep the factory inert.
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

const RECENTS_KEY = "shadcn.palette.recents";

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    map,
  };
};

const navPage = (path, title, group = "Group") => ({
  title,
  group,
  icon: "activity",
  path,
  href: `/${path}`,
  isLogout: false,
});

const paletteWith = (storage, index) => {
  const module = loadMenuModule(storage);
  module.palIndex = index;
  return module;
};

const browseIndex = () => [
  navPage("admin/status/overview", "概览", "状态"),
  navPage("admin/status/syslog", "系统日志", "状态"),
  navPage("admin/network/iface", "接口", "网络"),
  navPage("admin/network/firewall", "防火墙", "网络"),
  {
    title: "Logout",
    group: null,
    icon: "logout",
    path: "admin/logout",
    href: "/admin/logout",
    isLogout: true,
  },
];

const stored = (recents) => ({ [RECENTS_KEY]: JSON.stringify(recents) });

const paths = (pages) => pages.map((page) => page.path);

test("a recorded pick lands at the head of the stored recents", () => {
  const storage = fakeStorage();
  const palette = paletteWith(storage, browseIndex());

  palette._palRecordRecent("admin/status/syslog");
  palette._palRecordRecent("admin/network/iface");

  assert.deepEqual(JSON.parse(storage.map.get(RECENTS_KEY)), [
    "admin/network/iface",
    "admin/status/syslog",
  ]);
});

test("re-recording a path moves it up instead of duplicating it", () => {
  const storage = fakeStorage(
    stored(["admin/network/iface", "admin/status/syslog"]),
  );
  const palette = paletteWith(storage, browseIndex());

  palette._palRecordRecent("admin/status/syslog");

  assert.deepEqual(JSON.parse(storage.map.get(RECENTS_KEY)), [
    "admin/status/syslog",
    "admin/network/iface",
  ]);
});

test("corrupt or foreign stored values read as no history", () => {
  for (const value of ["not json", '"just a string"', "[1,2,3]", "{}"]) {
    const palette = paletteWith(
      fakeStorage({ [RECENTS_KEY]: value }),
      browseIndex(),
    );
    assert.deepEqual(palette._palReadRecents(), [], value);
  }
});

test("a throwing storage neither breaks reads nor records", () => {
  const hostile = {
    getItem: () => {
      throw new Error("privacy mode");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
  const palette = paletteWith(hostile, browseIndex());

  assert.deepEqual(palette._palReadRecents(), []);
  assert.doesNotThrow(() => palette._palRecordRecent("admin/status/overview"));
});

test("browsing floats visited pages in recency order, menu order behind", () => {
  const palette = paletteWith(
    fakeStorage(stored(["admin/network/iface", "admin/status/syslog"])),
    browseIndex(),
  );

  assert.deepEqual(paths(palette._palBrowsePages()), [
    "admin/network/iface",
    "admin/status/syslog",
    "admin/status/overview",
    "admin/network/firewall",
  ]);
});

test("vanished paths drop and the rest keep their order", () => {
  const palette = paletteWith(
    fakeStorage(stored(["admin/removed/page", "admin/network/firewall"])),
    browseIndex(),
  );

  assert.deepEqual(paths(palette._palBrowsePages()), [
    "admin/network/firewall",
    "admin/status/overview",
    "admin/status/syslog",
    "admin/network/iface",
  ]);
});

test("the logout leaf stays out of the browse list, stored or not", () => {
  const palette = paletteWith(
    fakeStorage(stored(["admin/logout", "admin/status/syslog"])),
    browseIndex(),
  );

  assert.deepEqual(paths(palette._palBrowsePages()), [
    "admin/status/syslog",
    "admin/status/overview",
    "admin/network/iface",
    "admin/network/firewall",
  ]);
});
