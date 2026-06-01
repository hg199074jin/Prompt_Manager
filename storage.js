// storage.js - Data storage layer

const STORAGE_KEYS = {
  PROMPTS: 'prompts',
  CATEGORIES: 'categories',
  API_CONFIGS: 'apiConfigs',
  ACTIVE_CONFIG: 'activeConfigId',
  LANGUAGE: 'language',
  PROMPT_VERSIONS: 'promptVersions',
  USAGE_EVENTS: 'usageEvents'
};

// Default categories
const DEFAULT_CATEGORIES = [
  { id: 'cat_writing', name: '写作', nameEn: 'Writing', emoji: '📝', isPreset: true, sortOrder: 0 },
  { id: 'cat_coding', name: '编程', nameEn: 'Coding', emoji: '💻', isPreset: true, sortOrder: 1 },
  { id: 'cat_translation', name: '翻译', nameEn: 'Translation', emoji: '🌐', isPreset: true, sortOrder: 2 },
  { id: 'cat_analysis', name: '分析', nameEn: 'Analysis', emoji: '📊', isPreset: true, sortOrder: 3 },
  { id: 'cat_creative', name: '创意', nameEn: 'Creative', emoji: '🎨', isPreset: true, sortOrder: 4 },
  { id: 'cat_email', name: '邮件', nameEn: 'Email', emoji: '📧', isPreset: true, sortOrder: 5 },
  { id: 'cat_learning', name: '学习', nameEn: 'Learning', emoji: '📚', isPreset: true, sortOrder: 6 },
  { id: 'cat_work', name: '工作', nameEn: 'Work', emoji: '💼', isPreset: true, sortOrder: 7 },
  { id: 'cat_marketing', name: '营销', nameEn: 'Marketing', emoji: '🎯', isPreset: true, sortOrder: 8 },
  { id: 'cat_research', name: '研究', nameEn: 'Research', emoji: '🔍', isPreset: true, sortOrder: 9 },
  { id: 'cat_brainstorming', name: '头脑风暴', nameEn: 'Brainstorming', emoji: '💡', isPreset: true, sortOrder: 10 },
  { id: 'cat_reading', name: '阅读', nameEn: 'Reading', emoji: '📖', isPreset: true, sortOrder: 11 },
  { id: 'cat_roleplay', name: '角色扮演', nameEn: 'Roleplay', emoji: '🎭', isPreset: true, sortOrder: 12 },
  { id: 'cat_summary', name: '总结', nameEn: 'Summary', emoji: '📝', isPreset: true, sortOrder: 13 },
  { id: 'cat_conversation', name: '对话', nameEn: 'Conversation', emoji: '🗣️', isPreset: true, sortOrder: 14 },
  { id: 'cat_social', name: '社交媒体', nameEn: 'Social Media', emoji: '📱', isPreset: true, sortOrder: 15 },
  { id: 'cat_gaming', name: '游戏', nameEn: 'Gaming', emoji: '🎮', isPreset: true, sortOrder: 16 },
  { id: 'cat_life', name: '生活', nameEn: 'Life', emoji: '🍳', isPreset: true, sortOrder: 17 },
  { id: 'cat_fitness', name: '健身', nameEn: 'Fitness', emoji: '💪', isPreset: true, sortOrder: 18 },
  { id: 'cat_music', name: '音乐', nameEn: 'Music', emoji: '🎵', isPreset: true, sortOrder: 19 },
  { id: 'cat_photography', name: '摄影', nameEn: 'Photography', emoji: '📷', isPreset: true, sortOrder: 20 },
  { id: 'cat_other', name: '其他', nameEn: 'Other', emoji: '🌟', isPreset: true, sortOrder: 21 }
];

// Initialize storage with defaults
async function initializeStorage() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.CATEGORIES]);

  if (!data[STORAGE_KEYS.CATEGORIES]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CATEGORIES]: DEFAULT_CATEGORIES,
      [STORAGE_KEYS.PROMPTS]: [],
      [STORAGE_KEYS.API_CONFIGS]: [],
      [STORAGE_KEYS.ACTIVE_CONFIG]: null,
      [STORAGE_KEYS.LANGUAGE]: 'zh',
      [STORAGE_KEYS.PROMPT_VERSIONS]: [],
      [STORAGE_KEYS.USAGE_EVENTS]: []
    });
  }
}

// Prompt CRUD
async function getPrompts() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.PROMPTS]);
  return data[STORAGE_KEYS.PROMPTS] || [];
}

