# Cert Distribution

基于 Bun + Elysia + Prisma + SQLite 的证书发放系统。

## 功能概览

- 用户输入 QQ 号后获取邮箱验证码
- 验证通过后查看并下载自己的证书
- 验证通过后查看证书快递单号
- 管理员通过隐藏入口登录后台
- 支持手动上传单个证书
- 支持按 `QQ号_姓名.扩展名` 规则批量导入
- 支持 CSV 批量导入证书快递单号
- 支持管理员向全部已入库用户发送证书领取提醒邮件

## 环境变量

复制 `.env.example` 为 `.env`，并至少配置以下内容：

```bash
DATABASE_URL="file:./prisma/dev.db"
ADMIN_PASSWORD="请替换为管理员密码"
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_USER="your-account@qq.com"
SMTP_PASS="your-smtp-password"
```

可选配置：

```bash
PORT="3000"
HOST="0.0.0.0"
```

## 启动步骤

```bash
bun install
cp .env.example .env
bun run prisma:generate
bun run prisma:migrate --name init
bun run dev
```

默认访问地址：

- 用户入口：`http://localhost:3000/`
- 管理员入口：`http://localhost:3000/admin`

## Docker 部署

项目根目录已经提供以下文件：

- `Dockerfile`
- `compose.yml`
- `docker-entrypoint.sh`

推荐在服务器上直接使用 `docker compose` 部署。

### 1. 准备环境变量

```bash
cp .env.example .env
```

然后编辑 `.env`，至少填好：

- `ADMIN_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

`compose.yml` 会在容器内强制使用 `DATABASE_URL="file:/app/data/app.db"`，并把 SQLite 数据库存到 Docker volume 中，不会污染代码目录。

### 2. 启动服务

```bash
docker compose up -d --build
```

启动后访问：

- 用户入口：`http://服务器IP:3000/`
- 管理员入口：`http://服务器IP:3000/admin`

### 3. 常用运维命令

```bash
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose up -d --build
docker compose down
```

### 4. 持久化说明

以下数据会自动持久化到 Docker volume：

- SQLite 数据库：`/app/data/app.db`
- 上传文件：`/app/storage/uploads`

这意味着容器重建后，数据库和证书文件仍会保留。

### 5. 反向代理建议

如果你准备对外正式提供服务，建议在服务器前面加 Nginx 或 Caddy，把 `80/443` 反向代理到容器的 `3000` 端口，并顺带处理 HTTPS。

如果使用 Nginx，默认 `client_max_body_size` 很容易让文件上传直接报 `413 Request Entity Too Large`。当前后台批量导入已经改成浏览器逐个上传文件，因此这里的限制只需要覆盖“单个证书文件”的大小，而不是整批文件的总大小，例如：

```nginx
server {
  client_max_body_size 20m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## GitHub Actions 自动发布 GHCR

仓库已新增 [`.github/workflows/publish-ghcr.yml`](.github/workflows/publish-ghcr.yml)，会在以下场景自动构建并推送 Docker 镜像到 GitHub Container Registry：

- 推送到 `main`
- 推送匹配 `v*` 的标签，例如 `v1.0.0`
- 在 GitHub Actions 页面手动触发

镜像名会自动使用小写仓库路径，避免 GHCR 因大小写不合法而发布失败。常见标签如下：

- `ghcr.io/<owner>/<repo>:latest`：默认分支最新镜像
- `ghcr.io/<owner>/<repo>:main`：`main` 分支推送
- `ghcr.io/<owner>/<repo>:v1.0.0`：版本标签推送
- `ghcr.io/<owner>/<repo>:sha-<commit>`：提交级别可追溯标签

使用前请确认：

- 仓库或组织允许 GitHub Actions 使用 `GITHUB_TOKEN` 写入 Packages
- 如果需要匿名拉取镜像，请在 GHCR 的包设置里把对应镜像设为 `public`
- 服务器侧如果改为拉取 GHCR 镜像部署，需要先执行 `docker login ghcr.io`

## 后台上传说明

手动新增时，直接填写 QQ 号、持有人昵称并上传文件即可。

批量导入时，请先将文件命名为：

```text
123456789_张三.pdf
987654321_李四.jpg
```

系统会自动解析文件名中的 QQ 号和姓名，并逐个上传写入数据库。这样即使一次选择很多文件，也不会把所有文件压成一个超大的请求体。

## 常用命令

```bash
bun run dev
bun run prisma:generate
bun run prisma:migrate --name init
bun run prisma:studio
```
