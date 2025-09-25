# MyNest 🪹

**链接的归巢** | *Where links come home.*

自动将 Telegram、RSS 等来源的链接保存到你的 NAS，私有、安全、可扩展。

✨ 插件化架构 | 🚀 aria2 驱动 | 🔐 完全自托管

## 功能特性

- 🔌 **插件化架构**：独立进程插件系统，热插拔支持
- 📥 **多协议下载**：支持 HTTP/HTTPS、FTP、磁力链接、BT 种子
- 💬 **Telegram 集成**：自动解析消息链接、转发消息、媒体附件
- 📂 **智能路径管理**：可配置下载路径模板 `{plugin}/{date}/{filename}`
- 🗄️ **PostgreSQL 存储**：可靠的任务和配置持久化
- 🎨 **现代 UI**：React + shadcn/ui，响应式设计
- 📊 **实时监控**：插件运行状态、日志查看、下载进度
- 🐳 **一键部署**：Docker Compose 开箱即用

## 快速部署

### Docker Compose (推荐)

```bash
# 方式一：直接下载配置文件
wget https://raw.githubusercontent.com/matrix/mynest/main/docker-compose.yml
wget https://raw.githubusercontent.com/matrix/mynest/main/.env.example -O .env

# 编辑配置（修改密码等）
nano .env

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f mynest
```

### 一键部署脚本

```bash
# 方式二：一键部署脚本
curl -fsSL https://raw.githubusercontent.com/matrix/mynest/main/install.sh | bash
```

### 手动 Docker 运行

```bash
# 方式三：手动运行（仅用于测试）
docker run -d \
  --name mynest \
  -p 3000:80 \
  -v $(pwd)/downloads:/downloads \
  -e POSTGRES_PASSWORD=mynest123 \
  -e ARIA2_SECRET=mynest123 \
  yourusername/mynest:latest

# 注意：手动运行缺少 PostgreSQL 和 aria2，仅用于测试前端界面
```

**访问应用:**
- Web 界面: http://localhost:3000
- 后端 API 通过 Nginx 自动代理（`/api/*` → `http://127.0.0.1:8080`）
- 健康检查: http://localhost:3000/health

### 配置 Telegram Bot

