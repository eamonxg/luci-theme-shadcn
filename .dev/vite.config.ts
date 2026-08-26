/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 *
 * Theme identity is in luci-theme.config.js. The dev/serve layer (local
 * serve, mock pages, .ut sync, redirect) and the client router come from
 * @eamonxg/luci-theme-devkit; only the build transforms that shape THIS
 * theme's htdocs output stay here.
 */

import tailwindcss from "@tailwindcss/vite";
import { luciRouter } from "@eamonxg/luci-theme-devkit/vite/router";
import { luciDev, injectMockBar } from "@eamonxg/luci-theme-devkit/vite/dev";
import { existsSync, readdirSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { minify as terserMinify } from "terser";
import { defineConfig, loadEnv, Plugin, ResolvedConfig } from "vite";
import config from "./luci-theme.config.js";

const CURRENT_DIR = process.cwd();
const PROJECT_ROOT = resolve(CURRENT_DIR, "..");
const BUILD_OUTPUT = resolve(PROJECT_ROOT, "htdocs/luci-static");
const PATCH_SRC_DIR = resolve(CURRENT_DIR, "src/media/patches");

// See luci-theme.config.js. Currently empty: the log viewer needs only
// admin-status-logs, whose prefix covers both log pages on every release.
const PATCH_ALIASES: Record<string, string[]> = config.patchAliases ?? {};

const tag = (name: string): string =>
  `${new Date().toLocaleTimeString("en-US")} [${name}]`;

function createLuciJsCompressPlugin(): Plugin {
  let outDir: string;

  return {
    name: "luci-js-compress",
    apply: "build",
    configResolved(config: ResolvedConfig) {
      outDir = config.build.outDir;
    },
    async generateBundle() {
      const srcDir = resolve(CURRENT_DIR, "src/resource");
      const jsFiles = (await readdir(srcDir, { recursive: true })).filter((f) =>
        f.endsWith(".js"),
      );
      await Promise.all(
        jsFiles.map(async (relPath) => {
          const normalized = relPath.replace(/\\/g, "/");
          try {
            const sourceCode = await readFile(join(srcDir, relPath), "utf-8");
            const compressed = await terserMinify(sourceCode, {
              parse: { bare_returns: true },
              compress: { directives: false, passes: 2 },
              mangle: { toplevel: false },
              format: { comments: false, beautify: false },
            });
            // patches/* are payloads of the on-demand patches mechanism and
            // ship next to the CSS patches (media dir), not under resources/.
            const stem = normalized.startsWith("patches/")
              ? normalized.slice("patches/".length, -".js".length)
              : null;
            const outputPaths = stem
              ? [stem, ...(PATCH_ALIASES[stem] ?? [])].map((p) =>
                  join(outDir, "shadcn", "patches", `${p}.js`),
                )
              : [join(outDir, "resources", normalized)];
            for (const outputPath of outputPaths) {
              await mkdir(dirname(outputPath), { recursive: true });
              await writeFile(
                outputPath,
                compressed.code || sourceCode,
                "utf-8",
              );
            }
          } catch (error: any) {
            console.error(
              `${tag("JS Compress")} src/resource/${normalized}: ${error?.message}`,
            );
          }
        }),
      );
    },
  };
}

/* Duplicate built CSS patches under their PATCH_ALIASES names (JS aliases are
   handled inside the compress plugin). Runs post-bundle because the sources
   are Rollup entries. */
function createPatchAliasPlugin(): Plugin {
  return {
    name: "patch-alias",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      for (const [stem, aliases] of Object.entries(PATCH_ALIASES)) {
        const source = resolve(BUILD_OUTPUT, `shadcn/patches/${stem}.css`);
        if (!existsSync(source)) continue;
        const css = await readFile(source, "utf-8");
        for (const alias of aliases)
          await writeFile(
            resolve(BUILD_OUTPUT, `shadcn/patches/${alias}.css`),
            css,
            "utf-8",
          );
      }
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, CURRENT_DIR);
  // VITE_OPENWRT_HOST is just the router address — a bare IP/hostname like
  // 192.168.1.1 (host:port and http:// URL forms also work). The web proxy
  // target and the .ut-sync ssh target are both derived from it; ssh key
  // selection etc. belongs in ~/.ssh/config, not here.
  const OPENWRT_RAW = env.VITE_OPENWRT_HOST || "192.168.1.1";
  const OPENWRT = new URL(
    /^https?:\/\//.test(OPENWRT_RAW) ? OPENWRT_RAW : `http://${OPENWRT_RAW}`,
  );
  const OPENWRT_URL = OPENWRT.origin;
  const OPENWRT_SSH_HOST = `root@${OPENWRT.hostname}`;
  const DEV_HOST = env.VITE_DEV_HOST || "127.0.0.1";
  const DEV_PORT = Number(env.VITE_DEV_PORT) || 5173;

  return {
    // Production assets are installed below /luci-static/. Keep the dev base
    // at / so the proxy and injected Vite client retain their existing URLs.
    base: command === "build" ? "/luci-static/" : "/",
    plugins: [
      tailwindcss(),
      luciRouter({ name: config.name }),
      ...luciDev(config, { sshHost: OPENWRT_SSH_HOST }),
      createLuciJsCompressPlugin(),
      createPatchAliasPlugin(),
    ],
    build: {
      outDir: BUILD_OUTPUT,
      emptyOutDir: false,
      cssMinify: "lightningcss",
      rollupOptions: {
        input: {
          main: resolve(CURRENT_DIR, "src/media/main.css"),
          login: resolve(CURRENT_DIR, "src/media/login.css"),
          // On-demand third-party patches: one entry per page, output to
          // shadcn/patches/<page>.css (the `patches/` key prefix lands them there
          // via assetFileNames below). header.ut links the matching one per page.
          // `_`-prefixed files are shared partials @imported by entries, not
          // entries themselves (they'd otherwise ship as never-matching patches).
          ...Object.fromEntries(
            (existsSync(PATCH_SRC_DIR) ? readdirSync(PATCH_SRC_DIR) : [])
              .filter((f) => f.endsWith(".css") && !f.startsWith("_"))
              .map((f) => [
                `patches/${f.slice(0, -4)}`,
                join(PATCH_SRC_DIR, f),
              ]),
          ),
        },
        output: { assetFileNames: "shadcn/[name].[ext]" },
      },
    },
    server: {
      host: DEV_HOST,
      port: DEV_PORT,
      proxy: {
        "/luci-static": {
          target: OPENWRT_URL,
          changeOrigin: true,
          secure: false,
        },
        "/cgi-bin": {
          target: OPENWRT_URL,
          changeOrigin: true,
          secure: false,
          // We write every response ourselves in `proxyRes` below, so the Vite
          // client can be injected into proxied LuCI HTML.
          selfHandleResponse: true,
          configure: (proxy) => {
            // Force an uncompressed upstream response: the HTML injection below
            // treats the body as UTF-8 text and would corrupt a gzipped payload.
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("accept-encoding");
            });
            proxy.on("proxyRes", (proxyRes, req, res) => {
              const status = proxyRes.statusCode ?? 200;
              const ct = proxyRes.headers["content-type"] || "";
              if (!ct.includes("text/html")) {
                res.writeHead(status, proxyRes.headers);
                proxyRes.pipe(res);
                return;
              }
              const chunks: Buffer[] = [];
              proxyRes.on("data", (c: Buffer) => chunks.push(c));
              proxyRes.on("end", () => {
                let html = Buffer.concat(chunks).toString("utf-8");
                const client = `<script type="module" src="/@vite/client"></script>`;
                if (
                  html.includes("</head>") &&
                  !html.includes("/@vite/client")
                ) {
                  html = html.replace("</head>", `${client}\n\t</head>`);
                }
                // Real device pages also get the mock bar, so the snapshot
                // workflow is one click away instead of a URL to remember:
                // it lists what .dev/mocks/ holds, opens this page's own
                // snapshot when there is one, and captures the open page
                // (same as Alt/Option+Shift+S). `current` is null — a live
                // page is not itself a snapshot.
                if (html.includes("</head>") && !html.includes("/__bar.js")) {
                  html = injectMockBar(html, null);
                }
                const { "transfer-encoding": _, ...headers } = proxyRes.headers;
                res.writeHead(status, {
                  ...headers,
                  "content-length": Buffer.byteLength(html),
                });
                res.end(html);
              });
            });
          },
        },
      },
      headers: { "Cache-Control": "no-store" },
    },
    resolve: {
      alias: {
        "@": resolve(CURRENT_DIR, "src"),
        "@assets": resolve(CURRENT_DIR, "src/assets"),
      },
    },
  };
});
