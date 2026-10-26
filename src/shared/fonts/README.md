# 字体资源

本目录存放站点自托管的 Web 字体，均为构建前生成的 WOFF2 文件，不依赖外部 CDN。

## 文件清单

| 文件                              | 字体家族 / 字重           | 用途                                     |
| --------------------------------- | ------------------------- | ---------------------------------------- |
| `alibaba-puhuiti-2-regular.woff2` | Alibaba PuHuiTi 2.0 / 400 | 全站正文、标题、按钮、棋盘数字           |
| `jetbrains-mono-variable.woff2`   | JetBrains Mono / 100–800  | **等宽文本与计时器默认字体**（可变字体） |
| `saira-condensed-*.woff2`         | Saira Condensed / 100–900 | **NxN 阶数显示**，共 9 个字重            |
| `press-start-2p-regular.woff2`    | Press Start 2P / 400      | 计时器可选字体（设置页已接入）           |
| `dseg7-classic-regular.woff2`     | DSEG7 Classic / 400       | 计时器可选字体（数码管，设置页已接入）   |
| `dseg7-classic-bold.woff2`        | DSEG7 Classic / 700       | 计时器可选字体（数码管，设置页已接入）   |
| `audiowide-regular.woff2`         | Audiowide / 400           | 计时器可选字体（设置页已接入）           |

除阿里巴巴普惠体外，其余字体都只保留 Basic Latin、Latin-1、常用标点与箭头；中文字符由 `--font-sans` 回退，避免把完整 CJK 字体放进仓库。

## 字体来源与许可

### 阿里巴巴普惠体 2.0

- 来源：阿里巴巴普惠体 2.0 55 Regular。
- 版权：Copyright © 2020-2021 Alibaba (China) Co., Ltd. All rights reserved.
- 许可：按阿里巴巴普惠体官方许可免费使用；具体条款以阿里巴巴字体官方页面为准。
- 处理：完整字符集转换为 WOFF2，保留全部中文字形。

### JetBrains Mono

- 来源：JetBrains Mono 2.304，使用 `JetBrainsMono[wght].ttf` 可变字体。
- 版权与许可：SIL Open Font License 1.1，完整文本见 `OFL-JetBrainsMono.txt`。

### Saira Condensed

- 来源：Saira Condensed，保留 Thin–Black 共 9 个字重。
- 用途：游戏页 NxN 大阶数显示。
- 许可：SIL Open Font License 1.1，完整文本见 `OFL-SairaCondensed.txt`。

### Press Start 2P

- 来源：Press Start 2P Regular。
- 许可：SIL Open Font License 1.1，完整文本见 `OFL-PressStart2P.txt`。

### DSEG7 Classic

- 来源：DSEG v0.46 的 DSEG7 Classic Regular / Bold。
- 许可：SIL Open Font License 1.1，完整文本见 `OFL-DSEG.txt`。
- 说明：只加入最常用的 DSEG7 Classic；DSEG14、Mini、Modern 等变体未加入。

### Audiowide

- 来源：Audiowide Regular。
- 许可：SIL Open Font License 1.1，完整文本见 `OFL-Audiowide.txt`。

## 重新生成

字体文件由 `fonttools` 在本地生成，未加入项目依赖。正文文件使用完整字体转换；其余文件在提取后做 Latin 子集，避免把原始大字体放进仓库。
