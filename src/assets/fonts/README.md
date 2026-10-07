# 展示标题字体

`noto-serif-sc-headings-500.woff2` 是 Noto Serif SC 的 500 字重子集，
通过 Google Fonts CSS API 获取并随站点托管，使用 SIL Open Font License 1.1（见 `OFL.txt`）。
它仅用于首页和登录页的展示标题，正文与其他页面继续使用原有字体。

来源：https://github.com/google/fonts/tree/main/ofl/notoserifsc

当前子集文字：

```text
沿着星光，把故事传下去。不同的创作，同一条星轨。欢迎回来，故事仍在继续。进入创作者空间建立创作者账号
```

修改这些标题时，通过 `https://fonts.googleapis.com/css2` 的
`family=Noto Serif SC:wght@500`、`display=swap` 和 `text=<完整标题文字>`
重新获取 WOFF2 子集，同时更新 `src/index.css` 中的 `unicode-range`。

## 轨道标注字体

`quicksand-latin-500.woff2` 为 Quicksand 500 的 Latin 子集，供首页轨道 metadata 和飞船标注使用。字体通过 Google Fonts 获取并本地托管，以圆润无衬线、小字号和全大写排版。许可为 SIL OFL 1.1，见 `quicksand-OFL.txt`。来源：https://github.com/google/fonts/tree/main/ofl/quicksand

## 品牌标题字体

`source-han-sans-sc-brand-500.woff2` 来自 Adobe Source Han Sans SC Medium（思源黑体，500 字重），
用于品牌名及首页活动标题。按当前文字生成 WOFF2 子集，使用 SIL OFL 1.1
（见 `source-han-sans-LICENSE.txt`）。修改标题文字时需更新子集。
来源：https://github.com/adobe-fonts/source-han-sans/tree/release/OTF/SimplifiedChinese

子集：`逐星巡礼2026年秘封俱乐部之日创作接力`

`copperplate-cc-bold-brand.woff2` 为 Copperplate CC Bold 的品牌文字子集，
用于英文品牌标题 `Starward Pilgrimage`（含对应大写字符）。
这是经用户选择的 Copperplate Gothic 开源复刻替代，使用 SIL OFL 1.1
（见 `copperplate-cc-OFL.txt`）。
来源：https://github.com/CowboyCollective/CopperplateCC
