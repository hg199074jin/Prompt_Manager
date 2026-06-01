// popup.js - Popup interaction logic

let currentCategory = 'all';
let searchQuery = '';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await initializeStorage();
  await renderCategories();
  await renderPrompts();
  await checkForUpdates();
  await updateSyncStatusIndicator();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Search
  document.getElementById('search-input').addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.toLowerCase();
    renderPrompts();
  }, 300));

  // Add button
  document.getElementById('add-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Import button
  document.getElementById('import-btn').addEventListener('click', importDataHandler);

  // Export button
  document.getElementById('export-btn').addEventListener('click', exportDataHandler);
}

// Render categories
async function renderCategories() {
  const categories = await getCategories();
  const tabsContainer = document.getElementById('category-tabs');

  tabsContainer.innerHTML = '<button class="tab active" data-category="all">全部</button>';

  categories.forEach(cat => {
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.category = cat.id;
    tab.textContent = `${cat.emoji} ${cat.name}`;
    tab.addEventListener('click', () => selectCategory(cat.id));
    tabsContainer.appendChild(tab);
  });

  tabsContainer.querySelector('[data-category="all"]').addEventListener('click', () => {
    selectCategory('all');
  });
}

// Select category
function selectCategory(categoryId) {
  currentCategory = categoryId;

  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === categoryId);
  });

  renderPrompts();
}

// Render prompts
async function renderPrompts() {
  const prompts = await getPrompts();
  const categories = await getCategories();
  const listContainer = document.getElementById('prompt-list');

  let filtered = prompts;

  if (currentCategory !== 'all') {
    filtered = filtered.filter(p => p.categoryId === currentCategory);
  }

  if (searchQuery) {
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(searchQuery) ||
      p.content.toLowerCase().includes(searchQuery)
    );
  }

  // Sort by usage frequency, fallback to createdAt
  filtered.sort((a, b) => {
    const aFreq = a.usageCount || 0;
    const bFreq = b.usageCount || 0;
    if (aFreq > 0 && bFreq > 0) return bFreq - aFreq;
    if (aFreq > 0 && bFreq === 0) return -1;
    if (aFreq === 0 && bFreq > 0) return 1;
    return b.createdAt - a.createdAt;
  });

  listContainer.innerHTML = '';

  if (filtered.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.innerHTML = '<div class="empty-icon">📭</div><p>还没有提示词</p><p class="empty-hint">点击下方按钮添加第一个提示词</p>';
    listContainer.appendChild(emptyDiv);
    return;
  }

  filtered.forEach(prompt => {
    const category = categories.find(c => c.id === prompt.categoryId);
    const item = document.createElement('div');
    item.className = 'prompt-item';
    item.innerHTML = `
      <div class="prompt-item-header">
        <span class="prompt-title">${escapeHtml(prompt.title)}</span>
        <span class="prompt-category">${category ? category.emoji + ' ' + category.name : '未分类'}</span>
      </div>
      <div class="prompt-content">${escapeHtml(prompt.content)}</div>
    `;

    item.addEventListener('click', () => {
      copyToClipboard(prompt.content);
      incrementUsageCount(prompt.id);
    });

    item.addEventListener('dblclick', () => {
      chrome.runtime.openOptionsPage();
    });

    listContainer.appendChild(item);
  });
}

// Increment usage count
async function incrementUsageCount(promptId) {
  const prompts = await getPrompts();
  const prompt = prompts.find(p => p.id === promptId);
  if (prompt) {
    prompt.usageCount = (prompt.usageCount || 0) + 1;
    prompt.updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
  }
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板');
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('已复制到剪贴板');
  }
}

// Show toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// Check for updates
async function checkForUpdates() {
  try {
    const data = await chrome.storage.local.get(['updateInfo']);
    if (data.updateInfo && data.updateInfo.hasUpdate) {
      const banner = document.getElementById('update-banner');
      const updateText = document.getElementById('update-text');
      const updateLink = document.getElementById('update-link');

      updateText.textContent = `发现新版本 v${data.updateInfo.latestVersion}`;
      updateLink.href = data.updateInfo.downloadUrl;
      banner.style.display = 'flex';
    }
  } catch (error) {
    console.log('检查更新失败:', error);
  }
}

// Update sync status indicator
async function updateSyncStatusIndicator() {
  const indicator = document.getElementById('sync-status-indicator');
  const configData = await chrome.storage.local.get(['webdavConfig']);
  const config = configData.webdavConfig;

  if (!config || !config.enabled) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'inline-block';
  const stateData = await chrome.storage.local.get(['webdavSyncState']);
  const state = stateData.webdavSyncState || { status: 'idle' };

  if (state.status === 'syncing') {
    indicator.className = 'sync-status-indicator syncing';
    indicator.title = '同步中...';
  } else if (state.status === 'error') {
    indicator.className = 'sync-status-indicator error';
    indicator.title = '同步出错';
  } else {
    indicator.className = 'sync-status-indicator synced';
    indicator.title = state.lastSyncTime
      ? '上次同步: ' + new Date(state.lastSyncTime).toLocaleString()
      : '已启用';
  }
}

// Import data
async function importDataHandler() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    const text = await file.text();
    try {
      await importData(text);
      showToast('导入成功');
      await renderCategories();
      await renderPrompts();
    } catch (err) {
      showToast('导入失败：文件格式错误');
    }
  };
  input.click();
}

// Export data
async function exportDataHandler() {
  const json = await exportData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompt-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('导出成功');
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
