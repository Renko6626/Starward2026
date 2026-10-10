# 网站字体

全站采用本地托管的 WOFF2 字体，常用字定义在 `src/fonts.css`，扩展字定义在 `src/fonts-extended.css`，角色变量在 `src/index.css`。扩展字体表在首屏绘制后注册；首页和各入口共用的 Plex Sans 400、思源黑体 400 常用字提前加载。

| 角色 | 字体 | 字重 |
| --- | --- | --- |
| 英文正文、导航、标题及品牌英文 | IBM Plex Sans | 400、500、600、700 |
| 倒计时、日期、编号及轨道标注 | IBM Plex Mono | 400、500 |
| 中文正文、按钮、表单及品牌中文 | 思源黑体 Source Han Sans SC | 400、500 |
| 公共页面内容标题、章节及作品标题 | 思源宋体 Source Han Serif SC | 700（真实 Bold） |

首页中文品牌标题保留原有 500 字重和倾斜造型。作者页面及管理界面的标题使用黑体；参与指南的说明引言使用正文体。

中文字体分为 `core` 和 `extended` 两组。前者覆盖生成时 `src/` 中出现的中文字符和中日韩标点，后者按每 2048 个 Unicode 码位分块，覆盖源字体其余基本中日韩汉字、扩展 A、兼容汉字、假名和全角字符。CSS 使用互不重叠的 `unicode-range`，按页面实际文字加载；新作品标题出现其他汉字时会加载对应扩展块，无需为每次文案变化更新字体。源字体未覆盖的文字仍使用系统后备字体。

英文字体保留 Latin、Latin Extended-A/B 及源字体中可用的常用标点、上下标、货币、箭头和数学符号。中文子集不包含拉丁字母和阿拉伯数字，英文和任务数字由 Plex 承担。

## 来源与授权

字体从官方仓库获取，采用 SIL Open Font License；授权文件随资产保存。

- IBM Plex：`https://github.com/IBM/plex`，`master/packages/plex-sans/fonts/complete/woff2/` 和 `plex-mono` 对应目录；见 `ibm-plex-LICENSE.txt`。
- 思源黑体：`https://github.com/adobe-fonts/source-han-sans`，`release/OTF/SimplifiedChinese/SourceHanSansSC-Regular.otf` 与 `SourceHanSansSC-Medium.otf`；见 `source-han-sans-LICENSE.txt`。
- 思源宋体：`https://github.com/adobe-fonts/source-han-serif`，`release/OTF/SimplifiedChinese/SourceHanSerifSC-Bold.otf`；见 `source-han-serif-LICENSE.txt`。

## 维护

文案更新后可运行 `python scripts/font-core.py`（需要 `fonttools` 和 `brotli`）。脚本从仓库已有字体分片提取当前 UI 汉字的原始 CFF 轮廓、字宽和排版度量，写入常用字子集，同时从扩展 CSS 的 `unicode-range` 排除这些字，避免一个新字触发整个扩展块下载。扩展文件保留原始覆盖，以支持作者输入的任意文字；英文真实字重、字距和连字表不变。生成结果提交仓库，日常构建无需 Python 或字体下载。

更新字体版本时，须同步常用字和扩展块资产、CSS 范围和授权，并查看中英混排标题及倒计时截图。
