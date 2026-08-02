/**
 * Shadcn dev helper — one floating bar, injected by vite.config.ts into both
 * contexts it is useful in. Never ships to the router.
 *
 *   proxied device page (/cgi-bin/luci/…)
 *     · lists every snapshot in .dev/mocks/ so the workflow is reachable
 *       without typing /mocks/ by hand
 *     · jumps straight to this page's own snapshot when one was captured
 *       (matched on <body data-page>)
 *     · captures the open page — the button does what Alt/Option+Shift+S does
 *   served snapshot (/mocks/…)
 *     · names the open snapshot, cycles with ‹ / › or the [ and ] keys
 *     · takes over the snapshot's own LuCI links: they resolve against the
 *       captured snapshots instead of falling through to the proxied router
 *
 * Shadow DOM throughout, so theme/patch CSS can't restyle the bar and its
 * styles can't leak into the page under review. Bottom-left, out of the
 * page's way.
 *
 * Data contract (injected inline before this script):
 *   window.__SHADCN_MOCKS__ = { current: "<file>"|null, mocks: [{ file, page }] }
 */
(() => {
  "use strict";

  if (window.__shadcnMockBar) return;
  window.__shadcnMockBar = true;

  const data = window.__SHADCN_MOCKS__ || {};
  const mocks = Array.isArray(data.mocks) ? data.mocks.slice() : [];
  // A snapshot is static DOM: capturing one would only re-save the theme's own
  // output, and there is no live page to re-capture.
  const inMock = location.pathname.startsWith("/mocks/");
  const COLLAPSE_KEY = "shadcn.mockbar.collapsed";

  const mockUrl = (file) => "/mocks/" + encodeURIComponent(file);
  const displayName = (file) => file.replace(/\.html$/, "");
  const escapeHtml = (s) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  // The page's own identity, used to find its snapshot from a device page.
  const currentPage = document.body?.dataset?.page || null;
  const snapshotOfThisPage = () =>
    currentPage ? mocks.find((m) => m.page === currentPage) : undefined;

  const LAST_DEVICE_KEY = "shadcn.mockbar.device";
  const readStore = (store, key) => {
    try {
      return window[store].getItem(key);
    } catch {
      return null; // private mode
    }
  };
  const writeStore = (store, key, value) => {
    try {
      if (value === null) window[store].removeItem(key);
      else window[store].setItem(key, value);
    } catch {
      /* private mode — the bar just forgets between reloads */
    }
  };

  // Where "back to the device" goes from inside a snapshot. data-page is the
  // request path joined with "-", so splitting it back apart is wrong whenever
  // a segment contains a dash of its own (admin-status-disks-info). LuCI's own
  // inline bootstrap carries the segments verbatim, so read those first and
  // keep the lossy split as the fallback.
  const devicePath = () => {
    const page = mocks.find((m) => m.file === data.current)?.page;
    const bootstrap = document.documentElement.innerHTML.match(
      /"requestpath"\s*:\s*\[([^\]]*)\]/,
    );
    const segs = bootstrap?.[1]
      .match(/"((?:[^"\\]|\\.)*)"/g)
      ?.map((s) => JSON.parse(s));
    // Only trust the bootstrap when it agrees with the snapshot's identity —
    // a hand-assembled mock can carry the segments of the page it was built
    // from.
    if (segs && (!page || segs.join("-") === page))
      return "/cgi-bin/luci/" + segs.join("/");
    if (page) return "/cgi-bin/luci/" + page.split("-").join("/");
    return readStore("sessionStorage", LAST_DEVICE_KEY) || "/cgi-bin/luci/";
  };

  // ---- shell ---------------------------------------------------------------

  const host = document.createElement("shadcn-mock-bar");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 2147483000;
        font: 12px/1.5 system-ui, -apple-system, sans-serif;
      }
      button {
        font: inherit;
        color: inherit;
        background: none;
        border: 0;
        cursor: pointer;
        padding: 0;
      }
      .pill {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 4px 6px;
        border-radius: 999px;
        background: rgba(18, 18, 24, 0.82);
        color: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .pill[hidden],
      .dot[hidden],
      .step[hidden],
      .here[hidden],
      .back[hidden],
      .capture[hidden] {
        display: none;
      }
      .step,
      .here,
      .back,
      .capture,
      .close {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        font-size: 14px;
        opacity: 0.75;
      }
      .step:hover,
      .here:hover,
      .back:hover,
      .capture:hover,
      .close:hover {
        background: rgba(255, 255, 255, 0.14);
        opacity: 1;
      }
      .here {
        color: #4ade80;
        opacity: 1;
      }
      .close {
        font-size: 12px;
        opacity: 0.5;
      }
      .name {
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 2px 6px;
        border-radius: 999px;
      }
      .name:hover {
        background: rgba(255, 255, 255, 0.14);
      }
      .count {
        opacity: 0.6;
        margin-left: 4px;
      }
      .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: rgba(18, 18, 24, 0.5);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      }
      .dot:hover {
        background: rgba(18, 18, 24, 0.85);
      }
      .panel {
        position: absolute;
        left: 0;
        bottom: calc(100% + 8px);
        min-width: 260px;
        max-width: 360px;
        max-height: 60vh;
        overflow: auto;
        padding: 6px;
        border-radius: 12px;
        background: rgba(18, 18, 24, 0.92);
        color: #fff;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .panel[hidden] {
        display: none;
      }
      .panel a {
        display: block;
        padding: 6px 10px;
        border-radius: 8px;
        color: #fff;
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .panel a:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .panel a.current {
        color: #4ade80;
      }
      .panel a.current::before {
        content: "● ";
        font-size: 9px;
        vertical-align: 1px;
      }
      .foot {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 4px;
        padding: 6px 10px 2px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.55);
      }
      .foot a {
        display: inline;
        padding: 0;
        color: inherit;
      }
      .foot a:hover {
        color: #fff;
        background: none;
      }
      .toast {
        position: absolute;
        left: 0;
        bottom: calc(100% + 8px);
        max-width: 320px;
        padding: 8px 12px;
        border-radius: 10px;
        background: rgba(18, 18, 24, 0.92);
        color: #ffd166;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
        opacity: 0;
        transition: opacity 160ms ease;
        pointer-events: none;
      }
      .toast.show {
        opacity: 1;
      }
    </style>
    <div class="panel" hidden></div>
    <div class="toast"></div>
    <div class="pill">
      <button class="step prev" title="上一个快照 [">‹</button>
      <button class="here" title="打开本页快照">◆</button>
      <button class="name" title="全部快照"></button>
      <button class="step next" title="下一个快照 ]">›</button>
      <button class="back" title="回到真机页">↩</button>
      <button class="capture" title="捕获此页（Alt/Option+Shift+S）">⊕</button>
      <button class="close" title="收起">✕</button>
    </div>
    <button class="dot" title="Shadcn 快照" hidden></button>
  `;

  const panel = root.querySelector(".panel");
  const toastEl = root.querySelector(".toast");
  const pill = root.querySelector(".pill");
  const dot = root.querySelector(".dot");
  const nameBtn = root.querySelector(".name");
  const hereBtn = root.querySelector(".here");
  const backBtn = root.querySelector(".back");
  const captureBtn = root.querySelector(".capture");
  const prevBtn = root.querySelector(".prev");
  const nextBtn = root.querySelector(".next");

  let toastTimer;
  const toast = (text, ok) => {
    toastEl.textContent = text;
    toastEl.style.color = ok ? "#4ade80" : "#ffd166";
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  };

  // ---- rendering -----------------------------------------------------------

  const currentIndex = () =>
    Math.max(
      mocks.findIndex((m) => m.file === data.current),
      0,
    );

  const render = () => {
    const here = snapshotOfThisPage();
    const count = mocks.length;

    prevBtn.hidden = nextBtn.hidden = !inMock || count < 2;
    captureBtn.hidden = inMock;
    hereBtn.hidden = inMock || !here;
    backBtn.hidden = !inMock;
    if (inMock) backBtn.title = `回到真机页 ${devicePath()}`;

    if (inMock) {
      nameBtn.innerHTML =
        escapeHtml(displayName(data.current || "")) +
        `<span class="count">${currentIndex() + 1}/${count}</span>`;
    } else if (!count) {
      nameBtn.textContent = "捕获此页";
    } else {
      nameBtn.innerHTML =
        (here ? "本页有快照" : "快照") + `<span class="count">${count}</span>`;
    }

    panel.innerHTML =
      mocks
        .map((m) => {
          const isCurrent = inMock
            ? m.file === data.current
            : !!currentPage && m.page === currentPage;
          return (
            `<a href="${mockUrl(m.file)}"` +
            (isCurrent ? ' class="current"' : "") +
            ` title="${escapeHtml(m.page || m.file)}">` +
            `${escapeHtml(displayName(m.file))}</a>`
          );
        })
        .join("") +
      '<div class="foot"><a href="/mocks/">全部快照 ↗</a>' +
      `<span>${inMock ? "[ / ] 切换" : "Alt/⇧+S 捕获"}</span></div>`;
  };

  const setCollapsed = (collapsed) => {
    pill.hidden = collapsed;
    dot.hidden = !collapsed;
    if (collapsed) panel.hidden = true;
    writeStore("localStorage", COLLAPSE_KEY, collapsed ? "1" : null);
  };

  // ---- capture -------------------------------------------------------------

  const capture = async () => {
    try {
      const response = await fetch("/mocks/__save", {
        method: "POST",
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Shadcn-Capture": "1",
        },
        body: "<!doctype html>\n" + document.documentElement.outerHTML,
      });
      const info = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(info.error || `HTTP ${response.status}`);
      // Fold the fresh snapshot into the list the page was served with, so the
      // bar reflects it without a reload.
      const entry = { file: info.file, page: info.page ?? null };
      const at = mocks.findIndex((m) => m.file === entry.file);
      if (at === -1) mocks.push(entry);
      else mocks[at] = entry;
      mocks.sort((a, b) => a.file.localeCompare(b.file));
      render();
      toast(`已捕获 ${info.file}`, true);
    } catch (err) {
      toast(`捕获失败：${(err && err.message) || err}`, false);
    }
  };

  // ---- wiring --------------------------------------------------------------

  const cycle = (step) => {
    if (!inMock || mocks.length < 2) return;
    const next = mocks[(currentIndex() + step + mocks.length) % mocks.length];
    location.href = mockUrl(next.file);
  };

  prevBtn.addEventListener("click", () => cycle(-1));
  nextBtn.addEventListener("click", () => cycle(1));
  hereBtn.addEventListener("click", () => {
    const here = snapshotOfThisPage();
    if (here) location.href = mockUrl(here.file);
  });
  backBtn.addEventListener("click", () => {
    location.href = devicePath();
  });
  captureBtn.addEventListener("click", capture);
  nameBtn.addEventListener("click", () => {
    if (!inMock && !mocks.length) return capture();
    panel.hidden = !panel.hidden;
  });
  root
    .querySelector(".close")
    .addEventListener("click", () => setCollapsed(true));
  dot.addEventListener("click", () => setCollapsed(false));
  document.addEventListener("click", (event) => {
    if (!panel.hidden && !event.composedPath().includes(host)) {
      panel.hidden = true;
    }
  });

  render();
  setCollapsed(readStore("localStorage", COLLAPSE_KEY) === "1");
  document.documentElement.appendChild(host);
  // Remembered as the last resort for "back to the device" from a snapshot
  // that carries neither a usable bootstrap nor a data-page.
  if (!inMock)
    writeStore(
      "sessionStorage",
      LAST_DEVICE_KEY,
      location.pathname + location.search,
    );

  // ---- navigation takeover (snapshots only) --------------------------------

  const pageFromHref = (href) => {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return null;
      const match = url.pathname.match(/^\/cgi-bin\/luci(?:$|\/(.*))/);
      if (!match) return null;
      return decodeURIComponent(match[1] || "")
        .split("/")
        .filter(Boolean)
        .join("-");
    } catch {
      return null;
    }
  };

  if (inMock) {
    const byPage = new Map(
      mocks.filter((m) => m.page).map((m) => [m.page, m.file]),
    );
    document.addEventListener(
      "click",
      (event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const target = event.target instanceof Element ? event.target : null;
        const anchor = target && target.closest("a[href]");
        if (!anchor) return;
        const page = pageFromHref(anchor.getAttribute("href"));
        if (page === null) return;
        // Never let a click inside a mock fall through to the proxied router.
        event.preventDefault();
        const file = byPage.get(page);
        if (file) location.href = mockUrl(file);
        else
          toast(
            `未捕获快照：${page || "/cgi-bin/luci"}（真机页 Alt/Option+Shift+S 可捕获）`,
          );
      },
      true,
    );
  }

  // ---- keyboard ------------------------------------------------------------

  const isEditable = (el) =>
    el instanceof Element &&
    (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));

  addEventListener("keydown", (event) => {
    if (isEditable(event.target)) return;
    if (
      !inMock &&
      event.altKey &&
      event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      event.code === "KeyS"
    ) {
      event.preventDefault();
      capture();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "[") cycle(-1);
    else if (event.key === "]") cycle(1);
  });

  if (!inMock) {
    window.__shadcnMockCapture = capture;
    console.info(
      "[shadcn] mock bar ready — 左下角可捕获/打开快照，Alt/Option+Shift+S（或 __shadcnMockCapture()）保存当前页到 .dev/mocks/",
    );
  }
})();
