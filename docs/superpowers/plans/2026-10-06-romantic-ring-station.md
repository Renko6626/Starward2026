# 鸟船归档与环形站首轮外景模型实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution. Use superpowers:subagent-driven-development only if the user selects delegation. Steps use checkbox syntax for tracking.

状态：2026-10-06 已按用户执行指令完成 Task 1–4。旧稿独立归档、新版 R/01 与桌面/手机截图已交付，未接入首页、未部署。实际构图工作值、检查命令与未验证项见 [新版 README](../../../experiments/station/ring-romantic/README.md)。原计划与结构约束保留如下。

先读 [环形站会话交接](../../design/torifune-ring-handoff.md)。已确认的构型、位置与数量不重新进行 A/B 问答；新技术路线或重要边界变更仍提交用户选择。

**Goal:** 完整归档 A/19 写实样稿，在独立目录中建立符合已确认结构的可运行环形站外景初稿，供截图与下一轮设计讨论。

**Architecture:** 旧版保留独立包与查看器，新版一次性复制现有环境、背景和查看器基础。新版装配入口协调固定核心、主环与副环三个结构组，构件模块只依赖本版本的共享资源和几何辅助。根网站维持其现有职责，首轮不新增网站路由或部署接口。

**Tech Stack:** 沿用 Three.js 0.180.0、Vite 7.3.2 和原生 JavaScript ES modules，无新增运行时依赖。

**Spec:** [已接受的结构基线与决策记录](../specs/2026-10-06-romantic-ring-station-design.md)，重点按第 2、8、9、10 节与各 Q 决策执行。

## Global Constraints

- 地月 L4 的低重力生态实验站，浪漫主义与现实主义结合；首轮为独立外景艺术样稿。
- 主环外壳外半径约 50 米、局部生态净高约 8 米、舱内轴向可用总宽度约 16 米；两侧服务带各先按约 2 米试排。净高不作为外部总厚度。
- 主环四组开放桁架辐条；周向桁架与舱段交错整合，禁止退回桁架内圈加舱段外圈的两层轮廓。
- 副环外径先在 70–80 米范围比较，位于主环前侧，共轴、独立反向旋转。前端为载人/货运服务端。
- 固定核心分段装配，主分析实验室位于固定轴线；推进尾段独立挂接，六个大型主罐和四台双组元化学主发动机，单组元 RCS 前后分组。
- 四组光伏翼、两组长条分段散热板主要安装在固定组；展示板面分别为 XZ 与 YZ，互相垂直，各有独立根部机构。
- 前端载人接口、侧面货运接口；两支分工机械臂，同时保留导轨、移动底座、转接基座与空闲停靠位。
- 一面较大主通信碟与少量辅助天线/导航相机，材料、程序化纹理与灯光借鉴旧稿，克制辉光。
- 当前外景不制作可见花草树木，不通过大面积透明舱或剖切展示生态内部。
- 4 人、2–3 个月阶段性进驻仅用于解释人员支持模块，不增加人员排程、消耗预算或轨道预算任务。
- 布局未确认尺寸统一作为艺术工作值记录；不能把显示转速、喷嘴数、贮箱数或可视基座认定为工程能力验证。
- 遵守用户测试约定：不统一新增永久测试或强制 TDD；使用相关已有构建、语法检查和截图。不得自动点击按钮、填写表单或执行交互流程测试。
- 保留工作区其他原有改动；新旧源文件不共享可变模型代码，不把 node_modules 或构建产物纳入归档源文件。

## Review Focus

1. 归档漏文件、源文件意外变化或 README 相对链接损坏：Task 1 核对移动前后的文件清单、源文件校验和与独立构建。
2. 旋转组混入固定设备或实例化合并导致环体不再独立：Task 2 按三个结构组检查真实装配与标记挂点，Task 4 检查更新逻辑。
3. 桁架被画成独立小内圈、工业设备被省略：Task 3 按规格清单核对构件，Task 4 用初始视角截图查看主环与节点关系。
4. 100 米主环与板翼在窄屏被裁切，标签遮挡主体：Task 4 查看桌面与手机两张截图，并记录具体未验证项。
5. 原查看器的暂停、减少动态效果、天线指向或资源释放契约遗漏：Task 2/4 检查接口与已有实现的衔接；不把语法或截图检查报告为交互流程已通过。

