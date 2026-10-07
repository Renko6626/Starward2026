# 空间站结构图样稿

复用 R/06 空间站模型，以正交侧视角绘制硬边与表面轮廓，保留遮挡，头部朝左。完整图版保留英文构件标注；不带标注的站体图片用于参与指南和创作者入口。

生成：`node experiments/station/technical-study/capture.mjs`

若 Playwright 默认浏览器未安装，可通过 `STATION_BROWSER_PATH` 指定现有 Chromium 可执行文件。

输出：`public/station-drawings/overview.png`，1600 × 1100；`public/station-drawings/side-elevation.png`，1260 × 850，不带标注。

标注中的主环 112 m、副环 84 m 来自模型已确认尺寸；图版表达外部构型，不代表工程验证。
