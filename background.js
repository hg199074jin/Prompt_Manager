// background.js - Background script for AI polish and update checks

importScripts('context-menu-utils.js', 'pro-utils.js');

// AI Polish system prompt
const SYSTEM_PROMPT = `你是一位专业的 AI 提示词工程师。你的任务是优化用户提供的提示词，使其更清晰、更有效、更容易被 AI 理解。

优化原则：
1. 保持用户原始意图不变
2. 增加结构化和可执行性
3. 添加必要的上下文和约束
4. 使用清晰的指令语言

请根据用户选择的优化方向，对提示词进行优化。`;

const OPTION_INSTRUCTIONS = {
  '添加角色设定': '为提示词添加明确的角色设定，如"你是一位资深XX专家"',
  '细化输出要求': '明确输出格式、字数、结构等具体要求',
  '添加示例参考': '添加 1-2 个示例，帮助 AI 理解期望的输出',
  '增加约束条件': '添加限制条件，如语言风格、禁止内容等'
};

// Version comparison (semver)
function compareVersions(current, latest) {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    if (latestPart > currentPart) return 1;
    if (latestPart < currentPart) return -1;
  }
  return 0;
}

// Check for updates via GitHub API
async function checkForUpdates() {
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    const response = await fetch('https://api.github.com/repos/hg199074jin/Prompt_Manager/releases/latest');

    if (!response.ok) return;

    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');

    if (compareVersions(currentVersion, latestVersion) > 0) {
      chrome.storage.local.set({
        updateInfo: {
          hasUpdate: true,
          latestVersion,
          downloadUrl: data.html_url
        }
      });
    }
  } catch (error) {
    console.log('检查更新失败:', error);
  }
}

