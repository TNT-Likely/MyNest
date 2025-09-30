# MyNest Chrome 扩展

MyNest 下载助手是一个 Chrome 浏览器扩展，让您可以通过右键菜单快速将链接添加到 MyNest 下载器。

## ✨ 功能特性

- 🖱️ **右键下载**：在任何链接、图片、视频、音频上右键，选择"添加到 MyNest 下载"
- 📝 **选中下载**：选中包含链接的文本，右键快速下载
- ⌨️ **手动输入**：在 popup 输入框直接粘贴链接下载
- 📊 **任务管理**：查看下载进度、状态，支持分类筛选
- 🔒 **安全认证**：使用 API Token 进行认证，保护您的下载服务

## 📦 安装步骤

### 1. 在 MyNest 中创建 API Token

1. 打开 MyNest 管理界面（默认 http://localhost:8080）
2. 进入「系统设置」→「API Token」
3. 点击「创建新 Token」
4. 输入名称（如：Chrome Extension）和描述
5. 保存后复制生成的 Token

### 2. 安装 Chrome 扩展

#### 开发模式安装

1. 进入扩展目录并安装依赖：
   ```bash
   cd extensions/chrome-extension
   pnpm install
   ```

2. 启动开发服务器（支持热更新）：
   ```bash
   pnpm dev
   ```

3. 打开 Chrome 浏览器，访问 `chrome://extensions/`
4. 打开右上角的「开发者模式」
5. 点击「加载已解压的扩展程序」
6. 选择 `extensions/chrome-extension/dist` 目录

#### 生产构建安装

1. 构建扩展：
   ```bash
   cd extensions/chrome-extension
   pnpm build
   ```

2. 在 `chrome://extensions/` 加载 `dist` 目录

### 3. 配置扩展

1. 右键点击扩展图标，选择「选项」
2. 填写以下信息：
   - **MyNest API 地址**：您的 MyNest 服务地址（如：`http://localhost:8080`）
   - **API Token**：在第一步中创建的 Token
   - **默认分类**：下载任务的分类标签（默认：`browser`）
3. 点击「测试连接」验证配置
4. 点击「保存配置」

## 🎯 使用方法

### 方式一：右键菜单下载

1. 在任何链接、图片、视频、音频上右键
2. 选择「添加到 MyNest 下载」
3. 等待通知确认任务已添加

### 方式二：选中文本下载

1. 选中包含下载链接的文本（如：`https://example.com/file.zip`）
2. 右键选择「下载选中的链接到 MyNest」
3. 自动提取并下载链接

### 方式三：通过弹出窗口

1. 点击扩展图标打开弹出窗口
2. 查看最近的下载任务和进度
3. 快速访问设置或 MyNest 管理面板

## 🔧 技术架构

### 技术栈

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite + @crxjs/vite-plugin
- **Chrome APIs**: Manifest V3
- **热更新**: 开发时支持 HMR

### 文件结构

```
chrome-extension/
├── src/
│   ├── background.ts      # Service Worker (TypeScript)
│   ├── popup.tsx          # Popup React 组件
│   ├── popup.html         # Popup HTML 入口
│   ├── popup.css          # Popup 样式
│   ├── options.tsx        # Options React 组件
│   ├── options.html       # Options HTML 入口
│   ├── options.css        # Options 样式
│   └── vite-env.d.ts      # Vite 类型定义
├── icons/                 # 扩展图标
├── manifest.json          # Manifest V3 配置
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
├── package.json           # 项目依赖
└── README.md              # 说明文档
```

### 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式（支持热更新）
pnpm dev

# 生产构建
pnpm build
```

开发模式下，修改代码会自动重新编译，无需手动刷新扩展。

### API 调用

扩展通过以下 API 与 MyNest 通信：

```javascript
POST /api/v1/download
Headers:
  - Content-Type: application/json
  - Authorization: Bearer <your-token>
Body:
  {
    "url": "https://example.com/file.zip",
    "plugin_name": "chrome-extension",
    "category": "browser"
  }
```

### 安全机制

- ✅ **Token 认证**：所有 API 请求都需要有效的 Token
- ✅ **HTTPS 支持**：支持通过 HTTPS 连接到 MyNest
- ✅ **本地存储**：配置存储在 Chrome Sync Storage 中，加密传输
- ✅ **权限最小化**：仅请求必要的浏览器权限

## 🎨 图标说明

扩展需要以下尺寸的图标（放在 `icons/` 目录）：

- `icon16.png` - 16x16 px（扩展栏图标）
- `icon32.png` - 32x32 px（工具栏图标）
- `icon48.png` - 48x48 px（扩展管理页面）
- `icon128.png` - 128x128 px（Chrome Web Store）

**图标设计建议**：
- 使用 MyNest 品牌色（棕色 #8B4513 + 蓝色 #2563EB）
- 主题：鸟巢 🪹（链接的归巢）
- 确保在浅色和深色背景下都清晰可见

## 🐛 故障排除

### 连接失败

1. 确认 MyNest 服务正在运行
2. 检查 API 地址是否正确（注意端口号）
3. 验证 API Token 是否有效且已启用
4. 检查防火墙或网络设置

### Token 无效

1. 在 MyNest 中重新生成 Token
2. 确保 Token 状态为「已启用」
3. 检查是否复制了完整的 Token

### 无法下载

1. 检查 URL 是否有效
2. 确认 MyNest 的 aria2 服务正常运行
3. 查看 MyNest 系统日志了解详细错误

## 📝 版本历史

### v1.0.0 (2024-01-01)

- ✨ 初始版本发布
- 🖱️ 右键菜单下载功能
- 🔒 API Token 认证
- 🎨 配置和弹出界面
- 📊 连接状态检测

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License