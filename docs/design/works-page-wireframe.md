# Starward2026 Works Page Wireframe

Last updated: 2026-04-11

## 1. Purpose

本文定义作品列表页与作品详情页在公开归档阶段的线框要求。

## 2. Section Role

作品区需要完成以下任务：

- 展示全部已公开作品
- 表达接力顺序
- 提供站外访问入口
- 建立长期归档结构

## 3. Pattern Decision

### 3.1 Works Index

`/works` 采用小型归档目录模式。

### 3.2 Work Detail

`/works/:slug` 采用单件记录页模式。

### 3.3 Explicit Non-Goals

以下模式不作为第一版目标：

- 大型数据库检索页
- 瀑布流图片墙
- 仅包含外链按钮的跳板页

## 4. Works Index Wireframe

### 4.1 Header

页头应包含：

- 页面标题
- 当前归档状态
- 返回导航

### 4.2 Intro Block

说明区应包含：

- 归档说明
- 排序方式说明
- 外链分发说明

### 4.3 Relay Map

接力图应包含：

- 全部已公开节点
- 当前节点编号或排序
- 顺序关系

### 4.4 Works Grid or List

作品列表应至少显示：

- 标题
- 作者
- 摘要
- 发布时间
- 格式
- 主要入口

### 4.5 Credits

页尾应包含：

- 参与者署名
- 平台说明
- 版权或引用说明

## 5. Card Anatomy

每张作品卡至少包含：

- 作品标题
- 作者名
- 棒次或顺序编号
- 简介
- 主要链接按钮

## 6. Sorting and Filtering

第一版建议保留以下控制项：

- 按接力顺序查看
- 按发布时间查看

第一版不包含复杂筛选与全文搜索。

## 7. Work Detail Wireframe

### 7.1 Detail Header

应包含：

- 返回列表
- 作品标题
- 作者
- 棒次或顺序信息

### 7.2 Cover and Summary

应包含：

- 封面图或占位
- 摘要
- 格式与发布时间

### 7.3 External Access

应包含：

- 主要链接
- 次要链接
- 站外平台说明

### 7.4 Relay Context

应包含：

- 上一棒
- 下一棒
- 当前所在位置

### 7.5 Notes and Credits

应包含：

- 作者附言
- 制作信息
- 归档附注

## 8. Mobile Behavior

移动端建议顺序如下：

1. 标题与作者
2. 棒次信息
3. 封面与摘要
4. 外链入口
5. 接力上下文
6. 作者附言

## 9. Stage Variants

### 9.1 Release Day

重点显示：

- 新公开作品
- 当前更新批次

### 9.2 Complete Archive

重点显示：

- 全部作品
- 稳定排序
- 长期归档信息

## 10. Copy Rules

作品归档文案应满足以下要求：

- 明确区分本站记录与站外内容承载
- 使用稳定、档案式表达
- 保留接力顺序信息

## 11. Recommended Components

- `WorksHeader`
- `WorksIntro`
- `WorksRelayMap`
- `WorksCard`
- `WorkDetailHero`
- `WorkRelayNavigator`
- `WorkExternalLinks`

## 12. References

- [skeleton.md](../product/site/skeleton.md)
- [work-detail-page-spec.md](./work-detail-page-spec.md)
