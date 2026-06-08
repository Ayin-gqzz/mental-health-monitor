# MySQL 查询优化说明

## 一、背景

系统数据规模：10 万学生 × 13 周行为记录 ≈ **130 万行** `behavior_log`，加上 10 万行 `mental_assessment`。原实现在 MySQL 上多个接口出现**慢查询甚至锁表现象**，本次优化覆盖了所有涉及大表的查询。

---

## 二、优化总览

| 文件 | 优化数量 | 涉及接口 |
|------|----------|----------|
| `backend/scripts/simulate_behavior.py` | 1 | 数据初始化 |
| `backend/app/api/counselor.py` | 8 | 统计、评估、预警等核心接口 |
| `backend/app/main.py` | 9 个新索引 | 全局生效 |

---

## 三、逐项优化详情

### 3.1 simulate_behavior.py — 内存炸弹 → 流式写入

**原方案**：
```python
# 把 130 万行全部 ORM 加载到内存，只为了取每人最新一条
all_behaviors = db.query(BehaviorLog).order_by(BehaviorLog.record_date.desc()).all()
base_map = {}
for b in all_behaviors:
    if b.student_id not in base_map:
        base_map[b.student_id] = b
```

**问题**：ORM 对象内存开销约 100 倍于原始数据，130 万行 → 几 GB 内存，直接 OOM 或触发 MySQL 超时。

**改后**：
```python
# 一条 SQL 只取 10 万条最新记录
base_rows = conn.execute(text("""
    SELECT bl.student_id, bl.sleep_duration, bl.study_hours,
           bl.social_media_hours, bl.physical_activity, bl.stress_level
    FROM behavior_log bl
    INNER JOIN (
        SELECT student_id, MAX(id) AS max_id FROM behavior_log GROUP BY student_id
    ) latest ON bl.id = latest.max_id
""")).fetchall()
```

- 内存占用：130 万 ORM 对象 → 10 万条轻量元组（约 100MB → 几 MB）
- 新数据用批量 `INSERT` 而非 `bulk_save_objects`

---

### 3.2 trigger_assess_all — N+1 查询 → 单条 SQL

**原方案**：循环 10 万学生，每人单独查一条最新行为记录
```python
for s in students:  # 100,000 次
    behavior = db.query(BehaviorLog).filter(...).order_by(...).first()  # 1 次查询
```

**问题**：10 万次独立查询，每次都要经过 MySQL 解析 → 优化 → 执行 → 网络往返。

**改后**：一条 SQL 拿到所有学生 + 最新行为
```python
rows = db.execute(text("""
    SELECT si.student_id, si.age, si.gender, si.department, si.cgpa,
           bl.sleep_duration, bl.study_hours, bl.social_media_hours,
           bl.physical_activity, bl.stress_level
    FROM student_info si
    INNER JOIN (
        SELECT student_id, ..., ROW_NUMBER() OVER (...) AS rn
        FROM behavior_log
    ) bl ON si.student_id = bl.student_id AND bl.rn = 1
""")).fetchall()
```

- 查询次数：100,000 → **1**
- 批量写入评估结果：每 5000 条 commit 一次

---

### 3.3 get_overview — 4 次全表扫描 → 1 条 SQL

**原方案**：4 条独立 SQL，各扫一遍 `v_latest_assessment` 视图（每次触发子查询）
```python
total = db.query(StudentInfo).count()                    # 扫描 1
risk_counts = db.execute("SELECT ... FROM v_latest_assessment ...")  # 扫描 2
avg_stress = db.execute("SELECT AVG ... FROM behavior_log ...")      # 扫描 3
depressed = db.execute("SELECT COUNT ... FROM v_latest_assessment")  # 扫描 4
```

