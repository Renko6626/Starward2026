# 逐星巡礼视觉素材与动画效果调研

调研日期：2026 年 10 月 10 日。

目标是让网站呈现更明确的设计取舍：沿用阿波罗任务排程、航天工程图与秘封创作接力的内容，增加经过制作的图像、蒙版和状态图形，减少页面到处使用相同矩形、相同渐变和相同入场动画的倾向。

优先建议是完成时间表的占用填充，再制作一组可复用的灰度蒙版和图像纹理。小众库按效果选择：路径变形优先评估 KUTE.js，作品封面显影可评估 curtains.js，工程笔迹可用 perfect-freehand 离线生成。现有 Motion 继续负责普通状态过渡，Vivus 继续负责描线。

本文是研究与选型建议。新增依赖、渲染方式和素材流程尚待确认；调研期间未安装候选库，也未修改页面占用状态。下文的透明度和时长都是起始设计参数，需在实际背景上查看效果。

## 当前网站可利用的基础

整体艺术方向可结合[NASApunk 风格调研](./nasapunk-style-research.md)：以可辨认的航天工程来源组织物件与状态，让素材质感服务于具体部件和真实信息。该文附有 Apollo 与 Starfield 的参考图，以及首页、时间表和鸟船的应用建议。

项目已有 React 19、Motion、Vivus 和 Three.js。首页有轨道图、鸟船背景和现成的桌面／手机静态图，时间表有任务经过时间标尺、纵向时间轴、轨道与天线背景。这些内容足以形成视觉主题，后续重点是统一它们的材质和状态语言。

当前时间表顶部小格已有空心、实心和斜线区分；下方时段条目的已预留、已确认状态主要靠文字和小节点表达。选中条目会显示整块底色。这一部分适合先改：占用状态应持续可见，选中状态叠加到占用图形上。

相关文件：

- [时间表条目和总览](../../src/app/components/ScheduleBoard.tsx)
- [时间表样式](../../src/app/components/schedule-board.css)
- [首次入场描线](../../src/app/components/ScheduleTrace.tsx)
- [首页轨道图](../../src/app/components/OrbitalArtwork.tsx)
- [首页布局](../../src/app/pages/HomePage.tsx)
- [空间站静态图](../../public/station/manifest.json)

## 适合在 Photoshop 中制作的视觉细节

