# Business Starter 质量标准

## 定位

TS Business App Starter 的目标是成为可直接开发业务逻辑的标准 TypeScript 业务应用底座。

它完整继承 `ts-app-starter` 的工程能力，并增加多个行业应用都会重复需要的通用应用层；它不包含教育、零售、授权订阅等具体行业模型。

## 能力边界

Business Starter 负责：

- 账户、认证、服务端会话和身份恢复；
- 权限机制和管理员初始化；
- 系统设置、敏感配置加密和审计；
- PostgreSQL 后台任务与 Transactional Outbox；
- 站内通知、SMTP 邮件和对象存储；
- 支付 Provider、回调验签、幂等、退款和补偿基础；
- Admin、Web、Contracts、API Client、Design Tokens 和 UI；
- 数据库迁移、测试、Docker、CI、生成和升级机制。

Business Starter 不负责：

- 课程、商品、库存、订阅、授权等行业聚合；
- 行业订单状态机；
- 默认多租户模型；
- 微服务、插件 Runtime、事件溯源平台或强制 Redis；
- 尚未形成稳定边界的可选集成。

## 验收标准

### 可靠生成

CLI 创建的项目必须可以独立安装、迁移、检查、测试、构建和部署。生成结果不得残留模板仓库身份、维护者脚本或基础 Starter 来源文件。

### 安全身份

浏览器默认使用 HttpOnly 安全 Cookie 和可撤销服务端会话。认证端点必须具有限流、会话固定防护、密码验证和越权测试。不得以 localStorage 长期 JWT 作为默认方案。

### 清晰模块边界

Controller、Application Service、Repository 和 Provider Adapter 职责分离。跨模块依赖只能通过公开 Provider、Token、事件或 Contracts，不能相对导入其他模块内部文件。

### 可靠异步处理

后台任务必须支持并发领取、自动重试、退避、超时恢复、幂等和死信。业务事务与后续事件通过 Transactional Outbox 保持一致。

### 支付隔离

支付模块只维护支付意图、尝试、回调和退款记录。它不得直接修改行业订单、课程合同、库存、订阅或授权状态。

### 可验证前端

Admin 和 Web 共享 Contracts、API Client、Design Tokens 和 UI 原子。Admin 资源页范式保留在 Admin 应用内。组件、权限路由、错误态和关键浏览器流程必须自动测试。

### 可重复交付

Format、Lint、Typecheck、Unit、Integration、E2E、Migration Twice、Boundary Check、Generated Project Smoke、Build 和 Docker Smoke 均属于发布门禁。

## 长期判断原则

新增能力进入 Business Starter 前必须回答：

1. 是否被多个标准业务应用重复需要？
2. 是否能在不引入行业模型的情况下完整解释？
3. 是否能提供安全默认值、清晰扩展点和自动化测试？
4. 是否适合随应用源码一起演进，而不是必须成为独立公共包？

不能同时满足时，应留在具体业务应用或等待边界稳定后再评估。