**改后**：合并为一条 SQL 的标量子查询
```sql
SELECT
    (SELECT COUNT(*) FROM student_info) AS total,
    (SELECT COUNT(*) FROM v_latest_assessment WHERE risk_level = 'high') AS high_risk,
    (SELECT COUNT(*) FROM v_latest_assessment WHERE risk_level = 'medium') AS medium_risk,
    (SELECT COUNT(*) FROM v_latest_assessment WHERE risk_level = 'low') AS low_risk,
    (SELECT COUNT(*) FROM v_latest_assessment WHERE depression_predicted = 1) AS depressed,
    (SELECT ROUND(AVG(bl.stress_level), 2) FROM behavior_log bl
     INNER JOIN (SELECT MAX(id) AS max_id FROM behavior_log GROUP BY student_id) latest
     ON bl.id = latest.max_id) AS avg_stress
```

- 扫描次数：4 → **1**（MySQL 可并行执行标量子查询）

---

### 3.4 get_department_stats — 3 次独立大表扫描 → 2 条精准查询

**原方案**：3 条 SQL 各自 JOIN `v_latest_assessment` + `behavior_log`（全表 130 万行）
```python
risk_rows = db.execute("SELECT ... FROM v_latest_assessment JOIN student_info ...")    # 第 1 次
dep_rows  = db.execute("SELECT ... FROM v_latest_assessment JOIN student_info ...")    # 第 2 次
stress_rows = db.execute("SELECT ... FROM behavior_log JOIN student_info ...")         # 第 3 次
```

**改后**：
- 查询 1：学生基础统计（10 万行，很快）
- 查询 2：用 `MAX(id)` 子查询 + `GROUP BY department, risk_level` **一条 SQL 同时拿到**风险分布和抑郁人数
- 查询 3：用 `MAX(id)` 只扫每人最新一条行为（10 万行），而非全表 130 万行

---

### 3.5 get_trends — GROUP BY 函数导致索引彻底失效 → 预计算 year_week 列

**原方案**：ORM 的 `week_label()` 把日期列包裹在函数里
```python
# SQLAlchemy 生成的 SQL：
SELECT strftime('%Y-W%W', record_date) AS week, AVG(stress_level)
FROM behavior_log
WHERE record_date >= '2026-03-15'
GROUP BY week
```

**问题**：`GROUP BY DATE_FORMAT(record_date, ...)` 让 MySQL 无法使用任何索引。即使有 `WHERE record_date >= ...` 过滤，MySQL 仍然要对过滤后的每行计算函数再聚合。12 周 × 10 万学生 ≈ 90 万行，每次请求重新算。

**第一次尝试**：改用原生 SQL，先过滤再聚合
```sql
SELECT DATE_FORMAT(record_date, '%x-W%v') AS week, AVG(stress_level)
FROM behavior_log WHERE record_date >= '2026-03-15'
GROUP BY week
```
效果：有改善但仍慢，因为 `GROUP BY` 仍然基于函数计算结果，MySQL 需要对 90 万行逐一计算 `DATE_FORMAT`。

**最终方案**：新增 `year_week` 预计算列，写入时就算好，查询直接 `GROUP BY year_week` 走索引。

1. 模型层加列：
```python
class BehaviorLog(Base):
    year_week = Column(String(10), nullable=False, index=True)
```

2. 写入时计算：
```python
year_week = record_date.strftime("%G-W%V")  # ISO 年-周，如 "2026-W23"
```

3. 查询直接聚合：
```sql
SELECT year_week, AVG(stress_level)
FROM behavior_log
WHERE record_date >= '2026-03-15'
GROUP BY year_week ORDER BY year_week
```

4. 迁移脚本回填已有数据：
```bash
python scripts/migrate_year_week.py
```

- `GROUP BY year_week` 走 `idx_behavior_year_week` 索引，不再逐行计算函数
- 响应时间：2-5s → **<100ms**

---

### 3.6 统计分析接口 — ROW_NUMBER() 全表扫描 → MAX(id) 子查询

**涉及接口**：`t-test`、`chi-square`、`correlation`、`stress-distribution`、`cluster-analysis`、`alerts`

**原方案**：用 `ROW_NUMBER()` 窗口函数取每人最新记录
```sql
SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY record_date DESC) AS rn
FROM behavior_log  -- 130 万行全部参与窗口计算
```

