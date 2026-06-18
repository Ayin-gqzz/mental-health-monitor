# 大学生心理健康状况动态监测与预警系统

College Student Mental Health Dynamic Monitoring and Early Warning System

## 📋 项目简介

本系统是一个面向高校的心理健康动态监测与预警平台，通过采集学生的日常生活行为数据（睡眠、学习、运动、社交媒体使用、压力水平等），利用机器学习模型进行抑郁风险预测，并为辅导员提供可视化数据分析和预警管理功能。

### 核心功能

- **学生端**：查看个人心理健康概况、行为记录、评估结果、每周测评和个性化建议
- **辅导员端**：学生管理、风险预警、统计分析、统计检验、群体画像、定期上报
- **管理员端**：全院数据总览、注册辅导员账号、预警总览
- **ML 预测**：基于 Random Forest + SMOTE 的抑郁风险分类模型（16 特征）
- **实时预警**：高风险学生自动生成预警通知（数据库触发器）
- **NLP 分析**：对学生留言进行情感分析和心理主题识别
- **SQL 优化演示**：对比慢查询与优化查询的性能差异

## 🚀 快速开始

### Docker 部署（推荐）

```bash
docker compose up
```

首次启动会自动初始化数据库并导入数据（约 2 分钟），完成后访问 http://localhost:5173

### 本地部署

#### 后端（Python 3.12+）

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp ../.env.example .env

# 训练 ML 模型
python ml/train.py

# 初始化数据库和导入数据
python scripts/seed_db.py
python scripts/simulate_behavior.py
python scripts/assess_all.py
python scripts/refresh_weekly_stats.py

# 启动后端服务
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

#### 前端（Node 22+）

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

## 🔐 默认账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | `counselor` | `123456` | 系统预置管理员，可查看全院数据 |
| 学生 | CSV 中的任意 `Student_ID` | `123456` | 如 `1001`、`1002` 等 |

## 📁 项目结构

```
mental-health-monitor/
├── backend/                        # 后端 - FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/                    # API 路由
│   │   │   ├── auth.py             # 认证接口（登录/注册）
│   │   │   ├── student.py          # 学生端接口（8 个端点）
│   │   │   └── counselor.py        # 辅导员端接口（20+ 端点）
│   │   ├── core/                   # 核心配置
│   │   │   ├── config.py           # Pydantic Settings 环境变量
│   │   │   ├── database.py         # 引擎工厂、跨 DB 辅助函数
│   │   │   └── security.py         # JWT 认证、bcrypt 密码哈希
│   │   ├── models/                 # SQLAlchemy ORM 模型
│   │   │   ├── student.py          # student_info
│   │   │   ├── behavior.py         # behavior_log
│   │   │   ├── assessment.py       # mental_assessment
│   │   │   ├── user.py             # counselor_user
│   │   │   ├── notification.py     # risk_notification
│   │   │   ├── weekly_assessment.py# weekly_assessment
│   │   │   └── report.py           # counselor_report（辅导员汇报）
│   │   ├── schemas/                # Pydantic v2 请求/响应模型
│   │   └── services/               # 业务逻辑
│   │       ├── ml_service.py       # ML 预测服务（单例懒加载）
│   │       ├── suggestion_service.py # 干预建议（14 种模板 + 可选 LLM）
│   │       └── nlp_service.py      # NLP 情感分析服务
│   ├── ml/                         # 机器学习
│   │   ├── train.py                # RF + GridSearchCV + SMOTE 训练
│   │   ├── model.pkl               # 训练后的模型
│   │   ├── scaler.pkl              # 特征缩放器
│   │   ├── feature_cols.pkl        # 特征列名（16 个）
│   │   └── evaluation_curves.pkl   # 评估曲线数据
│   ├── scripts/                    # 数据脚本
│   │   ├── seed_db.py              # 导入 10 万学生
│   │   ├── simulate_behavior.py    # 模拟 12 周行为数据
│   │   ├── assess_all.py           # 批量 ML 评估
│   │   └── refresh_weekly_stats.py # 刷新预聚合表
│   └── requirements.txt
├── frontend/                       # 前端 - React 19 + Vite + TypeScript
│   └── src/
│       ├── api/                    # Axios API 客户端（带缓存）
│       ├── components/
│       │   ├── layout/             # 布局组件（AppLayout + Sidebar）
│       │   └── guards/             # 路由守卫（认证 + 角色）
│       ├── pages/
│       │   ├── student/            # 学生页面（5 个）
│       │   └── counselor/          # 辅导员页面（12 个）
│       └── stores/
│           └── authStore.ts        # Zustand 认证状态
├── sql/
│   └── 01_schema.sql               # DDL（6 表 + 2 视图 + 1 触发器）
├── data/
│   └── 数据集.csv                  # 10 万条学生数据
├── docker-compose.yml
└── .env.example
```

