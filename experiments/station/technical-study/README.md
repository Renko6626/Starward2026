# 空间站结构图样稿

复用 R/06 空间站模型，以正交侧视角绘制硬边与表面轮廓，保留遮挡，头部朝左。完整图版保留英文构件标注；不带标注的站体图片用于参与指南和创作者入口。

单独生成：`npm run station:drawings`；检查：`npm run station:drawings:check`。

修改模型后，推荐在仓库根目录运行 `npm run station:update`，一并更新首页预览、线稿并构建网站。只更新素材、不构建时运行 `npm run station:generate`。

若 Playwright 默认浏览器未安装，可通过 `STATION_BROWSER_PATH` 指定现有 Chromium 可执行文件。

输出：`public/station-drawings/overview.png`，1600 × 1100；`public/station-drawings/side-elevation.png`，1260 × 850，不带标注。两个图片及输入指纹、尺寸、SHA-256 记录在同目录 `manifest.json` 中，普通网站构建会检查是否过期或损坏。生成失败时整组保留旧线稿。

环径标注从模型参数读取，随模型重新生成；图版表达外部构型，不代表工程验证。
