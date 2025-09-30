// MyNest Chrome Extension - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();

  document.getElementById('downloadCurrentBtn').addEventListener('click', downloadCurrentPage);
  document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
});

// 加载状态
async function loadStatus() {
  const config = await getConfig();

  // 显示 API 地址
  const apiUrlText = document.getElementById('apiUrlText');
  if (config.apiUrl) {
    try {
      const url = new URL(config.apiUrl);
      apiUrlText.textContent = url.host;
    } catch {
      apiUrlText.textContent = config.apiUrl;
    }

    // 设置面板链接
    document.getElementById('openDashboardBtn').href = config.apiUrl;
  } else {
    apiUrlText.textContent = '未配置';
  }

  // 测试连接
  if (config.apiUrl && config.apiToken) {
    testConnection(config.apiUrl, config.apiToken);
  } else {
    updateStatus(false, '未配置');
  }
}

// 测试连接
async function testConnection(apiUrl, apiToken) {
  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (response.ok) {
      updateStatus(true, '已连接');
    } else {
      updateStatus(false, '连接失败');
    }
  } catch (error) {
    updateStatus(false, '连接失败');
  }
}

// 更新状态显示
function updateStatus(connected, text) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  indicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
  statusText.textContent = text;
}

// 下载当前页面
async function downloadCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    alert('无法获取当前页面 URL');
    return;
  }

  const config = await getConfig();

  if (!config.apiUrl || !config.apiToken) {
    if (confirm('请先配置 API 地址和 Token，是否现在配置？')) {
      openSettings();
    }
    return;
  }

  try {
    const response = await fetch(`${config.apiUrl}/api/v1/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`
      },
      body: JSON.stringify({
        url: tab.url,
        plugin_name: 'chrome-extension',
        category: config.defaultCategory || 'browser'
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert('✅ 已归巢\n\n页面已添加到 MyNest 下载队列');
    } else {
      alert(`归巢失败\n\n${result.error || '请检查配置'}`);
    }
  } catch (error) {
    alert(`归巢失败\n\n${error.message}`);
  }
}

// 打开设置页面
function openSettings() {
  chrome.runtime.openOptionsPage();
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