## 文件边界建议

归档目录：experiments/station/archive/torifune-a19-axial-spine/，包含当前 index.html、package.json、package-lock.json、.gitignore、README.md 与完整 src/。

新目录：experiments/station/ring-romantic/。

| 文件 | 职责 |
| --- | --- |
| index.html、package.json、package-lock.json、.gitignore、README.md | 独立样稿入口、现有依赖锁定、启动命令、工作尺寸与验证范围 |
| src/main.js、src/style.css | 查看器、镜头、标签、现有操作与资源生命周期 |
| src/materials.js、src/space.js | 一次性复制旧稿的环境、程序化纹理与背景，按需要局部适配 |
| src/station-ring.js | 装配入口、结构组、标记、包络、动画与天线指向协调 |
| src/model/layout.js | 已确认参数与集中记录的首轮构图工作值，区分两者 |
| src/model/resources.js | 本版本的共享几何与材质资源，复用 src/materials.js 的表面纹理函数 |
| src/model/assembly.js | 零件、杆件、曲管与节点的几何辅助；按所属组分别实例化重复件 |
| src/model/main-ring.js | 生态舱段、嵌合周向骨架、四组辐条、隔离/循环与作业节点 |
| src/model/counter-ring.js | 前侧纤细副环、独立支撑、配重与设备节点 |
| src/model/core.js | 分段固定核心、轴承/旋转接口外壳及模块安装位置 |
| src/model/propulsion.js | 六主罐、四主机、推力框、供给、热防护与前后 RCS |
| src/model/energy-thermal.js | 固定桁架、四组光伏、两组散热、根部设备与管线 |
| src/model/operations.js | 两类对接口、两支机械臂、导轨/转接设施与主通信碟 |

以上文件职责构成本轮收口计划的软件组织建议。用户在下一会话要求执行本计划时按此组织；常规几何与视觉工作值由实施者集中调整，不因此改变大构型或新增技术路线。

### 已确认参数与初稿工作值

在 layout.js 中将 confirmed 与 working 分开，README 记录实际采用的 working 值。下表给出可直接开始的首轮值，属于美术布局与外景包络，允许按截图在已确认结构内调整。

| 工作项 | 首轮起点 | 约束 |
| --- | --- | --- |
| 主环中心平面 | X=0 | 旋转轴为 X，环面 YZ |
| 副环外径、中心平面 | 75 米，X=−18 米 | 外径保留 70–80 米范围、位于主环前侧；不把轴向间距视为最终工程尺寸 |
| 主环径向总包络 | 11 米；地面工作半径 48 米 | 50 米外半径、8 米净高分别保留；地面到外沿 2 米、内侧顶上 1 米仅为基质/结构/防护的合计占位，不是壳厚结论 |
| 主环轴向外部包络 | 18 米 | 保留舱内可用总宽 16 米，额外 2 米为侧壁与防护的合计占位；圆角实际净空仍检查 |
| 可见分段节奏 | 16 组可见舱段/节点，四处主节点更明显 | 美术细分，不等于 16 个压力区、发射件或整块可运输压力舱；可按工业层次调整 |
| 固定核心前端与推进出口 | 约 X=−42 米至 X=+44 米 | 分段核心与独立尾段，具体模块顺序、贮箱外廓和设备安装位置据截图调整 |
| 视觉旋转角速度 | 主环 +0.025、副环 −0.04 rad/s | 仅为克制的展示动画，暂停/减少动态效果时冻结；不用于推算 0.16 g 或惯量抵消 |

首轮数组、板翼面积、贮箱直径/长度、天线尺寸、臂长及轨道覆盖由实施者按外部轮廓定工作值并记录，不另起完整功率、推进或人员预算。环上循环、人员/样品转接和机械臂移动的功能需求必须保留；内部转接机构或完整动作仿真不由占位几何宣称已经解决。

## Task 1：独立归档与新查看器准备

