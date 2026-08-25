# @lingcoo-tech/create-ts-business-app-starter

The official project generator for [Lingcoo TS Business App Starter](https://github.com/LingcooTech/ts-business-app-starter).

```bash
npx @lingcoo-tech/create-ts-business-app-starter@latest my-app
```

The generator creates an independent project, initializes Git, and installs dependencies by default. Use `--skip-install`, `--no-git`, `--force`, `--package-manager npm`, or `--ref <branch-or-tag>` to customize the process. `--force` is required before replacing a non-empty target directory.

After generation, copy `.env.example` to `.env`, set the database and encryption values, then run:

```bash
pnpm db:migrate
pnpm db:bootstrap
pnpm dev
```
