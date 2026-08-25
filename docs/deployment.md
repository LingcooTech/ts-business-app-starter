# Deployment Guide

`ts-business-app-starter` 提供的是通用部署模板。它默认不部署任何服务器，也不包含任何特定域名、镜像仓库或生产凭据。

## Deployment flow

```text
Developer GitHub repository
          │
          ▼
      GitHub Actions
          │
          ├── install and test
          ├── build Docker image
          ├── push to developer registry
          └── SSH to developer server
                         │
                         ▼
                    Docker Compose
```

生产服务器不执行 Docker build。它只负责：

1. 拉取指定 commit SHA 的镜像；
2. 启动或等待 PostgreSQL；
3. 执行数据库迁移；
4. 同步权限并幂等初始化 Owner；
5. 启动 API、Worker 和 Caddy；
6. 等待健康检查并执行冒烟验证。

## Prepare a container registry first

ACR is an independent Alibaba Cloud resource. It does not appear automatically when a GitHub repository is created. Before configuring GitHub Actions, the developer must prepare a registry that GitHub Actions can push to and the production server can pull from.

1. Create or select an Alibaba Cloud account and region.
2. Activate an ACR Personal Edition or Enterprise Edition instance according to the application's scale, network, and availability requirements.
3. Create a namespace, for example `my-team`.
4. Create an image repository, for example `my-business-app`, or enable the instance's approved automatic repository creation policy.
5. Configure Internet/VPC access control so GitHub-hosted runners and the production server can reach the registry.
6. Create a dedicated RAM user or ACR access credential with only the required repository push/pull permissions.
7. Set an ACR login password and verify the login from a trusted machine:

```bash
docker login <registry-host> --username <acr-username>
```

Record the registry host, namespace, username, and password in a password manager. Only after these steps should the values be copied into the GitHub Actions Secrets described below. Alibaba Cloud recommends separate ACR credentials rather than reusing the console login password. See the [ACR access credential guide](https://www.alibabacloud.com/help/en/acr/user-guide/configure-access-credentials) and [namespace guide](https://www.alibabacloud.com/help/en/acr/user-guide/manage-namespaces).

## Enable deployment

模板仓库的 Deploy workflow 默认关闭。开发者复制模板后，在自己的仓库配置：

```text
DEPLOY_ENABLED=true
```

没有这个变量时，CI 仍然运行，但镜像发布和服务器部署会被跳过。

## GitHub Variables

非敏感变量：

| Variable                 | Description                             |
| ------------------------ | --------------------------------------- |
| `DEPLOY_ENABLED`         | 是否启用发布和部署，必须为 `true`       |
| `IMAGE_NAME`             | 镜像名，例如 `my-business-app`          |
| `GHCR_IMAGE`             | 完整 GHCR 镜像地址                      |
| `DEPLOY_HOST`            | 开发者服务器地址                        |
| `DEPLOY_USER`            | 专用非-root SSH 用户                    |
| `DEPLOY_PATH`            | 服务器部署目录                          |
| `DEPLOY_HEALTHCHECK_URL` | 外部 readiness URL                      |
| `DEPLOY_REPOSITORY`      | 服务器拉取源码所用的 Git URL            |
| `DEPLOY_GIT_KEY`         | 可选，服务器拉取私有仓库所用的 key 路径 |

## GitHub Secrets

敏感信息必须使用 Secrets：

| Secret                   | Description                    |
| ------------------------ | ------------------------------ |
| `ACR_REGISTRY`           | 镜像仓库地址                   |
| `ACR_NAMESPACE`          | 镜像仓库命名空间               |
| `ACR_USERNAME`           | 镜像仓库账号                   |
| `ACR_PASSWORD`           | 镜像仓库密码                   |
| `DEPLOY_SSH_PRIVATE_KEY` | GitHub Runner 连接服务器的私钥 |
| `DEPLOY_SSH_KNOWN_HOSTS` | 服务器 SSH host key            |

如果只使用 GHCR，可以将 ACR 发布步骤替换为自己的 registry 登录和推送步骤。Starter 不要求特定云厂商。

## Server preparation

服务器需要预先安装：

- Docker Engine；
- Docker Compose plugin；
- curl；
- 一个非-root部署用户；
- 该用户访问目标 Git 仓库和镜像仓库的权限。

在部署目录创建 `.env`：

```bash
cp deploy/production.env.example /path/to/deployment/.env
```

数据库密码必须随机生成，并且与 `DATABASE_URL` 中的密码一致。`.env` 不应提交到 Git。

首次部署应设置随机的 `BOOTSTRAP_OWNER_PASSWORD`。部署脚本在 Migration 后运行显式
Bootstrap；确认 Owner 可以登录后，从生产 `.env` 删除 Owner 密码。后续部署仍会同步代码中
声明的系统权限，但不会重置既有 Owner 密码。

`PUBLIC_WEB_URL` 必须填写用户可访问的 Web 根地址，用于密码重置和邮箱验证链接。生产环境
应选择 `MAIL_TRANSPORT=smtp` 并配置 SMTP；使用默认 `log` 只会记录模拟成功。Worker 必须与
API 使用同一数据库和加密配置，且多个 Worker 副本不要配置相同的 `JOB_WORKER_ID`。完整配置
和失败语义见[异步基础](async-foundation.md)。

对象存储默认使用 `STORAGE_PROVIDER=local`，并由 Compose 将 `storage_data` 挂载到
`/app/storage`。这种模式只适合单 API 主机。需要多副本、跨主机或云存储时，应切换为 `s3`，
配置 Region、Bucket、可选 Endpoint、凭据与 Path-style 模式；凭据应放在生产 Secret 或通过
Settings 加密保存。公共 Bucket/CDN 才配置 `STORAGE_PUBLIC_BASE_URL`，否则系统返回短期签名
访问 URL。完整配置、安全限制和 Provider 边界见[对象存储](object-storage.md)。

生产支付必须选择 `PAYMENT_PROVIDER=alipay` 或 `wechat` 并配置对应商户凭据；Mock 在生产
运行时会被拒绝。`PAYMENT_NOTIFY_BASE_URL` 必须是 Provider 可访问的 HTTPS API 根地址，代理
必须保留回调原始请求体和微信签名头。支付宝配置 App ID、应用私钥、支付宝公钥、网关与浏览器
返回地址；微信配置商户号、App ID、商户证书序列号、商户私钥、平台证书/公钥 JSON 和 32 字节
API v3 Key。凭据应进入 Secret 或加密 Settings，不能提交到 Git。上线前还需用沙箱或小额真实
交易验证支付、异步回调、查单、关闭、退款和证书轮换。完整边界见[支付基础设施](payments.md)。

## Image tags and rollback

每次发布使用两个标签：

```text
latest
<git-commit-sha>
```

生产部署应优先使用 commit SHA，而不是 `latest`。回滚时，将 `APP_IMAGE` 指向上一个成功的 SHA，再重新执行 Compose 部署。

## Security rules

- 不使用 root 作为长期部署账号；
- 不在仓库中写入服务器密码或私钥；
- 不在生产服务器执行源码构建；
- 限制部署 SSH key 的权限和来源；
- 使用 GitHub Environment 保护 production 部署；
- 生产数据库和镜像仓库凭据独立管理。
