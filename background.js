// background.js - Background script for AI polish and update checks

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
    const response = await fetch('https://api.github.com/repos/anthropics/prompt-manager/releases/latest');

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
    return true; // Keep message channel open for async response
  }
});

// Update check on startup and install
chrome.runtime.onStartup.addListener(checkForUpdates);
chrome.runtime.onInstalled.addListener(checkForUpdates);
