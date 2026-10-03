# 部署说明

## 架构

推荐同一 HTTPS 域名：Nginx 提供 `dist/`，将 `/api/` 转发到本机 Uvicorn。API 包含 `/api/media/`，不要删掉路径前缀。SQLite 适合这个单实例个人站；先使用一个后端进程，并把数据库和上传目录放在持久化磁盘。

## 准备

按照 README 安装依赖和导入公开内容，再执行 `npm run build`。复制 `.env.example` 到 `.env`，设置 `ADMIN_USERNAME`、高强度 `ADMIN_PASSWORD`、`COOKIE_SECURE=true` 以及两个绝对持久化路径。内容导入和服务启动必须使用相同的路径变量，否则会产生另一份数据库。

Uvicorn 的环境文件仅在带 `--env-file` 时加载；导入工具从进程环境读取路径，操作系统或进程管理器应提供相同变量。运行目录为项目根目录：

```bash
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --env-file .env
```

通过 systemd 或其他进程管理器托管，配置专用普通用户、WorkingDirectory、失败重启与日志。生产环境不用 `--reload`。上线前访问 `/api/auth/status`，确认 `setupRequired` 为 false；不能把 `.env` 中的占位密码部署出去。

## Nginx 核心配置

下面片段放在已配置 TLS 的 server 中，路径按实际部署位置修改：

```nginx
root /srv/portfolio/dist;
index index.html;
client_max_body_size 12m;
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

必须配置 SPA 回退，否则直接访问 `/articles/:id` 或 `/projects/:id` 会 404。TLS 证书、DNS、认证接口限速和备份任务由服务器环境配置。Vite preview 只用于本地预览，不作为生产服务。仓库 CI 只做检查，不自动部署。

## 备份与恢复

完整私人备份同时保存数据库和上传目录。最简单的可靠方式是在维护窗口停止后台服务后复制整个持久化目录，避免 WAL 文件和上传写入不同步。恢复时先停止服务、还原两者，再启动并检查登录、文章和图片。备份含认证信息，不能上传公开仓库。

`content/site-content.json` 是公开内容快照，导入到新环境后管理员需要重新创建。公开内容导出只复制被内容引用的上传文件，不包含用户和会话；这不是灾难恢复备份。
