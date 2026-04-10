# Starward2026 — 秘封组同人接力创作活动

报名、登记与归档网站。

## 功能概览

### 首页 & 项目介绍

展示活动主题、时间线、参与方式等信息的落地页。

### 用户注册 & 报名

参与者在网站上注册账号，填写登记信息后报名接力创作。

### 提醒 & 作品提交

报名成功后，系统在截止日期前提醒参与者上传作品相关信息（标题、简介、文件等）。

### 审核

管理员对提交的作品信息进行审核，确认内容符合活动要求。

### 作品展示

活动当天开放独立的展示页面，集中呈现所有通过审核的作品。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | Python / FastAPI |
| 数据库 | TBD |

## 项目结构

```
Starward2026/
├── frontend/          # Vue + TS 前端
├── backend/           # FastAPI 后端
├── nonebot-plugin/    # NoneBot QQ 机器人 AI 插件
├── docs/              # 项目文档
└── readme.md
```

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## License

TBD
