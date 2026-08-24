# Architecture

本文档说明 `ts-business-app-starter` 的架构边界。仓库完整继承
`ts-app-starter@235cfdb`，并在相同的模块化单体和交付拓扑上逐步增加非行业化应用能力。

## Architectural layers

```text
clients  ────────▶  services  ────────▶  database / integrations
   │                   │
   │                   └──────────────▶ worker / jobs
   │
   └── static assets served through the API container in production
```

### Clients

当前仓库有两个客户端：

- `admin/`：管理后台；
- `web/`：公共 Web 应用。

它们使用 React、Vite、React Router 和 TypeScript 构建。客户端通过 HTTP API 与后端通信，
不直接访问 PostgreSQL。两个客户端共享四个私有 workspace：

- `contracts`：请求、响应与错误契约；
- `api-client`：运行时响应校验、Cookie 会话、CSRF 和 TanStack Query；
- `design-tokens`：颜色、间距、圆角、阴影与响应式约定；
- `ui`：按钮、表单、表格、弹窗、通知、反馈和错误边界。

Admin 负责权限驱动的导航、受保护路由和后台页面编排；Web 负责公共页面、登录、密码恢复、
邮箱验证和账户中心。生产环境由 API 容器托管构建产物，并为两个应用提供独立 SPA 深层路由回退。

### Services

当前 `server/` 包含两个运行入口：

```text
server/src/main.ts    # HTTP API
server/src/worker.ts  # standalone Worker
```

API 进程负责请求处理和静态资源，Worker 进程负责后台任务。两者使用相同的 Docker runtime image，但使用不同的启动命令。

### Application modules

通用应用能力和后续行业业务都使用 NestJS Module 表达：

```text
server/src/modules/<module>/
├── <module>.module.ts
├── api/
├── application/
├── domain/
├── infrastructure/
└── public.ts
```

简单模块不需要制造空层级。Controller、应用编排、数据库访问和第三方 SDK
不能堆入同一文件。跨模块依赖只能通过显式公开的 Provider、Token、事件或契约连接。

Business Starter 提供或计划提供以下非行业化模块：

- identity（已交付）；
- access-control（已交付）；
- settings（已交付）；
- audit（已交付）；
- jobs 与 transactional outbox（已交付）；
- notifications（已交付）；
- mail（已交付）；
- storage；
- payments。

这些模块不拥有教育、零售、订阅授权或其他行业数据模型。

Identity 使用 HttpOnly Cookie 与可撤销的 PostgreSQL 服务端会话；数据库只保存会话和
一次性操作令牌的 SHA-256 摘要。Access Control 使用默认拒绝的全局 Guard，写请求还需
验证与会话绑定的 CSRF Token。角色与账户、认证相互独立，Starter 只同步通用权限和系统
Owner，不预置行业角色。

Settings 通过注册表限制可管理的配置键，采用数据库覆盖、环境变量兜底，并使用
`@lingcoo-tech/crypto` 保存带 Key ID 的 AES-256-GCM 密文。Audit 是显式业务事件而非访问日志；
设置变更与审计事件在同一事务提交，数据库触发器禁止修改或删除既有审计记录。

Jobs 使用 PostgreSQL 锁定领取、心跳、超时恢复、指数退避和死信，不依赖 Redis。
Transactional Outbox 要求调用方传入业务事务，保证业务记录与事件共同提交。Mail 通过
`@lingcoo-tech/mailer` 的公开 SMTP Adapter 投递；HTTP 只写入任务，实际发送由独立 Worker
完成。Notifications 以收件人与 Dedupe Key 的数据库唯一约束抵抗事件重放。详细运行约束见
[异步基础](async-foundation.md)。

## Runtime topology

生产 Compose 拓扑包含四个服务：

```text
postgres ────────┐
                 ├── api ─── caddy ─── public traffic
                 └── worker
```

- `postgres`：持久化关系型数据库；
- `api`：NestJS + Fastify HTTP 服务；
- `worker`：NestJS standalone application context；
- `caddy`：反向代理和安全响应头。

API 和 Worker 依赖 PostgreSQL 健康状态。发布脚本在迁移前显式等待数据库 ready，避免容器已经启动但数据库仍拒绝连接。

## Configuration boundary

启动配置通过环境变量进入应用，并在启动时使用 Zod 校验。可由管理员维护的运行设置
进入 SettingsModule；敏感值加密保存，环境变量作为兜底来源。仓库只提交：

- `.env.example`；
- `deploy/production.env.example`；
- 不含凭据的配置说明。

密码、Token、SSH 私钥和生产环境文件不进入 Git。部署目标由开发者自己的 GitHub Variables 配置，凭据由 GitHub Secrets 或外部 Secret Manager 管理。

## Data boundary

数据库结构由 Drizzle migration 管理：

```text
server/drizzle/*.sql
```

迁移必须可重复执行。CI 会执行两次迁移，验证第二次执行不会产生额外变更。

## Why this architecture

- NestJS 提供模块、依赖注入、Controller、Provider 和测试边界；
- Fastify 提供低开销 HTTP 层和插件体系；
- Worker 与 API 分进程，避免后台任务阻塞请求处理；
- PostgreSQL 适合事务、关系建模和成熟运维；
- Drizzle 保留 SQL 迁移，同时提供 TypeScript 类型能力；
- Docker 保证开发、CI 和生产使用相同的构建边界；
- GitHub Actions 将构建放在 Runner，低配置生产服务器只拉取镜像。

## What this architecture deliberately avoids

本项目不引入：

- 自研后端 Runtime；
- Extension Manifest；
- Capability Registry；
- 全局模块注册表；
- 复制源码代替版本化依赖；
- 把业务模块强行塞进 Starter。

本仓库区分两类共享代码：

- `@lingcoo-tech/*` 是独立发布、框架无关的跨仓库基础包；
- `packages/*` 是 Server、Admin、Web 之间真实共享的私有 workspace。

NestJS 应用流程、数据库表和管理页面不放入跨仓库基础包。内部 workspace 默认只包含
contracts、api-client、design-tokens 和 ui。行业业务仍然留在生成后的具体应用中。
