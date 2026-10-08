# 地面观测站样稿

当前采用空间变轨机动线图：中央的切向转移与升轨弧段、左上轨道面调整、左下交会相位椭圆。无背景文字、角度刻度或网格；天线地面网格已移除。

当前为构图原型：时间表居中，右侧一座大型主天线以不对称构图进入文字背景；任务行采用透明背景，轨道图保持可见。天线工业建模细节留待构图确认后处理。

已确认的技术组合：Three.js 天线组结构线、SVG 轨道背景、HTML 时间表。此目录为独立视觉样稿，使用 24 位示例作者，不读取或修改生产排期。

从仓库根目录运行：

```sh
npm run dev --prefix experiments/ground-observatory
npm run build --prefix experiments/ground-observatory
```

开发预览（默认采用变轨机动方案）：

http://localhost:26108/

先前构图样稿：

- A 地面跟踪几何：http://localhost:26108/?diagram=tracking
- B 方位角与仰角：http://localhost:26108/?diagram=sky
- C 轨道平面与姿态：http://localhost:26108/?diagram=plane

三版使用同一天线、时间表和页面布局，仅替换中央 SVG。图形使用几何示意，不表示实际轨道预报。

- `antenna.js`：单座概念主天线的碟面、结构线、馈源、转轴、底座。
- `scene.js`：固定正交相机、按容器尺寸绘制、WebGL 资源释放。首版不运行持续动画。
- `orbit.js`：变轨机动与先前三个独立 SVG 几何构图，不复用首页转移图，也不改变项目轨道求解模型。
- `main.js`：使用 A 方案示例排期，提供选中、搜索、定位与手机详情。
- `style.css`：控制图形和文字的层次、桌面侧边构图与手机适配。

验证：样稿构建通过；检查三版 1440、390 像素宽截图，均无横向溢出和页面运行错误。未执行自动点击、输入或交互流程测试。

截图存放于 `temp/ground-observatory/`。
