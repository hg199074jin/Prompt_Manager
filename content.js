(function () {
  let prompts = [];
  let activeEditable = null;
  let selectedPrompt = null;

  const button = document.createElement('button');
  button.className = 'pm-floating-button';
  button.type = 'button';
  button.title = 'Prompt Manager';
  button.textContent = '⚡';

  const panel = document.createElement('div');
  panel.className = 'pm-panel';
  panel.innerHTML = `
    <div class="pm-panel-header">
      <span class="pm-panel-title">Prompt Manager</span>
      <input class="pm-panel-search" type="text" placeholder="搜索提示词或 /命令">
      <button class="pm-panel-close" type="button">✕</button>
    </div>
    <div class="pm-list"></div>
    <div class="pm-variable-form"></div>
  `;

  document.documentElement.appendChild(button);
  document.documentElement.appendChild(panel);

  const searchInput = panel.querySelector('.pm-panel-search');
  const listEl = panel.querySelector('.pm-list');
  const variableFormEl = panel.querySelector('.pm-variable-form');
  const closeBtn = panel.querySelector('.pm-panel-close');

  loadPrompts();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.prompts) {
      prompts = changes.prompts.newValue || [];
      renderPromptList(searchInput.value);
    }
  });

  document.addEventListener('focusin', (event) => {
    const editable = getSupportedEditable(event.target);
    if (!editable) return;
    activeEditable = editable;
    positionButton();
    button.style.display = 'flex';
  });

  document.addEventListener('click', (event) => {
    if (panel.contains(event.target) || button.contains(event.target)) return;
    hidePanel();
  });

  document.addEventListener('scroll', positionButton, true);
  window.addEventListener('resize', positionButton);

  document.addEventListener('keydown', async (event) => {
    const editable = getSupportedEditable(event.target);
    if (!editable) return;

    if (event.key !== 'Tab' && event.key !== 'Enter') return;
    const textState = getEditableTextState(editable);
    if (!textState) return;

    const trigger = findSlashCommandTrigger(textState.value, textState.selectionStart, prompts);
    if (!trigger) return;

    event.preventDefault();
    activeEditable = editable;
    await insertPrompt(trigger.prompt, 'slash-command', {
      start: trigger.start,
      end: trigger.end
    });
  }, true);

  button.addEventListener('click', () => {
    if (!activeEditable) return;
    showPanel();
  });

  closeBtn.addEventListener('click', hidePanel);
  searchInput.addEventListener('input', () => renderPromptList(searchInput.value));

  async function loadPrompts() {
    const data = await chrome.storage.local.get(['prompts']);
    prompts = data.prompts || [];
  }

  function getSupportedEditable(target) {
    if (!target || target === document.body || target === document.documentElement) return null;
    const tagName = target.tagName ? target.tagName.toLowerCase() : '';
    const isTextInput = tagName === 'textarea' || (
      tagName === 'input' &&
      !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(target.type)
    );
    if (isTextInput || target.isContentEditable) return target;
    return null;
  }

  function getEditableTextState(editable) {
    if (editable.tagName && ['input', 'textarea'].includes(editable.tagName.toLowerCase())) {
      return {
        value: editable.value,
        selectionStart: editable.selectionStart ?? editable.value.length,
        selectionEnd: editable.selectionEnd ?? editable.value.length
      };
    }
    return null;
  }

  function positionButton() {
    if (!activeEditable || !document.documentElement.contains(activeEditable)) {
      button.style.display = 'none';
      return;
    }
    const rect = activeEditable.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      button.style.display = 'none';
      return;
    }
    const left = Math.min(window.innerWidth - 42, Math.max(8, rect.right - 34));
    const top = Math.min(window.innerHeight - 42, Math.max(8, rect.top + 6));
    button.style.left = left + 'px';
    button.style.top = top + 'px';

    if (panel.style.display === 'block') {
      positionPanel();
    }
  }

  function positionPanel() {
    const buttonRect = button.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 376, Math.max(8, buttonRect.left - 320));
    const top = Math.min(window.innerHeight - 430, Math.max(8, buttonRect.bottom + 8));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function showPanel() {
    variableFormEl.style.display = 'none';
    panel.style.display = 'block';
    positionPanel();
    renderPromptList(searchInput.value);
    searchInput.focus();
  }

  function hidePanel() {
    panel.style.display = 'none';
    selectedPrompt = null;
  }

  function renderPromptList(query = '') {
    const normalized = query.trim().toLowerCase();
    let filtered = prompts.filter(prompt => !prompt.archived);

    if (normalized) {
      filtered = filtered.filter(prompt =>
        (prompt.title || '').toLowerCase().includes(normalized) ||
        (prompt.content || '').toLowerCase().includes(normalized) ||
        (prompt.slashCommand || '').toLowerCase().includes(normalized) ||
        (prompt.tags || []).some(tag => tag.toLowerCase().includes(normalized))
      );
    }

    filtered.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (b.usageCount || 0) - (a.usageCount || 0) || (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    const visible = filtered.slice(0, 20);
    if (visible.length === 0) {
      listEl.innerHTML = '<div class="pm-item"><div class="pm-item-title">没有匹配的提示词</div></div>';
      return;
    }

    listEl.innerHTML = '';
    visible.forEach(prompt => {
      const item = document.createElement('div');
      item.className = 'pm-item';
      item.innerHTML = `
        <div class="pm-item-title">${escapeHtml(prompt.title || '未命名提示词')}</div>
        <div class="pm-item-meta">${escapeHtml(prompt.slashCommand || '')}${prompt.usageCount ? ' · 使用 ' + prompt.usageCount + ' 次' : ''}</div>
        <div class="pm-item-content">${escapeHtml(prompt.content || '')}</div>
      `;
      item.addEventListener('click', () => insertPrompt(prompt, 'floating-panel'));
      listEl.appendChild(item);
    });
  }

  async function insertPrompt(prompt, action, replaceRange = null) {
    if (!activeEditable || !prompt) return;
    const variables = parseEnhancedVariables(prompt.content || '');
    if (variables.length > 0) {
      selectedPrompt = { prompt, action, replaceRange };
      renderVariableForm(prompt, variables);
      return;
    }

    applyTextToEditable(activeEditable, prompt.content || '', replaceRange);
    await recordUsage(prompt, action);
    hidePanel();
  }

  function renderVariableForm(prompt, variables) {
    variableFormEl.innerHTML = '';
    variableFormEl.style.display = 'block';

    const title = document.createElement('div');
    title.className = 'pm-item-title';
    title.textContent = '填写变量：' + (prompt.title || '未命名提示词');
    variableFormEl.appendChild(title);

    variables.forEach(variable => {
      const field = document.createElement('div');
      field.className = 'pm-field';
      const label = document.createElement('label');
      label.textContent = variable.label || variable.name;

      let input;
      if (variable.options.length > 0) {
        input = document.createElement('select');
        variable.options.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option;
          optionEl.textContent = option;
          input.appendChild(optionEl);
        });
      } else {
        input = document.createElement('input');
        input.type = variable.type === 'number' ? 'number' : 'text';
        input.placeholder = variable.label || variable.name;
        input.value = variable.defaultValue || '';
      }
      input.dataset.variable = variable.name;

      field.appendChild(label);
      field.appendChild(input);
      variableFormEl.appendChild(field);
    });

    const actions = document.createElement('div');
    actions.className = 'pm-actions';
    actions.innerHTML = `
      <button type="button" class="pm-cancel">取消</button>
      <button type="button" class="pm-primary">插入</button>
    `;
    actions.querySelector('.pm-cancel').addEventListener('click', () => {
      variableFormEl.style.display = 'none';
      selectedPrompt = null;
    });
    actions.querySelector('.pm-primary').addEventListener('click', confirmVariableInsert);
    variableFormEl.appendChild(actions);

    const firstInput = variableFormEl.querySelector('input, select');
    if (firstInput) firstInput.focus();
  }

  async function confirmVariableInsert() {
    if (!selectedPrompt) return;
    const values = {};
    variableFormEl.querySelectorAll('[data-variable]').forEach(input => {
      values[input.dataset.variable] = input.value.trim();
    });

    const content = fillEnhancedVariables(selectedPrompt.prompt.content || '', values);
    applyTextToEditable(activeEditable, content, selectedPrompt.replaceRange);
    await recordUsage(selectedPrompt.prompt, selectedPrompt.action);
    hidePanel();
  }

  function applyTextToEditable(editable, text, replaceRange = null) {
    const tagName = editable.tagName ? editable.tagName.toLowerCase() : '';
    const isTextInput = tagName === 'input' || tagName === 'textarea';

    if (isTextInput) {
      const start = replaceRange ? replaceRange.start : (editable.selectionStart ?? editable.value.length);
      const end = replaceRange ? replaceRange.end : (editable.selectionEnd ?? start);
      editable.focus();
      if (typeof editable.setRangeText === 'function') {
        editable.setRangeText(text, start, end, 'end');
      } else {
        editable.value = editable.value.slice(0, start) + text + editable.value.slice(end);
        const cursor = start + text.length;
        editable.selectionStart = cursor;
        editable.selectionEnd = cursor;
      }
      dispatchEditEvents(editable);
      return;
    }

    if (editable.isContentEditable) {
      editable.focus();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        editable.appendChild(document.createTextNode(text));
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      dispatchEditEvents(editable);
    }
  }

  function dispatchEditEvents(editable) {
    let inputEvent;
    try {
      inputEvent = new InputEvent('input', { bubbles: true, inputType: 'insertText' });
    } catch (error) {
      inputEvent = new Event('input', { bubbles: true });
    }
    editable.dispatchEvent(inputEvent);
    editable.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function recordUsage(prompt, action) {
    await chrome.runtime.sendMessage({
      type: 'RECORD_PROMPT_USAGE',
      promptId: prompt.id,
      meta: {
        action,
        host: location.host,
        url: location.href
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
