# 前端应用基础

Admin 与 Web 是同一业务应用的两个客户端，不是独立后端，也不拥有数据库。它们通过
`packages/contracts` 和 `packages/api-client` 使用 NestJS 暴露的 HTTP API。

## Workspace 边界

```text
contracts ─────▶ api-client ─────▶ admin / web
                       │
design-tokens ─▶ ui ───┘
```

- `contracts`：Zod API 契约和公开类型，不依赖 React 或 NestJS；
- `api-client`：Fetch、响应校验、错误封装、Cookie、CSRF 和 TanStack Query hooks；
- `design-tokens`：跨终端共用的 CSS 变量和响应式常量；
- `ui`：无业务语义、可访问的 React 组件；
- `admin`：权限导航、后台布局和管理功能页；
- `web`：公共站点、认证恢复和用户账户页。

共享包都属于本仓库的私有 workspace，不独立发布，也不放入 `ts-app-packages`。

## 路由与会话

Admin 以 `/admin/` 为 basename，受保护页面先恢复服务端会话，再读取当前有效权限。菜单隐藏
和路由守卫同时生效；隐藏菜单不能替代服务端权限校验。

Web 的首页和认证恢复流程公开，账户中心需要有效会话。浏览器只保存服务端设置的 Cookie，
不会把长期 JWT 或密码写入 localStorage。API Client 从登录或身份恢复响应取得 CSRF Token，
并自动添加到写请求。

生产镜像同时包含两个 Vite 构建产物。Fastify 精确服务静态文件，并分别将未知的 Admin/Web
页面路由回退到对应 `index.html`；`/api/*` 和 `/health/*` 不参与 SPA 回退。

## 新增模块页面

每个后端模块完成时，同步在需要的客户端增加 feature 目录：

```text
admin/src/features/<feature>/
web/src/features/<feature>/
```

页面负责路由参数、表单和视图编排；请求方法和缓存 key 进入 API Client；跨端稳定的输入输出
进入 Contracts；无业务语义且至少被两个页面使用的交互原语才进入 UI。

新增页面必须显式处理 loading、empty、error、forbidden 和 success 状态，并补充与风险相称的
组件、API Client、Docker 或浏览器流程测试。