// AI Polish handler
async function aiPolish(prompt, options) {
  // Get active API config from storage
  const data = await chrome.storage.local.get(['apiConfigs', 'activeConfigId']);
  const configs = data.apiConfigs || [];
  const activeId = data.activeConfigId;
  const config = configs.find(c => c.id === activeId) || configs[0] || null;

  if (!config) {
    return { success: false, error: '请先在设置中配置 API' };
  }

  const optionInstructions = options.map(o => OPTION_INSTRUCTIONS[o]).filter(Boolean).join('\n');

  const systemMessage = SYSTEM_PROMPT + (optionInstructions ? '\n\n优化方向：\n' + optionInstructions : '');
  const userMessage = `请优化以下提示词：\n\n${prompt}\n\n请输出优化后的提示词，保持结构清晰。`;

  try {
    const response = await fetch(`${config.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      })
    });

    const responseData = await response.json();

    if (responseData.choices && responseData.choices[0]) {
      return { success: true, result: responseData.choices[0].message.content };
    } else {
      return { success: false, error: responseData.error?.message || '请求失败' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AI_POLISH') {
    aiPolish(request.prompt, request.options).then(sendResponse);
    return true;
  }
  if (request.type === 'WEBDAV_SYNC_NOW') {
    syncNow(request.direction || 'both').then(sendResponse);
    return true;
  }
  if (request.type === 'WEBDAV_TEST_CONNECTION') {
    testWebdavConnection(request.config).then(sendResponse);
    return true;
  }
  if (request.type === 'WEBDAV_GET_STATUS') {
    getWebdavSyncState().then(sendResponse);
    return true;
  }
  if (request.type === 'RECORD_PROMPT_USAGE') {
    recordPromptUsageFromBackground(request.promptId, request.meta || {}).then(sendResponse);
    return true;
  }
});

// Update check and sync on startup and install
chrome.runtime.onStartup.addListener(() => {
  checkForUpdates();
  refreshContextMenus();
  syncNow('both').then(() => setupPeriodicPull());
});

chrome.runtime.onInstalled.addListener(() => {
  checkForUpdates();
  refreshContextMenus();
  syncNow('both').then(() => setupPeriodicPull());
});

// ============================================================
// WebDAV Sync Engine
// ============================================================

// Storage helpers (inlined because service worker can't access storage.js)
async function getWebdavConfig() {
  const data = await chrome.storage.local.get(['webdavConfig']);
  return data.webdavConfig || null;
}

async function setWebdavConfig(config) {
  await chrome.storage.local.set({ webdavConfig: config });
}

async function getWebdavSyncState() {
  const data = await chrome.storage.local.get(['webdavSyncState']);
  return data.webdavSyncState || { lastSyncTime: null, status: 'idle', lastError: null };
}

async function setWebdavSyncState(state) {
  await chrome.storage.local.set({ webdavSyncState: state });
}

let _syncInProgress = false;
let _debounceTimer = null;

const SYNC_KEYS = ['prompts', 'categories', 'apiConfigs', 'activeConfigId', 'language', 'promptVersions', 'usageEvents'];

// Simple string hash for change detection
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// Build sync payload with _meta wrapper
async function buildSyncPayload() {
  const data = await chrome.storage.local.get(SYNC_KEYS);
  const prompts = data.prompts || [];
  const categories = data.categories || [];
  const allTimestamps = [
    ...prompts.map(p => p.updatedAt || 0),
    ...categories.map(c => c.updatedAt || 0)
  ];
  const lastModified = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();

  return {
    _meta: { version: 1, lastModified },
    prompts: data.prompts || [],
    categories: data.categories || [],
    apiConfigs: data.apiConfigs || [],
    activeConfigId: data.activeConfigId || null,
    language: data.language || 'zh',
    promptVersions: data.promptVersions || [],
    usageEvents: data.usageEvents || []
  };
}

// Parse sync payload, strip _meta
function parseSyncPayload(json) {
  let data = json;
  if (data._meta) {
    const { _meta, ...rest } = data;
    return { meta: _meta, data: rest };
  }
  return { meta: null, data };
}

// Get local lastModified timestamp
async function getLocalLastModified() {
  const data = await chrome.storage.local.get(SYNC_KEYS);
  const prompts = data.prompts || [];
  const categories = data.categories || [];
  const allTimestamps = [
    ...prompts.map(p => p.updatedAt || 0),
    ...categories.map(c => c.updatedAt || 0)
  ];
  return allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0;
}

// Build WebDAV URL
function buildWebdavUrl(config) {
  const base = config.serverUrl.replace(/\/+$/, '');
  if (!base.startsWith('https://')) {
    throw new Error('出于安全考虑，请使用 HTTPS 协议');
  }
  const path = config.remotePath.replace(/^\/+/, '');
  return `${base}/${path}`;
}

// Validate sync data structure
function validateSyncData(data) {
  const allowedKeys = ['prompts', 'categories', 'apiConfigs', 'activeConfigId', 'language', 'promptVersions', 'usageEvents'];
  const sanitized = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }
  if (sanitized.prompts && !Array.isArray(sanitized.prompts)) throw new Error('远程数据格式错误：prompts 必须是数组');
  if (sanitized.categories && !Array.isArray(sanitized.categories)) throw new Error('远程数据格式错误：categories 必须是数组');
  if (sanitized.apiConfigs && !Array.isArray(sanitized.apiConfigs)) throw new Error('远程数据格式错误：apiConfigs 必须是数组');
  if (sanitized.promptVersions && !Array.isArray(sanitized.promptVersions)) throw new Error('远程数据格式错误：promptVersions 必须是数组');
  if (sanitized.usageEvents && !Array.isArray(sanitized.usageEvents)) throw new Error('远程数据格式错误：usageEvents 必须是数组');
  return sanitized;
}

// Get auth header
function getAuthHeader(config) {
  const credentials = config.username + ':' + config.password;
  return 'Basic ' + btoa(unescape(encodeURIComponent(credentials)));
}

// Pull data from remote
async function pullFromRemote(config) {
  const url = buildWebdavUrl(config);
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': getAuthHeader(config) }
  });

  if (response.status === 404) {
    return { pulled: false, reason: 'no_remote_file' };
  }

  if (response.status === 401) {
    throw new Error('认证失败，请检查用户名和应用密码');
  }

  if (!response.ok) {
    throw new Error(`服务器返回 ${response.status}`);
  }

  const json = await response.json();
  const { meta, data } = parseSyncPayload(json);

  if (!meta || !meta.lastModified) {
    throw new Error('远程文件格式错误');
  }

  const localLastModified = await getLocalLastModified();

  if (meta.lastModified > localLastModified) {
    const sanitized = validateSyncData(data);
    _syncInProgress = true;
    try {
      await chrome.storage.local.set(sanitized);
    } finally {
      _syncInProgress = false;
    }
    return { pulled: true, lastModified: meta.lastModified };
  }

  return { pulled: false, reason: 'local_is_newer_or_equal' };
}

// Push data to remote
async function pushToRemote(config) {
  const payload = await buildSyncPayload();
  const payloadStr = JSON.stringify(payload);

  // Check if content has changed since last push
  const state = await getWebdavSyncState();
  const newHash = simpleHash(payloadStr);
  if (newHash === state.lastContentHash) {
    return { pushed: false, reason: 'no_changes' };
  }

  const url = buildWebdavUrl(config);
  const authHeader = getAuthHeader(config);

  let response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: payloadStr
  });

  // If 404, try creating parent directory (MKCOL) then retry
  if (response.status === 404) {
    const urlObj = new URL(url);
    const parentPath = urlObj.pathname.split('/').slice(0, -1).join('/');
    if (parentPath && parentPath !== '/' && parentPath !== urlObj.pathname) {
      const parentUrl = urlObj.origin + parentPath;
      await fetch(parentUrl, {
        method: 'MKCOL',
        headers: { 'Authorization': authHeader }
      }).catch(() => {}); // Ignore MKCOL errors (directory may already exist)
      // Retry PUT
      response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: payloadStr
      });
    }
  }

  if (response.status === 401) {
    throw new Error('认证失败，请检查用户名和应用密码');
  }

  if (!response.ok) {
    throw new Error(`上传失败，服务器返回 ${response.status}。请检查远程路径是否正确`);
  }

  return { pushed: true, contentHash: newHash };
}

// Main sync orchestrator
async function syncNow(direction = 'both') {
  const config = await getWebdavConfig();
  if (!config || !config.enabled) {
    return { success: false, error: '同步未启用' };
  }

  const prevState = await getWebdavSyncState();
  await setWebdavSyncState({ ...prevState, status: 'syncing', lastError: null });

  try {
    let pullResult = null;

    if (direction === 'pull' || direction === 'both') {
      pullResult = await pullFromRemote(config);
    }

    if (direction === 'push' || direction === 'both') {
      // After pull-import, push to ensure remote is consistent
      // Also push if pull didn't get new data (local may be newer)
      const pushResult = await pushToRemote(config);
      const newState = {
        lastSyncTime: Date.now(),
        status: 'idle',
        lastError: null,
        lastContentHash: pushResult.contentHash || prevState.lastContentHash
      };
      await setWebdavSyncState(newState);
      return { success: true, pulled: pullResult?.pulled || false, pushed: pushResult.pushed };
    }

    // pull-only
    const newState = {
      lastSyncTime: Date.now(),
      status: 'idle',
      lastError: null,
      lastContentHash: prevState.lastContentHash
    };
    await setWebdavSyncState(newState);
    return { success: true, pulled: pullResult?.pulled || false };
  } catch (error) {
    await setWebdavSyncState({
      ...prevState,
      status: 'error',
      lastError: error.message
    });
    return { success: false, error: error.message };
  }
}

// Debounced push (15 seconds)
function scheduleDebouncedPush() {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    _debounceTimer = null;
    const config = await getWebdavConfig();
    if (config && config.enabled && config.autoSync) {
      await syncNow('push');
    }
  }, 15000);
}

// Test WebDAV connection
async function testWebdavConnection(config) {
  try {
    const url = buildWebdavUrl(config);
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'Authorization': getAuthHeader(config) }
    });

    if (response.ok || response.status === 404) {
      return { success: true };
    }
    if (response.status === 401) {
      return { success: false, error: '认证失败，请检查用户名和应用密码' };
    }
    return { success: false, error: `服务器返回 ${response.status}` };
  } catch (error) {
    return { success: false, error: '无法连接到服务器: ' + error.message };
  }
}

// Listen for data changes → trigger debounced push
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.prompts) {
    refreshContextMenus();
  }
  if (_syncInProgress) return;
  const hasSyncRelevantChange = SYNC_KEYS.some(key => key in changes);
  if (!hasSyncRelevantChange) return;
  scheduleDebouncedPush();
});

// Listen for alarms → periodic pull
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'webdav-periodic-pull') {
    await syncNow('pull');
  }
});

// Set up periodic pull alarm
async function setupPeriodicPull() {
  const config = await getWebdavConfig();
  if (!config || !config.enabled) return;

  const interval = config.syncInterval || 120;
  await chrome.alarms.create('webdav-periodic-pull', { periodInMinutes: interval });
}

// ============================================================
// Context Menu
// ============================================================

const INSERT_PROMPT_MENU_ID = 'insert-prompt';
const INSERT_PROMPT_MENU_PREFIX = 'insert-prompt-item:';
const INSERT_PROMPT_MENU_GROUPS = [
  { id: 'insert-prompt-favorites', title: '收藏提示词', key: 'favorites', emptyTitle: '暂无收藏提示词' },
  { id: 'insert-prompt-frequent', title: '常用提示词', key: 'frequent', emptyTitle: '暂无常用提示词' },
  { id: 'insert-prompt-recent', title: '最近创建', key: 'recent', emptyTitle: '暂无提示词' }
];
let dynamicInsertPromptMenuIds = new Set();

function createContextMenu(options) {
  return new Promise(resolve => {
    if (!chrome.contextMenus?.create) {
      resolve(new Error('chrome.contextMenus.create is unavailable'));
      return;
    }
    chrome.contextMenus.create(options, () => resolve(chrome.runtime.lastError || null));
  });
}

function removeContextMenu(id) {
  return new Promise(resolve => {
    if (!chrome.contextMenus?.remove) {
      resolve(new Error('chrome.contextMenus.remove is unavailable'));
      return;
    }
    chrome.contextMenus.remove(id, () => resolve(chrome.runtime.lastError || null));
  });
}

function truncateMenuTitle(title) {
  const normalized = title.replace(/\s+/g, ' ').trim();
  return normalized.length > 32 ? normalized.slice(0, 31) + '…' : normalized;
}

async function createBaseContextMenus() {
  if (!chrome.contextMenus?.removeAll) return;
  await new Promise(resolve => chrome.contextMenus.removeAll(resolve));
  await createContextMenu({
    id: 'save-selection',
    title: '保存为提示词',
    contexts: ['selection']
  });
  await createContextMenu({
    id: INSERT_PROMPT_MENU_ID,
    title: '插入提示词',
    contexts: ['editable']
  });
}

async function clearDynamicInsertPromptMenus() {
  const knownGroupIds = INSERT_PROMPT_MENU_GROUPS.map(group => group.id);
  const ids = [...new Set([...Array.from(dynamicInsertPromptMenuIds), ...knownGroupIds])].reverse();
  dynamicInsertPromptMenuIds.clear();

  for (const id of ids) {
    await removeContextMenu(id);
  }
}

async function createDynamicInsertPromptMenus() {
  await clearDynamicInsertPromptMenus();

  const data = await chrome.storage.local.get(['prompts']);
  const prompts = data.prompts || [];
  const groups = buildPromptMenuGroups(prompts, 8);

  for (const group of INSERT_PROMPT_MENU_GROUPS) {
    await createContextMenu({
      id: group.id,
      parentId: INSERT_PROMPT_MENU_ID,
      title: group.title,
      contexts: ['editable']
    });
    dynamicInsertPromptMenuIds.add(group.id);

    const groupPrompts = groups[group.key] || [];
    if (groupPrompts.length === 0) {
      const emptyId = `${group.id}:empty`;
      await createContextMenu({
        id: emptyId,
        parentId: group.id,
        title: group.emptyTitle,
        contexts: ['editable'],
        enabled: false
      });
      dynamicInsertPromptMenuIds.add(emptyId);
      continue;
    }

    for (const prompt of groupPrompts) {
      const itemId = `${INSERT_PROMPT_MENU_PREFIX}${group.key}:${prompt.id}`;
      await createContextMenu({
        id: itemId,
        parentId: group.id,
        title: truncateMenuTitle(normalizePromptTitle(prompt)),
        contexts: ['editable']
      });
      dynamicInsertPromptMenuIds.add(itemId);
    }
  }
}

async function refreshContextMenus() {
  if (!chrome.contextMenus?.create) return;
  await createBaseContextMenus();
  await createDynamicInsertPromptMenus();
}

function getPromptIdFromMenuItem(menuItemId) {
  if (typeof menuItemId !== 'string' || !menuItemId.startsWith(INSERT_PROMPT_MENU_PREFIX)) {
    return null;
  }
  return menuItemId.slice(INSERT_PROMPT_MENU_PREFIX.length).replace(/^[^:]+:/, '');
}

function insertPromptIntoActiveEditable(rawContent) {
  const TEMPLATE_VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

  function parseVariableToken(token) {
    const trimmed = token.trim();
    const optionParts = trimmed.split('|');
    const left = optionParts[0].trim();
    const options = optionParts.length > 1
      ? optionParts.slice(1).join('|').split(',').map(item => item.trim()).filter(Boolean)
      : [];
    const segments = left.split(':').map(item => item.trim());
    const name = segments[0] || '';
    let label = name;
    let type = options.length > 0 ? 'select' : 'text';
    let defaultValue = '';

    if (segments.length === 2) {
      label = segments[1] || name;
    } else if (segments.length >= 3) {
      type = segments[1] || type;
      defaultValue = segments.slice(2).join(':');
    }

    return { name, label, type, defaultValue, options };
  }

  function extractVariables(content) {
    const variables = [];
    const seen = new Set();
    let match;
    while ((match = TEMPLATE_VARIABLE_PATTERN.exec(content)) !== null) {
      const variable = parseVariableToken(match[1]);
      if (variable.name && !seen.has(variable.name)) {
        seen.add(variable.name);
        variables.push(variable);
      }
    }
    TEMPLATE_VARIABLE_PATTERN.lastIndex = 0;
    return variables;
  }

  function fillVariables(content, values) {
    return content.replace(TEMPLATE_VARIABLE_PATTERN, (placeholder, rawToken) => {
      const variable = parseVariableToken(rawToken);
      const value = values[variable.name];
      return value ? value : placeholder;
    });
  }

  function getDeepActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  function dispatchEditEvents(element) {
    let inputEvent;
    try {
      inputEvent = new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null });
    } catch (error) {
      inputEvent = new Event('input', { bubbles: true });
    }
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const values = {};
  for (const variable of extractVariables(rawContent)) {
    const value = window.prompt(`请输入 ${variable.label}`, variable.defaultValue || variable.options[0] || '');
    if (value === null) {
      return { success: false, canceled: true };
    }
    values[variable.name] = value.trim();
  }

  const content = fillVariables(rawContent, values);
  const active = getDeepActiveElement();
  if (!active) {
    return { success: false, error: '未找到当前输入框' };
  }

  const tagName = active.tagName ? active.tagName.toLowerCase() : '';
  const isTextInput = tagName === 'textarea' || (
    tagName === 'input' &&
    !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(active.type)
  );

  if (isTextInput) {
    const start = Number.isInteger(active.selectionStart) ? active.selectionStart : active.value.length;
    const end = Number.isInteger(active.selectionEnd) ? active.selectionEnd : start;
    active.focus();

    if (typeof active.setRangeText === 'function') {
      active.setRangeText(content, start, end, 'end');
    } else {
      active.value = active.value.slice(0, start) + content + active.value.slice(end);
      const cursor = start + content.length;
      active.selectionStart = cursor;
      active.selectionEnd = cursor;
    }

    dispatchEditEvents(active);
    return { success: true };
  }

  if (active.isContentEditable) {
    active.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      active.appendChild(document.createTextNode(content));
      dispatchEditEvents(active);
      return { success: true };
    }

    const range = selection.getRangeAt(0);
    if (!active.contains(range.commonAncestorContainer)) {
      active.appendChild(document.createTextNode(content));
    } else {
      range.deleteContents();
      const textNode = document.createTextNode(content);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    dispatchEditEvents(active);
    return { success: true };
  }

  return { success: false, error: '当前元素不支持插入文本' };
}

async function insertPromptFromMenu(info, tab) {
  const promptId = getPromptIdFromMenuItem(info.menuItemId);
  if (!promptId || !tab?.id) return;

  const data = await chrome.storage.local.get(['prompts']);
  const prompts = data.prompts || [];
  const prompt = prompts.find(item => item.id === promptId);
  if (!prompt) return;

  const target = { tabId: tab.id };
  if (Number.isInteger(info.frameId) && info.frameId >= 0) {
    target.frameIds = [info.frameId];
  }

  try {
    const results = await chrome.scripting.executeScript({
      target,
      func: insertPromptIntoActiveEditable,
      args: [prompt.content || '']
    });
    const result = results?.[0]?.result;
    if (!result?.success) return;

    await recordPromptUsageFromBackground(prompt.id, {
      action: 'context-menu',
      host: new URL(tab.url || 'https://unknown.local').host,
      url: tab.url || ''
    });
  } catch (error) {
    console.log('插入提示词失败:', error);
  }
}

async function recordPromptUsageFromBackground(promptId, meta = {}) {
  if (!promptId) return { success: false };

  const data = await chrome.storage.local.get(['prompts', 'usageEvents']);
  const prompts = data.prompts || [];
  const usageEvents = data.usageEvents || [];
  const prompt = prompts.find(item => item.id === promptId);
  const timestamp = Date.now();

  if (prompt) {
    prompt.usageCount = (prompt.usageCount || 0) + 1;
    prompt.lastUsedAt = timestamp;
    prompt.updatedAt = timestamp;
  }

  usageEvents.unshift({
    id: 'use_' + timestamp + '_' + Math.random().toString(36).slice(2, 8),
    promptId,
    action: meta.action || 'insert',
    host: meta.host || '',
    url: meta.url || '',
    createdAt: timestamp
  });

  await chrome.storage.local.set({
    prompts,
    usageEvents: usageEvents.slice(0, 1000)
  });

  return { success: true };
}

if (chrome.contextMenus?.onClicked?.addListener) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'save-selection') {
      // Save selected text as a new prompt via options page
      const selectedText = info.selectionText || '';
      await chrome.storage.local.set({ _pendingSaveText: selectedText });
      chrome.runtime.openOptionsPage();
    }
    if (getPromptIdFromMenuItem(info.menuItemId)) {
      await insertPromptFromMenu(info, tab);
    }
  });
} else {
  console.warn('chrome.contextMenus.onClicked is unavailable; context menu actions are disabled.');
}

// ============================================================
// Keyboard Shortcuts
// ============================================================

if (chrome.commands?.onCommand?.addListener) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'save-selection') {
      // Get selected text from active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection().toString()
        });
        const selectedText = results[0]?.result || '';
        await chrome.storage.local.set({ _pendingSaveText: selectedText });
        chrome.runtime.openOptionsPage();
      } catch (e) {
        // Cannot inject into this page (chrome://, etc.)
        chrome.runtime.openOptionsPage();
      }
    }
  });
} else {
  console.warn('chrome.commands.onCommand is unavailable; keyboard shortcuts are disabled.');
}
