"use strict";
"require baseclass";
"require ui";

/**
 * Shadcn sidebar + menu: empty #sidebar in header.ut, chrome built here.
 * Menu depth matches luci-theme-material (top + one submenu level, tabs for deeper):
 * @see https://github.com/openwrt/luci/blob/master/themes/luci-theme-material/htdocs/luci-static/resources/menu-material.js
 */

/** LuCI menu node `name` → icon basename under /luci-static/shadcn/icons/.
    First-level nodes only — sub-level names such as firewall
    (admin/network/firewall) or opkg (admin/system/opkg) never hit this map
    and were removed as dead entries. */
const ICON_MAP = {
  status: "activity",
  system: "settings",
  network: "network",
  services: "layers",
  nas: "hard-drive",
  control: "sliders-horizontal",
  vpn: "shield",
  docker: "container",
  statistics: "chart-bar",
  nlbw: "gauge",
  /** Covers VoIP/PBX apps — no official OpenWrt package registers a
      verified menu.d node under this name, best-effort key */
  asterisk: "phone",
  /** luci-base `admin/logout` leaf */
  logout: "log-out",
  default: "layout-dashboard",
};

/** sessionStorage key replayed pre-paint by the inline script in header.ut */
const CACHE_KEY = "shadcn.sidebar.cache";

