# Chrome 插件集成指南

MyNest 支持通过 API 与 Chrome 插件集成，实现一键下载网页资源。

## API 认证

Chrome 插件需要使用 API Token 进行认证：

1. 登录 MyNest Web 界面
2. 进入「API Tokens」页面
3. 创建新的 Token，命名如 "Chrome Extension"
4. 复制生成的 Token

## 提交下载任务

### 请求示例

```javascript
// Chrome Extension 中的代码示例
const MYNEST_API_URL = 'http://localhost:3001/api/v1'
const API_TOKEN = 'your_token_here' // 从用户配置中获取

async function downloadToMyNest(url) {
  try {
    const response = await fetch(`${MYNEST_API_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({
        url: url,
        plugin_name: 'chrome-extension',
        category: 'browser',
        filename: '' // 可选，不填则自动检测
      })
    })

    const result = await response.json()
    if (result.success) {
      console.log('✅ 任务已添加:', result.task)
      return result.task
    } else {
      console.error('❌ 添加失败:', result.error)
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('请求失败:', error)
    throw error
  }
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 下载链接（支持 HTTP/HTTPS/Magnet） |
| `plugin_name` | string | 是 | 固定为 `chrome-extension` |
| `category` | string | 否 | 分类标签（如 `browser`, `video`, `image`） |
| `filename` | string | 否 | 指定文件名，不填则自动检测 |

### 响应格式

```json
{
  "success": true,
  "message": "任务已归巢",
  "task": {
    "id": 123,
    "url": "https://example.com/file.zip",
    "filename": "file.zip",
    "status": "downloading",
    "plugin_name": "chrome-extension",
    "category": "browser",
    "gid": "a1b2c3d4e5f6g7h8",
    "created_at": "2025-09-30T12:34:56Z"
  }
}
```

## 使用示例

### 右键菜单集成

```javascript
// background.js
chrome.contextMenus.create({
  id: "download-to-mynest",
  title: "发送到 MyNest 下载",
  contexts: ["link", "image", "video", "audio"]
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "download-to-mynest") {
    const url = info.linkUrl || info.srcUrl
    try {
      await downloadToMyNest(url)
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'MyNest',
        message: '✅ 下载任务已添加'
      })
    } catch (error) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'MyNest',
        message: '❌ 添加失败: ' + error.message
      })
    }
  }
})
```

### 当前页面下载

```javascript
// popup.js
document.getElementById('download-current-tab').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  try {
    await downloadToMyNest(tab.url)
    document.getElementById('status').textContent = '✅ 已添加到下载队列'
  } catch (error) {
    document.getElementById('status').textContent = '❌ 添加失败'
  }
})
```

## 配置存储

建议使用 `chrome.storage.sync` 存储用户配置：

```javascript
// 保存配置
async function saveConfig(apiUrl, apiToken) {
  await chrome.storage.sync.set({
    mynestApiUrl: apiUrl,
    mynestApiToken: apiToken
  })
}

// 读取配置
async function loadConfig() {
  const result = await chrome.storage.sync.get(['mynestApiUrl', 'mynestApiToken'])
  return {
    apiUrl: result.mynestApiUrl || 'http://localhost:3001/api/v1',
    apiToken: result.mynestApiToken || ''
  }
}
```

## 注意事项

1. **CORS 支持**：MyNest 后端已配置 CORS，支持跨域请求
2. **Token 安全**：请妥善保管 API Token，不要提交到公共仓库
3. **错误处理**：建议添加完善的错误提示，提升用户体验
4. **批量下载**：可以循环调用 API 实现批量下载
5. **下载路径**：Chrome 插件提交的任务会保存到 `/downloads/` 根目录（不带日期前缀）

## 示例项目

完整的 Chrome 扩展示例代码：[mynest-chrome-extension](https://github.com/yourusername/mynest-chrome-extension)

## 技术支持

- GitHub Issues: https://github.com/yourusername/mynest/issues
- 文档: https://docs.mynest.example.com