async function addPrompt(prompt) {
  const prompts = await getPrompts();
  prompt.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  prompt.createdAt = Date.now();
  prompt.updatedAt = Date.now();
  prompt.usageCount = prompt.usageCount || 0;
  prompt.favorite = prompt.favorite || false;
  prompt.tags = prompt.tags || [];
  prompt.slashCommand = normalizePromptSlashCommand(prompt.slashCommand || '');
  prompt.rating = Number(prompt.rating) || 0;
  prompt.lastUsedAt = prompt.lastUsedAt || null;
  prompts.unshift(prompt);
  await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
  return prompt;
}

async function updatePrompt(id, updates) {
  const prompts = await getPrompts();
  const index = prompts.findIndex(p => p.id === id);
  if (index !== -1) {
    await savePromptVersion(prompts[index], updates);
    prompts[index] = {
      ...prompts[index],
      ...updates,
      slashCommand: normalizePromptSlashCommand(updates.slashCommand ?? prompts[index].slashCommand ?? ''),
      rating: Number(updates.rating ?? prompts[index].rating ?? 0),
      updatedAt: Date.now()
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
    return prompts[index];
  }
  return null;
}

async function deletePrompt(id) {
  const prompts = await getPrompts();
  const filtered = prompts.filter(p => p.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: filtered });
}

async function deletePrompts(ids) {
  const prompts = await getPrompts();
  const filtered = prompts.filter(p => !ids.includes(p.id));
  await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: filtered });
}

function normalizePromptSlashCommand(value) {
  if (!value) return '';
  const command = value.trim().replace(/^\/+/, '').toLowerCase();
  return command ? '/' + command.replace(/\s+/g, '-') : '';
}

async function getPromptVersions(promptId) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.PROMPT_VERSIONS]);
  const versions = data[STORAGE_KEYS.PROMPT_VERSIONS] || [];
  return versions
    .filter(version => version.promptId === promptId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function savePromptVersion(prompt, updates = {}) {
  const trackedFields = ['title', 'content', 'categoryId', 'tags', 'slashCommand', 'rating'];
  const hasTrackedChange = trackedFields.some(field =>
    updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(prompt[field])
  );
  if (!hasTrackedChange) return null;

  const data = await chrome.storage.local.get([STORAGE_KEYS.PROMPT_VERSIONS]);
  const versions = data[STORAGE_KEYS.PROMPT_VERSIONS] || [];
  const version = {
    id: 'ver_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    promptId: prompt.id,
    createdAt: Date.now(),
    snapshot: {
      title: prompt.title,
      content: prompt.content,
      categoryId: prompt.categoryId,
      tags: prompt.tags || [],
      slashCommand: prompt.slashCommand || '',
      rating: Number(prompt.rating) || 0,
      updatedAt: prompt.updatedAt || prompt.createdAt || Date.now()
    }
  };

  versions.unshift(version);
  await chrome.storage.local.set({ [STORAGE_KEYS.PROMPT_VERSIONS]: versions.slice(0, 500) });
  return version;
}

async function restorePromptVersion(promptId, versionId) {
  const versions = await getPromptVersions(promptId);
  const version = versions.find(item => item.id === versionId);
  if (!version) return null;
  return updatePrompt(promptId, version.snapshot);
}

async function recordPromptUsage(promptId, meta = {}) {
  const prompts = await getPrompts();
  const prompt = prompts.find(item => item.id === promptId);
  const timestamp = Date.now();
  if (prompt) {
    prompt.usageCount = (prompt.usageCount || 0) + 1;
    prompt.lastUsedAt = timestamp;
    prompt.updatedAt = timestamp;
  }

  const data = await chrome.storage.local.get([STORAGE_KEYS.USAGE_EVENTS]);
  const usageEvents = data[STORAGE_KEYS.USAGE_EVENTS] || [];
  usageEvents.unshift({
    id: 'use_' + timestamp + '_' + Math.random().toString(36).slice(2, 8),
    promptId,
    action: meta.action || 'insert',
    host: meta.host || '',
    url: meta.url || '',
    createdAt: timestamp
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.PROMPTS]: prompts,
    [STORAGE_KEYS.USAGE_EVENTS]: usageEvents.slice(0, 1000)
  });
}

async function getUsageEvents() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.USAGE_EVENTS]);
  return data[STORAGE_KEYS.USAGE_EVENTS] || [];
}

// Category CRUD
async function getCategories() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.CATEGORIES]);
  const categories = data[STORAGE_KEYS.CATEGORIES] || DEFAULT_CATEGORIES;
  return categories.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

async function addCategory(category) {
  const categories = await getCategories();
  category.id = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  category.isPreset = false;
  category.sortOrder = categories.length;
  categories.push(category);
  await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
  return category;
}

