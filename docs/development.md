# Development Guide

## Local workflow

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:bootstrap
pnpm dev
```

启动后：

- API：`http://localhost:8090`
- Admin：`http://localhost:5173/admin/`
- Web：`http://localhost:5174/`
- OpenAPI：`http://localhost:8090/api/docs`

如果本机已有项目占用 PostgreSQL 默认端口 `5438`，同时修改 `.env` 中的
`POSTGRES_PORT` 和 `DATABASE_URL` 端口，例如都改为 `5439`。不要让两个应用复用
同一个开发数据库。

## Commands

| Command                       | Purpose                           |
| ----------------------------- | --------------------------------- |
| `pnpm dev`                    | 并行启动 API、Admin 和 Web        |
| `pnpm dev:server`             | 只启动 API                        |
| `pnpm dev:worker`             | 只启动 Worker                     |
| `pnpm dev:admin`              | 只启动 Admin                      |
| `pnpm dev:web`                | 只启动 Web                        |
| `pnpm db:generate`            | 生成 Drizzle migration            |
| `pnpm db:migrate`             | 执行数据库迁移                    |
| `pnpm db:bootstrap`           | 同步权限并幂等初始化 Owner        |
| `pnpm check`                  | 格式、Lint、类型、测试和构建      |
| `pnpm build`                  | 构建 workspace 项目               |
| `pnpm smoke:generated`        | 验证 CLI 生成项目和命名替换       |
| `pnpm smoke:docker`           | 构建并启动生产 Compose smoke 环境 |
| `pnpm generate:module <name>` | 生成最小 NestJS 业务模块          |
| `pnpm check:boundaries`       | 检查模块依赖方向                  |
| `pnpm check:toolchain`        | 验证 Node.js 与 pnpm 工具链       |

## Adding an API module

使用 NestJS Module 组织业务能力。Starter 已预置非行业化 Identity 与 Access Control，
不包含教育、零售等行业模块：

```text
server/src/modules/users/
├── users.module.ts
├── public.ts
├── api/
├── application/
├── domain/
└── infrastructure/persistence/
```

也可以从最小模板开始：

```bash
pnpm generate:module users
```

建议顺序：

1. 先定义模块边界和 API 行为；
2. 增加 DTO 和输入校验；
3. 增加 Service 业务逻辑；
4. 通过 Repository 访问数据库；
5. 添加 Controller；
6. 添加单元测试和集成测试；
7. 添加 Drizzle migration。

不要在 Controller 中直接编写复杂数据库查询，也不要把多个业务模块的状态放进全局单例。

后台任务、Outbox、邮件和通知的 Handler、事务与幂等约束见
[异步基础](async-foundation.md)。本地验证实际消费时需要同时运行 `pnpm dev:worker`。

## Adding a frontend page

管理后台页面放在：

```text
admin/src/features/<feature>/
```

公共页面放在：

```text
web/src/features/<feature>/
```

前端通过 API Client 访问服务端。跨端 API 输入输出放入 Contracts，复用交互原语放入 UI；
页面级数据请求、权限、空状态、错误状态和加载状态必须显式处理。完整边界见
[前端应用基础](frontend-foundation.md)。

## HTTP conventions

请求输入使用 Zod schema，并通过 `ZodValidationPipe` 显式绑定。异常由 `ApiErrorFilter` 统一转换为：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {},
    "requestId": "..."
  }
}
```

详见 [HTTP conventions](../server/src/common/http/README.md)。

## Shared code

`packages/` 只表示当前应用仓库内部的私有共享空间，不是公共 package 仓库。Starter
当前预置 `packages/contracts`，由 Server 和后续 API Client/前端共同消费。

公共能力应从独立的 package 仓库发布后，通过 npm 依赖使用。应用内部的 `packages/` 只适合放应用私有、跨多个工作区项目共享的代码，例如 API contracts、API client、设计 tokens 或纯业务规则。

项目内部共享代码可以放在 `packages/`，但应满足：

- 至少被两个模块真实使用；
- 有清晰的输入和输出边界；
- 不依赖具体业务模块；
- 有测试；
- 不把整个业务层抽成“万能工具包”。

不应在这里复制或包装 `@lingcoo-tech/security`、`@lingcoo-tech/http` 等公共 package，也不应把数据库 schema、migration、完整 NestJS 模块或单个服务使用的工具函数放入这里。

跨应用的通用能力应在独立的公共 package 仓库中版本化发布。只有经过至少两个真实应用验证、边界稳定且不携带业务语义后，才考虑从应用内部代码提取为公共 package。

详见 [Package validation](./package-validation.md)。

## Configuration

环境变量在应用启动时校验。新增配置时：

1. 在环境 schema 中定义类型和默认策略；
2. 更新 `.env.example`；
3. 更新生产环境模板；
4. 在 CI 中提供测试值；
5. 在 README 或部署文档说明用途。

不要为生产环境提交真实默认值。

## Testing and pull requests

提交前运行：

```bash
pnpm check
```

Pull Request 应说明：

- 改动解决的问题；
- API 或数据库是否变化；
- 是否需要环境变量或迁移；
- 如何验证；
- 是否影响部署。

CI 会在 GitHub Actions 中重复执行安装、迁移、检查、测试、构建和依赖审计。

## Workspace tasks

Starter 当前使用 pnpm workspace，不预置 Turborepo。新增 package 后，应在根脚本中明确任务依赖和构建顺序，并声明构建输出；只有 workspace 规模足以产生明显重复构建成本时，才引入任务图和远程缓存工具。
