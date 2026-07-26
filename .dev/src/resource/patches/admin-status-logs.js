"use strict";
/* Shadcn log viewer — enhances the read-only <textarea id="syslog"> on the
   System Log and Kernel Log pages (both under admin/status/logs/* on every
   supported release, so this one patch name covers them) into a parsed,
   column-aligned view. The textarea stays in the DOM as the data source:
   LuCI's own poll keeps rewriting its .value, which never fires events or
   mutations, so a cheap dirty-check interval re-reads it instead. When too
   few lines parse (PARSE_GATE), the enhancement tears itself down and the
   stock textarea shows again — the worst case is the styled status quo,
   never a garbled log. Node tests require() the parsing exports below. */
(function () {
  // RFC 5424 short names exactly as LuCI emits them. tools/views.js reads the
  // untranslated slot of its tables and ubox logread prints C-locale names, so
  // UI language never changes these. A line whose facility/severity falls
  // outside the whitelists is not a log format we know — shown raw, uncolored.
  const FACILITIES = new Set([
    "kern",
    "user",
    "mail",
    "daemon",
    "auth",
    "syslog",
    "lpr",
    "news",
    "uucp",
    "cron",
    "authpriv",
    "ftp",
    "ntp",
    "security",
    "console",
    "local0",
    "local1",
    "local2",
    "local3",
    "local4",
    "local5",
    "local6",
    "local7",
    "unknown",
  ]);
  const SEVERITIES = new Set([
    "emerg",
    "alert",
    "crit",
    "err",
    "warn",
    "notice",
    "info",
    "debug",
  ]);
  const SEV_CLASS = {
    emerg: "crit",
    alert: "crit",
    crit: "crit",
    err: "err",
    warn: "warn",
    notice: "notice",
    info: "info",
    debug: "debug",
  };
  // Below this parse-success ratio the value is not a log we understand
  // (syslog-ng replacement, future format change) — fall back to the textarea.
  const PARSE_GATE = 0.8;

  function splitTag(rest) {
    // `tag[pid]: msg` / `tag: msg`; tags with spaces (kernel's
    // "mt7921e 0000:01:00.0:") deliberately fail into plain msg.
    const m = rest.match(/^([A-Za-z0-9_.\/-]+(?:\[\d+\])?):\s+([\s\S]*)$/);
    return m ? { tag: m[1], msg: m[2] } : { tag: "", msg: rest };
  }

  // Compress "Jul 24, 2026, 10:59:50 PM UTC"-style stamps (master's RPC path
  // formats with the *browser* locale). Only en-style patterns are recognized;
  // anything else is shown untouched rather than guessed at.
  function shortenTime(datestr) {
    const m = datestr.match(
      /^(\w{3}) (\d{1,2}), \d{4}, (\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/,
    );
    if (!m) return datestr;
    let h = parseInt(m[3], 10);
    if (m[6] === "PM" && h < 12) h += 12;
    if (m[6] === "AM" && h === 12) h = 0;
    const hh = (h < 10 ? "0" : "") + h;
    return `${m[1]} ${m[2].padStart(2, "0")} ${hh}:${m[4]}:${m[5]}`;
  }

  /* System log line, two shapes:
     A (master RPC):      [<locale datestr>] fac.sev: tag[pid]: msg
     B (classic logread,  Www Mmm dd hh:mm:ss yyyy fac.sev tag[pid]: msg
        23.05 + 24.10 syslog-wrapper + master's RPC-failure fallback) */
  function parseSyslogLine(line) {
    let m = line.match(/^\[(.+?)\]\s+(\w+)\.(\w+):\s+([\s\S]*)$/);
    if (m && FACILITIES.has(m[2]) && SEVERITIES.has(m[3]))
      return {
        time: shortenTime(m[1]),
        fullTime: m[1],
        fac: m[2],
        sev: m[3],
        ...splitTag(m[4]),
      };
    m = line.match(
      /^\w{3} (\w{3}) +(\d{1,2}) (\d{2}:\d{2}:\d{2}) (\d{4}) (\w+)\.(\w+) ([\s\S]*)$/,
    );
    if (m && FACILITIES.has(m[5]) && SEVERITIES.has(m[6]))
      return {
        time: `${m[1]} ${m[2].padStart(2, "0")} ${m[3]}`,
        fullTime: line.slice(0, line.indexOf(` ${m[5]}.${m[6]} `)),
        fac: m[5],
        sev: m[6],
        ...splitTag(m[7]),
      };
    return null;
  }

  /* Kernel log line: `[   73412.882110] msg`. No severity survives into the
     text on any LuCI version (both eras strip/drop the <N> prefix), so dmesg
     gets time/tag/typography only — no level colors, no keyword guessing. */
  function parseDmesgLine(line) {
    const m = line.match(/^\[\s*(\d+\.\d+)\]\s?([\s\S]*)$/);
    if (!m) return null;
    return {
      time: `[${m[1]}]`,
      fullTime: "",
      fac: "",
      sev: "",
      ...splitTag(m[2]),
    };
  }

  function evaluate(value, parseLine) {
    const lines = value ? value.split(/\n/) : [];
    const rows = lines.map((line) => ({ line, parsed: parseLine(line) }));
    const parsed = rows.reduce((n, r) => n + (r.parsed ? 1 : 0), 0);
    return { rows, ratio: rows.length ? parsed / rows.length : 1 };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      parseSyslogLine,
      parseDmesgLine,
      splitTag,
      shortenTime,
      evaluate,
      PARSE_GATE,
    };
  }
  if (typeof document === "undefined") return;

  // Kernel-log page under either menu layout: admin-status-dmesg on
  // 23.05/24.10, admin-status-logs-dmesg on master's combined Logs menu.
  const page = document.body?.dataset?.page || "";
  const parseLine = /(^|-)dmesg(-|$)/.test(page)
    ? parseDmesgLine
    : parseSyslogLine;

  let viewer = null;
  let lastValue = null;

  function span(cls, text, title) {
    const el = document.createElement("span");
    el.className = cls;
    el.textContent = text;
    if (title) el.title = title;
    return el;
  }

  function buildRow(entry) {
    const row = document.createElement("div");
    if (!entry.parsed) {
      row.className = "log-row";
      row.textContent = entry.line;
      return row;
    }
    const p = entry.parsed;
    row.className = "log-row" + (p.sev ? ` lv-${SEV_CLASS[p.sev]}` : "");
    // Real space text nodes between plain inline spans: the row wraps like
    // terminal output and selection copies clean text. The level is the short
    // severity word (CSS uppercases and colors it; facility lives in its
    // tooltip); the source keeps its full name in a tooltip for when the
    // aligned column truncates it.
    row.appendChild(span("log-time", p.time, p.fullTime));
    if (p.sev) {
      row.appendChild(document.createTextNode(" "));
      row.appendChild(span("log-sev", p.sev, `${p.fac}.${p.sev}`));
    }
    if (p.tag) {
      row.appendChild(document.createTextNode(" "));
      row.appendChild(span("log-tag", p.tag, p.tag));
    }
    row.appendChild(document.createTextNode(" "));
    row.appendChild(span("log-msg", p.msg));
    return row;
  }

  function selectionInside(el) {
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed) return false;
    return el.contains(sel.anchorNode) || el.contains(sel.focusNode);
  }

  function teardown(container) {
    if (viewer) viewer.remove();
    viewer = null;
    container.classList.remove("log-enhanced");
  }

  function render(textarea, container, rows) {
    if (!viewer) {
      viewer = document.createElement("div");
      viewer.className = "syslog-view";
      textarea.insertAdjacentElement("afterend", viewer);
      container.classList.add("log-enhanced");
    }
    const frag = document.createDocumentFragment();
    for (const entry of rows) frag.appendChild(buildRow(entry));
    viewer.replaceChildren(frag);
  }

  function tick() {
    const textarea = document.getElementById("syslog");
    const container = document.getElementById("content_syslog");
    if (!textarea || !container) return;
    const value = textarea.value;
    if (value === lastValue) return;
    // Re-rendering would destroy an in-progress selection; retry next tick.
    if (viewer && selectionInside(viewer)) return;
    lastValue = value;
    const { rows, ratio } = evaluate(value, parseLine);
    if (ratio >= PARSE_GATE) render(textarea, container, rows);
    else teardown(container);
  }

  // Content updates: LuCI's poll rewrites .value, which fires nothing — a
  // cheap dirty-check covers it.
  setInterval(tick, 1000);

  // First paint: the view (and its textarea) is inserted asynchronously by
  // LuCI after this script runs. Element insertion IS an observable childList
  // mutation (unlike .value writes), and the callback runs as a microtask
  // before the browser paints the inserted textarea — so the viewer takes
  // over without a flash of the raw log.
  if (document.getElementById("syslog")) {
    tick();
  } else {
    const arrival = new MutationObserver(function () {
      if (!document.getElementById("syslog")) return;
      arrival.disconnect();
      tick();
    });
    arrival.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