**Files:** 移动 experiments/station/ 的旧包、入口与 src/ 到归档目录；更新两个版本 README 和版本索引；建立 ring-romantic/ 的包、入口与查看器文件。历史交接与进展文档顶部更新执行后的实际归档入口，保留历史正文。

**Interfaces:** 新查看器继续消费 createRingStation()，接口见 Task 2。旧归档继续使用 createStationBlockout()，不改模型源文件。

- [x] 记录旧文件清单和源文件校验和，移动完整源文件与锁文件，归档 README 改为正确的新相对引用；node_modules 与 dist 不作为源文件移动。src/、index.html、旧包/锁文件及 .gitignore 应与迁移前一致，README 的路径调整单独记录。
- [x] 新版复制已有环境、背景与查看器基础，保留 Three.js/Vite 版本，锁文件仅同步新包名称。旧版端口 26105，新版 dev/preview 采用 26106，避免冲突；不终止现有用户服务。
- [x] 写版本索引与新版 README，解释地月 L4、已确认工作尺寸、独立运行方式和未验证工程项，更新旧交接/进展的归档入口说明。现有依赖位于 experiments/station/node_modules/，可供子目录解析；若在隔离工作区执行，先检查依赖解析再按现有锁文件恢复相同版本，不新增依赖路线。
- [x] 核对归档源文件校验和；运行 npm --prefix experiments/station/archive/torifune-a19-axial-spine run build。预期退出码 0；归档与新版 README 的本地引用均存在。

## Task 2：模型装配契约与主体结构

**Files:** 新版 src/station-ring.js、src/model/layout.js、resources.js、assembly.js、main-ring.js、counter-ring.js、core.js。

**Interfaces:**

- createRingStation() 返回 { object, markers, envelopes, aimAntennaAt(worldTarget), update(time) }。object 为站体根 Group，envelopes 挂在 object 内；markers 为 { label, position: Vector3, primary } 数组，position 始终是站体局部坐标。
- createStationResources() 返回 { materials, geometries }，以命名材质和基础几何供模型内部复用；三个结构组分别批处理重复零件，不跨组合并。
- assembly.js 提供本版本共用的 Assembly(resources)：part(geometry, materialName, position, scale, rotation)、box(materialName, position, size, rotation)、beam(materialName, start, end, width, depth)、cylinder(materialName, position, radius, length, rotation)、build(name)。位置/尺度采用三元数组，rotation 接受 Euler 三元数组或 Quaternion；细节私有辅助留在构件模块，不扩展成通用建模框架。
- 构件函数 createMainRing(context)、createCounterRing(context)、createCore(context) 返回 { object, anchors }；context = { layout, resources }。anchors 是 Object3D 挂点字典，主环至少含 mainRing、serviceNodes，副环含 counterRing，核心含 lab、personnel、mainBearing、counterBearing；serviceNodes 为挂点数组。
- 装配入口协调 core.object、mainRing.object、counterRing.object，构件文件不互相导入。布局与挂点关系由装配入口处理；根对象含固定组与两个独立旋转组，以及包络组。anchors 表达挂点，不携带副本几何或跨模块隐藏状态。

- [x] 在 layout.js 中记录用户参数和首轮视觉工作值，主环 X=0、副环 X<0、尾段 X>0。未定距离、外部总厚度、节点细分、显示角速度等明确标为构图值，不升级为已验证物理量。
- [x] 建立共享资源与几何辅助，借鉴旧稿的倒角杆件、节点板、套接件和程序化材质。每个结构组维护自己的 InstancedMesh 批次。
- [x] 建立中等舱段与节点交错的主环；周向梁带与安装槽、段间加强节点结合，四组辐条接入这些节点，避免独立桁架内圈与外铺舱段。
- [x] 建立前侧纤细副环及独立旋转支撑，再建立分段固定核心。内部生态以空间和功能标记表达；旋转转接以轴承壳、转接设备和检修接口表达，内部工作路径仍按规格边界处理。
- [x] 装配 object、markers 与 envelopes。为旋转标记保留 anchor，并在 update(time) 中将挂点更新为站体局部坐标，适配现有查看器持有 Vector3 引用的方式。

