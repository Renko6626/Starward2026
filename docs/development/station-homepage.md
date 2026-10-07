# 主页鸟船的修改与更新

主页直接使用 `experiments/station/ring-romantic/src/station-ring.js` 的 R/06 程序化模型。几何、材质和地月背景没有另一份副本。首页场景适配器位于 `src/app/components/station/scene.js`，负责构图、灯光、运动和资源释放；experiment 查看器仍独立运行。

## 首次准备

```sh
npm ci
npx playwright install chromium
```

Linux 缺少浏览器系统库时，按 Playwright 的安装提示准备运行环境。已安装兼容 Chromium 的机器可通过 `STATION_BROWSER_PATH=/path/to/chromium` 指定浏览器；仓库不绑定个人缓存路径。该变量只影响离线生成，不影响生产页面。

## 修改模型后

```sh
npm run station:update
```

该命令依次生成桌面、手机静态背景，以及空间站结构图版和不带标注的线稿，再构建正式网站。实时首页与这些素材复用同一份模型源码。生成从同一个首页场景捕获固定时间的首帧，不截取 experiment 的标签或控制面板，不需要启动报名 API、数据库或登录账号。

单独生成、核对或验证脚本：

```sh
npm run station:generate       # 更新全部空间站素材，不构建网站
npm run station:assets         # 只生成首页桌面、手机预览
npm run station:drawings       # 只生成结构图版和纯线稿
npm run station:check
npm run station:drawings:check
npm run test:station
```

正常 `npm run build` 会先检查首页静态预览、线稿与源码是否一致，不会自动启动浏览器。模型、场景或截图设置改变后，先更新预览。仅改首页文字和布局，无需重新生成；如果改动影响镜头或背景，应在场景适配器中修改并更新预览。

## 产物

- `public/station/desktop.jpg`：1600×1000 桌面背景。
- `public/station/mobile.jpg`：390×844 CSS 视口、2 倍设备像素，产物 780×1688。
- `public/station/manifest.json`：输入指纹、相关依赖版本、图片尺寸、字节数和 SHA-256。

线稿产物还包括：

- `public/station-drawings/overview.png`：1600×1100，英文标注结构图版。
- `public/station-drawings/side-elevation.png`：1260×850，参与指南和创作者入口共用的纯线稿。
- `public/station-drawings/manifest.json`：线稿输入指纹、依赖版本、尺寸和图片 SHA-256。

将上述产物及两个 manifest 与模型/场景修改一起提交。临时构建与截图目录自动清理并已加入忽略规则；生成中任一视图失败时保留旧产物。捕获期间模型发生变化也会停止发布，以免清单与图片不一致。首页预览和线稿分别整组替换；若第二组失败，命令停止且不会继续构建，修复后重跑 `station:update` 即可。

## 修改入口与限制

- 模型构件和尺寸：`experiments/station/ring-romantic/src/model/`；装配入口为 `station-ring.js`。
- 首页镜头、灯光和运动：`src/app/components/station/scene.js`；截图尺寸在同目录 `config.js`。
- 线稿镜头、轮廓处理和标注排布：`experiments/station/technical-study/main.js`；图框在 `index.html`，捕获产物尺寸在 `capture.mjs`。
- 两个环的直径标注直接读取模型 `layout.confirmed` 参数；引出线端点随模型锚点更新。文字排布位置仍是固定设计值。

一般改构件后只需 `npm run station:update`。大幅改变外形、增删构件或调整尺寸时，仍需查看生成图，必要时调整镜头、取景范围和标注位置；脚本不会自动完成新的构图设计。首页背景中的地月转移轨迹有独立参数和生成流程，修改空间站模型不会触发轨迹重算。

检查指纹和图片哈希属于一致性检查，不能代替构图截图或工程验证。普通构建只读检查，不自动下载浏览器或生成图片。首次环境准备仍需安装 Playwright Chromium；版本升级后缺少匹配浏览器时，重新运行 `npx playwright install chromium`。

主站的 3D 模块单独异步加载；文字和链接先显示，背景图提供加载及 WebGL 不可用时的静态画面。暂停、系统减少动态效果、页面隐藏及首屏离开可见区域时停止帧循环。像素比上限为手机 1.4、桌面 1.75。

## 本轮验证（2026-10-06）

- `npm run check`：通过。
- `npm run test:station`：通过，覆盖输入过期、图片损坏和生成失败保留旧产物。
- `npm run test`：通过。
- `npm run station:assets`：通过。本机使用 `STATION_BROWSER_PATH` 指定已有 Chromium。
- `npm run build`：通过；3D 异步包约 556.5 kB，gzip 145.8 kB，保留 Vite 的大包提示。
- `npm --prefix experiments/station/ring-romantic run build`：通过。
- 桌面 1600×1000、手机 390×844 首页只加载并截图：页面/控制台错误为 0，未见横向溢出。

未执行按钮点击、表单填写、拖动或 WebGL 上下文丢失/恢复实测，未做低端真机性能验收，未部署。模型的工程验证不属于主页接入范围。

## 主页轨道线稿的本地生成

实线由 `scripts/orbit-transfer/` 本地积分生成：平面地月圆型限制性三体模型，200 km 地球停泊轨道出发，月球近旁实施动力辅助变轨，最后到达理想 L4 点并消除旋转系速度。月球工作近拱点高度为 150 km，最低允许高度为 100 km。这里没有太阳摄动、真实星历、有限推力或日历发射窗口，也不声称全局最优。

