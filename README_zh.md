<h4 align="right"><a href="README.md">English</a> | <strong>简体中文</strong></h4>
<p align="center">
    <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/logo/logo-lockup.png" width="360" alt="Shadcn LuCI Theme"/>
</p>
<p align="center"><strong>一款基于 shadcn/ui 设计语言构建的现代侧边栏 OpenWrt LuCI 主题。</strong></p>
<div align="center">
  <a href="https://openwrt.org"><img alt="OpenWrt" src="https://img.shields.io/badge/OpenWrt-%E2%89%A523.05-00B5E2?logo=openwrt&logoColor=white"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/eamonxg/luci-theme-shadcn"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/eamonxg/luci-theme-shadcn/total"></a>
</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/login.png" alt="登录页" width="100%">
  <p><sub><em>背景图：挪威海峡。</em></sub></p>
</div>

## 特性

- **侧边栏布局**：可折叠侧边栏，支持手风琴式子菜单与移动端抽屉。
- **深色/浅色模式**：内置切换按钮，偏好自动保存，加载时无闪烁恢复。
- **shadcn/ui 设计**：现代简洁的视觉风格，参考了其 Dashboard 布局。
- **现代技术栈**：界面加载迅速、切换流畅，字体与图标经过精心挑选。

## 预览

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/preview.png" alt="主题预览" width="100%">
</div>

## 兼容性

- **OpenWrt**：需要 OpenWrt 23.05.0 或更高版本（依赖 ucode 模板和 LuCI JavaScript APIs）。
- **浏览器**：基于 **TailwindCSS v4** 构建。兼容以下现代浏览器：
  - **Chrome/Edge 111+** _(2023 年 3 月发布)_
  - **Safari 16.4+** _(2023 年 3 月发布)_
  - **Firefox 128+** _(2024 年 7 月发布)_

## 安装

以下命令均在路由器本机执行（例如通过 SSH 会话）。

### 通过 eamonxg 软件源

OpenWrt 25.12+ 及 Snapshot 版本使用 `apk`；旧版本使用 `opkg`。

> **提示**：运行 `opkg --version` 或 `apk --version`，有输出的那个就是您设备的包管理器。

```sh
wget -qO- https://openwrt.eamonxg.fun/install.sh | sh
```

- **opkg**（OpenWrt < 25.12）：

  ```sh
  opkg install luci-theme-shadcn
  ```

- **apk**（OpenWrt 25.12+ 及 snapshots）：

  ```sh
  apk add luci-theme-shadcn
  ```

一次性添加源，之后更新只需 `opkg update && opkg install luci-theme-shadcn` / `apk update && apk add luci-theme-shadcn`，无需再手动下载安装包。详细信息见 [openwrt.eamonxg.fun](https://openwrt.eamonxg.fun/)。

### 通过 GitHub Release

```sh
cd /tmp

# opkg
uclient-fetch -O luci-theme-shadcn.ipk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn_0.3.0-r20260711_all.ipk
opkg install luci-theme-shadcn.ipk

# apk
uclient-fetch -O luci-theme-shadcn.apk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn-0.3.0-r20260711.apk
apk add --allow-untrusted luci-theme-shadcn.apk
```

## 从源码构建

使用 OpenWrt 构建系统自行编译。主机前置条件见 [Build system setup](https://openwrt.org/docs/guide-developer/toolchain/install-buildsystem)。产物位于 `bin/packages/<arch>/base/`（例如 `bin/packages/x86_64/base/luci-theme-shadcn_*_all.ipk`），拷贝到路由器后按上文方式安装即可。

### 通过完整源码或 SDK

准备环境——克隆完整源码：

```sh
# 完整源码——openwrt-24.10 分支构建 .ipk，main 分支构建 .apk
git clone https://github.com/openwrt/openwrt.git
cd openwrt
git checkout openwrt-24.10
```

或 [预编译 SDK](https://openwrt.org/docs/guide-developer/toolchain/using_the_sdk)（更快，省去编译工具链）。从 [downloads.openwrt.org](https://downloads.openwrt.org) 下载与目标匹配的压缩包，下载页面按 Release 和 Snapshot 分类——Release 24.10.x 及以下构建 `.ipk`；Release 25.12+ 和 Snapshot 构建 `.apk`（文件名、架构、压缩格式因目标而异）：

```sh
wget <从 downloads.openwrt.org 获取的 SDK 压缩包地址>
tar -xf openwrt-sdk-*.tar.*
cd openwrt-sdk-*/
```

然后在该目录下：

```sh
# 加入本软件包并安装 feeds（提供 luci-base）
git clone https://github.com/eamonxg/luci-theme-shadcn.git package/luci-theme-shadcn
./scripts/feeds update -a
./scripts/feeds install -a

# 在 menuconfig 中勾选主题：LuCI → Themes → luci-theme-shadcn
make menuconfig

# 用 SDK 时跳过这两行——它已自带编译好的工具链
make tools/install -j$(nproc)
make toolchain/install -j$(nproc)

make package/luci-theme-shadcn/compile -j$(nproc) V=s
```

## 许可与致谢

[Apache 2.0](LICENSE)。致谢：

- [shadcn/ui](https://github.com/shadcn-ui/ui) — Logo 就是它的标志加了一道斜线，让它看起来更像 Wi-Fi 信号
- [Lucide](https://github.com/lucide-icons/lucide) — 图标库
- [Linear](https://linear.app) — 色彩系统灵感
- [Vite](https://vite.dev/) 和 [Tailwind CSS](https://tailwindcss.com/)
- [luci-theme-bootstrap](https://github.com/openwrt/luci/tree/master/themes/luci-theme-bootstrap) — 模板结构与 LuCI 集成参考
- [luci-theme-material](https://github.com/openwrt/luci/tree/master/themes/luci-theme-material) — 侧边栏菜单渲染参考
- [Claude Code](https://claude.ai/code)
