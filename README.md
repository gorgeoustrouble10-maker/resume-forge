# Resume Forge

> 面向应届生的 AI 简历生成系统 —— 校园经历职场化翻译 + HR 视角评分 + ATS 适配检测 + 内容幻觉校验

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/gorgeoustrouble10-maker/resume-forge)](https://github.com/gorgeoustrouble10-maker/resume-forge/commits/main)
[![Repo Stars](https://img.shields.io/github/stars/gorgeoustrouble10-maker/resume-forge?style=social)](https://github.com/gorgeoustrouble10-maker/resume-forge/stargazers)
[![Top Language](https://img.shields.io/github/languages/top/gorgeoustrouble10-maker/resume-forge)](https://github.com/gorgeoustrouble10-maker/resume-forge)
[![Issues](https://img.shields.io/github/issues/gorgeoustrouble10-maker/resume-forge)](https://github.com/gorgeoustrouble10-maker/resume-forge/issues)

**技术栈**：
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C44?logo=langchain&logoColor=white)](https://langchain.com/)
[![Chroma](https://img.shields.io/badge/Chroma-1.9-FF4F00?logo=chroma&logoColor=white)](https://www.trychroma.com/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-Coder-4D6B7B)](https://www.deepseek.com/)

---

## 在线 Demo

> **暂未部署在线 Demo**：本项目依赖 DeepSeek API Key 与 Chroma 本地向量库，需要后端常驻服务，
> 不适合纯静态托管（GitHub Pages / Vercel static）。请按下方 [快速开始](#快速开始) 本地运行。

**Demo 预览路径**：

1. **表单填写**（5 步：基本信息 / 教育 / 实习 / 项目 / 社团 / 技能）→ 一键填充示例数据
2. **简历生成**：DeepSeek 将校园经历 STAR 化翻译，服务端结构化渲染 markdown
3. **可信度报告**：自动检测编造主体、编造技能、未溯源量化数据、时间线冲突
4. **HR 评分**：四维度打分（岗位匹配 / 经历量化 / 逻辑清晰 / 关键词匹配）
5. **ATS 检测**：关键词覆盖率 × 40% + 格式 × 30% + 信息完整性 × 30%
6. **PDF 上传直评**：浏览器本地解析 PDF（文件不上传服务器），直接 HR 评分 + ATS 检测 + 可信度检查

> 计划部署到 Render（后端）+ Vercel（前端），届时会在此更新链接。

---

## 项目定位

Resume Forge 不是又一套"套模板排版"工具，而是针对零实习、缺经验高校应届生在秋招中的真实痛点：

- **校园经历职场化翻译**：把课程项目、社团活动、课程作业自动转化为符合 STAR 法则的职场表述
- **HR 视角评分**：从岗位匹配度、经历量化度、逻辑清晰度、关键词匹配度四个维度给出可执行优化建议
- **ATS 适配检测**：检测关键词覆盖率、格式兼容性、关键信息完整性，提升过检概率

目标用户为计算机及相关专业应届生，秋招求职使用。

## 技术栈

### 前端
- React 18 + TypeScript，Vite 构建
- 状态管理仅用 React 原生 `useState` + `useContext`
- HTTP 请求：axios
- 样式：原生 CSS（不引入 UI 组件库）

### 后端
- Node.js + TypeScript，Express
- 依赖：langchain、@langchain/community、chromadb、@langchain/deepseek、dotenv、cors
- 无数据库、无鉴权、无 ORM

### AI 层
- 模型：DeepSeek Coder（用户本地 API Key 调用）
- 向量数据库：Chroma 本地嵌入式，文件存储
- 编排：LangChain.js 统一 RAG 流程

## 目录结构

```
resume-forge/
├── README.md
├── .gitignore
├── client/                       # 前端 React 项目
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/             # 后端接口调用封装
│       ├── types/
│       ├── utils/
│       ├── App.tsx
│       ├── main.tsx
│       └── index.css
└── server/                       # 后端 Node.js + TS 项目
    ├── src/
    │   ├── config/               # DeepSeek API、向量库配置
    │   ├── controllers/          # 接口控制层（仅转发）
    │   ├── services/             # 业务逻辑层（核心）
    │   │   ├── rag.service.ts    # RAG 灌库 + 检索
    │   │   ├── resume.service.ts # 简历生成（STAR 化翻译）
    │   │   ├── scoring.service.ts # HR 视角评分（四维打分）
    │   │   └── ats.service.ts    # ATS 适配检测（过检概率）
    │   ├── routes/
    │   ├── types/                # resume/rag/scoring/ats/api 类型
    │   ├── utils/                # parser/prompt/markdown/validate 等
    │   └── index.ts              # Express 入口
    ├── data/
    │   ├── chroma/               # Chroma 本地向量库存储
    │   └── knowledge/            # 原始知识库（模板/JD/评分标准）
    │       ├── templates/
    │       ├── hr-standards/
    │       └── job-descriptions/
    └── package.json
```

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd server
npm install
cp .env.example .env   # 填入你的 DEEPSEEK_API_KEY

# 前端（新开终端）
cd client
npm install
```

### 2. 启动开发服务

```bash
# 后端 - 监听 http://localhost:3001
cd server
npm run dev

# 前端 - 监听 http://localhost:5173（已配置 /api 代理到 3001）
cd client
npm run dev
```

### 3. 健康检查

打开 `http://localhost:5173` 看到前端骨架，访问 `http://localhost:3001/api/health` 应返回 `{"status":"ok"}`。

### 4. 灌库知识库（首次运行必须）

```bash
cd server
npm run ingest   # 读取 data/knowledge 下 markdown，切块向量化后落盘
```

## API 接口

所有接口统一前缀 `/api`，成功响应为 `{ "success": true, "data": ... }`，失败为 `{ "success": false, "error": { "code", "message", "details" } }`。

| 方法 | 路径 | 说明 | 关键字段 |
| --- | --- | --- | --- |
| GET  | `/health` | 健康检查 | — |
| POST | `/resume/generate` | 简历生成（STAR 化翻译） | `personalInfo`、`targetPosition`、`education[]`、`projects[]`、`clubActivities[]`、`skills[]` |
| POST | `/scoring/analyze` | HR 视角评分 | `targetPosition`、`resumeMarkdown` |
| POST | `/ats/analyze` | ATS 适配检测 | `targetPosition`、`resumeMarkdown` |
| GET  | `/knowledge/status` | 知识库状态 | — |
| POST | `/knowledge/ingest` | 重新灌库 | — |

### 评分接口返回结构（`POST /api/scoring/analyze`）

```jsonc
{
  "success": true,
  "data": {
    "scoring": {
      "dimensions": [
        { "dimension": "position_match", "score": 78, "comment": "...", "suggestions": [ { "location": "...", "issue": "...", "suggestion": "..." } ] },
        { "dimension": "experience_quantification", "score": 65, "comment": "...", "suggestions": [ ... ] },
        { "dimension": "logical_clarity", "score": 80, "comment": "...", "suggestions": [ ... ] },
        { "dimension": "keyword_match", "score": 72, "comment": "...", "suggestions": [ ... ] }
      ],
      "overall": 74,
      "summary": "..."
    },
    "references": [ { "category": "hr-standards", "title": "...", "source": "...", "score": 0.83, "content": "..." } ]
  }
}
```

四维度加权权重：岗位匹配度 30% + 经历量化度 30% + 逻辑清晰度 20% + 关键词匹配度 20%。

### ATS 检测接口返回结构（`POST /api/ats/analyze`）

```jsonc
{
  "success": true,
  "data": {
    "ats": {
      "keywordCoverage": { "covered": [...], "missing": [...], "coverage": 68 },
      "formatCompatibility": { "issues": [ { "type": "multi_column", "location": "...", "issue": "...", "fix": "..." } ], "score": 85 },
      "infoCompleteness": { "missingFields": [...], "presentFields": [...], "score": 90 },
      "passProbability": 72,
      "suggestions": [ { "location": "...", "issue": "...", "suggestion": "..." } ]
    },
    "references": [ ... ]
  }
}
```

格式问题 `type` 取值：`complex_table` / `image_text` / `non_standard_font` / `special_character` / `multi_column` / `header_footer` / `other`。

### 错误码

| code | HTTP | 含义 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | 请求体字段不合法 |
| `CONFIG_ERROR` | 500 | `DEEPSEEK_API_KEY` 未配置 |
| `KNOWLEDGE_EMPTY` | 409 | 知识库未灌库，请先 `npm run ingest` |
| `AI_UPSTREAM_ERROR` | 502 | AI 调用或输出解析失败 |
| `NOT_FOUND` | 404 | 路由不存在 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

## 环境变量

后端配置见 [server/.env.example](server/.env.example)，必须项为 `DEEPSEEK_API_KEY`。

前端配置见 [client/.env.example](client/.env.example)。

## 开发边界（MVP）

- 不做用户注册登录、不做数据持久化，所有数据仅在请求内有效
- 不做支付/会员/广告等商业化功能
- 不引入未在技术栈中列出的第三方依赖
- 业务逻辑只在 `server/src/services` 实现，controller 层仅做接口转发

## License

MIT
