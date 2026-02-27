# CLAUDE.md — linzefei.github.io 项目规则与经验总结

这份文件记录本项目的架构决策、安全规则和踩过的坑。
每次新对话开始前请先读这份文件，避免重复犯错。

---

## 项目概览

- **类型**：GitHub Pages 静态博客（无服务器）
- **域名**：linzefei.github.io（或自定义域名，见 CNAME）
- **数据库**：Supabase（PostgreSQL + RLS）
- **主要功能**：词墙（visitor_words）、访客身份系统、管理后台

### 文件结构

```
/index.html          主页（粒子动画 + 词墙入口）
/words.html          词墙页面（访客留词、身份管理）
/admin/              管理后台（需登录，审核词、管理配置）
/js/
  config.js          公共常量（SB URL、anon key）
  galaxy.js          星空粒子背景
  main.js            主页逻辑
  wordParticles.js   词墙粒子聚合动画
```

---

## Supabase 数据库结构

### 表

| 表名 | 用途 |
|---|---|
| `visitor_words` | 词库，含 approved 字段，默认 false 待审核 |
| `visitors` | 访客身份，token_hash 做防伪造验证 |
| `page_visits` | 访问记录 |
| `site_tags` | 标签数据 |
| `site_content` | 键值配置（如默认词序） |

### RLS 策略原则

- **anon 只能 INSERT，不能读未审核内容**（visitor_words: select 需 approved=true）
- **anon 可以读写 visitors 表**（显示名、国家等公开信息）
- **visitors.token_hash 存 sha256 哈希**，改名必须经 RPC 验证原始 token，anon 无法直接读 hash
- **改名走 RPC** `update_visitor_name(visitor_id, token, name)`，security definer，服务端校验 token

### 重要 SQL 原则

- setup.sql 所有 policy 必须先 `DROP IF EXISTS` 再 `CREATE`，保证幂等可重复执行
- 默认词用 `ON CONFLICT DO NOTHING` 插入，避免重复

---

## 安全规则（重要）

### 1. anon key 可以放在前端，service_role key 绝对不能

- **anon key** 设计上就是公开的，Supabase 官方明确支持放在前端代码里
- **service_role key** 绕过 RLS，有它就能读写任何数据，必须只存在服务端
- 本项目 service_role key **从未提交过 git**，只在 Supabase 控制台和 CF Worker 环境变量里

### 2. 前端直接调 Supabase API 的局限性（已知架构缺陷）

当前 `words.html` 的词提交仍然直接调 Supabase anon API，这有以下风险：

| 风险 | 说明 | 当前状态 |
|---|---|---|
| 刷词攻击 | 脚本绕过前端直接 POST，塞满待审队列 | **未解决**，待加 CF Worker |
| visitor_id 伪造 | 提交时可附任意 visitor_id | 低危，可忽略 |
| 假国旗 | country 字段由前端从 ip-api.com 查询后传入 | 低危，可忽略 |
| 脏词昵称 | display_name 无内容过滤 | 低危，管理后台可删 |

### 3. 已规划但未实施：CF Worker + Turnstile

**目标架构**：

```
读操作：前端 → Supabase（anon key，受 RLS 保护）
写操作：前端 → CF Worker（CAPTCHA 验证）→ Supabase（service_role key，藏在 Worker）
```

**实施条件**（待用户完成）：
1. 注册 Cloudflare 账号（免费）：dash.cloudflare.com
2. 创建 Turnstile 站点，获取 `site_key`（公开）和 `secret_key`（存 Worker 环境变量）
3. 从 Supabase → Settings → API 获取 `service_role key`（存 Worker 环境变量）

**Worker 逻辑**：
- 接收 `{ word, visitor_id, turnstile_token }`
- 服务端验证 CAPTCHA token（调 CF Turnstile API）
- 验证通过 → 用 service_role key 写 Supabase
- 失败 → 拒绝，Supabase 完全不知道这次请求

**同时**：实施后 Supabase 的 `visitor_words` INSERT policy 改为只允许 service_role（即 Worker），anon 不能直接写。

### 4. 不要 hardcode 任何 secret

- 可以 hardcode：SB_URL、SB_ANON、Turnstile site_key（三者均为公开值）
- 不能 hardcode：service_role key、Turnstile secret_key、任何私钥
- 私密 key 一律存 CF Worker 环境变量或 Supabase Vault，不进 git

---

## 访客身份系统设计

- `visitor_id`：本地生成的随机 UUID，存 localStorage
- `visitor_token`：本地生成的随机字符串，存 localStorage，**永远不发给服务端**
- 服务端存 `token_hash = sha256(token)`，改名时比对
- 首次访问时 INSERT visitors，已存在时 SELECT（靠 RLS 控制读写范围）
- 清除 localStorage = 失去身份，无法找回（设计如此，轻量匿名系统）

---

## 管理后台

- 路径：`/admin/`
- 使用 Supabase Auth（邮箱登录），登录后 session 存 localStorage
- 功能：审核词（approve/delete）、管理配置
- **anon 用户无法访问 admin 功能**，所有写操作校验 `auth.role() = 'authenticated'`

---

## 常见操作备忘

### 重置数据库（幂等）

直接在 Supabase SQL Editor 执行 `setup.sql` 的全部内容，可重复执行不报错。

### 新增默认词

在 `setup.sql` 的第 5 节 `insert into visitor_words` 追加，加 `ON CONFLICT DO NOTHING`。

### 更换 Supabase 项目

需要同步更新以下位置的 URL 和 anon key：
- `js/config.js`
- `index.html`（内联 script 中的 SB_ANON）
- `words.html`（内联 script 中的 SB_ANON）
- `admin/js/auth.js`

---

## 本项目不适合做的事

- **不适合存用户隐私数据**：没有真正的身份验证，visitor_id 可伪造
- **不适合存付费/交易数据**：无服务端验证，anon 用户权限边界依赖 RLS
- **不适合高并发写入场景**：静态站 + anon key 架构没有速率限制能力（CF Worker 加入后改善）

---

## 技术选型说明

| 选项 | 选择 | 原因 |
|---|---|---|
| 后端 | 无（静态站） | GitHub Pages 免费，个人博客不需要服务器 |
| 数据库 | Supabase | 免费 tier 够用，RLS 提供基本安全，Realtime 支持 |
| CAPTCHA | Cloudflare Turnstile（计划中） | 免费、无感知、无需 Google 账号 |
| Worker | Cloudflare Workers（计划中） | 免费 10w 请求/天，edge 节点快，环境变量安全存 key |