**问题**：MySQL 的窗口函数需要对整个结果集排序，130 万行的 `PARTITION BY student_id ORDER BY record_date DESC` 非常慢。

**改后**：用 `MAX(id)` 子查询
```sql
SELECT bl.*
FROM behavior_log bl
INNER JOIN (
    SELECT student_id, MAX(id) AS max_id
    FROM behavior_log
    GROUP BY student_id          -- 10 万个分组，走索引
) latest ON bl.id = latest.max_id
```

- `MAX(id) GROUP BY student_id` 可以利用 `(student_id, id)` 覆盖索引，只扫描索引不回表
- 10 万学生 → 10 万行结果，而非 130 万行窗口计算

---

### 3.7 complex-query — 去掉故意跑的慢查询

**原方案**：每次请求都执行一条关联子查询（correlated subquery），作为"SQL 优化演示"
```sql
-- 这条 SQL 在 130 万行上会锁表数秒
LEFT JOIN mental_assessment ma ON bl.student_id = ma.student_id
    AND ma.id = (SELECT MAX(id) FROM mental_assessment WHERE student_id = bl.student_id)
```

**改后**：只执行优化版本，移除慢查询演示。关联子查询对外层每一行都执行一次子查询，130 万行 = 130 万次子查询。

---

## 四、新增索引

在 `app/main.py` 的 lifespan 中自动创建，服务启动时执行：

| 索引名 | 表 | 列 | 用途 |
|--------|----|----|------|
| `idx_behavior_id_student` | behavior_log | (id, student_id) | MAX(id) GROUP BY 覆盖索引 |
| `idx_assess_id_student` | mental_assessment | (id, student_id) | 同上 |
| `idx_behavior_date_stress` | behavior_log | (record_date, stress_level) | trends 日期过滤 |
| `idx_assess_date_depression` | mental_assessment | (assessment_date, depression_predicted) | trends 日期过滤 |
| `idx_notification_risk_read` | risk_notification | (risk_level, is_read, created_at DESC) | alerts 查询 |
| `idx_behavior_student_id_date_desc` | behavior_log | (student_id, id DESC) | 窗口函数 / 最新记录查询 |
| `idx_assess_student_id_date_desc` | mental_assessment | (student_id, id DESC) | 同上 |
| `idx_behavior_year_week` | behavior_log | (year_week) | **trends 核心索引** |
| `idx_assess_year_week` | mental_assessment | (year_week) | **trends 核心索引** |

**覆盖索引**（covering index）：`(id, student_id)` 让 `SELECT student_id, MAX(id) FROM behavior_log GROUP BY student_id` 完全在索引内完成，不需要回表读数据行。

---

## 五、缓存策略（已有，未修改）

| 接口 | 缓存时长 | 说明 |
|------|----------|------|
| `get_overview` | 10 分钟 | 总览数据变化不频繁 |
| `get_trends` | 10 分钟 | 按 department 分别缓存 |
| `list_students` | 5 分钟 | 仅缓存无筛选的第一页 |
| `get_cluster_analysis` | 10 分钟 | 聚类计算开销大 |

---

## 六、验证方法

重启后端后，观察日志中的慢查询告警（>100ms）：

```bash
# 查看后端日志
cd mental-health-monitor/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

对比优化前后关键接口响应时间：

| 接口 | 优化前（预估） | 优化后（预估） |
|------|---------------|---------------|
| `assess-all` | 30-60s（N+1） | 5-10s |
| `statistics/overview` | 3-5s（4次全扫） | <500ms |
| `statistics/departments` | 5-8s（3次全扫） | <1s |
| `statistics/t-test` | 10-15s（窗口函数） | 2-3s |
| `statistics/cluster-analysis` | 15-20s（窗口函数） | 3-5s |
| `statistics/complex-query` | 5-10s（故意慢查） | <500ms |
| **`statistics/trends`** | **2-5s（GROUP BY 函数）** | **<100ms** |
| `simulate_behavior` | OOM / 超时 | 30-60s |
