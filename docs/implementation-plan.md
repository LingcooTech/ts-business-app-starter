# TS Business App Starter 实施计划

当前实施结论、已验证边界和中断恢复步骤见
[`implementation-status.md`](./implementation-status.md)。后续开发应先读取该文档，不重复评估已完成阶段。

## 1. 基线

本仓库由 `ts-app-starter@235cfdbe4262cff73b21d4e1a602ccc8fd252cbb` 一次性派生，是独立、自包含的完整仓库。

最终用户只运行：

```bash
npx @lingcoo-tech/create-ts-business-app-starter@latest my-business-app
```

不会先运行 App Starter，再用 Business Starter 覆盖。

## 2. 实施顺序

### 阶段 0：独立仓库基线

状态：已完成。

- 派生完整基础仓库；
- 调整仓库、workspace、容器和 CLI 身份；
- 记录 Base Starter Commit；
- 保持原工程检查、生成项目和 Docker 验收通过；
- 建立独立初始提交。

### 阶段 1：Contracts 与数据库约定

状态：已完成。

- 建立 `packages/contracts`；
- 固定错误、分页、时间、ID 和公开契约；
- 固定模块 Schema 与 Migration 所有权；
- 扩展模块生成器和边界检查。

### 阶段 2：身份与权限

状态：已完成。

- IdentityModule；
- AccessControlModule；
- HttpOnly Cookie 与服务端会话；
- 登录、退出、身份恢复、验证和密码重置；
- Bootstrap Owner 与权限同步。

### 阶段 3：共享前端基础、Admin 与 Web

状态：已完成。

- API Client、Design Tokens 与 UI 私有 workspace；
- 运行时响应契约校验、Cookie 会话与 CSRF；
- TanStack Query 服务端状态管理；
- Admin Shell、真实登录、身份恢复、权限菜单和账户安全；
- Web Shell、登录、密码恢复、邮箱验证和账户中心；
- 共享表格、表单、弹窗、通知、错误边界和响应式布局；
- 生产静态托管与 Admin/Web SPA 深层路由。

### 阶段 4：设置与审计

状态：已完成。

- SettingsModule；
- 数据库覆盖与环境变量兜底；
- AES-GCM、脱敏和密钥轮换；
- AuditModule 与管理查询。

### 阶段 5：任务、Outbox、邮件和通知

状态：已完成。

- PostgreSQL Jobs；
- 自动重试、退避、超时恢复和死信；
- Transactional Outbox；
- MailModule；
- NotificationsModule；
- 对应 Admin 页面。

### 阶段 6：对象存储

状态：已完成。

- ObjectStoragePort；
- 本地开发和通用 S3-compatible Adapter（含七牛兼容端点）；
- 上传授权、安全限制和对象元数据；
- 配置测试和媒体选择器。

### 阶段 7：支付

状态：已完成。

- Payment Provider Port；
- Mock、支付宝和微信支付 API v3 Adapter；
- 支付意图、回调验签、幂等、查单、退款和补偿；
- Outbox 支付事件；
- 支付管理后台。

### 阶段 8：产品化交付

状态：下一阶段。

- 创建 CLI；
- 包名和环境变量替换；
- 迁移和管理员初始化；
- Docker、CI、镜像和部署；
- 生成项目和升级文档验收。

各后续模块必须同步增加 Admin/Web 可见页面与浏览器关键流程测试，不再把前端集中到最后补做。

## 3. 单模块门禁

每个模块按完整闭环交付：

```text
Schema
  → Migration
  → Repository
  → Application Service
  → Controller / Worker
  → Contracts
  → API Client
  → Admin / Web
  → Unit / Integration / E2E
```

一个基础模块没有达到验收标准前，不同时铺开多个相互依赖模块。

## 4. 完成定义

- 完整继承基础 Starter 的工程能力；
- 通用后端模块职责清晰且测试完整；
- 支付、邮件和存储 Adapter 与 NestJS 编排解耦；
- 支付模块不拥有行业订单；
- Admin/Web 和四个内部 workspace 可直接使用；
- Migration、Bootstrap、Worker 和 Outbox 可重复执行；
- CLI 生成的独立项目可安装、迁移、检查、构建和部署；
- CI、Docker、E2E 和生成项目 smoke 全部通过；
- 不包含教育、零售或 Core 专属业务。
