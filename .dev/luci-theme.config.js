// Theme identity read by the Vite build (vite.config.ts) and the devkit dev
// layer / bins (@eamonxg/luci-theme-devkit). Everything theme-specific lives
// here; the machinery is generic.
export default {
  name: "shadcn", // media dir (/luci-static/shadcn) + ucode theme dir
  css: ["main", "login"], // src/media/<e>.css → /luci-static/shadcn/<e>.css
  resources: ["menu-shadcn", "sidebar-shadcn"], // served at /luci-static/resources/<m>.js in dev
  assets: { dir: "public/shadcn", only: /^icons\/[^/]+\.svg$/ }, // only icons served in dev
  patchAliases: {},
};
