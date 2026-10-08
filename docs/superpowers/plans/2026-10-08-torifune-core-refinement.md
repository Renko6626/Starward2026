# 鸟船主轴舱体细化实施计划

> **执行说明：** 用户已确认B技术路线（2026-10-08）；主 agent 使用 `superpowers:executing-plans` 在当前会话逐项实施。默认不委派子 agent。

**Goal:** 在既有主轴布局内完成五段舱体的端部轮廓、弧形覆板、功能细节与灰白材质，改善远景分段和近景装配。

**Architecture:** 保留 `createCore()` 与现有 Assembly、资源管理和三组装配关系。只在主轴局部生成壳体轮廓、板件和维护组件，复用既有弧板生成器；由 `working.coreDetail` 提供外观参数，原核心尺寸数组保持。

**Tech Stack:** Three.js 0.180.0、原生 ES modules、现有 Vite 与 Playwright 截图流程；无新增依赖。

**Spec:** [主轴细化设计草案](../specs/2026-10-08-torifune-core-refinement-design.md)。实施前两份文件一起读取；与设计冲突时先修正计划，不自行扩大范围。

## 全局约束

- 保留筒段最大直径、模块总长、中心位置和半径2.8 m的贯通通道；端部局部收肩已获用户确认。
- 保留当前350 mm主轴纵梁、中心半径5.15 m、既有16处支撑站及固定／旋转边界。
- 主环、副环、轴承、人员登乘、六向节点、能源翼面与推进组件布局沿用当前模型。
- 保留 `coreModules` 四元组及 `createCore()` 返回结构、anchors和既有资源释放流程。
- 复用 `arcPanelGeometry()`；默认不修改共享几何生成器、通用材质、默认镜头或后处理。
- 外观参数为设计工作值，不能据此宣称压力、结构承载、设备容量或动态净空已验证。
- 默认不新增永久测试；运行相关已有检查。浏览器仅加载、取几何数据并截图，不自动操作页面。
- 不提交、推送或部署；不改已有 `.superdesign/` 和 `temp/` 中的其他工作。

## 文件与责任

生产文件根目录：`experiments/station/ring-romantic/`。

| 文件 | 计划修改 |
| --- | --- |
| `src/model/layout.js` | 并列新增 `working.coreDetail`，含公用板件参数与5段外观配置 |
| `src/model/core.js` | 主轴局部几何、排板、接口细节；保留轴承和登乘逻辑 |
| `src/model/resources.js` | 主轴专用材质；复用已有程序纹理 |
| `README.md`、`index.html` | 完成后记录本轮版本与预览标题；不改页面交互 |
| `previews/core-detail.png` | 更新主轴前半近景 |
| `previews/core-services.png`、`previews/core-recess.png` | 后半设备区和槽区近景 |
| `docs/design/torifune-ring-handoff.md` | 在最新记录中补本轮实际结果及保留限制 |
| `docs/development/station-homepage.md` | 记录实际验证命令、素材生成和未验证项 |
| `public/station/`、`public/station-drawings/` | 使用既有生成命令更新图片与清单 |

无需新增生产模块、独立测试项目或截图框架。

## 检查重点

| 风险 | 期望行为 | 归属 |
| --- | --- | --- |
| X=-44 的相接舱段 | 一个共同接合区，无两套端框重叠或连接空洞 | 任务1 |
| 收肩上的支环与支脚 | 支环取实际局部半径，支脚连接到壳面／端框与原纵梁 | 任务1 |
| 最大半径舱段的弧形覆板 | 安装带避开纵梁、夹座和支环，保留真实板件厚度 | 任务2 |
| 槽底与人员／能源接口 | 槽底不穿壳，附件避开登乘支管和既有挂点 | 任务3 |
| 新资源、标记与静态素材 | 固定挂载、原接口及释放保持，素材来源清单一致 | 任务4 |

### 任务1：端部轮廓与装配接合

**Files:** 修改 `src/model/layout.js`、`src/model/core.js`；暂不改轴承／其他子系统。

**Interfaces:**

