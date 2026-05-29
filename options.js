// options.js - Options page interaction logic

let currentCategory = 'all';
let currentPromptId = null;
let currentCategoryId = null;
let selectedPrompts = new Set();
let currentEmoji = '📝';
let currentAiPromptId = null;
let aiResult = '';
let currentApiConfigId = null;

// Common emojis for picker
const COMMON_EMOJIS = [
  '📝', '💻', '🌐', '📊', '🎨', '📧', '📚', '💼', '🎯', '🔍',
  '💡', '📖', '🎭', '🗣️', '📱', '🎮', '🍳', '💪', '🎵', '📷',
  '🌟', '😀', '😂', '🥰', '😎', '🤔', '😱', '🎉', '🎊', '🏆',
  '🌈', '⭐', '🔥', '💯', '✅', '❌', '⚡', '🚀', '💎', '📌',
  '📎', '🔗', '📂', '📁', '🗂️', '📋', '📈', '📉', '🔧', '⚙️'
];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await initializeStorage();
  await renderCategories();
  await renderPrompts();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Search
  document.getElementById('search-input').addEventListener('input', debounce(() => {
    selectedPrompts.clear();
    renderPrompts();
  }, 300));

  // Sort
  document.getElementById('sort-select').addEventListener('change', () => {
    renderPrompts();
  });

  // Add prompt button
  document.getElementById('add-prompt-btn').addEventListener('click', () => {
    openPromptModal();
  });

  // Add category button
  document.getElementById('add-category-btn').addEventListener('click', () => {
    openCategoryModal();
  });

  // Select all button
  document.getElementById('select-all-btn').addEventListener('click', toggleSelectAll);

  // Delete selected button
  document.getElementById('delete-selected-btn').addEventListener('click', deleteSelected);

  // Import button
  document.getElementById('import-btn').addEventListener('click', importDataHandler);

  // Export button
  document.getElementById('export-btn').addEventListener('click', exportDataHandler);

  // Language button
  document.getElementById('lang-btn').addEventListener('click', toggleLanguage);

  // API settings button
  document.getElementById('api-settings-btn').addEventListener('click', () => openApiModal());

  // Prompt modal
  document.getElementById('modal-close').addEventListener('click', closePromptModal);
  document.getElementById('modal-cancel').addEventListener('click', closePromptModal);
  document.getElementById('modal-save').addEventListener('click', savePrompt);

  // Category modal
  document.getElementById('category-modal-close').addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal-cancel').addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal-save').addEventListener('click', saveCategory);

  // Emoji modal
  document.getElementById('emoji-modal-close').addEventListener('click', closeEmojiModal);
  document.getElementById('emoji-change-btn').addEventListener('click', openEmojiModal);
  document.getElementById('emoji-search').addEventListener('input', filterEmojis);

  // AI modal
  document.getElementById('ai-modal-close').addEventListener('click', closeAiModal);
  document.getElementById('ai-modal-cancel').addEventListener('click', closeAiModal);
  document.getElementById('ai-generate').addEventListener('click', generateAiPolish);
  document.getElementById('ai-regenerate').addEventListener('click', generateAiPolish);
  document.getElementById('ai-use').addEventListener('click', useAiResult);

  // API modal
  document.getElementById('api-modal-close').addEventListener('click', closeApiModal);
  document.getElementById('api-save').addEventListener('click', saveApiConfig);
  document.getElementById('api-delete').addEventListener('click', deleteApiConfigById);
  document.getElementById('api-test').addEventListener('click', testApiConnection);
  document.getElementById('api-key-toggle').addEventListener('click', toggleApiKeyVisibility);
}

// ========== Category Management ==========