“PS 方便、HTML 没那么方便”可以落实为自由绘制、局部修饰和多层合成。Photoshop 支持通过选择、透明度与绘制控制图层蒙版；网页端可以接收这些已经制作好的素材，再控制显现和状态。[Adobe 图层蒙版说明](https://helpx.adobe.com/photoshop/desktop/create-masks/layer-masks/add-layer-masks.html)

简单的直线、均匀斜纹、半透明矩形和几何裁切适合继续用 CSS／SVG。需要逐像素调节的边缘、曝光、纹理与合成，适合先制作素材。动态日期、作者、空位与按钮保持 HTML 文本，随真实数据更新。

| 手法 | 在 Photoshop 中制作什么 | 网页如何使用 | 适合本项目的位置 |
| --- | --- | --- | --- |
| 不规则软蒙版 | 手工刷出的灰度边界、局部擦除与浓淡变化 | 透明度蒙版或 `mask-mode: luminance`，配合位移、裁切显现 | 首页轨道与空间站之间的过渡、作品封面 |
| 印刷网点与墨色浓淡 | 调整网点密度，保留轮廓，修饰暗部，避免纹理盖住细节 | 静态纹理图片叠层，控制局部透明度 | 占用时段的填充、工程图背景 |
| 双重曝光与局部混合 | 将天体、站体、轨迹放在同一构图中，用蒙版决定哪一层出现 | 导出合成图，或保留少量分层素材 | 首页主视觉、活动说明页 |
| 自定义标题图形 | 手工调整字形轮廓、字距、局部切口与图像穿插 | SVG／透明图片配可访问文本 | 专题标题、作品展览入口；保留现有品牌标志 |
| 前后景遮挡 | 从站体渲染图拆出前景结构和背景，修整边缘 | 分层图片、SVG 蒙版，或现有 Three.js 场景 | 轨迹穿过结构、图注被前景自然遮挡 |
| 工程注记 | 基于真实设定制作指引线、圈注和部件编号，控制笔触粗细 | 导出 SVG 或透明图，局部描线／显现 | 鸟船结构图、活动路线说明 |
| 位移纹理 | 灰度或 RG 通道图，决定图像局部变形的方向和幅度 | SVG 位移滤镜或着色器 | 单张作品封面的切换和显影 |

CSS `mask-image` 可以用图片或渐变控制显示区域，`mix-blend-mode` 可指定元素与背景的混合方式。灰度图不等于透明度图：默认 alpha 蒙版只读取透明度，一张完全不透明的黑白 PNG 不会自动成为灰度遮罩。采用灰度素材时需明确 luminance 模式，或在导出时把灰度转换为 alpha。[MDN 蒙版](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image)、[MDN 混合模式](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mix-blend-mode)

这些手法按区域使用。时间表适合干净的填充和斜线；首页可容纳曝光、遮挡与更复杂的素材边缘。工程图保持线条和标注清晰。满页噪点、统一做旧和频繁图像扭曲，会削弱这个网站已有的内容。

## 时间表的具体建议

阿波罗飞行计划可作为刻度、任务分区、留白与时间秩序的参考。下面的半透明填充方案是为本站黑色背景提出的设计建议，不把它声称为 NASA 的标准状态规范。[NASA Apollo 11 Flight Plan](https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/a11final-fltpln.pdf)

| 状态 | 持续显示的图形 | 动态反馈 |
| --- | --- | --- |
| 待认领 | 空心区域、较弱的边界，露出背景 | 悬停时轻微提高边界亮度 |
| 已预留 | 约 8%–12% 的浅灰填充，叠加疏斜纹 | 状态真正变更时，填充短暂展开一次 |
| 已确认 | 约 16%–22% 的连续半透明填充，比预留更完整、更明确 | 状态变更时短暂展开，随后静止 |
| 不可选择 | 弱虚线边界与截断标记 | 保持安静，避免表现成可以认领 |
| 选中 | 在上述状态之上加角标、亮边或指向节点 | 约 180–260 毫秒的展开和游标移动 |
| 我的时段 | 固定侧边标记和“我的”标签 | 与普通选中标记可以同时存在 |

建议让顶部总览和下方条目共享填充与纹理语言：看到斜纹就知道是已预留，看到连续填充就知道是已确认。选中后仍能分辨这两种占用状态。正文保持立即可读，蒙版只作用于底层填充，不裁切作者名字、时间和操作文案。

第一版用 CSS 半透明背景、斜纹和独立的选择装饰层即可。简单展开可用 `clip-path: inset(...)` 或缩放装饰层，沿用现有 Motion。规则斜纹无需先画成图片；只有确定需要不均匀墨色时，再加入制作好的纹理。[MDN clip-path](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path)、[Motion 动画文档](https://motion.dev/docs/react-animation)

## 小众库与辅助工具比较

以下“适合程度”是针对本站的判断。库的知名度和演示效果不能代替具体用途。

| 候选 | 实际能力 | 在本站的用途 | 主要取舍 | 建议 |
| --- | --- | --- | --- | --- |
| [KUTE.js](https://thednp.github.io/kute.js/svgMorph.html) | SVG 路径变形，另有描线和滤镜等模块 | 一个自定义图形蒙版或任务状态符号的变形 | 与 Motion／Vivus 有重叠；只让它管理明确的一组路径 | 路径变形首选评估 |
| [curtains.js](https://www.curtainsjs.com/) | 将 HTML 图像、视频和 canvas 映射为 WebGL 平面，用着色器处理 | 作品封面曝光、局部位移、显影；官网有位移切图示例 | 需写 GLSL，新增 WebGL 资源与销毁管理；与现有 Three.js 比较成本 | 有明确封面演出时试用 |
| [flubber](https://github.com/veltman/flubber) | 在两个形状之间生成插值，可拆分／合并形状 | 不同轮廓之间的图形蒙版变化 | 发布时间早、依赖不止一个；复杂孔洞有局限；它不负责动画播放 | 备选，时间进度可交给 Motion |
| [Splitting.js](https://splitting.js.org/guide.html) | 拆分字符、行、子项和图片网格，生成索引变量 | 一处专题标题或封面的分条显现 | 它本身不播放动画；会改写 DOM，需要避开 React 管理的动态正文 | 少量固定内容可用 |
| [Theatre.js](https://www.theatrejs.com/docs/latest) | 可视化编排动画时间线，支持 HTML／SVG 和 Three.js | 手工编排一次完整的首页轨道、镜头与图注演出 | 引入制作工作流、状态数据和运行时；Core 与 Studio 许可证不同 | 首页确需精细编排时再选 |
| [mo.js](https://mojs.github.io/api/) | Shape、Burst、Timeline 等图形动画模块 | 一次任务节点确认的短促响应 | 与现有 Motion 重叠；爆散效果容易抢走状态信息 | 低优先级 |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | 根据轨迹和压力生成有粗细变化的笔触轮廓 | 工程图圈注、箭头、少量真实笔迹 | 属于笔触生成工具，需另行显现；可离线导出 SVG | 优先作为素材工具考虑 |
| [OGL](https://github.com/oframe/ogl) | 较少抽象的 WebGL 渲染库，支持自写着色器 | 完全定制的曝光、噪声阈值显影、位移 | 属于底层工具，需自行实现效果和生命周期；项目已有 Three.js | 学习和独立实验用 |
| [Blotter.js](https://github.com/bradley/Blotter) | 基于 GLSL 的特殊文字效果，最终输出到 canvas | 极少量艺术标题的视觉参考 | 源码使用旧 Three.js；文字不可直接选择；存在 npm 同名项目混淆 | 不列入当前生产首选 |

KUTE.js 的普通 SVG Morph 会按闭合轮廓处理形状。开放轨迹和闭合蒙版需要分别选择适合的模块，不能把真实飞行路径任意变形来表达状态。[KUTE.js SVG Morph](https://thednp.github.io/kute.js/svgMorph.html)、[SVG Cubic Morph](https://thednp.github.io/kute.js/svgCubicMorph.html)

perfect-freehand 输出的是填充轮廓。若要用 Vivus 表现“笔迹正在画出”，应另备中心线或显现蒙版，不能直接对填充轮廓描边后期待得到同样的笔触。普通矩形的填充展开也无需引入路径插值库。[perfect-freehand 使用说明](https://github.com/steveruizok/perfect-freehand)

## 版本与维护情况

以下版本和发布日期来自调研时 npm 的 `latest` 标签；仓库日期来自 GitHub API 的 `pushed_at`，不代表某个默认分支提交，也不保证持续维护。表中日期统一取 UTC 日期。没有以下载量、星标数或官方宣传体积推算本项目的包体和性能。

| 包 | latest 版本 | 该版本发布时间 | 仓库最近推送日期 | 许可证声明 |
| --- | --- | --- | --- | --- |
| [curtainsjs](https://registry.npmjs.org/curtainsjs) | 8.1.6 | 2024-05-02 | [2025-04-03](https://api.github.com/repos/martinlaxenaire/curtainsjs) | MIT |
| [kute.js](https://registry.npmjs.org/kute.js) | 2.2.6 | 2026-03-26 | [2026-03-26](https://api.github.com/repos/thednp/kute.js) | MIT |
| [flubber](https://registry.npmjs.org/flubber) | 0.4.2 | 2018-03-01 | [2022-11-08](https://api.github.com/repos/veltman/flubber) | MIT |
| [splitting](https://registry.npmjs.org/splitting) | 1.1.0 | 2024-05-31 | [2024-06-19](https://api.github.com/repos/shshaw/Splitting) | MIT |
| [@theatre/core](https://registry.npmjs.org/@theatre/core) | 0.7.2 | 2024-05-19 | [2024-08-14](https://api.github.com/repos/theatre-js/theatre) | Apache-2.0 |
| [perfect-freehand](https://registry.npmjs.org/perfect-freehand) | 1.2.3 | 2026-02-01 | [2026-04-13](https://api.github.com/repos/steveruizok/perfect-freehand) | MIT |
| [@mojs/core](https://registry.npmjs.org/@mojs/core) | 1.7.1 | 2023-10-06 | [2026-07-30](https://api.github.com/repos/mojs/mojs) | MIT |
| [ogl](https://registry.npmjs.org/ogl) | 1.0.11 | 2025-01-27 | [2025-04-13](https://api.github.com/repos/oframe/ogl) | Unlicense，来自包声明 |

KUTE.js 和 perfect-freehand 在这批候选中有较近的发布记录。flubber 的功能范围清楚，但正式发布已相隔多年，不能按活跃维护的新库评价。所有这些项目在查询时均未被 GitHub 标记为 archived。

Theatre 的运行时 `@theatre/core` 声明 Apache-2.0，编辑器 `@theatre/studio` 声明 AGPL-3.0-only，选型时需分别查看。[Core 包声明](https://registry.npmjs.org/@theatre/core/0.7.2)、[Studio 包声明](https://registry.npmjs.org/@theatre/studio/0.7.2)

Blotter.js 不使用上表中的同名 npm 数据：`npm` 上的 `blotter` 指向 `tjunghans/react-blotter`，属于另一个项目。文字特效项目是 `bradley/Blotter`，其源码 `package.json` 名称为 `blotter.js`，版本为 0.1.0，依赖 Three.js `^0.89.0`；这个源码版本不能视作当前 npm 发行版。其 README 还明确说明最终文字绘制到 canvas，不适合长篇正文。[同名 npm 包](https://registry.npmjs.org/blotter/2.1.0)、[特效项目包声明](https://github.com/bradley/Blotter/blob/master/package.json)、[特效项目 README](https://github.com/bradley/Blotter/blob/master/README.md)

## 素材制作与网页接入

建议先做少量完整素材，再逐步拆分到网页：

1. 选一张已有空间站渲染或一张作品封面作为样本，确定桌面与手机构图。
2. 在 Photoshop 中制作局部蒙版、纹理和明暗，保持轨迹与文字附近干净。
3. 按需要导出底图、alpha 蒙版或灰度蒙版、纹理、前景遮挡层。只有使用动态位移时才增加位移图。
4. 在静态页面先确定叠层效果；均匀斜纹和几何裁切保留为代码，避免素材重复。
5. 用 Motion 控制一次显现或状态变化。确需逐像素显影时，再选择现有 Three.js 着色器或 curtains.js。

素材原稿保留可编辑分层。线条、轮廓和标注优先导出 SVG；透明蒙版和纹理按格式实际支持保留 alpha。静态合成适合直接导出图片，避免为保持少量细节在运行时叠十几个图层。

实现时把内容、状态填充、选中装饰分开：文字与真实操作放在 HTML 层；占用填充由 `reserved`、`confirmed` 等状态控制；选中装饰由 `selectedId` 控制。蒙版资源加载失败时，退回规则填充，状态文字和操作仍然存在。

SVG `feDisplacementMap` 可以根据另一幅图像的通道偏移图像像素，适合局部实验。若需要跨图片的噪声阈值显影、连续局部位移和后处理，则可进一步评估着色器。实际成本取决于区域、分辨率和动画频率。[MDN 位移滤镜](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)、[curtains.js 官方示例](https://www.curtainsjs.com/)

React 页面中的命令式库应在独立装饰节点中初始化并在卸载时销毁，避免库和 React 同时改写动态正文。静态素材可复用；时间、署名和业务状态不绘制进图片。所有新增动画沿用减少动态效果、离屏暂停和后台暂停约定。

## 推荐实施顺序

### 先完成时间表状态

用半透明填充表达已确认，用浅填充和疏斜纹表达已预留，选择角标独立叠加。顶部总览同步使用同一套图形规则。继续沿用 Motion 和 Vivus，不需要新增库。

这是最直接回应“占用格子要有填充”的改动。先查看占用状态的静态效果，再决定是否加入填充展开。

### 再制作一组视觉素材

从现有空间站图中选一张，制作局部曝光、遮挡和网点样本，配一张蒙版。应用到首页的一个区域，与原图比较：构图是否更明确、标题是否更易读、素材是否具有本站自己的特征。

工程图需要笔迹时，可评估 perfect-freehand 作为制作工具。导出的 SVG 可直接交付，网页无需承担这个工具的运行时依赖。

### 最后选择一项特殊动画

| 需要的效果 | 推荐先评估 | 理由 |
| --- | --- | --- |
| 固定图形或 SVG 蒙版在两个轮廓间变化 | KUTE.js 的对应 SVG 模块 | 专项能力明确，发布记录较近 |
| 一张作品封面从纹理或曝光中显影 | 现有 Three.js 着色器与 curtains.js 的单区域原型 | 可以比较复用现有渲染器与增加 DOM 图像平面库的实际成本 |
| 手工调节轨道、镜头、图注的整体节奏 | Theatre.js | 编辑时间线比反复调整散落的延迟更适合这种工作 |

特殊效果集中在一个主视觉或明确的操作反馈上。先给出可观看的样本，再决定是否扩展到其他页面。KUTE.js 与 flubber 不同时承担同一条路径，Three.js、curtains.js 和 OGL 也不同时为同一效果建立渲染器。

## 查看与验证范围

下一步实现默认沿用项目已有检查，并查看桌面、手机和减少动态效果模式的截图。样式和素材调整不新增永久测试，不自动点击按钮或填写表单。新增库的生命周期、输出包体和实际帧率需要在对应原型中确认，本文的功能比较不作为 React 19 或移动端性能验收。

素材验收首先看状态是否一眼可分辨、文字是否清楚、手机裁切是否成立。动态效果的节奏需要在 dev 预览中观看；单张截图只能确认某个时刻的呈现。
