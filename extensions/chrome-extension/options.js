// MyNest Chrome Extension - Options Page Script

// 页面加载时恢复保存的配置
document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();

  document.getElementById('configForm').addEventListener('submit', saveOptions);
  document.getElementById('testBtn').addEventListener('click', testConnection);
});

// 恢复配置
function restoreOptions() {
  chrome.storage.sync.get({
    apiUrl: '',
    apiToken: '',
    defaultCategory: 'browser'
  }, (items) => {
    document.getElementById('apiUrl').value = items.apiUrl;
    document.getElementById('apiToken').value = items.apiToken;
    document.getElementById('defaultCategory').value = items.defaultCategory;
  });
}

// 保存配置
function saveOptions(e) {
  e.preventDefault();

  const apiUrl = document.getElementById('apiUrl').value.trim();
  const apiToken = document.getElementById('apiToken').value.trim();
  const defaultCategory = document.getElementById('defaultCategory').value.trim();

  // 验证必填项
  if (!apiUrl || !apiToken) {
    showStatus('请填写所有必填项', 'error');
    return;
  }

  // 验证 URL 格式
  try {
    new URL(apiUrl);
  } catch (error) {
    showStatus('API 地址格式不正确', 'error');
    return;
  }

  // 保存到 Chrome Storage
  chrome.storage.sync.set({
    apiUrl: apiUrl,
    apiToken: apiToken,
    defaultCategory: defaultCategory || 'browser'
  }, () => {
    showStatus('✅ 配置已保存', 'success');
  });
}

// 测试连接
async function testConnection() {
  const apiUrl = document.getElementById('apiUrl').value.trim();
  const apiToken = document.getElementById('apiToken').value.trim();

  if (!apiUrl || !apiToken) {
    showStatus('请先填写 API 地址和 Token', 'error');
    return;
  }

  const testBtn = document.getElementById('testBtn');
  testBtn.textContent = '测试中...';
  testBtn.disabled = true;

  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      showStatus(`✅ 连接成功！服务: ${data.name || 'MyNest'}`, 'success');
    } else {
      showStatus(`连接失败: 服务返回 ${response.status}`, 'error');
    }
  } catch (error) {
    showStatus(`连接失败: ${error.message}`, 'error');
  } finally {
    testBtn.textContent = '测试连接';
    testBtn.disabled = false;
  }
}

// 显示状态消息
function showStatus(message, type) {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type} show`;

  // 3秒后自动隐藏
  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}