async function renderCategories() {
  const categories = await getCategories();
  const prompts = await getPrompts();
  const listContainer = document.getElementById('category-list');

  const counts = {};
  prompts.forEach(p => {
    counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
  });

  listContainer.innerHTML = '';

  const allItem = document.createElement('div');
  allItem.className = 'category-item' + (currentCategory === 'all' ? ' active' : '');
  allItem.dataset.category = 'all';
  allItem.innerHTML = '<span class="category-emoji">📋</span><span class="category-name">全部</span><span class="category-count">' + prompts.length + '</span>';
  allItem.addEventListener('click', () => selectCategory('all'));
  listContainer.appendChild(allItem);

  categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'category-item' + (currentCategory === cat.id ? ' active' : '');
    item.dataset.category = cat.id;
    item.innerHTML = `
      <span class="category-emoji">${cat.emoji}</span>
      <span class="category-name">${cat.name}</span>
      <span class="category-count">${counts[cat.id] || 0}</span>
    `;
    item.addEventListener('click', () => selectCategory(cat.id));

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-small btn-secondary';
    editBtn.textContent = '✏️';
    editBtn.style.marginLeft = '4px';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryModal(cat.id);
    });
    item.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-small btn-danger';
    deleteBtn.textContent = '🗑️';
    deleteBtn.style.marginLeft = '2px';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategoryById(cat.id, cat.name, counts[cat.id] || 0);
    });
    item.appendChild(deleteBtn);

    listContainer.appendChild(item);
  });
}

function selectCategory(categoryId) {
  currentCategory = categoryId;
  selectedPrompts.clear();
  document.querySelectorAll('.category-item').forEach(item => {
    item.classList.toggle('active', item.dataset.category === categoryId);
  });
  renderPrompts();
}

// ========== Delete Category ==========

async function deleteCategoryById(categoryId, categoryName, promptCount) {
  if (categoryId === 'cat_other') {
    showToast('无法删除"其他"分类');
    return;
  }

  const message = promptCount > 0
    ? `确定要删除"${categoryName}"分类吗？\n该分类下有 ${promptCount} 条提示词，将自动移到"其他"分类。`
    : `确定要删除"${categoryName}"分类吗？`;

  if (!confirm(message)) return;

  await deleteCategory(categoryId);
  showToast(`已删除"${categoryName}"分类`);

  if (currentCategory === categoryId) {
    currentCategory = 'all';
  }

  await renderCategories();
  await renderPrompts();
}

// ========== Prompt CRUD ==========

async function renderPrompts() {
  const prompts = await getPrompts();
  const categories = await getCategories();
  const listContainer = document.getElementById('prompt-list');
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  const sortBy = document.getElementById('sort-select').value;

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

  filtered.sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    return b[sortBy] - a[sortBy];
  });

  listContainer.innerHTML = '';

  filtered.forEach(prompt => {
    const category = categories.find(c => c.id === prompt.categoryId);
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = `
      <div class="prompt-card-header">
        <div>
          <input type="checkbox" class="prompt-checkbox" data-id="${prompt.id}" ${selectedPrompts.has(prompt.id) ? 'checked' : ''}>
          <span class="prompt-card-title">${escapeHtml(prompt.title)}</span>
        </div>
        <span class="prompt-card-category">${category ? category.emoji + ' ' + category.name : '未分类'}</span>
      </div>
      <div class="prompt-card-content">${escapeHtml(prompt.content)}</div>
      <div class="prompt-card-actions">
        <button class="btn btn-small btn-primary copy-btn">📋 复制</button>
        <button class="btn btn-small btn-secondary edit-btn">✏️ 编辑</button>
        <button class="btn btn-small btn-secondary ai-btn">✨ AI 润色</button>
        <button class="btn btn-small btn-danger delete-btn">🗑️ 删除</button>
      </div>
    `;

    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(prompt.content);
    });

    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openPromptModal(prompt.id);
    });

    card.querySelector('.ai-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openAiPolishModal(prompt.id);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deletePromptById(prompt.id);
    });

    card.querySelector('.prompt-checkbox').addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedPrompts.add(prompt.id);
      } else {
        selectedPrompts.delete(prompt.id);
      }
      updateBatchButtons();
    });

    listContainer.appendChild(card);
  });

  updateBatchButtons();
}

