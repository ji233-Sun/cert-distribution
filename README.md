# Cert Distribution

基于 Bun + Elysia + Prisma + SQLite 的证书发放系统。

## 功能概览

- 用户输入 QQ 号后获取邮箱验证码
- 验证通过后查看并下载自己的证书
- 管理员通过隐藏入口登录后台
- 支持手动上传单个证书
- 支持按 `QQ号_姓名.扩展名` 规则批量导入

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

## 后台上传说明

手动新增时，直接填写 QQ 号、持有人昵称并上传文件即可。

批量导入时，请先将文件命名为：

```text
123456789_张三.pdf
987654321_李四.jpg
```

系统会自动解析文件名中的 QQ 号和姓名，并写入数据库。

## 常用命令

```bash
bun run dev
bun run prisma:generate
bun run prisma:migrate --name init
bun run prisma:studio
```
