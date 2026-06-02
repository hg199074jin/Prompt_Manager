(function (global) {
  const TEMPLATE_VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

  function extractTemplateVariables(content) {
    const variables = [];
    const seen = new Set();
    let match;

    while ((match = TEMPLATE_VARIABLE_PATTERN.exec(content)) !== null) {
      const name = match[1].trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        variables.push(name);
      }
    }

    TEMPLATE_VARIABLE_PATTERN.lastIndex = 0;
    return variables;
  }

  function fillTemplateVariables(content, values) {
    return content.replace(TEMPLATE_VARIABLE_PATTERN, (placeholder, rawName) => {
      const name = rawName.trim();
      const value = values[name];
      return value ? value : placeholder;
    });
  }

  function insertTextIntoValue(value, text, selectionStart, selectionEnd) {
    const start = Number.isInteger(selectionStart) ? selectionStart : value.length;
    const end = Number.isInteger(selectionEnd) ? selectionEnd : start;
    const nextValue = value.slice(0, start) + text + value.slice(end);
    const nextCursor = start + text.length;

    return {
      value: nextValue,
      selectionStart: nextCursor,
      selectionEnd: nextCursor
    };
  }

  function normalizePromptTitle(prompt) {
    return (prompt.title || prompt.content || '未命名提示词').trim();
  }

  function buildPromptMenuGroups(prompts, limit) {
    const sorted = [...prompts];
    const limited = Number.isInteger(limit) && limit > 0 ? limit : 8;

    return {
      favorites: sorted
        .filter(prompt => prompt.favorite)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, limited),
      frequent: sorted
        .filter(prompt => (prompt.usageCount || 0) > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, limited),
      recent: sorted
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, limited)
    };
  }

  const api = {
    buildPromptMenuGroups,
    extractTemplateVariables,
    fillTemplateVariables,
    insertTextIntoValue,
    normalizePromptTitle
  };

  Object.assign(global, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