function openPromptModal(promptId = null) {
  currentPromptId = promptId;
  const modal = document.getElementById('prompt-modal');
  const title = document.getElementById('modal-title');
  const titleInput = document.getElementById('prompt-title');
  const contentInput = document.getElementById('prompt-content');
  const categorySelect = document.getElementById('prompt-category');

  title.textContent = promptId ? '编辑提示词' : '新建提示词';

  getCategories().then(categories => {
    categorySelect.innerHTML = categories.map(c =>
      `<option value="${c.id}">${c.emoji} ${c.name}</option>`
    ).join('');

    if (promptId) {
      getPrompts().then(prompts => {
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          titleInput.value = prompt.title;
          contentInput.value = prompt.content;
          categorySelect.value = prompt.categoryId;
        }
      });
    } else {
      titleInput.value = '';
      contentInput.value = '';
      if (currentCategory !== 'all') {
        categorySelect.value = currentCategory;
      }
    }
  });

  modal.style.display = 'flex';
}

function closePromptModal() {
  document.getElementById('prompt-modal').style.display = 'none';
  currentPromptId = null;
}

async function savePrompt() {
  const title = document.getElementById('prompt-title').value.trim();
  const content = document.getElementById('prompt-content').value.trim();
  const categoryId = document.getElementById('prompt-category').value;

  if (!title || !content) {
    showToast('请填写标题和内容');
    return;
  }

  if (currentPromptId) {
    await updatePrompt(currentPromptId, { title, content, categoryId });
    showToast('提示词已更新');
  } else {
    await addPrompt({ title, content, categoryId });
    showToast('提示词已添加');
  }

  closePromptModal();
  await renderCategories();
  await renderPrompts();
}

async function deletePromptById(id) {
  if (confirm('确定要删除这条提示词吗？')) {
    await deletePrompt(id);
    showToast('提示词已删除');
    await renderCategories();
    await renderPrompts();
  }
}

function toggleSelectAll() {
  const checkboxes = document.querySelectorAll('.prompt-checkbox');
  const allSelected = Array.from(checkboxes).every(cb => cb.checked);

  checkboxes.forEach(cb => {
    cb.checked = !allSelected;
    const id = cb.dataset.id;
    if (!allSelected) {
      selectedPrompts.add(id);
    } else {
      selectedPrompts.delete(id);
    }
  });

  updateBatchButtons();
}

async function deleteSelected() {
  if (selectedPrompts.size === 0) return;

  if (confirm(`确定要删除选中的 ${selectedPrompts.size} 条提示词吗？`)) {
    await deletePrompts(Array.from(selectedPrompts));
    selectedPrompts.clear();
    showToast('已删除选中的提示词');
    await renderCategories();
    await renderPrompts();
  }
}

function updateBatchButtons() {
  const selectAllBtn = document.getElementById('select-all-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');

  if (selectedPrompts.size > 0) {
    selectAllBtn.style.display = 'inline-block';
    deleteSelectedBtn.style.display = 'inline-block';
    deleteSelectedBtn.textContent = `🗑️ 删除选中 (${selectedPrompts.size})`;
  } else {
    selectAllBtn.style.display = 'none';
    deleteSelectedBtn.style.display = 'none';
  }
}

// ========== Category Modal ==========

async function openCategoryModal(categoryId = null) {
  currentCategoryId = categoryId;
  const modal = document.getElementById('category-modal');
  const title = document.getElementById('category-modal-title');
  const nameInput = document.getElementById('category-name');
  const nameEnInput = document.getElementById('category-name-en');
  const emojiSelected = document.getElementById('emoji-selected');

  title.textContent = categoryId ? '编辑分类' : '新建分类';

  if (categoryId) {
    const categories = await getCategories();
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      nameInput.value = category.name;
      nameEnInput.value = category.nameEn;
      currentEmoji = category.emoji;
      emojiSelected.textContent = category.emoji;
    }
  } else {
    nameInput.value = '';
    nameEnInput.value = '';
    currentEmoji = '📝';
    emojiSelected.textContent = '📝';
  }

  modal.style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('category-modal').style.display = 'none';
  currentCategoryId = null;
}

