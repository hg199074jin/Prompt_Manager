(function (global) {
  const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

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

  function parseEnhancedVariables(content) {
    const variables = [];
    const seen = new Set();
    let match;

    while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
      const variable = parseVariableToken(match[1]);
      if (variable.name && !seen.has(variable.name)) {
        seen.add(variable.name);
        variables.push(variable);
      }
    }

    VARIABLE_PATTERN.lastIndex = 0;
    return variables;
  }

  function fillEnhancedVariables(content, values) {
    return content.replace(VARIABLE_PATTERN, (placeholder, rawToken) => {
      const variable = parseVariableToken(rawToken);
      const value = values[variable.name];
      return value ? value : placeholder;
    });
  }

  function summarizeUsage(events) {
    const byPrompt = {};
    const byHost = {};

    for (const event of events || []) {
      if (event.promptId) {
        byPrompt[event.promptId] = (byPrompt[event.promptId] || 0) + 1;
      }
      if (event.host) {
        byHost[event.host] = (byHost[event.host] || 0) + 1;
      }
    }

    return { total: (events || []).length, byPrompt, byHost };
  }

  const api = {
    fillEnhancedVariables,
    parseEnhancedVariables,
    summarizeUsage
  };

  Object.assign(global, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