虚线按用户选择保留第一次离轨后的完整地心密切椭圆，方向固定在出发时刻；实线为地月旋转系中的实际三体轨迹。这是用于主页构图的两种参考叠图，线条间距不能用于量化月球摄动。椭圆由变轨后状态转换至地心惯性系计算，未任意描画；若出发状态不定义束缚椭圆，则不绘制此参考。逐点转换至旋转系的版本因重叠和裁切影响辨识，已按用户要求回退。

首次准备独立的 Python 环境：

```sh
python3 -m venv .venv-orbit
.venv-orbit/bin/pip install -r scripts/orbit-transfer/requirements.txt
ORBIT_PYTHON=.venv-orbit/bin/python npm run orbit:generate
```

修改 `scripts/orbit-transfer/config.json` 后使用同一命令重新生成，或运行 `ORBIT_PYTHON=.venv-orbit/bin/python npm run orbit:update` 生成并构建。普通网站构建只用 Node 校验输入指纹和产物哈希，不需要安装 Python 科学计算依赖。`npm run test:orbit` 使用系统 `python3`，独立环境可以直接运行 `.venv-orbit/bin/python -m unittest discover -s scripts/orbit-transfer -p 'test_*.py'`。

生成产物：

- `docs/design/orbit-transfer/trajectory.json`：归一化状态、时间、单位、三次机动及参考椭圆。
- 同目录 `preview.svg`、`preview.png`：带坐标、图例及月球局部放大的检查图。
- 同目录 `validation.json`：碰撞/高度、机动连接、Jacobi 守恒及更严格容差的完整前向重放检查。
- `src/app/components/orbital-transfer.json`：网页所需采样点。页面使用统一等比投影，不拟合或手工弯折轨迹。

轨迹通过检查后才替换已有产物；生成期间源码改变会拒绝发布。`npm run orbit:check` 校验源码与产物一致性，正式构建也执行该检查。

参考方法为 Ren、Wang、Li 与 Zheng 的论文 *A trajectory design and optimization framework for transfers from the Earth to the Earth-Moon triangular L4 point*，Advances in Space Research 69 (2022)，1012–1026，DOI [10.1016/j.asr.2021.10.025](https://doi.org/10.1016/j.asr.2021.10.025)。采用其圆形地月间距与天体半径；引力参数使用 [JPL DE440 数值](https://ssd.jpl.nasa.gov/astro_par.html)。论文目标为 L4 附近短周期轨道，本脚本目标为理想 L4 点，因此不声称复现论文最优解。论文表 3 给出归一化相位、机动量与航时；圆型模型自身不能给出某年某月的发射日期。

## 轨道周围的任务标注

主页线稿标注 PROJECT STARWARD、总航时、地球停泊高度与月球辅助高度/变轨量。飞船旁标注 SATELLITE TORIFUNE，使用细引线连接船体。标注采用本地托管的 Quicksand 500 子集，小字号、全大写；手机单独调整位置并隐藏次要变轨量。数值从生成器输出的 `metadata` 读取，随轨迹参数重算，不填写日历发射日期。

## 接力任务倒计时

首屏下方的 `MissionCountdown.tsx` 将 2026-11-12 00:00 北京时间（UTC+08:00）作为接力开始时间，以 T− 显示天、时、分、秒。每秒从当前时间重新计算，返回页面时同步更新，不依赖累计减秒；到点显示“接力进行中”，不出现负数。后续调整日期只需修改 `RELAY_START`。尚未接入后台活动配置。

## 阶段提交验证（2026-10-07）

本阶段包含 R/06 主页场景、静态资产生成流程、月球辅助轨迹生成与检查、轨道标注和倒计时。桌面与手机布局已截图检查；最后几轮标注和倒计时截图使用静态背景，软件 WebGL 截图超时后未重复做动态场景验收。未执行页面自动交互流程、低端真机性能验收、真实星历验收或部署。

阶段提交前重跑结果：`npm run test`、`npm run test:station`、`npm run test:orbit`、`npm run build` 与 experiment 构建通过；本地环境脚本用例以临时 Vitest 配置单独运行通过（默认主站测试配置不包含 scripts/*.mjs）。`git diff --check` 通过。主站与 experiment 均保留 Vite 的大包提示。构建输出与本地 SQLite 数据加入忽略规则。

## 设计参考资料栏

页底 `DesignReferences.tsx` 直接链接原始资料，并用一行说明对应的设计要素：Ren 等人的地月 L4 转移论文、NASA ISS Facts and Figures、NASA-CR-181795 旋转站与反向转子研究、NASA-CR-184731 CAMELOT 2 人员转接概念，以及 NTRS 19920013446 的热控流体旋转接头。NASA-CR-181795 的反向转子与配平关系见正文第 10、47–54、119–124 页；CAMELOT 2 的气密运输接口见第 5.3 页。资料提供概念与工程参照，不证明鸟船的质量、惯量、接口寿命或本地轨迹已具备真实任务可行性。

追加资料栏后重新运行 `npm run build` 通过，桌面与手机静态背景截图通过布局检查；没有新增交互测试。生成器同时清理 Matplotlib SVG 行尾空格，并重新生成指纹与哈希匹配的轨迹产物。