1. **创建 Bot**
   - 在 Telegram 搜索 [@BotFather](https://t.me/BotFather)
   - 发送 `/newbot` 并按提示创建
   - 保存获得的 Bot Token

2. **获取用户 ID**
   - 搜索 [@userinfobot](https://t.me/userinfobot) 获取你的用户 ID

3. **Web 界面配置**
   - 打开 http://localhost:3000/plugins
   - 点击 Telegram Bot 配置按钮
   - 填入 Bot Token 和允许的用户 ID
   - 保存并启用插件

4. **开始使用**
   - 向你的 Bot 发送任何包含链接的消息
   - 支持转发消息、图片、视频、文件

## 项目结构

```
MyNest/
├── backend/              # Go 后端服务
│   ├── handler/          # HTTP 处理器
│   ├── service/          # 业务逻辑
│   ├── model/            # 数据模型
│   ├── plugin/           # 插件管理器
│   ├── downloader/       # 下载引擎抽象
│   └── main.go
├── frontend/             # React 前端
│   └── src/
│       ├── pages/        # 页面组件
│       ├── components/   # 复用组件
│       └── lib/          # API 客户端
├── plugins/              # 插件模块
│   └── telegram-bot/     # Telegram 插件
├── docker-compose.yml    # Docker 编排
└── Makefile             # 快捷命令
```

## 系统配置

### 下载路径模板

在系统设置页面配置路径模板，支持以下变量：

- `{plugin}` - 插件名称（如 `telegram`）
- `{date}` - 当前日期（格式：2006-01-02）
- `{datetime}` - 当前日期时间（格式：2006-01-02_15-04-05）
- `{filename}` - 文件名
- `{random}` - 8 位随机字符串

**示例模板:**
```
{plugin}/{date}/{filename}          → telegram/2025-01-15/video.mp4
downloads/{plugin}/{random}         → downloads/telegram/a1b2c3d4
media/{datetime}/{filename}         → media/2025-01-15_14-30-00/photo.jpg
```

### aria2 配置

- **RPC URL**: aria2 RPC 地址（默认 `http://localhost:6800/jsonrpc`）
- **RPC Secret**: aria2 认证密钥
- **下载目录**: aria2 基础下载目录（路径模板将在此基础上应用）

## 开发指南

### 本地开发

**后端:**
```bash
make tidy              # 安装 Go 依赖
make dev               # 启动开发服务器 (http://localhost:8080)
```

**前端:**
```bash
cd frontend
pnpm install           # 安装依赖
pnpm dev              # 启动开发服务器 (http://localhost:5173)
```

### 常用命令

### Docker Compose 管理
```bash
# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看实时日志
docker-compose logs -f mynest

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新镜像
docker-compose pull && docker-compose up -d
```

### 开发命令（Makefile）
```bash
make build-core        # 构建核心服务
make build-plugins     # 构建所有插件
make build-frontend    # 构建前端
make up               # 启动 Docker Compose 服务
make down             # 停止服务
make logs             # 查看服务日志
make clean            # 清理构建产物
```

## API 文档

### 下载任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/download` | 提交下载任务 |
| GET | `/api/v1/tasks` | 获取任务列表 |
| GET | `/api/v1/tasks/:id` | 获取任务详情 |
| POST | `/api/v1/tasks/:id/retry` | 重试失败任务 |
| POST | `/api/v1/tasks/:id/pause` | 暂停/恢复任务 |
| DELETE | `/api/v1/tasks/:id` | 删除任务 |

### 插件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/plugins` | 获取插件列表 |
| POST | `/api/v1/plugins/:name/enable` | 启用插件 |
| POST | `/api/v1/plugins/:name/disable` | 禁用插件 |
| GET | `/api/v1/plugins/:name/logs` | 获取插件日志 |

### 系统配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/system/config` | 获取系统配置 |
| PUT | `/api/v1/system/config` | 更新系统配置 |

## 插件开发

MyNest 使用独立进程插件系统：

### 创建新插件

1. **创建插件目录**
   ```bash
   mkdir plugins/my-plugin
   cd plugins/my-plugin
   ```

2. **实现主程序**
   ```go
   package main

   import (
       "bytes"
       "encoding/json"
       "net/http"
   )

   type DownloadRequest struct {
       URL        string `json:"url"`
       PluginName string `json:"plugin"`
       Category   string `json:"category"`
   }

   func submitDownload(url string) error {
       req := DownloadRequest{
           URL:        url,
           PluginName: "my-plugin",
           Category:   "my-category",
       }

       data, _ := json.Marshal(req)
       resp, err := http.Post(
           "http://localhost:8080/api/v1/download",
           "application/json",
           bytes.NewBuffer(data),
       )
       return err
   }
   ```

3. **添加 Dockerfile**
   ```dockerfile
   FROM golang:1.21-alpine AS builder
   WORKDIR /build
   COPY . .
   RUN go build -o plugin main.go

   FROM alpine:latest
   COPY --from=builder /build/plugin /plugin
   CMD ["/plugin"]
   ```

4. **注册到 docker-compose.yml**
   ```yaml
   my-plugin:
     build: ./plugins/my-plugin
     environment:
       CORE_API_URL: http://mynest-core:8080
     restart: unless-stopped
   ```

### 插件配置管理

在 `backend/plugin/runner.go` 的 `buildPluginCommand()` 添加配置映射：

```go
case "my-plugin":
    cmd := exec.Command("go", "run", "plugins/my-plugin/main.go")
    if apiKey, ok := config["api_key"].(string); ok {
        cmd.Env = append(os.Environ(), fmt.Sprintf("API_KEY=%s", apiKey))
    }
    return cmd, nil
```

在 `frontend/src/components/PluginConfigDialog.tsx` 添加配置表单：

```typescript
const PLUGIN_CONFIGS = {
  'my-plugin': [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'interval', label: 'Check Interval (seconds)', type: 'number' },
  ],
}
```

## 路线图

- [x] Telegram Bot 插件
- [x] Web 界面配置插件
- [x] 下载路径模板
- [x] 插件运行日志
- [ ] RSS 订阅插件
- [ ] 文件自动分类与重命名
- [ ] WebSocket 实时进度推送
- [ ] 用户认证与多用户支持
- [ ] 云存储同步（S3/阿里云 OSS）
- [ ] 移动端 App

## 技术栈

- **后端**: Go 1.21+, Gin Web Framework, GORM
- **数据库**: PostgreSQL 14+
- **前端**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **下载引擎**: aria2 (JSON-RPC)
- **插件系统**: 独立进程 + HTTP API
- **部署**: Docker, Docker Compose

## 常见问题

### Q: Telegram Bot 提示 "file is too big"？
A: Telegram Bot API 限制文件大小为 20MB。对于大文件，建议：
- 先上传到云盘（阿里云盘、百度网盘等）
- 将云盘分享链接发送给 Bot

### Q: 如何修改下载目录？
A:
1. 编辑 `.env` 文件中的 `DOWNLOAD_DIR`
2. 重启服务：`docker-compose down && docker-compose up -d`

### Q: 插件无法启动？
A: 检查插件日志（Web 界面 → 插件管理 → 查看日志），常见原因：
- Bot Token 配置错误
- 网络连接问题（国内需代理访问 Telegram API）
- 环境变量未正确传递

### Q: 支持哪些下载协议？
A: 通过 aria2 支持：
- HTTP/HTTPS
- FTP/SFTP
- BitTorrent
- Magnet 链接
- Metalink

## Docker Hub

预构建镜像已发布到 Docker Hub：

```bash
# MyNest All-in-One（前端 + 后端 + 插件）
docker pull <your-dockerhub-username>/mynest:latest
```

## GitHub Release

每次版本发布会自动构建并推送镜像到 Docker Hub。

查看最新版本：[Releases](https://github.com/matrix/mynest/releases)

## 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 贡献

欢迎提交 Issue 和 Pull Request！

**开发前请阅读 [CLAUDE.md](CLAUDE.md) 了解项目架构**

## 致谢

- [aria2](https://aria2.github.io/) - 强大的下载引擎
- [shadcn/ui](https://ui.shadcn.com/) - 优雅的 UI 组件库
- [Telegram Bot API](https://core.telegram.org/bots/api) - Bot 开发支持

---

**MyNest** — 让每一条链接，都有家可归 🪹

*Built with ❤️ by the community*