return baseclass.extend({
  __init__() {
    ui.menu.load().then((tree) => {
      this.renderSidebarChrome();
      this.render(tree);
      this.initUciIndicator();
      this.cacheSidebar();
      window.addEventListener("pagehide", () => this.cacheSidebar());
      document.dispatchEvent(new Event("shadcn-sidebar-ready"));
    });
  },

  /**
   * Snapshot the rendered sidebar so header.ut can replay it in the first
   * frame of the next navigation (pagehide keeps accordion/scroll current).
   */
  cacheSidebar() {
    // Set by header.ut's delegated logout-click listener.
    if (window.shadcnSuppressSidebarCache) return;
    const sidebar = document.getElementById("sidebar");
    const nav = document.getElementById("sidebar-nav");
    if (!sidebar || !nav) return;
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          v: 1,
          lang: document.documentElement.lang || "",
          html: sidebar.innerHTML,
          scroll: nav.scrollTop || 0,
        }),
      );
    } catch (e) {
      /* storage full/disabled — next page just builds normally */
    }
  },

  _mediaBase() {
    const fromHtml = document.documentElement.getAttribute("data-shadcn-media");
    const side = document.getElementById("sidebar");
    const fromSide = side && side.getAttribute("data-media");
    const raw = fromHtml || fromSide || "/luci-static/shadcn";
    return String(raw).replace(/\/$/, "");
  },

  _sectionIcon(sectionName, size) {
    const key = String(sectionName || "").toLowerCase();
    const icon = ICON_MAP[key] || ICON_MAP.default;
    return this._iconFile(icon, size);
  },

  /** luci-base menu `admin/logout` — render in sidebar footer, not main nav */
  _isLogoutMenuItem(section) {
    const n = String(
      section && section.name != null ? section.name : "",
    ).toLowerCase();
    return n === "logout" || n.endsWith("/logout");
  },

  _iconFile(name, size) {
    const media = this._mediaBase();
    return E("img", {
      src: `${media}/icons/${name}.svg`,
      width: String(size),
      height: String(size),
      alt: "",
      loading: "lazy",
      class: "shadcn-icon",
    });
  },

  /**
   * LuCI root often has one child (admin / 管理权). Sidebar lists that child’s
   * children — same as material renderModeMenu → renderMainMenu(activeChild).
   */
  _resolveMenuBranch(tree) {
    const dp = L.env.dispatchpath || [];
    const rp = L.env.requestpath || [];
    const top = ui.menu.getChildren(tree);
    let branchName = (rp.length && rp[0]) || (dp.length && dp[0]) || "admin";
    let branch = null;

    for (let i = 0; i < top.length; i++) {
      if (top[i].name === branchName) {
        branch = top[i];
        break;
      }
    }

    if (!branch && top.length === 1) {
      branch = top[0];
      branchName = branch.name;
    }

    if (!branch) branch = tree;

    return { branch, branchUrl: branch.name || branchName };
  },

  /**
   * Mirrors material’s #mainmenu pattern: populate an empty server shell.
   */
  renderSidebarChrome() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (sidebar.getAttribute("data-shadcn-built") === "1") {
      // Restored from cache — chrome exists; just sync a possibly stale hostname.
      const brand = sidebar.querySelector(".sidebar-brand-text");
      const host = sidebar.getAttribute("data-hostname");
      if (brand && host && brand.textContent !== host) brand.textContent = host;
      return;
    }
    sidebar.setAttribute("data-shadcn-built", "1");

    const media = this._mediaBase();
    const host = sidebar.getAttribute("data-hostname") || "Shadcn";

    while (sidebar.firstChild) sidebar.removeChild(sidebar.firstChild);

    sidebar.appendChild(
      E("div", { class: "sidebar-header" }, [
        E("a", { class: "sidebar-brand", href: "/" }, [
          E("img", {
            class: "sidebar-logo",
            src: `${media}/images/logo.svg`,
            alt: "Shadcn",
            width: "24",
            height: "24",
          }),
          E("span", { class: "sidebar-brand-text" }, [host]),
        ]),
        E(
          "button",
          {
            id: "sidebar-toggle-btn",
            class: "sidebar-toggle",
            type: "button",
            "aria-label": _("Toggle sidebar"),
          },
          [
            E("span", { class: "icon-collapse" }, [
              this._iconFile("panel-left-close", 16),
            ]),
            E("span", { class: "icon-expand" }, [
              this._iconFile("panel-left-open", 16),
            ]),
          ],
        ),
      ]),
    );

    sidebar.appendChild(E("nav", { class: "sidebar-nav", id: "sidebar-nav" }));

    sidebar.appendChild(
      E("div", { class: "sidebar-footer", id: "sidebar-footer", hidden: "" }),
    );
  },

  render(tree) {
    const dp = L.env.dispatchpath || [];
    const { branch, branchUrl } = this._resolveMenuBranch(tree);

    this.renderSidebarNav(branch, branchUrl);
    this.renderBreadcrumb(branch, branchUrl);
    this.initSearch(branch, branchUrl);

    const tab = document.getElementById("tabmenu");
    if (tab) {
      tab.innerHTML = "";
      tab.style.display = "none";
    }

    let node = tree;
    let url = "";
    if (dp.length >= 3) {
      for (var i = 0; i < 3 && node; i++) {
        const key = dp[i];
        if (!node.children || !node.children[key]) break;
        node = node.children[key];
        url = url + (url ? "/" : "") + key;
      }
      if (node) this.renderTabMenu(node, url);
    }
  },

  /**
   * Two levels under the active branch (e.g. admin): 状态 → 概览…
   * Matches material renderMainMenu(activeChild) with l <= 2.
   */
  renderSidebarNav(branch, branchUrl) {
    const nav = document.getElementById("sidebar-nav");
    const foot = document.getElementById("sidebar-footer");
    if (!nav) return;

    const children = ui.menu.getChildren(branch);
    const dp = L.env.dispatchpath || [];

    // If header.ut replayed the cached sidebar, this rebuild is a silent
    // refresh — keep the user's accordion/scroll state instead of resetting
    // to the default (active section open, scrolled to top).
    const restored =
      document
        .getElementById("sidebar")
        ?.getAttribute("data-shadcn-restored") === "1";
    const openSections = restored
      ? Array.from(
          nav.querySelectorAll('.sidebar-accordion-item[data-open="true"]'),
          (el) => el.getAttribute("data-section"),
        )
      : null;
    const savedScrollTop = restored ? nav.scrollTop : 0;

    nav.innerHTML = "";
    if (foot) {
      foot.innerHTML = "";
      foot.hidden = true;
    }

    children.forEach((section) => {
      if (this._isLogoutMenuItem(section) && foot) {
        const isActive = dp[1] == section.name;
        const iconEl = this._sectionIcon(section.name, 18);
        foot.appendChild(
          E(
            "a",
            {
              class: "sidebar-logout" + (isActive ? " active" : ""),
              href: L.url(branchUrl, section.name),
              "aria-label": _(section.title),
              onclick: () => {
                if (window.ShadcnSidebar && window.ShadcnSidebar.closeDrawer) {
                  window.ShadcnSidebar.closeDrawer();
                }
              },
            },
            [
              E("span", { class: "sidebar-icon", "aria-hidden": "true" }, [
                iconEl,
              ]),
              E("span", { class: "sidebar-label" }, [_(section.title)]),
            ],
          ),
        );
        foot.hidden = false;
        return;
      }

      const subs = ui.menu.getChildren(section);
      const isActive = dp[1] == section.name;
      const iconEl = this._sectionIcon(section.name, 18);

      if (subs.length === 0) {
        nav.appendChild(
          E(
            "div",
            { class: "sidebar-nav-item" + (isActive ? " active" : "") },
            [
              E(
                "a",
                {
                  class: "sidebar-nav-parent no-sub",
                  href: L.url(branchUrl, section.name),
                  onclick: () => {
                    if (
                      window.ShadcnSidebar &&
                      window.ShadcnSidebar.closeDrawer
                    ) {
                      window.ShadcnSidebar.closeDrawer();
                    }
                  },
                },
                [
                  E("span", { class: "sidebar-icon", "aria-hidden": "true" }, [
                    iconEl,
                  ]),
                  E("span", { class: "sidebar-label" }, [_(section.title)]),
                ],
              ),
            ],
          ),
        );
        return;
      }

      const item = E(
        "div",
        {
          class: "sidebar-accordion-item" + (isActive ? " active" : ""),
          "data-open": isActive ? "true" : "false",
          "data-section": section.name,
        },
        [
          E("button", { class: "sidebar-nav-parent", type: "button" }, [
            E("span", { class: "sidebar-icon", "aria-hidden": "true" }, [
              iconEl,
            ]),
            E("span", { class: "sidebar-label" }, [_(section.title)]),
            E("span", { class: "sidebar-chevron", "aria-hidden": "true" }, [
              this._iconFile("chevron-down", 18),
            ]),
          ]),
          E("div", { class: "sidebar-accordion-sub" }, [
            E(
              "ul",
              { class: "sidebar-sub-list" },
              subs.map((page) => {
                const isPageActive = isActive && dp[2] == page.name;
                return E(
                  "li",
                  {
                    class: "sidebar-sub-item" + (isPageActive ? " active" : ""),
                  },
                  [
                    E(
                      "a",
                      {
                        class: "sidebar-sub-link",
                        href: L.url(branchUrl, section.name, page.name),
                        onclick: () => {
                          if (
                            window.ShadcnSidebar &&
                            window.ShadcnSidebar.closeDrawer
                          ) {
                            window.ShadcnSidebar.closeDrawer();
                          }
                        },
                      },
                      [_(page.title)],
                    ),
                  ],
                );
              }),
            ),
          ]),
        ],
      );

      nav.appendChild(item);
    });

    if (restored) {
      nav.querySelectorAll(".sidebar-accordion-item").forEach((item) => {
        item.setAttribute(
          "data-open",
          openSections.includes(item.getAttribute("data-section"))
            ? "true"
            : "false",
        );
      });
      nav.scrollTop = savedScrollTop;
    }
  },

  /**
   * Topbar route search (C1): persistent input in the card header (markup
   * lives in header.ut), results dropdown built here on demand. The index
   * is the same two-level navigation model the sidebar renders from — no
   * extra requests. ⌘K / Ctrl+K focuses the input globally; <md a toggle
   * button turns the topbar into a full-width search bar instead.
   * The theme ships no translations of its own — it reuses existing LuCI
   * msgids (see header.ut for the search chrome's i18n specifics).
   */
  initSearch(branch, branchUrl) {
    const wrap = document.getElementById("topbar-search");
    const input = document.getElementById("topbar-search-input");
    const pop = document.getElementById("topbar-search-pop");
    if (!wrap || !input || !pop || this.searchIndex) return;

    this.searchIndex = [];
    ui.menu.getChildren(branch).forEach((section) => {
      if (this._isLogoutMenuItem(section)) return;
      const subs = ui.menu.getChildren(section);
      if (subs.length === 0) {
        this.searchIndex.push({
          title: _(section.title),
          name: section.name,
          group: null,
          icon: section.name,
          href: L.url(branchUrl, section.name),
        });
        return;
      }
      subs.forEach((page) => {
        this.searchIndex.push({
          title: _(page.title),
          name: page.name,
          group: _(section.title),
          icon: section.name,
          href: L.url(branchUrl, section.name, page.name),
        });
      });
    });

    this.searchWrap = wrap;
    this.searchInput = input;
    this.searchPop = pop;
    this.searchOpenBtn = document.getElementById("topbar-search-open");

    const isMac = /Mac|iP(ad|hone|od)/.test(navigator.platform);
    const keyEl = wrap.querySelector(".topbar-search-key");
    if (keyEl) {
      keyEl.textContent = isMac ? "⌘K" : "Ctrl+K";
      keyEl.hidden = false;
    }
    input.setAttribute("aria-keyshortcuts", isMac ? "Meta+K" : "Control+K");

    input.addEventListener("input", () =>
      this.renderSearchResults(input.value),
    );
    // Refocusing a non-empty input brings its dropdown back.
    input.addEventListener("focus", () =>
      this.renderSearchResults(input.value),
    );
    input.addEventListener("keydown", (e) => {
      // Mid-composition these keys belong to the IME: Enter commits the
      // buffer (navigating away for pinyin users) and arrows move inside
      // the candidate list, not the results.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        // A desktop Escape hides the dropdown but keeps its rows — arrows
        // reopen it instead of moving an invisible selection.
        if (pop.hidden) this.renderSearchResults(input.value);
        else this.moveSearchSelection(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Enter" && !pop.hidden) {
        pop.querySelector(".is-selected")?.click();
      }
    });

    // mousemove, not mouseover: scrollIntoView() slides rows under a
    // stationary pointer, which fires mouseover and would snap the
    // selection back to whatever the mouse happens to rest on.
    pop.addEventListener("mousemove", (e) => {
      const row = e.target?.closest?.(".topbar-search-result");
      if (row && !row.classList.contains("is-selected"))
        this.setSearchSelection(row);
    });

    if (this.searchOpenBtn)
      this.searchOpenBtn.addEventListener("click", () => this.openSearch());
    const cancel = document.getElementById("topbar-search-cancel");
    if (cancel) cancel.addEventListener("click", () => this.closeSearch());

    document.addEventListener("keydown", (e) => {
      // An IME swallows these keys while composing (Esc cancels the
      // composition, not the dropdown); keyCode 229 covers engines that
      // don't set isComposing on the trailing keydown.
      if (e.isComposing || e.keyCode === 229) return;
      // Only the advertised shortcut — ⌘K on Mac, Ctrl+K elsewhere — so
      // macOS Ctrl+K (kill-to-end-of-line in text fields) keeps working.
      if (
        (isMac ? e.metaKey : e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key || "").toLowerCase() === "k"
      ) {
        e.preventDefault();
        this.openSearch();
      } else if (e.key === "Escape") {
        this.closeSearch();
      }
    });

    // Clicking/tapping outside dismisses the dropdown (desktop only — the
    // mobile takeover has no outside and exits via Cancel/Escape).
    document.addEventListener("pointerdown", (e) => {
      if (
        !pop.hidden &&
        document.body.getAttribute("data-topbar-search") !== "open" &&
        !wrap.contains(e.target)
      )
        pop.hidden = true;
    });
  },

  openSearch() {
    // The mobile entry button is only displayed <md — its visibility says
    // whether the takeover applies without hard-coding the breakpoint.
    if (this.searchOpenBtn && this.searchOpenBtn.offsetParent !== null) {
      document.body.setAttribute("data-topbar-search", "open");
      // Full-screen surface: the (possibly empty) results panel covers the
      // page immediately, before the first keystroke.
      this.renderSearchResults(this.searchInput.value);
    }
    this.searchInput.focus();
    this.searchInput.select();
  },

  closeSearch() {
    if (document.body.getAttribute("data-topbar-search") === "open") {
      // Mobile takeover dismissal resets like a dialog close.
      document.body.removeAttribute("data-topbar-search");
      this.searchInput.value = "";
      this.searchPop.hidden = true;
      this.searchPop.replaceChildren();
      this.searchInput.blur();
      return;
    }
    // Desktop Escape only hides the dropdown; text stays for refinement.
    if (!this.searchPop.hidden) this.searchPop.hidden = true;
  },

  renderSearchResults(value) {
    const q = value.trim().toLowerCase();
    if (!q) {
      // Quiet until typed (Spotlight manner) — except during the mobile
      // takeover, where the empty panel stays up as the page cover.
      this.searchPop.replaceChildren();
      this.searchPop.hidden =
        document.body.getAttribute("data-topbar-search") !== "open";
      return;
    }

    const matches = this.searchIndex.filter(
      (page) =>
        page.title.toLowerCase().includes(q) ||
        page.name.toLowerCase().includes(q) ||
        page.group?.toLowerCase().includes(q),
    );

    const rows = matches.length
      ? matches.map((page, i) =>
          E(
            "a",
            {
              class: `topbar-search-result${i ? "" : " is-selected"}`,
              href: page.href,
            },
            [
              this._sectionIcon(page.icon, 15),
              page.group
                ? E(
                    "span",
                    { class: "result-group" },
                    this.highlightSearchMatch(page.group, q),
                  )
                : "",
              page.group ? E("span", { class: "result-sep" }, ["›"]) : "",
              E(
                "span",
                { class: "result-title" },
                this.highlightSearchMatch(page.title, q),
              ),
              E("kbd", { class: "result-enter" }, ["↵"]),
            ],
          ),
        )
      : [
          E("div", { class: "topbar-search-empty" }, [
            _("No entries available"),
          ]),
        ];

    this.searchPop.replaceChildren(
      E("div", { class: "topbar-search-list" }, rows),
    );
    this.searchPop.hidden = false;
  },

  highlightSearchMatch(title, q) {
    const lower = title.toLowerCase();
    // Case folding can change string length ("İ" → "i̇"), skewing offsets
    // into the original — skip highlighting rather than mis-slice.
    const at = lower.length === title.length ? lower.indexOf(q) : -1;
    if (at < 0) return [title];

    return [
      title.slice(0, at),
      E("mark", {}, [title.slice(at, at + q.length)]),
      title.slice(at + q.length),
    ];
  },

  setSearchSelection(row) {
    this.searchPop
      .querySelector(".is-selected")
      ?.classList.remove("is-selected");
    row.classList.add("is-selected");
  },

  moveSearchSelection(delta) {
    const rows = [...this.searchPop.querySelectorAll(".topbar-search-result")];
    if (!rows.length) return;

    const current = rows.findIndex((row) =>
      row.classList.contains("is-selected"),
    );
    const next = rows[(current + delta + rows.length) % rows.length];

    this.setSearchSelection(next);
    next.scrollIntoView({ block: "nearest" });
  },

  renderBreadcrumb(branch, branchUrl) {
    const crumb = document.getElementById("topbar-breadcrumb");
    if (!crumb) return;

    crumb.innerHTML = "";

    const dp = L.env.dispatchpath || [];
    const activeSection = dp[1] || "";
    const activePage = dp[2] || "";

    const ch = branch.children || {};
    const sectionNode = ch[activeSection];
    const pageNode =
      sectionNode && sectionNode.children
        ? sectionNode.children[activePage]
        : null;

    if (sectionNode) {
      crumb.appendChild(
        E("span", { class: "breadcrumb-item" }, [_(sectionNode.title)]),
      );
    }
    if (pageNode) {
      crumb.appendChild(
        E("span", { class: "breadcrumb-sep" }, [
          this._iconFile("chevron-right", 14),
        ]),
      );
      crumb.appendChild(
        E("span", { class: "breadcrumb-item active" }, [_(pageNode.title)]),
      );
    }
  },

  /** Ported from menu-material.js renderTabMenu (recursive tab rows). */
  renderTabMenu(tree, url, level) {
    const container = document.getElementById("tabmenu");
    if (!container) return;

    const l = (level || 0) + 1;
    const ul = E("ul", { class: "tabs" });
    const children = ui.menu.getChildren(tree);
    let activeNode = null;

    if (children.length === 0) return;

    const dp = L.env.dispatchpath || [];

    children.forEach((child) => {
      const isActive = dp[l + 2] == child.name;
      const activeClass = isActive ? " active" : "";
      const className = "tabmenu-item-%s %s".format(child.name, activeClass);

      ul.appendChild(
        E("li", { class: className }, [
          E("a", { href: L.url(url, child.name) }, [_(child.title)]),
        ]),
      );

      if (isActive) activeNode = child;
    });

    container.appendChild(ul);
    container.style.display = "";

    if (activeNode)
      this.renderTabMenu(activeNode, url + "/" + activeNode.name, l);

    return ul;
  },

  initUciIndicator() {
    const original = ui.changes && ui.changes.setIndicator;
    if (!original) return;
    ui.changes.setIndicator = function (n) {
      original.call(this, n);
      document
        .querySelectorAll('[data-indicator="uci-changes"]')
        .forEach((el) => {
          el.setAttribute("data-count", n || 0);
        });
    };
  },
});