## Task 3：推进、能源热控与外部作业构件

**Files:** 新版 src/model/propulsion.js、energy-thermal.js、operations.js 及 station-ring.js。

**Interfaces:** createPropulsion(context)、createEnergyThermal(context)、createOperations(context) 返回 { object, anchors }，默认挂在固定组。推进 anchors 含 tanks、engines、rcsFront、rcsRear；能源热控含 solar、radiators；作业设备含 crewDock、cargoDock、assemblyArm、inspectionArm、comms，数组或单个 Object3D 按构件数量对应。operations 另返回 aimAntennaAt(worldTarget)，由站体入口转交给查看器。环上转接点由 main-ring/counter-ring 暴露，轨道不跨不同旋转组直接贯通。

- [x] 建立独立挂接的开放推进架、六主罐及四主机，体现安装座、根部接口、推力框、两类主推进供给设备和热防护。增加单组元 RCS 的供给/储备构件与前后喷嘴簇。
- [x] 建立固定能源桁架及四组光伏翼、两组长条分段散热器。初始板面分别位于 XZ 和 YZ，根部机构、电气托盘、集流管与背部加强件分别可读。
- [x] 建立前端载人接口、侧面货运接口与检查/暂存连接、托盘与抓取点，永久装配接头与飞船捕获接口在几何上区分。
- [x] 建立两支机械臂及导轨、移动底座、空闲转接位、锁定/服务接口，以静态工作姿态表现移动能力；按所属结构组标注环上基座，不承诺全站覆盖。
- [x] 建立抬高主通信碟、馈源/背筋与指向底座及少量辅助设备，实现 aimAntennaAt(worldTarget)；对照结构基线逐项核对外部组件清单。

## Task 4：查看器集成与首轮截图

**Files:** 新版 src/main.js、style.css、index.html、station-ring.js、README.md；按截图结果局部调整 layout.js 和相应构件。

**Interfaces:** 查看器使用 Task 2 的站体契约，继续调用 createEnvironment(renderer)、createStars()、createPlanet()、createMoon()。背景布局调用站体 aimAntennaAt()，帧循环传递冻结或累计的 time 给 update()。

- [x] 将查看器入口接入新模型，保留现有暂停、减少动态效果、隐藏页面、键盘/拖动观察、纯净画面、包络控制和 WebGL 恢复设计。调整镜头距离、DPR 与阴影工作范围适配整体包络。
- [x] 保留现有几何、材质、纹理与 InstancedMesh 的释放流程；共享资源只由统一生命周期处理，不在子模块单独重复释放。
- [x] 运行 npm --prefix experiments/station/ring-romantic run build；对新版 JS 文件逐个运行 node --check，再运行 git diff --check。预期构建与语法检查退出码 0；记录构建已有包体提示，不额外扩展打包重构。
- [x] 使用现有可用的浏览器截图工具仅加载页面并截图：桌面 1440×1000、手机 390×844。查看主副环层次、桁架嵌合、六罐四机、板翼方向、两个接口、机械臂与主碟的可读性和裁切；不点击按钮、不填写表单、不执行交互流程。
- [x] 因具体截图问题做必要局部修正后，重复受影响检查一次。相关检查通过后结束验证，报告实际命令结果以及未验证的交互、工程、机械臂运动和轨道事项。

## 执行方式与阶段交付

原文档会话按用户要求在计划阶段结束，本轮已顺序实施。后续执行 agent 可继续按任务边界推进，避免多个构件同时修改共享资源和装配入口；不默认委派。若用户明确选择委派，保留文件所有权、接口和验证范围，独立构件任务也只能执行本计划的既定路线。

首轮交付：可独立构建的旧稿归档、新版运行入口、已确认构件齐全的模型初稿、桌面/手机截图与简短交接。后续工业细节和比例调整以实际截图讨论，正式首页接入另行确认。

收口自检：已核对用户确认的尺寸与数量、三个结构组的依赖方向、现有查看器契约、文件职责、归档验证和仅截图的 UI 验证范围。上述任务已实施，复选框已勾选；构建、语法、校验和、链接与截图证据记录于新版 README。