async function updateCategory(id, updates) {
  const categories = await getCategories();
  const index = categories.findIndex(c => c.id === id);
  if (index !== -1) {
    categories[index] = { ...categories[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
    return categories[index];
  }
  return null;
}

async function deleteCategory(id) {
  if (id === 'cat_other') return; // Cannot delete the "Other" category
  const categories = await getCategories();
  const filtered = categories.filter(c => c.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: filtered });

  // Move prompts from deleted category to "其他"
  const prompts = await getPrompts();
  const otherCategory = categories.find(c => c.id === 'cat_other');
  if (otherCategory) {
    const updated = prompts.map(p => {
      if (p.categoryId === id) {
        return { ...p, categoryId: otherCategory.id };
      }
      return p;
    });
    await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: updated });
  }
}

async function swapCategoryOrder(id1, id2) {
  const categories = await getCategories();

  // Ensure all categories have sortOrder before swapping
  categories.forEach((cat, idx) => {
    if (cat.sortOrder === undefined || cat.sortOrder === null) {
      cat.sortOrder = idx;
    }
  });

  const cat1 = categories.find(c => c.id === id1);
  const cat2 = categories.find(c => c.id === id2);
  if (cat1 && cat2) {
    const temp = cat1.sortOrder;
    cat1.sortOrder = cat2.sortOrder;
    cat2.sortOrder = temp;
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
  }
}

// API Config CRUD
async function getApiConfigs() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.API_CONFIGS]);
  return data[STORAGE_KEYS.API_CONFIGS] || [];
}

async function getActiveConfig() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.ACTIVE_CONFIG, STORAGE_KEYS.API_CONFIGS]);
  const configs = data[STORAGE_KEYS.API_CONFIGS] || [];
  const activeId = data[STORAGE_KEYS.ACTIVE_CONFIG];
  return configs.find(c => c.id === activeId) || configs[0] || null;
}

async function addApiConfig(config) {
  const configs = await getApiConfigs();
  config.id = 'config_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  configs.push(config);
  await chrome.storage.local.set({ [STORAGE_KEYS.API_CONFIGS]: configs });
  return config;
}

async function updateApiConfig(id, updates) {
  const configs = await getApiConfigs();
  const index = configs.findIndex(c => c.id === id);
  if (index !== -1) {
    configs[index] = { ...configs[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.API_CONFIGS]: configs });
    return configs[index];
  }
  return null;
}

async function deleteApiConfig(id) {
  const configs = await getApiConfigs();
  const filtered = configs.filter(c => c.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.API_CONFIGS]: filtered });
}

async function setActiveConfig(id) {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_CONFIG]: id });
}

// Language
async function getLanguage() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.LANGUAGE]);
  return data[STORAGE_KEYS.LANGUAGE] || 'zh';
}

async function setLanguage(lang) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LANGUAGE]: lang });
}

// WebDAV Config (not in STORAGE_KEYS to avoid being overwritten by importData)
async function getWebdavConfig() {
  const data = await chrome.storage.local.get(['webdavConfig']);
  return data.webdavConfig || null;
}

async function setWebdavConfig(config) {
  await chrome.storage.local.set({ webdavConfig: config });
}

// WebDAV Sync State
async function getWebdavSyncState() {
  const data = await chrome.storage.local.get(['webdavSyncState']);
  return data.webdavSyncState || { lastSyncTime: null, status: 'idle', lastError: null };
}

async function setWebdavSyncState(state) {
  await chrome.storage.local.set({ webdavSyncState: state });
}

// Export/Import
async function exportData() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.PROMPTS,
    STORAGE_KEYS.CATEGORIES,
    STORAGE_KEYS.API_CONFIGS,
    STORAGE_KEYS.ACTIVE_CONFIG,
    STORAGE_KEYS.LANGUAGE,
    STORAGE_KEYS.PROMPT_VERSIONS,
    STORAGE_KEYS.USAGE_EVENTS
  ]);
  return JSON.stringify(data, null, 2);
}

async function importData(jsonString) {
  const data = JSON.parse(jsonString);
  const validKeys = Object.values(STORAGE_KEYS);
  const sanitized = {};
  for (const key of validKeys) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }
  if (sanitized.prompts && !Array.isArray(sanitized.prompts)) throw new Error('prompts 必须是数组');
  if (sanitized.categories && !Array.isArray(sanitized.categories)) throw new Error('categories 必须是数组');
  if (sanitized.apiConfigs && !Array.isArray(sanitized.apiConfigs)) throw new Error('apiConfigs 必须是数组');
  if (sanitized.promptVersions && !Array.isArray(sanitized.promptVersions)) throw new Error('promptVersions 必须是数组');
  if (sanitized.usageEvents && !Array.isArray(sanitized.usageEvents)) throw new Error('usageEvents 必须是数组');
  await chrome.storage.local.set(sanitized);
}
