"use strict";
"require baseclass";

const THEME_KEY = "shadcn.theme";
const SIDEBAR_KEY = "shadcn.sidebar";

return baseclass.extend({
  __init__() {
    this.initTheme();
    this.initSidebar();
    this.initMobileDrawer();
    this.initThemeToggle();
  },

  /* ── Theme ── */

  initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "device";
    this.applyTheme(saved);
  },

  applyTheme(theme) {
    const isDark =
      theme === "dark" ||
      (theme === "device" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-darkmode", isDark);
    localStorage.setItem(THEME_KEY, theme);
    this._updateThemeIcon(isDark);
  },

  _updateThemeIcon(isDark) {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    const img = btn.querySelector("img");
    if (!img) return;
    const media =
      document.documentElement.getAttribute("data-shadcn-media") ||
      "/luci-static/shadcn";
    const base = String(media).replace(/\/$/, "");
    img.src = base + (isDark ? "/icons/moon.svg" : "/icons/sun.svg");
  },

  initThemeToggle() {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const isDark =
        document.documentElement.getAttribute("data-darkmode") === "true";
      this.applyTheme(isDark ? "light" : "dark");
    });
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if ((localStorage.getItem(THEME_KEY) || "device") === "device") {
          this.applyTheme("device");
        }
      });
  },

  /* ── Sidebar collapse (desktop icon rail) ── */

  initSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const bp = getComputedStyle(document.documentElement)
      .getPropertyValue("--breakpoint-md")
      .trim();
    this._mobileQuery = window.matchMedia(`(width < ${bp})`);
    this._mobileQuery.addEventListener("change", (e) => {
      if (!e.matches) this._hideCollapsedPopover();
    });

    const collapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
    sidebar.setAttribute("data-collapsed", collapsed);

    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        if (this._mobileQuery.matches) {
          this.closeDrawer();
        } else {
          this.toggleCollapse();
        }
      });
    }

    this._initAccordion();
    this._initCollapsedPopover();
  },

  toggleCollapse() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const next = sidebar.getAttribute("data-collapsed") !== "true";
    sidebar.setAttribute("data-collapsed", next);
    document.documentElement.setAttribute(
      "data-sidebar-collapsed",
      next ? "true" : "false",
    );
    localStorage.setItem(SIDEBAR_KEY, next);

    this._hideCollapsedPopover();

    if (next) {
      document
        .querySelectorAll(".sidebar-accordion-item[data-open='true']")
        .forEach((item) => {
          this._closeAccordionItem(item);
        });
    }
  },

  /* ── Collapsed hover popover ── */

  _initCollapsedPopover() {
    document.addEventListener("mouseover", (e) => {
      const sidebar = document.getElementById("sidebar");
      if (sidebar?.getAttribute("data-collapsed") !== "true") return;

      if (e.target.closest("#sidebar-collapsed-popover")) {
        clearTimeout(this._popoverTimer);
        return;
      }

      const item = e.target.closest(".sidebar-accordion-item");
      if (item) {
        clearTimeout(this._popoverTimer);
        this._showCollapsedPopover(item);
      }
    });

    document.addEventListener("mouseout", (e) => {
      const sidebar = document.getElementById("sidebar");
      if (sidebar?.getAttribute("data-collapsed") !== "true") return;

      const isFromRelevant =
        e.target.closest(".sidebar-accordion-item") ||
        e.target.closest("#sidebar-collapsed-popover");
      if (!isFromRelevant) return;

      const to = e.relatedTarget;
      const isToRelevant =
        to &&
        (to.closest(".sidebar-accordion-item") ||
          to.closest("#sidebar-collapsed-popover"));

      if (!isToRelevant) {
        this._popoverTimer = setTimeout(
          () => this._hideCollapsedPopover(),
          100,
        );
      }
    });
  },

  _showCollapsedPopover(item) {
    const section = item.getAttribute("data-section") || "";
    const existing = document.getElementById("sidebar-collapsed-popover");
    if (existing && existing.getAttribute("data-section") === section) return;

    this._hideCollapsedPopover();

    const links = item.querySelectorAll(".sidebar-sub-link");
    if (!links.length) return;

    const label = item.querySelector(".sidebar-label");
    const title = label ? label.textContent.trim() : "";

    const popover = document.createElement("div");
    popover.id = "sidebar-collapsed-popover";
    popover.className = "sidebar-collapsed-popover";
    popover.setAttribute("data-section", section);

    if (title) {
      const h = document.createElement("div");
      h.className = "sidebar-collapsed-popover-title";
      h.textContent = title;
      popover.appendChild(h);
    }

    const ul = document.createElement("ul");
    ul.className = "sidebar-collapsed-popover-list";

    links.forEach((link) => {
      const isActive = link
        .closest(".sidebar-sub-item")
        ?.classList.contains("active");
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = link.href;
      a.className =
        "sidebar-collapsed-popover-link" + (isActive ? " active" : "");
      a.textContent = link.textContent;
      li.appendChild(a);
      ul.appendChild(li);
    });

    popover.appendChild(ul);
    document.body.appendChild(popover);

    const sidebar = document.getElementById("sidebar");
    const sidebarRect = sidebar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    popover.style.left = sidebarRect.right + 4 + "px";

    const top = Math.min(
      itemRect.top,
      window.innerHeight - popover.offsetHeight - 8,
    );
    popover.style.top = Math.max(8, top) + "px";
  },

  _hideCollapsedPopover() {
    clearTimeout(this._popoverTimer);
    const el = document.getElementById("sidebar-collapsed-popover");
    if (el) el.remove();
  },

  /* ── Accordion ── */

  _initAccordion() {
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest(".sidebar-nav-parent");
      if (!trigger) return;

      const sidebar = document.getElementById("sidebar");
      if (sidebar?.getAttribute("data-collapsed") === "true") return;

      const item = trigger.closest(".sidebar-accordion-item");
      if (!item) return;

      const isOpen = item.getAttribute("data-open") === "true";

      document
        .querySelectorAll(".sidebar-accordion-item[data-open='true']")
        .forEach((other) => {
          if (other !== item) this._closeAccordionItem(other);
        });

      if (isOpen) {
        this._closeAccordionItem(item);
      } else {
        this._openAccordionItem(item);
      }
    });
  },

  _openAccordionItem(item) {
    const sub = item.querySelector(".sidebar-accordion-sub");
    if (!sub) return;
    item.setAttribute("data-open", "true");
    sub.style.maxHeight = sub.scrollHeight + "px";
  },

  _closeAccordionItem(item) {
    const sub = item.querySelector(".sidebar-accordion-sub");
    if (!sub) return;
    item.setAttribute("data-open", "false");
    sub.style.maxHeight = "0";
  },

  /* ── Mobile drawer ── */

  initMobileDrawer() {
    const hamburger = document.getElementById("sidebar-hamburger");
    const overlay = document.getElementById("sidebar-overlay");

    if (hamburger) {
      hamburger.addEventListener("click", () => this.openDrawer());
    }
    if (overlay) {
      overlay.addEventListener("click", () => this.closeDrawer());
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeDrawer();
    });
  },

  openDrawer() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;
    sidebar.setAttribute("data-drawer-open", "true");
    overlay?.classList.add("active");
    document.body.style.overflow = "hidden";
  },

  closeDrawer() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;
    sidebar.setAttribute("data-drawer-open", "false");
    overlay?.classList.remove("active");
    document.body.style.overflow = "";
  },
});
