# luci-theme-shadcn — Linear 风格化 + 零运行时计算 Token 重构

**日期**: 2026-06-20
**状态**: 设计已确认，待写实现计划
**参考**: `tmp/linear.app-DESIGN.md`、`tmp/linear.design.md`、`tmp/tailwind.config.js`、`luci-theme-aurora/.dev/tokens/`

## 目标

1. **风格与颜色对齐 Linear**：lavender-blue 主色、低饱和冷蓝调灰阶、surface 阶梯承载层级、Linear 圆角与字距特征。
2. **消除所有运行时颜色计算**：构建产物中 `color-mix()`、`oklch(from …)` 数量归零，参照 aurora 的扁平 token 方案。
3. **深浅双模式 + 默认跟随设备**：深色忠于 Linear（产品级抬升深色），浅色沿用现有 shadcn 结构但换主色/灰阶色相；默认 `device` 跟随系统。

## 锁定的决定

| 维度 | 决定 |
|---|---|
| 浅色模式 | 沿用现有 shadcn 浅色**结构**，主色换 Linear lavender、灰阶色相对齐 Linear 冷蓝调 |
| 深色画布 | 略微抬升的产品级深色（≈ `oklch(15.9% .005 264)`），而非营销近纯黑 `#010102` |
| 语义色 | 按 Linear 克制风格补全（低饱和、沉静；success 用 Linear 绿 `#27a644`）|
| Token 引擎 | 移植 aurora 整套生成器（`defaults.js` + `spec.js` + `engine.js` + `resolve.js` + `gen-tokens.js`），零运行时计算 |

## Linear 调色板（hex → OKLCH 实测）

| 名称 | hex | OKLCH |
|---|---|---|
| primary | #5e6ad2 | `oklch(56.74% 0.1585 275.2)` |
| primary-hover | #828fff | `oklch(69.06% 0.1637 276.2)` |
| primary-focus | #5e69d1 | `oklch(56.48% 0.1585 275.6)` |
| ink | #f7f8f8 | `oklch(97.84% 0.0011 197)` |
| ink-muted | #d0d6e0 | `oklch(87.44% 0.0152 261)` |
| ink-subtle | #8a8f98 | `oklch(64.88% 0.0146 262)` |
| ink-tertiary | #62666d | `oklch(50.92% 0.0121 262)` |
| canvas (营销) | #010102 | `oklch(6.92% 0.008 284)` |
| surface-1 | #0f1011 | `oklch(17.23% 0.0026 248)` |
| surface-2 | #141516 | `oklch(19.5% 0.0026 248)` |
| surface-3 | #18191a | `oklch(21.27% 0.0025 248)` |
| hairline | #23252a | `oklch(26.45% 0.0098 268)` |
| hairline-strong | #34343a | `oklch(32.74% 0.0105 286)` |
| semantic-success | #27a644 | `oklch(63.71% 0.1749 147)` |
| **产品级深色画布(采用)** | ~#0c0d0f | `oklch(15.88% 0.0045 264)` |

> 关键对比：Linear lavender 饱和度 0.16、色相 275；现 shadcn 主色 `oklch(0.55 0.22 270)` 偏饱和。重构后降饱和、色相对齐 275。

## 架构

### 1. Token 生成系统（移植 aurora）

新增 `.dev/tokens/`：
- **`defaults.js`** — 每模式输入色（少量源色，其余派生）。
- **`spec.js`** — `DERIVATIONS`（操作符 `mix`/`shade`/`set`/`alpha`/`const`）+ `FIXED`（阴影字面量），深浅各一套。
- **`engine.js`** — 复制 aurora：colorjs.io 的 `mix`/`shade`/`set`/`alpha`/`konst`/`toOklch`。
- **`resolve.js`** — 复制 aurora：依赖解析 + 递归 compute。

新增 **`.dev/scripts/gen-tokens.js`**：生成 `src/media/_tokens.css`，结构为
`HEADER`(禁改注释) + `:root{ light + STRUCTURE }` + `[data-darkmode="true"]{ dark }` + `@theme inline{…}`。

`package.json`：
- 加开发依赖 `colorjs.io`。
- 加脚本 `"gen:tokens": "node scripts/gen-tokens.js"`。
- `"build": "npm run clean && npm run gen:tokens && vite build"`。

### 2. `_tokens.css` 成为生成产物

头部注释标注「GENERATED, DO NOT EDIT — run `pnpm gen:tokens`」。当前手写的 `_tokens.css` 内容（含末尾的 `.card-header img` 等图标 filter 规则）需要迁移：**颜色变量改为生成**，**非 token 的图标 filter 规则移出**到合适的组件文件（如 `_patches.css` 或新建 `_icons.css`），保持 `_tokens.css` 纯净只含 token。

### 3. `@theme inline` 收口

当前 `main.css` 与 `login.css` 各有独立 `@theme inline`。重构后：
- 完整 `@theme inline`（颜色映射 + 圆角阶梯 + 字体）由 `gen-tokens.js` 写入 `_tokens.css`。
- `main.css`、`login.css` 各自**删除**自己的 `@theme inline` 块，只保留 `@import "./_tokens.css"`。
- Tailwind v4 仍按各入口实际使用的工具类做 tree-shaking，login 体积不受影响。

### 4. 保持消费端 token 名不变

