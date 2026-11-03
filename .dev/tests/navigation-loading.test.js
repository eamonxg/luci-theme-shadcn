import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const footer = readFileSync(
  new URL("../../ucode/template/themes/shadcn/footer.ut", import.meta.url),
  "utf8",
);
const boot = [...footer.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((script) => script.includes("L.require('menu-shadcn')"));

for (const navigation of [undefined, {}]) {
  test(`theme modules start without waiting for menu resolution (Navigation API: ${!!navigation})`, () => {
    const requested = [];
    const L = {
      require(name) {
        requested.push(name);
        return new Promise(() => {});
      },
    };
    new Function("L", "window", boot)(L, { navigation });
    assert.ok(requested.includes("menu-shadcn"));
    assert.equal(requested.includes("router-shadcn"), !!navigation);
  });
}

const menuSource = readFileSync(
  new URL("../src/resource/menu-shadcn.js", import.meta.url),
  "utf8",
);

test("sidebar chrome and controls are ready while the menu request is pending", async () => {
  const calls = [];
  let resolveMenu;
  const pendingMenu = new Promise((resolve) => {
    resolveMenu = resolve;
  });
  const menu = new Function(
    "baseclass",
    "ui",
    "document",
    "window",
    menuSource,
  )(
    { extend: (value) => value },
    { menu: { load: () => pendingMenu } },
    { dispatchEvent: (event) => calls.push(event.type) },
    { addEventListener: (event) => calls.push(event) },
  );
  menu.renderSidebarChrome = () => calls.push("chrome");
  menu.initUciIndicator = () => calls.push("indicator");
  menu.render = (tree) => calls.push(tree);
  menu.cacheSidebar = () => calls.push("cache");
  menu.__init__();
  assert.deepEqual(calls, ["chrome", "indicator", "shadcn-sidebar-ready"]);
  const tree = { children: {} };
  resolveMenu(tree);
  await pendingMenu;
  assert.deepEqual(calls, [
    "chrome",
    "indicator",
    "shadcn-sidebar-ready",
    tree,
    "cache",
    "pagehide",
  ]);
});

const header = readFileSync(
  new URL("../../ucode/template/themes/shadcn/header.ut", import.meta.url),
  "utf8",
);
const replay = [...header.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((script) => script.includes("Pre-paint sidebar restore"));

function restore({
  stamp = "lang:user:session:version",
  cachedStamp = stamp,
  menu = {},
  version = 2,
} = {}) {
  const sidebar = {
    innerHTML: "",
    setAttribute() {},
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const store = {
    "shadcn.sidebar.cache": JSON.stringify({
      v: version,
      stamp: cachedStamp,
      html: "<nav>cached</nav>",
    }),
    "luci-session-store": JSON.stringify({ session: { menu } }),
  };
  new Function("document", "sessionStorage", "location", "window", replay)(
    {
      addEventListener() {},
      getElementById: () => sidebar,
      body: { dataset: { navStamp: stamp } },
    },
    {
      getItem: (key) => store[key] || null,
      removeItem: (key) => delete store[key],
    },
    { pathname: "/cgi-bin/luci/admin/status/overview" },
    {},
  );
  return sidebar.innerHTML;
}

test("pre-paint sidebar cache survives within the same active session", () => {
  assert.equal(restore(), "<nav>cached</nav>");
});

test("pre-paint sidebar cache is invalidated by identity, version and LuCI menu flush", () => {
  for (const options of [
    { cachedStamp: "lang:other:session:version" },
    { cachedStamp: "lang:user:old-session:version" },
    { cachedStamp: "lang:user:session:old-version" },
    { cachedStamp: "other-lang:user:session:version" },
    { menu: null },
    { version: 1 },
  ])
    assert.equal(restore(options), "", JSON.stringify(options));
  assert.match(header, /ctx\?\.authsession/);
});
