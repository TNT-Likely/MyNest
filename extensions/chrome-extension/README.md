# MyNest Chrome 扩展

MyNest 下载助手是一个 Chrome 浏览器扩展，让您可以通过右键菜单快速将链接添加到 MyNest 下载器。

## ✨ 功能特性

- 🖱️ **右键下载**：在任何链接、图片、视频、音频上右键，选择"添加到 MyNest 下载"
- 📄 **页面下载**：在页面上右键，选择"下载当前页面到 MyNest"
- 🔒 **安全认证**：使用 API Token 进行认证，保护您的下载服务
- 🎨 **友好界面**：简洁优雅的配置和弹出界面
- 📊 **实时状态**：在弹出窗口查看连接状态

## 📦 安装步骤

### 1. 在 MyNest 中创建 API Token

1. 打开 MyNest 管理界面（默认 http://localhost:8080）
2. 进入「系统设置」→「API Token」
3. 点击「创建新 Token」
4. 输入名称（如：Chrome Extension）和描述
5. 保存后复制生成的 Token

### 2. 安装 Chrome 扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 打开右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本目录（`extensions/chrome-extension`）

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

### 方式二：下载当前页面

1. 在页面空白处右键
2. 选择「下载当前页面到 MyNest」

### 方式三：通过弹出窗口

1. 点击扩展图标打开弹出窗口
2. 点击「下载当前页面」按钮
3. 查看连接状态和快捷操作

## 🔧 技术架构

### 文件结构

```
chrome-extension/
├── manifest.json       # 扩展清单文件
├── background.js       # 后台脚本（处理右键菜单和API调用）
├── popup.html          # 弹出窗口界面
├── popup.js            # 弹出窗口脚本
├── options.html        # 配置页面界面
├── options.js          # 配置页面脚本
├── icons/              # 图标文件
└── README.md           # 说明文档
```

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
- 简洁的鸟巢或家的图标
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