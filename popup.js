// popup.js - Popup interaction logic

let currentCategory = 'all';
let searchQuery = '';
let currentVariablesPrompt = null;

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
    searchQuery = e.target.value;
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

  tabsContainer.innerHTML = '';

  // All tab
  const allTab = document.createElement('button');
  allTab.className = 'tab active';
  allTab.dataset.category = 'all';
  allTab.textContent = '全部';
  allTab.addEventListener('click', () => selectCategory('all'));
  tabsContainer.appendChild(allTab);

  // Favorites tab
  const favTab = document.createElement('button');
  favTab.className = 'tab';
  favTab.dataset.category = 'favorites';
  favTab.textContent = '⭐ 收藏';
  favTab.addEventListener('click', () => selectCategory('favorites'));
  tabsContainer.appendChild(favTab);

  categories.forEach(cat => {
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.category = cat.id;
    tab.textContent = `${cat.emoji} ${cat.name}`;
    tab.addEventListener('click', () => selectCategory(cat.id));
    tabsContainer.appendChild(tab);
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

  if (currentCategory === 'favorites') {
    filtered = filtered.filter(p => p.favorite);
  } else if (currentCategory !== 'all') {
    filtered = filtered.filter(p => p.categoryId === currentCategory);
  }

  if (searchQuery) {
    const tagMatch = searchQuery.match(/^#(.+)$/);
    if (tagMatch) {
      // Tag search mode
      const tagQuery = tagMatch[1].toLowerCase();
      filtered = filtered.filter(p =>
        (p.tags || []).some(t => t.toLowerCase().includes(tagQuery))
      );
    } else {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.content || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
  }

  // Sort: favorites first, then by usage frequency, fallback to createdAt
  filtered.sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
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
    const tags = (prompt.tags || []);
    const tagsHtml = tags.length > 0
      ? `<div class="prompt-tags">${tags.map(t => `<span class="prompt-tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    item.innerHTML = `
      <div class="prompt-item-header">
        <span class="prompt-title">${escapeHtml(prompt.title)}</span>
        <div class="prompt-item-actions">
          <span class="prompt-category">${category ? escapeHtml(category.emoji + ' ' + category.name) : '未分类'}</span>
          <span class="favorite-btn ${prompt.favorite ? 'active' : ''}" data-id="${prompt.id}" title="收藏">⭐</span>
        </div>
      </div>
      ${tagsHtml}
      <div class="prompt-content">${escapeHtml(prompt.content)}</div>
    `;

    item.addEventListener('click', () => {
      const variables = parseEnhancedVariables(prompt.content);
      if (variables.length > 0) {
        showVariablesModal(prompt, variables);
      } else {
        copyToClipboard(prompt.content);
        recordPromptUsage(prompt.id, { action: 'popup-copy', host: 'extension-popup', url: '' });
      }
    });

    item.addEventListener('dblclick', () => {
      chrome.runtime.openOptionsPage();
    });

    // Favorite button
    const favBtn = item.querySelector('.favorite-btn');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(prompt.id);
      });
    }

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

// Toggle favorite
async function toggleFavorite(promptId) {
  const prompts = await getPrompts();
  const prompt = prompts.find(p => p.id === promptId);
  if (prompt) {
    prompt.favorite = !prompt.favorite;
    prompt.updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
    await renderPrompts();
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

// ============================================================
// Template Variables
// ============================================================

function showVariablesModal(prompt, variables) {
  currentVariablesPrompt = prompt;
  const form = document.getElementById('variables-form');
  form.innerHTML = '';

  variables.forEach((varName, index) => {
    const group = document.createElement('div');
    group.className = 'var-group';
    const label = document.createElement('label');
    label.textContent = varName.label || varName.name;
    label.htmlFor = 'var-input-' + index;
    let input;
    if (varName.options && varName.options.length > 0) {
      input = document.createElement('select');
      varName.options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        input.appendChild(optionEl);
      });
    } else {
      input = document.createElement('input');
      input.type = varName.type === 'number' ? 'number' : 'text';
      input.value = varName.defaultValue || '';
      input.placeholder = '请输入 ' + (varName.label || varName.name);
    }
    input.id = 'var-input-' + index;
    input.dataset.var = varName.name;
    group.appendChild(label);
    group.appendChild(input);
    form.appendChild(group);
  });

  document.getElementById('variables-modal').style.display = 'flex';
  const firstInput = form.querySelector('input');
  if (firstInput) firstInput.focus();
}

function closeVariablesModal() {
  document.getElementById('variables-modal').style.display = 'none';
  currentVariablesPrompt = null;
}

function confirmVariables() {
  if (!currentVariablesPrompt) return;

  const values = {};
  const inputs = document.querySelectorAll('#variables-form input[data-var]');
  const selects = document.querySelectorAll('#variables-form select[data-var]');

  inputs.forEach(input => {
    values[input.dataset.var] = input.value.trim();
  });
  selects.forEach(select => {
    values[select.dataset.var] = select.value.trim();
  });

  const content = fillEnhancedVariables(currentVariablesPrompt.content, values);
  copyToClipboard(content);
  recordPromptUsage(currentVariablesPrompt.id, { action: 'popup-copy', host: 'extension-popup', url: '' });
  closeVariablesModal();
}

// Variables modal event listeners
document.getElementById('variables-modal-close').addEventListener('click', closeVariablesModal);
document.getElementById('variables-cancel').addEventListener('click', closeVariablesModal);
document.getElementById('variables-confirm').addEventListener('click', confirmVariables);
document.getElementById('variables-modal').addEventListener('click', (e) => {
  if (e.target.id === 'variables-modal') closeVariablesModal();
});
