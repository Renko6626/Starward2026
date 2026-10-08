# 主页鸟船的修改与更新

主页直接使用 `experiments/station/ring-romantic/src/station-ring.js` 的 R/08 程序化模型。几何、材质和地月背景没有另一份副本。首页场景适配器位于 `src/app/components/station/scene.js`，负责构图、灯光、运动和资源释放；experiment 查看器仍独立运行。

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

## R/07 主轴与机械系统改版（2026-10-07）

固定核心增加连续纵梁、两环轴承肩和电力/流体/数据接口外形；前端改为固定六向节点。光伏四翼各 10×45 m、根部 Z=±58 m，散热两翼各 6×40 m、石墨灰板面；RCS 增加双弦支臂与设备座。双环和六罐四机保留原尺寸。首页与独立查看器采用更侧向且抬高的镜头，线稿扩大取景范围。

实际验证：`npm run test:station`、`npm run build`、`npm --prefix experiments/station/ring-romantic run build`、`git diff --check` 均通过。使用本机 Chromium 执行 `npm run station:generate`，桌面、手机背景和两张结构图已生成，指纹与哈希检查通过；查看桌面、手机及结构图截图，未执行自动交互测试。两处截图入口补空 favicon，消除截图时缺省请求造成的 404。

独立预览沿用已有 `vite preview`，监听 `0.0.0.0:26106`，已核对 R/07 页面及最新 JS 请求返回 200。主站和查看器仍有 Vite 大包提示。未执行低端真机性能、热负荷、推力、密封或完整动态扫掠验算，未部署。

### R/07 对接节点收紧与金属质感（2026-10-08）

六向布局保留，中心浅色块改为金属筒体，径向端口距轴由 11 m 收至 8.4 m，接口半径 1.8 m；缩短支管并补承压颈、法兰、环形捕获端面、锁紧件、螺栓、黑色密封槽、关闭舱门接缝和相机。对接节点使用独立的钢灰金属、亮金属端环和非金属密封材质，其余船体材质保留。

`npm run test:station`、`npm --prefix experiments/station/ring-romantic run build`、`STATION_BROWSER_PATH=… npm run station:update` 和 `git diff --check` 均通过。最后一项素材命令包含桌面/手机背景、结构图生成及主站构建，一致性检查通过。对接节点近景只加载并截图，页面/控制台错误为 0；未执行自动交互测试或工程验算。26106 预览已提供最新构建，仍有 Vite 大包提示，未部署。

对接节点灰白修订（2026-10-08）：按用户反馈，壳体恢复为与固定舱接近的灰白涂装，中央筒体、支管和端口颈增加分块覆板、灰色次级面板、检修盖、窄接缝与螺栓；亮金属集中于法兰和捕获端环，深色集中于密封槽、端口内部与传感器。保留紧凑尺寸和六向布局。独立近景截图无页面/控制台错误，26106 已提供新版构建。`npm run test:station`、独立查看器构建、`STATION_BROWSER_PATH=… npm run station:update`（素材生成、一致性检查及主站构建）、`git diff --check` 通过。未执行自动交互或工程验算，未部署；仍有 Vite 大包提示。

能源桁架与太阳翼分组（2026-10-08）：每侧加入四个电池箱、一个充放电控制托盘、两个配电托盘、一组双泵与补偿罐、一个备件托盘、一台停驻检修小车及翼根控制箱，补设备座板、横梁、根部连接、电缆槽、冷却管路与窄导轨。四翼各10×45 m外包络保留，九段组织为三组、组间1 m；中间0.45 m露出开放桅杆，每段分成两侧毯面，补组间连接框和线缆。单面板面约1580.716 m²，减少8.14%；原正对太阳无遮挡功率情景由506降至465 kW，容量、追日和遮挡仍未工程验算。

`node --check experiments/station/ring-romantic/src/model/energy-thermal.js`、`npm run test:station`、独立查看器构建、`STATION_BROWSER_PATH=… npm run station:update`（素材、一致性及主站构建）、`git diff --check`通过。设备分布近景只加载截图，页面/控制台错误为0；已查看首页远景与结构图，未执行自动交互测试。26106已提供最新版，未部署；保留Vite大包提示。

四副散热器与太阳翼表现修订（2026-10-08）：用户确认散热器为2×2共四副，并明确太阳翼问题是表现力，保持每翼10×45 m。四副6×40 m板面及支座/背筋/分支集流管按XZ平面镜像，名义展开范围Y=±4.5…±44.5 m，泵组/补偿罐/歧管及供回管移位避让。光伏材质降低金属度、改进蓝灰漫反射，约4.8 m的毯面使用64×64细电池片纹理，保留三组板段和中央桅杆；默认镜头让板面及远侧翼更容易辨认。几何板面面积保持不变。

