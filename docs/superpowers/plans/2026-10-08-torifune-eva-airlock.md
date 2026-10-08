# 鸟船出舱气闸实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在固定主轴 −Y 侧加入已确认的双人气闸关闭构型和出口近场设施。

**Architecture:** 尺寸集中在 layout.js；eva-airlock.js 独立生成气闸与近场设施并挂入固定组；core.js 负责接口覆板退让。沿用现有 Assembly 和材质，不引入依赖。

**Tech Stack:** Three.js 0.180.0、Vite 7.3.2。

**Spec:** ../specs/2026-10-08-torifune-eva-airlock-design.md

## Global Constraints

- X=−47.5 m、Z=0，沿 −Y 外挂，外径 2.9 m、壳面到远端约 3.8 m。
- 内部净径约 2.4 m、有效长度约 2.5 m，门净开口研究值 1.2 × 1.5 m。
- 准备区仅记录空间设定，外景显示关闭构型；不实现内部、门动画或压力控制仿真。
- 不接入旋转组、不改动既有两环和机械臂布局；前后扶手只覆盖人员舱附近。
- 页面只加载截图，不自动点击、拖动或填表；外观修改不新增永久测试。

## Review Focus

- 实际几何位于 −Y 侧，尺寸与研究值相符。
- 连接座贴壳、覆板退让，关闭压力壳内部不露出穿插面。
- 扶手与系绳座有安装关系，不悬空或挡住检修盖。
- 静态构型避开纵梁、支环和轨道；动态净空明确列为未验证。
- 门框内的盖板、把手与照明在近景可辨认。

## Task 1：气闸与接口

Files: layout.js、core.js、station-ring.js；新建 model/eva-airlock.js。

Interface: createEvaAirlock({ layout, resources }) 返回 { object, anchors }；固定组装配 object，anchors.exit 可供查看器标记使用。

- [x] 增加集中配置，生成贴壳座、连接颈、短圆筒、端盖和关闭舱门。
- [x] 加入接口覆板避让并挂入固定组，核对配置与实际几何。
- [x] 加入出口抓手、承力挂座上的系绳环、工具架、脚固定接口和局部照明。

## Task 2：验证与交接

- [x] 运行 npm run test:station、独立查看器 npm run build、git diff --check。
- [x] 用真实模型检查气闸及设施的包络和邻近静态障碍。
- [x] 加载查看器截图及气闸近景，记录错误与检查范围，不运行交互流程。
- [x] 更新模型说明与交接记录；复核实际修改，完成只读审查。

## 执行记录

用户“直接开干”授权本会话直接执行。为保留现有可查看的工作目录，在当前目录新建功能分支，未另建工作树；未跟踪的用户文件保持原样。仅修改本计划所属文件。正式首页背景与结构图留待气闸体块审阅后更新，当前首轮使用独立查看器。

实施调整：为避让 RCS 服务盒，中心后移0.6 m至X=−46.9 m，后向扶手终点X=−45 m。根部鞋由仅搭在覆板外侧改为向壳内搭接15 mm，覆板另留四处安装孔。因模型指纹影响既有 prebuild，背景与结构图在本轮同步生成以保持构建可用。只读审查的底座问题已修复，复核无其他重要发现。

验证：根目录 npm run build（含station:check、station:drawings:check、orbit:check）、独立查看器 npm run build、npm run test:station、git diff --check 均通过。真实模型64个实例对3235个盒形障碍包络交叠候选为0；桌面、手机、侧面近景、出口近景页面与控制台错误为0。保留既有Vite大包提示。内部、压力壳开孔、救援姿态、挂点强度和动态扫掠未验证。代码留在当前功能分支供查看，未部署。
