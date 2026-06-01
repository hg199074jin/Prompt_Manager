// options.js - Options page interaction logic

let currentCategory = 'all';
let currentPromptId = null;
let currentCategoryId = null;
let selectedPrompts = new Set();
let currentEmoji = '📝';
let currentAiPromptId = null;
let aiResult = '';
let currentApiConfigId = null;
let currentTags = [];
let currentVersionPromptId = null;

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
  await updateSyncStatusIndicator();

  // Handle pending save text from context menu or keyboard shortcut
  await handlePendingSaveText();
});

// Listen for _pendingSaveText changes (when options page is already open)
if (chrome.storage?.onChanged?.addListener) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes._pendingSaveText) {
      const newValue = changes._pendingSaveText.newValue;
      if (newValue) {
        chrome.storage.local.remove(['_pendingSaveText']);
        openPromptModal();
        setTimeout(() => {
          document.getElementById('prompt-content').value = newValue;
        }, 100);
      }
    }
  });
}

async function handlePendingSaveText() {
  const data = await chrome.storage.local.get(['_pendingSaveText']);
  if (data._pendingSaveText) {
    await chrome.storage.local.remove(['_pendingSaveText']);
    openPromptModal();
    setTimeout(() => {
      document.getElementById('prompt-content').value = data._pendingSaveText;
    }, 100);
  }
}

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

  // Analytics button
  document.getElementById('analytics-btn').addEventListener('click', openAnalyticsModal);
  document.getElementById('analytics-modal-close').addEventListener('click', closeAnalyticsModal);

  // Version history modal
  document.getElementById('version-modal-close').addEventListener('click', closeVersionModal);

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

  // WebDAV sync modal
  document.getElementById('sync-settings-btn').addEventListener('click', openWebdavModal);
  document.getElementById('webdav-modal-close').addEventListener('click', closeWebdavModal);
  document.getElementById('webdav-save').addEventListener('click', saveWebdavConfig);
  document.getElementById('webdav-test').addEventListener('click', testWebdavConnectionFromUI);
  document.getElementById('webdav-sync-now').addEventListener('click', triggerSyncNow);
  document.getElementById('webdav-delete').addEventListener('click', clearWebdavConfig);
  document.getElementById('webdav-password-toggle').addEventListener('click', toggleWebdavPasswordVisibility);

  // Tags input
  const tagsInput = document.getElementById('tags-input');
  const tagsSuggestions = document.getElementById('tags-suggestions');

  tagsInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagsInput.value);
      tagsInput.value = '';
      tagsSuggestions.style.display = 'none';
    }
  });

  tagsInput.addEventListener('input', async (e) => {
    const value = e.target.value.trim().toLowerCase();
    if (!value) {
      tagsSuggestions.style.display = 'none';
      return;
    }
    const allTags = await getAllTags();
    const filtered = allTags.filter(t => t.toLowerCase().includes(value) && !currentTags.includes(t));
    if (filtered.length === 0) {
      tagsSuggestions.style.display = 'none';
      return;
    }
    tagsSuggestions.innerHTML = filtered.map(t =>
      `<div class="tag-suggestion-item">${escapeHtml(t)}</div>`
    ).join('');
    tagsSuggestions.style.display = 'block';
    tagsSuggestions.querySelectorAll('.tag-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        addTag(item.textContent);
        tagsInput.value = '';
        tagsSuggestions.style.display = 'none';
      });
    });
  });

  tagsInput.addEventListener('blur', () => {
    setTimeout(() => { tagsSuggestions.style.display = 'none'; }, 200);
  });

  // Sidebar resizer
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.querySelector('.sidebar');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX - sidebar.getBoundingClientRect().left;
    if (newWidth >= 220 && newWidth <= 500) {
      sidebar.style.width = newWidth + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
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

  // Favorites
  const favCount = prompts.filter(p => p.favorite).length;
  const favItem = document.createElement('div');
  favItem.className = 'category-item' + (currentCategory === 'favorites' ? ' active' : '');
  favItem.dataset.category = 'favorites';
  favItem.innerHTML = '<span class="category-emoji">⭐</span><span class="category-name">收藏</span><span class="category-count">' + favCount + '</span>';
  favItem.addEventListener('click', () => selectCategory('favorites'));
  listContainer.appendChild(favItem);

  categories.forEach((cat, i) => {
    const item = document.createElement('div');
    item.className = 'category-item' + (currentCategory === cat.id ? ' active' : '');
    item.dataset.category = cat.id;
    item.innerHTML = `
      <span class="category-emoji">${escapeHtml(cat.emoji)}</span>
      <span class="category-name">${escapeHtml(cat.name)}</span>
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

    // Up button
    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-small btn-secondary';
    upBtn.textContent = '↑';
    upBtn.style.marginLeft = '2px';
    upBtn.disabled = i === 0;
    upBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (i > 0) {
        await swapCategoryOrder(categories[i].id, categories[i - 1].id);
        await renderCategories();
        await renderPrompts();
      }
    });
    item.appendChild(upBtn);

    // Down button
    const downBtn = document.createElement('button');
    downBtn.className = 'btn btn-small btn-secondary';
    downBtn.textContent = '↓';
    downBtn.style.marginLeft = '2px';
    downBtn.disabled = i === categories.length - 1;
    downBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (i < categories.length - 1) {
        await swapCategoryOrder(categories[i].id, categories[i + 1].id);
        await renderCategories();
        await renderPrompts();
      }
    });
    item.appendChild(downBtn);

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

  if (currentCategory === 'favorites') {
    filtered = filtered.filter(p => p.favorite);
  } else if (currentCategory !== 'all') {
    filtered = filtered.filter(p => p.categoryId === currentCategory);
  }

  if (searchQuery) {
    filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(searchQuery) ||
      (p.content || '').toLowerCase().includes(searchQuery) ||
      (p.tags || []).some(t => t.toLowerCase().includes(searchQuery))
    );
  }

  filtered.sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'usageCount' || sortBy === 'rating') {
      return (b[sortBy] || 0) - (a[sortBy] || 0);
    }
    return (b[sortBy] || 0) - (a[sortBy] || 0);
  });

  listContainer.innerHTML = '';

  filtered.forEach(prompt => {
    const category = categories.find(c => c.id === prompt.categoryId);
    const card = document.createElement('div');
    card.className = 'prompt-card';
    const tags = (prompt.tags || []).map(t => `<span class="prompt-card-tag">${escapeHtml(t)}</span>`).join('');
    const rating = Number(prompt.rating) || 0;
    const ratingText = rating > 0 ? '★'.repeat(rating) : '未评分';
    const lastUsedText = prompt.lastUsedAt ? new Date(prompt.lastUsedAt).toLocaleString() : '从未使用';
    card.innerHTML = `
      <div class="prompt-card-header">
        <div>
          <input type="checkbox" class="prompt-checkbox" data-id="${prompt.id}" ${selectedPrompts.has(prompt.id) ? 'checked' : ''}>
          <span class="prompt-card-title">${escapeHtml(prompt.title)}</span>
        </div>
        <div class="prompt-card-header-right">
          <span class="prompt-card-category">${category ? escapeHtml(category.emoji + ' ' + category.name) : '未分类'}</span>
          <span class="favorite-star ${prompt.favorite ? 'active' : ''}" data-id="${prompt.id}" title="收藏">⭐</span>
        </div>
      </div>
      ${tags ? `<div class="prompt-card-tags">${tags}</div>` : ''}
      <div class="prompt-card-metrics">
        <span>使用 ${prompt.usageCount || 0} 次</span>
        <span>${ratingText}</span>
        <span>最近：${escapeHtml(lastUsedText)}</span>
      </div>
      <div class="prompt-card-content">${escapeHtml(prompt.content)}</div>
      <div class="prompt-card-actions">
        <button class="btn btn-small btn-primary copy-btn">📋 复制</button>
        <button class="btn btn-small btn-secondary edit-btn">✏️ 编辑</button>
        <button class="btn btn-small btn-secondary version-btn">🕘 历史</button>
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

    card.querySelector('.version-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openVersionModal(prompt.id);
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

    card.querySelector('.favorite-star').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(prompt.id);
    });

    listContainer.appendChild(card);
  });

  updateBatchButtons();
}