- 输入：原 `coreModules`、`coreSupportStations`、`structuralSections.coreChord`。
- `working.coreDetail` 公用字段：`panelOffset=.06`、`panelThickness=.025`、`seam=.035`、`angularSegments=16`、`beamBandAngle=8*Math.PI/180`。
- `working.coreDetail.modules` 按原5段索引排列，字段为 `role`、`shoulderLength`、`shoulderInset`。长度数组为 `[1,.7,1.1,1,.7]`，收小量为 `[.45,.35,.5,.45,.35]`，role为 `personnel`、`transfer`、`analysis`、`equipment`、`energy`。
- 局部 helper：`coreShellProfile(length, radius, shoulderLength, shoulderInset)` 返回局部X坐标与半径组成的轮廓 `Array<[x, r]>`。
- 局部 helper：`radiusOnProfile(profile, localX)` 返回轮廓插值半径，供支座和板件定位。
- 局部 helper：`coreShellGeometry(profile)` 返回周向64段、轴线为X的 `THREE.BufferGeometry`，可由 `LatheGeometry` 旋转得到。
- 输出接口继续为 `createCore({ layout, resources }) -> { object, anchors }`。

- [x] 保留原尺寸数组，新增外观参数；在核心中用新壳体轮廓替换5段等径圆柱，保持中段最大半径和原总长。
- [x] 生成小圆角收肩与封闭的端部装配面，贯通通道保持；连接颈与舱段实际相接。
- [x] 用共同接合区处理X=-44；其他端部用独立环形框、接缝和短颈替换重复实心圆片／大方块。
- [x] 支撑站按实际局部壳半径定位支环与支座；轴承半径分支、纵梁及登乘设施保持。
- [x] 用一次性脚本读取真实壳体顶点、支环及实例矩阵，核对5段原范围与最大半径、通道半径、16站X位置和端部接触；查看前半轮廓截图。记录结果，勿把截图当作工程验算。
- [x] 运行 `node --check experiments/station/ring-romantic/src/model/core.js` 和 `node --check experiments/station/ring-romantic/src/model/layout.js`，期望退出码0。

### 任务2：弧形覆板与纵梁安装带

**Files:** 修改 `src/model/core.js`、`src/model/resources.js`。复用 `src/model/assembly.js`，不修改它的默认行为。

**Interfaces:**

- 输入：任务1的轮廓、`radiusOnProfile()` 与 `working.coreDetail`；现有 `arcPanelGeometry(radius, profile, angle, offset, thickness, steps)`。
- 主轴材质键：`coreHull`、`corePanel`、`coreService`、`coreRim`、`coreSeal`。配色与参数按设计文档；复用已有纹理，板缘纹理使用UV1。
- 局部 helper：`addCoreCladding(a, moduleIndex, moduleTuple, profile, detail)` 添加板件到当前 Assembly，不创建独立渲染组或帧回调。

- [x] 添加主轴专用材质，避免修改其他子系统共用的 `hull`、`silver` 等键。
- [x] 筒段按16周向分区和约2–3 m轴向板长生成弧板；相邻分区错缝，端片裁切，35 mm周向缝按实际半径换算角度。
- [x] 收肩板按实际轮廓和法线生成；给 `arcPanelGeometry()` 提供 `[localX, radialOffset, normalX, normalR]`，轮廓切向量为 `(dx, dr)` 时外法线取 `(-dr, dx)` 并归一化，折边分开顶点。相同尺寸几何缓存后实例化，不用平盒替代曲面。
- [x] 在45°／135°／225°／315°及既有支座、支环位置裁切安装带；替换旧平面卡片和整圈银色装饰缝。
- [x] 一次性核对生产板件坐标、单位法线、UV0／UV1、层厚及安装带边界；针对最粗舱段检查覆板与真实纵梁／夹座，目标静态间隙至少40 mm，指定连接面除外。
- [x] 运行修改JS的 `node --check`；查看前半及最粗舱段截图，确认无穿梁、宽裸露条带或重复花色。

### 任务3：五段功能组件与真实凹槽

**Files:** 修改 `src/model/core.js`，必要外观定位参数补入 `src/model/layout.js`；不改其他子系统接口。

**Interfaces:**