直接读取生产模型的实例矩阵与材质引用：四个散热器锚点为(27,±24.5,±32) m，24个板段逐一存在XZ镜像，单面光伏面积1580.716054 m²。设备分布近景、桌面与手机远景只加载截图，近景页面/控制台错误为0；未执行自动交互。`npm run test:station`、独立查看器构建、`STATION_BROWSER_PATH=… npm run station:update`（素材、一致性及主站构建）、`git diff --check`通过。26106提供最新版，未部署；对称几何不代表整船质心/惯量或热负荷已核算，Vite大包提示保留。

## 次级杆件整理与阶段保存（2026-10-08）

普通设备支架、两环次级杆和能源桁架斜撑收敛至约25–120 mm常见外截面，重设备支柱/翼根支臂160 mm，主轴/两环主弦/能源主弦/推进主承力保持。结构杆改用平直盒形几何，气密通路与设备罩保留圆角。主环人员通路小支撑60 mm、转接托架支撑80 mm；泵组座板高度配合横梁缩细调整。几何属于截面外包络，尚未指定实际钢材、铝材、壁厚或证明承载。

先前直接读取生产结构杆几何的端部过渡已由4.28 m/3.18 m降为0，主轴550 mm、两环辐条380 mm及能源主弦400 mm保持。四副散热板镜像与1580.716 m²单面光伏面积保持。最终`STATION_BROWSER_PATH=… npm run station:update`、独立查看器构建通过；提交前重跑`npm run test:station`、`npm run station:check`、`npm run station:drawings:check`、`git diff --check`通过。已查看最终桌面远景，未执行自动交互或工程验算；Vite大包提示保留，未部署。

## R/08 中档杆件与支撑（2026-10-08）

主轴纵梁350 mm，采用用户选择的贴壳承力环与短支座，16处支撑的最大间距9 m；没有穿舱直线斜撑。主环/副环辐条主弦280/300 mm，能源主弦200 mm；补能源竖向斜撑、光伏弱轴支撑及四副散热器600 mm深连续背架，副环重载横梁加强至250 mm。外宽和候选壁厚在`layout.working.structuralSections`记录；实际网格是外包络，不据此计算金属质量。主环承压接口和主轴舱壳/支环刚度仍待核算。

`npm run station:update`完整通过，生成两张预览、两张结构图并通过来源检查及主站构建；`npm --prefix experiments/station/ring-romantic run build`和`npm run test:station`通过。桌面/手机、结构图及四类局部截图已查看，实例几何已核对；未新增永久测试或执行自动交互。保留Vite大包提示；模型、素材和交接随本阶段保存，具体提交及推送状态见Git记录，未部署。详情见[交接](../design/torifune-ring-handoff.md)。


## R/09 生态主环外覆层（2026-10-08）

按用户确认的方案，主环保留16组舱段与段间桁架；原整条黑带改为灰色连接颈、窄接环及带铰座/锁扣的分块护罩，侧面继续露出交叉杆件。外缘、内缘、侧面和圆角铺设错缝薄覆板，名义普通板缝45 mm；观察侧与维护侧分别表现小窗/收起防护盖和关闭窗口/检修盖，既有循环节点增加可拆盖板。主环用独立材质和两套UV，其他部件保持默认行为。双环名义尺寸、四辐条、R/08截面、人员通路和旋转分组沿用；外覆层及接环的局部外偏另计，不代表压力结构或实际板厚已经设计。

`npm --prefix experiments/station/ring-romantic run build`、`STATION_BROWSER_PATH=… npm run station:update`完整通过，首页静态素材、两张结构图与来源清单同步；修改JS的`node --check`、`npm run test:station`和`git diff --check`通过。临时脚本读取生产薄板几何，核对有限坐标、单位法线与独立UV。主环整体/近景、26106查看器桌面/手机仅加载截图，页面/控制台错误为0；已查看首页远景与结构图，无自动交互测试或新增永久测试。保留Vite大包提示；未做低端真机性能及工程承载/气密验算，未提交、推送或部署。当前查看器为R/09，详情与预览见[交接](../design/torifune-ring-handoff.md)。


## R/10 主环内缘支撑（2026-10-08）

按用户确认的克制支撑路线，新增两条贴近内缘两侧的250 mm周向梁，X=±7.15 m、中心线半径44.72 m，每舱段5节、共160根闭合梁段。普通短座80 mm、接口横向弦120 mm/斜撑70 mm，四处大节点有140 mm分散支撑；节点中央留约9.1 m开口，支脚绕人员支路接入既有侧面端框。材质偏暗、低反光，深度受控，保持生态舱为远景主体；112/90 m名义压力壳和既有双环/人员通路布局沿用。

临时脚本读取生产实例矩阵：周向梁端点闭合、新子组挂在主环上，实际网格顶点最小半径约44.217 m；通过有向包围盒核对新增构件与两组人员通路10个入口/轴向支路/侧面登乘舱包络，无相交。首轮直达安装脚与人员支路相交，已改为两侧绕行并复查。此项不是全站碰撞或工程载荷验收。