组件 CSS 现引用的名字全部保留（`--color-primary`、`--color-background`、`--color-foreground`、`--color-muted`、`--color-secondary`、`--color-border`、`--color-input`、`--color-ring`、`--color-panel-bg/-border`、`--color-sidebar-*`、`--color-destructive(-fg)`、`--color-success(-fg)`、`--color-warning(-fg)`、`--color-info(-fg)`、`--color-label-surface`、`--color-terminal-*`、`--color-progress-bar-*` 等），仅改值 + 新增派生 token。组件文件主要只改透明度修饰符那几处。

### 5. 输入色起始值（可在实现中微调）

**深色 inputs**：
- `bg` ≈ `oklch(15.9% .005 264)`（产品级抬升深色）
- `surface`(panel) ≈ `oklch(18.5% .004 264)`
- `text` ≈ `oklch(97.8% .002 264)`
- `brand` = `oklch(56.7% .158 275)`（Linear lavender）；`brand-hover` = `oklch(69% .164 276)`
- `success` = `oklch(63.7% .175 147)`（Linear 绿）
- `danger`/`warning`/`info` = 低饱和沉静版（danger ≈ `.63 .16 25`，warning ≈ `.80 .10 80`，info ≈ `.70 .10 250`）

**浅色 inputs**（沿用现结构，换主色/灰相）：
- `bg` ≈ `oklch(98.5% .004 275)`，`surface` = `oklch(1 0 0)`，`text` ≈ `oklch(18% .02 275)`
- `brand` 同款 lavender；语义色取浅版

### 6. 派生 token + 消除 color-mix（核心）

当前构建产物约 100 个 `color-mix()` 来自 ~40 处 Tailwind 透明度修饰符 + `login.css` 的 7 个 `oklch(from …)`。全部改为 `spec.js` 预算的命名 token：

| 现写法 | 新 token | 派生方式 |
|---|---|---|
| `bg-primary/15` | `--primary-subtle` → `bg-primary-subtle` | `mix(brand, bg, .12~.15)` |
| `border-primary/25`、`/60` | `--primary-border` | `mix`/`alpha` |
| `ring-ring/50`、focus 环 | `--focus-ring` | `alpha(brand, .5)` |
| `bg-{warning,success,info}/10~15` | `--{x}-surface` | `set(x, L, C)`（光/暗各值）|
| `border-{warning,success,info,destructive}/30~70` | `--{x}-border` | `mix(x, border)` |
| `text-muted-foreground/70` | `--text-subtle` | `mix(text, bg)` |
| `border-border/60`、`/80` | `--border-subtle` / `--border-strong` | `shade`/`alpha` |
| `bg-background/60` | `--scrim` 或预算 alpha token | `alpha` |
| login `oklch(from var(--primary) l c h / …)` | 复用上面 subtle/border token | — |

实现时按 `grep -rhoE "(bg|text|border|ring|from|to)-[a-z-]+/[0-9]+" .dev/src` 的全量清单逐处替换，并 grep `oklch(from`、`color-mix` 兜底。

### 7. 风格对齐（颜色之外）

- **圆角**：在 `@theme` 加入 Linear 圆角阶梯（按钮/输入 8px、卡片 12px、徽章/胶囊 pill），由 `--radius-base` 派生（同 aurora 模式）。
- **字体**：保留 Inter（Linear 官方推荐替代）；给标题加轻度负字距（Linear 特征），正文不改。
- **层级**：深色靠 canvas→surface 明度阶梯，少用阴影（Linear 原则）。

### 8. 跟随设备（已实现，保留 + 修一处）

- `header.ut:24-25` 已是 `localStorage 'shadcn.theme' || 'device'` → `prefers-color-scheme`，**保留不动**。
- `header.ut:31` 防闪烁内联 `<style>` 写死了 `oklch(98.5% .004 270)` / `oklch(14.5% .022 270)`，必须同步成重构后的浅/深画布色，避免首屏闪烁。
- `login.css` 同样要确认无首屏闪烁、且其 `@theme inline` 已收口到 `_tokens.css`。

## 验证

1. `pnpm gen:tokens && pnpm build` 成功。
2. `grep -c "color-mix(" htdocs/luci-static/shadcn/main.css` → **0**；`grep -c "oklch(from" …` → **0**（main.css 与 login.css 均检查）。
3. 深 / 浅 / 跟随设备三态逐页目检：登录页、Overview、防火墙区域徽章（zonebadge）、表单、`cbi-tabmenu`。
4. 回归：先前修复的 zonebadge 逗号语法、tabmenu `min-h-9` 不被破坏。
5. 切换系统深浅，确认无首屏闪烁。

## 影响文件

- 新增：`.dev/tokens/{defaults,spec,engine,resolve}.js`、`.dev/scripts/gen-tokens.js`
- 改：`.dev/package.json`、`.dev/src/media/_tokens.css`（转生成）、`main.css`/`login.css`（删 @theme）、`components/*.css`（替换透明度修饰符）、`ucode/template/themes/shadcn/header.ut`（防闪样式）
- 生成：`htdocs/luci-static/shadcn/{main,login}.css`
- 新增 `.gitignore`：`docs/superpowers/`（对齐 aurora 约定）

## 已知约束 / 注意

- Linear 无官方浅色，浅色由本设计推导，非 1:1 还原。
- Linear 是营销配色；后台 UI 的语义色需求由「Linear 产品级克制风格」补全，超出原文档范围。
- `_tokens.css` 末尾的图标 filter 规则需迁出，避免污染生成文件。
