/**
 * Shadcn dev helper — injected by mock-pages-plugin (vite.config.ts) into
 * every page served under /mocks/. Never ships to the router.
 *
 * 1. Navigation takeover: clicks on the snapshot's own LuCI links
 *    (/cgi-bin/luci/…) resolve against the captured snapshots — matched by
 *    each snapshot's <body data-page>, exact match — and jump to the matching
 *    mock instead of falling through to the proxied router. Uncaptured
 *    targets are blocked with a hint naming the missing snapshot.
 * 2. Floating switcher, bottom-left and out of the page's way. Shadow DOM,
 *    so theme/patch CSS can't restyle it and its styles can't leak into the
 *    page under review. Lists every snapshot, cycles with the ‹/› buttons or
 *    the [ and ] keys, links back to the /mocks/ index.
 *
 * Data contract (injected inline before this script):
 *   window.__SHADCN_MOCKS__ = { current: "<file>", mocks: [{ file, page }] }
 */
(() => {
  "use strict";

  const data = window.__SHADCN_MOCKS__;
  if (!data || !Array.isArray(data.mocks) || !data.mocks.length) return;

  const mocks = data.mocks;
  const byPage = new Map(
    mocks.filter((m) => m.page).map((m) => [m.page, m.file]),
  );
  const current = Math.max(
    mocks.findIndex((m) => m.file === data.current),
    0,
  );

  const mockUrl = (file) => "/mocks/" + encodeURIComponent(file);
  const displayName = (file) => file.replace(/\.html$/, "");
  const escapeHtml = (s) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  // ---- floating switcher ---------------------------------------------------

  const host = document.createElement("shadcn-mock-nav");
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
      .step {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        font-size: 14px;
        opacity: 0.75;
      }
      .step:hover {
        background: rgba(255, 255, 255, 0.14);
        opacity: 1;
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
      <button class="name" title="全部快照"></button>
      <button class="step next" title="下一个快照 ]">›</button>
    </div>
  `;

  const panel = root.querySelector(".panel");
  const toastEl = root.querySelector(".toast");
  const nameBtn = root.querySelector(".name");

  nameBtn.innerHTML =
    escapeHtml(displayName(data.current)) +
    `<span class="count">${current + 1}/${mocks.length}</span>`;

  panel.innerHTML =
    mocks
      .map(
        (m) =>
          `<a href="${mockUrl(m.file)}"` +
          (m.file === data.current ? ' class="current"' : "") +
          ` title="${escapeHtml(m.page || m.file)}">` +
          `${escapeHtml(displayName(m.file))}</a>`,
      )
      .join("") +
    '<div class="foot"><a href="/mocks/">全部快照 ↗</a><span>[ / ] 切换</span></div>';

  const cycle = (step) => {
    if (mocks.length < 2) return;
    const next = mocks[(current + step + mocks.length) % mocks.length];
    location.href = mockUrl(next.file);
  };

  root.querySelector(".prev").addEventListener("click", () => cycle(-1));
  root.querySelector(".next").addEventListener("click", () => cycle(1));
  nameBtn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("click", (event) => {
    if (!panel.hidden && !event.composedPath().includes(host)) {
      panel.hidden = true;
    }
  });

  let toastTimer;
  const toast = (text) => {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  };

  document.documentElement.appendChild(host);

  // ---- navigation takeover -------------------------------------------------

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

  const isEditable = (el) =>
    el instanceof Element &&
    (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));

  addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isEditable(event.target)) return;
    if (event.key === "[") cycle(-1);
    else if (event.key === "]") cycle(1);
  });
})();