独立查看器build、修改4个JS的`node --check`、`npm run test:station`、`STATION_BROWSER_PATH=… npm run station:update`完整通过，首页素材、结构图与来源清单同步，`git diff --check`通过。整环/内缘/节点及26106桌面/手机只加载截图，页面/控制台错误为0；未新增永久测试或执行自动交互、低端真机性能、压力/刚度/承载工程验算。新增构件尺寸是外景工作值，当前查看器为R/10；保留Vite大包提示。用户已授权R/09与R/10一起提交、推送main并触发已有自动部署，实际状态以Git和远端构建记录为准。详情和预览见[交接](../design/torifune-ring-handoff.md)。


## R/11 主轴细化（2026-10-08）

按已确认B路线完成五段短收肩、9处端部接合、697片弧形覆板和功能组件；固定核心的标记、分组、纵梁与既有子系统布局保持。分区与构造写入[鸟船设定第11节](../superpowers/specs/2026-10-06-romantic-ring-station-design.md#11-固定主轴分区与外部构造r112026-10-08)，成果预览与约束见[交接](../design/torifune-ring-handoff.md)。

实际验证命令：

- `node --check experiments/station/ring-romantic/src/model/core.js`、`node --check experiments/station/ring-romantic/src/model/layout.js`、`node --check experiments/station/ring-romantic/src/model/resources.js`：退出码0。
- `npm run test:station`：已有检查通过，未新增永久测试。
- `npm --prefix experiments/station/ring-romantic run build`：退出码0。
- `STATION_BROWSER_PATH=/data/sunyunbo/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npm run station:update`：退出码0，首页背景、两张结构图、来源清单和主站构建完成。浏览器路径只用于本机离线捕获，没有写入产品代码。
- `git diff --check`：通过；文档本地引用及新文件格式检查通过。

一次性脚本加载真实生产站体，核对5段范围／半径、有限坐标、单位法线、固定组和核心anchors；697片覆板及功能件共1119个几何实例，对1915个既有固定盒形构件做三角面与40 mm扩展包络检查，交叉及间隙命中为0。这是本轮新增表面的限定静态检查，不是全站碰撞或旋转包络验收。独立只读代码审查发现设备包安装脚悬空，补小曲面垫座后真实脚底80样点及垫座底16样点均接入壳面／支环。

主轴前部、后部和检修槽三张近景仅加载截图，页面与控制台错误为0；已查看新生成的桌面／手机背景与结构图。同步回主工作目录后，26106独立查看器桌面／手机仅加载截图，均显示R/11，页面与控制台错误为0。未自动点击、填表、拖动或执行交互流程，也未做低端真机性能、压力／载荷／刚度、气密窗口／传递机构或整船动态净空验算。保留Vite大包提示，未提交、推送或部署。


## R/12 外覆层与外挂护罩（2026-10-08）

主环细碎覆板整理成3×2的大板面，局部外缘罩抬高；主轴7处检修区露出灰色基底并加独立弧形罩，设备包保留更高体量。原结构、分区、运行分组、入口、镜头和灯光保持。设定详见[第12节](../superpowers/specs/2026-10-06-romantic-ring-station-design.md#12-舱体外包覆与外挂护罩r122026-10-08)，实际尺寸和预览见[交接](../design/torifune-ring-handoff.md)。

实际验证命令：

- `node --check experiments/station/ring-romantic/src/model/main-ring.js`、同目录 `core.js`、`layout.js`、`resources.js` 的语法检查均退出码0。
- `npm run test:station`：相关已有检查通过，无新增永久测试。
- `npm --prefix experiments/station/ring-romantic run build`：退出码0。
- `STATION_BROWSER_PATH=/data/sunyunbo/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npm run station:update`：退出码0，背景、两张图版、来源一致性及主站TypeScript／Vite构建完成。路径仅用于本机离线捕获。
- `npm run station:check`、`npm run station:drawings:check`：通过；`git diff --check`和本地文档引用／格式检查通过。

一次性脚本调用真实模型：主环名义壳体顶点45…56 m、X=±9 m保持，内缘板顶点最小半径44.909998 m；主环板件2336→960，主轴普通板697→604。新增主轴表面739实例对1987固定盒形障碍、主环外缘罩及节点盖168实例对1832非安装接触盒形障碍，三角面交叉和40 mm扩展包络命中均为0。指定铰座等安装关系允许接触。这是限定静态包络检查，不是全船碰撞验收。

54根主轴脚底270样点、128根主环脚底640样点、128主环底座中心和40节点盖安装中心接触验证通过。主环节点盖碰已有横梁的问题由盖板留400 mm槽解决；独立只读审查指出的基底UV拉伸已修复，生产分析壳UV跨15.393805周向单位、筒段跨7.900000轴向单位，与2 m纹理基准一致。

主环整体／接口、主轴前／后部及检修区只加载截图，页面／控制台错误为0；同镜头R/11比较、生成的桌面／手机背景及结构图已查看。同步回主工作目录后，26106查看器桌面／手机仅加载截图，均显示R/12，页面／控制台错误为0。未自动点击、填表、拖动或执行UI流程，未验证低端真机、热控、防碎片、材料工艺、载荷／承压或动态扫掠。保留Vite大包提示，未提交、推送或部署。