## ⚙️ 配置说明

复制 `.env.example` 到 `backend/.env` 并按需修改：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./mental_health.db` | 数据库连接（支持 SQLite/MySQL） |
| `JWT_SECRET` | (placeholder) | JWT 签名密钥 |
| `JWT_EXPIRE_MINUTES` | `480` | Token 过期时间（分钟） |
| `LLM_API_KEY` | (empty) | 可选：OpenAI 兼容 API 密钥 |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | LLM API 地址 |

## 📊 数据说明

`data/数据集.csv` 包含 10 万条学生记录，字段如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Student_ID` | string | 学号（主键） |
| `Age` | int | 年龄（18-24） |
| `Gender` | string | 性别（Male/Female） |
| `Department` | string | 院系（Science/Engineering/Medical/Business/Arts） |
| `CGPA` | float | 学分绩点（0-4） |
| `Sleep_Duration` | float | 每晚睡眠时长（小时） |
| `Study_Hours` | float | 每日学习时长（小时） |
| `Social_Media_Hours` | float | 每日社交媒体使用时长（小时） |
| `Physical_Activity` | int | 每周运动时长（分钟） |
| `Stress_Level` | int | 压力水平（1-10） |
| `Depression` | bool | 是否抑郁（目标变量） |

## 🤖 机器学习模型

### 模型架构

- **算法**：Random Forest Classifier + SMOTE 过采样
- **特征工程**：原始 10 特征 + 3 派生特征（睡眠压力比、社交运动比、学习效率）= 16 特征
- **超参调优**：GridSearchCV 5 折交叉验证
- **目标**：预测学生是否存在抑郁风险（二分类）

### 风险分级

| 等级 | 条件 |
|------|------|
| 🔴 高风险 | ML 预测为抑郁 **或** 压力 ≥ 8 |
| 🟡 中风险 | 压力 ≥ 6 |
| 🟢 低风险 | 其他 |

### 训练模型

```bash
cd backend
python ml/train.py
```

训练完成后会在 `ml/` 目录生成模型文件和评估曲线。

## 🗄️ 数据库设计

### 核心表（6 张）

| 表名 | 说明 | 预估行数 |
|------|------|----------|
| `student_info` | 学生基本信息 | 100,000 |
| `behavior_log` | 行为记录（12 周） | ~1,200,000 |
| `mental_assessment` | ML 评估结果 | ~100,000 |
| `counselor_user` | 辅导员账号 | - |
| `risk_notification` | 高风险预警通知 | - |
| `weekly_assessment` | 学生每周自评 | - |
| `counselor_report` | 辅导员定期汇报 | - |

### 优化特性

- **索引**：覆盖索引让 MAX(id) GROUP BY 走索引不扫全表
- **视图**：`v_latest_assessment`（最新评估）、`v_student_behavior_summary`（行为汇总）
- **触发器**：`trg_high_risk_alert` 高风险评估自动生成预警通知
- **预聚合表**：`weekly_behavior_stats`、`weekly_depression_stats`、`student_latest_stats`
- **跨数据库**：所有 SQL 使用 `is_sqlite()` / `week_label()` / `today_expr()` 兼容 SQLite 和 MySQL

## 🎨 前端功能

### 学生端

| 页面 | 说明 |
|------|------|
| 首页 | 个人概况、12 周趋势、风险评估、个性化干预建议 |
| 行为记录 | 历史行为数据、趋势图表 |
| 评估记录 | 评估结果历史、风险等级 |
| 心理测评 | 每周自评问卷（情绪、睡眠、学习、社交、生活满意度） |
| 测评记录 | 历史测评结果、辅导员回复 |

### 辅导员/管理员端

| 页面 | 说明 |
|------|------|
| 工作台 | 统计概览、风险分布饼图、各院系抑郁率（本院系高亮）、各学院汇报展示 |
| 学生管理 | 学生列表（搜索/院系/性别/风险筛选）、详情查看 |
| 预警信息 | 高风险预警列表（性别/已读状态筛选）、标记已读 |
| 统计分析 | 院系对比、周趋势、压力分布、SQL 优化演示 |
| 统计检验 | T 检验、卡方检验、Pearson/Spearman 相关性分析 |
| 群体画像 | K-Means 聚类 + PCA 降维可视化 |
| 每周测评 | 查看学生自评、按情感分排序、NLP 分析、回复留言 |
| 定期上报 | 辅导员每周汇报本院系学生整体心理状态 |
| 注册辅导员 | 管理员可注册新辅导员账号 |
| 修改密码 | 修改当前账号密码 |