async function saveCategory() {
  const name = document.getElementById('category-name').value.trim();
  const nameEn = document.getElementById('category-name-en').value.trim();

  if (!name) {
    showToast('请填写分类名称');
    return;
  }

  if (currentCategoryId) {
    await updateCategory(currentCategoryId, { name, nameEn, emoji: currentEmoji });
    showToast('分类已更新');
  } else {
    await addCategory({ name, nameEn, emoji: currentEmoji });
    showToast('分类已添加');
  }

  closeCategoryModal();
  await renderCategories();
  await renderPrompts();
}

// ========== Emoji Picker ==========

function openEmojiModal() {
  const modal = document.getElementById('emoji-modal');
  renderEmojiGrid(COMMON_EMOJIS);
  modal.style.display = 'flex';
}

function closeEmojiModal() {
  document.getElementById('emoji-modal').style.display = 'none';
}

function renderEmojiGrid(emojis) {
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';

  emojis.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-item';
    item.textContent = emoji;
    item.addEventListener('click', () => selectEmoji(emoji));
    grid.appendChild(item);
  });
}

function selectEmoji(emoji) {
  currentEmoji = emoji;
  document.getElementById('emoji-selected').textContent = emoji;
  closeEmojiModal();
}

function filterEmojis() {
  const query = document.getElementById('emoji-search').value.toLowerCase();
  const filtered = COMMON_EMOJIS.filter(e => e.includes(query));
  renderEmojiGrid(filtered);
}

// ========== AI Polish ==========

async function openAiPolishModal(promptId) {
  currentAiPromptId = promptId;
  const prompts = await getPrompts();
  const prompt = prompts.find(p => p.id === promptId);

  if (!prompt) return;

  document.getElementById('ai-original').textContent = prompt.content;
  document.getElementById('ai-result-group').style.display = 'none';
  document.getElementById('ai-generate').style.display = 'inline-block';
  document.getElementById('ai-use').style.display = 'none';
  document.getElementById('ai-regenerate').style.display = 'none';

  document.getElementById('ai-modal').style.display = 'flex';
}

function closeAiModal() {
  document.getElementById('ai-modal').style.display = 'none';
  currentAiPromptId = null;
}

async function generateAiPolish() {
  const original = document.getElementById('ai-original').textContent;
  const options = [];

  if (document.getElementById('ai-role').checked) options.push('添加角色设定');
  if (document.getElementById('ai-output').checked) options.push('细化输出要求');
  if (document.getElementById('ai-example').checked) options.push('添加示例参考');
  if (document.getElementById('ai-constraint').checked) options.push('增加约束条件');

  const generateBtn = document.getElementById('ai-generate');
  generateBtn.textContent = '生成中...';
  generateBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AI_POLISH',
      prompt: original,
      options
    });

    if (response.success) {
      aiResult = response.result;
      document.getElementById('ai-result').textContent = aiResult;
      document.getElementById('ai-result-group').style.display = 'block';
      document.getElementById('ai-generate').style.display = 'none';
      document.getElementById('ai-use').style.display = 'inline-block';
      document.getElementById('ai-regenerate').style.display = 'inline-block';
    } else {
      showToast('AI 润色失败：' + response.error);
    }
  } catch (error) {
    showToast('AI 润色失败：请检查 API 配置');
  }

  generateBtn.textContent = '开始润色';
  generateBtn.disabled = false;
}

async function useAiResult() {
  if (!currentAiPromptId || !aiResult) return;

  await updatePrompt(currentAiPromptId, { content: aiResult });
  showToast('已使用优化结果');
  closeAiModal();
  await renderPrompts();
}