function openPromptModal(promptId = null) {
  currentPromptId = promptId;
  currentTags = [];
  const modal = document.getElementById('prompt-modal');
  const title = document.getElementById('modal-title');
  const titleInput = document.getElementById('prompt-title');
  const contentInput = document.getElementById('prompt-content');
  const categorySelect = document.getElementById('prompt-category');
  const ratingSelect = document.getElementById('prompt-rating');

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
          ratingSelect.value = String(Number(prompt.rating) || 0);
          currentTags = [...(prompt.tags || [])];
          renderTagsInput();
        }
      });
    } else {
      titleInput.value = '';
      contentInput.value = '';
      ratingSelect.value = '0';
      if (currentCategory !== 'all' && currentCategory !== 'favorites') {
        categorySelect.value = currentCategory;
      }
      renderTagsInput();
    }
  });

  modal.style.display = 'flex';
}

// ============================================================
// Tags Input Component
// ============================================================

function renderTagsInput() {
  const tagsList = document.getElementById('tags-list');
  tagsList.innerHTML = '';
  currentTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(tag)}<span class="tag-remove" data-tag="${escapeHtml(tag)}">&times;</span>`;
    chip.querySelector('.tag-remove').addEventListener('click', () => removeTag(tag));
    tagsList.appendChild(chip);
  });
}

function addTag(tag) {
  tag = tag.trim();
  if (!tag) return;
  if (currentTags.includes(tag)) return;
  currentTags.push(tag);
  renderTagsInput();
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTagsInput();
}

async function getAllTags() {
  const prompts = await getPrompts();
  const tagSet = new Set();
  prompts.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
  return [...tagSet];
}

function closePromptModal() {
  document.getElementById('prompt-modal').style.display = 'none';
  currentPromptId = null;
}

async function savePrompt() {
  const title = document.getElementById('prompt-title').value.trim();
  const content = document.getElementById('prompt-content').value.trim();
  const categoryId = document.getElementById('prompt-category').value;
  const tags = currentTags.filter(t => t.trim());
  const rating = Number(document.getElementById('prompt-rating').value) || 0;

  if (!title || !content) {
    showToast('请填写标题和内容');
    return;
  }

  if (currentPromptId) {
    await updatePrompt(currentPromptId, { title, content, categoryId, tags, rating });
    showToast('提示词已更新');
  } else {
    await addPrompt({ title, content, categoryId, tags, rating });
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

async function toggleFavorite(id) {
  const prompts = await getPrompts();
  const prompt = prompts.find(p => p.id === id);
  if (prompt) {
    prompt.favorite = !prompt.favorite;
    prompt.updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
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

// ========== Analytics ==========

async function openAnalyticsModal() {
  const prompts = await getPrompts();
  const usageEvents = await getUsageEvents();
  const summary = summarizeUsage(usageEvents);
  const promptById = new Map(prompts.map(prompt => [prompt.id, prompt]));
  const topPrompts = Object.entries(summary.byPrompt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topHosts = Object.entries(summary.byHost)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  document.getElementById('analytics-summary').innerHTML = `
    <div class="analytics-card"><strong>${summary.total}</strong><span>总使用次数</span></div>
    <div class="analytics-card"><strong>${topPrompts.length}</strong><span>被使用的提示词</span></div>
    <div class="analytics-card"><strong>${topHosts.length}</strong><span>使用网站</span></div>
  `;

  const rows = [];
  rows.push('<h3>热门提示词</h3>');
  if (topPrompts.length === 0) {
    rows.push('<div class="analytics-row"><span>暂无使用记录</span><span></span></div>');
  } else {
    topPrompts.forEach(([promptId, count]) => {
      const prompt = promptById.get(promptId);
      rows.push(`<div class="analytics-row"><span>${escapeHtml(prompt?.title || '已删除提示词')}</span><strong>${count}</strong></div>`);
    });
  }
  rows.push('<h3>常用网站</h3>');
  topHosts.forEach(([host, count]) => {
    rows.push(`<div class="analytics-row"><span>${escapeHtml(host)}</span><strong>${count}</strong></div>`);
  });

  document.getElementById('analytics-list').innerHTML = rows.join('');
  document.getElementById('analytics-modal').style.display = 'flex';
}

function closeAnalyticsModal() {
  document.getElementById('analytics-modal').style.display = 'none';
}

// ========== Version History ==========

async function openVersionModal(promptId) {
  currentVersionPromptId = promptId;
  const versions = await getPromptVersions(promptId);
  const list = document.getElementById('version-list');

  if (versions.length === 0) {
    list.innerHTML = '<div class="version-item">暂无历史版本。保存修改后会自动生成版本记录。</div>';
  } else {
    list.innerHTML = '';
    versions.forEach(version => {
      const item = document.createElement('div');
      item.className = 'version-item';
      item.innerHTML = `
        <div class="version-item-header">
          <strong>${new Date(version.createdAt).toLocaleString()}</strong>
          <button class="btn btn-small btn-secondary restore-version-btn" data-id="${version.id}">恢复此版本</button>
        </div>
        <div><strong>${escapeHtml(version.snapshot.title || '')}</strong></div>
        <pre>${escapeHtml(version.snapshot.content || '')}</pre>
      `;
      item.querySelector('.restore-version-btn').addEventListener('click', () => restoreVersion(version.id));
      list.appendChild(item);
    });
  }

  document.getElementById('version-modal').style.display = 'flex';
}

function closeVersionModal() {
  document.getElementById('version-modal').style.display = 'none';
  currentVersionPromptId = null;
}

async function restoreVersion(versionId) {
  if (!currentVersionPromptId) return;
  if (!confirm('确定要恢复到这个历史版本吗？当前版本会先保存到历史记录。')) return;
  await restorePromptVersion(currentVersionPromptId, versionId);
  showToast('已恢复历史版本');
  closeVersionModal();
  await renderCategories();
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

  // Request host permission for the API URL
  try {
    const urlObj = new URL(apiUrl);
    const origin = urlObj.origin + '/*';
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) {
      showToast('需要授权访问该 API 地址');
      return;
    }
  } catch (e) {
    showToast('API 地址格式不正确');
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

// ========== WebDAV Sync ==========

let webdavSyncStatusInterval = null;

async function openWebdavModal() {
  const modal = document.getElementById('webdav-modal');
  const config = await getWebdavConfig();

  if (config) {
    document.getElementById('webdav-enabled').checked = config.enabled || false;
    document.getElementById('webdav-server').value = config.serverUrl || '';
    document.getElementById('webdav-username').value = config.username || '';
    document.getElementById('webdav-password').value = config.password || '';
    document.getElementById('webdav-path').value = config.remotePath || '/prompt-manager-sync.json';
    document.getElementById('webdav-auto-sync').checked = config.autoSync !== false;
    document.getElementById('webdav-interval').value = config.syncInterval || 120;
  } else {
    document.getElementById('webdav-enabled').checked = false;
    document.getElementById('webdav-server').value = 'https://dav.jianguoyun.com/dav';
    document.getElementById('webdav-username').value = '';
    document.getElementById('webdav-password').value = '';
    document.getElementById('webdav-path').value = '/prompt-manager-sync.json';
    document.getElementById('webdav-auto-sync').checked = true;
    document.getElementById('webdav-interval').value = 120;
  }

  await renderSyncStatus();
  webdavSyncStatusInterval = setInterval(renderSyncStatus, 3000);
  modal.style.display = 'flex';
}

function closeWebdavModal() {
  document.getElementById('webdav-modal').style.display = 'none';
  if (webdavSyncStatusInterval) {
    clearInterval(webdavSyncStatusInterval);
    webdavSyncStatusInterval = null;
  }
}

async function saveWebdavConfig() {
  const enabled = document.getElementById('webdav-enabled').checked;
  const serverUrl = document.getElementById('webdav-server').value.trim();
  const username = document.getElementById('webdav-username').value.trim();
  const password = document.getElementById('webdav-password').value;
  const remotePath = document.getElementById('webdav-path').value.trim() || '/prompt-manager-sync.json';
  const autoSync = document.getElementById('webdav-auto-sync').checked;
  const syncInterval = parseInt(document.getElementById('webdav-interval').value) || 120;

  if (enabled && (!serverUrl || !username || !password)) {
    showToast('启用同步时需要填写服务器地址、用户名和密码');
    return;
  }

  // Request host permission for the WebDAV server URL
  if (enabled && serverUrl) {
    try {
      const urlObj = new URL(serverUrl);
      const origin = urlObj.origin + '/*';
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) {
        showToast('需要授权访问该 WebDAV 服务器地址');
        return;
      }
    } catch (e) {
      showToast('服务器地址格式不正确');
      return;
    }
  }

  const config = {
    serverUrl,
    username,
    password,
    remotePath,
    enabled,
    autoSync,
    syncInterval: Math.max(5, Math.min(1440, syncInterval))
  };

  await setWebdavConfig(config);
  showToast('同步配置已保存');
  await updateSyncStatusIndicator();
}

async function testWebdavConnectionFromUI() {
  const serverUrl = document.getElementById('webdav-server').value.trim();
  const username = document.getElementById('webdav-username').value.trim();
  const password = document.getElementById('webdav-password').value;
  const remotePath = document.getElementById('webdav-path').value.trim() || '/prompt-manager-sync.json';

  if (!serverUrl || !username || !password) {
    showToast('请填写服务器地址、用户名和密码');
    return;
  }

  // Request host permission for the WebDAV server URL
  try {
    const urlObj = new URL(serverUrl);
    const origin = urlObj.origin + '/*';
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) {
      showToast('需要授权访问该 WebDAV 服务器地址');
      return;
    }
  } catch (e) {
    showToast('服务器地址格式不正确');
    return;
  }

  const testBtn = document.getElementById('webdav-test');
  testBtn.textContent = '测试中...';
  testBtn.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'WEBDAV_TEST_CONNECTION',
      config: { serverUrl, username, password, remotePath }
    });

    if (result.success) {
      showToast('连接成功');
    } else {
      showToast('连接失败：' + result.error);
    }
  } catch (error) {
    showToast('测试失败：' + error.message);
  }

  testBtn.textContent = '测试连接';
  testBtn.disabled = false;
}

async function triggerSyncNow() {
  const syncBtn = document.getElementById('webdav-sync-now');
  syncBtn.textContent = '同步中...';
  syncBtn.disabled = true;

  try {
    // Always save current form values before syncing
    const enabled = document.getElementById('webdav-enabled').checked;
    const serverUrl = document.getElementById('webdav-server').value.trim();
    const username = document.getElementById('webdav-username').value.trim();
    const password = document.getElementById('webdav-password').value;
    const remotePath = document.getElementById('webdav-path').value.trim() || '/prompt-manager-sync.json';
    const autoSync = document.getElementById('webdav-auto-sync').checked;
    const syncInterval = parseInt(document.getElementById('webdav-interval').value) || 120;

    if (!enabled || !serverUrl || !username || !password) {
      showToast('请先填写配置并勾选"启用同步"');
      syncBtn.textContent = '立即同步';
      syncBtn.disabled = false;
      return;
    }

    const config = {
      serverUrl, username, password, remotePath,
      enabled: true, autoSync,
      syncInterval: Math.max(5, Math.min(1440, syncInterval))
    };
    await setWebdavConfig(config);

    const result = await chrome.runtime.sendMessage({
      type: 'WEBDAV_SYNC_NOW',
      direction: 'both'
    });

    if (result.success) {
      showToast('同步完成');
      await renderCategories();
      await renderPrompts();
    } else {
      showToast('同步失败：' + result.error);
    }
  } catch (error) {
    showToast('同步失败：' + error.message);
  }

  syncBtn.textContent = '立即同步';
  syncBtn.disabled = false;
  await renderSyncStatus();
  await updateSyncStatusIndicator();
}

async function clearWebdavConfig() {
  if (!confirm('确定要清除同步配置吗？\n这不会删除已同步到云端的数据。')) return;

  await setWebdavConfig(null);
  await setWebdavSyncState({ lastSyncTime: null, status: 'idle', lastError: null });
  showToast('同步配置已清除');
  closeWebdavModal();
  await updateSyncStatusIndicator();
}

async function renderSyncStatus() {
  const state = await getWebdavSyncState();

  const lastTimeEl = document.getElementById('sync-last-time');
  const statusTextEl = document.getElementById('sync-status-text');
  const errorRow = document.getElementById('sync-error-row');
  const errorText = document.getElementById('sync-error-text');

  lastTimeEl.textContent = state.lastSyncTime
    ? new Date(state.lastSyncTime).toLocaleString()
    : '从未';

  const statusMap = { idle: '空闲', syncing: '同步中...', error: '出错' };
  statusTextEl.textContent = statusMap[state.status] || '空闲';

  if (state.lastError) {
    errorRow.style.display = 'flex';
    errorText.textContent = state.lastError;
  } else {
    errorRow.style.display = 'none';
  }
}

async function updateSyncStatusIndicator() {
  const indicator = document.getElementById('sync-status-indicator');
  const config = await getWebdavConfig();

  if (!config || !config.enabled) {
    indicator.className = 'sync-status-indicator not-configured';
    indicator.title = '同步未配置';
    return;
  }

  const state = await getWebdavSyncState();

  if (state.status === 'syncing') {
    indicator.className = 'sync-status-indicator syncing';
    indicator.title = '同步中...';
  } else if (state.status === 'error') {
    indicator.className = 'sync-status-indicator error';
    indicator.title = '同步出错: ' + (state.lastError || '');
  } else {
    indicator.className = 'sync-status-indicator synced';
    indicator.title = state.lastSyncTime
      ? '上次同步: ' + new Date(state.lastSyncTime).toLocaleString()
      : '已启用，尚未同步';
  }
}

function toggleWebdavPasswordVisibility() {
  const input = document.getElementById('webdav-password');
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
