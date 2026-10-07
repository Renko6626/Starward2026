# 接力目录座舱 HUD 原型 C / 01

转移飞行器接近鸟船生态实验站的固定座舱视点。研究窗框与仪表台的工业结构、窗外空间站的取景，以及 HTML 双栏接力时间表在透明显示区域的可读性。独立实验，不接生产接口。

## 保存状态

2026-10-07：用户查看后对当前视觉效果不满意，要求保存并结束。C / 01 作为未采纳的实验稿归档，保留源码与桌面、手机截图，不继续优化，不集成到正式目录页。后续若重新讨论此方向，不把本稿视为已认可的视觉方案。

## 查看

在仓库根目录安装现有依赖后运行：

```bash
npm --prefix experiments/relay-cockpit run build
npm --prefix experiments/relay-cockpit run preview
```

打开 http://localhost:26107/ 。`?static` 固定动画在初始状态，用于比较截图。开发使用 `npm --prefix experiments/relay-cockpit run dev`，同样使用 26107 端口。

预览服务启动后，仅加载与截图：

```bash
node experiments/relay-cockpit/capture.mjs
```

输出到 `previews/desktop.png`、`mobile.png` 及对应完整页面截图。捕获脚本不自动点击、填写或执行交互流程。

## 文件边界

- `src/cockpit.js`：相机局部坐标中的多层窗框、密封条、六角紧固件、侧支撑、仪表遮光台和弱玻璃涂层。
- `src/scene.js`：场景生命周期、响应式取景、灯光与空间站旋转。只读复用 `../station/ring-romantic/src/` 的模型、材质环境和星空/地球。
- `src/schedule.js`：24 棒虚构示例排期、日期导航和本地搜索，不请求业务 API。
- `src/style.css`：HTML HUD、移动端单栏与页面构图。
- `src/main.js`：装配原型及暂停按钮。

使用根目录现有 Three.js / Vite / Playwright；没有新增第三方依赖。

## 设定与限制

沿用地月 L₄ 鸟船站设定及既有空间站构型。座舱是新的近未来工程概念，展示结构关系，未验证压力、载荷、热控或飞行器布局。窗外天体是艺术取景，画面没有虚构的测距、速度或燃料遥测。固定观察相机，不模拟交会制导、持续接近或对接过程。

空间站使用既有模型的展示旋转速度。支持暂停、减少动态偏好与页面隐藏时停止动画。WebGL 不可用时显示说明并保留时间表；首轮实验尚未制作独立静态降级背景。玻璃仅采用低透明度涂层，不使用折射或后处理。

## 本轮验证

- `npm --prefix experiments/relay-cockpit run build`：通过；包含 Three.js 与模型的 JS 约 584 kB，Vite 提示超过 500 kB，原型阶段保留，生产集成前需评估延迟加载。
- `npm run check`：项目 TypeScript 检查通过。
- `node --check`：原型各 JS 模块和截图脚本通过语法检查。
- `node experiments/relay-cockpit/capture.mjs`：1440×1000 桌面、390×844 手机截图生成并查看；加载捕获期间无页面脚本或控制台错误。
- 未自动验证搜索、日期链接与暂停交互，未部署。
