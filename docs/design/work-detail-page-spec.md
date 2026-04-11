# Starward2026 Work Detail Page Spec

Last updated: 2026-04-11

## 1. Purpose

本文定义 `/works/:slug` 的内容结构、模块要求与实现边界。

## 2. Page Role

作品详情页承担以下角色：

1. 单件作品记录页
2. 接力链路中的单个节点
3. 站外平台的入口页
4. 长期归档页面

## 3. Page Goals

访问者在进入页面后应能够快速确认以下信息：

1. 当前作品的顺序位置
2. 作品标题与作者
3. 作品格式与发布时间
4. 主要访问入口
5. 与前后作品的关系

## 4. Content Hierarchy

内容优先级如下：

1. 顺序信息
2. 标题与作者
3. 访问入口
4. 摘要
5. 接力上下文
6. 附加说明

## 5. Data Contract

### 5.1 Required

- `slug`
- `relayNumber`
- `title`
- `authorName`
- `summary`
- `publishedAt`
- `primaryLink`
- `primaryLinkLabel`

### 5.2 Recommended

- `coverImageUrl`
- `formatLabel`
- `tags`
- `authorNote`
- `secondaryLinks`
- `previousWork`
- `nextWork`

### 5.3 Optional

- `credits`
- `archiveNote`
- `contentWarning`

## 6. Page Structure

页面结构建议如下：

1. 返回导航
2. Hero 区
3. 元信息条
4. 摘要区
5. 外链入口区
6. 接力导航区
7. 作者附言
8. 归档附注

## 7. Module Specifications

### 7.1 Back Navigation

应包含：

- 返回作品列表
- 当前页面位置提示

### 7.2 Hero Header

应包含：

- 棒次或顺序编号
- 标题
- 作者
- 封面图或占位

### 7.3 Meta Strip

应包含：

- 发布时间
- 作品格式
- 标签

### 7.4 Summary Block

应包含：

- 摘要正文
- 内容提示（如需）

### 7.5 External Link Hub

应包含：

- 主要阅读或观看入口
- 次要镜像入口
- 平台说明

### 7.6 Relay Context

应包含：

- 上一棒链接
- 下一棒链接
- 当前顺序位置

### 7.7 Author Note

应包含：

- 作者附言
- 补充说明

### 7.8 Archive Footer

应包含：

- 版权或引用信息
- 归档说明

## 8. Sample Copy Structure

推荐文案模块如下：

- 标题行
- 摘要段落
- 外链区标题
- 接力上下文标题
- 页脚附注

## 9. React Module Draft

- `WorkDetailBackNav`
- `WorkDetailHero`
- `WorkDetailMetaStrip`
- `WorkDetailSummary`
- `WorkExternalLinkHub`
- `WorkRelayNavigator`
- `WorkAuthorNote`
- `WorkArchiveFooter`

## 10. State Variants

### 10.1 Fully Published

所有模块均显示。

### 10.2 Published Without Cover

封面区显示占位样式。

### 10.3 External Link Temporarily Unavailable

链接区显示状态说明，不隐藏作品元数据。

### 10.4 Hidden or Unpublished

返回 404 或仅限内部访问，视发布策略决定。

## 11. Mobile Behavior

移动端应遵守以下顺序：

1. 返回导航
2. 标题与作者
3. 顺序信息
4. 摘要
5. 外链入口
6. 接力上下文
7. 附言与附注

## 12. Copy Rules

详情页文案应满足以下要求：

- 使用稳定、记录式表达
- 不省略接力顺序信息
- 不以站外链接替代本站记录

## 13. Relationship to Other Docs

- [works-page-wireframe.md](./works-page-wireframe.md)
- [skeleton.md](../product/site/skeleton.md)
