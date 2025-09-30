// MyNest Chrome Extension - Background Script

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'download-to-mynest',
    title: '添加到 MyNest 下载',
    contexts: ['link', 'video', 'audio', 'image']
  });

  chrome.contextMenus.create({
    id: 'download-page-to-mynest',
    title: '下载当前页面到 MyNest',
    contexts: ['page']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'download-to-mynest') {
    const url = info.linkUrl || info.srcUrl;
    if (url) {
      handleDownload(url, tab);
    }
  } else if (info.menuItemId === 'download-page-to-mynest') {
    handleDownload(info.pageUrl, tab);
  }
});

// 处理下载请求
async function handleDownload(url, tab) {
  try {
    // 获取配置
    const config = await getConfig();

    if (!config.apiUrl || !config.apiToken) {
      showNotification('配置错误', '请先在扩展选项中配置 API 地址和 Token', 'error');
      return;
    }

    // 调用 MyNest API
    const response = await fetch(`${config.apiUrl}/api/v1/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`
      },
      body: JSON.stringify({
        url: url,
        plugin_name: 'chrome-extension',
        category: config.defaultCategory || 'browser'
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showNotification(
        '✅ 已归巢',
        `链接已添加到 MyNest\n${url}`,
        'success'
      );
    } else {
      showNotification(
        '归巢失败',
        result.error || '请检查 API 配置或网络连接',
        'error'
      );
    }
  } catch (error) {
    console.error('Download error:', error);
    showNotification(
      '归巢失败',
      `错误: ${error.message}`,
      'error'
    );
  }
}

// 获取配置
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      apiUrl: '',
      apiToken: '',
      defaultCategory: 'browser'
    }, (items) => {
      resolve(items);
    });
  });
}

// 显示通知
function showNotification(title, message, type) {
  const iconPath = type === 'success' ? 'icons/icon48.png' : 'icons/icon48.png';

  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconPath,
    title: title,
    message: message,
    priority: 2
  });
}

// 监听来自 popup 的测试连接请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'testConnection') {
    testConnection(request.apiUrl, request.apiToken)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开放
  }
});

// 测试 API 连接
async function testConnection(apiUrl, apiToken) {
  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `连接成功！服务: ${data.name || 'MyNest'}`
      };
    } else {
      return {
        success: false,
        error: `服务返回错误: ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `连接失败: ${error.message}`
    };
  }
}