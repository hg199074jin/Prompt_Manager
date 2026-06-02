(function (global) {
  const AI_POLISH_MODES = {
    quick: {
      label: '快速润色',
      description: '轻量优化，保留核心语义，提升清晰度和可执行性。'
    },
    structured: {
      label: '专业结构化',
      description: '按角色、任务、步骤、约束和输出格式重构提示词。'
    },
    variables: {
      label: '变量模板化',
      description: '识别可复用字段，并改写为 {{变量}} 模板。'
    },
    format: {
      label: '严格输出格式',
      description: '重点补齐输出结构、字段、格式和验收标准。'
    },
    diagnose: {
      label: '诊断问题',
      description: '优先指出原提示词的问题，再给出必要的优化版本。'
    }
  };

  const OPTION_INSTRUCTIONS = {
    '添加角色设定': '为提示词添加明确的角色设定，例如“你是一位资深专家”。',
    '细化输出要求': '明确输出格式、字数、结构、语言风格和交付标准。',
    '添加示例参考': '添加 1-2 个简短示例，帮助 AI 理解期望输出。',
    '增加约束条件': '添加限制条件，例如禁止内容、必须包含的信息、语气边界。'
  };

  const VARIABLE_TYPES = new Set(['text', 'select', 'number', 'boolean', 'date']);

  function normalizeAiPolishMode(mode) {
    return Object.prototype.hasOwnProperty.call(AI_POLISH_MODES, mode) ? mode : 'quick';
  }

  function normalizeOptions(options) {
    return Array.isArray(options) ? options.filter(Boolean).map(String) : [];
  }

  function buildAiPolishMessages(prompt, options, mode) {
    const normalizedMode = normalizeAiPolishMode(mode);
    const modeConfig = AI_POLISH_MODES[normalizedMode];
    const selectedOptions = normalizeOptions(options);
    const optionLines = selectedOptions.length > 0
      ? selectedOptions.map(option => `- ${option}: ${OPTION_INSTRUCTIONS[option] || '按该方向增强提示词。'}`).join('\n')
      : '- 无额外方向：仅按当前模式优化。';
    const promptText = String(prompt || '');
    const originalPrompt = promptText.trim() ? promptText : '[空提示词：请给出一个可复用的基础提示词模板]';

    return [
      {
        role: 'system',
        content: [
          '你是一位专业的 AI 提示词工程师。',
          '你需要诊断并优化用户提供的提示词，保持用户原始意图不变。',
          '必须返回 JSON，不要返回 Markdown 代码块。',
          'JSON 字段必须包含：diagnosis, improvedPrompt, variableSuggestions, outputFormat, riskNotes。',
          'variableSuggestions 中 type 只能使用 text, select, number, boolean, date。'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          `优化模式：${modeConfig.label}`,
          `模式说明：${modeConfig.description}`,
          '',
          '额外优化方向：',
          optionLines,
          '',
          '原始提示词：',
          originalPrompt,
          '',
          '请返回如下 JSON 结构：',
          JSON.stringify({
            diagnosis: ['指出原提示词的主要问题'],
            improvedPrompt: '优化后的完整提示词',
            variableSuggestions: [
              {
                name: 'topic',
                label: '主题',
                type: 'text',
                options: [],
                defaultValue: ''
              }
            ],
            outputFormat: '建议的输出格式',
            riskNotes: ['潜在风险或使用提醒']
          }, null, 2)
        ].join('\n')
      }
    ];
  }

  function createFallbackResult(rawText, parseWarning) {
    const result = {
      diagnosis: [],
      improvedPrompt: String(rawText || ''),
      variableSuggestions: [],
      outputFormat: '',
      riskNotes: []
    };

    if (parseWarning) {
      result.parseWarning = parseWarning;
    }

    return result;
  }

  function stripJsonFence(text) {
    const trimmed = String(text || '').trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
  }

  function extractJsonCandidate(text) {
    const stripped = stripJsonFence(text);
    if (!stripped) return '';

    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return stripped.slice(firstBrace, lastBrace + 1);
    }

    return stripped;
  }

  function normalizeStringArray(value) {
    if (Array.isArray(value)) {
      return value.filter(item => item !== null && item !== undefined).map(String);
    }
    return value ? [String(value)] : [];
  }

  function normalizeVariableSuggestion(item) {
    if (!item || typeof item !== 'object') return null;

    const name = String(item.name || '').trim();
    if (!name) return null;

    const type = VARIABLE_TYPES.has(item.type) ? item.type : 'text';
    const options = Array.isArray(item.options)
      ? item.options.filter(option => option !== null && option !== undefined).map(String)
      : [];

    return {
      name,
      label: String(item.label || name),
      type,
      options,
      defaultValue: item.defaultValue === null || item.defaultValue === undefined ? '' : String(item.defaultValue)
    };
  }

  function normalizeStructuredResult(value) {
    const source = value && typeof value === 'object' ? value : {};

    return {
      diagnosis: normalizeStringArray(source.diagnosis),
      improvedPrompt: source.improvedPrompt === null || source.improvedPrompt === undefined ? '' : String(source.improvedPrompt),
      variableSuggestions: Array.isArray(source.variableSuggestions)
        ? source.variableSuggestions.map(normalizeVariableSuggestion).filter(Boolean)
        : [],
      outputFormat: source.outputFormat === null || source.outputFormat === undefined ? '' : String(source.outputFormat),
      riskNotes: normalizeStringArray(source.riskNotes)
    };
  }

  function parseAiPolishResponse(text) {
    const rawText = String(text || '').trim();
    if (!rawText) {
      return createFallbackResult('');
    }

    const candidate = extractJsonCandidate(rawText);
    const looksStructured = candidate.startsWith('{') || candidate.startsWith('[');

    if (!looksStructured) {
      return createFallbackResult(rawText);
    }

    try {
      return normalizeStructuredResult(JSON.parse(candidate));
    } catch (error) {
      return createFallbackResult(rawText, '结构化解析失败，已按纯文本结果展示。');
    }
  }

  function buildAiPolishCacheKey(prompt, options, mode) {
    return JSON.stringify({
      prompt: String(prompt || ''),
      options: normalizeOptions(options).sort(),
      mode: normalizeAiPolishMode(mode)
    });
  }

  const api = {
    AI_POLISH_MODES,
    buildAiPolishCacheKey,
    buildAiPolishMessages,
    normalizeAiPolishMode,
    parseAiPolishResponse
  };

  Object.assign(global, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
