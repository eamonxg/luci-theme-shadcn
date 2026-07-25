/**
 * Shadcn dev helper — injected by the /cgi-bin dev proxy (vite.config.ts)
 * into real device-served LuCI pages. Never ships to the router.
 *
 * Alt/Option+Shift+S — or __shadcnMockCapture() from the console — POSTs the
 * live DOM to /mocks/__save, which writes .dev/mocks/<data-page>.html for the
 * /mocks/ workflow (see "Mock Pages" in .dev/docs/DEVELOPMENT.md).
 */
(() => {
  "use strict";

  // Mock pages are served, not proxied, so this only runs on real pages —
  // the guard is just belt and braces against a stale captured tag.
  if (window.__shadcnMockCapture || location.pathname.startsWith("/mocks/"))
    return;

  let toastEl;
  let toastTimer;
  const toast = (text, ok) => {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.cssText =
        "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);" +
        "z-index:2147483647;padding:9px 14px;border-radius:10px;" +
        "font:13px/1.5 system-ui,-apple-system,sans-serif;" +
        "background:rgba(18,18,24,.9);box-shadow:0 8px 32px rgba(0,0,0,.35);" +
        "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);" +
        "transition:opacity 160ms ease;pointer-events:none;max-width:80vw";
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.color = ok ? "#4ade80" : "#ffd166";
    toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.style.opacity = "0"), 3000);
  };

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
      toast(`已捕获 ${info.file} — 在 /mocks/ 打开`, true);
    } catch (err) {
      toast(`捕获失败：${(err && err.message) || err}`, false);
    }
  };

  window.__shadcnMockCapture = capture;

  addEventListener("keydown", (event) => {
    if (
      event.altKey &&
      event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      event.code === "KeyS"
    ) {
      event.preventDefault();
      capture();
    }
  });

  console.info(
    "[shadcn] mock capture ready — Alt/Option+Shift+S（或 __shadcnMockCapture()）保存当前页到 .dev/mocks/",
  );
})();
