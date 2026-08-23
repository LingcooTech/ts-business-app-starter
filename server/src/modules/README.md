# Application modules

通用应用能力和行业业务都以 NestJS Module 形式加入此目录。Business Starter 只预置
非行业化应用模块，不预置教育、零售、授权订阅等业务模块。

使用：

```bash
pnpm generate:module <module-name>
```

生成结构：

```text
<module>/
├── <module>.module.ts
├── public.ts
├── api/
├── application/
├── domain/
└── infrastructure/persistence/<module>.schema.ts
```

约定：

- Controller 只处理协议、验证和响应映射；
- Application Service 编排用例和事务；
- Domain 保存不依赖 NestJS/Drizzle 的规则；
- Infrastructure 保存 Drizzle Repository、Schema 和 Provider Adapter；
- Drizzle Schema 由模块拥有，SQL Migration 统一生成到 `server/drizzle/`；
- 其他模块只能从该模块的 `public.ts` 导入；
- 模块不能通过相对路径直接导入 `server/src/infrastructure` 内部文件；
- 生成后必须补充输入校验、Migration 和与风险匹配的测试，再注册到 Composition Root。