### 技术栈

- **框架**：React 19 + TypeScript
- **构建**：Vite
- **路由**：React Router v7
- **状态管理**：Zustand（持久化到 localStorage）
- **图表**：Recharts（饼图、柱状图、折线图、散点图、雷达图）
- **图标**：Lucide React
- **HTTP 客户端**：Axios（JWT 拦截器 + 自动重定向）

## 🔧 后端技术栈

- **框架**：FastAPI（异步、自动 OpenAPI 文档）
- **ORM**：SQLAlchemy（声明式模型）
- **认证**：JWT（python-jose）+ bcrypt 密码哈希
- **数据库**：SQLite（开发）/ MySQL（生产）
- **ML**：scikit-learn + pandas + numpy + imbalanced-learn（SMOTE）
- **NLP**：jieba 分词 + 情感词典
- **部署**：Uvicorn + Docker Compose

## 📈 API 接口

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 学生登录 |
| POST | `/api/auth/login/counselor` | 辅导员登录 |
| POST | `/api/auth/register` | 学生注册 |
| POST | `/api/auth/register/counselor` | 辅导员注册 |
| PUT | `/api/auth/counselor/password` | 修改密码 |

### 学生接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/student/dashboard` | 首页数据（概况 + 趋势 + 评估） |
| GET | `/api/student/behavior` | 行为记录列表（分页） |
| GET | `/api/student/behavior/trend` | 12 周行为趋势 |
| GET | `/api/student/assessments` | 评估记录列表（分页） |
| GET | `/api/student/weekly-assessments` | 每周测评历史 |
| POST | `/api/student/weekly-assessments` | 提交每周测评 |

### 辅导员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/counselor/statistics/overview` | 总览统计 |
| GET | `/api/counselor/statistics/departments` | 各院系统计 |
| GET | `/api/counselor/statistics/trends` | 周趋势数据 |
| GET | `/api/counselor/statistics/stress-distribution` | 压力分布 |
| GET | `/api/counselor/statistics/t-test` | T 检验 |
| GET | `/api/counselor/statistics/chi-square` | 卡方检验 |
| GET | `/api/counselor/statistics/correlation` | 相关性分析 |
| GET | `/api/counselor/statistics/complex-query` | SQL 优化演示 |
| GET | `/api/counselor/students` | 学生列表（搜索/筛选） |
| GET | `/api/counselor/students/{id}` | 学生详情 |
| POST | `/api/counselor/students/{id}/assess` | 触发单人评估 |
| POST | `/api/counselor/assess-all` | 批量评估 |
| PUT | `/api/counselor/students/{id}/notes` | 更新辅导员备注 |
| GET | `/api/counselor/alerts` | 预警列表（性别/状态筛选） |
| PUT | `/api/counselor/notifications/{id}/read` | 标记已读 |
| PUT | `/api/counselor/notifications/read-all` | 全部已读 |
| GET | `/api/counselor/weekly-assessments` | 每周测评列表 |
| GET | `/api/counselor/weekly-assessments/{id}` | 测评详情（含 NLP） |
| POST | `/api/counselor/weekly-assessments/{id}/reply` | 回复学生留言 |
| GET | `/api/counselor/cluster-analysis` | 聚类分析 |
| GET | `/api/counselor/model/evaluation` | 模型评估曲线 |
| GET | `/api/counselor/reports` | 汇报列表 |
| POST | `/api/counselor/reports` | 提交汇报 |
| GET | `/api/counselor/reports/latest` | 各院系最新汇报 |

## 🐳 Docker 部署

```bash
# 构建并启动
docker compose up --build -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 📝 开发说明

### 添加新功能

1. 后端：在 `backend/app/api/` 添加路由，在 `models/` 和 `schemas/` 定义数据模型
2. 前端：在 `frontend/src/pages/` 添加页面，在 `api/` 添加 API 调用，在 `App.tsx` 添加路由，在 `Sidebar.tsx` 添加导航

### 代码规范

- 后端：遵循 PEP 8，使用 type hints
- 前端：TypeScript strict 模式，函数式组件 + Hooks

## 📄 License

MIT License
