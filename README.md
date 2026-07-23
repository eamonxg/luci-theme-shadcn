<h4 align="right"><strong>English</strong> | <a href="README_zh.md">简体中文</a></h4>
<p align="center">
    <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/logo/logo-lockup.png" width="360" alt="Shadcn LuCI Theme"/>
</p>
<p align="center"><strong>A modern sidebar LuCI theme for OpenWrt, built with shadcn/ui design language.</strong></p>
<div align="center">
  <a href="https://openwrt.org"><img alt="OpenWrt" src="https://img.shields.io/badge/OpenWrt-%E2%89%A523.05-00B5E2?logo=openwrt&logoColor=white"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/eamonxg/luci-theme-shadcn"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/eamonxg/luci-theme-shadcn/total"></a>
</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/login.png" alt="Login Page" width="100%">
  <p><sub><em>Background: the Norwegian Strait.</em></sub></p>
</div>

## Features

- **Sidebar layout**: Collapsible sidebar with accordion sub-menus and mobile drawer.
- **Dark / Light mode**: Built-in toggle, preference remembered automatically, flash-free restore on load.
- **shadcn/ui design**: Clean, modern look, following its dashboard layout.
- **Modern stack**: Fast to load, smooth to navigate, with carefully chosen typography and icons.

## Preview

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/preview.png" alt="Theme Preview" width="100%">
</div>

## Compatibility

- **OpenWrt**: Requires OpenWrt 23.05.0 or later (ucode templates + LuCI JavaScript APIs).
- **Browsers**: Built with **TailwindCSS v4**. Compatible with the following modern browsers:
  - **Chrome/Edge 111+** _(released March 2023)_
  - **Safari 16.4+** _(released March 2023)_
  - **Firefox 128+** _(released July 2024)_

## Installation

Run these commands on the router itself (e.g. over an SSH session).

### Via the eamonxg package feed

OpenWrt 25.12+ and snapshots use `apk`; older versions use `opkg`.

> **Tip**: Run `opkg --version` or `apk --version` to check which package manager your device has.

```sh
wget -qO- https://openwrt.eamonxg.fun/install.sh | sh
```

- **opkg** (OpenWrt < 25.12):

  ```sh
  opkg install luci-theme-shadcn
  ```

- **apk** (OpenWrt 25.12+ and snapshots):

  ```sh
  apk add luci-theme-shadcn
  ```

Adds the feed once; later updates are just `opkg update && opkg install luci-theme-shadcn` / `apk update && apk add luci-theme-shadcn` — no re-downloading the file. Details: [openwrt.eamonxg.fun](https://openwrt.eamonxg.fun/).

### Via a GitHub release

```sh
cd /tmp

# opkg
uclient-fetch -O luci-theme-shadcn.ipk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn_0.3.0-r20260711_all.ipk
opkg install luci-theme-shadcn.ipk

# apk
uclient-fetch -O luci-theme-shadcn.apk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn-0.3.0-r20260711.apk
apk add --allow-untrusted luci-theme-shadcn.apk
```

## Build from source

Build the package yourself with the OpenWrt build system. Host prerequisites: [Build system setup](https://openwrt.org/docs/guide-developer/toolchain/install-buildsystem). The build writes the package to `bin/packages/<arch>/base/` (e.g. `bin/packages/x86_64/base/luci-theme-shadcn_*_all.ipk`); copy it to your router and install it as above.

### Via the full source tree or SDK

Get set up — clone the full source tree:

```sh
# Full source tree — the openwrt-24.10 branch builds an .ipk, the main branch builds an .apk
git clone https://github.com/openwrt/openwrt.git
cd openwrt
git checkout openwrt-24.10
```

Or the [prebuilt SDK](https://openwrt.org/docs/guide-developer/toolchain/using_the_sdk) (faster: skips building the toolchain). Grab the archive for your target from [downloads.openwrt.org](https://downloads.openwrt.org), which splits SDKs into Release and Snapshot builds — Release 24.10.x and earlier build `.ipk`; Release 25.12+ and Snapshot build `.apk` (filename, arch and compression vary by target):

```sh
wget <sdk-archive-url-from-downloads.openwrt.org>
tar -xf openwrt-sdk-*.tar.*
cd openwrt-sdk-*/
```

Then, from that directory:

```sh
# Add this package and install feeds (provides luci-base)
git clone https://github.com/eamonxg/luci-theme-shadcn.git package/luci-theme-shadcn
./scripts/feeds update -a
./scripts/feeds install -a

# Select the theme in menuconfig: LuCI → Themes → luci-theme-shadcn
make menuconfig

# Skip these two lines with the SDK — it already ships a built toolchain
make tools/install -j$(nproc)
make toolchain/install -j$(nproc)

make package/luci-theme-shadcn/compile -j$(nproc) V=s
```

## License & Acknowledgments

[Apache 2.0](LICENSE). Thanks to:

- [shadcn/ui](https://github.com/shadcn-ui/ui) — the logo is its mark with a diagonal line added, echoing a Wi-Fi signal
- [Lucide](https://github.com/lucide-icons/lucide) — icons
- [Linear](https://linear.app) — color system inspiration
- [Vite](https://vite.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- [luci-theme-bootstrap](https://github.com/openwrt/luci/tree/master/themes/luci-theme-bootstrap) — template structure and LuCI integration patterns
- [luci-theme-material](https://github.com/openwrt/luci/tree/master/themes/luci-theme-material) — sidebar menu rendering approach
- [Claude Code](https://claude.ai/code)