// ========== API Config ==========

async function openApiModal(configId = null) {
  currentApiConfigId = configId;
  const modal = document.getElementById('api-modal');

  await renderApiConfigs();

  if (configId) {
    const configs = await getApiConfigs();
    const config = configs.find(c => c.id === configId);
    if (config) {
      document.getElementById('api-name').value = config.name;
      document.getElementById('api-url').value = config.apiUrl;
      document.getElementById('api-key').value = config.apiKey;
      document.getElementById('api-model').value = config.model;
    }
  } else {
    document.getElementById('api-name').value = '';
    document.getElementById('api-url').value = 'https://api.openai.com/v1';
    document.getElementById('api-key').value = '';
    document.getElementById('api-model').value = '';
  }

  modal.style.display = 'flex';
}

function closeApiModal() {
  document.getElementById('api-modal').style.display = 'none';
  currentApiConfigId = null;
}

async function renderApiConfigs() {
  const configs = await getApiConfigs();
  const activeConfig = await getActiveConfig();
  const container = document.getElementById('api-configs');

  container.innerHTML = '';

  configs.forEach(config => {
    const btn = document.createElement('button');
    btn.className = `btn btn-small ${config.id === activeConfig?.id ? 'btn-primary' : 'btn-secondary'}`;
    btn.textContent = config.name;
    btn.addEventListener('click', () => {
      setActiveConfig(config.id);
      renderApiConfigs();
    });
    container.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-small btn-secondary';
  addBtn.textContent = '+ 添加新配置';
  addBtn.addEventListener('click', () => openApiModal());
  container.appendChild(addBtn);
}

async function saveApiConfig() {
  const name = document.getElementById('api-name').value.trim();
  const apiUrl = document.getElementById('api-url').value.trim();
  const apiKey = document.getElementById('api-key').value.trim();
  const model = document.getElementById('api-model').value.trim();

  if (!name || !apiUrl || !apiKey || !model) {
    showToast('请填写所有字段');
    return;
  }

  if (currentApiConfigId) {
    await updateApiConfig(currentApiConfigId, { name, apiUrl, apiKey, model });
    showToast('配置已更新');
  } else {
    const config = await addApiConfig({ name, apiUrl, apiKey, model });
    await setActiveConfig(config.id);
    currentApiConfigId = config.id;
    showToast('配置已添加');
  }

  await renderApiConfigs();
}

async function deleteApiConfigById() {
  if (!currentApiConfigId) return;

  if (confirm('确定要删除此配置吗？')) {
    await deleteApiConfig(currentApiConfigId);
    showToast('配置已删除');
    closeApiModal();
  }
}

async function testApiConnection() {
  const apiUrl = document.getElementById('api-url').value.trim();
  const apiKey = document.getElementById('api-key').value.trim();
  const model = document.getElementById('api-model').value.trim();

  if (!apiUrl || !apiKey || !model) {
    showToast('请填写所有字段');
    return;
  }

  const testBtn = document.getElementById('api-test');
  testBtn.textContent = '测试中...';
  testBtn.disabled = true;

  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      showToast('连接成功');
    } else {
      const data = await response.json();
      showToast('连接失败：' + (data.error?.message || '未知错误'));
    }
  } catch (error) {
    showToast('连接失败：' + error.message);
  }

  testBtn.textContent = '测试连接';
  testBtn.disabled = false;
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ========== Language ==========

async function toggleLanguage() {
  const lang = await getLanguage();
  const newLang = lang === 'zh' ? 'en' : 'zh';
  await setLanguage(newLang);
  document.getElementById('lang-btn').textContent = newLang === 'zh' ? '🇨🇳 中文' : '🇺🇸 English';
  showToast(newLang === 'zh' ? '已切换到中文' : 'Switched to English');
}

// ========== Import/Export ==========

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

// ========== Utilities ==========

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

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