- 输入：原壳体轮廓、主轴材质和现有登乘支管／能源挂点的实际位置。
- 在 `coreDetail.modules` 补外观区域 `features`，每项包含 `kind`、`localX`、`angle`、`axialWidth`、`arcWidth`、`lift`；`localX`为相对模块中心的轴向偏移，线性尺寸用米，`angle`用弧度，`arcWidth`为局部壳面弧长。`kind` 限定为 `window`、`hatch`、`sealedPort`、`equipmentPack`、`junction`。
- 局部 helper：`addCoreFeature(a, feature, moduleTuple, profile)` 在实际壳面上生成基座、槽壁、盖板或端口。
- 覆板 helper读取同一 `features` 配置，分片绕开组件占区；不得用重叠贴片遮住完整覆板。

- [x] 依据设计表配置五段组件数量与用途；位置先按真实附件与支管避让，再按镜头确认功能区可读，不按数组序号随机撒布。
- [x] 深槽采用局部0.20–0.30 m高罩体、60–120 mm槽深，生成底面与四周侧壁；槽底保持在壳面之外。盖板加入独立压框、铰座／锁扣和短把手。
- [x] 制作人员舱两处小关闭窗口、检查舱关闭接口、分析舱维护／样品接口、设备舱可拆包和能源舱配线／流体组件；维持外景关闭状态。
- [x] 重做原顶部设备盒的罩体与安装座，删除五段重复大金色底盒；保留隔热外观时按具体设备生成贴合软包和束带。
- [x] 整理既有固定供给线的夹具、护罩和终端；保持固定侧终止位置，不跨越旋转接口。
- [x] 用生产几何核对槽底在壳面外、支座接触及新附件与两处固定登乘支管、轴承／转接机构、能源根部的静态关系；邻近旋转几何目标间隙至少100 mm。发现冲突优先缩小或重排本轮附件。
- [x] 运行修改JS的 `node --check`，截后半设备区和一处凹槽近景；确认槽壁确实可见且整体配色克制。

### 任务4：最终验证、素材与交接

**Files:** 查看器README／标题、主轴近景、既有静态素材及交接文档。

**Interfaces:** 继续使用现有 `createRingStation()`、`update(time)`、markers及统一dispose路径，不新增验证入口到产品界面。

- [x] 一次性加载真实站体，确认主轴新增子件在固定组、原anchors存在、调用 `update(0)` 与另一时间后主轴矩阵不转而两环仍更新；核对新资源能被现有遍历释放路径收集。
- [x] 执行 `npm run test:station`，期望已有素材／图版相关检查通过；不因外观修改新增永久测试。
- [x] 执行 `npm --prefix experiments/station/ring-romantic run build`，期望退出码0；记录现有大包提示，不扩展打包重构。
- [x] 执行 `npm run station:update`；必要时设置 `STATION_BROWSER_PATH` 为已安装Chromium的实际路径。期望首页背景、两张结构图及来源清单生成完成，主站构建通过。
- [x] 更新并查看3张主轴近景；同时查看此次生成的桌面／手机背景和结构图。仅加载截图，记录页面与控制台错误；不点击、拖动、填表或执行UI流程。
- [x] 若截图或几何检查触发修正，仅重跑受影响检查及素材生成，相关检查通过后结束验证。
- [x] 更新查看器版本记录和交接，以实际代码注明纵梁350 mm、收肩／覆板外偏及保留边界；记录实际命令、结果和未验证项。
- [x] 执行 `git diff --check` 并查看 `git status --short`，核对变更只涉及本计划范围。交付文件与预览，不自动提交、推送或部署。

## 执行结果（2026-10-08）

用户确认B方案后已完成四阶段，五段尺寸、固定归属和anchors核对保持。局部裁片增加RCS、天线、检修轨道支脚和登乘侧撑的真实根部避让；四个设备包补曲面垫座，修复独立审查发现的脚底空隙。最终真实几何与截图、已有检查、独立查看器及主站构建记录见[开发记录](../../development/station-homepage.md)。分区、收肩、外覆层和维护接口已补入[鸟船设定第11节](../specs/2026-10-06-romantic-ring-station-design.md#11-固定主轴分区与外部构造r112026-10-08)。

本轮没有新增依赖、永久测试、UI自动交互或工程载荷核算，没有提交、推送或部署。
