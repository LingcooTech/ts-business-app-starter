# Package 边界与验证结论

## 目的

Starter 的验证项目不是用来完整迁移 Edu 或 Retail 业务，而是验证：

1. `ts-business-app-starter` 能否通过 npx 生成独立应用；
2. 生成应用能否优先复用本地缓存并以冻结锁文件完成安装和 `pnpm check`；
3. 独立应用能否消费已发布的 `@lingcoo-tech/*` package；
4. 多个真实项目是否暴露出稳定、值得公共化的重复能力。

## 当前 Business Starter 验证结果

| 验证项                         | 结果 |
| ------------------------------ | ---- |
| Business CLI 本地模板生成      | 通过 |
| 模板身份和维护者文件清理       | 通过 |
| workspace 依赖和构建产物未复制 | 通过 |
| 冻结锁文件安装（优先缓存）     | 通过 |
| 生成项目 Format/Lint/Typecheck | 通过 |
| 生成项目测试和构建             | 通过 |
| 模块生成器与边界检查           | 通过 |
| PostgreSQL/Docker 生产 Smoke   | 通过 |

Edu、Retail 和 Core 的历史实现只用于证明需求重复和公共包边界，不视为已经由 Business Starter 生成或迁移完成。

## 内部前端与契约 workspaces

Business Starter 当前提供四个只随应用源码演进的私有 workspace：

- `contracts`：错误、身份、权限、分页、UUID 和带时区时间契约；
- `api-client`：响应校验、统一错误、Cookie、CSRF 与 React Query hooks；
- `design-tokens`：Admin/Web 共用的视觉基础；
- `ui`：表单、表格、弹窗、通知、反馈与错误边界。

它们不属于 `ts-app-packages`，不独立发布，也不包含 NestJS 或行业业务逻辑。

## 当前四个 package 的结论

现有四个 package 已覆盖当前三个项目中最稳定的重复基础能力，暂时不需要新增公共 package：

| Package                  | 结论                 | 边界                                                                             |
| ------------------------ | -------------------- | -------------------------------------------------------------------------------- |
| `@lingcoo-tech/security` | 保留并继续演进       | 密码哈希、JWT、Bearer Token 等安全原语；不包含用户表、角色模型和登录流程         |
| `@lingcoo-tech/http`     | 保留并继续演进       | 框架无关的错误对象和响应 contract；不包含 Nest/Fastify 适配实现                  |
| `@lingcoo-tech/crypto`   | 保留并继续演进       | AES-GCM、版本化密文和配置加解密原语；不包含 Qiniu、支付或 SMTP 配置              |
| `@lingcoo-tech/mailer`   | 保留，按真实需求演进 | provider-neutral mail contract 和 SMTP adapter；不包含验证码、模板或业务邮件流程 |

## 暂不新增的能力

- `config`：环境变量 schema 属于应用，Starter 已经提供 Zod 校验基线；
- `database`：连接、schema、migration 和事务边界属于应用；
- `validation`：直接使用成熟的 Zod，不再包一层；
- `rate-limit`：依赖 Web 框架、Redis 和应用的 key 策略；
- `rbac`：Edu、Retail、Core 的角色和权限语义不同；
- `audit`：审计字段、存储和业务事件仍属于应用能力；
- `storage`：对象存储和 Qiniu 适配带有供应商及业务语义；
- 支付、队列、Redis、通知和认证流程：都不属于当前公共基础 package 范围。

## 决策规则

候选能力只有同时满足以下条件，才进入公共 package 评估：

- 至少两个独立应用存在重复实现；
- API 边界已经稳定；
- 不包含行业、产品或供应商语义；
- 能用成熟依赖解决时，不重复自研；
- 可以在独立 package 中测试和版本化；
- 被第二个应用实际消费后仍然没有明显定制分支。

当前阶段不新增跨仓库公共 package。实际采用情况：

- Identity 消费 `@lingcoo-tech/security` 的密码哈希能力；
- 服务端使用 `@lingcoo-tech/http` 的 `ApiError`、异常转换和响应构造；
- Contracts 组合 `@lingcoo-tech/http` 的响应守卫，并额外强制 Business API 的 request ID；
- API Client 通过继承公共 `ApiError` 只补充客户端 request ID，不重复定义状态码、错误码和详情；
- Settings 使用 `@lingcoo-tech/crypto` 的版本化 AES-256-GCM 信封，不复制加解密原语；
- Nest/Fastify 异常适配、Cookie 会话和权限编排继续保留在 Business Starter。

`@lingcoo-tech/mailer` 等到 Mail 模块实际落地时接入，不提前增加空依赖。
